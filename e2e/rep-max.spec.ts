import { expect, test, type Page } from '@playwright/test';

async function logSquat(page: Page, kg: string, reps: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('squat');
  await picker.getByRole('button', { name: /^Squat/ }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const card = workout.getByRole('article', { name: 'Squat' });
  await card.getByLabel('Vægt sæt 1').fill(kg);
  await card.getByLabel('Reps sæt 1').fill(reps);
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
}

async function openExercise(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  return page.getByRole('dialog', { name });
}

test('rep-maks-tabel på øvelsessiden: 100 kg × 5 fylder 1-, 3- og 5RM (#355)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await logSquat(page, '100', '5');
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
  const detail = await openExercise(page, 'Squat');
  const table = detail.getByRole('region', { name: 'Rep-maks' });
  await expect(table).toBeVisible();
  for (const r of [1, 3, 5]) await expect(table.getByRole('listitem', { name: `${r} reps: 100 kg` })).toBeVisible();
  for (const r of [8, 10, 12]) await expect(table.getByRole('listitem', { name: `${r} reps: intet endnu` })).toContainText('–');
  await expect(table.getByRole('listitem', { name: '5 reps: 100 kg' })).toContainText('est. 100 kg');

  const overflow = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"] .repmax') as HTMLElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/rep-max.png' });
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  // Tidsøvelser har ingen rep-maks
  const plank = await openExercise(page, 'Planke');
  await expect(plank).toBeVisible();
  await expect(plank.getByRole('region', { name: 'Rep-maks' })).toHaveCount(0);
});
