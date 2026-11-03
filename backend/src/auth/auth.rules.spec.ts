import { clientIp, validateNewUser } from './auth.rules.js';

describe('clientIp', () => {
  it('uses the socket IP when the proxy is not trusted, even if the header is sent', () => {
    expect(
      clientIp({ 'cf-connecting-ip': '203.0.113.9' }, '127.0.0.1', false),
    ).toBe('127.0.0.1');
  });
  it('uses CF-Connecting-IP when the proxy is trusted', () => {
    expect(
      clientIp({ 'cf-connecting-ip': '203.0.113.9' }, '172.18.0.2', true),
    ).toBe('203.0.113.9');
    expect(
      clientIp({ 'cf-connecting-ip': '2001:db8::1' }, '172.18.0.2', true),
    ).toBe('2001:db8::1');
  });
  it('falls back to the socket IP when the header is missing or not an IP', () => {
    expect(clientIp({}, '172.18.0.2', true)).toBe('172.18.0.2');
    expect(
      clientIp({ 'cf-connecting-ip': 'not-an-ip' }, '172.18.0.2', true),
    ).toBe('172.18.0.2');
    expect(
      clientIp({ 'cf-connecting-ip': ['1.1.1.1'] }, '172.18.0.2', true),
    ).toBe('172.18.0.2');
  });
  it('never returns an empty key', () => {
    expect(clientIp({}, undefined, false)).toBe('unknown');
  });
});

describe('validateNewUser', () => {
  it('accepts a normal username and a long password', () => {
    expect(validateNewUser('renzo', 'a-long-password-1')).toBeNull();
  });
  it('rejects bad usernames and short passwords', () => {
    expect(validateNewUser('', 'a-long-password-1')).not.toBeNull();
    expect(validateNewUser('with space', 'a-long-password-1')).not.toBeNull();
    expect(validateNewUser('renzo', 'short')).not.toBeNull();
  });
});
