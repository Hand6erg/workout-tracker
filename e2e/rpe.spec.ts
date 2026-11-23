import { expect, test, type Page } from '@playwright/test';

async function startBench(page: Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return { workout, bench: workout.getByRole('article', { name: 'Bænkpres' }) };
}

async function finish(page: Page) {
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
}

async function setRpeSwitch(page: Page, on: boolean) {
  const minimize = page.getByRole('button', { name: 'Minimér' });
  if (await minimize.isVisible()) await minimize.click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const box = page.getByLabel(/Vis RPE-felt/);
  if (on) await box.check();
  else await box.uncheck();
}

test('"Vis RPE-felt" i Profil skjuler og viser RPE-kolonnen og huskes (#238)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await setRpeSwitch(page, false);
  let { bench } = await startBench(page);
  await expect(bench.getByRole('columnheader', { name: 'RPE' })).toHaveCount(0);
  await expect(bench.getByLabel('RPE sæt 1')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/rpe-off.png' });

  await setRpeSwitch(page, true);
  await page.reload();
  // Den igangværende træning åbnes igen efter genindlæsning
  bench = page.getByRole('region', { name: 'Aktiv træning' }).getByRole('article', { name: 'Bænkpres' });
  await expect(bench.getByRole('columnheader', { name: 'RPE' })).toBeVisible();
  await page.getByRole('button', { name: 'Minimér' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(page.getByLabel(/Vis RPE-felt/)).toBeChecked();
  await page.reload();

  // Ugyldig RPE: rød med "RPE 6–10" og gemmes ikke
  await bench.getByLabel('RPE sæt 1').fill('12');
  await bench.getByLabel('Reps sæt 1').click();
  await expect(bench.getByRole('alert')).toHaveText('RPE 6–10');
  await expect(bench.getByLabel('RPE sæt 1')).toHaveAttribute('aria-invalid', 'true');
  await page.screenshot({ path: 'test-results/rpe-on-invalid.png' });
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('loeft-state-v1') ?? '{}');
    return s.active?.exercises?.[0]?.sets?.[0]?.rpe;
  });
  expect(saved ?? '').toBe('');
  await bench.getByLabel('RPE sæt 1').fill('8,5');
  await bench.getByLabel('Reps sæt 1').click();
  await expect(bench.getByRole('alert')).toHaveCount(0);
});

test('RPE 8,5 vises på øvelsessiden, og RPE 10 giver "prøv det samme igen" med RPE i forslaget (#238)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  let { bench } = await startBench(page);
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByLabel('RPE sæt 1').fill('8,5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await finish(page);

  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
  await page.getByRole('button', { name: /^Bænkpres/ }).first().click();
  const detail = page.getByRole('dialog', { name: 'Bænkpres' });
  await expect(detail).toContainText('100 kg × 5 @ RPE 8,5');
  await detail.getByRole('button', { name: 'Luk', exact: true }).click();

  ({ bench } = await startBench(page));
  await bench.getByLabel('Vægt sæt 1').fill('100');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByLabel('RPE sæt 1').fill('10');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await finish(page);

  ({ bench } = await startBench(page));
  const hint = bench.getByRole('button', { name: /^Sidst:/ });
  await expect(hint).toContainText('Sidst: 1 × 5 @ 100 kg (RPE 10) → prøv det samme igen');
  await page.screenshot({ path: 'test-results/rpe-hint.png' });
});
