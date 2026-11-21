import { expect, test } from '@playwright/test';

test('kropsvægt i Profil kan udfyldes og huskes efter genindlæsning (#206)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const field = page.getByLabel('Kropsvægt (kg)', { exact: true });
  await expect(field).toHaveValue('');
  await expect(page.getByText('Bruges til kropsvægtsøvelser, når du ikke har et kropsmål.')).toBeVisible();
  await field.fill('81,5');

  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel('Kropsvægt (kg)', { exact: true })).toHaveValue('81,5');
  const saved = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('loeft-state'))!;
    return JSON.parse(localStorage.getItem(key)!).bodyWeight;
  });
  expect(saved).toBe(81.5);

  // Tømt felt = ikke angivet
  await page.getByLabel('Kropsvægt (kg)', { exact: true }).fill('');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel('Kropsvægt (kg)', { exact: true })).toHaveValue('');
});

test('med kropsvægt 80 i Profil tæller 10 pull-ups som 800 kg i opsummering og Historik (#207)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel('Kropsvægt (kg)', { exact: true }).fill('80');
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();

  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('pull-up');
  await picker.getByRole('button', { name: /^Pull-up/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const pullup = workout.getByRole('article', { name: 'Pull-up' });
  await pullup.getByLabel('Reps sæt 1').fill('10');
  await pullup.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary).toContainText('800 kg');
  await summary.getByRole('button', { name: 'Luk' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.getByText('🏋️ 800 kg')).toBeVisible();
});
