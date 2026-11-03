import { isIP } from 'node:net';

type Headers = Record<string, string | string[] | undefined>;

/**
 * Client IP used for the login rate limit. Behind Cloudflare the real IP is in
 * `CF-Connecting-IP`; that header is only trusted when `trustProxy` is on,
 * because anyone who can reach the API directly could forge it.
 */
export function clientIp(
  headers: Headers,
  socketIp: string | undefined,
  trustProxy: boolean,
): string {
  if (trustProxy) {
    const forwarded = headers['cf-connecting-ip'];
    if (typeof forwarded === 'string' && isIP(forwarded.trim()) !== 0) {
      return forwarded.trim();
    }
  }
  return socketIp ?? 'unknown';
}

export const USERNAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const MIN_PASSWORD_LENGTH = 12;

export function validateNewUser(
  username: string,
  password: string,
): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 1-100 characters: letters, digits, ".", "_" or "-".';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
