---
name: woe-qa
description: Run the mandatory pre-deploy QA gate for the woe-party repo before any commit/push to index.html. Use right after finishing a code change and before committing, or whenever the user says "QA", "ตรวจก่อนขึ้น", "pre-deploy check", "พร้อม push ยัง". Runs the dependency-free test suite (parse check + behavior + simulation), then drives the /code-review and (when relevant) /security-review gates, and ends with a smoke-test checklist. Enforces CLAUDE.md's "no commit if tests fail / no merge without QA" rules.
---

# woe-party pre-deploy QA gate

The mandatory checks from `CLAUDE.md` §"🛡️ QA review เป็นข้อบังคับ", in order.
Stop at the first hard failure — do **not** commit/push past a red gate.

## 0. Scope the change first

`git -C <repo> status` + `git -C <repo> diff --stat`. Decide the change class:

- **Doc-only** (`.md`, comments) → skip step 1's behavior suite (still eyeball
  the diff); steps 2–4 optional.
- **Behavior change** (any JS in `index.html`) → all steps; step 1 MUST pass.
- **Touches auth / Firebase rules / user-input→HTML / localStorage / URL/
  sharing** → step 3 is REQUIRED, not optional.
- **Revert / emergency hotfix** → see CLAUDE.md special cases (QA after).

## 1. Automated tests (hard gate)

```bash
node test/run.js
```

- Exit 0 + "N passed, 0 failed" → proceed.
- Exit 1 → **STOP.** Read the `✗` lines. If it's a real app bug, fix
  `index.html` and re-run. If it's a harness stub gap (a browser API the
  sandbox doesn't implement), fix `test/harness.js` — never weaken a test to
  make it pass.
- Behavior changed but no test covers it? Add one to `test/run.js` now. The
  suite is the contract; an untested behavior change is an incomplete change.

(`node test/parse-check.js` runs only the inline-script syntax check, if you
need the fast subset.)

## 2. Code review (hard gate for bugs)

Invoke `/code-review`:
- effort **high** for bug fixes, **medium+** for cleanups.
- Any **correctness** finding → fix before commit.
- Cleanup/simplification findings → decide with the user (fix now vs TODO).

## 3. Security review (conditional, required when in scope)

If the change touches Firebase Rules/Auth/Permissions, user-provided input
rendered as HTML, localStorage/sessionStorage, or URL params/sharing →
invoke `/security-review` and resolve findings before commit.

Also flag any data-shape change that the Firebase RTDB rules might reject
(e.g. a new key like `rates` under `/auction_*`) — the frontend `isAdmin()`
gate is UX only; the rules are the real boundary.

## 4. Manual smoke checklist (hand to the user)

Give a short golden-path + 1 edge case the user can click through, e.g.:
- golden: open the changed page as admin → do the main action → reload, state persists.
- edge: the locked/empty/viewer case (non-event day, no members, viewer mode).

## 5. Commit on a feature branch

Only after 1–4 pass: commit on a feature branch (never `main`), then ask the
user before the fast-forward merge + push (branch policy in `CLAUDE.md`).
Use a clear message; co-author trailer per repo convention.

## Output

Report each gate's result explicitly (✅/❌ + numbers). If you skipped a gate,
say which and why. Never report "ready to deploy" unless step 1 is green and
steps 2–3 (as scoped) passed.
