import { describe, expect, it } from 'vitest';
import { ACCOUNT_KEY, authenticate, authErrorText, parseAccount, resolveApiUrl } from './account';

const json = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;

describe('konto', () => {
  it('bruger egen nøgle ved siden af data', () => {
    expect(ACCOUNT_KEY).toBe('loeft-account-v1');
  });

  it('finder API-adressen eller ingen', () => {
    expect(resolveApiUrl(undefined, null)).toBeNull();
    expect(resolveApiUrl('', '  ')).toBeNull();
    expect(resolveApiUrl('https://api.example.com/', null)).toBe('https://api.example.com');
    expect(resolveApiUrl(undefined, 'http://localhost:8787')).toBe('http://localhost:8787');
    expect(resolveApiUrl('https://a', 'https://b')).toBe('https://a');
  });

  it('læser gemt konto og afviser skrald', () => {
    expect(parseAccount(JSON.stringify({ token: 't', email: 'a@b.dk' }))).toEqual({ token: 't', email: 'a@b.dk' });
    expect(parseAccount(null)).toBeNull();
    expect(parseAccount('{')).toBeNull();
    expect(parseAccount(JSON.stringify({ email: 'a@b.dk' }))).toBeNull();
  });

  it('oversætter fejl til dansk', () => {
    expect(authErrorText('email_taken', 409)).toMatch(/findes allerede/);
    expect(authErrorText('invalid_credentials', 401)).toMatch(/Forkert/);
    expect(authErrorText(undefined, 503)).toMatch(/Serveren/);
  });

  it('logger ind og opretter konto mod API', async () => {
    const calls: string[] = [];
    const ok = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method} ${url} ${init?.body}`);
      return new Response(JSON.stringify({ token: 'tok', user: { id: '1', email: 'ida@example.com' } }), { status: 201 });
    }) as typeof fetch;
    const r = await authenticate('https://api', 'register', ' Ida@Example.com ', 'langtkodeord', ok);
    expect(r).toEqual({ ok: true, account: { token: 'tok', email: 'ida@example.com' } });
    expect(calls[0]).toBe('POST https://api/auth/register {"email":"Ida@Example.com","password":"langtkodeord"}');

    expect(await authenticate('https://api', 'login', 'a@b.dk', 'x', json(401, { error: 'invalid_credentials' }))).toEqual({
      ok: false,
      message: 'Forkert e-mail eller adgangskode.',
    });
  });

  it('giver en venlig besked uden net', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const r = await authenticate('https://api', 'login', 'a@b.dk', 'x', offline);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Ingen forbindelse/);
  });
});
