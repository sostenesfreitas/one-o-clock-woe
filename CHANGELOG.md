# Changelog

All notable changes to woe-party. The `APP_VERSION` constant in `index.html` (shown in the
app footer) is a calendar version `YYYY.MM.DD`. Bump it whenever you ship a user-visible
change to `index.html`; add an entry here. Git history is the detailed record — this file
is the human-readable highlight reel.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- _nothing yet_

## [2026.05.30.7]
### Fixed
- **Auction search box no longer jumps to the top while typing.** `auctionSearchInput`
  restored focus/scroll in a `setTimeout`, so the page painted at the top for one frame
  (the jump) before snapping back. It now restores focus + caret + scroll synchronously
  right after the re-render — the same proven pattern as `setAuctionField`/`setAuctionRate`.
- **GL split % input now matches the dark/gold theme.** Its CSS (`.auction-split-input`
  + related) had silently failed to land, so it rendered as a plain white box. Added the
  themed styles plus a `[css coverage]` test group that fails if a themed control's class
  is in the markup but has no matching CSS rule.

## [2026.05.30.6]
### Fixed
- **Admin "จัดสรรอัตโนมัติ" buttons now follow the day's event.** On the ขอประมูล admin
  queue, only the current event's allocate button shows — GL on อังคาร/พฤหัส, Overrun on
  อาทิตย์, and **neither** on a non-event day (previously both GL + Overrun always showed).
  Matches the event-day lock already enforced on the guest request side. "🧹 ล้างวันที่
  ผ่านมา" stays available regardless. (`arBuildAdminQueue` now takes `eventMode`.)
### Added
- **`woe-feature-map` skill** — a pre-edit checklist that traces every surface a feature
  touches (guest/admin/viewer render, GL/Overrun branches, state+sync, the gate on all
  actors, tests) so a cross-cutting rule can't be applied to one surface and missed on its
  twin (the bug above is its worked example).

## [2026.05.30.5]
### Added
- **Editable สนามหลัก/สนามรอง split % for the GL auction.** Admins can set what
  percent of each item goes to สนามหลัก (default 70); สนามรอง gets the rest. New
  "⚖️ การแบ่งสนาม" control on the Auction GL page; all field labels (headers, per-column
  ใช้/XX%, summary) follow the value live. The split rides the existing `auction_gl`
  Firebase object (no rule change). Overrun is unaffected (no sub field).
### Changed
- **Uneven split now rounds the leftover to สนามหลัก (ceil), not down.** When an item
  count doesn't divide cleanly, the extra piece is auctioned on the main field — e.g. 5
  ชิ้น @70% = หลัก 4 / รอง 1 (previously 3/2). Whole splits (e.g. 10 @70% = 7/3) are
  unchanged, as are the supply page-map's per-type page ranges (they derive from each
  item's total, not the main/sub split).

## [2026.05.30.4]
### Added
- **Branded landing page (front door).** A new static `index.html` is now the front
  page — the "one o clock — Ragnarok Origin Classic" logo, a feature overview, the weekly
  event schedule (อังคาร/พฤหัส = GL · อาทิตย์ = Overrun, today highlighted), and a CTA into
  the tool. Open Graph tags make shared links preview the logo (Discord/LINE). Logo at
  `assets/one-o-clock.png`.
### Changed
- **The app moved from `index.html` to `app.html`** so the landing can own the root URL.
  GitHub Pages now serves the landing at `/` and the organizer at `/app.html`. Weekly users
  can bookmark `/app.html` to skip the intro. Test harness + parse check follow the rename;
  a `[landing]` test group guards the front-door wiring.

## [2026.05.30.3]
### Fixed
- **Auction page-map — each item type now starts on its own fresh page** (matches
  the in-game auction, where every item type begins on a new page). Previously a
  type continued mid-page from the previous type (e.g. ขนขาว shared a page with
  Illusion), so the page numbers didn't line up with the real auction. Now: การ์ด 4
  → all page 1; การ์ด 6 → p1–2; the next type starts fresh. Within a type, main → sub
  still run continuously. Applies to GL and Overrun (fixes Overrun types overlapping
  on page 1). Per-person page badges + the per-column page chip follow the same blocks.
### Added
- **Per-column coverage line** on each auction column — "ลากถึงหน้า N · ขาดอีก X ชิ้น
  (Y หน้า)" / "✅ ลากครบ" / "เกินมา" — so the admin can fill people to match the real
  pages without counting.

## [2026.05.30.2]
### Added
- **Auction page-map (supply-based):** each Auction GL/Overrun page now shows the
  real in-game auction pages computed from the **item pool** — a top ruler
  ("วันนี้รวม N ชิ้น = M หน้า" + page span per item type) and a "📄 หน้า X–Y" chip on
  each column. Per-person page badges are re-anchored to the pool, so a dragged
  person's page matches the real auction even when other columns aren't filled.
  Page numbers depend on item counts only (rate-independent). GL is one continuous
  run (sub continues main's partial page); Overrun is independent per item type.
- **SDLC hardening (Phase 1):** versioned Firebase security rules
  (`database.rules.json` + `docs/firebase-rules-audit.md`), GitHub Actions CI running the
  test suite on push/PR, this changelog, a `RUNBOOK.md`, and a version stamp in the app
  footer.
- **Auction Request — event-day lock:** the ขอประมูล page now opens only on the current
  event day (อังคาร/พฤหัส = GL, อาทิตย์ = Overrun) and only for that day's event; no
  requesting a future event in advance.
- **Editable per-person rates:** admins can set จำนวนของที่ได้รับต่อคน per item for both
  GL and Overrun auctions (synced; feeds the auction-page chain numbering).
- **Test suite + QA tooling:** dependency-free Node test harness (`test/`,
  `node test/run.js`), `/woe-qa` pre-deploy skill, and `woe-qa-reviewer` agent.

### Notes
- Firebase rules in this release must be **deployed manually** (console paste or
  `firebase deploy --only database`) — see `docs/firebase-rules-audit.md`. The new
  `rates` write requires these rules (or equivalent) to be live.
