# knowledge.md — WOE Party Organizer

Deeper reference. Use this when `CLAUDE.md` isn't enough — it expands on
state shape, sync flow, and the trickier corners of the single-file app.

## File anatomy (`index.html`, ~8,230 lines)

| Range | Contents |
|---|---|
| 1–9 | `<head>`, meta, title |
| 10–~2200 | `<style>` block — all CSS, organized by `/* ===== Section ===== */` |
| ~2205–2210 | Firebase compat SDK script tags |
| ~2211–2305 | `<body>` markup — header, sidebar, main grid, dialogs, toast |
| ~2306–8290 | `<script>` — constants, state, helpers, renderers, sync, init |

> Line numbers below are approximate and **drift on every edit** — always
> `grep -n` for the symbol before trusting an offset. Key anchors at the time
> of writing: `let state` ~2687, `AUCTION_DEFAULT_RATES` ~4564,
> `AUCTION_ITEMS_PER_PAGE` ~4576, `isAdmin()` ~4742, `getAuctionRates` ~6265,
> `computeAuction` ~6275, `setAuctionRate` ~6470, `buildAuctionView` ~6544,
> `buildAuctionCol` (chain) ~6645, `arGetDateRange` ~6900,
> `buildAuctionRequestHtml` ~7129, `arRequestBlockReason` ~7165,
> `render()` ~8108, `normalizeAuctionState` ~8228, boot block ~8207.

Use this lookup before grep:

| Section | Line |
|---|---|
| Header CSS | 35 |
| Mode toggle CSS | 90 |
| Leave page CSS | 148 |
| Roster page CSS | 309 |
| Auction view CSS | 495 |
| Auction columns CSS | 757 |
| Summary CSS | 915 |
| GL Summary Dashboard CSS | 1002 |
| Overrun layout CSS | 1216 |
| Sidebar CSS | 1258 |
| Maps / battlefield centers CSS | 1366–1717 |
| Responsive breakpoints | 1852–2206 |
| Constants | 2311–2345 |
| `state` initial shape | 2354 |
| BKK time helpers | 2382–2415 |
| Mode/sidebar UI | 2430–2521 |
| `save()` / `load()` | 2544–2569 |
| Sheet import (legacy compat) | 2702–2900 |
| Member CRUD | 2916–2933 |
| Drag-drop primitives | 2987–3010 |
| Marker render (League) | 3076–3213 |
| Marker render (Overrun) | 3214–3340 |
| Roster page | 3658–~4150 |
| `isAdmin()`, polling | 4182–4306 |
| Firebase init + listeners | 4404–4700 |
| Google sign-in | 4745–4761 |
| `render()` dispatch | 6149 |
| Save/Apply/Reset team snapshot | 6160–6245 |
| Init bootstrap | 6248–6320 |

(Line numbers drift on edits — re-grep before relying on them.)

## State shape (single global `state` object)

```js
{
  sheetUrl: string,                  // legacy DEFAULT_SHEET, kept for back-compat
  members: [{ id, name, job, cp, discord }],
  mode: "league"|"overrun"|"summary"|"auction-gl"|"auction-overrun"
        |"roster"|"leave",
  parties: Party[],                  // mirrors partiesLeague or partiesOverrun
  partiesLeague: Party[16],          // each = { id, name, slots: [memberId|null × 5] }
  partiesOverrun: Party[16],         // 4 main × 4 sub layout reuses 16-slot shape
  markers: { [partyId]: { mapNum, x, y } },
  mapBg: { 1: url, 2: url, 3: url }, // resolved via tryAutoLoadMapImages
  overrunMarkers: { ... },
  jobTargets: { [jobName]: number },
  auctionGL: AuctionState,
  auctionOverrun: AuctionState,
  leaves: { [memberId]: { "YYYY-MM-DD": true, ... } },
  system: { lastDailyReset: "YYYY-MM-DD", lastWeeklyReset: "YYYY-MM-DD" }
}
```

Where `AuctionState` is:

```js
{
  cards: number, illusion: number, white: number, black: number,  // base drop
  bonusPercent: number,                                           // GL bonus %
  rates: { card: number, illusion: number, white: number, black: number },
  // ^ admin-editable per-person allocation (จำนวนของที่ได้รับต่อคน), min 1.
  //   Note the SINGULAR "card" key (matches ITEM_META.rateKey), while the
  //   base/assignment keys are PLURAL "cards". getAuctionRates(kind) reads
  //   these with a fallback to AUCTION_DEFAULT_RATES.
  assignments: {
    main: { cards: memberId[], illusion: [], white: [], black: [] },
    sub:  { cards: memberId[], illusion: [], white: [], black: [] }
  }
}
```

`normalizeAuctionState(obj, kind)` (`index.html` ~8228) migrates legacy flat
shapes (pre-main/sub split) into the current shape on load, and backfills /
validates `rates` (any missing or <1 value falls back to the mode default).
Pass `kind` (`"gl"` | `"overrun"`) so the right defaults are used.

## Sync model

```
┌──────────────┐  write (admin only)  ┌────────────────────┐
│  state.*     │ ───────────────────▶ │ Firebase Realtime  │
│  (in-memory) │                      │ DB  /parties/*     │
│              │ ◀─────────────────── │     /members       │
└──────┬───────┘  on("value", snap)   │     /auction_*     │
       │          _fbApplyingRemote    │     /markers/*     │
       │                                │     /leaves       │
   save()                               │     /job_targets  │
       ▼                                │     /system       │
┌──────────────┐                       └────────────────────┘
│ localStorage │
│ roo_party_v2 │  (cache + offline fallback)
└──────────────┘
```

- Admin user is source-of-truth; viewer state is **replaced** by remote
  snapshots, not merged.
- The `_fbApplyingRemote` flag guards listeners from triggering re-writes
  during a snapshot apply (debounced by `_fbPushTimer`).
- `SYNC_KEYS` (`index.html:4169`) is a legacy whitelist; new persistent
  fields should be added to both the listener + writer.

## Auth + admin gating

```
load() ──▶ initFirebase() ──▶ onAuthStateChanged
                                 │
                  no user ───────┼──▶ signInAnonymously() ──▶ viewer
                                 │
                  user present ──┴──▶ isAdmin()
                                          ├─ admin: writes enabled, no polling
                                          └─ viewer: writes denied, polling for
                                                     UI status updates
```

- `ADMIN_EMAILS` is a literal allowlist. Email lookup is `.toLowerCase()`d.
- `viewer-mode` class on `<body>` is set by `updateAdminUI()` and drives all
  CSS-level edit-UI suppression.
- Firebase Database rules also need to enforce this (DB rules > frontend
  gate). Frontend gate is for UX; rules are for security.

## Drag-drop quirks

- During drag, `setDragging(true)` blocks remote re-renders to avoid the
  "snap back" glitch when a snapshot lands mid-drag (commit `2949b58`).
- Slots that exist in `state.parties` but no longer match a member are
  rendered as **ghosts** (empty visual). Admin-side sanitize (`sanitizeSlots`)
  clears them automatically on next push. Bug history: commits `b49cc74`,
  `41728ac`, `de853be`, `7c24602`.
- `dragMemberStart` / `dragSlotStart` / `dragPartyNumStart` all use the
  `dataTransfer` API. Don't mix `setData` formats across them.

## Leave page semantics

- Every member has a row showing today + the next 6 dates.
- Toggling a cell writes `/leaves/{memberId}/{YYYY-MM-DD}: true`.
- The League/Overrun party render shows the leave visual **only** on
  `todayBkkISO()` — past entries are inert.
- Auto-clear (Mon 00:00 BKK): `lastWeeklyReset` checked on every render;
  if stale, `/leaves` is removed.

## Map images

- The three PNGs in `maps/` are loaded via `tryAutoLoadMapImages()` and
  also re-uploadable via Firebase Storage (admin only).
- `applyMapBg(n)` sets the CSS `background-image` for map slot `n`
  (`1`=main, `2`=sub, `3`=overrun).
- Don't break the static fallback — `maps/*.png` must always work without
  Firebase (used when Storage is empty).

## Things that look wrong but aren't

- `DEFAULT_SHEET` and `parseSheetUrl()` — kept for the optional "import
  from Sheet" flow used during initial roster bootstrap. The main data
  source is Firebase.
- `initSync()` is a **no-op stub**. The real sync is `initFirebase()`. Both
  are called from the boot block (`index.html:6319-6320`); keep it that way
  in case external callers reference `initSync`.
- `state.parties` duplicates either `partiesLeague` or `partiesOverrun`
  depending on `state.mode`. This is intentional (mode-mirrored view) — see
  `switchMode()` (`index.html:2449`).
- `setupTooltip()`, `showTooltipFor()`, `pinTooltipFor()` — disabled
  no-ops. Tooltip system was removed; the stubs stay so call sites
  compile.

## Auction (GL / Overrun) — rates, math, page chain

- **Per-person rates are admin-editable + synced.** `getAuctionRates(kind)`
  returns the live `{card,illusion,white,black}` (falling back to
  `AUCTION_DEFAULT_RATES`); `setAuctionRate(kind, rateKey, value)` is
  `isAdmin()`-gated, clamps to ≥1, mutates `state.auction*.rates`, and persists
  via `save()` → the existing `auction_gl` / `auction_overrun` Firebase push
  (no new listener needed — `rates` rides inside the same object).
- **`computeAuction(kind)`** computes per-item totals. GL applies the bonus
  (cards+illusion ×2 when %>0, feathers ×(1+%/100)) then splits each item
  **70/30** main/sub (`Math.floor(total*0.7)`); Overrun has no sub field
  (`hasSubField=false`). Shortage per side = `pool − count×rate`.
- **Auction-page CHAIN numbering** (`buildAuctionCol`, ~6645) — the subtle part:
  - **GL** = ONE continuous chain across all 8 buckets in fixed order
    (cards-main → cards-sub → illusion-main → … → black-sub). Each bucket's
    `chainOffset` = Σ(earlier buckets' `count × that bucket's rate`).
  - **Overrun** = chain resets to 0 **per column** (cards/illusion/white/black
    independent).
  - A person's allocation = `rate` items, split into per-page segments of
    `AUCTION_ITEMS_PER_PAGE` (=4): `page = ceil(cursor/4)`, slots local 1–4.
  - **Because the chain reads `getAuctionRates()`, editing a rate changes the
    page layout.** This interaction is the highest-value thing to test —
    `test/run.js` locks it down ("editing the rate CHANGES the chain").
- **Event-day request gate** (`arRequestBlockReason`, ~7165) — single source of
  truth used by both `arOpenRequestModal` and `arCreateRequest`. Allows a
  request only when: date == today (BKK), `isEventDay(today)` is truthy, the
  request `mode` matches that day's event (GL ↔ อังคาร/พฤหัส, Overrun ↔
  อาทิตย์), and the member isn't on leave. `arGetDateRange()` returns only
  `[today]` (no advance window).

## Testing (`test/`, dependency-free)

- **`node test/run.js`** — parse check + full behavior/simulation suite. Exit 1
  on any failure → use it as the pre-commit gate. `node test/parse-check.js`
  runs just the inline-script syntax check.
- **`test/harness.js`** loads the REAL inline `<script>` from `index.html` into
  a Node `vm` context with light DOM/Firebase/localStorage stubs. Function
  declarations leak onto the context global (callable directly); `let state` /
  `const`s are bridged out via a small `__T_*` shim injected right before the
  boot `load();` line. `setAdmin(bool)` / `setToday(iso)` override `isAdmin` /
  `todayBkkISO` for deterministic tests.
- Coverage today: event-day gate, editable rates (defaults/override/clamp/
  admin-guard), `normalizeAuctionState` migration, 70/30 + shortage math, and
  GL+Overrun page-chain numbering with custom rates.
- **When you change auction or request behavior, add/extend a test** in
  `test/run.js` in the same commit (CLAUDE.md rule). Harness stub gaps (e.g. a
  missing DOM method) are fixed in `harness.js`, not worked around in tests.

## Common pitfalls

- **Adding a new mode without updating `switchMode` + `render` + the
  load-time guard at line 6260** → state.parties points at the wrong array.
- **Forgetting `_fbApplyingRemote`** around a listener apply → infinite
  write loop.
- **Calling `_fbDB.ref(...).set(...)` without `isAdmin()` guard** → silent
  rejection in production (DB rules block it), confusing UX.
- **Using `new Date()` for date math** → off-by-one when player is outside
  Asia/Bangkok. Use `todayBkkISO()` / `bkkNow()`.
- **Editing CSS in the wrong section** — there are duplicate-looking
  selectors per mode (`.league .slot` vs `.overrun .slot`). Check the
  `/* ===== ... ===== */` header before editing.
