# CLAUDE.md — WOE Party Organizer

Project rules **and** memory for Claude Code. Focus: coding and editing the
WoE party organizer app. Pair this with `knowledge.md` (deep architecture
reference: state shape, sync flow, line map).

## 🛡️ QA review เป็นข้อบังคับ

**ทุกครั้งที่เขียน/แก้โค้ดในโปรเจคนี้ ต้องผ่าน QA review ก่อนถือว่าเสร็จ — ห้ามหลุด**

### ขั้นตอนบังคับหลังเขียน code ทุกครั้ง

1. **Syntax check** — รัน Node parse check ของ inline scripts ใน `app.html`
   ก่อน (รันจาก repo root):
   ```bash
   node -e "
   const fs = require('fs');
   const html = fs.readFileSync('app.html','utf8');
   const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
   let m, all = '';
   while ((m = re.exec(html))) {
     const tag = html.slice(m.index, m.index + html.slice(m.index).indexOf('>') + 1);
     if (/\bsrc=/.test(tag)) continue;
     all += m[1] + '\n';
   }
   try { new Function(all); console.log('PARSE OK'); }
   catch(e){ console.error('PARSE ERROR:', e.message); process.exit(1); }
   "
   ```
   ถ้าเจอ `PARSE ERROR` → ห้ามคอมมิต แก้ก่อน

2. **QA review skill** — เรียก `/code-review` ที่ effort `high` (ถ้าเป็นการแก้บัค)
   หรือ `medium`+ (ถ้าเป็น cleanup) ก่อน commit เสมอ
   - ถ้ามี finding ระดับ correctness bug → ต้องแก้ก่อน commit
   - ถ้าเป็น cleanup/simplification → ตัดสินใจร่วมกับ user ว่าจะแก้รอบนี้หรือทิ้ง TODO

3. **Security check** — สำหรับการแก้ที่เกี่ยวกับ:
   - Firebase Rules / Auth / Permissions
   - User-provided input ที่จะ render เป็น HTML
   - localStorage / sessionStorage handling
   - URL parameters / sharing
   - → เรียก `/security-review` เพิ่มด้วย

4. **Manual smoke** — บอก user ขั้นตอนทดสอบสั้นๆ (golden path + 1 edge case) ก่อน push

### กฏที่ห้ามฝ่าฝืน

- ❌ **ห้าม commit/push ถ้า `node test/run.js` ไม่ผ่าน** — แม้จะเป็น typo เล็กๆ
- ❌ **ห้าม merge เข้า main ถ้ายังไม่ผ่าน QA review** — feature branch ก่อน, ตรวจ, ถามผู้ใช้, แล้วค่อย merge
- ❌ **ห้าม skip QA โดยเหตุผลว่า "เปลี่ยนแค่ 1 บรรทัด"** — บั๊กเยอะแยะมาจาก one-line change
- ❌ **ห้าม claim ว่าเสร็จแล้วถ้ายังไม่ได้รันเทส** — เคยปล่อย parse error ผ่านมาแล้ว
- ❌ **ห้ามแก้พฤติกรรมแล้วไม่เพิ่ม/อัปเดตเทส** — เทสคือสัญญาว่าพฤติกรรมถูกต้อง

### กรณีพิเศษ

- **Doc-only change** (README, CLAUDE.md, knowledge.md, comments only) → skip
  syntax check ได้ แต่ยังต้องอ่านทบทวนเอง
- **Revert pure** (ย้อน commit เก่า) → skip QA review ได้ แต่ต้องบอก user ว่าย้อนอะไร
- **Emergency hotfix** (กรณีคนใช้งานอยู่จริงๆ แล้วเกิด production down) → ทำ minimal
  fix, push, แล้วทำ QA review หลัง (post-mortem). ดูขั้นตอน revert / rollback rules /
  restore data ที่ [`RUNBOOK.md`](RUNBOOK.md); ถ้าแตะข้อมูล ให้ทำ backup ก่อนเสมอ
- **Deploy / release / incident** → `RUNBOOK.md` (release steps, rollback, pre-destructive
  backup). Firebase security rules เป็น code ที่ `database.rules.json` (+ คู่มือ deploy ที่
  `docs/firebase-rules-audit.md`) — แก้ rules ต้อง review + deploy + บันทึก CHANGELOG

---

## What this project is

A single-file web app (`app.html`) that helps a Ragnarok Online guild
organize War of Emperium (WoE) parties and run post-war loot auctions.
Everything — markup, styles, logic — lives in one HTML file. It syncs in real
time through Firebase so the guild leader edits and members watch live.

## Repo layout

```
woe-party/
├── app.html          # the entire app (~8,300 lines)
├── maps/               # battlefield background images
│   ├── main.png
│   ├── sub.png
│   └── overrun.png
├── CLAUDE.md           # this file — rules + project memory
├── knowledge.md        # deeper architecture reference (state, sync, line map)
├── README.md           # user-facing description
└── .claude/
    ├── agents/woe-coder.md             # agent: implement features / fix bugs in app.html
    ├── agents/woe-qa-reviewer.md       # agent: read-only pre-deploy QA verdict
    ├── skills/woe-edit/SKILL.md        # skill: safe-edit workflow for app.html
    ├── skills/woe-feature-map/SKILL.md # skill: trace all surfaces a feature touches
    └── skills/woe-qa/SKILL.md          # skill: mandatory pre-deploy QA gate
```

## Stack

- **Vanilla JS** — no framework, no build step, no modules. One `<script>`.
- **Firebase** Realtime Database + Auth + Storage (compat SDK 10.7).
- **localStorage** for offline cache + per-device fallback.
- **GitHub Pages** deploy from `main` → https://cybodies.github.io/one-o-clock-woe

## Key constants (top of script block)

- `PARTIES = 16` — League party count.
- `DEFAULT_SHEET` — legacy Google-Sheet import URL (optional roster bootstrap).
- `ADMIN_EMAILS` — literal allowlist for admin gating.
- `SYNC_KEYS` — whitelist of state keys mirrored to Firebase.

## Pages / modes

`state.mode` ∈ league · overrun · summary · auction-gl · auction-overrun ·
roster · leave. Each renders from the same `state`; `switchMode()` repoints
`state.parties` at the league or overrun array.

## Firebase data model

```
/parties/league/{0..15}/{slots}
/parties/overrun/{0..15}/{slots}
/members/{id}
/markers/{partyId}
/auction_gl, /auction_overrun
/leaves/{memberId}/{YYYY-MM-DD}
/job_targets, /system
/admins/{email_underscored}, /users/{username}
```

Firebase RTDB drops trailing nulls + converts sparse arrays to objects —
always read back through `fbToFixedArray(v, len, fill)`.

## Auth model

- Anonymous sign-in for viewers; email/password (or Google bootstrap) for
  admins. `isAdmin()` gates every write.
- Admin bootstrap: `blankkardor@gmail.com` (Google OAuth). Additional admins
  via `/admins/{email_with_dots_as_underscores}`. ID/password accounts created
  in the Users page live at `/users/{username}` (synthetic email
  `username@woe.local`).
- Frontend gating is UX only — real enforcement is in Firebase DB rules.

## Timezone

All "today" logic uses Asia/Bangkok (UTC+7) via `todayBkkISO()` / `bkkNow()`.
Never use `new Date()` directly for date math (off-by-one outside Bangkok).

## Conventions

- Thai-primary UI, English technical terms.
- CSS vars for theming; mode-scoped `/* ===== ... ===== */` sections.
- Inline `event.stopPropagation()` where the existing code does it.
- Additive, surgical edits — don't reflow unrelated code.
- Guard every Firebase write with `isAdmin()`; use `fbToFixedArray()` on reads.

## Critical files

- `app.html` — entire app (~8,300 lines). `APP_VERSION` constant = footer version
  stamp; bump on every user-visible change + add a `CHANGELOG.md` entry.
- `maps/main.png`, `maps/sub.png`, `maps/overrun.png` — battlefield map images.
- `test/` — dependency-free test harness + suite (`node test/run.js`); the pre-commit gate.
- `database.rules.json` — Firebase RTDB security rules (deploy manually; see
  `docs/firebase-rules-audit.md`). `firebase.json` / `.firebaserc` support `firebase deploy`.
- `.github/workflows/ci.yml` — runs the test suite on push/PR.
- `CHANGELOG.md`, `RUNBOOK.md` — release notes + incident/rollback procedures.

## Branch policy

- Develop on a feature branch — never edit `main` directly.
- Fast-forward merge to `main` only when the user confirms — never force push.
- Never push to a different branch without explicit user permission.

## Out of scope

- No build tooling, frameworks, or npm dependencies.
- No live game network/memory access (this is a planning tool only).
- Don't weaken Firebase security rules to make a feature work.
