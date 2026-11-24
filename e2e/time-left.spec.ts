import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const minutesLeft = async (text: string | null) => Number(/ca\. (\d+) min tilbage/.exec(text ?? '')![1]);

test('"ca. … min tilbage" falder når sæt krydses af og forsvinder når alt er udført (#281)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start Ben' }).click();
  const left = page.getByText(/min tilbage$/);
  await expect(left).toBeVisible();
  const before = await minutesLeft(await left.textContent());

  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: 'test-results/time-left.png' });

  const squat = page.getByRole('article', { name: 'Squat', exact: true });
  for (const n of [1, 2, 3]) {
    await squat.getByLabel(`Vægt sæt ${n}`).fill('60');
    await squat.getByLabel(`Reps sæt ${n}`).fill('8');
    await squat.getByRole('button', { name: `Udført sæt ${n}` }).click();
  }
  const after = await minutesLeft(await left.textContent());
  expect(after).toBeLessThan(before);

  // Kryds resten af
  for (const name of ['Rumænsk dødløft', 'Benpres', 'Leg curl', 'Lægløft']) {
    const ex = page.getByRole('article', { name, exact: true });
    for (const n of [1, 2, 3]) {
      await ex.getByLabel(`Vægt sæt ${n}`).fill('40');
      await ex.getByLabel(`Reps sæt ${n}`).fill('10');
      await ex.getByRole('button', { name: `Udført sæt ${n}` }).click();
    }
  }
  await expect(left).toHaveCount(0);
});

test('"Vis tid tilbage" i Profil skjuler tiden (#281)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const toggle = page.getByLabel('Vis tid tilbage i træningen');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole('navigation').getByRole('button', { name: /Træning/ }).click();
  await page.getByRole('button', { name: 'Start Ben' }).click();
  await expect(page.getByTestId('elapsed')).toBeVisible();
  await expect(page.getByText(/min tilbage$/)).toHaveCount(0);
});
