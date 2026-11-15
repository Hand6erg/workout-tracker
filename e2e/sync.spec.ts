import { expect, test, type Page } from '@playwright/test';

const API = 'http://api.loeft.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, PUT, POST' };

type Srv = { state: { history: { id: string }[]; exercises: { id: string }[] } | null; version: number | null; offline: boolean; puts: number };

/** Falsk API i browseren: konto + /state med versionsnummer, og et "offline"-flag. */
async function mockApi(page: Page, srv: Srv) {
  await page.route(`${API}/**`, async (route) => {
    if (srv.offline) return route.abort('internetdisconnected');
    const req = route.request();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (path.startsWith('/auth/')) return reply(200, { token: 'tok', user: { id: 'u1', email: 'ida@example.com' } });
    if (path === '/state' && req.method() === 'GET') {
      return srv.version === null ? reply(404, { error: 'not_found' }) : reply(200, { state: srv.state, version: srv.version });
    }
    if (path === '/state' && req.method() === 'PUT') {
      const { state, baseVersion } = req.postDataJSON();
      if (srv.version !== null && baseVersion !== srv.version) {
        return reply(409, { error: 'conflict', current: { state: srv.state, version: srv.version } });
      }
      srv.puts++;
      srv.state = state;
      srv.version = (srv.version ?? 0) + 1;
      return reply(200, { state, version: srv.version, updatedAt: new Date().toISOString() });
    }
    return reply(404, { error: 'not_found' });
  });
}

async function start(page: Page, seed?: unknown) {
  await page.goto('/');
  await page.evaluate(
    ([api, s]) => {
      localStorage.clear();
      localStorage.setItem('loeft-api-url', api as string);
      if (s) localStorage.setItem('loeft-state-v1', JSON.stringify(s));
    },
    [API, seed] as const,
  );
  await page.reload();
}

async function login(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const konto = page.getByRole('region', { name: 'Konto' });
  await konto.getByLabel('E-mail').fill('ida@example.com');
  await konto.getByLabel(/^Adgangskode/).fill('langtkodeord');
  await konto.getByRole('form', { name: 'Log ind' }).getByRole('button', { name: 'Log ind' }).click();
  return konto;
}

async function addCustomExercise(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: '+ Ny' }).click();
  const dlg = page.getByRole('dialog', { name: 'Ny øvelse' });
  await dlg.getByLabel('Navn').fill(name);
  await dlg.getByRole('button', { name: 'Gem øvelse' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
}

const workout = (id: string, startedAt: number) => ({ id, name: `Træning ${id}`, startedAt, finishedAt: startedAt + 60_000, exercises: [] });

test('første login uploader telefonens data, og ændringer gemmes online – også efter en tur uden net', async ({ page, context }) => {
  const srv: Srv = { state: null, version: null, offline: false, puts: 0 };
  await mockApi(page, srv);
  await start(page, { version: 1, exercises: [], templates: [], history: [workout('w1', Date.now())], active: null, rest: null, restSeconds: 90 });

  const konto = await login(page);
  const status = konto.getByRole('status', { name: 'Online-status' });
  await expect(status).toHaveText(/^Gemt online kl\. \d\d:\d\d$/);
  expect(srv.state?.history.map((w) => w.id)).toEqual(['w1']);

  // En ændring sendes automatisk
  await addCustomExercise(page, 'Hip thrust');
  await expect.poll(() => srv.state?.exercises.some((e) => e.id.length > 0 && JSON.stringify(e).includes('Hip thrust'))).toBe(true);

  // Uden net (serveren kan ikke nås): ændringen venter
  srv.offline = true;
  await addCustomExercise(page, 'Nordic curl');
  await expect(status).toHaveText(/Venter på net/);
  expect(JSON.stringify(srv.state)).not.toContain('Nordic curl');

  // Ændringen overlever en genindlæsning uden net
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByTestId('account-email')).toHaveText('ida@example.com');

  await expect(status).toHaveText(/Venter på net/);

  // Nettet er tilbage ('online'-hændelsen) → sendes
  await context.setOffline(true);
  srv.offline = false;
  await context.setOffline(false);
  await expect.poll(() => JSON.stringify(srv.state)).toContain('Nordic curl');
  await expect(status).toHaveText(/Gemt online/);
});

test('findes der allerede data online, kan man flette – intet forsvinder', async ({ page }) => {
  const srv: Srv = {
    state: { version: 1, exercises: [], templates: [], history: [workout('online', 2_000_000_000_000)], active: null, restSeconds: 90 } as never,
    version: 7,
    offline: false,
    puts: 0,
  };
  await mockApi(page, srv);
  await start(page, { version: 1, exercises: [], templates: [], history: [workout('phone', 1_900_000_000_000)], active: null, rest: null, restSeconds: 90 });

  const konto = await login(page);
  const choice = konto.getByRole('group', { name: 'Vælg hvilke data du vil beholde' });
  await expect(choice).toContainText('1 træninger');
  expect(srv.puts).toBe(0);

  await choice.getByRole('button', { name: 'Flet begge' }).click();
  await expect(choice).toBeHidden();
  await expect(page.getByTestId('total-workouts')).toHaveText('2');
  await expect.poll(() => srv.state?.history.map((w) => w.id)).toEqual(['online', 'phone']);
  expect(srv.version).toBe(8);
});

test('en tom app henter data fra kontoen ved login', async ({ page }) => {
  const srv: Srv = {
    state: { version: 1, exercises: [], templates: [], history: [workout('online', Date.now())], active: null, restSeconds: 90 } as never,
    version: 3,
    offline: false,
    puts: 0,
  };
  await mockApi(page, srv);
  await start(page);
  await login(page);
  await expect(page.getByTestId('total-workouts')).toHaveText('1');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByTestId('total-workouts')).toHaveText('1');
  expect(srv.puts).toBe(0);
});

test('når appen åbnes, hentes træninger gemt på en anden enhed (#37)', async ({ page }) => {
  const srv: Srv = {
    state: { version: 1, exercises: [], templates: [], history: [workout('other', Date.now()), workout('w1', Date.now() - 86_400_000)], active: null, restSeconds: 90 } as never,
    version: 5,
    offline: false,
    puts: 0,
  };
  await mockApi(page, srv);
  await page.goto('/');
  await page.evaluate((api) => {
    localStorage.clear();
    localStorage.setItem('loeft-api-url', api);
    localStorage.setItem('loeft-account-v1', JSON.stringify({ token: 'tok', email: 'ida@example.com' }));
    localStorage.setItem('loeft-sync-v1', JSON.stringify({ version: 4, dirty: false, savedAt: Date.now() - 60_000 }));
    localStorage.setItem(
      'loeft-state-v1',
      JSON.stringify({ version: 1, exercises: [], templates: [], history: [{ id: 'w1', name: 'Træning w1', startedAt: Date.now() - 86_400_000, finishedAt: Date.now() - 86_340_000, exercises: [] }], active: null, rest: null, restSeconds: 90 }),
    );
  }, API);
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByTestId('total-workouts')).toHaveText('2');
  await expect(page.getByRole('status', { name: 'Online-status' })).toHaveText(/^Gemt online kl\. \d\d:\d\d$/);
  expect(srv.puts).toBe(0);
});
