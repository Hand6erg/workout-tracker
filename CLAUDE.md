# Løft – rules for Claude

The owner only describes what to build. Claude builds, tests and pushes on its own. The owner does not read code, so everything must work without manual help.

## Language
- **Everything on GitHub is in English:** commit messages, branch names, PR titles/bodies, issue titles/bodies, comments, labels, code comments.
- **The app's UI is in Danish** (all user-facing text in `src/`).
- **Chat with the owner is in Danish** (including the final summary to the owner).

## The project
- Workout log app (inspired by Strong, but with its own name and design – never use Strong's name, logo or graphics).
- Web app/PWA: React 19 + TypeScript + Vite. Data is stored in `localStorage` (key `loeft-state-v1`); the app must always work offline.
- Backend (in progress, #7): `server/` – Node 22 + TypeScript API (Hono + pg) with PostgreSQL, run with `docker compose up` from the repo root.
- Mobile first (test at phone width).
- Hosted on GitHub Pages via `.github/workflows/ci.yml` (`base: './'` in `vite.config.ts`).
  - `main` = the real app: https://hand6erg.github.io/workout-tracker/
  - `staging` = the test version: https://hand6erg.github.io/workout-tracker/staging/ (yellow frame + "TESTVERSION", stores data under `loeft-state-staging-v1` so it never touches the real data).

## Structure
- `src/lib/types.ts` – data model. `src/lib/logic.ts` – all business logic as pure functions + `reducer`.
- `src/lib/store.tsx` – React context, saves state automatically.
- `src/views/*` – one file per tab/screen. `src/components/*` – reusable UI parts.
- `src/styles.css` – all styling, CSS variables at the top.
- Tests: `src/**/*.test.ts` (Vitest, logic) and `e2e/*.spec.ts` (Playwright, clicks through the app).

## Workflow (follow every time)
1. New logic goes in `logic.ts` as a reducer action and gets a Vitest test.
2. New user-facing features get (or extend) a Playwright test in `e2e/`.
3. Run `npm run check` (typecheck + unit + build + e2e). Everything must be green before pushing.
   - If Playwright can't download Chromium: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run check`.
   - Backend changes (`server/`): also run `cd server && npm run typecheck && npm test` with a test Postgres
     (`docker run -d --name loeft-testdb -e POSTGRES_USER=loeft -e POSTGRES_PASSWORD=loeft -e POSTGRES_DB=loeft_test -p 5433:5432 postgres:17-alpine`; start `dockerd` first if needed),
     and check `docker compose up` + `curl localhost:8787/health`. In Claude's cloud sandbox, Docker builds need the proxy + CA
     (see `/root/.ccr/README.md`) – use a local copy of the Dockerfile for that, never commit proxy settings.
4. Take a phone-width screenshot of what changed and look at it before saying you're done.
5. **One branch + one PR per task.** Branch `task/<nr>-<short-slug>` from the latest `staging`. Small commits with English messages, e.g. `Add rest timer setting`.
   Open a PR `task/...` → `staging` using the PR format below. When CI is green, Claude squash-merges it into `staging` itself (title `<task title> (#<task nr>)`) and deletes the branch.
   Never push directly to `staging` or `main`. `main` only changes through the PR `staging` → `main`, which the owner merges after trying it on the staging site.
6. If the data model changes, `loadState` must still read old data (the user's workouts must never be lost).
7. Finish with 2–3 lines in Danish to the owner about what's new and how to try it.

## Style
- No new dependencies without good reason. No UI libraries.
- Use `ConfirmButton` instead of `window.confirm`.
- Accessibility: buttons and fields need clear labels (tests find elements by role/label).

## Tickets (GitHub Issues)
Ideas and bugs live as issues in `Hand6erg/workout-tracker`. Use the GitHub MCP tools or REST (`gh api repos/Hand6erg/workout-tracker/...`) – GraphQL and `gh issue` don't work in Claude sessions.
- Labels: `idea` = just a thought. `ready` = build it. `in progress` = Claude is working on it. `question` = waiting for the owner. `bug` = defect. `task` = concrete task belonging to an idea. `split` = idea has been split into tasks. `on staging` = built, can be tried on staging.
- When you take an issue: remove `ready`, add `in progress`.
- Take `ready` issues in order: `bug` first, then lowest number.
- If the description is too unclear to build: ask a short question as a comment, set `question` (remove `in progress`), and move on.
- After the task PR is merged into `staging`: replace `in progress` with `on staging`, and comment one line on the issue linking the PR (CI publishes staging a few minutes after the merge).
- Make sure there is one open PR `staging` → `main` in the release format below, with a `Closes #<nr>` line for each task (only PRs into `main` close issues; English keywords only).
- After the owner has merged: check that the tasks are closed (close them otherwise), remove `on staging`, and close ideas whose tasks are all closed.
- Create new issues labelled `idea` yourself if you spot bugs or obvious improvements – but don't build them without `ready`.

## PR format (keep it short – the owner should understand it in 30 seconds)
Task PR (`task/...` → `staging`), title = task title:
```
**Task:** #<nr> <task title>
**Scope:** <one sentence: what this PR changes, and what it deliberately doesn't>

**Acceptance criteria**
- ✅ <criterion from the issue>
- ⚠️ <criterion only partly met – why> / ❌ <not met – why>

**Try it:** <one line: where to click on https://hand6erg.github.io/workout-tracker/staging/ after merge>
```
Release PR (`staging` → `main`), title `Release: <short summary>`:
```
**In this release**
- #<nr> <task title> – ✅ all criteria met (or ⚠️ <one-line caveat>)

**Try it:** https://hand6erg.github.io/workout-tracker/staging/ – <one line>

Closes #<nr>
```
No other sections, no implementation details unless something needs the owner's attention.

## Current priority
Build ideas in this order (overrides "lowest number first" between ideas; bugs still come first):
1. #7 Database (PostgreSQL + own API in Docker, see `server/`), then #6 Sync, then #8 Server.
2. Then the rest by lowest number.

## Scheduled run (every 5 hours)
The owner has set up a scheduled task that does three things each time:
1. **Build 2 tasks:** the next 2 issues labelled `task` + `ready` (finish one idea before the next, build in number order; `bug` + `ready` always first). Each built on its own branch + PR per the workflow above, merged into `staging` when green.
2. **Split 1 idea:** pick the idea (label `idea`, not yet `split`) that gives the most progress, and create ALL tasks needed to finish it – one issue per task labelled `task` + `ready`, with "Part of #<idea>", acceptance criteria, and small enough for one run. Add a checklist to the idea and the `split` label. Applies to all ideas, including the owner's.
3. **2 new ideas:** create 2 new issues labelled `idea` (no duplicates; must be possible without costs).
- If an idea needs the owner's approval or an account (e.g. #6–#8), the first task is "write a proposal", labelled `question`, and the rest wait until the owner has answered.
- Close an idea when all its tasks have been merged to `main`.
