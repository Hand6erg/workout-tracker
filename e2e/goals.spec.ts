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

test('sæt et mål "100 kg × 1" på Bænkpres – fremskridt og e1RM vises, og målet kan slettes (#199)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await logBench(page, '80', '1');

  const detail = await openBench(page);
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();

  // Tom vægt kan ikke gemmes
  const save = goals.getByRole('button', { name: 'Gem mål' });
  await expect(save).toBeDisabled();
  await goals.getByLabel('Mål-vægt (kg)').fill('100');
  await goals.getByLabel('Reps').fill('1');
  await expect(goals.getByLabel('Måldato (valgfri)')).toBeVisible();
  await expect(save).toBeEnabled();
  await save.click();

  const row = goals.getByRole('listitem', { name: 'Mål 100 kg × 1' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('progressbar', { name: 'Fremskridt mod 100 kg × 1' })).toHaveAttribute('aria-valuenow', '80');
  await expect(row).toContainText('Nu: 80 kg e1RM');
  await page.screenshot({ path: 'test-results/goals-section.png' });

  // Målet huskes
  await page.reload();
  const again = await openBench(page);
  const row2 = again.getByRole('listitem', { name: 'Mål 100 kg × 1' });
  await expect(row2).toBeVisible();

  // Slet (to tryk)
  await row2.getByRole('button', { name: 'Slet mål' }).click();
  await row2.getByRole('button', { name: 'Tryk igen for at slette' }).click();
  await expect(again.getByRole('listitem', { name: 'Mål 100 kg × 1' })).toHaveCount(0);
});

test('et nået mål vises under "Nået" med dato, og tidsøvelser har ingen mål (#199)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let detail = await openBench(page);
  const goals = detail.getByRole('region', { name: 'Mål' });
  await goals.getByRole('button', { name: '+ Sæt mål' }).click();
  await goals.getByLabel('Mål-vægt (kg)').fill('60');
  await goals.getByRole('button', { name: 'Gem mål' }).click();
  await detail.getByRole('button', { name: 'Luk' }).click();

  await logBench(page, '60', '3');
  detail = await openBench(page);
  await expect(detail.getByRole('heading', { name: 'Nået' })).toBeVisible();
  await expect(detail.getByRole('listitem', { name: 'Mål 60 kg × 1' })).toContainText('✓ Nået');
  await detail.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('button', { name: /^Planke/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Planke' }).getByRole('region', { name: 'Mål' })).toHaveCount(0);
});
