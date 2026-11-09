/** Invitation links are high-entropy one-use bearer tokens (192-bit random). */
export const INVITE_RE = /^[0-9a-f]{48}$/;
export const INVITE_TTL_DAYS = 7;

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
export function inviteExpired(expiresAt, atMillis = Date.now()) {
  if (typeof expiresAt?.toMillis === 'function') return expiresAt.toMillis() <= atMillis;
  if (typeof expiresAt?.seconds === 'number') return expiresAt.seconds * 1000 <= atMillis;
  return true;
}
