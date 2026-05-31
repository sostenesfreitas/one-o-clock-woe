# Changelog

All notable changes to woe-party. The `APP_VERSION` constant in `index.html` (shown in the
app footer) is a calendar version `YYYY.MM.DD`. Bump it whenever you ship a user-visible
change to `index.html`; add an entry here. Git history is the detailed record — this file
is the human-readable highlight reel.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- _nothing yet_

## [2026.05.30.11]
### Changed
- **ขอประมูลได้ 1 คน 1 อย่าง ต่อกิจ.** เดิมสมาชิกติ๊กขอได้หลายชนิดในคำขอเดียว ตอนนี้
  จำกัดให้ขอได้ **1 ชนิดต่อกิจ** (การ์ด/Illusion/ขนขาว/ขนดำ — เลือกอย่างเดียว) — modal
  เปลี่ยนเป็น single-select (ปุ่มวงกลม ◉/○). ถ้ามีคำขอค้างอยู่แล้ว (รออนุมัติ/อนุมัติแล้ว)
  ปุ่ม "ขอประมูล" จะล็อกเป็น "✅ ขอแล้ว 1 อย่าง" — ต้อง **ถอนของเก่าก่อน** ถึงจะขอใหม่ได้
  (คำขอที่ถูกปฏิเสธ/ถอนแล้ว ไม่นับ — ขอใหม่ได้เลย). บังคับใช้ทั้งฝั่ง UI และตอนสร้างคำขอ
  ผ่าน `arActiveRequestFor` (แหล่งความจริงเดียว); `arCreateRequest` คืน `true` เมื่อสำเร็จ
  เพื่อให้ modal ปิดถูกต้อง. +6 เทสต์ (รวม 79).

## [2026.05.30.10]
### Added
- **ประวัติคำขอที่ถูกปฏิเสธ (same-day).** หน้า ขอประมูล ฝั่งแอดมินมี section ใหม่
  "❌ ปฏิเสธวันนี้" แสดงคำขอที่กดปฏิเสธไป (พร้อมเหตุผล) ค้างไว้ให้ดูตลอดวัน — แอดมิน
  เห็นว่าใครโดนปฏิเสธและกด "✓ อนุมัติ" ย้อนได้ถ้าปฏิเสธพลาด ประวัตินี้ถูกล้างพร้อม
  ทั้งวันโดย "ล้างคำขอทั้งหมดของวันนี้" / ล้างวันที่ผ่านมา / รีเซ็ตรายวัน (ขอบเขตวันเดียว
  เหมือนข้อมูลประมูลอื่น). (`arBuildAdminQueue` ดึง `rejected` เพิ่ม; `arRenderRow` ปุ่ม
  re-approve สำหรับ rejected row.)

## [2026.05.30.9]
### Changed
- **Auction page-map now packs items CONTINUOUSLY instead of starting each item type on a
  fresh page.** The next item type begins right after the previous one's last slot on the
  same page — e.g. การ์ด fills page 1, Illusion takes page 2 slots 1-2, then ขนขาว starts on
  **page 2 slot 3** (not a fresh page 3). For Overrun with การ์ด 20 + Illusion 2, ขนขาว now
  starts **page 6 slot 3**. This reverses the per-type fresh-page rule from 2026.05.30.3 to
  match the in-game auction's actual behavior. One shared code path fixes GL + Overrun; the
  per-column page chip, the top page-map strip, and the per-person page badges all follow.

## [2026.05.30.8]
### Fixed
- **Per-column page chip shows the exact slot range, not just the page.** A partial page
  read ambiguously (2 items on page 6 showed “หน้า 6 · 2 ชิ้น”, looking like the whole page).
  It now reads “หน้า 6 · ชิ้น 1-2 · รวม 2 ชิ้น” (and “หน้า X (ช่อง a)–Y (ช่อง b)” when it spans
  pages), matching the per-person badges below it.

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
