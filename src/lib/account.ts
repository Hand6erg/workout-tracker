import { STORAGE_KEY } from './logic';

/* ---------- Konto (login til den online database) ---------- */

export interface Account {
  token: string;
  email: string;
}

export type AuthMode = 'login' | 'register';

// Kontoen gemmes for sig selv (ikke i AppState), så login-nøglen aldrig kommer med i backup/eksport.
export const ACCOUNT_KEY = STORAGE_KEY.replace('state', 'account');
/** Kun til test/udvikling: API-adresse kan sættes i localStorage, hvis den ikke er bygget ind. */
export const API_URL_OVERRIDE_KEY = 'loeft-api-url';

/** API-adressen, eller null hvis online-gemning ikke er sat op. */
export function resolveApiUrl(built: string | undefined, override: string | null): string | null {
  const url = (built || override || '').trim();
  return url ? url.replace(/\/+$/, '') : null;
}

export function parseAccount(raw: string | null): Account | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw) as Partial<Account>;
    return typeof a.token === 'string' && a.token && typeof a.email === 'string' ? { token: a.token, email: a.email } : null;
  } catch {
    return null;
  }
}

export function authErrorText(code: string | undefined, status: number): string {
  switch (code) {
    case 'email_taken':
      return 'Der findes allerede en konto med den e-mail.';
    case 'password_too_short':
      return 'Adgangskoden skal være mindst 8 tegn.';
    case 'invalid_input':
      return 'Skriv en gyldig e-mail og adgangskode.';
    case 'invalid_credentials':
      return 'Forkert e-mail eller adgangskode.';
    case 'too_many_attempts':
      return 'For mange forsøg. Prøv igen om lidt.';
  }
  return status >= 500 ? 'Serveren svarer ikke lige nu. Prøv igen senere.' : 'Noget gik galt. Prøv igen.';
}

export type AuthResult = { ok: true; account: Account } | { ok: false; message: string };

export async function authenticate(
  apiUrl: string,
  mode: AuthMode,
  email: string,
  password: string,
  fetchFn: typeof fetch = fetch,
): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetchFn(`${apiUrl}/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    return { ok: false, message: 'Ingen forbindelse. Tjek dit net og prøv igen.' };
  }
  const body = (await res.json().catch(() => null)) as { token?: string; user?: { email?: string }; error?: string } | null;
  if (res.ok && body?.token) return { ok: true, account: { token: body.token, email: body.user?.email ?? email.trim() } };
  return { ok: false, message: authErrorText(body?.error, res.status) };
}
