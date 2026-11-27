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
