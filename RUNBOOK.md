# RUNBOOK — woe-party incidents & releases

Single static app on GitHub Pages (`main` → https://cybodies.github.io/one-o-clock-woe) backed by
Firebase RTDB. Used live during WoE (อังคาร/พฤหัส = GL, อาทิตย์ = Overrun, ~21:00 BKK).
Keep fixes minimal during an event; do the full QA pass after.

## Before any destructive action (do this first)

Destructive = "🧹 ล้างหน้า Auction", weekly leave reset, deploying new Firebase rules,
or any bulk `/members` rewrite. **Back up the affected data first** — restore is impossible
without it:

1. Firebase console → Realtime Database → pick the node (e.g. `auction_gl`, `leaves`, or
   the root) → ⋮ → **Export JSON**.
2. Save under `backups/woe-party-<node>-<YYYYMMDD-HHmm>.json` (the `backups/` dir is
   gitignored — keep these local / off-repo).

## Release (ship a change to app.html)

1. On a feature branch: make the change **+ a test**, run `node test/run.js` (green) — or
   `/woe-qa` for the full gate.
2. Bump `APP_VERSION` in `app.html` to today's date `YYYY.MM.DD` and add a `CHANGELOG.md`
   entry.
3. Fast-forward merge to `main`, push. GitHub Actions runs the suite; GitHub Pages
   redeploys automatically (~1–2 min).
4. Hard-refresh https://cybodies.github.io/one-o-clock-woe and confirm the footer shows the new
   `v<version>` (proves the deploy + that users aren't on a stale cache).

## Rollback the app (bad deploy)

```bash
git -C <repo> revert <bad-sha>     # or: git revert HEAD
git -C <repo> push origin main     # Pages redeploys the reverted state
```
Tell the guild to hard-refresh (Ctrl/Cmd-Shift-R). Confirm the footer version changed back.

## Rollback the Firebase rules

Rules are versioned in `database.rules.json`. Restore the previous version and redeploy:
```bash
git -C <repo> checkout <good-sha> -- database.rules.json
# then re-publish: console paste, or `firebase deploy --only database`
```
See `docs/firebase-rules-audit.md`.

## Restore data (after a bad reset / write)

Firebase console → Realtime Database → select the node → ⋮ → **Import JSON** → choose the
backup you exported above. Imports overwrite the selected node.

## Symptom → action

| Symptom | Likely cause | Action |
|---|---|---|
| Admin can't sign in | Auth authorized-domains missing the Pages domain (console-only config) | console → Authentication → Settings → Authorized domains → add the domain |
| Writes silently fail (toast "ตรวจ Firebase Rules…") | rules block a path | check `docs/firebase-rules-audit.md`; verify in Rules Playground; fix `database.rules.json` + redeploy |
| Auction rate edit doesn't save | `rates` blocked by old/strict rules | deploy the current `database.rules.json` (it validates + allows `rates`) |
| Members see old behavior after deploy | stale GH Pages cache | confirm via footer version; tell them hard-refresh |
| Auction page wiped unexpectedly | daily/weekly reset or manual clear | restore from the pre-action backup |

## Emergency hotfix (production down mid-WoE)

Per `CLAUDE.md`: make the **minimal** fix, run at least `node test/parse-check.js`
(ideally `node test/run.js`), push to `main`, then do the full QA review **after** as a
post-mortem. Don't skip the backup step above if the fix touches data.
