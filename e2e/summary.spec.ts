import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function pushWorkout(page: Page, weight: string) {
  await page.getByRole('button', { name: 'Start Push' }).click();
  const bench = page.getByRole('article', { name: 'Bænkpres', exact: true });
  await bench.getByLabel('Vægt sæt 1').fill(weight);
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await page.getByRole('button', { name: 'Afslut' }).click();
  await page.getByRole('button', { name: 'Bekræft' }).click();
}

test('viser en opsummering efter "Afslut", og "Luk" går tilbage til Træning (#143)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start tom træning' }).click();
  const workout = page.getByRole('region', { name: 'Aktiv træning' });
  await workout.getByRole('button', { name: '+ Tilføj øvelser' }).click();
  const picker = page.getByRole('dialog', { name: 'Tilføj øvelser' });
  await picker.getByPlaceholder('Søg efter øvelse').fill('bænk');
  await picker.getByRole('button', { name: /^Bænkpres/ }).click();
  await picker.getByRole('button', { name: 'Tilføj (1)' }).click();
  const bench = workout.getByRole('article', { name: 'Bænkpres' });
  await bench.getByLabel('Vægt sæt 1').fill('80');
  await bench.getByLabel('Reps sæt 1').fill('5');
  await bench.getByRole('button', { name: 'Udført sæt 1' }).click();
  await bench.getByRole('button', { name: '+ Tilføj sæt' }).click();
  await bench.getByRole('button', { name: 'Udført sæt 2' }).click();
  await workout.getByRole('button', { name: 'Afslut' }).click();
  await workout.getByRole('button', { name: 'Bekræft' }).click();

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary.getByRole('heading', { name: 'Godt gået! 💪' })).toBeVisible();
  await expect(summary).toContainText('800 kg');
  await expect(summary).toContainText('2 sæt');
  await expect(summary.getByRole('status')).toHaveCount(0); // ingen tidligere træning at sammenligne med
  await page.screenshot({ path: 'test-results/summary.png' });

  await summary.getByRole('button', { name: 'Luk' }).click();
  await expect(summary).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Træning', level: 1 })).toBeVisible();
});

test('viser + % volumen og 🏆 når samme skabelon løftes tungere (#143)', async ({ page }) => {
  await pushWorkout(page, '80');
  await page.getByRole('button', { name: 'Luk', exact: true }).click();
  await pushWorkout(page, '100');

  const summary = page.getByRole('region', { name: 'Opsummering' });
  await expect(summary.getByRole('status')).toHaveText('+25 % volumen siden sidst');
  await expect(summary.getByRole('region', { name: 'Nye rekorder' })).toContainText('Bænkpres');
  await page.screenshot({ path: 'test-results/summary-records.png' });
});

test('opsummeringen er væk efter genindlæsning (#143)', async ({ page }) => {
  await pushWorkout(page, '80');
  await expect(page.getByRole('region', { name: 'Opsummering' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Opsummering' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Push' })).toBeVisible();
});

test('"Del" downloader opsummeringen som PNG, når telefonen ikke kan dele filer (#144)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  await page.reload();
  await pushWorkout(page, '80');
  const summary = page.getByRole('region', { name: 'Opsummering' });
  await page.screenshot({ path: 'test-results/summary-share.png' });

  const [download] = await Promise.all([page.waitForEvent('download'), summary.getByRole('button', { name: 'Del' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^loeft-\d{4}-\d{2}-\d{2}\.png$/);
  const data = Buffer.concat(await (await download.createReadStream()).toArray());
  expect(data.subarray(1, 4).toString('ascii')).toBe('PNG');
  await download.saveAs('test-results/share-card.png');
});

test('vurdér træningen på opsummeringen, og den gemmes på træningen (#382)', async ({ page }) => {
  await pushWorkout(page, '80');
  const summary = page.getByRole('region', { name: 'Opsummering' });
  const picker = summary.getByRole('region', { name: 'Hvordan føltes det?' });
  await picker.getByRole('button', { name: 'Føltes 4 af 5' }).click();
  await expect(picker.getByRole('button', { name: 'Føltes 4 af 5' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: 'Høj' }).click();
  await expect(picker.getByRole('button', { name: 'Høj' })).toHaveAttribute('aria-pressed', 'true');
  // Tryk igen rydder – og tryk igen sætter den tilbage
  await picker.getByRole('button', { name: 'Føltes 4 af 5' }).click();
  await expect(picker.getByRole('button', { name: 'Føltes 4 af 5' })).toHaveAttribute('aria-pressed', 'false');
  await picker.getByRole('button', { name: 'Føltes 4 af 5' }).click();
  await page.screenshot({ path: 'test-results/summary-feeling.png' });

  await summary.getByRole('button', { name: 'Luk' }).click();
  await page.reload();
  const saved = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('loeft-state-v1') ?? '{}');
    return { feeling: s.history?.[0]?.feeling, energy: s.history?.[0]?.energy };
  });
  expect(saved).toEqual({ feeling: 4, energy: 'high' });
});

test('man kan lukke opsummeringen uden at vurdere (#382)', async ({ page }) => {
  await pushWorkout(page, '80');
  await page.getByRole('region', { name: 'Opsummering' }).getByRole('button', { name: 'Luk' }).click();
  const w = await page.evaluate(() => JSON.parse(localStorage.getItem('loeft-state-v1') ?? '{}').history?.[0]);
  expect(w.feeling).toBeUndefined();
  expect(w.energy).toBeUndefined();
});

test('vurderingen vises i Historik og kan rettes under "Redigér" (#383)', async ({ page }) => {
  await pushWorkout(page, '80');
  const summary = page.getByRole('region', { name: 'Opsummering' });
  await summary.getByRole('button', { name: 'Føltes 4 af 5' }).click();
  await summary.getByRole('group', { name: 'Energi før' }).getByRole('button', { name: 'Høj' }).click();
  await summary.getByRole('button', { name: 'Luk' }).click();

  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  const card = page.getByRole('button', { name: 'Træning Push' });
  await expect(card.getByLabel('Føltes 4 af 5, energi høj')).toHaveText('💪 · Energi: høj');
  await page.screenshot({ path: 'test-results/history-feeling.png' });

  await card.click();
  const detail = page.getByRole('dialog', { name: 'Push' });
  await expect(detail.getByLabel('Føltes 4 af 5, energi høj')).toBeVisible();
  await detail.getByRole('button', { name: 'Redigér' }).click();
  const editor = page.getByRole('region', { name: 'Redigér træning' });
  const picker = editor.getByRole('region', { name: 'Hvordan føltes det?' });
  await expect(picker.getByRole('button', { name: 'Føltes 4 af 5' })).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: 'Føltes 5 af 5' }).click();
  await picker.getByRole('group', { name: 'Energi før' }).getByRole('button', { name: 'Høj' }).click(); // ryd energi
  await editor.getByRole('button', { name: 'Gem' }).click();

  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.getByRole('button', { name: 'Træning Push' }).getByLabel('Føltes 5 af 5')).toHaveText('🔥');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('loeft-state-v1') ?? '{}').history?.[0]);
  expect(saved.feeling).toBe(5);
  expect(saved.energy).toBeUndefined();
});

test('en træning uden vurdering viser ingen vurdering i Historik (#383)', async ({ page }) => {
  await pushWorkout(page, '80');
  await page.getByRole('region', { name: 'Opsummering' }).getByRole('button', { name: 'Luk' }).click();
  await page.getByRole('navigation').getByRole('button', { name: /Historik/ }).click();
  await expect(page.locator('.feeling-line')).toHaveCount(0);
});

test('"Sådan føltes det" i Profil: tom tekst uden vurderinger, graf og tip med vurderinger (#384)', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  const card = page.getByRole('region', { name: 'Sådan føltes det' });
  await expect(card).toContainText('Bedøm dine træninger på opsummeringen for at se, hvordan de føles over tid.');
  await expect(card.getByRole('img', { name: 'Gennemsnitlig vurdering pr. uge' })).toHaveCount(0);

  // 10 vurderede træninger over de sidste uger: morgen føles 5, aften føles 2
  await page.evaluate(() => {
    const DAY = 86_400_000;
    const history = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(Date.now() - (i * 2 + 1) * DAY);
      d.setHours(i % 2 ? 8 : 19, 0, 0, 0);
      const t = d.getTime();
      return { id: `w${i}`, name: 'Træning', startedAt: t, finishedAt: t + 3_600_000, exercises: [], feeling: i % 2 ? 5 : 2 };
    });
    const s = JSON.parse(localStorage.getItem('loeft-state-v1')!);
    localStorage.setItem('loeft-state-v1', JSON.stringify({ ...s, history }));
  });
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: /Profil/ }).click();
  await expect(card.getByRole('img', { name: 'Gennemsnitlig vurdering pr. uge' })).toBeVisible();
  await expect(card).toContainText('Snit de sidste 4 uger');
  await expect(card).toContainText('Dine bedste træninger er om morgenen');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/profile-feeling.png' });
});
