import { expect, test, type Page } from '@playwright/test';

async function startBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return workout.getByRole('article', { name: 'Bænkpres' });
}

async function setUnit(page: Page, unit: 'kg' | 'lb') {
  const minimize = page.getByRole('button', { name: 'Minimér' });
  if (await minimize.isVisible()) await minimize.click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const group = page.getByRole('group', { name: 'Enhed' });
  await group.getByRole('button', { name: unit, exact: true }).click();
  await expect(group.getByRole('button', { name: unit, exact: true })).toHaveAttribute('aria-pressed', 'true');
}

async function resume(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: /^Fortsæt:/ }).click();
  return page.getByRole('region', { name: 'Aktiv træning' }).getByRole('article', { name: 'Bænkpres' });
}

test('Enhed lb i Profil: 225 lb gemmes i kg og vises som 102,1 kg, og "Forrige" er i lb (#345)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await setUnit(page, 'lb');
  await page.getByRole('group', { name: 'Enhed' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/pounds-profile.png' });
  let bench = await startBench(page);
  await expect(bench.getByRole('columnheader', { name: 'lb', exact: true })).toBeVisible();
  await bench.getByLabel('Vægt sæt 1').fill('225');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('225');
  await page.screenshot({ path: 'test-results/pounds-workout.png' });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('loeft-state-v1') ?? '{}').active.exercises[0].sets[0].weight);
  expect(Number(saved)).toBeCloseTo(102.06, 2);

  await setUnit(page, 'kg');
  bench = await resume(page);
  await expect(bench.getByRole('columnheader', { name: 'kg', exact: true })).toBeVisible();
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('102,1');

  await setUnit(page, 'lb');
  bench = await resume(page);
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('225');

  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  // Næste træning: "Forrige" og pladsholderen er i lb
  bench = await startBench(page);
  await expect(bench.locator('td.prev').first()).toHaveText('225×5');
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveAttribute('placeholder', '225');
  await page.screenshot({ path: 'test-results/pounds-previous.png' });
});

async function logBench(page: Page, weight: string, reps: string) {
  const bench = await startBench(page);
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill(reps);
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await expect(page.getByText('1125 lb').first()).toBeVisible();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function openBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  return page.getByRole('dialog', { name: 'Bænkpres' });
}

test('med lb vises Historik, volumen, rekorder og mål i lb – og mål skifter til kg (#346)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await setUnit(page, 'lb');
  await logBench(page, '225', '5');

  // Historik: sættet og volumen i lb
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: /^Træning / }).first();
  await expect(card).toContainText('225 lb × 5');
  await expect(card).toContainText('1125 lb');
  await page.screenshot({ path: 'test-results/pounds-history.png' });

  // Øvelsessiden: rekord i lb
  let detail = await openBench(page);
  const records = detail.getByRole('region', { name: 'Rekorder' });
  await expect(records).toContainText('225 lb × 5');

  // Mål på 315 lb
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();
  await goals.getByLabel('Mål-vægt (lb)').fill('315');
  await goals.getByLabel('Reps').fill('1');
  await goals.getByRole('button', { name: 'Gem mål' }).click();
  await expect(goals.getByRole('listitem', { name: 'Mål 315 lb × 1' })).toBeVisible();
  await page.screenshot({ path: 'test-results/pounds-exercise.png' });

  // Skift til kg: målet vises som 142,9 kg
  await page.keyboard.press('Escape');
  await setUnit(page, 'kg');
  detail = await openBench(page);
  await expect(detail.getByRole('region', { name: 'Mål' }).getByRole('listitem', { name: 'Mål 142,9 kg × 1' })).toBeVisible();
});
