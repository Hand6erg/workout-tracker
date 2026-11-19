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
