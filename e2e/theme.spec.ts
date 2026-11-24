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

async function logBench(page: Page, kg: string, reps: string, finish = true) {
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
  if (!finish) return workout;
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
  return workout;
}

const bgOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);

test('alle skærme er lyse i lyst tema, og statuslinjens farve følger med (#294)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const meta = page.locator('meta[name="theme-color"]');
  await expect(meta).toHaveAttribute('content', '#0f1115');
  await page.getByRole('button', { name: 'Profil' }).click();
  await page.getByRole('group', { name: 'Tema' }).getByRole('button', { name: 'Lys' }).click();
  await expect(meta).toHaveAttribute('content', '#f3f4f7');
  expect(isLight(await bgOf(page, '.tabbar'))).toBe(true);
  await page.screenshot({ path: 'test-results/theme-light-profil.png' });

  await logBench(page, '80', '5');
  await logBench(page, '100', '3');

  // Historik med kalender
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.getByRole('region', { name: /^Kalender/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/theme-light-historik.png' });

  // Øvelsessiden med graf
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.screenshot({ path: 'test-results/theme-light-oevelser.png' });
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Bænkpres' });
  const graph = detail.getByRole('img', { name: /^Est\. 1RM/ });
  await expect(graph).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/theme-light-graf.png' });
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  // Aktiv træning med et udført sæt og pausetimeren
  const workout = await logBench(page, '100', '4', false);
  await expect(workout.getByRole('button', { name: 'Udført sæt 1' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toBeVisible();
  expect(isLight(await bgOf(page, '.rest'))).toBe(true);
  await page.screenshot({ path: 'test-results/theme-light-traening.png' });
});
