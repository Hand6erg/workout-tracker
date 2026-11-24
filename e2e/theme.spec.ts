import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const isLight = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return (r + g + b) / 3 > 180;
};

test('"Lys" tema giver lys baggrund og huskes efter genindlæsning (#293)', async ({ page }) => {
  expect(isLight(await bg(page))).toBe(false);
  await page.getByRole('button', { name: 'Profil' }).click();
  const theme = page.getByRole('group', { name: 'Tema' });
  await expect(theme.getByRole('button', { name: 'Mørk' })).toHaveAttribute('aria-pressed', 'true');
  await theme.getByRole('button', { name: 'Lys' }).click();
  expect(isLight(await bg(page))).toBe(true);
  await page.reload();
  expect(isLight(await bg(page))).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('group', { name: 'Tema' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/theme-light-profile.png' });
  await page.getByRole('button', { name: 'Træning' }).click();
  await page.screenshot({ path: 'test-results/theme-light-start.png' });
});

test('"Følg telefonen" følger telefonens lys/mørk-indstilling (#293)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Følg telefonen' }).click();
  expect(isLight(await bg(page))).toBe(true);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => isLight(await bg(page))).toBe(false);
});
