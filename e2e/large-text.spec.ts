import { expect, test, type Page } from '@playwright/test';

const nav = (page: Page, name: RegExp) => page.getByRole('navigation').getByRole('button', { name }).click();

async function openProfile(page: Page) {
  const minimize = page.getByRole('button', { name: 'Minimér' });
  if (await minimize.isVisible()) await minimize.click();
  await nav(page, /Profil/);
}

test('"Stor tekst" gør ✓-knappen større, huskes og giver ingen vandret scroll (#295)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await nav(page, /Træning/);
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const tick = () => workout.getByRole('article', { name: 'Bænkpres' }).getByRole('button', { name: /^Udført/ }).first();
  const before = (await tick().boundingBox())!.height;

  await openProfile(page);
  await expect(page.getByLabel(/Stor tekst/)).not.toBeChecked();
  await page.getByLabel(/Stor tekst/).check();
  await page.reload();
  await openProfile(page);
  await expect(page.getByLabel(/Stor tekst/)).toBeChecked();

  await nav(page, /Træning/);
  await page.getByRole('button', { name: /^Fortsæt/ }).click();
  await expect(tick()).toBeVisible();
  const after = (await tick().boundingBox())!.height;
  expect(after).toBeGreaterThan(before * 1.2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Knapperne i øvelsens top ("Fjern" m.fl.) bliver inden for kortet
  const card = (await workout.getByRole('article', { name: 'Bænkpres' }).boundingBox())!;
  const remove = (await workout.getByRole('button', { name: 'Fjern', exact: true }).boundingBox())!;
  expect(remove.x + remove.width).toBeLessThanOrEqual(card.x + card.width);
  await page.screenshot({ path: 'test-results/large-text-workout.png' });

  // Også i lyst tema
  await openProfile(page);
  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Lys' }).click();
  await nav(page, /Træning/);
  await page.getByRole('button', { name: /^Fortsæt/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/large-text-workout-light.png' });
});
