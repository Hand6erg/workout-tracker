import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startWithBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænkpres');
  await picker.getByRole('button', { name: /^Bænkpres/ }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return { workout, card: workout.getByRole('article', { name: 'Bænkpres' }) };
}

/** Én bænkpres-træning med 100 kg × 5 – ingen fremgang */
async function logFlatBench(page: Page) {
  const { workout, card } = await startWithBench(page);
  await card.getByLabel('Vægt sæt 1').fill('100');
  await card.getByLabel('Reps sæt 1').fill('5');
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('4 bænkpres-træninger uden fremgang → "står stille" på startskærmen; "Skjul" huskes (#361)', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Står stille' });
  for (let i = 0; i < 3; i++) await logFlatBench(page);
  await expect(card).toHaveCount(0); // kun 3 træninger
  await logFlatBench(page);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Bænkpres står stille (4 træninger) – prøv en let uge med 90 kg');

  await page.setViewportSize({ width: 360, height: 800 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/deload-start.png' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);

  await card.getByRole('button', { name: 'Skjul Bænkpres' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start tom træning' })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('"Let uge" i træningen fylder bænkpres-sættene med den lette vægt (#361)', async ({ page }) => {
  for (let i = 0; i < 4; i++) await logFlatBench(page);
  const { card } = await startWithBench(page);
  await card.getByRole('button', { name: '+ Tilføj sæt' }).click();
  const hint = card.getByRole('group', { name: 'Står stille: Bænkpres' });
  await expect(hint).toContainText('Står stille i 4 træninger – prøv en let uge med 90 kg');

  await page.setViewportSize({ width: 360, height: 800 });
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/deload-workout.png' });

  await hint.getByRole('button', { name: /^Let uge/ }).click();
  for (const n of [1, 2]) {
    await expect(card.getByLabel(`Vægt sæt ${n}`)).toHaveValue('90');
    await expect(card.getByLabel(`Reps sæt ${n}`)).toHaveValue('5');
  }
});
