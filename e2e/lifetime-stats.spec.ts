import { expect, test, type Page } from '@playwright/test';

async function logBench(page: Page, kg: string, reps: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill(kg);
  await bench.getByLabel('Reps sæt 1').fill(reps);
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function openExercise(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  return page.getByRole('dialog', { name });
}

test('"Gennem tiden" på øvelsessiden viser træninger, reps, samlet vægt og "Sidst lavet" (#273)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await logBench(page, '100', '5');
  await logBench(page, '80', '8');

  const detail = await openExercise(page, 'Bænkpres');
  const card = detail.getByRole('region', { name: 'Gennem tiden' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Første gang');
  await expect(card.getByRole('definition').nth(0)).toHaveText('2'); // træninger
  await expect(card.getByRole('definition').nth(1)).toHaveText('2'); // sæt
  await expect(card.getByRole('definition').nth(2)).toHaveText('13'); // reps
  await expect(card.getByRole('definition').nth(3)).toHaveText('1,1 tons'); // 500 + 640 kg
  await expect(card).toContainText('Sidst lavet: i dag');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/lifetime-card.png' });
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  // En øvelse, der aldrig er lavet, har intet kort
  const squat = await openExercise(page, 'Squat');
  await expect(squat.getByText('Du har ikke lavet denne øvelse endnu.')).toBeVisible();
  await expect(squat.getByRole('region', { name: 'Gennem tiden' })).toHaveCount(0);
});
