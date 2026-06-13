# Firebase Security Rules — audit & deploy guide

These rules live in [`../database.rules.json`](../database.rules.json). They are the
**versioned source of truth** for the woe-party Realtime Database authorization boundary.
Until they're deployed, the live boundary is whatever is pasted in the Firebase console —
**unversioned and unreviewed.** Deploy these so the boundary matches the app and is
rollback-able.

> **Project:** `woe-party` · RTDB region `asia-southeast1` ·
> URL `https://woe-party-default-rtdb.asia-southeast1.firebasedatabase.app`

## The admin predicate

RTDB rules have no functions, so this is inlined at every admin-gated node. It mirrors
`isAdmin()` + `emailToAdminKey()` in `index.html` exactly:

```
auth != null && auth.token.email != null && (
  auth.token.email.toLowerCase() == 'sostenesfreitas@gmail.com'
  || root.child('admins').child(auth.token.email.toLowerCase().replace('.', '_')).val() == true
)
```

- **Bootstrap admin** (`sostenesfreitas@gmail.com`) is always admin — so it can seed `/admins`
  even when that node is empty (matches `ADMIN_EMAILS`).
- Otherwise admin = `/admins/{email-with-dots-as-underscores}: true`.
- RTDB `String.replace('.', '_')` replaces **all** occurrences — same as the app's
  `/\./g`. So `a.b@x.com` → `a_b@x_com`.
- Anonymous users (viewers) have no `auth.token.email` → predicate is false → read-only.

## Authority matrix

| Path | Read | Write | Why (app write site) |
|---|---|---|---|
| `/members` (node) | authed | **admin** | bulk migration `.set` (index.html:5825), sanitize |
| `/members/{id}` | authed | **authed UPDATE only** (create/delete = admin) | guest CP/Job edit `.update()` (index.html:5499) |
| `/parties/league`, `/parties/overrun` | authed | **admin** | drag-drop, sort, sanitize (index.html:5157+) |
| `/auction_gl`, `/auction_overrun` | authed | **admin** | base inputs, rates, assignments, reset |
| ⮑ `…/rates/{card,illusion,white,black}` | — | `.validate`: number ≥ 1 | editable per-person rates (Feature 2) |
| `/auction_requests` (node) | authed | **admin** | admin clear-day / auto-clear `.remove()` |
| ⮑ `…/{date}/{mode}/{reqId}` | authed | **authed CREATE or DELETE**; update = admin | guest create pending (index.html:6981) + withdraw `.remove()`; admin approve/reject `.update()` |
| `/leaves` (node) | authed | **admin** | weekly reset `.remove()` (index.html:5518) |
| ⮑ `/leaves/{memberId}/{date}` | authed | **authed** (bool) | guest leave toggle (index.html:7779) — no admin gate by design |
| `/job_targets` | authed | **admin** | summary targets |
| `/markers`, `/overrun_markers` | authed | **admin** | map markers |
| `/system` | authed | **admin** | daily/weekly reset stamps |
| `/admins` | authed | **admin** | privilege escalation surface — locked hard |
| `/users` | authed | **admin** | app login accounts (no secrets stored) |
| `/wheel_history` | authed | **admin** | 🎡 prize-wheel winner log; `$wid` shape-locked ({at,by,winnerId,winnerName,prize} + `$other:false`), client-trimmed to 200 |
| `/map_images` | authed | **admin** | 🖼 custom map backgrounds; `$mapNum` 1-5 only, value must `beginsWith('data:image/')` + length < 900k (client re-filters to base64 raster before the CSS sink) |

**Reads are `auth != null` everywhere** — viewers sign in anonymously, so the app can read
all shared state. The admin keyset and the users list are not secrets (real credentials
live in Firebase Auth, not RTDB).

## Cascade semantics (why node-level admin + child guest rules coexist)

RTDB rules are **OR-cascading**: once a `.write` is `true` at any ancestor, the write is
allowed and deeper rules are not consulted to *deny* it. So:
- `/members` node-level `.write: admin` grants admins everything below; the `$mid`
  `.write` *additionally* grants guests update-of-existing. Net: guest update ✓, guest
  create/delete ✗, admin all ✓.
- Same pattern for `/leaves` (admin clears all; guest toggles own date) and
  `/auction_requests` (admin clears day / approves; guest creates / withdraws).

## Verify BEFORE you deploy (Rules Playground)

Firebase console → Realtime Database → **Rules** → **Rules Playground**. Run each; expected
result in brackets. Use a real admin email for "authenticated (Google)" and toggle
"Anonymous" for guest cases.

1. **Read** `/parties/league`, location auth = Anonymous → **Allow**.
2. **Write** `/parties/league`, Anonymous → **Deny**.
3. **Write** `/parties/league`, Google = `sostenesfreitas@gmail.com` → **Allow**.
4. **Write** `/members/<existingId>/cp` = `9999`, Anonymous → **Allow** (guest CP edit).
5. **Write** `/members/<newId>` = `{name:"x"}`, Anonymous → **Deny** (create = admin).
6. **Write** `/leaves/<id>/2026-06-02` = `true`, Anonymous → **Allow**.
7. **Write** `/auction_requests/2026-06-02/gl/req1` = `{memberId:"m1",status:"pending"}`,
   Anonymous → **Allow** (create).
8. **Write** `/auction_requests/2026-06-02/gl/req1/status` = `approved` on an existing
   request, Anonymous → **Deny** (approve = admin).
9. **Write** `/admins/evil_x_com` = `true`, Anonymous → **Deny**.
10. **Write** `/auction_gl/rates/white` = `7`, admin → **Allow**; `/auction_gl/rates/white`
    = `0` → **Deny** (validate ≥ 1).

If all match, deploy.

## Deploy

**Option A — console paste (no install):** paste the entire `database.rules.json` into
console → Rules → **Publish**. The file is comment-free and deploy-clean (RTDB rejects
keys containing `/`, so there are no `//` comment keys — all explanation lives in this doc).

**Option B — Firebase CLI:**
```bash
npm i -g firebase-tools     # one time
firebase login              # one time
firebase deploy --only database   # uses firebase.json + .firebaserc + database.rules.json
```

## Rollback

The previous ruleset is whatever was last published. Because the rules are now in git,
roll back with `git revert` (or check out the prior `database.rules.json`) and re-deploy.
See [`../RUNBOOK.md`](../RUNBOOK.md).

## Known limitations / notes

- **Ownership of auction requests / leaves is not server-verified.** Guests are anonymous
  (no link between the localStorage "claimed member" and the auth UID), so a determined
  guest could withdraw someone else's request or toggle another member's leave. Accepted:
  single trusted guild, low stakes; the frontend is the UX gate. Revisit only if abused.
- **Auth authorized-domains is console-only config** (not in this file). If the GitHub
  Pages domain changes, admin Google sign-in silently breaks until the new domain is added
  in Firebase console → Authentication → Settings → Authorized domains.
- No emulator-based automated test for these rules (would require a global install, which
  breaks the zero-dependency rule). The Playground checklist above is the verification path.
