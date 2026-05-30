"use strict";
/**
 * QA gate: syntax-check every inline <script> in index.html.
 * `new Function(src)` throws on any parse error. Exit 1 on failure so this can
 * gate a commit/CI step. Run: node test/parse-check.js
 */
const fs = require("fs");
const path = require("path");
const { extractInlineScript } = require("./harness");

function parseCheck() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const src = extractInlineScript(html);
  // eslint-disable-next-line no-new-func
  new Function(src); // throws SyntaxError if the inline JS is malformed
  return src.length;
}

module.exports = { parseCheck };

if (require.main === module) {
  try {
    const n = parseCheck();
    console.log(`PARSE OK (${n} chars of inline JS)`);
  } catch (e) {
    console.error("PARSE ERROR:", e.message);
    process.exit(1);
  }
}
