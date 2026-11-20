import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

/** Logger en træning med Bænkpres 80×8 og 85×6 (2 arbejdssæt) */
async function logBench(page: Page, sets: [string, string][]) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  for (let i = 0; i < sets.length; i++) {
    if (i > 0) await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
    await bench.getByLabel(`Vægt sæt ${i + 1}`).fill(sets[i][0]);
    await bench.getByLabel(`Reps sæt ${i + 1}`).fill(sets[i][1]);
    await bench.getByRole('button', { name: `Udført sæt ${i + 1}` }).click();
  }
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

test('"Gentag" i Historik starter samme træning med den dags tal som "Forrige" (#150)', async ({ page }) => {
  await logBench(page, [['80', '8'], ['85', '6']]);
  await logBench(page, [['100', '2']]); // nyere træning med andre tal

  await page.getByRole('button', { name: 'Historik' }).click();
  // den ældste træning (80×8, 85×6) står nederst
  await page.getByRole('button', { name: /^Træning / }).last().click();
  const detail = page.getByRole('dialog');
  await expect(detail).toContainText('80 kg × 8');
  await expect(detail.getByRole('button', { name: 'Gentag' })).toBeVisible();
  await page.waitForTimeout(400); // vent til dialogen er gledet på plads
  await page.screenshot({ path: 'test-results/repeat-detail.png' });
  await detail.getByRole('button', { name: 'Gentag' }).click();

  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout).toBeVisible();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await expect(bench.getByLabel('Vægt sæt 1')).toHaveValue('');
  await expect(bench.getByLabel('Vægt sæt 2')).toBeVisible();
  await expect(bench.getByLabel('Vægt sæt 3')).toHaveCount(0);
  await expect(bench).toContainText('80×8');
  await expect(bench).toContainText('85×6');
  await expect(bench).not.toContainText('100×2');
  await expect(bench.getByLabel('Vægt sæt 2')).toHaveAttribute('placeholder', '85');
  await page.screenshot({ path: 'test-results/repeat-workout.png' });
});

test('med en træning i gang spørger "Gentag" før den erstattes (#150)', async ({ page }) => {
  await logBench(page, [['80', '8']]);
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await page.getByRole('button', { name: 'Minimér' }).click();

  await page.getByRole('button', { name: 'Historik' }).click();
  await page.getByRole('button', { name: /^Træning / }).first().click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('button', { name: 'Gentag' }).click();
  await expect(detail.getByRole('button', { name: 'Erstat igangværende træning?' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Aktiv træning' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Erstat igangværende træning?' }).click();

  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await expect(workout.getByRole('article', { name: 'Bænkpres' })).toContainText('80×8');
});
