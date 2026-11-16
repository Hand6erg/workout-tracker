import { expect, test, type Page } from '@playwright/test';

/** Erstatter vibration og lyd med optagere, så testen kan se, hvad appen prøver at gøre. */
async function stubAlerts(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __alerts: string[] }).__alerts = log;
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (p: number | number[]) => {
        log.push(Array.isArray(p) ? 'vibrate:done' : 'vibrate:warning');
        return true;
      },
    });
    const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} };
    class FakeAudio {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return { type: '', frequency: param, connect() {}, start: () => log.push('beep'), stop() {} };
      }
      createGain() {
        return { gain: param, connect() {} };
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudio;
  });
}

const alerts = (page: Page) => page.evaluate(() => (window as unknown as { __alerts: string[] }).__alerts);

async function startRest(page: Page, seconds: number) {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel(/Pausetimer efter hvert sæt/).fill(String(seconds));
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('region', { name: 'Aktiv træning' }).getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubAlerts(page);
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('vibrerer 10 s før og vibrerer + bipper når pausen er slut (#85)', async ({ page }) => {
  await startRest(page, 30);
  await page.clock.runFor(5_000);
  expect(await alerts(page)).toEqual([]);

  await page.clock.runFor(16_000); // 9 s tilbage
  expect(await alerts(page)).toEqual(['vibrate:warning']);

  await page.clock.runFor(10_000); // pausen er slut
  await expect(page.getByText('Pausen er slut 💪')).toBeVisible();
  expect(await alerts(page)).toEqual(['vibrate:warning', 'vibrate:done', 'beep']);

  await page.clock.runFor(10_000); // ingen gentagelser
  expect(await alerts(page)).toEqual(['vibrate:warning', 'vibrate:done', 'beep']);
});

test('intet signal efter "Spring over" (#85)', async ({ page }) => {
  await startRest(page, 30);
  await page.getByRole('button', { name: 'Spring over' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toHaveCount(0);
  await page.clock.runFor(40_000);
  expect(await alerts(page)).toEqual([]);
});

async function openProfile(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
}

test('Test-knappen og lyd fra i Profil: kun vibration, og valget huskes (#86)', async ({ page }) => {
  await openProfile(page);
  const sound = page.getByLabel('Lyd når pausen er slut');
  await expect(sound).toBeChecked();
  await expect(page.getByLabel('Vibration når pausen er slut')).toBeChecked();

  await page.getByRole('button', { name: 'Test pausesignal' }).click();
  expect(await alerts(page)).toEqual(['vibrate:done', 'beep']);

  await sound.uncheck();
  await startRest(page, 15);
  await page.clock.runFor(16_000);
  await expect(page.getByText('Pausen er slut 💪')).toBeVisible();
  expect(await alerts(page)).toEqual(['vibrate:done', 'beep', 'vibrate:warning', 'vibrate:done']);

  await page.reload();
  await page.getByRole('button', { name: 'Minimér' }).click();
  await openProfile(page);
  await expect(page.getByLabel('Lyd når pausen er slut')).not.toBeChecked();
});

test('vibration fra i Profil: kun bip, og valget huskes (#86)', async ({ page }) => {
  await openProfile(page);
  await page.getByLabel('Vibration når pausen er slut').uncheck();
  await page.reload();
  await openProfile(page);
  await expect(page.getByLabel('Vibration når pausen er slut')).not.toBeChecked();
  await expect(page.getByLabel('Lyd når pausen er slut')).toBeChecked();

  await startRest(page, 15);
  await page.clock.runFor(16_000);
  await expect(page.getByText('Pausen er slut 💪')).toBeVisible();
  expect(await alerts(page)).toEqual(['beep']);
});
