# Tests — woe-party

Dependency-free. No npm install, no framework, no build. Just Node (v18+).

```bash
node test/run.js          # parse check + behavior + simulation suite
node test/parse-check.js  # just the inline-script syntax check
# or, equivalently:
npm test
```

Exit code `0` = all green, `1` = at least one failure (use as a pre-commit /
CI gate). This is **step 1 of the mandatory QA gate** in `../CLAUDE.md`.

## What's here

| File | Purpose |
|---|---|
| `harness.js` | Loads the real inline `<script>` from `../index.html` into a Node `vm` context with light DOM / Firebase / localStorage stubs, and exposes the app's functions + live `state` for assertions. |
| `parse-check.js` | `new Function(src)` over the concatenated inline scripts — fails on any syntax error. |
| `run.js` | The suite: a tiny `t()/eq()/ok()` runner plus all the tests. |

## How the harness works

The app is one HTML file of vanilla JS. The harness extracts every non-`src`
`<script>`, injects a small export shim right before the boot `load();` line
(so `let state` / `const`s are bridged out even though they're lexically
scoped and the boot tail may throw on an un-stubbed DOM call), and runs it in
a `vm` context. Function declarations leak onto the context global, so tests
call them directly:

```js
const app = loadApp();
app.setAdmin(true);              // override isAdmin()
app.setToday("2026-06-02");      // override todayBkkISO() (Tue = GL day)
const d = app.call("computeAuction", "gl");
```

`app.state` is the live state object; mutate it to set up a scenario, then call
a render/compute function and assert on the result.

## Coverage

- **Event-day request gate** — only today, only that day's event (GL ↔
  อังคาร/พฤหัส, Overrun ↔ อาทิตย์), leave + advance-request blocking.
- **Editable per-person rates** — defaults, live override, invalid→fallback,
  admin clamp ≥1, viewer admin-guard.
- **State normalization / migration** — rates backfill, legacy flat→main.
- **Auction math** — live rate in `computeAuction`, 70/30 split, shortage.
- **Auction-page chain numbering** — GL cross-bucket chain, Overrun per-column
  reset, page splitting, and the rate↔chain regression guard.
- **End-to-end simulation** — request → approve → fill → set rate → chain.

## Adding tests

Add a `t("name", () => { ... })` in the relevant section of `run.js`. Use the
scenario helpers (`reset`, `mkMembers`) and `badgesFor(html, name)` to read the
"หน้า N · ชิ้น a-b" page badges out of rendered auction HTML. If a test needs a
browser API the sandbox lacks, extend the stub in `harness.js` — don't weaken
the test.

> Per `../CLAUDE.md`: a behavior change without a matching test is an
> incomplete change. Run this suite before every commit.
