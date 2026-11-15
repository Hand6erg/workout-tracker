import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createMiddleware } from 'hono/factory';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const KEY_LEN = 64;
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

/* ---------- Passwords (scrypt, built into Node) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/* ---------- Tokens (HS256 JWT) ---------- */

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

export function signToken(userId: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub: userId, iat: nowSec, exp: nowSec + TOKEN_TTL_SECONDS }));
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

/** Returns the user id, or null if the token is invalid or expired. */
export function verifyToken(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (h.alg !== 'HS256' || typeof p.sub !== 'string' || typeof p.exp !== 'number' || p.exp <= nowSec) return null;
    return p.sub;
  } catch {
    return null;
  }
}

export type AuthEnv = { Variables: { userId: string } };

export const requireAuth = (secret: string) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const userId = header.startsWith('Bearer ') ? verifyToken(header.slice(7), secret) : null;
    if (!userId) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', userId);
    await next();
  });

/* ---------- Simple in-memory rate limit ---------- */

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private max: number,
    private windowMs: number,
  ) {}

  /** Records an attempt; returns false if the key is over the limit. */
  hit(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 10_000) this.prune(now);
      return true;
    }
    entry.count++;
    return entry.count <= this.max;
  }

  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
