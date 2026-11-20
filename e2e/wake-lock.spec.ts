import { expect, test } from '@playwright/test';

test('"Hold skærmen tændt" i Profil kan slås fra og huskes (#154)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const awake = page.getByLabel('Hold skærmen tændt under træning');
  await expect(awake).toBeChecked();
  await awake.uncheck();
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel('Hold skærmen tændt under træning')).not.toBeChecked();
});

/** Falsk Wake Lock: `__held` er antal låse, browseren holder lige nu. */
async function fakeWakeLock(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __held: number; __requests: number };
    w.__held = 0;
    w.__requests = 0;
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          w.__held++;
          w.__requests++;
          const s = {
            released: false,
            release: async () => {
              if (!s.released) w.__held--;
              s.released = true;
            },
          };
          return s;
        },
      },
    });
  });
}
const held = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __held: number }).__held);

test('skærmen holdes tændt under træningen og slippes ved pause og afslut (#155)', async ({ page }) => {
  await fakeWakeLock(page);
  await page.goto('./');
  expect(await held(page)).toBe(0);
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect.poll(() => held(page)).toBe(1);

  await workout.getByRole('button', { name: '⏸ Pause' }).click();
  await expect.poll(() => held(page)).toBe(0);
  await workout.getByRole('button', { name: '▶ Fortsæt' }).click();
  await expect.poll(() => held(page)).toBe(1);

  // Appen skjules og vises igen: låsen bedes om igen
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => held(page)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => held(page)).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { __requests: number }).__requests)).toBe(3);

  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Intet udfyldt – kassér?' }).click();
  await expect(workout).toHaveCount(0);
  await expect.poll(() => held(page)).toBe(0);
});

test('slår man "Hold skærmen tændt" fra, slippes låsen (#155)', async ({ page }) => {
  await fakeWakeLock(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await expect.poll(() => held(page)).toBe(1);
  await page.getByRole('button', { name: 'Minimér' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByText('Understøttes ikke i denne browser')).toHaveCount(0);
  await page.getByLabel('Hold skærmen tændt under træning').uncheck();
  await expect.poll(() => held(page)).toBe(0);
});

test('uden Wake Lock virker træningen som før, og Profil siger det ikke understøttes (#155)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: undefined });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await expect(page.getByRole('region', { name: 'Aktiv træning' })).toBeVisible();
  await page.getByRole('button', { name: 'Minimér' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByText('Understøttes ikke i denne browser')).toBeVisible();
  expect(errors).toEqual([]);
});
