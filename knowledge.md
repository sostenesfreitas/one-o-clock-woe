# knowledge.md — WOE Party Organizer

Deeper reference. Use this when `CLAUDE.md` isn't enough — it expands on
state shape, sync flow, and the trickier corners of the single-file app.

## File anatomy (`app.html`, ~8,230 lines)

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
        |"roster"|"leave"|"auction-request"|"users"|"wheel",
  parties: Party[],                  // mirrors partiesLeague or partiesOverrun
  partiesLeague: Party[16],          // each = { id, name, slots: [memberId|null × 5] }
  partiesOverrun: Party[16],         // 4 main × 4 sub layout reuses 16-slot shape
  markers: { [partyId]: { mapNum, x, y } },
  mapBg: { 1: url, 2: url, 3: url }, // resolved via tryAutoLoadMapImages
  overrunMarkers: { ... },
  rangeCircles: [ {x,y,r} × 3 ],     // GL Main map zones (center/left/right), % units;
                                     // synced via `range_circles` node, admin-drag/resize,
                                     // GL main only. clampRangeCircle/initRangeCircles keep
                                     // 3 clamped circles; _rangeCirclesOn toggles the view.
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
  cards: number, illusion: number, white: number, black: number,
  // ^ FINAL item counts, entered by admin as-is. (The old GL ×-bonus
  //   system + its bonusPercent field were removed 2026-06; normalize
  //   strips bonusPercent from legacy saves.)
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

`normalizeAuctionState(obj, kind)` (`app.html` ~8228) migrates legacy flat
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
- `SYNC_KEYS` (`app.html:4169`) is a legacy whitelist; new persistent
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

## Wheel page (🎡 สุ่มรางวัล, admin-only)

- Mode `"wheel"`; tab is `seg-admin`-gated like Users; `buildWheelHtml()`
  shows a 🔒 lock for non-admins. DB rules are the real boundary.
- **ทุกคนใน roster อยู่ในวงล้อทุกรอบ** (no auto-remove of winners — by
  design). Per-session exclusions live in `wheelUI.excluded` (local, never
  synced); "ตัดคนลาวันนี้" reads `/leaves` via `hasScheduledLeaveToday()`
  only (the manual `onLeave*` flags don't survive the members mirror).
- Winner is picked by `wheelRandIndex()` (crypto + rejection sampling)
  BEFORE the animation. `wheelUI.spinList` freezes the slice list for the
  whole spin so a `/members` snapshot can't desync pointer vs winner.
- The ONLY mid-spin render guard is in `renderBattlefields`'s wheel branch
  (`if (!wheelUI.spinning)`) — every render path funnels through it; do NOT
  add per-listener spinning checks.
- History: `/wheel_history` push keys `{at, by, winnerId, winnerName,
  prize}` (admin-write, shape-locked, `$other:false`); mirrored to
  `state.wheelHistory`; client-trimmed to `WHEEL_HISTORY_MAX` (200) ordered
  by `at` (not key order). Failed saves restore `wheelUI.pendingResult` so
  the admin can retry instead of re-spinning.
- Label layout (truncation/font/palette) is cached in `_wheelLayout` —
  `measureText` runs once per roster/width change, not per rAF frame.
- Strings interpolated into inline `onclick` JS (member ids, history keys)
  must pass `WHEEL_SAFE_KEY_RE` — `escapeHtml` alone can't protect JS-in-
  attribute context (entities decode back before JS parses).
- Tests: `[wheel]` section in `test/run.js`. **Never call `wheelSpin()` /
  `wheelConfetti()` in the vm harness** — its rAF stub re-enters
  synchronously.

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
  are called from the boot block (`app.html:6319-6320`); keep it that way
  in case external callers reference `initSync`.
- `state.parties` duplicates either `partiesLeague` or `partiesOverrun`
  depending on `state.mode`. This is intentional (mode-mirrored view) — see
  `switchMode()` (`app.html:2449`).
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
- **`computeAuction(kind)`** computes per-item totals. Totals = the entered
  counts 1:1 (the GL ×-bonus multiplier was removed 2026-06 — admins type
  post-bonus quantities directly). GL then splits each item by an
  **admin-editable main %** (`state.auctionGL.splitMainPercent`, default 70):
  `mainPool = Math.ceil(total * mainPct/100)` so the leftover on an uneven split goes
  to **สนามหลัก**; `subPool = total − mainPool`. Read it via `getAuctionSplitPercent(kind)`
  (GL only; returns 100 for Overrun → no sub), set via `setAuctionSplitPercent` (admin-gated,
  clamps 0..100, mirrors `setAuctionRate`). Overrun has no sub field (`hasSubField=false`).
  Shortage per side = `pool − count×rate`. NOTE: page-map per-type ranges depend on each
  item's *total*, not the split, so they don't move when the split changes.
- **Supply-based page-map** (`computeAuction` → `data.pageMap` + `it.{main,sub}.page`)
  — the REAL in-game auction pages, from the ITEM POOL (counts), `AUCTION_ITEMS_PER_PAGE`
  (=4) per page. NOT from assigned people, NOT from `rate`.
  - Each `it.main.page`/`it.sub.page` = `{items, startCursor, endCursor, startPage,
    endPage, startSlot, pageOffset}`, walked from a cumulative POOL cursor.
  - **GL** = ONE continuous run over 8 buckets (cards-main → cards-sub → … →
    black-sub); sub continues main's partial page (the 70/30 boundary). `pageMap`
    = `{perType, totalItems, totalPages}`; invariant `max(endPage) === totalPages`.
  - **Overrun** = each item type independent, starts page 1 (no sub).
  - **Rate-independent** — pages come from counts only; editing a per-person rate
    must NOT move them (locked by a test).
- **Per-person page badge** (`buildAuctionCol`, ~6645): a dragged person's
  "หน้า P · ชิ้น s". Start offset = that bucket's POOL `pageOffset` (from the
  page-map), so the page is the REAL auction page even when earlier columns are
  underfilled. Within a bucket: `cursor = pageOffset + i*rate + 1`, split into
  per-page segments of 4 (slots local 1–4). The *span* scales with `rate`; the
  *start page* is supply-anchored. `test/run.js` `[auction page-map]` locks it down.
- **Event-day request gate** (`arRequestBlockReason`, ~7165) — single source of
  truth used by both `arOpenRequestModal` and `arCreateRequest`. Allows a
  request only when: date == today (BKK), `isEventDay(today)` is truthy, the
  request `mode` matches that day's event (GL ↔ อังคาร/พฤหัส, Overrun ↔
  อาทิตย์), and the member isn't on leave. `arGetDateRange()` returns only
  `[today]` (no advance window).
- **Request queue order (2026-06-12):** every row shows 🕐 `requestedAt`
  (`arFormatTime`, BKK, HH:MM:SS; legacy = "—"). The PENDING group renders
  in pure first-come order with a visible `#N` queue badge
  (`renderGroup(..., asQueue=true)` → `arRenderRow(r, asAdmin, queueNo)`);
  approved/rejected history keeps the old main-before-sub grouping, and
  `arBulkApprove` still allocates main-first (unchanged on purpose).
  `requestedAt` is written as `firebase.database.ServerValue.TIMESTAMP`
  (server clock — a guest's skewed/forged device time can't jump the queue;
  raw-REST forgery is still possible — same accepted low-stakes griefing
  class as guest deletes on this node). `arGetRequests` is the single sort
  authority; the queue render deliberately does NOT re-sort.

## Testing (`test/`, dependency-free)

- **`node test/run.js`** — parse check + full behavior/simulation suite. Exit 1
  on any failure → use it as the pre-commit gate. `node test/parse-check.js`
  runs just the inline-script syntax check.
- **`test/harness.js`** loads the REAL inline `<script>` from `app.html` into
  a Node `vm` context with light DOM/Firebase/localStorage stubs. Function
  declarations leak onto the context global (callable directly); `let state` /
  `const`s are bridged out via a small `__T_*` shim injected right before the
  boot `load();` line. `setAdmin(bool)` / `setToday(iso)` override `isAdmin` /
  `todayBkkISO` for deterministic tests.
- Coverage today: event-day gate, editable rates (defaults/override/clamp/
  admin-guard), `normalizeAuctionState` migration, 70/30 + shortage math,
  GL+Overrun per-person badge numbering, the supply-based `[auction page-map]`
  (per-type ranges, total pages, 70/30 continuity + exact-fill, rate-invariance,
  zero-item, badge re-anchor), and the version stamp.
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
