---
name: woe-edit
description: Use when editing index.html in the woe-party repo — the single-file ~6,300-line app that holds all UI, styles, and logic. Triggers on tasks like "add a page", "fix a render bug", "change auction layout", "add a Firebase field", "tweak responsive CSS", or any work that touches index.html. Covers safe-navigation patterns and the data/sync model so edits don't break adjacent features.
---

# Editing `index.html` safely

This repo is a single static HTML file (~6,300 lines) — no build, no
framework, no test suite. All edits land in `index.html`. This skill keeps
you from breaking adjacent features.

For full architecture, read `knowledge.md`. For project conventions, read
`CLAUDE.md`. Don't re-read those when this skill is sufficient.

## Navigate before you edit

Don't read the file top-to-bottom. Locate first:

1. **Grep for the symbol** — function name, CSS selector, Firebase path,
   Thai UI string. `grep -n 'patternHere' index.html`.
2. **Read a window** — `Read` with `offset` + `limit` (~80 lines around the
   hit). Section headers (`/* ===== Name ===== */`) mark boundaries.
3. **Confirm you're in the right section** before editing — CSS has
   per-mode duplicates (e.g. `.league .slot` vs `.overrun .slot`).

The `knowledge.md` "File anatomy" table gives line ranges. Line numbers
drift after edits — always re-grep before relying on a stored offset.

## The three zones

```
<style>     1   – 2204    ← all CSS, sectioned by /* ===== ... ===== */
<body>      2211 – 2305   ← markup: header, sidebar, dialogs
<script>    2306 – 6321   ← constants, state, helpers, render, sync, init
```

Each edit usually touches **one** zone. If you find yourself editing all
three, double-check the change is actually that broad.

## State and render

- One global `let state = { ... }` (`index.html:2354`). Mutate it,
  call `render()`, that's the loop.
- `render()` (`index.html:6149`) dispatches per `state.mode`. New mode →
  add a branch here, in `switchMode()`, and in the boot-time fixup at
  `index.html:6260`.
- `save()` writes `state` to `localStorage[STORAGE_KEY]`. Call it after
  mutations that should persist locally.
- Firebase writes go through `_fbDB.ref(path).set(...)` and **must** be
  gated by `isAdmin()`. Inside listener callbacks set `_fbApplyingRemote = true`
  before mutating state, reset after.

## Add a new persistent field — checklist

1. Add the key to the `state` initializer (`index.html:2354`).
2. If it has a non-trivial shape, add a `normalizeXState()` helper near
   `normalizeAuctionState` (`index.html:6269`) and call it in the boot block.
3. Add a Firebase listener in `subscribeFirebase` (search for existing
   `_fbDB.ref("...").on("value", ...)` calls near `index.html:4540`).
4. Add a writer (gated by `isAdmin()`) wherever the user mutates the
   field; wrap with the existing `_fbPushTimer` debounce pattern if writes
   are frequent.
5. If the field needs to survive across mode switches, decide whether it
   belongs in `state.partiesLeague` / `state.partiesOverrun` vs the
   top-level state — see `knowledge.md` for the mode-mirroring trick.

## Add a new mode/page — checklist

1. Add the literal to the `state.mode` comment union (`index.html:2357`).
2. Add a button + active-class branch in `updateModeToggleUI()`
   (`index.html:2477`).
3. Add a `render()` branch (`index.html:6149`).
4. Handle the load-time `state.parties` fixup (`index.html:6260`) — most
   read-only pages should set `state.parties = state.partiesLeague`.
5. Add CSS in the `<style>` block with a `/* ===== <Mode> page ===== */`
   header matching the existing pattern.
6. If it has Firebase-synced data, follow the "Add a persistent field"
   checklist above.

## Drag-drop edits

- The drag handlers are at `dragMemberStart` / `dragSlotStart` /
  `dragPartyNumStart` (~`index.html:2987-3010`). Don't mix `dataTransfer`
  formats between them.
- During an active drag, remote re-renders are blocked by `setDragging(true)`
  to avoid mid-drag snapback. If you add a new drag entry point, wire it up
  to `setDragging` too.
- "Ghost slot" sanitization happens in `sanitizeSlots()` — admin-side
  writes auto-clear stale `memberId`s. Don't bypass it.

## CSS edits

- Responsive: `≤1100px` tablet, `≤700px` mobile (`index.html:1862`),
  `≤480px` small (`index.html:2159`). Test all three when changing layout.
- The `viewer-mode` body class is added to non-admin sessions. CSS uses it
  to hide edit affordances (`/* Viewer mode ===== */`, `index.html:72`).
  New admin-only UI should pick up this gating "for free" by being inside a
  container the rule already targets, or by adding a new selector inside
  the existing block.

## Time / dates

Always use the BKK helpers (`bkkNow`, `todayBkkISO`, `bkkDow`,
`isEventDay`, `thisMondayISO`) near `index.html:2382-2415`. Raw `new Date()`
gives wrong results outside Asia/Bangkok.

## Don't

- Don't introduce a build step, npm, TypeScript, or a framework.
- Don't add external runtime dependencies beyond the existing Firebase
  compat SDK.
- Don't commit Firebase admin SDK keys or service-account JSON. The
  current `FIREBASE_CONFIG` is a public web key — that's fine.
- Don't drop the `maps/*.png` static fallback — Firebase Storage is an
  override, not a replacement.
- Don't reintroduce removed modes (`dimension`, `glsummary`); the
  load-time redirect at `index.html:6258` assumes they stay gone.

## Verifying

1. Open `index.html` in a browser (serve over `python3 -m http.server 8000`
   so Firebase auth popup works).
2. Walk: viewer load → Google sign-in → mode switch → drag-drop → reload.
3. Check the responsive breakpoints in DevTools (1100/700/480 px).
4. There is no test suite. If you can't open a browser, say so explicitly
   instead of claiming the change works.
