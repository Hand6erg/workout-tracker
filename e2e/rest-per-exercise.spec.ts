import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startWithBench(page: Page) {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  return workout.getByRole('article', { name: 'Bænkpres', exact: true });
}

test('pausetid pr. øvelse fra øvelseskortet (#120)', async ({ page }) => {
  // Standard i Profil ændres til 1:00, så forslaget ikke bruges
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await page.getByLabel(/Pausetimer efter hvert sæt/).fill('60');
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();

  const bench = await startWithBench(page);
  await bench.getByRole('button', { name: 'Pause for Bænkpres: 1:00' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pause: Bænkpres' });
  await dialog.getByRole('button', { name: '3:00' }).click();
  await expect(dialog.getByLabel('Pausetid')).toHaveText('3:00');
  await dialog.getByRole('button', { name: '15 sekunder længere' }).click();
  await dialog.getByRole('button', { name: '15 sekunder kortere' }).click();
  await expect(dialog.getByText('Egen tid for øvelsen')).toBeVisible();
  await dialog.getByRole('button', { name: 'Færdig' }).click();
  await expect(bench.getByRole('button', { name: 'Pause for Bænkpres: 3:00' })).toBeVisible();

  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toContainText(/3:0[01]/);

  // "Brug standard" går tilbage til den fælles tid
  await bench.getByRole('button', { name: 'Pause for Bænkpres: 3:00' }).click();
  await dialog.getByRole('button', { name: 'Brug standard (1:00)' }).click();
  await expect(dialog.getByText('Standard fra Profil')).toBeVisible();
  await dialog.getByRole('button', { name: 'Færdig' }).click();
  await page.getByRole('button', { name: 'Spring over' }).click();
  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await expect(page.getByRole('status', { name: 'Pausetimer' })).toContainText(/1:0[01]/);
});

test('pausetiden huskes til næste træning (#120)', async ({ page }) => {
  const bench = await startWithBench(page);
  await expect(bench.getByRole('button', { name: 'Pause for Bænkpres: 3:00' })).toBeVisible(); // forslag
  await bench.getByRole('button', { name: /Pause for Bænkpres/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Pause: Bænkpres' });
  await expect(dialog.getByText('Forslag til denne type øvelse')).toBeVisible();
  await dialog.getByRole('button', { name: '2:00' }).click();
  await dialog.getByRole('button', { name: 'Færdig' }).click();
  await page.getByRole('button', { name: 'Annullér træning' }).click();
  await page.getByRole('button', { name: 'Tryk igen for at bekræfte' }).click();
  await expect(page.getByRole('region', { name: 'Aktiv træning' })).toHaveCount(0);

  await page.reload();
  const again = await startWithBench(page);
  await expect(again.getByRole('button', { name: 'Pause for Bænkpres: 2:00' })).toBeVisible();
});
