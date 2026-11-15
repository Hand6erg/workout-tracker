import { expect, test, type Page } from '@playwright/test';

const API = 'http://api.loeft.test';

async function openProfile(page: Page, withApi: boolean) {
  await page.goto('/');
  await page.evaluate(
    ([api, on]) => {
      localStorage.clear();
      if (on) localStorage.setItem('loeft-api-url', api as string);
    },
    [API, withApi],
  );
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
}

test('uden API forklarer Profil at online-gemning ikke er sat op', async ({ page }) => {
  await openProfile(page, false);
  await expect(page.getByRole('region', { name: 'Konto' })).toContainText('ikke sat op endnu');
});

test('opret konto, bliv logget ind og log ud igen', async ({ page }) => {
  const users = new Map<string, string>();
  await page.route(`${API}/auth/*`, async (route) => {
    const { email, password } = route.request().postDataJSON();
    const path = new URL(route.request().url()).pathname;
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
    if (path === '/auth/register') {
      if (users.has(email)) return reply(409, { error: 'email_taken' });
      users.set(email, password);
      return reply(201, { token: 'tok-1', user: { id: 'u1', email } });
    }
    if (users.get(email) !== password) return reply(401, { error: 'invalid_credentials' });
    return reply(200, { token: 'tok-2', user: { id: 'u1', email } });
  });

  await openProfile(page, true);
  const konto = page.getByRole('region', { name: 'Konto' });

  // Forkert login giver en dansk fejl
  await konto.getByLabel('E-mail').fill('ida@example.com');
  await konto.getByLabel(/^Adgangskode/).fill('forkertkode');
  await konto.getByRole('form', { name: 'Log ind' }).getByRole('button', { name: 'Log ind' }).click();
  await expect(konto.getByRole('alert')).toHaveText('Forkert e-mail eller adgangskode.');

  // Opret konto
  await konto.getByRole('button', { name: 'Ny konto' }).click();
  await konto.getByLabel(/^Adgangskode/).fill('langtkodeord');
  await konto.getByRole('button', { name: 'Opret konto' }).click();
  await expect(konto.getByTestId('account-email')).toHaveText('ida@example.com');

  // Login huskes efter genindlæsning
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(konto.getByTestId('account-email')).toHaveText('ida@example.com');
  await expect(page.getByTestId('total-workouts')).toHaveText('0');

  // Log ud (kræver to tryk) – lokale data bliver
  await konto.getByRole('button', { name: 'Log ud' }).click();
  await konto.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(konto.getByLabel('E-mail')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('loeft-account-v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('loeft-state-v1'))).not.toBeNull();

  // Log ind igen med den nye konto
  await konto.getByLabel('E-mail').fill('ida@example.com');
  await konto.getByLabel(/^Adgangskode/).fill('langtkodeord');
  await konto.getByRole('form', { name: 'Log ind' }).getByRole('button', { name: 'Log ind' }).click();
  await expect(konto.getByTestId('account-email')).toHaveText('ida@example.com');
});
