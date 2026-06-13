# Design — Help / "Como usar" page (in-app `help` mode)

**Date:** 2026-06-13
**App:** WOE Party Organizer (`app.html`, single-file, vanilla JS)
**Goal:** A new in-app **❓ Ajuda / Help** tab explaining every feature: a practical how-to guide + FAQ + event rules, fully bilingual (pt-BR default / English) via the existing `t()` i18n engine.

## Decisions (from brainstorming)
- **Location:** new in-app `help` mode + header tab (and mobile `<select>`), **visible to everyone** (not admin-gated).
- **Content type:** complete — how-to (step-by-step) per feature + FAQ + event rules.
- **i18n:** every string is a `help.*` key in BOTH `LOCALES["pt-BR"]` and `LOCALES["en"]`; admin-only features marked with a 🔒 Admin badge.

## Architecture / wiring (CLAUDE.md "new mode" rule)
The `help` mode does NOT touch `state.parties` (content-only). Wire it like the other non-party modes (wheel/users/summary):
- `state.mode` union gains `"help"`.
- `switchMode("help")` — handle without repointing `state.parties` (follow the wheel/users branch pattern).
- `render()` dispatch → `case "help": center.innerHTML = buildHelpHtml()`.
- Boot-time mode guard — `help` is a valid mode (don't fall through to a party array).
- Header `.mode-toggle` button + `.mode-select` `<option>`, key `nav.help` (pt "❓ Ajuda" / en "❓ Help"). NOT `seg-admin` (visible to all).
- `buildHelpHtml()` returns a template literal, all text via `t('help.*')`. Reuse a `.help-*` CSS section (mode-scoped, follows existing `/* ===== ... ===== */` convention).

## Page structure (`buildHelpHtml`)
1. **Hero/intro** (`help.intro`) — 2 lines: what the app is.
2. **📅 Event rules** (`help.rules_*`) — GL = Ter/Qui · Overrun = Dom · auction window 21:00–22:00 on event day · leave auto-clears Monday 00:00 BKK · all "today" logic uses Asia/Bangkok.
3. **Feature how-to cards** — each: title + "what it is" + short numbered steps; 🔒 Admin badge where admin-only. Features:
   - **League** — 16 parties × 5, drag members from sidebar into slots, per-map filters, markers on the battlefield maps; main/sub plans.
   - **Overrun** — 5 color groups (Red/Yellow/Green/Blue/Purple) over the 16 parties, on the Overrun map.
   - **Roster** — member registry (Name/Job/CP/Discord). Guests: claim your own name → edit your row → 💾 Save. Admin: edit any row live + Import from Sheet + clean duplicates.
   - **Resumo / Job Breakdown** — job counts vs. editable targets (admin), status (over/short/balanced), pie chart, AI comment with move suggestions.
   - **Leilão GL** — admin types final item quantities; split 70/30 main/sub (editable %); per-person rates; drag names into item columns; the app computes the REAL auction pages (4 items/page).
   - **Leilão Overrun** — same, single pool (no main/sub).
   - **Pedir leilão** — request an item ONLY on the current event day, for that day's event, and only if not on leave; admin approves a first-come queue; auto-routes main/sub by your party.
   - **Folgas** — register leave in advance; the party view marks you on that day; auto-clears Monday.
   - **Roleta 🔒** — admin raffles a winner from the Roster (everyone eligible every round); history kept.
   - **Users 🔒** — admin creates ID + Password login accounts (no Firebase Console needed).
   - **Análise de batalha GL** — stats comparison + under-performer detection + AI insights (demo data).
   - **Mapas & marcadores 🔒** — admin uploads map images + places pins/arrows; guests view/filter only.
   - **Login & Admin** — anonymous = viewer; Google sign-in or ID/Password = admin (gated by allowlist + DB rules); add more admins under Login → Manage Admin.
   - **Idioma PT | EN** — the header switch toggles language live; choice saved per device.
4. **❓ FAQ** (`help.faq_*`) — at least:
   - "Não consigo pedir leilão" → only on event day, matching event, not on leave.
   - "Minha edição não salva / permission denied" → you need admin (Google/ID login) for most edits; guests only edit their own Roster CP row.
   - "Como viro admin?" → ask an admin to add your email under Login → Manage Admin (or Google sign-in if you're the bootstrap).
   - "Como troco o idioma?" → PT | EN button in the header.
   - "Sumiu minha folga / meu pedido" → leave clears Monday 00:00; requests clear daily 00:00 (BKK).

## i18n & content
- ~60–90 `help.*` keys per locale (the bulk of the work). No HTML inside values (keep `<b>`/`<br>`/section markup in the template; translate text fragments only). Game jargon (League/Overrun/GL/Roster/Card/etc.) stays literal English per the project convention.
- Content is authored from the actual app behavior (this spec is the source of truth for the copy); user reviews via the glossary + the rendered page.

## Testing (CLAUDE.md gate)
- `[help]` test: mode plumbing complete — `nav.help` tab + `<option>` + `switchMode("help")` valid + `render` dispatch + boot guard (mirror the `[wheel]` "mode plumbing complete" test). `buildHelpHtml()` returns a non-empty string and contains a known marker.
- `[i18n]` assertions: a few `help.*` keys resolve in both locales.
- `node test/parse-check.js` → PARSE OK; `node test/run.js` → 0 failed. `/code-review` before commit. `APP_VERSION` bump + CHANGELOG entry.

## Out of scope
- No new backend/Firebase data. No screenshots/images (text + emoji only). No separate help.html (it's an in-app tab). Not gated by admin.

## Success criteria
- ❓ Ajuda/Help tab visible to everyone; opens the guide; PT↔EN switches all of it live; admin-only features badged; FAQ + event rules present; tests green; version bumped.
