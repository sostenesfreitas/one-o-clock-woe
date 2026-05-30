# Changelog

All notable changes to woe-party. The `APP_VERSION` constant in `index.html` (shown in the
app footer) is a calendar version `YYYY.MM.DD`. Bump it whenever you ship a user-visible
change to `index.html`; add an entry here. Git history is the detailed record — this file
is the human-readable highlight reel.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- _nothing yet_

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
