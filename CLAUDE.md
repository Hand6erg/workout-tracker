# Løft – regler for Claude

Ejeren beskriver kun hvad der skal laves. Claude bygger, tester og pusher selv. Ejeren læser ikke kode, så resultatet skal virke uden manuel hjælp.

## Projektet
- Træningslog-app (inspireret af Strong, men med eget navn og design – brug aldrig Strongs navn, logo eller grafik).
- Webapp/PWA: React 19 + TypeScript + Vite. Ingen backend; data gemmes i `localStorage` (nøgle `loeft-state-v1`).
- Brugerfladen er på **dansk**. Mobil først (test i telefonbredde).
- Hostes på GitHub Pages via `.github/workflows/ci.yml` (`base: './'` i `vite.config.ts`).
  - `main` = den rigtige app: https://hand6erg.github.io/workout-tracker/
  - `staging` = testversionen: https://hand6erg.github.io/workout-tracker/staging/ (gul ramme + "TESTVERSION", gemmer under `loeft-state-staging-v1`, så den aldrig rører de rigtige data).

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
5. Små commits med beskeder på dansk, fx `Tilføj pausetimer-indstilling`. Push til `staging` – aldrig direkte til `main`.
   `main` får kun ændringer via en PR fra `staging` → `main`, som ejeren godkender (eller beder Claude om at merge), når det er afprøvet på staging-siden.
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
- Commit-besked slutter med `Lukker #<nr>`, så issuet lukkes automatisk, når staging merges til `main`.
- Efter push til `staging`: skift `i gang` til `på staging`, og kommentér på issuet på dansk – hvad er lavet, og hvordan det prøves på https://hand6erg.github.io/workout-tracker/staging/ (CI udgiver et par minutter efter push).
- Sørg for at der er en åben PR `staging` → `main` med en kort dansk liste over, hvad der er nyt, og `Lukker #<nr>` for hver opgave.
- Opret selv nye issues med label `idé`, hvis du opdager fejl eller oplagte forbedringer undervejs – men byg dem ikke uden `klar`.

## Automatisk kørsel (hvert 5. time)
Ejeren har sat en planlagt opgave op, der hver gang gør tre ting:
1. **Byg 2 opgaver:** de 2 næste issues med `opgave` + `klar` fra tidligere kørsler (gør én idé færdig før den næste, byg i nummerrækkefølge). Bygges efter arbejdsgangen ovenfor og pushes til `staging`.
2. **Opdel 1 idé:** vælg den idé (label `idé`, endnu ikke `opdelt`), der giver mest fremdrift, og opret ALLE de opgaver, der skal til for at gøre den færdig – ét issue pr. opgave med `opgave` + `klar`, "Del af #<idé>", acceptkriterier, og lille nok til én kørsel. Sæt en tjekliste på idéen og label `opdelt`. Gælder alle idéer, også ejerens.
3. **2 nye idéer:** opret 2 nye issues med `idé` (ingen dubletter; skal kunne laves uden udgifter).
- Kræver en idé ejerens OK eller konto (fx #6–#8), er første opgave "skriv forslag" med label `spørgsmål`, og resten venter, til ejeren har svaret.
- Luk en idé, når alle dens opgaver er merget til `main`.
