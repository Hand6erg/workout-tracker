import { expect, test, type Page } from '@playwright/test';

async function logBench(page: Page, kg: string, reps: string) {
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
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function openBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  return page.getByRole('dialog', { name: 'Bænkpres' });
}

test('styrkegraf på øvelsessiden med måling og periode (#214)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await logBench(page, '80', '5');
  let detail = await openBench(page);
  const chart = detail.getByRole('region', { name: 'Styrkegraf' });
  await expect(chart).toContainText('Log øvelsen mindst to gange for at se en graf');
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  await logBench(page, '100', '3');
  detail = await openBench(page);
  const graph = detail.getByRole('img', { name: /^Est\. 1RM: 110 kg senest, 2 træninger/ });
  await expect(graph).toBeVisible();
  await graph.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/strength-chart.png' });

  await chart.getByRole('button', { name: 'Volumen' }).click();
  await expect(detail.getByRole('img', { name: /^Volumen: 300 kg senest/ })).toBeVisible();
  await chart.getByRole('button', { name: 'Tungeste sæt' }).click();
  await expect(detail.getByRole('img', { name: /^Tungeste sæt: 100 kg senest/ })).toBeVisible();
  await chart.getByRole('button', { name: '3 mdr.' }).click();
  await expect(chart.getByRole('button', { name: '3 mdr.' })).toHaveAttribute('aria-pressed', 'true');
  await expect(detail.getByRole('img', { name: /^Tungeste sæt: 100 kg senest/ })).toBeVisible();

  // Ingen vandret scroll på telefonbredde
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
