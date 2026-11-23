/** A 192-bit random bearer link can invite different Google UIDs for up to one hour. */
export const INVITE_RE = /^[0-9a-f]{48}$/;
export const INVITE_TTL_MINUTES = 60;
export const INVITE_TTL_MS = INVITE_TTL_MINUTES * 60 * 1000;

export function generateInviteToken(cryptoSource = globalThis.crypto) {
  if (!cryptoSource?.getRandomValues) throw new Error('Thiết bị không hỗ trợ tạo link mời an toàn.');
  const bytes = new Uint8Array(24);
  cryptoSource.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export function parseInviteToken(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  const token = params.get('invite') || '';
  return INVITE_RE.test(token) ? token : null;
}
export function inviteLink(token, origin, base = '/sam-JQK/') {
  if (!INVITE_RE.test(token)) throw new Error('Mã lời mời không hợp lệ.');
  const url = new URL(base, origin);
  url.hash = `invite=${token}`;
  return url.toString();
}
export function timestampMillis(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  return NaN;
}
export function inviteValidUntil(invite) {
  // Server Rules also cap validity at createdAt + 1 hour, irrespective of clock skew.
  const created = timestampMillis(invite?.createdAt);
  const expires = timestampMillis(invite?.expiresAt);
  if (!Number.isFinite(created) || !Number.isFinite(expires)) return NaN;
  return Math.min(expires, created + INVITE_TTL_MS);
}
export function inviteExpired(expiresAt, atMillis = Date.now()) {
  return !(timestampMillis(expiresAt) > atMillis);
}
export function inviteIsReusable(invite, atMillis = Date.now()) {
  // v3.1 one-use (7-day) links lack mode='multi' and must never reactivate.
  if (!invite || invite.mode !== 'multi' || invite.claimedBy) return false;
  const created = timestampMillis(invite.createdAt);
  const deadline = inviteValidUntil(invite);
  return Number.isFinite(created) && Number.isFinite(deadline) && deadline > created && deadline > atMillis;
}
