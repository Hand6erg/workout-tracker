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

## Tickets (GitHub Issues)
Idéer og fejl ligger som issues i `Hand6erg/workout-tracker`. Brug REST (`gh api repos/Hand6erg/workout-tracker/issues...`) – GraphQL og `gh issue` virker ikke i Claude-sessioner.
- Labels: `idé` = kun en tanke, rør den ikke. `klar` = byg den. `i gang` = du arbejder på den. `spørgsmål` = venter på svar fra ejeren. `bug` = fejl.
- Når du tager et issue: fjern `klar`, sæt `i gang`.
- Tag issues med `klar` i rækkefølge: `bug` først, derefter laveste nummer.
- Er beskrivelsen for uklar til at bygge: skriv et kort spørgsmål på dansk som kommentar, sæt `spørgsmål` (fjern `i gang`), og gå videre til næste.
- Commit-besked slutter med `Lukker #<nr>`, så issuet lukkes automatisk ved push til `main`.
- Efter push: kommentér på issuet på dansk – hvad er lavet, og hvordan det prøves på https://hand6erg.github.io/workout-tracker/ (CI deployer et par minutter efter push).
- Opret selv nye issues med label `idé`, hvis du opdager fejl eller oplagte forbedringer undervejs – men byg dem ikke uden `klar`.
