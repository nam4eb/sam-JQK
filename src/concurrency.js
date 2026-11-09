/**
 * Merge independent, concurrent edits to a single Firestore session document.
 * This runs INSIDE the Firestore transaction, with the latest committed document.
 * Never resolve edits to the same round by last-writer-wins.
 */
import { MAX_ROUNDS, settlementTransfers } from './ledger.js';
import { normalizeSession } from './cloud-model.js';

const CONFLICT = 'Dữ liệu cùng ván đã thay đổi trên điện thoại khác. Hãy xem lại ván trước khi lưu.';
const CLOSED = 'Phiên đã được chốt Done trên điện thoại khác. Ván chưa được lưu; hãy kiểm tra phiên.';
const CHANGED = 'Phiên đã được thay đổi trên điện thoại khác. Hãy tải lại dữ liệu trước khi thao tác.';

/** Stable equality, independent of Firestore's map key insertion order. */
export function sameData(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameData(v, b[i]));
  const aKeys = Object.keys(a).filter(k => a[k] !== undefined).sort();
  const bKeys = Object.keys(b).filter(k => b[k] !== undefined).sort();
  return aKeys.length === bKeys.length && aKeys.every((k, i) => k === bKeys[i] && sameData(a[k], b[k]));
}

function without(obj, keys) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));
}
function sameExcept(a, b, keys) { return sameData(without(a, keys), without(b, keys)); }
function fail(message = CHANGED) { throw new Error(message); }
function byId(rounds) { return new Map((rounds || []).map(r => [r.id, r])); }
function sameRoundContent(a, b) {
  return sameExcept(a, b, ['updatedAt']);
}
function playerSetMatches(a, b) {
  return sameData(a.memberIds, b.memberIds) && a.date === b.date && a.createdAt === b.createdAt;
}
function roundChange(before, after) {
  if (!before || !after || before.status !== 'active' || after.status !== 'active') return null;
  if (!sameExcept(before, after, ['rounds', 'updatedAt', 'updatedBy'])) return null;
  const prev = byId(before.rounds), next = byId(after.rounds);
  const added = [...next.keys()].filter(id => !prev.has(id));
  const removed = [...prev.keys()].filter(id => !next.has(id));
  const edited = [...prev.keys()].filter(id => next.has(id) && !sameRoundContent(prev.get(id), next.get(id)));
  // Only opt in to lossless merge for adding ONE round or changing ONE existing round.
  // Clearing the day, deleting rounds, and bulk edits retain strict conflict checks.
  if (added.length === 1 && !removed.length && !edited.length)
    return { kind: 'add', round: next.get(added[0]) };
  if (edited.length === 1 && !removed.length && !added.length)
    return { kind: 'edit', id: edited[0], before: prev.get(edited[0]), after: next.get(edited[0]) };
  return null;
}
function paymentChange(before, after) {
  if (!before || !after || !['done', 'paid'].includes(before.status) || !['done', 'paid'].includes(after.status)) return null;
  if (!sameExcept(before, after, ['payments', 'status', 'paidAt', 'updatedAt', 'updatedBy'])) return null;
  const p = before.payments || {}, n = after.payments || {};
  const ids = [...new Set([...Object.keys(p), ...Object.keys(n)])];
  const changed = ids.filter(id => (p[id] === true) !== (n[id] === true));
  if (changed.length !== 1) return null;
  return { id: changed[0], wasChecked: p[changed[0]] === true, checked: n[changed[0]] === true };
}

/**
 * Called only if the user's original session snapshot differs from the remote one.
 * Returns a merged session on safe non-overlapping edits. Unsafe conflicts throw.
 */
export function mergeSessionChange(before, after, remote) {
  if (!before || !after || !remote) fail();
  const rounds = roundChange(before, after);
  if (rounds) {
    if (remote.status !== 'active') fail(CLOSED);
    if (!playerSetMatches(before, remote)) fail('Danh sách người chơi đã thay đổi. Hãy mở lại ván trước khi lưu.');
    if (rounds.kind === 'add') {
      if ((remote.rounds || []).length >= MAX_ROUNDS) fail(`Đã đạt giới hạn ${MAX_ROUNDS} ván.`);
      if ((remote.rounds || []).some(r => r.id === rounds.round.id)) {
        const existing = remote.rounds.find(r => r.id === rounds.round.id);
        if (sameRoundContent(existing, rounds.round)) return remote;
        fail(CONFLICT);
      }
      if (!remote.memberIds.includes(rounds.round.winnerId) || Object.keys(rounds.round.losses || {}).some(id => !remote.memberIds.includes(id) || id === rounds.round.winnerId)) fail();
      return { ...remote, rounds: [...remote.rounds, rounds.round] };
    }
    const current = remote.rounds.find(r => r.id === rounds.id);
    if (!current) fail('Ván đã bị xóa từ điện thoại khác. Không ghi đè dữ liệu.');
    if (sameRoundContent(current, rounds.after)) return remote;
    if (!sameRoundContent(current, rounds.before)) fail(CONFLICT);
    return { ...remote, rounds: remote.rounds.map(r => r.id === rounds.id ? rounds.after : r) };
  }
  const payment = paymentChange(before, after);
  if (payment) {
    if (!['done', 'paid'].includes(remote.status) || !sameExcept(before, remote, ['payments', 'status', 'paidAt', 'updatedAt', 'updatedBy'])) fail();
    const available = settlementTransfers(remote).map(t => t.id);
    if (!available.includes(payment.id)) fail('Khoản thanh toán không còn tồn tại.');
    const now = remote.payments?.[payment.id] === true;
    if (now !== payment.wasChecked && now !== payment.checked) fail(CONFLICT);
    const payments = { ...remote.payments };
    if (payment.checked) payments[payment.id] = true; else delete payments[payment.id];
    return normalizeSession({ ...remote, payments, paidAt: remote.paidAt || null });
  }
  // Metadata-only differences (writer/timestamp) should never cause a conflict.
  if (sameExcept(before, remote, ['updatedAt', 'updatedBy'])) return { ...remote, ...after };
  fail();
}

/** Applies one intended document change against a live transaction snapshot. */
export function reconcileChange(change, remote) {
  if (change.previous === undefined) {
    if (remote !== undefined) fail('Mục đã được tạo trên một thiết bị khác.');
    return change.next;
  }
  if (remote === undefined) {
    if (change.kind === 'settings') return change.next; // initial settings doc does not yet exist
    fail('Dữ liệu đã bị xóa từ thiết bị khác.');
  }
  if (sameData(change.previous, remote)) return change.next;
  if (change.kind === 'sessions' && change.next !== null)
    return mergeSessionChange(change.previous, change.next, remote);
  if (sameExcept(change.previous, remote, ['updatedAt', 'updatedBy']))
    return change.next === null ? null : { ...remote, ...change.next };
  fail();
}
