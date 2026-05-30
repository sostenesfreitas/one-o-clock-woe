const cp = require("child_process");
const fs = require("fs");
const R = __dirname;
function sh(cmd) {
  try { return { ok: true, out: cp.execSync(cmd, { cwd: R, encoding: "utf8" }).trim() }; }
  catch (e) { return { ok: false, out: ((e.stdout||"") + (e.stderr||"") + e.message).trim() }; }
}
const log = [];

// HARD GATE — tests must be green before commit/merge/push.
const gate = sh("node test/run.js");
const m = gate.out.match(/=== (\d+) passed, (\d+) failed ===/) || [];
log.push("GATE: " + (m[0] || "NO SUMMARY") + " exit=" + (gate.ok ? 0 : 1));
if (!gate.ok || m[2] !== "0") { log.push("ABORT — tests not green; nothing shipped."); fs.writeFileSync(R+"/_ship.log", log.join("\n")); process.exit(1); }
const pc = sh("node test/parse-check.js");
log.push("parse: " + (pc.ok ? "OK" : "FAIL " + pc.out));
if (!pc.ok) { log.push("ABORT — parse failed."); fs.writeFileSync(R+"/_ship.log", log.join("\n")); process.exit(1); }

// Current branch already holds app.html + run.js fixes (committed? check)
log.push("branch: " + sh("git branch --show-current").out);
log.push("status-before-commit: " + JSON.stringify(sh("git status --porcelain").out.split("\n").filter(Boolean)));

const msg = [
 "Landing fixes: app.html version .4, de-dupe + green landing tests, re-quantize logo",
 "",
 "Follow-up to 72b0cb5 (which shipped with silent failures). Now all real + gated:",
 "- app.html APP_VERSION -> 2026.05.30.4 (matches landing footer + CHANGELOG).",
 "- test/run.js: single clean [landing] group + a VERSION COUPLING test asserting",
 "  app.html == landing == top CHANGELOG, so version drift can't ship silently again.",
 "- assets/one-o-clock.png re-quantized 602KB -> 238KB (256-color, visually lossless)",
 "  so it passes the <500KB landing test.",
 "Suite 47/0 green, parse OK (gated by this script before push).",
 "",
 "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>",
].join("\n");
fs.writeFileSync(R + "/_msg.txt", msg);

sh("git add -A");
log.push("commit: " + sh('git commit -F "' + R + '/_msg.txt"').out.split("\n")[0]);
log.push("switch main: " + sh("git switch main").out.split("\n").pop());
log.push("ff-merge: " + sh("git merge --ff-only claude/fix-version-coupling").out.split("\n").pop());
const push = sh("git push origin main");
log.push("push: " + (push.ok ? push.out.split("\n").pop() : "FAIL " + push.out));
log.push("del-branch: " + sh("git branch -d claude/fix-version-coupling").out);
sh("git fetch origin");
log.push("sync(main...origin): " + sh("git rev-list --left-right --count main...origin/main").out);
log.push("HEAD: " + sh("git log --oneline -1").out);
log.push("clean: [" + sh("git status --porcelain").out + "]");
fs.unlinkSync(R + "/_msg.txt");
fs.writeFileSync(R + "/_ship.log", log.join("\n"));
