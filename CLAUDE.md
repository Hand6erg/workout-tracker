# Løft – regler for Claude

Ejeren beskriver kun hvad der skal laves. Claude bygger, tester og pusher selv. Ejeren læser ikke kode, så resultatet skal virke uden manuel hjælp.

## Projektet
- Træningslog-app (inspireret af Strong, men med eget navn og design – brug aldrig Strongs navn, logo eller grafik).
- Webapp/PWA: React 19 + TypeScript + Vite. Ingen backend; data gemmes i `localStorage` (nøgle `loeft-state-v1`).
- Brugerfladen er på **dansk**. Mobil først (test i telefonbredde).
- Hostes på GitHub Pages via `.github/workflows/ci.yml` (`base: './'` i `vite.config.ts`).

## Struktur
- `src/lib/types.ts` – datamodel. `src/lib/logic.ts` – al forretningslogik som rene funktioner + `reducer`.
- `src/lib/store.tsx` – React context, gemmer state automatisk.
- `src/views/*` – en fil pr. fane/skærm. `src/components/*` – genbrugelige UI-dele.
- `src/styles.css` – al styling, CSS-variabler øverst.
- Tests: `src/**/*.test.ts` (Vitest, logik) og `e2e/*.spec.ts` (Playwright, klikker gennem appen).

## Arbejdsgang (skal følges hver gang)
1. Ny logik lægges i `logic.ts` som en reducer-action og får en Vitest-test.
2. Ny brugerrettet funktion får (eller udvider) en Playwright-test i `e2e/`.
3. Kør `npm run check` (typecheck + unit + build + e2e). Alt skal være grønt før push.
   - Hvis Playwright ikke kan downloade Chromium i miljøet: `PW_CHROMIUM_PATH=$(which google-chrome || which chromium) npm run test:e2e`.
4. Tag et screenshot i mobilbredde af det, der er ændret, og kig på det, før du siger, du er færdig.
5. Små commits med beskeder på dansk, fx `Tilføj pausetimer-indstilling`. Push direkte til `main`, medmindre ejeren beder om en PR.
6. Ændres datamodellen, skal `loadState` stadig kunne læse gamle data (brugerens træninger må aldrig gå tabt).
7. Afslut med 2–3 linjer på dansk til ejeren om hvad der er nyt, og hvordan det prøves.

## Stil
- Ingen nye afhængigheder uden god grund. Ingen UI-biblioteker.
- Brug `ConfirmButton` i stedet for `window.confirm`.
- Tilgængelighed: knapper og felter skal have tydelige labels (testene finder elementer via roller/labels).

## Idéer til senere (backlog)
- Grafer over volumen pr. uge og pr. muskelgruppe
- Supersæt, opvarmningsberegner, pladeberegner
- Kropsmål (vægt, fedtprocent) med graf
- Rekorder (PR) med markering når en ny slås
- Synkronisering mellem enheder (kræver backend/login)
