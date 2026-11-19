import { expect, test, type Page } from '@playwright/test';

async function pushWorkout(page: Page, weight: string) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

/** Log to træninger i oktober 2026 */
async function logOctober(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 18));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await pushWorkout(page, '80');
  await page.clock.setFixedTime(new Date(2026, 9, 15, 18));
  await pushWorkout(page, '100');
}

const history = (page: Page) => page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();

test('"Din oktober" vises øverst i Historik de første dage af november og kan lukkes (#169)', async ({ page }) => {
  await logOctober(page);
  await page.clock.setFixedTime(new Date(2026, 10, 3, 9));
  await page.reload();
  await history(page);
  const card = page.getByRole('region', { name: 'Din oktober' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('definition').first()).toHaveText('2');
  await expect(card).toContainText('Bryst');
  await expect(card).toContainText('Bænkpres');
  await expect(card).toContainText('2 dage');
  await page.screenshot({ path: 'test-results/monthly-recap-card.png' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);

  await card.getByRole('button', { name: 'Luk månedens opsummering' }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await history(page);
  await expect(page.getByRole('heading', { name: 'Historik' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Din oktober' })).toHaveCount(0);
});

test('kortet vises ikke den 10. i måneden (#169)', async ({ page }) => {
  await logOctober(page);
  await page.clock.setFixedTime(new Date(2026, 10, 10, 9));
  await page.reload();
  await history(page);
  await expect(page.getByRole('heading', { name: 'Historik' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Træning Push/ }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Din oktober' })).toHaveCount(0);
});

test('"Se månedens opsummering" åbner opsummeringen for måneden i kalenderen (#170)', async ({ page }) => {
  await logOctober(page);
  await page.clock.setFixedTime(new Date(2026, 10, 20, 9));
  await page.reload();
  await history(page);
  const calendar = page.getByRole('region', { name: /Kalender/ });
  await calendar.getByRole('button', { name: 'Forrige måned' }).click();
  await expect(calendar.getByRole('heading', { name: 'oktober 2026' })).toBeVisible();
  await calendar.getByRole('button', { name: 'Se månedens opsummering' }).click();
  const dialog = page.getByRole('dialog', { name: 'Opsummering Oktober 2026' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('definition').first()).toHaveText('2');
  await expect(dialog).toContainText('Bænkpres');
  await page.screenshot({ path: 'test-results/monthly-recap-dialog.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Luk' }).click();
  await expect(dialog).toHaveCount(0);
});

test('en måned uden træninger viser "Ingen træninger i denne måned" (#170)', async ({ page }) => {
  await logOctober(page);
  await page.clock.setFixedTime(new Date(2026, 10, 20, 9));
  await page.reload();
  await history(page);
  await page.getByRole('button', { name: 'Se månedens opsummering' }).click();
  const dialog = page.getByRole('dialog', { name: 'Opsummering November 2026' });
  await expect(dialog).toContainText('Ingen træninger i denne måned');
});
