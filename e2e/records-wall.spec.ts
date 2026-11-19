import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function pushWorkout(page: Page, weight: string) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('"Rekorder" i Profil viser dine bedste løft og kan filtreres (#163)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const wall = page.getByRole('region', { name: 'Rekorder' });
  await expect(wall).toContainText('Log en træning for at se dine rekorder');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await pushWorkout(page, '80');
  await pushWorkout(page, '100');

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const bench = wall.getByRole('listitem', { name: 'Bænkpres' });
  await expect(bench).toContainText('Tungeste: 100 kg');
  await expect(bench).toContainText('Bedste sæt: 100 kg × 5');
  await bench.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: 'test-results/records-wall.png' });

  const chips = wall.getByRole('group', { name: 'Filtrér rekorder efter muskelgruppe' });
  await chips.getByRole('button', { name: 'Ben' }).click();
  await expect(bench).toHaveCount(0);
  await chips.getByRole('button', { name: 'Bryst' }).click();
  await expect(bench).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);
});

test('"N nye rekorder denne måned" og tryk åbner øvelsen (#164)', async ({ page }) => {
  await pushWorkout(page, '80');
  await pushWorkout(page, '100');
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const wall = page.getByRole('region', { name: 'Rekorder' });
  const line = wall.getByTestId('records-this-month');
  // Én 🏆 pr. træning: 80 kg (første gang) og 100 kg (ny rekord)
  await expect(line).toHaveText('🏆 2 nye rekorder denne måned');
  await line.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/records-month.png' });

  await wall.getByRole('button', { name: 'Åbn Bænkpres' }).click();
  const dialog = page.getByRole('dialog', { name: 'Bænkpres' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('best-1rm')).toBeVisible();
});
