---
name: woe-feature-map
description: Trace EVERY surface a woe-party feature touches before editing it, so a cross-cutting rule (event-day lock, admin-gating, GL/Overrun symmetry, viewer-mode, Firebase sync) stays consistent across guest UI, admin UI, bulk/allocate actions, validation, and the writer. Use before changing or adding any auction / ขอประมูล / party behavior, or whenever a rule must hold "everywhere" — and whenever a fix on one surface might have a twin elsewhere. Pairs with woe-edit (how to edit safely) and woe-qa (pre-deploy gate).
---

# woe-feature-map — map the whole feature before you touch it

The woe-party app is one ~8,400-line `app.html`. The same rule is usually enforced in
**several places**, and bugs come from updating one and missing its twin. The canonical
example: Feature 1 locked ขอประมูล to the day's event on the **guest** request buttons, but
the **admin** "จัดสรรอัตโนมัติ" buttons kept showing both GL + Overrun — same rule, second
surface, missed. This skill makes you enumerate all surfaces first.

> Read this BEFORE editing. Then use `woe-edit` for the mechanics and `woe-qa` to gate.

## 0. Ground-truth reading (mojibake caveat)

`app.html` has Thai text that Read/Grep/Bash sometimes render as garbled / duplicate-looking
lines this environment. **Trust bytes, not the rendering:**
- Dump real lines with Node: `node -e 'const L=require("fs").readFileSync("app.html","utf8").split("\n"); for(let i=A;i<=B;i++) process.stdout.write(i+"| "+JSON.stringify(L[i-1])+"\n")'`
- Count occurrences with Node regex (`(s.match(/…/g)||[]).length`) before assuming "unique".
- Edit Thai-containing lines via a **Node surgical replace anchored on ASCII** substrings
  (onclick handlers, class names, function names), then re-verify with `node test/parse-check.js` + counts.
- For structural queries you can also read from `git show HEAD:app.html` (stable bytes).

## 1. Trace the five surfaces

For the feature you're about to change, locate and list each (grep the symbol, Node-dump the
window). If a surface exists, the rule must hold there too.

1. **Render — by audience.** Guest vs admin vs viewer.
   - `isAdmin()` gates admin-only UI; non-admins get `viewer-mode` on `<body>` (CSS hides
     edit affordances). Check the feature renders correctly for **all three**.
   - Builders: `buildAuctionView(kind)`, `buildAuctionRequestHtml()`, `arBuildAdminQueue(date, eventMode)`,
     `arRenderRow(r, asAdmin)`, `buildRosterHtml()`, the header mode buttons.
2. **Mode branches.** Anything keyed on `kind`/mode must handle **both** GL and Overrun (or
   deliberately not): `kind === "gl"`, `hasSubField`, `splitMain`, `state.auctionGL` vs
   `state.auctionOverrun`, `partiesLeague` vs `partiesOverrun`. Overrun has **no sub field**.
3. **State + sync.** Where the value lives and how it propagates:
   `state.auction{GL,Overrun}` (with `rates`, `splitMainPercent` — `bonusPercent` was retired 2026-06 and is stripped by normalize),
   `normalizeAuctionState(obj, kind)` (add a backfill for any new field),
   the `_fbDB.ref("auction_gl"|"auction_overrun").set(...)` writers + `.on("value")` listeners,
   and `save()` (localStorage). A new persistent field needs: state init + normalize backfill
   + it must ride an existing synced object (or get its own listener+writer).
4. **The gate / validation — applied on every actor.** If the feature has a rule, find its
   single source and confirm **all** of these honor it:
   - **guest UI** (button shown/enabled?), **guest action** (the create/submit fn),
   - **admin UI** (button shown?), **admin bulk/allocate action**, **the writer/Firebase rule**.
   - Event-day rule: `isEventDay(iso)` → `arRequestBlockReason(memberId,date,mode)` (guest),
     `eventMode` in `buildAuctionRequestHtml` → passed to `arBuildAdminQueue(date, eventMode)`
     (admin). Admin allocate = `arBulkApprove(date, mode)`.
   - Admin-write rule: every `_fbDB.ref(...).set/update/push` inside `isAdmin()`;
     mirrored server-side in `database.rules.json`.
5. **Tests.** The matching group in `test/run.js`. A behavior change with no test is
   incomplete (CLAUDE.md). Prefer asserting via ASCII anchors (onclick handlers, data-attrs)
   so Thai labels don't break the match. Harness gives `setAdmin(bool)`, `setToday(iso)`,
   `computeAuction`, `buildAuctionView`, `buildAuctionRequestHtml`.

## 2. Cross-cutting checklist (tick before you call it done)

- [ ] **Both sides of every gate** — guest *and* admin; UI *and* action *and* writer.
- [ ] **GL and Overrun** both handled (or intentionally divergent — note why).
- [ ] **viewer-mode** path still correct (no admin-only control leaks to viewers; no
      read-only breakage).
- [ ] **New synced field** → state init + `normalizeAuctionState` backfill + rides a synced
      object; consider `database.rules.json`.
- [ ] **Labels follow data** — if a number/percent is configurable, every label that prints
      it (headers, per-column, summary, tooltips) reads the live value, not a constant.
- [ ] **Tests** for each surface, ASCII-anchored; `node test/run.js` green.
- [ ] **VERSION COUPLING** — bump `APP_VERSION` (app.html) + landing footer + CHANGELOG together.

## 3. Worked example — "event-day lock" surfaces

| Surface | Symbol | Honors the rule? |
|---|---|---|
| guest request buttons | `buildAuctionRequestHtml` (`eventMode`) | ✓ (Feature 1) |
| guest submit | `arRequestBlockReason` → `arCreateRequest` | ✓ |
| **admin allocate buttons** | `arBuildAdminQueue(date, eventMode)` → `arBulkApprove` | ✓ (this fix; was ✗) |
| admin per-row approve | `arApproveRequest` | n/a (acts on existing requests) |
| clear-old | `arAutoClearPast` | always available (not event-scoped) |
| tests | `[admin allocate gating]`, gate matrix in `[event-day request gate]` | ✓ |

If you'd touched only one row here, this table is what would have caught the gap.
