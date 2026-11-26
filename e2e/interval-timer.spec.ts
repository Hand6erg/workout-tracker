import { expect, test, type Page } from '@playwright/test';

/** Optager bip, så testen kan se, at timeren tæller 3-2-1 ned. */
async function stubBeeps(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __beeps: string[] }).__beeps = log;
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => true });
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

const beeps = (page: Page) => page.evaluate(() => (window as unknown as { __beeps: string[] }).__beeps.length);

test.beforeEach(async ({ page }) => {
  await stubBeeps(page);
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('Tabata i træningen: stor nedtælling med runde og fase, bip og Stop (#330)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '⏱ Intervaltimer' }).click();

  const sheet = page.getByRole('dialog', { name: 'Intervaltimer' });
  await sheet.getByRole('group', { name: 'Type' }).getByRole('button', { name: 'Tabata' }).click();
  await expect(sheet.getByLabel('Arbejde (sek.)')).toHaveValue('20');
  await expect(sheet.getByLabel('Pause (sek.)')).toHaveValue('10');
  await expect(sheet.getByLabel('Runder')).toHaveValue('8');
  await expect(sheet.getByText('I alt 3:50')).toBeVisible();
  await sheet.getByRole('button', { name: 'Start' }).click();

  const countdown = sheet.getByRole('status', { name: 'Nedtælling' });
  await expect(countdown).toContainText('Runde 1/8');
  await expect(countdown).toContainText('Arbejde');

  await page.clock.runFor(25_000);
  await expect(countdown).toContainText('Runde 1/8');
  await expect(countdown).toContainText('Pause');
  await expect(sheet.getByTestId('interval-left')).toHaveText('0:05');
  // 3-2-1 + skift til pause
  expect(await beeps(page)).toBe(4);

  await page.clock.runFor(10_000);
  await expect(countdown).toContainText('Runde 2/8');
  await expect(countdown).toContainText('Arbejde');

  await sheet.getByRole('button', { name: 'Stop' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /Vis intervaltimer/ })).toBeHidden();

  // De sidst brugte indstillinger huskes
  await workout.getByRole('button', { name: '⏱ Intervaltimer' }).click();
  await expect(sheet.getByRole('button', { name: 'Tabata' })).toHaveAttribute('aria-pressed', 'true');
});

test('timeren tæller rigtigt efter skærmen har været slukket og kan skjules og åbnes igen (#330)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  await page.getByRole('button', { name: '⏱ Intervaltimer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Intervaltimer' });
  await sheet.getByRole('button', { name: 'EMOM' }).click();
  await sheet.getByLabel('Minutter').fill('5');
  await sheet.getByRole('button', { name: 'Start' }).click();
  await sheet.getByRole('button', { name: 'Skjul' }).click();
  await expect(sheet).toBeHidden();

  // Hop 2 min 10 s frem på én gang (som når telefonen har været låst)
  await page.clock.fastForward(130_000);
  const bar = page.getByRole('button', { name: /Vis intervaltimer/ });
  await expect(bar).toContainText('Runde 3/5 · Arbejde · 0:50');
  await bar.click();
  await expect(sheet.getByRole('status', { name: 'Nedtælling' })).toContainText('Runde 3/5');

  // Genindlæsning: timeren kører videre
  await page.reload();
  await expect(page.getByRole('button', { name: /Vis intervaltimer/ })).toContainText('Runde 3/5');
  await page.clock.fastForward(200_000);
  await expect(page.getByRole('button', { name: /Vis intervaltimer/ })).toContainText('Intervaltimer færdig');
});

test('EMOM gemmes på træningen og vises på opsummeringen og i Historik (#331)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '⏱ Intervaltimer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Intervaltimer' });
  await sheet.getByRole('button', { name: 'EMOM' }).click();
  await sheet.getByLabel('Minutter').fill('3');
  await sheet.getByRole('button', { name: 'Start' }).click();
  await page.clock.runFor(181_000);
  await expect(sheet.getByText('Færdig! 💪')).toBeVisible();
  await sheet.getByRole('button', { name: 'Gem i træningen' }).click();
  await expect(sheet).toBeHidden();

  const list = workout.getByRole('list', { name: 'Finishers' });
  await expect(list).toContainText('EMOM 3 min');

  // AMRAP stoppet efter 2 min spørger om runder
  await workout.getByRole('button', { name: '⏱ Intervaltimer' }).click();
  await sheet.getByRole('button', { name: 'AMRAP' }).click();
  await sheet.getByRole('button', { name: 'Start' }).click();
  await page.clock.runFor(125_000);
  await sheet.getByRole('button', { name: 'Stop' }).click();
  await sheet.getByLabel('Antal runder').fill('4');
  await sheet.getByRole('button', { name: 'Gem i træningen' }).click();
  await expect(list).toContainText('AMRAP 2 min · 4 runder');

  // Fjern kræver bekræftelse
  await list.getByRole('button', { name: 'Fjern' }).last().click();
  await list.getByRole('button', { name: 'Fjern?' }).click();
  await expect(list).not.toContainText('AMRAP');

  // Træningen kan afsluttes med kun en finisher
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary.getByRole('region', { name: 'Finisher' })).toContainText('EMOM 3 min');
  await summary.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('button', { name: 'Historik' }).click();
  await expect(page.getByRole('button', { name: 'Træning Push' })).toContainText(/EMOM \d+ min/);
  await page.getByRole('button', { name: 'Træning Push' }).click();
  await expect(page.getByRole('dialog', { name: 'Push' }).getByRole('list', { name: 'Finishers' })).toContainText('EMOM 3 min');
});
