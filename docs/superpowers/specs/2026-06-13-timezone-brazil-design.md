# Design — Switch timezone Asia/Bangkok (UTC+7) → Brazil / Brasília (UTC−3)

**Date:** 2026-06-13
**App:** WOE Party Organizer (`app.html` + `index.html`)
**Goal:** All "today" / event-day / reset / timestamp logic now uses **Horário de Brasília (UTC−3)** instead of Asia/Bangkok (UTC+7), since the guild is Brazilian. Same schedule (GL Tue/Thu · Overrun Sun · auction 21:00–22:00), just computed in Brazil-local time; the day rolls over at Brazil midnight.

## Decision (brainstorm)
- Timezone: **America/São Paulo / Brasília, UTC−3** (Brazil has no DST since 2019 → a fixed −3 offset is correct; mirrors the existing fixed +7 pattern). Display via `toLocaleString` uses IANA `America/Sao_Paulo` (DST-safe regardless).
- **Keep the helper NAMES** `bkkNow`/`todayBkkISO`/`bkkDow` — the test harness overrides `todayBkkISO` (`__T_setToday`) and ~20 call sites use them; renaming would churn + break the harness. Change only the implementation + comments (note the name is legacy).

## Changes (surgical)
1. `bkkNow()` (app.html ~4174): `Date.now() + 7*60*60*1000` → `Date.now() - 3*60*60*1000`. Update the comment (BKK +7h → Brasília −3h).
2. `fmtUpdatedAt` (~4228): `new Date(ms + 7*60*60*1000)` → `new Date(ms - 3*60*60*1000)`.
3. `toLocaleString("Asia/Bangkok", …)` at the request-timestamp (`arFormatTime` ~9252) and wheel-history (~10599) → `"America/Sao_Paulo"`.
4. `index.html` landing today-cell (~257): `Date.now() + 7*60*60*1000` → `Date.now() - 3*60*60*1000`.
5. Copy + comments — grep `BKK|Bangkok|Tailândia|Thailand|UTC\+7|Asia/Bangkok` across app.html + index.html and update every USER-VISIBLE one:
   - `help.rules_tz_val` (pt/en): → e.g. pt `"America/São Paulo (UTC−3) — toda a lógica de \"hoje\" usa horário de Brasília"`, en `"America/São Paulo (UTC−3) — all \"today\" logic uses Brasília time"`.
   - landing `sched_note` (index.html): `"...fuso da Tailândia."` → `"...horário de Brasília."` (en variant in LANDING_I18N too).
   - any other help copy mentioning BKK/Bangkok → Brazil.
   - code comments (the `/* BKK timezone helpers */` block, the arFormatTime/wheel comments) → Brasília.

NOT changed (logic is timezone-independent for a fixed date): `bkkDow`, `isEventDay`, `arGetDateRange`, the event-day weekday mapping (2/4=GL, 0=Overrun), the leave/daily/weekly reset logic. These operate on date STRINGS whose weekday is fixed; only "what date is it now" (bkkNow) shifts.

## Testing
- Existing event-day/reset/request tests use date strings + `__T_setToday` (timezone-independent) → unaffected, must stay green.
- Add a `[timezone]` sanity test: `bkkNow()` returns a Date whose epoch ≈ `Date.now() - 3h` (within a few seconds tolerance), confirming the −3 offset; and `todayBkkISO()` matches the date derived from `America/Sao_Paulo` via Intl.
- `node test/parse-check.js` → PARSE OK; `node test/run.js` → 0 failed. `/code-review`. Bump `APP_VERSION` (3 places) + CHANGELOG.

## Out of scope
- No change to the event schedule itself (days/times stay the same numbers, now Brazil-local). No IANA refactor of the core helpers (fixed −3 is correct given no Brazil DST). No helper renames.

## Success criteria
- The app's "today" / event-day / leave-reset / request-gate boundaries align with Brazil (Brasília) time; request + wheel timestamps display in Brazil time; no "Bangkok/Thailand/UTC+7" left in user-visible copy; tests green; version bumped.
