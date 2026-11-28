import { expect, test, type Page } from '@playwright/test';

async function logExercise(page: Page, search: string, name: string, kg: string, reps: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill(search);
  await picker.getByRole('button', { name: new RegExp(`^${name}`) }).first().click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const card = workout.getByRole('article', { name });
  await card.getByLabel('Vægt sæt 1').fill(kg);
  await card.getByLabel('Reps sæt 1').fill(reps);
  await card.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('"Mest løftede øvelser" i Profil viser top 3 og åbner øvelsen (#274)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Tom log → ingen sektion
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByRole('region', { name: 'Mest løftede øvelser' })).toHaveCount(0);

  await logExercise(page, 'squat', 'Squat', '140', '10'); // 1400 kg
  await logExercise(page, 'bænk', 'Bænkpres', '100', '5'); // 500 kg

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const section = page.getByRole('region', { name: 'Mest løftede øvelser' });
  await expect(section).toBeVisible();
  const rows = section.getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Squat');
  await expect(rows.nth(0)).toContainText('1,4 tons');
  await expect(rows.nth(0)).toContainText('1 træning');
  await expect(rows.nth(1)).toContainText('Bænkpres');
  await expect(rows.nth(1)).toContainText('500 kg');
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/most-lifted.png' });

  await section.getByRole('button', { name: 'Åbn Squat' }).click();
  await expect(page.getByRole('dialog', { name: 'Squat' })).toBeVisible();
});
