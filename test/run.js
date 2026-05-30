"use strict";
/**
 * woe-party test suite — dependency-free.
 *
 * Runs the inline-script parse check, then loads the real app in a vm harness
 * and exercises the auction features end-to-end: the event-day request gate,
 * admin-editable per-person rates, state normalization/migration, the
 * shortage/70-30 math, and the auction-page CHAIN numbering (the thing that
 * must stay correct when rates are edited).
 *
 * Run:  node test/run.js
 * Exit: 0 = all green, 1 = any failure (suitable as a pre-commit gate).
 */
const { loadApp } = require("./harness");
const { parseCheck } = require("./parse-check");

let pass = 0, fail = 0;
const failures = [];
function t(name, fn) {
  try { fn(); pass++; console.log("  ✓ " + name); }
  catch (e) { fail++; failures.push(name); console.log("  ✗ " + name + "\n      " + e.message); }
}
function eq(actual, expected, msg) {
  const A = JSON.stringify(actual), B = JSON.stringify(expected);
  if (A !== B) throw new Error((msg ? msg + " — " : "") + "expected " + B + " but got " + A);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || "expected truthy"); }
function isErr(v, msg) { if (typeof v !== "string" || !v.length) throw new Error((msg || "") + " — expected an error string, got " + JSON.stringify(v)); }
function isNull(v, msg) { if (v !== null) throw new Error((msg || "") + " — expected null (allowed), got " + JSON.stringify(v)); }

// ---- Chain badge parser: pull a member's "หน้า N · ชิ้น a-b" badges from view HTML.
function badgesFor(html, name) {
  const rows = html.split('class="auction-assigned-row"');
  for (const r of rows) {
    if (r.includes(">" + name + "<")) {
      return [...r.matchAll(/aar-page">([^<]*)</g)].map(x => x[1].trim());
    }
  }
  return null;
}

// ---- Scenario setup helpers
function reset(app, members) {
  const s = app.state;
  s.members = members || [];
  s.leaves = {};
  s.auctionGL = app.call("normalizeAuctionState", {}, "gl");
  s.auctionOverrun = app.call("normalizeAuctionState", {}, "overrun");
  app.setSearch("");
  app.setAdmin(true);
  return s;
}
function mkMembers(names) { return names.map(n => ({ id: n, name: n, job: "Knight", cp: 1000 })); }

console.log("\n=== woe-party test suite ===\n");

console.log("[parse]");
t("inline <script> parses cleanly (QA gate)", () => { ok(parseCheck() > 1000, "expected sizable inline JS"); });

const app = loadApp();
t("app boots in harness (functions + state available)", () => {
  ok(app.state && typeof app.state === "object", "no state");
  ok(typeof app.fn("computeAuction") === "function");
  ok(typeof app.fn("buildAuctionView") === "function");
  ok(typeof app.fn("arRequestBlockReason") === "function");
});

console.log("\n[event-day request gate — Feature 1]");
t("isEventDay maps weekdays: Tue/Thu=GL, Sun=Overrun, others=null", () => {
  eq(app.call("isEventDay", "2026-06-02"), "GL", "Tue");
  eq(app.call("isEventDay", "2026-06-04"), "GL", "Thu");
  eq(app.call("isEventDay", "2026-06-07"), "Overrun", "Sun");
  eq(app.call("isEventDay", "2026-06-03"), null, "Wed");
});
t("arGetDateRange returns only today (no advance window)", () => {
  app.setToday("2026-06-02");
  eq(app.call("arGetDateRange"), ["2026-06-02"]);
});
t("gate ALLOWS GL request on a GL day (not on leave)", () => {
  reset(app, mkMembers(["A"]));
  app.setToday("2026-06-02"); // Tue = GL
  isNull(app.call("arRequestBlockReason", "A", "2026-06-02", "gl"), "Tue/GL");
});
t("gate BLOCKS wrong mode on a GL day (Overrun request on Tue)", () => {
  app.setToday("2026-06-02");
  isErr(app.call("arRequestBlockReason", "A", "2026-06-02", "overrun"), "Tue/Overrun");
});
t("gate BLOCKS any request on a non-event day (Wed)", () => {
  app.setToday("2026-06-03"); // Wed = no event
  isErr(app.call("arRequestBlockReason", "A", "2026-06-03", "gl"), "Wed/GL");
  isErr(app.call("arRequestBlockReason", "A", "2026-06-03", "overrun"), "Wed/Overrun");
});
t("gate BLOCKS requesting a future event in advance", () => {
  app.setToday("2026-06-02");
  isErr(app.call("arRequestBlockReason", "A", "2026-06-09", "gl"), "future Tue");
});
t("gate BLOCKS Overrun request on Overrun day if mode mismatched to gl", () => {
  app.setToday("2026-06-07"); // Sun = Overrun
  isNull(app.call("arRequestBlockReason", "A", "2026-06-07", "overrun"), "Sun/Overrun ok");
  isErr(app.call("arRequestBlockReason", "A", "2026-06-07", "gl"), "Sun/GL blocked");
});
t("gate BLOCKS a member on leave for the event day", () => {
  reset(app, mkMembers(["A"]));
  app.setToday("2026-06-02");
  app.state.leaves = { A: { "2026-06-02": true } };
  isErr(app.call("arRequestBlockReason", "A", "2026-06-02", "gl"), "on leave");
});

console.log("\n[editable per-person rates — Feature 2]");
t("getAuctionRates returns defaults when unset", () => {
  reset(app, []);
  eq(app.call("getAuctionRates", "gl"), { card: 1, illusion: 1, white: 3, black: 5 });
  eq(app.call("getAuctionRates", "overrun"), { card: 1, illusion: 1, white: 10, black: 10 });
});
t("getAuctionRates honors live overrides", () => {
  reset(app, []);
  app.state.auctionGL.rates.white = 7;
  eq(app.call("getAuctionRates", "gl").white, 7);
});
t("getAuctionRates falls back for invalid (<1 / NaN) values", () => {
  reset(app, []);
  app.state.auctionGL.rates = { card: 0, illusion: -2, white: "x", black: 5 };
  eq(app.call("getAuctionRates", "gl"), { card: 1, illusion: 1, white: 3, black: 5 });
});
t("setAuctionRate (admin) mutates + clamps to >= 1", () => {
  reset(app, []);
  app.setAdmin(true);
  app.call("setAuctionRate", "gl", "white", "9");
  eq(app.call("getAuctionRates", "gl").white, 9, "set to 9");
  app.call("setAuctionRate", "gl", "white", "0");
  eq(app.call("getAuctionRates", "gl").white, 1, "clamp 0 -> 1");
  app.call("setAuctionRate", "overrun", "black", "12");
  eq(app.call("getAuctionRates", "overrun").black, 12, "overrun too");
});
t("setAuctionRate is admin-gated (viewer cannot change)", () => {
  reset(app, []);
  app.setAdmin(false);
  const before = app.call("getAuctionRates", "overrun").white; // 10
  app.call("setAuctionRate", "overrun", "white", "99");
  eq(app.call("getAuctionRates", "overrun").white, before, "viewer blocked");
});

console.log("\n[state normalization / migration]");
t("normalizeAuctionState backfills rates + buckets on empty obj", () => {
  const o = app.call("normalizeAuctionState", {}, "gl");
  eq(o.rates, { card: 1, illusion: 1, white: 3, black: 5 });
  ok(Array.isArray(o.assignments.main.illusion) && Array.isArray(o.assignments.sub.black));
});
t("normalizeAuctionState repairs bad rate but keeps good ones", () => {
  const o = app.call("normalizeAuctionState", { rates: { card: 0, illusion: 1, white: 7, black: 5 } }, "gl");
  eq(o.rates.card, 1, "card 0 -> default 1");
  eq(o.rates.white, 7, "white kept");
});
t("normalizeAuctionState migrates legacy flat assignments into main", () => {
  const o = app.call("normalizeAuctionState", { assignments: { cards: ["x"], white: ["y"] } }, "gl");
  eq(o.assignments.main.cards, ["x"]);
  eq(o.assignments.main.white, ["y"]);
  eq(o.assignments.sub.cards, []);
});

console.log("\n[auction math — shortage + 70/30 split, live rate]");
t("computeAuction uses the live (edited) rate, not the default", () => {
  reset(app, mkMembers(["p1", "p2", "p3"]));
  app.state.auctionGL.rates.white = 7;
  app.state.auctionGL.assignments.main.white = ["p1", "p2", "p3"];
  const d = app.call("computeAuction", "gl");
  const w = d.items.find(i => i.key === "white");
  eq(w.rate, 7, "item rate");
  eq(w.main.need, 21, "3 ppl x 7");
});
t("GL splits 70/30; status 'พอดี' when mainPool == need", () => {
  reset(app, mkMembers(["p1"]));
  app.state.auctionGL.rates.white = 7;
  app.state.auctionGL.white = 10;          // base 10, bonus 0 -> total 10
  app.state.auctionGL.assignments.main.white = ["p1"];
  const d = app.call("computeAuction", "gl");
  const w = d.items.find(i => i.key === "white");
  eq(w.main.pool, 7, "floor(10*0.7)");
  eq(w.main.need, 7, "1 ppl x 7");
  eq(w.main.diff, 0, "exact");
  eq(w.main.statusCls, "ok", "พอดี");
});
t("Overrun has no sub field (single combined pool)", () => {
  reset(app, mkMembers(["p1"]));
  app.state.auctionOverrun.assignments.main.cards = ["p1"];
  const d = app.call("computeAuction", "overrun");
  eq(d.hasSubField, false);
});

console.log("\n[auction-page CHAIN numbering — the rate↔chain interaction]");
t("GL chain: page rolls over within a bucket (5 ppl, rate 1)", () => {
  reset(app, mkMembers(["c1", "c2", "c3", "c4", "c5"]));
  app.state.auctionGL.assignments.main.cards = ["c1", "c2", "c3", "c4", "c5"];
  const html = app.call("buildAuctionView", "gl");
  eq(badgesFor(html, "c4"), ["หน้า 1 · ชิ้น 4"], "4th on page 1");
  eq(badgesFor(html, "c5"), ["หน้า 2 · ชิ้น 1"], "5th rolls to page 2");
});
t("GL chain: white page anchored to card ITEMS (pool), not card people", () => {
  reset(app, mkMembers(["c1", "c2", "w1"]));
  app.state.auctionGL.rates.white = 7;
  app.state.auctionGL.cards = 2;                              // 2 card ITEMS -> pool offset 2 (main1+sub1)
  app.state.auctionGL.white = 10;                            // white items exist
  app.state.auctionGL.assignments.main.cards = ["c1", "c2"];
  app.state.auctionGL.assignments.main.white = ["w1"];        // white starts at item 3 (after 2 cards)
  const html = app.call("buildAuctionView", "gl");
  eq(badgesFor(html, "c2"), ["หน้า 1 · ชิ้น 2"], "card chain");
  eq(badgesFor(html, "w1"),
     ["หน้า 1 · ชิ้น 3-4", "หน้า 2 · ชิ้น 1-4", "หน้า 3 · ชิ้น 1"],
     "white rate7 from item 3 spanning pages 1-3");
});
t("GL chain: editing the rate CHANGES the chain (regression guard)", () => {
  reset(app, mkMembers(["w1"]));
  app.state.auctionGL.assignments.main.white = ["w1"];
  app.state.auctionGL.rates.white = 3;
  const a = badgesFor(app.call("buildAuctionView", "gl"), "w1");
  eq(a, ["หน้า 1 · ชิ้น 1-3"], "rate 3");
  app.state.auctionGL.rates.white = 7;
  const b = badgesFor(app.call("buildAuctionView", "gl"), "w1");
  eq(b, ["หน้า 1 · ชิ้น 1-4", "หน้า 2 · ชิ้น 1-3"], "rate 7 differs");
});
t("Overrun chain: independent per column with custom rate (4)", () => {
  reset(app, mkMembers(["x1", "x2", "oc1"]));
  app.state.auctionOverrun.rates.white = 4;
  app.state.auctionOverrun.assignments.main.white = ["x1", "x2"];
  app.state.auctionOverrun.assignments.main.cards = ["oc1"];
  const html = app.call("buildAuctionView", "overrun");
  eq(badgesFor(html, "x1"), ["หน้า 1 · ชิ้น 1-4"], "white#1 fills page 1");
  eq(badgesFor(html, "x2"), ["หน้า 2 · ชิ้น 1-4"], "white#2 -> page 2");
  eq(badgesFor(html, "oc1"), ["หน้า 1 · ชิ้น 1"], "cards column resets to page 1");
});
t("chain invariant: slots are 1..4 and total == count*rate", () => {
  reset(app, mkMembers(["a", "b", "c"]));
  app.state.auctionGL.rates.black = 5;
  app.state.auctionGL.assignments.main.black = ["a", "b", "c"];
  const html = app.call("buildAuctionView", "gl");
  let total = 0;
  for (const n of ["a", "b", "c"]) {
    const badges = badgesFor(html, n);
    ok(badges && badges.length, n + " has badges");
    for (const bdg of badges) {
      const mm = bdg.match(/ชิ้น (\d+)(?:-(\d+))?/);
      ok(mm, "badge parses: " + bdg);
      const lo = +mm[1], hi = mm[2] ? +mm[2] : lo;
      ok(lo >= 1 && hi <= 4 && lo <= hi, "slots in 1..4: " + bdg);
      total += (hi - lo + 1);
    }
  }
  eq(total, 15, "3 ppl x rate 5 = 15 slots total");
});

console.log("\n[full simulation: request -> approve -> fill -> rate -> chain]");
t("end-to-end GL flow stays consistent", () => {
  const s = reset(app, mkMembers(["hero"]));
  app.setToday("2026-06-02");            // Tuesday = GL day
  // 1) request is allowed for today's GL event...
  isNull(app.call("arRequestBlockReason", "hero", "2026-06-02", "gl"), "request allowed");
  // ...but not for Overrun, and not in advance
  isErr(app.call("arRequestBlockReason", "hero", "2026-06-02", "overrun"), "wrong mode blocked");
  isErr(app.call("arRequestBlockReason", "hero", "2026-06-09", "gl"), "advance blocked");
  // 2) admin approves -> hero placed in white main bucket
  app.setAdmin(true);
  s.auctionGL.assignments.main.white = ["hero"];
  // 3) admin fills the day's drop (base 10) and 4) sets per-person rate to 7
  s.auctionGL.white = 10;
  app.call("setAuctionRate", "gl", "white", "7");
  // compute: total 10, mainPool 7, need 7 -> exact
  const d = app.call("computeAuction", "gl");
  const w = d.items.find(i => i.key === "white");
  eq(w.main.diff, 0, "exact allocation");
  // 5) chain page numbering for hero with the edited rate
  const badges = badgesFor(app.call("buildAuctionView", "gl"), "hero");
  eq(badges, ["หน้า 1 · ชิ้น 1-4", "หน้า 2 · ชิ้น 1-3"], "rate-7 chain across 2 pages");
});

console.log("\n[auction page-map — supply-based real auction pages]");
function pageMapOf(kind) { return app.call("computeAuction", kind).pageMap; }
function typeRange(pm, key) { const t = pm.perType.find(x => x.key === key); return t ? [t.startPage, t.endPage] : null; }

t("GL worked example: cards5 illu2 white10 black10 → per-type pages + total", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 2, white: 10, black: 10, bonusPercent: 0 });
  const pm = pageMapOf("gl");
  eq(typeRange(pm, "cards"), [1, 2], "cards p1-2");
  eq(typeRange(pm, "illusion"), [2, 2], "illu p2");
  eq(typeRange(pm, "white"), [2, 5], "white p2-5");
  eq(typeRange(pm, "black"), [5, 7], "black p5-7");
  eq(pm.totalItems, 27, "total items");
  eq(pm.totalPages, 7, "total pages");
});
t("GL invariant: max endPage === ceil(totalItems/4) (no gap/double-count)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 2, white: 10, black: 10, bonusPercent: 0 });
  const d = app.call("computeAuction", "gl");
  let maxEnd = 0;
  d.items.forEach(it => {
    if (it.main.page.endPage) maxEnd = Math.max(maxEnd, it.main.page.endPage);
    if (it.sub.page.endPage)  maxEnd = Math.max(maxEnd, it.sub.page.endPage);
  });
  eq(maxEnd, d.pageMap.totalPages, "max endPage == totalPages");
});
t("GL 70/30 boundary: sub continues main's partial page (white=10)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0, bonusPercent: 0 });
  const w = app.call("computeAuction", "gl").items.find(i => i.key === "white");
  eq([w.main.page.startPage, w.main.page.endPage], [1, 2], "main 7 items → pages 1-2");
  eq([w.sub.page.startPage, w.sub.page.endPage], [2, 3], "sub 3 items → pages 2-3");
  eq(w.sub.page.startPage, w.main.page.endPage, "sub continues main's last page");
  eq(w.sub.page.startSlot, 4, "sub starts page2 slot4");
});
t("GL 70/30 exact-fill: main fills a page → sub starts fresh (white=6)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 6, black: 0, bonusPercent: 0 });
  const w = app.call("computeAuction", "gl").items.find(i => i.key === "white");
  eq([w.main.page.startPage, w.main.page.endPage], [1, 1], "main 4 → page 1");
  eq(w.sub.page.startPage, w.main.page.endPage + 1, "sub starts fresh page 2");
  eq(w.sub.page.startSlot, 1, "sub at slot 1");
});
t("Overrun: each item type independent, starts page 1", () => {
  reset(app, []);
  Object.assign(app.state.auctionOverrun, { cards: 5, illusion: 0, white: 10, black: 0 });
  const pm = pageMapOf("overrun");
  eq(typeRange(pm, "cards"), [1, 2], "cards p1-2");
  eq(typeRange(pm, "white"), [1, 3], "white independent p1-3");
});
t("page-map is RATE-INDEPENDENT (editing rate doesn't move pages)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0, bonusPercent: 0 });
  const before = JSON.stringify(pageMapOf("gl").perType.find(t => t.key === "white"));
  app.state.auctionGL.rates.white = 7;
  const after = JSON.stringify(pageMapOf("gl").perType.find(t => t.key === "white"));
  eq(after, before, "white page range unchanged by rate edit");
});
t("page-map: zero-item type skipped; all-zero → 0 pages", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 8, black: 0, bonusPercent: 0 });
  const pm = pageMapOf("gl");
  eq(typeRange(pm, "cards"), [null, null], "no cards → null range");
  eq(typeRange(pm, "white"), [1, 2], "white at page 1 (cards contribute 0 offset)");
  reset(app, []);
  eq(pageMapOf("gl").totalPages, 0, "all-zero → 0 pages");
});
t("badge re-anchor: white person shows real page with cards column empty of people", () => {
  reset(app, mkMembers(["w1"]));
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 0, white: 10, black: 0, bonusPercent: 0 });
  app.state.auctionGL.assignments.main.white = ["w1"]; // cards has 5 ITEMS but no people
  const html = app.call("buildAuctionView", "gl");
  eq(badgesFor(html, "w1"), ["หน้า 2 · ชิ้น 2-4"], "anchored after 5 card items (cards column empty)");
});

console.log("\n[version stamp]");
t("APP_VERSION exists and is calendar-versioned YYYY.MM.DD", () => {
  ok(typeof app.appVersion === "string", "APP_VERSION should be a string");
  ok(/^\d{4}\.\d{2}\.\d{2}$/.test(app.appVersion), "format, got " + JSON.stringify(app.appVersion));
});
t("buildVersionStamp() returns v<APP_VERSION>", () => {
  eq(app.call("buildVersionStamp"), "v" + app.appVersion);
});

console.log("\n=== " + pass + " passed, " + fail + " failed ===\n");
if (fail) { console.log("FAILURES:\n  - " + failures.join("\n  - ") + "\n"); process.exit(1); }
