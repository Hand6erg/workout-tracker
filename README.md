# Løft 🏋️

En enkel træningslog til telefonen. Log sæt, reps og vægt, få pausetimer mellem sættene, og følg dine fremskridt.

## Funktioner
- **Træning:** start tom eller fra skabelon (Push, Pull, Ben følger med)
- **Sæt-logning:** kg, reps og RPE. "Forrige" viser hvad du løftede sidst, og tomme felter udfyldes automatisk, når du markerer et sæt
- **Pausetimer** starter automatisk efter hvert sæt (±15 sek., kan slås fra)
- **Historik** med varighed, samlet volumen og bedste sæt. Kan gemmes som skabelon
- **Øvelser:** 24 standardøvelser, egne øvelser, estimeret 1RM og graf
- **Profil:** statistik, CSV-eksport, backup og gendannelse
- Kan installeres på telefonen og virker offline

## Kom i gang (for udviklere)
```bash
npm install
npm run dev        # lokal udvikling
npm run check      # typecheck + tests + build + browsertests
```

Alt data gemmes lokalt i browseren på enheden.
