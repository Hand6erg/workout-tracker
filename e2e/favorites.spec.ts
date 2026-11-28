import { expect, test } from '@playwright/test';

async function openExercises(page: import('@playwright/test').Page) {
  await page.getByRole('navigation').getByRole('button', { name: /Øvelser/ }).click();
}

test('stjernemarker Squat på øvelsessiden – ★ i listen, "Favoritter" viser kun Squat, og det huskes (#191)', async ({ page }) => {
  await page.goto('./');
  await openExercises(page);
  await page.getByRole('button', { name: /^Squat/ }).click();
  const detail = page.getByRole('dialog', { name: 'Squat' });
  const star = detail.getByRole('button', { name: 'Favorit' });
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await expect(detail.getByRole('button', { name: 'Fjern favorit' })).toHaveAttribute('aria-pressed', 'true');
  await detail.getByRole('button', { name: 'Luk' }).click();

  await expect(page.getByRole('button', { name: 'Fjern favorit Squat' })).toHaveText('★');
  await page.getByRole('group', { name: 'Filtrer øvelser' }).getByRole('button', { name: 'Favoritter' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(1);
  await expect(page.locator('.fav-row')).toContainText('Squat');

  await page.reload();
  await openExercises(page);
  await expect(page.getByRole('button', { name: 'Fjern favorit Squat' })).toHaveAttribute('aria-pressed', 'true');
});

test('fjern stjernen fra listen – øvelsen forsvinder fra "Favoritter" (#191)', async ({ page }) => {
  await page.goto('./');
  await openExercises(page);
  await page.getByRole('button', { name: 'Favorit Squat', exact: true }).click();
  await page.getByRole('button', { name: 'Favorit Bænkpres', exact: true }).click();
  await page.getByRole('group', { name: 'Filtrer øvelser' }).getByRole('button', { name: 'Favoritter' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(2);

  await page.getByRole('button', { name: 'Fjern favorit Squat' }).click();
  await expect(page.locator('.fav-row')).toHaveCount(1);
  await expect(page.locator('.fav-row')).toContainText('Bænkpres');
  await page.getByRole('button', { name: 'Fjern favorit Bænkpres' }).click();
  await expect(page.getByText('Ingen favoritter endnu')).toBeVisible();
});

test('øvelsesvælgeren viser "Favoritter" og "Senest brugt" øverst og skjuler dem under søgning (#192)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Stjernemarkér Squat
  await openExercises(page);
  await page.getByRole('button', { name: 'Favorit Squat', exact: true }).click();

  // Afslut en træning med Bænkpres
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  let picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('60');
  await bench.getByLabel('Reps sæt 1').fill('8');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();
  await page.getByRole('button', { name: 'Luk', exact: true }).click();

  // Ny træning: grupperne står øverst
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  const favs = picker.getByRole('region', { name: 'Favoritter' });
  const recent = picker.getByRole('region', { name: 'Senest brugt' });
  await expect(favs.getByRole('button')).toHaveCount(1);
  await expect(favs.getByRole('button', { name: /^Squat/ })).toBeVisible();
  await expect(recent.getByRole('button')).toHaveCount(1);
  await expect(recent.getByRole('button', { name: /^Bænkpres/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/picker-groups.png' });

  // Søgning skjuler grupperne
  await picker.getByPlaceholder('Søg efter øvelse').fill('squat');
  await expect(favs).toHaveCount(0);
  await expect(recent).toHaveCount(0);
  await picker.getByPlaceholder('Søg efter øvelse').fill('');

  // Valg fra en gruppe tilføjer øvelsen
  await favs.getByRole('button', { name: /^Squat/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  await expect(workout.getByRole('article', { name: 'Squat' })).toBeVisible();
});
