import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function pushWorkout(page: Page) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
}

test('"Milepæle" i Profil viser låste og låste-op badges (#183)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const section = page.getByRole('region', { name: 'Milepæle' });
  await expect(section.getByTestId('milestones-count')).toHaveText('0 af 16 låst op');

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await pushWorkout(page);
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(section.getByTestId('milestones-count')).toHaveText('1 af 16 låst op');
  await expect(section.getByRole('listitem', { name: /^Første træning – låst op/ })).toBeVisible();
  const ten = section.getByRole('listitem', { name: '10 træninger – låst, 1 af 10 træninger' });
  await expect(ten).toContainText('1 / 10 træninger');

  await section.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: 'test-results/milestones.png' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(width).toBeLessThanOrEqual(0);
});

test('en ny milepæl fejres på opsummeringen og åbner Milepæle (#184)', async ({ page }) => {
  await pushWorkout(page);
  const badge = page.getByRole('button', { name: /^Ny milepæl: Første træning/ });
  await expect(badge).toBeVisible();
  await page.screenshot({ path: 'test-results/milestone-celebration.png' });
  await badge.click();
  await expect(page.getByRole('navigation').getByRole('button', { name: /Profil/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('region', { name: 'Milepæle' })).toBeInViewport();

  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await pushWorkout(page);
  await expect(page.getByRole('heading', { name: 'Godt gået! 💪' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Ny milepæl: Første træning/ })).toHaveCount(0);
});
