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
  app.state.auctionGL.white = 10;          // entered count IS the total
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
t("GL chain: white packs continuously right after cards (same page)", () => {
  reset(app, mkMembers(["c1", "c2", "w1"]));
  app.state.auctionGL.rates.white = 7;
  app.state.auctionGL.cards = 2;                              // cards = page 1 slots 1-2
  app.state.auctionGL.white = 10;                            // white continues page 1 slot 3 (NOT a fresh page)
  app.state.auctionGL.assignments.main.cards = ["c1", "c2"];
  app.state.auctionGL.assignments.main.white = ["w1"];
  const html = app.call("buildAuctionView", "gl");
  eq(badgesFor(html, "c2"), ["หน้า 1 · ชิ้น 2"], "card chain");
  eq(badgesFor(html, "w1"),
     ["หน้า 1 · ชิ้น 3-4", "หน้า 2 · ชิ้น 1-4", "หน้า 3 · ชิ้น 1"],
     "white rate7 starts page 1 slot 3 (continuous after cards), spans pages 1-3");
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
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 2, white: 10, black: 10 });
  const pm = pageMapOf("gl");
  // Items pack CONTINUOUSLY (no fresh page per type): cards 5 → p1-2; illu 2
  // continues p2; white 10 continues p2-5; black 10 continues p5-7. No gaps.
  eq(typeRange(pm, "cards"), [1, 2], "cards p1-2");
  eq(typeRange(pm, "illusion"), [2, 2], "illu continues page 2");
  eq(typeRange(pm, "white"), [2, 5], "white continues p2-5");
  eq(typeRange(pm, "black"), [5, 7], "black continues p5-7");
  eq(pm.totalItems, 27, "total items");
  eq(pm.totalPages, 7, "total pages = last page used (continuous, no gaps)");
});
t("GL invariant: totalPages === max endPage across all buckets", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 2, white: 10, black: 10 });
  const d = app.call("computeAuction", "gl");
  let maxEnd = 0;
  d.items.forEach(it => {
    if (it.main.page.endPage) maxEnd = Math.max(maxEnd, it.main.page.endPage);
    if (it.sub.page.endPage)  maxEnd = Math.max(maxEnd, it.sub.page.endPage);
  });
  eq(maxEnd, d.pageMap.totalPages, "max endPage == totalPages");
});
t("GL items pack continuously — next type shares the same page (no fresh-page gap)", () => {
  reset(app, []);
  // cards 2 → page 1 slots 1-2; illu 2 must continue on page 1 slots 3-4 (same page),
  // NOT jump to a fresh page 2. (split 100 so each type is main-only for a clean check.)
  Object.assign(app.state.auctionGL, { cards: 2, illusion: 2, white: 0, black: 0, splitMainPercent: 100 });
  const d = app.call("computeAuction", "gl");
  const cards = d.items.find(i => i.key === "cards"), illu = d.items.find(i => i.key === "illusion");
  eq([cards.main.page.startPage, cards.main.page.endPage], [1, 1], "cards 2 → page 1");
  eq([illu.main.page.startPage, illu.main.page.startSlot], [1, 3], "illu continues page 1 slot 3 (no gap)");
});
t("GL 70/30 boundary: sub continues main's partial page (white=10)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0 });
  const w = app.call("computeAuction", "gl").items.find(i => i.key === "white");
  eq([w.main.page.startPage, w.main.page.endPage], [1, 2], "main 7 items → pages 1-2");
  eq([w.sub.page.startPage, w.sub.page.endPage], [2, 3], "sub 3 items → pages 2-3");
  eq(w.sub.page.startPage, w.main.page.endPage, "sub continues main's last page");
  eq(w.sub.page.startSlot, 4, "sub starts page2 slot4");
});
t("GL split @70 ceil-to-main: white=6 → main 5 (p1-2) / sub 1 (p2)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 6, black: 0 });
  const w = app.call("computeAuction", "gl").items.find(i => i.key === "white");
  eq([w.main.pool, w.sub.pool], [5, 1], "6 @70 → main 5 / sub 1 (remainder to main)");
  eq([w.main.page.startPage, w.main.page.endPage], [1, 2], "main 5 → pages 1-2");
  eq([w.sub.page.startPage, w.sub.page.startSlot], [2, 2], "sub continues page 2 slot 2");
});
t("Overrun: items pack continuously across types (no fresh page per type)", () => {
  reset(app, []);
  Object.assign(app.state.auctionOverrun, { cards: 5, illusion: 0, white: 10, black: 0 });
  const pm = pageMapOf("overrun");
  // cards 5 → p1 s1-4, p2 s1; white continues p2 s2 → p4 (zero-item illusion skipped).
  eq(typeRange(pm, "cards"), [1, 2], "cards p1-2");
  eq(typeRange(pm, "white"), [2, 4], "white continues page 2 (right after cards, not a fresh page)");
});
t("page-map is RATE-INDEPENDENT (editing rate doesn't move pages)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0 });
  const before = JSON.stringify(pageMapOf("gl").perType.find(t => t.key === "white"));
  app.state.auctionGL.rates.white = 7;
  const after = JSON.stringify(pageMapOf("gl").perType.find(t => t.key === "white"));
  eq(after, before, "white page range unchanged by rate edit");
});
t("page-map: zero-item type skipped (no page consumed); all-zero → 0 pages", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 8, black: 0 });
  const pm = pageMapOf("gl");
  eq(typeRange(pm, "cards"), [null, null], "no cards → null range");
  eq(typeRange(pm, "white"), [1, 2], "white at page 1 (empty earlier types consume no page)");
  reset(app, []);
  eq(pageMapOf("gl").totalPages, 0, "all-zero → 0 pages");
});
t("badge re-anchor: white person shows real page with cards column empty of people", () => {
  reset(app, mkMembers(["w1"]));
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 0, white: 10, black: 0 });
  app.state.auctionGL.assignments.main.white = ["w1"]; // cards has 5 ITEMS but no people
  const html = app.call("buildAuctionView", "gl");
  // cards 5 (main 4 + sub 1) consume cursor 1-5 → white main starts page 2 slot 2,
  // anchored to the real pool position even though the cards column has no people.
  eq(badgesFor(html, "w1"), ["หน้า 2 · ชิ้น 2-4"], "white anchored to real pool page (p2 s2) regardless of card people");
});

console.log("\n[auction column coverage — fill progress vs pool pages]");
function coveragesOf(html) { return [...html.matchAll(/ac-coverage [^"]*">([^<]+)</g)].map(m => m[1].trim()); }
t("under-filled column shows pages covered + items/pages remaining", () => {
  reset(app, mkMembers(["w1"]));
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0 });
  app.state.auctionGL.assignments.main.white = ["w1"]; // rate 3 → need 3 of pool 7
  const cov = coveragesOf(app.call("buildAuctionView", "gl"));
  eq(cov[0], "👥 ลากถึงหน้า 1 · ขาดอีก 4 ชิ้น (1 หน้า)", "white main under-filled");
  eq(cov[1], "ยังไม่ลากใคร — ต้องครอบ 3 ชิ้น", "white sub untouched");
});
t("exactly-filled column shows ครบ", () => {
  reset(app, mkMembers(["w1"]));
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0 });
  app.state.auctionGL.rates.white = 7;                 // need 7 == pool 7
  app.state.auctionGL.assignments.main.white = ["w1"];
  eq(coveragesOf(app.call("buildAuctionView", "gl"))[0], "✅ ลากครบทุกหน้าแล้ว", "exact");
});
t("over-filled column shows เกิน", () => {
  reset(app, mkMembers(["w1", "w2"]));
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 10, black: 0 });
  app.state.auctionGL.rates.white = 7;                 // 2 ppl × 7 = 14 > pool 7
  app.state.auctionGL.assignments.main.white = ["w1", "w2"];
  eq(coveragesOf(app.call("buildAuctionView", "gl"))[0], "✅ ครบแล้ว · เกินมา 7 ชิ้น", "over by 7");
});

console.log("\n[auction main/sub split % — editable GL split]");
function glPools(key) {
  const d = app.call("computeAuction", "gl");
  const it = d.items.find(i => i.key === key);
  return { total: it.total, main: it.main.pool, sub: it.sub.pool, split: d.splitMainPercent };
}
function setSplit(p) { app.state.auctionGL.splitMainPercent = p; }
t("default split is 70 (getter + computeAuction)", () => {
  reset(app, []);
  eq(app.call("getAuctionSplitPercent", "gl"), 70, "getter default");
  eq(app.call("getAuctionSplitPercent", "overrun"), 100, "overrun = no split");
  Object.assign(app.state.auctionGL, { white: 10 });
  eq(glPools("white"), { total: 10, main: 7, sub: 3, split: 70 }, "white10 @70");
});
t("uneven split: remainder goes to สนามหลัก (ceil)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { white: 5 });
  eq(glPools("white"), { total: 5, main: 4, sub: 1, split: 70 }, "5 @70 → main 4 / sub 1");
  Object.assign(app.state.auctionGL, { white: 6 });
  eq(glPools("white"), { total: 6, main: 5, sub: 1, split: 70 }, "6 @70 → main 5 / sub 1");
});
t("changing the split % moves main/sub pools", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { white: 5 });
  setSplit(60); eq(glPools("white"), { total: 5, main: 3, sub: 2, split: 60 }, "5 @60 → 3/2");
  setSplit(100); Object.assign(app.state.auctionGL, { white: 10 });
  eq(glPools("white"), { total: 10, main: 10, sub: 0, split: 100 }, "100% → all main");
  setSplit(0); eq(glPools("white"), { total: 10, main: 0, sub: 10, split: 0 }, "0% → all sub");
});
t("setAuctionSplitPercent: admin-gated + clamps 0..100", () => {
  reset(app, []);
  app.setAdmin(true);
  app.call("setAuctionSplitPercent", "gl", "250"); eq(app.call("getAuctionSplitPercent", "gl"), 100, "clamp 250→100");
  app.call("setAuctionSplitPercent", "gl", "-5");  eq(app.call("getAuctionSplitPercent", "gl"), 0, "clamp -5→0");
  app.call("setAuctionSplitPercent", "gl", "60");  eq(app.call("getAuctionSplitPercent", "gl"), 60, "set 60");
  app.setAdmin(false);
  app.call("setAuctionSplitPercent", "gl", "20");  eq(app.call("getAuctionSplitPercent", "gl"), 60, "viewer cannot change");
  app.setAdmin(true);
});
t("normalize backfills split (missing/invalid → 70)", () => {
  eq(app.call("normalizeAuctionState", {}, "gl").splitMainPercent, 70, "missing → 70");
  eq(app.call("normalizeAuctionState", { splitMainPercent: 999 }, "gl").splitMainPercent, 70, "invalid → 70");
  eq(app.call("normalizeAuctionState", { splitMainPercent: 55 }, "gl").splitMainPercent, 55, "valid kept");
});
t("split is independent of per-person rate", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { white: 5 });
  const before = JSON.stringify(glPools("white"));
  app.state.auctionGL.rates.white = 7;
  eq(JSON.stringify(glPools("white")), before, "rate edit doesn't move the split");
});
t("Overrun ignores the split (no sub field)", () => {
  reset(app, []);
  Object.assign(app.state.auctionOverrun, { white: 10 });
  const d = app.call("computeAuction", "overrun");
  const w = d.items.find(i => i.key === "white");
  eq([w.main.pool, w.sub.pool, d.hasSubField], [10, 0, false], "overrun white10 → all main, no sub");
});
t("page ranges stay split-invariant at 70% (worked example)", () => {
  reset(app, []);
  Object.assign(app.state.auctionGL, { cards: 5, illusion: 2, white: 10, black: 10 });
  const pm = pageMapOf("gl");
  eq(pm.perType.map(x => [x.key, x.startPage, x.endPage]),
     [["cards",1,2],["illusion",2,2],["white",2,5],["black",5,7]], "per-type pages (continuous packing)");
  eq(pm.totalPages, 7, "total pages (continuous, no per-type gaps)");
});
t("GL view renders the editable split control + dynamic field labels", () => {
  reset(app, []);
  app.setAdmin(true);
  app.state.auctionGL.splitMainPercent = 60;
  const html = app.call("buildAuctionView", "gl");
  ok(html.includes('data-auction-split-kind="gl"'), "split input present for admin");
  ok(html.includes("สนามหลัก (60%)"), "main header shows 60%");
  ok(html.includes("สนามรอง (40%)"), "sub header shows 40%");
  const or = app.call("buildAuctionView", "overrun");
  ok(!or.includes('data-auction-split-kind'), "Overrun has no split control");
});

console.log("\n[admin allocate gating — buttons follow the day's event]");
// The admin "จัดสรรอัตโนมัติ" (arBulkApprove) buttons must match the day's event:
// GL day → only the gl button; Overrun day → only overrun; non-event day → neither.
// Match by ASCII onclick (Thai-proof). "ล้างวันที่ผ่านมา" (arAutoClearPast) always stays.
function adminQueueHtml(isoDate) {
  app.setAdmin(true);
  app.setToday(isoDate);
  return app.call("buildAuctionRequestHtml");
}
const glBtn = /onclick="arBulkApprove\('[^']*','gl'\)"/;
const orBtn = /onclick="arBulkApprove\('[^']*','overrun'\)"/;
t("GL day (Tue): only the GL allocate button renders", () => {
  reset(app, []);
  const h = adminQueueHtml("2026-06-02"); // Tuesday
  ok(glBtn.test(h), "gl allocate button present");
  ok(!orBtn.test(h), "overrun allocate button absent");
  ok(h.includes("arAutoClearPast()"), "clear-old button stays");
});
t("Overrun day (Sun): only the Overrun allocate button renders", () => {
  reset(app, []);
  const h = adminQueueHtml("2026-06-07"); // Sunday
  ok(orBtn.test(h), "overrun allocate button present");
  ok(!glBtn.test(h), "gl allocate button absent");
  ok(h.includes("arAutoClearPast()"), "clear-old button stays");
});
t("Non-event day (Wed): neither allocate button; clear-old stays", () => {
  reset(app, []);
  const h = adminQueueHtml("2026-06-03"); // Wednesday
  ok(!glBtn.test(h), "no gl allocate button");
  ok(!orBtn.test(h), "no overrun allocate button");
  ok(h.includes("arAutoClearPast()"), "clear-old button still present");
});

console.log("\n[reject history — same-day, with re-approve]");
// Rejected requests stay visible in the admin queue for the rest of the day (so
// admins see who was turned down and can re-approve a mistake). They're cleared
// together with the whole date by arClearDay (same-day scope). Seed state.auctionRequests
// directly and assert via arBuildAdminQueue; match by ASCII onclick (Thai-proof).
function seedReq(date) {
  app.setAdmin(true);
  app.setToday(date);
  reset(app, mkMembers(["m1", "m2", "m3"]));
  app.state.auctionRequests = { [date]: { gl: {
    r_rej: { id: "r_rej", memberId: "m1", memberName: "m1", items: ["white"], status: "rejected", rejectReason: "on leave", computedField: "main", requestedAt: 1 },
    r_app: { id: "r_app", memberId: "m2", memberName: "m2", items: ["cards"], status: "approved", computedField: "main", requestedAt: 2 },
    r_pen: { id: "r_pen", memberId: "m3", memberName: "m3", items: ["black"], status: "pending", computedField: "main", requestedAt: 3 },
  } } };
}
t("rejected request stays in the admin queue (same-day history)", () => {
  const date = "2026-06-02"; // Tue = GL
  seedReq(date);
  const h = app.call("arBuildAdminQueue", date, "gl");
  ok(h.includes("ar-section-rejected"), "rejected section rendered");
  ok(/onclick="arApproveRequest\('2026-06-02','gl','r_rej'\)"/.test(h), "rejected row offers re-approve");
  ok(h.includes("on leave"), "reject reason shown");
});
t("arGetRequests exposes rejected; pending/approved still present", () => {
  const date = "2026-06-02";
  seedReq(date);
  const byStatus = s => app.call("arGetRequests", date, "gl").filter(r => r.status === s).length;
  eq([byStatus("pending"), byStatus("approved"), byStatus("rejected")], [1, 1, 1], "one of each status");
});
t("clearing the day removes rejected history too (same-day scope)", () => {
  const date = "2026-06-02";
  seedReq(date);
  // arClearDay confirms + writes to Firebase (stubbed). Simulate the daily-scope
  // clear the same way the cron path does: drop the whole date node.
  delete app.state.auctionRequests[date];
  eq(app.call("arGetRequests", date, "gl").length, 0, "no requests of any status remain after day clear");
});

console.log("\n[one item per person per event — request limit]");
// Rule: a member may hold only ONE active (pending|approved) request per event
// (date+mode). Rejected/withdrawn don't count, so they can ask again after a no.
// arActiveRequestFor is the single source of truth (pure over state.auctionRequests).
function seedAR(gl) { app.state.auctionRequests = { "2026-06-02": { gl } }; }
const activeFor = (mid, mode) => app.call("arActiveRequestFor", mid, "2026-06-02", mode || "gl");
t("no request → no active (member may request)", () => {
  seedAR({});
  isNull(activeFor("m1"), "nothing active");
});
t("a pending request blocks (counts as active)", () => {
  seedAR({ r1: { id: "r1", memberId: "m1", items: ["white"], status: "pending", requestedAt: 1 } });
  ok(activeFor("m1") && activeFor("m1").id === "r1", "pending is active");
});
t("an approved request blocks (counts as active)", () => {
  seedAR({ r2: { id: "r2", memberId: "m1", items: ["cards"], status: "approved", requestedAt: 1 } });
  ok(activeFor("m1") && activeFor("m1").id === "r2", "approved is active");
});
t("rejected/withdrawn do NOT block (member may ask again)", () => {
  seedAR({ r3: { id: "r3", memberId: "m1", items: ["black"], status: "rejected", requestedAt: 1 } });
  isNull(activeFor("m1"), "rejected is not active");
  seedAR({ r4: { id: "r4", memberId: "m1", items: ["white"], status: "withdrawn", requestedAt: 1 } });
  isNull(activeFor("m1"), "withdrawn is not active");
});
t("another member's request doesn't block me; rule is mode-scoped", () => {
  seedAR({ r5: { id: "r5", memberId: "m2", items: ["white"], status: "pending", requestedAt: 1 } });
  isNull(activeFor("m1"), "other member's request is not mine");
  // a GL-active request must not register as Overrun-active
  app.state.auctionRequests = { "2026-06-02": { gl: { rg: { id: "rg", memberId: "m1", items: ["white"], status: "pending", requestedAt: 1 } } } };
  ok(activeFor("m1", "gl"), "active in gl");
  isNull(activeFor("m1", "overrun"), "not active in overrun (per-mode)");
});
t("request modal is single-select (radio), not multi-tick", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
  const m = /function arToggleModalItem\(item\)\s*\{[\s\S]*?\n\}/.exec(src);
  ok(m, "arToggleModalItem found");
  ok(/new Set\(\[item\]\)/.test(m[0]), "toggle replaces selection (single-select)");
  ok(!/\.items\.add\(/.test(m[0]), "toggle must NOT add to a multi-select set");
});

console.log("\n[css coverage — themed controls have their CSS]");
(function () {
  const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
  // Guard against "markup shipped but CSS missing" — e.g. the split % input rendering
  // as a plain white box because its CSS edit silently failed. If a themed class is in
  // the markup, it MUST have a matching CSS rule.
  const pairs = [
    ["auction-split-input",   /class="auction-split-input"/,   /\.auction-split-input\s*\{/],
    ["auction-split-row",     /class="auction-split-row"/,     /\.auction-split-row\s*\{/],
    ["auction-split-note",    /class="auction-split-note"/,    /\.auction-split-note\s*\{/],
    ["ac-pagemap",            /class="ac-pagemap/,             /\.ac-pagemap\s*\{/],
    ["ac-coverage",           /class="ac-coverage/,            /\.ac-coverage\s*\{/],
    ["auction-pagemap-strip", /class="auction-pagemap-strip/,  /\.auction-pagemap-strip\s*\{/],
    ["ar-section-rejected",   /class="ar-section ar-section-rejected"/, /\.ar-section-rejected\s*\{/],
    // Range circles: classes are set via setAttribute("class","rc-…") on SVG nodes,
    // so the "used" probe matches the JS string literal form, not class="…".
    ["rc-ring",   /"rc-ring"/,        /\.rc-ring\s*\{/],
    ["rc-handle", /"rc-handle move"/, /\.rc-handle\s*\{/],
    ["map-filter-chip", /"map-filter-chip/, /\.map-filter-chip\s*\{/],
  ];
  pairs.forEach(function (p) {
    t("CSS exists for ." + p[0] + " (used in markup)", function () {
      if (p[1].test(appHtml)) ok(p[2].test(appHtml), "." + p[0] + " is in markup but has no CSS rule");
    });
  });
})();

console.log("\n[search box scroll-jump guard]");
(function () {
  const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
  const m = /function auctionSearchInput\(v\) \{[\s\S]*?\n\}\r?\n/.exec(appHtml);
  t("auctionSearchInput exists", function () { ok(m, "function not found"); });
  t("search restores scroll/focus SYNCHRONOUSLY (no setTimeout — prevents the jump)", function () {
    ok(m && !/setTimeout\s*\(/.test(m[0]), "auctionSearchInput must not defer the restore in a setTimeout() call");
    ok(m && /window\.scrollTo\(scrollX, scrollY\)/.test(m[0]), "must restore scroll synchronously");
  });
  // The sidebar member search (#searchInput → renderMembers) re-renders #memberList,
  // which is its OWN scroll container (.member-list overflow-y:auto). Reassigning
  // innerHTML resets that container's scrollTop to 0 → the list jumped to the top
  // while typing. renderMembers must capture scrollTop before and restore it after.
  const rm = /function renderMembers\(\)\s*\{[\s\S]*?\n\}/.exec(appHtml);
  t("renderMembers exists", function () { ok(rm, "function not found"); });
  t("member search preserves the list scroll (no jump to top while typing)", function () {
    ok(rm && /list\.scrollTop/.test(rm[0]), "renderMembers must read list.scrollTop");
    ok(rm && /const _mlScrollTop = list \? list\.scrollTop : 0;/.test(rm[0]), "must capture scrollTop before re-render");
    ok(rm && /if \(list\) list\.scrollTop = _mlScrollTop;/.test(rm[0]), "must restore scrollTop after re-render");
    // capture must come before the innerHTML reassignment, restore after it
    const cap = rm[0].indexOf("_mlScrollTop = list ?");
    const set = rm[0].indexOf("list.innerHTML");
    const res = rm[0].lastIndexOf("list.scrollTop = _mlScrollTop");
    ok(cap >= 0 && set >= 0 && res >= 0 && cap < set && set < res, "order: capture → innerHTML → restore");
  });
})();

console.log("\n[per-column page chip — slot range]");
t("partial page shows slot range, not the whole page", function () {
  reset(app, mkMembers(["m1", "m2"]));
  Object.assign(app.state.auctionOverrun, { cards: 20, illusion: 2, white: 0, black: 0 });
  (function () { var A = app.state.auctionOverrun.assignments; if (A && A.main && A.main.illusion) A.main.illusion = ["m1", "m2"]; else if (A && A.illusion) A.illusion = ["m1", "m2"]; })();
  const html = app.call("buildAuctionView", "overrun");
  const chips = [...html.matchAll(/ac-pagemap[^>]*>([^<]+)</g)].map(function (m) { return m[1]; });
  ok(chips.some(function (cc) { return cc.indexOf("หน้า 6") >= 0 && cc.indexOf("ชิ้น 1-2") >= 0; }),
     "illusion=2 on page 6 must show page 6 slots 1-2; got: " + JSON.stringify(chips));
});
t("single-item column shows a single slot", function () {
  reset(app, mkMembers(["w1"]));
  Object.assign(app.state.auctionGL, { cards: 0, illusion: 0, white: 1, black: 0, splitMainPercent: 100 });
  (function () { var A = app.state.auctionGL.assignments; if (A && A.main && A.main.white) A.main.white = ["w1"]; })();
  const html = app.call("buildAuctionView", "gl");
  const chips = [...html.matchAll(/ac-pagemap[^>]*>([^<]+)</g)].map(function (m) { return m[1]; });
  ok(chips.some(function (cc) { return cc.indexOf("หน้า 1 · ชิ้น 1 ") >= 0; }), "got: " + JSON.stringify(chips));
});

console.log("\n[range circles — GL main map]");
// 3 admin-draggable/resizable zone circles on the GL Main map, synced via the
// range_circles node. The harness stubs the DOM/SVG, so we assert the pure state
// logic (init/clamp/toggle), not pixels. clampRangeCircle is the single source of
// truth for bounds (x,y in 0..100; r in 2..60), reused by init + the drag handlers.
t("initRangeCircles backfills exactly 3 default circles from empty", () => {
  app.state.rangeCircles = [];
  app.call("initRangeCircles");
  eq(app.state.rangeCircles.length, 3, "three circles");
  eq(app.state.rangeCircles, [{x:50,y:48,r:10},{x:27,y:48,r:8},{x:73,y:48,r:8}], "center/left/right defaults");
});
t("initRangeCircles is idempotent on a valid array", () => {
  app.state.rangeCircles = [];
  app.call("initRangeCircles");
  const before = JSON.stringify(app.state.rangeCircles);
  app.call("initRangeCircles");
  eq(JSON.stringify(app.state.rangeCircles), before, "unchanged on re-run");
});
t("initRangeCircles resets a malformed / wrong-length value to defaults", () => {
  app.state.rangeCircles = [{ x: 1, y: 2, r: 3 }];   // wrong length
  app.call("initRangeCircles");
  eq(app.state.rangeCircles.length, 3, "reset to 3");
  app.state.rangeCircles = null;                      // not an array
  app.call("initRangeCircles");
  eq(app.state.rangeCircles.length, 3, "reset from null");
});
t("clampRangeCircle bounds x,y to 0..100 and r to 2..60; NaN → safe defaults", () => {
  eq(app.call("clampRangeCircle", { x: -5, y: 200, r: 999 }), { x: 0, y: 100, r: 60 }, "over/under clamped");
  eq(app.call("clampRangeCircle", { x: "foo", y: null, r: undefined }), { x: 50, y: 0, r: 10 }, "NaN→defaults (y null coerces to 0)");
  eq(app.call("clampRangeCircle", { x: 27, y: 48, r: 8 }), { x: 27, y: 48, r: 8 }, "in-range unchanged");
});
t("initRangeCircles clamps an existing 3-element array in place", () => {
  app.state.rangeCircles = [{ x: -9, y: 9, r: 1 }, { x: 50, y: 50, r: 8 }, { x: 500, y: 50, r: 80 }];
  app.call("initRangeCircles");
  eq(app.state.rangeCircles, [{x:0,y:9,r:2},{x:50,y:50,r:8},{x:100,y:50,r:60}], "each clamped, still 3");
});
t("toggleRangeCircles flips the per-viewer on/off flag", () => {
  const start = app.call("rangeCirclesOn");
  app.call("toggleRangeCircles");
  eq(app.call("rangeCirclesOn"), !start, "flipped");
  app.call("toggleRangeCircles");
  eq(app.call("rangeCirclesOn"), start, "flipped back");
});

console.log("\n[map filter — multi-select]");
// The map filter is now a SET of party/group ids (empty = show all). Multi-select
// chips let you view several parties together. Per-viewer, not synced. Pure helpers
// (mapFilterVisible/_toggleInSet) + the toggle/clear setters leak to the vm global.
t("mapFilterVisible: empty set shows all; non-empty shows only its ids", () => {
  ok(app.call("mapFilterVisible", new Set(), 4), "empty → visible");
  ok(app.call("mapFilterVisible", new Set([4, 5]), 4), "4 in {4,5} → visible");
  ok(!app.call("mapFilterVisible", new Set([4, 5]), 6), "6 not in {4,5} → hidden");
  ok(app.call("mapFilterVisible", null, 9), "missing set → visible (defensive)");
});
t("toggleMapFilterMain adds/removes ids; supports several at once", () => {
  app.call("clearMapFilterMain");
  app.call("toggleMapFilterMain", 4);
  app.call("toggleMapFilterMain", 5);
  eq(app.call("mapFilterMainIds"), [4, 5], "4 and 5 both active");
  app.call("toggleMapFilterMain", 4);
  eq(app.call("mapFilterMainIds"), [5], "toggling 4 again removes it");
});
t("clearMapFilterMain / toggling 0 resets to all (empty set)", () => {
  app.call("clearMapFilterMain");
  app.call("toggleMapFilterMain", 7);
  eq(app.call("mapFilterMainIds"), [7], "seeded");
  app.call("clearMapFilterMain");
  eq(app.call("mapFilterMainIds"), [], "clear → empty (all)");
  app.call("toggleMapFilterMain", 7);
  app.call("toggleMapFilterMain", 0);   // 0 = clear-all sentinel
  eq(app.call("mapFilterMainIds"), [], "toggle 0 clears the set");
});
t("Main / Sub / Overrun filters are independent", () => {
  app.call("clearMapFilterMain"); app.call("clearMapFilterSub"); app.call("clearMapFilterOverrun");
  app.call("toggleMapFilterMain", 3);
  app.call("toggleMapFilterSub", 11);
  app.call("toggleMapFilterOverrun", 2);
  eq(app.call("mapFilterMainIds"), [3], "main independent");
  eq(app.call("mapFilterSubIds"), [11], "sub independent");
  eq(app.call("mapFilterOverrunIds"), [2], "overrun independent");
});
t("buildMapHtml renders multi-select chips with the active ones lit", () => {
  app.setAdmin(true);
  app.state.mode = "league";
  app.call("clearMapFilterMain");
  app.call("toggleMapFilterMain", 4);
  app.call("toggleMapFilterMain", 5);
  const html = app.call("buildMapHtml", 1);
  ok(html.includes("map-filter-chips"), "chip container present");
  ok(!html.includes("map-filter-select"), "old dropdown gone");
  ok(/map-filter-chip active"[^>]*toggleMapFilterMain\(4\)/.test(html), "chip 4 active");
  ok(/map-filter-chip active"[^>]*toggleMapFilterMain\(5\)/.test(html), "chip 5 active");
  ok(/map-filter-chip"[^>]*toggleMapFilterMain\(6\)/.test(html), "chip 6 NOT active");
});

t("map cards: upload v2 controls on EVERY map for admin, NONE for guests", () => {
  const cards = () => [
    ["GL main (top)", 1, app.call("buildMapHtml", 1)],
    ["GL sub (top)", 2, app.call("buildMapHtml", 2)],
    ["GL main (bottom)", 4, app.call("buildMapHtml", 4)],
    ["GL sub (bottom)", 5, app.call("buildMapHtml", 5)],
    ["Overrun", 3, app.call("buildOverrunMapHtml")],
  ];
  app.setAdmin(true);
  app.state.mode = "league";
  for (const [label, n, html] of cards()) {
    ok(!html.includes("setMapBg"), label + " must not reference retired setMapBg");
    ok(html.includes(`uploadMapImage(${n}, this)`), label + " has its wired upload input");
    ok(html.includes(`mapUpload${n}`), label + " file input id matches its map");
  }
  app.setAdmin(false);
  for (const [label, , html] of cards()) {
    ok(!html.includes('type="file"'), label + " renders no file input for guests");
    ok(!html.includes("uploadMapImage"), label + " renders no upload control for guests");
  }
  app.setAdmin(true);
});

console.log("\n[audit log]");
const AC_MS = 60000;
t("coalesceAuditLog caps at max, dropping the oldest", () => {
  let log = [];
  // distinct `what` + timestamps far apart → no coalescing, pure append+cap
  for (let i = 1; i <= 60; i++) log = app.call("coalesceAuditLog", log, { at: i * AC_MS, by: "a", what: "#" + i }, 50, AC_MS);
  eq(log.length, 50, "should cap at 50");
  eq(log[0].what, "#11", "oldest kept is the 11th (1..10 dropped)");
  eq(log[49].what, "#60", "newest is the 60th");
  eq(log[49].n, 1, "non-coalesced rows have n=1");
});
t("coalesceAuditLog collapses a same-actor same-action burst (bump time + n)", () => {
  let log = [];
  log = app.call("coalesceAuditLog", log, { at: 1000, by: "a@x", what: "แก้ทีม Overrun" }, 50, AC_MS);
  log = app.call("coalesceAuditLog", log, { at: 2000, by: "a@x", what: "แก้ทีม Overrun" }, 50, AC_MS);
  log = app.call("coalesceAuditLog", log, { at: 3000, by: "a@x", what: "แก้ทีม Overrun" }, 50, AC_MS);
  eq(log.length, 1, "a burst collapses into one row");
  eq(log[0].n, 3, "count reflects the burst size");
  eq(log[0].at, 3000, "time bumped to the latest edit");
});
t("coalesceAuditLog does NOT collapse across actor, action, or the time window", () => {
  let log = [];
  log = app.call("coalesceAuditLog", log, { at: 1000,  by: "a", what: "แก้ทีม Overrun" }, 50, AC_MS);
  log = app.call("coalesceAuditLog", log, { at: 2000,  by: "b", what: "แก้ทีม Overrun" }, 50, AC_MS); // diff actor
  log = app.call("coalesceAuditLog", log, { at: 3000,  by: "b", what: "แก้ทีม League"  }, 50, AC_MS); // diff action
  log = app.call("coalesceAuditLog", log, { at: 70000, by: "b", what: "แก้ทีม League"  }, 50, AC_MS); // outside window
  eq(log.length, 4, "distinct actor / action / late edits each get their own row");
});
t("coalesceAuditLog tolerates a non-array starting log", () => {
  const log = app.call("coalesceAuditLog", null, { at: 1, by: "a", what: "x" }, 50, AC_MS);
  eq(log.length, 1);
  eq(log[0].n, 1);
});
t("auditBoardLabel maps mode → board; non-board modes are explicit, not mislabelled", () => {
  eq(app.call("auditBoardLabel", "league"), "League");
  eq(app.call("auditBoardLabel", "overrun"), "Overrun");
  eq(app.call("auditBoardLabel", "auction-gl"), "(จากนอกหน้าทีม)", "member-delete from auction page");
  eq(app.call("auditBoardLabel", "roster"), "(จากนอกหน้าทีม)");
});

console.log("\n[version stamp]");
t("APP_VERSION exists and is calendar-versioned YYYY.MM.DD[.n]", () => {
  ok(typeof app.appVersion === "string", "APP_VERSION should be a string");
  ok(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/.test(app.appVersion), "format, got " + JSON.stringify(app.appVersion));
});
t("buildVersionStamp() returns v<APP_VERSION>", () => {
  eq(app.call("buildVersionStamp"), "v" + app.appVersion);
});

console.log("\n[roster self-edit — guest claims own row]");
(function () {
  const CLAIM_KEY = "roo_party_claimed_member";
  const MEMBERS = [
    { id: "m1", name: "Alice", job: "Priest", discord: "@alice", discordId: "111", cp: 1000, updatedAt: 100, updatedBy: "" },
    { id: "m2", name: "Bob",   job: "Knight", discord: "@bob",   discordId: "222", cp: 2000, updatedAt: 200, updatedBy: "" },
  ];
  let writes = [];
  // update() must return a thenable: the app chains .then/.catch on writes
  const refStub = { child(id) { return { update(payload) { writes.push({ id, payload }); return Promise.resolve(); } }; } };
  function setup(adminFlag, claimedId) {
    app.setAdmin(adminFlag);
    app.setRosterCache(JSON.parse(JSON.stringify(MEMBERS)));
    app.setMembersRef(refStub);
    app.state.mode = "roster";   // reject paths call renderBattlefields() — keep it on the cheap page
    if (claimedId) app.ctx.localStorage.setItem(CLAIM_KEY, claimedId);
    else app.ctx.localStorage.removeItem(CLAIM_KEY);
    writes = [];
  }

  t("rosterCanEdit: admin any row · guest only claimed row · unclaimed none", () => {
    setup(true, "");
    ok(app.call("rosterCanEdit", "m1") && app.call("rosterCanEdit", "m2"), "admin edits any row");
    setup(false, "m1");
    ok(app.call("rosterCanEdit", "m1"), "guest edits own claimed row");
    ok(!app.call("rosterCanEdit", "m2"), "guest cannot edit other row");
    setup(false, "");
    ok(!app.call("rosterCanEdit", "m1"), "unclaimed guest edits nothing");
  });
  t("dangling claim (member gone) → rosterClaimedMember null, claim NOT auto-cleared", () => {
    setup(false, "ghost");
    isNull(app.call("rosterClaimedMember"), "dangling claim resolves to null");
    ok(!app.call("rosterCanEdit", "m1"), "and cannot edit others");
    eq(app.ctx.localStorage.getItem(CLAIM_KEY), "ghost", "localStorage keeps the claim (roster may not be loaded yet)");
  });
  t("guest write to NON-claimed row is blocked (no Firebase write)", () => {
    setup(false, "m1");
    app.call("rosterUpdate", "m2", "cp", "555");
    app.call("rosterUpdate", "m2", "name", "Hacked");
    app.call("rosterSaveMine", "m2");
    eq(writes.length, 0, "no write may reach Firebase");
  });
  t("guest edit on own row writes field + updatedAt + updatedBy=claimed name", () => {
    setup(false, "m1");
    app.call("rosterUpdate", "m1", "discord", "  @newalice  ");
    eq(writes.length, 1);
    eq(writes[0].id, "m1");
    eq(writes[0].payload.discord, "@newalice", "trimmed");
    eq(writes[0].payload.updatedBy, "👤 Alice", "updatedBy = 👤-prefixed claimed name (guest marker)");
    ok(typeof writes[0].payload.updatedAt === "number", "updatedAt stamped");
  });
  t("admin edit works on any row; updatedBy falls back to 'admin' (no _fbUser in harness)", () => {
    setup(true, "");
    app.call("rosterUpdate", "m2", "name", "Bobby");
    eq(writes.length, 1);
    eq(writes[0].payload.name, "Bobby");
    eq(writes[0].payload.updatedBy, "admin");
  });
  t("blank name: guest rejected, admin allowed (ghost-row machinery handles)", () => {
    setup(false, "m1");
    app.call("rosterUpdate", "m1", "name", "   ");
    eq(writes.length, 0, "guest blank name rejected");
    setup(true, "");
    app.call("rosterUpdate", "m1", "name", "");
    eq(writes.length, 1, "admin may clear name");
  });
  t("cp: strips non-digits, clamps to 100,000,000", () => {
    setup(false, "m1");
    app.call("rosterUpdate", "m1", "cp", "12,345");
    eq(writes[0].payload.cp, 12345);
    app.call("rosterUpdate", "m1", "cp", "999999999999");
    eq(writes[1].payload.cp, 100000000, "clamped to cap");
  });
  t("over-long text field rejected at 64 chars — no silent truncate", () => {
    setup(false, "m1");
    app.call("rosterUpdate", "m1", "discord", "x".repeat(65));
    eq(writes.length, 0, "65 chars rejected");
    app.call("rosterUpdate", "m1", "discord", "x".repeat(64));
    eq(writes.length, 1, "64 chars accepted");
  });
  t("rosterSaveMine without a real DOM draft rejects blank name — no write", () => {
    setup(false, "m1");
    app.call("rosterSaveMine", "m1");   // harness DOM stub yields empty values → blank-name reject
    eq(writes.length, 0, "no write without a valid draft");
  });
  t("rosterClampFields: slices strings to caps, clamps cp into [0, 100M]", () => {
    const lim = app.rosterLimits;
    const out = app.call("rosterClampFields", {
      name: "x".repeat(99), job: "ok", discord: "y".repeat(80), discordId: "1".repeat(40),
      cp: 999999999999, updatedAt: 5, updatedBy: "z"
    });
    eq(out.name.length, lim.fields.name);
    eq(out.discord.length, lim.fields.discord);
    eq(out.discordId.length, lim.fields.discordId);
    eq(out.cp, lim.cp, "cp clamped to cap");
    eq(app.call("rosterClampFields", { cp: -500 }).cp, 0, "negative cp → 0");
    eq(app.call("rosterClampFields", { cp: "1500" }).cp, 1500, "string cp coerced");
    eq(out.job, "ok", "short fields untouched");
  });
  t("rows HTML: guest sees DRAFT inputs + 💾 only on claimed row, others static, no delete", () => {
    setup(false, "m1");
    const html = app.call("buildRosterRowsHtml");
    const rows = html.split("<tr").filter(r => r.includes("data-id="));
    const r1 = rows.find(r => r.includes('data-id="m1"'));
    const r2 = rows.find(r => r.includes('data-id="m2"'));
    ok(r1.includes('class="r-mine"'), "own row carries r-mine");
    ok(r1.includes('data-rme="name"') && r1.includes('data-rme="job"') && r1.includes('data-rme="cp"'), "own row has draft inputs");
    ok(r1.includes("rosterSaveMine('m1')"), "own row has the save button");
    ok(!r1.includes("rosterUpdate("), "own row does NOT auto-save per field");
    ok(!r2.includes("<input") && !r2.includes("<select"), "other row has no editable controls");
    ok(r2.includes("r-cell-static"), "other row renders static cells");
    ok(!html.includes("rosterDelete"), "guest never sees delete");
  });
  t("rows HTML: admin keeps realtime inputs everywhere, no r-mine/save, has delete", () => {
    setup(true, "");
    const html = app.call("buildRosterRowsHtml");
    ok(html.includes("rosterUpdate('m1','name'") && html.includes("rosterUpdate('m2','name'"), "all rows editable");
    ok(!html.includes("r-mine"), "no r-mine for admin");
    ok(!html.includes("rosterSaveMine"), "no save button for admin");
    ok(html.includes("rosterDelete"), "delete present");
  });
  t("updatedBy renders (escaped) in Last Update cell", () => {
    setup(true, "");
    const withBy = JSON.parse(JSON.stringify(MEMBERS));
    withBy[0].updatedBy = "<img src=x>";
    app.setRosterCache(withBy);
    const html = app.call("buildRosterRowsHtml");
    ok(html.includes("r-updated-by"), "updatedBy cell rendered");
    ok(!html.includes("<img src=x>"), "updatedBy is HTML-escaped");
  });
  t("claim UI: chooser when unclaimed · chip when claimed · chooser again when dangling", () => {
    setup(false, "");
    let html = app.call("buildRosterClaimHtml");
    ok(html.includes("rosterClaimSelect"), "chooser shown when unclaimed");
    ok(html.includes("Alice") && html.includes('value="m1"'), "members listed");
    ok(html.includes("ยืนยัน"), "confirm button labelled ยืนยัน");
    setup(false, "m1");
    html = app.call("buildRosterClaimHtml");
    ok(html.includes("แก้ในชื่อ") && html.includes("Alice"), "chip shows claimed name");
    ok(html.includes("claimSetMember('')"), "เปลี่ยน/ออก wired");
    setup(false, "ghost");
    html = app.call("buildRosterClaimHtml");
    ok(html.includes("rosterClaimSelect"), "dangling claim falls back to chooser");
  });
  t("claimOptionsHtml: ghost rows (blank name) are not selectable", () => {
    const html = app.call("claimOptionsHtml", [
      { id: "g1", name: "", job: "Knight" },
      { id: "g2", name: "   ", job: "Priest" },
      { id: "m9", name: "Cara", job: "" },
    ]);
    ok(!html.includes("g1") && !html.includes("g2"), "blank-name rows filtered out");
    ok(html.includes('value="m9"') && html.includes("Cara (?)"), "named row kept with ? job");
  });
  t("database.rules.json: /members/$mid shape-locked (validators + $other:false + leaf locks)", () => {
    const rules = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "database.rules.json"), "utf8"));
    const mid = rules.rules.members["$mid"];
    ok(mid && typeof mid[".write"] === "string", "members.$mid .write kept");
    for (const k of ["name", "job", "discord", "discordId", "cp", "updatedAt", "updatedBy", "onLeaveLeague", "onLeaveOverrun"]) {
      ok(mid[k] && typeof mid[k][".validate"] === "string", "validator for " + k);
      // Deep-write lock: /members/$mid/<field>/<child> must be denied — a
      // parent .validate is NOT evaluated for writes below it (RTDB footgun)
      eq(mid[k]["$x"][".validate"], false, k + " has a child-write lock");
    }
    eq(mid["$other"][".validate"], false, "$other:false — unknown keys rejected (all 9 writer keys are whitelisted)");
    ok(mid.name[".validate"].indexOf("length >= 1") === -1 && mid.name[".validate"].indexOf("length > 0") === -1,
       "name validator must allow '' (dedupe ghost rows)");
  });
  t("rules limits === client constants (drift tripwire)", () => {
    const rules = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "database.rules.json"), "utf8"));
    const mid = rules.rules.members["$mid"];
    const lim = app.rosterLimits;
    for (const k of ["name", "job", "discord", "discordId"]) {
      const m = mid[k][".validate"].match(/length <= (\d+)/);
      ok(m, k + " has a length cap");
      eq(Number(m[1]), lim.fields[k], k + " cap matches client");
    }
    const cpm = mid.cp[".validate"].match(/newData\.val\(\) <= (\d+)/);
    ok(cpm, "cp has an upper bound");
    eq(Number(cpm[1]), lim.cp, "cp cap matches client");
  });
  t("draft hold is wired into safeRender (remote re-render can't wipe typing)", () => {
    const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
    ok(/_rosterMineDirty && state\.mode === "roster"/.test(appHtml), "safeRender holds while draft open");
    ok(appHtml.includes("_rosterMineDirty = false;  // any full roster rebuild discards the draft"), "flag reset on full rebuild");
  });
})();

console.log("\n[map admin gate — guests view-only, filters allowed]");
(function () {
  t("buildMapHtml: guest gets no Clear-arrows, sees read-only hint, keeps filters/ระยะ/Expand", () => {
    app.setAdmin(false);
    const html = app.call("buildMapHtml", 1);
    ok(!html.includes("clearArrows("), "no clear button for guest");
    ok(html.includes("ดูอย่างเดียว"), "read-only hint shown");
    ok(html.includes("map-filter-chip"), "party filters kept");
    ok(html.includes("toggleRangeCircles"), "ระยะ toggle kept");
    ok(html.includes("toggleMapFullscreen(1)"), "Expand kept");
  });
  t("buildMapHtml: admin keeps Clear arrows, no hint", () => {
    app.setAdmin(true);
    const html = app.call("buildMapHtml", 1);
    ok(html.includes("clearArrows(1)"), "clear button for admin");
    ok(!html.includes("ดูอย่างเดียว"), "no hint for admin");
  });
  t("buildOverrunHtml: same gate on the Overrun map card", () => {
    app.setAdmin(false);
    let html = app.call("buildOverrunHtml");
    ok(!html.includes("clearArrows(3)") && html.includes("ดูอย่างเดียว"), "guest gated");
    ok(html.includes("toggleMapFilterOverrun"), "overrun filters kept for guest");
    app.setAdmin(true);
    html = app.call("buildOverrunHtml");
    ok(html.includes("clearArrows(3)"), "admin keeps clear button");
  });
  t("clearArrows: guest is a no-op (paths untouched), admin clears", () => {
    app.setAdmin(false);
    app.state.overrunMarkers = { 1: { x: 1, y: 1, path: [{ x: 0, y: 0 }] } };
    app.call("clearArrows", 3);
    eq(app.state.overrunMarkers[1].path.length, 1, "guest cannot clear");
    app.setAdmin(true);
    app.call("clearArrows", 3);
    eq(app.state.overrunMarkers[1].path.length, 0, "admin clears");
  });
  t("all 3 drag attachers are admin-gated at the top (static)", () => {
    const src = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
    for (const fn of ["attachMarkerDrag", "attachMarkerDragOverrun", "attachRangeCircleDrag"]) {
      const m = src.match(new RegExp("function " + fn + "\\([^)]*\\) \\{[\\s\\S]{0,800}"));
      ok(m && /if \(!isAdmin\(\)\)/.test(m[0]), fn + " has isAdmin gate near top");
    }
  });
})();

console.log("\n[landing — front door wiring]");
(function () {
  const root = require("path").join(__dirname, "..");
  const rd = (p) => require("fs").readFileSync(require("path").join(root, p), "utf8");
  const landing = rd("index.html");
  const appHtml = rd("app.html");
  t("landing index.html links into the app (app.html)", () => {
    ok(/href\s*=\s*["']app\.html["']/.test(landing), "expected a link to app.html");
  });
  t("landing references the logo asset", () => {
    ok(landing.includes("assets/one-o-clock.png"), "expected assets/one-o-clock.png");
  });
  t("landing has the brand title + OG image", () => {
    ok(/<title>[^<]*one o clock/i.test(landing), "title");
    ok(/property=["']og:image["']/.test(landing), "og:image meta");
  });
  t("landing is STATIC — no Firebase / no app boot", () => {
    ok(!/firebase/i.test(landing), "landing must not reference firebase");
    ok(!landing.includes("initFirebase"), "landing must not boot the app");
  });
  t("logo asset exists and is reasonably sized (<500KB)", () => {
    const p = require("path").join(root, "assets", "one-o-clock.png");
    ok(require("fs").existsSync(p), "assets/one-o-clock.png missing");
    ok(require("fs").statSync(p).size / 1024 < 500, "logo should be <500KB");
  });
  t("VERSION COUPLING: app.html APP_VERSION === landing footer === CHANGELOG top", () => {
    const appV = (appHtml.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
    const landV = (landing.match(/v(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)/) || [])[1];
    const clV = (rd("CHANGELOG.md").match(/##\s*\[(\d{4}\.\d{2}\.\d{2}(?:\.\d+)?)\]/) || [])[1];
    ok(appV, "APP_VERSION found in app.html");
    eq(landV, appV, "landing footer must equal APP_VERSION");
    eq(clV, appV, "top CHANGELOG entry must equal APP_VERSION");
  });
  t("GL 2-plan: bottom marker store + Firebase wired", () => {
    ok(/markersBottom:\s*\{\}/.test(appHtml), "state.markersBottom declared");
    ok(/ref\("markers_bottom"\)\.on\("value"/.test(appHtml), "markers_bottom listener present");
    ok(/ref\("markers_bottom"\)\.set/.test(appHtml), "markers_bottom pushed in fbPushAll");
  });
  t("GL 2-plan: 4 league cards + same image + store helper", () => {
    ok(/buildMapHtml\(4\)/.test(appHtml) && /buildMapHtml\(5\)/.test(appHtml), "cards 4 & 5 emitted");
    ok(/4:\s*"maps\/main\.png"/.test(appHtml) && /5:\s*"maps\/sub\.png"/.test(appHtml), "EMBEDDED_MAPS 4/5 reuse same images");
    ok(/function leagueMarkerStore/.test(appHtml), "leagueMarkerStore helper exists");
  });

  t("map upload v2 (2026-06-12): admin-gated, /map_images data-URL, static fallback kept", () => {
    ok(!appHtml.includes("setMapBg("), "legacy setMapBg() stays gone");
    ok(/type="file" id="mapUpload\$\{mapNum\}" accept="image\/\*"[^>]*onchange="uploadMapImage/.test(appHtml),
       "hidden per-map file input wired to uploadMapImage");
    ok(appHtml.includes('_fbDB.ref("map_images/" + mapNum).set(dataUrl)'), "upload writes /map_images/{n}");
    ok(appHtml.includes("_customMapImages[mapNum] || state.mapBg[mapNum]"),
       "custom image wins, embedded static stays the fallback");
    ok(appHtml.includes('if (typeof isAdmin !== "function" || !isAdmin()) return "";'),
       "upload buttons render for admins only");
    ok(appHtml.includes("MAP_IMAGE_MAX_CHARS"), "client-side size cap exists");
  });
  t("map upload v2: rules node /map_images is admin-write + type/size locked", () => {
    const rules = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "database.rules.json"), "utf8"));
    const node = rules.rules.map_images;
    ok(node, "map_images node exists");
    eq(node[".read"], "auth != null", "authed read");
    ok(String(node[".write"]).includes("root.child('admins')"), "admin-only write");
    const v = node["$mapNum"][".validate"];
    ok(v.includes("beginsWith('data:image/')"), "value must be an image data-URL");
    ok(v.includes("length < 900000"), "size cap enforced server-side");
    ok(v.includes("$mapNum.matches(/^[1-5]$/)"), "only map slots 1-5 allowed");
  });
  t("league maps render main+main row then sub+sub row (no sub between mains)", () => {
    ok(/maps-row">' \+ buildMapHtml\(1\) \+ buildMapHtml\(4\)/.test(appHtml), "row 1 = maps 1+4 (both main)");
    ok(/maps-row">' \+ buildMapHtml\(2\) \+ buildMapHtml\(5\)/.test(appHtml), "row 2 = maps 2+5 (both sub)");
  });
  t("parties: auto-sanitize must NOT write back to Firebase (silent-wipe guard)", () => {
    // Fix A: the members + /parties listeners used to .set() the sanitized parties
    // back, so a sanitize against stale/racey data silently PERSISTED a wipe of
    // valid slots ("arranged names reset on their own"). Persistent cleanup is now
    // the manual repairGhostSlots() button only.
    ok(!/sanitizeSlots\([^)]*\)\s*&&\s*isAdmin\(\)/.test(appHtml),
       "no auto sanitize+isAdmin write-back to /parties may remain");
  });
  t("parties: members-listener re-sanitize is gated on loaded snapshot (Fix B)", () => {
    ok(/let _fbPartiesLeagueLoaded\s*=\s*false/.test(appHtml), "League loaded flag declared");
    ok(/let _fbPartiesOverrunLoaded\s*=\s*false/.test(appHtml), "Overrun loaded flag declared");
    ok(/_fbPartiesLeagueLoaded\s*=\s*true/.test(appHtml), "League flag set when /parties loads");
    ok(/_fbPartiesOverrunLoaded\s*=\s*true/.test(appHtml), "Overrun flag set when /parties loads");
    ok(/if \(_fbPartiesLeagueLoaded && state\.partiesLeague\) sanitizeSlots/.test(appHtml),
       "members-listener League sanitize gated on loaded flag");
  });
})();

// --------------------------------------------------- summary exact targets
// 2026-06-12: มี ≠ เป้า flags immediately with the exact gap — no ±1 grace.
console.log("\n[summary exact targets]");
(() => {
  t("exact: off-by-one is NOT สมดุล anymore (the 15/16 screenshot case)", () => {
    eq(app.call("classifyJobStatus", 15, 16), { status: "ขาด 1", cls: "status-too-few" });
    eq(app.call("classifyJobStatus", 11, 10), { status: "เกิน 1", cls: "status-too-many" });
    eq(app.call("classifyJobStatus", 10, 10), { status: "สมดุล", cls: "status-balanced" });
    eq(app.call("classifyJobStatus", 10, 8),  { status: "เกิน 2", cls: "status-too-many" });
    eq(app.call("classifyJobStatus", 14, 16), { status: "ขาด 2", cls: "status-too-few" });
    eq(app.call("classifyJobStatus", 5, 0),   { status: "—", cls: "status-none" });
  });

  t("exact: AI comment reports off-by-one jobs + exact net totals", () => {
    const jobs = ["High Priest", "Paladin", "Wizard"];
    const counts = { "High Priest": 15, "Paladin": 11, "Wizard": 8 };
    const targets = { "High Priest": 16, "Paladin": 10, "Wizard": 8 };
    const html = app.call("buildAiComment", jobs, counts, targets, 34);
    ok(html.includes("เทียบเป้ารวม"), "net summary line present");
    ok(html.includes("<b>34</b> / เป้า <b>34</b>"), "exact have/target sums");
    ok(html.includes("ครบพอดี"), "net zero stated precisely");
    ok(html.includes("High Priest") && html.includes("ขาด 1 คน"), "off-by-one ขาด reported");
    ok(html.includes("Paladin") && html.includes("เกิน 1 คน"), "off-by-one เกิน reported");
    ok(html.includes("ย้าย <b>1</b> คน"), "quantified move suggestion");
  });

  t("exact: all-on-target comp reads as fully balanced", () => {
    const html = app.call("buildAiComment", ["Wizard"], { Wizard: 8 }, { Wizard: 8 }, 8);
    ok(html.includes("ครบพอดี"), "net = ครบพอดี");
    ok(html.includes("สมดุล (1)"), "single balanced job listed");
    ok(!html.includes("คำแนะนำ"), "no advice when nothing is off");
  });

  t("exact: targeted job with ZERO members still surfaces as ขาด N (worst hole)", () => {
    // Gunslinger has a target but nobody plays it — it must NOT vanish.
    const jobs = app.call("getSummaryJobs", { Wizard: 8 }, { Wizard: 8, Gunslinger: 3 });
    eq(jobs.includes("Gunslinger"), true, "union includes the 0-member targeted job");
    const html = app.call("buildAiComment", jobs, { Wizard: 8 }, { Wizard: 8, Gunslinger: 3 }, 8);
    ok(html.includes("Gunslinger") && html.includes("ขาด 3 คน"), "0-member job reported with its exact gap");
    ok(html.includes("เป้า <b>11</b>"), "target sum includes the invisible job's target");
    eq(app.call("getSummaryJobs", { Wizard: 8 }, { Wizard: 8, Old: 0 }).includes("Old"), false,
       "target 0 jobs stay excluded");
  });

  t("exact: move plan renders EVERY pair (no silent slice-4 truncation)", () => {
    const jobs = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"];
    const counts = { A1: 2, A2: 2, A3: 2, A4: 2, A5: 2, B1: 0, B2: 0, B3: 0, B4: 0, B5: 0 };
    const targets = { A1: 1, A2: 1, A3: 1, A4: 1, A5: 1, B1: 1, B2: 1, B3: 1, B4: 1, B5: 1 };
    const html = app.call("buildAiComment", jobs, counts, targets, 10);
    eq((html.match(/ย้าย <b>/g) || []).length, 5, "all five moves rendered");
    ok(!html.includes("ที่เหลือต้องหาเพิ่ม"), "no phantom leftover line when the plan is complete");
  });
})();

// ------------------------------------------------------- overrun groups
// 2026-06-12: 5th "Purple" group (ตี้ 15,16 carved out of Blue).
console.log("\n[overrun groups]");
(() => {
  const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");

  t("overrun: OVERRUN_GROUPS partitions ตี้ 1-16 exactly once (Blue 13-14, Purple 15-16)", () => {
    const block = (appHtml.match(/const OVERRUN_GROUPS = \[([\s\S]*?)\];/) || [])[1];
    ok(block, "OVERRUN_GROUPS literal found");
    const groups = [...block.matchAll(/ids:\s*\[([0-9,\s]+)\]/g)].map(m => m[1].split(",").map(Number));
    eq(groups.length, 5, "five groups");
    eq(groups[3], [13, 14], "Blue keeps 13,14");
    eq(groups[4], [15, 16], "Purple owns 15,16");
    const all = groups.flat().sort((a, b) => a - b);
    eq(all, Array.from({ length: 16 }, (_, i) => i + 1), "ids 1-16 each exactly once");
    ok(block.includes("#a855f7"), "purple color present");
  });

  t("overrun: page renders 5 group cards incl. Purple Party", () => {
    reset(app, []);
    const html = app.call("buildOverrunHtml");
    eq((html.match(/bg-card/g) || []).length, 5, "five group cards");
    ok(html.includes("Purple Party"), "purple group card title");
    ok(html.includes("--gc:#a855f7"), "card carries the purple group color");
    const purpleCard = html.split("Purple Party")[1] || "";
    ok(purpleCard.includes('data-tip-party="15"') && purpleCard.includes('data-tip-party="16"'),
       "Purple card holds party rows 15+16");
  });

  t("overrun: map gets 5 filter chips + dynamic group count title", () => {
    reset(app, []);
    const html = app.call("buildOverrunHtml");
    ok(html.includes("toggleMapFilterOverrun(5)"), "5th group filter chip wired");
    ok(html.includes("● Purple"), "Purple chip label");
    ok(html.includes("Overrun Map · 5 กลุ่ม"), "map title reflects group count");
  });

  t("overrun: no hardcoded 4-group loops remain in marker/arrow code", () => {
    ok((appHtml.match(/i <= OVERRUN_GROUPS\.length/g) || []).length >= 4,
       "marker/arrow/clear loops iterate OVERRUN_GROUPS.length");
    eq((appHtml.match(/i <= 4\b/g) || []).length, 0, "no i <= 4 loop survives anywhere");
    eq((appHtml.match(/marker:\s*\{/g) || []).length, 5,
       "every group carries its own default marker spot (colocated, no parallel array)");
  });
})();

// --------------------------------------------------- auction-request queue
// 2026-06-12: pending list = pure first-come queue with #N + 🕐 requestedAt.
console.log("\n[auction-request queue]");
(() => {
  const date = "2026-06-02"; // Tuesday = GL event day
  function seedQueue() {
    app.setAdmin(true);
    app.setToday(date);
    reset(app, mkMembers(["EarlySub", "MidMain", "LateMain", "WonGuy", "OldSub"]));
    app.state.auctionRequests = { [date]: { gl: {
      q2: { id: "q2", memberId: "MidMain",  memberName: "MidMain",  items: ["cards"], status: "pending",  computedField: "main", requestedAt: 200 },
      q1: { id: "q1", memberId: "EarlySub", memberName: "EarlySub", items: ["white"], status: "pending",  computedField: "sub",  requestedAt: 100 },
      q3: { id: "q3", memberId: "LateMain", memberName: "LateMain", items: ["black"], status: "pending",  computedField: "main", requestedAt: 300 },
      a1: { id: "a1", memberId: "WonGuy",   memberName: "WonGuy",   items: ["cards"], status: "approved", computedField: "main", requestedAt: 250 },
      a2: { id: "a2", memberId: "OldSub",   memberName: "OldSub",   items: ["white"], status: "approved", computedField: "sub",  requestedAt: 50  },
    } } };
  }

  t("queue: pending renders in pure arrival order with #N (sub ที่มาก่อนขึ้นก่อน)", () => {
    seedQueue();
    const h = app.call("arBuildAdminQueue", date, "gl");
    const pendingPart = h.split("อนุมัติแล้ว")[0];
    ok(pendingPart.includes("ar-queue-no"), "queue badges rendered");
    const iE = pendingPart.indexOf("EarlySub"), iM = pendingPart.indexOf("MidMain"), iL = pendingPart.indexOf("LateMain");
    ok(iE !== -1 && iM !== -1 && iL !== -1, "all three pending rows rendered");
    ok(iE < iM && iM < iL, "order is requestedAt 100 < 200 < 300 — NOT main-before-sub");
    ok(pendingPart.indexOf(">#1<") < pendingPart.indexOf(">#2<"), "#1 before #2");
    eq((pendingPart.match(/ar-queue-no/g) || []).length, 3, "exactly three queue badges");
    ok(pendingPart.includes(">#3<"), "third queue number present (badge token, not the #3f hex)");
  });

  t("queue: every row shows 🕐 requestedAt; legacy entry shows —", () => {
    seedQueue();
    app.state.auctionRequests[date].gl.q1.requestedAt = undefined;
    const h = app.call("arBuildAdminQueue", date, "gl");
    ok(h.includes("ar-time"), "time spans rendered");
    ok(h.includes("🕐 —"), "legacy request without requestedAt shows a dash");
    ok((h.match(/ar-time/g) || []).length >= 5, "time shown on pending AND history rows");
  });

  t("queue: approved history keeps main-before-sub grouping (unchanged)", () => {
    seedQueue();
    const h = app.call("arBuildAdminQueue", date, "gl");
    const approvedPart = h.split("อนุมัติแล้ว")[1] || "";
    const iMain = approvedPart.indexOf("WonGuy"), iSub = approvedPart.indexOf("OldSub");
    ok(iMain !== -1 && iSub !== -1, "both approved rows rendered");
    ok(iMain < iSub, "main (t=250) still before sub (t=50) in history — old grouping intact");
    ok(!approvedPart.includes("ar-queue-no"), "no queue numbers on history rows");
  });

  t("queue: arFormatTime formats BKK time and dashes invalid input", () => {
    ok(/^\d{1,2}:\d{2}:\d{2}$/.test(app.call("arFormatTime", 1718160000000).trim()), "ms → HH:MM:SS");
    eq(app.call("arFormatTime", 0), "—", "0 → dash");
    eq(app.call("arFormatTime", undefined), "—", "undefined → dash");
    eq(app.call("arFormatTime", NaN), "—", "NaN → dash");
  });
})();

// ------------------------------------------------------ auction no-bonus
// GL ×-bonus system retired 2026-06: admins enter FINAL counts directly.
console.log("\n[auction no-bonus]");
(() => {
  const s = reset(app, mkMembers(["A", "B"]));

  t("no-bonus: GL totals are exactly the entered counts (no multiplier)", () => {
    Object.assign(app.state.auctionGL, { cards: 7, illusion: 3, white: 10, black: 9 });
    const d = app.call("computeAuction", "gl");
    eq(d.items.map(it => it.total), [7, 3, 10, 9], "entered counts pass through 1:1");
  });

  t("no-bonus: legacy bonusPercent in a saved state is stripped and ignored", () => {
    const legacy = app.call("normalizeAuctionState",
      { cards: 5, white: 4, bonusPercent: 70, bonusCards: 5 }, "gl");
    ok(!("bonusPercent" in legacy), "bonusPercent stripped by normalize");
    ok(!("bonusCards" in legacy), "legacy bonusCards stripped");
    app.state.auctionGL = legacy;
    const d = app.call("computeAuction", "gl");
    eq(d.items.find(i => i.key === "cards").total, 5, "no ×2 even from a legacy save");
    eq(d.items.find(i => i.key === "white").total, 4, "no ×(1+%) on feathers");
  });

  t("no-bonus: bonus system fully removed from the app source", () => {
    const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
    ok(!appHtml.includes("AUCTION_PERCENTS"), "percent-picker constant gone");
    ok(!appHtml.includes("setAuctionPercent"), "percent setter gone");
    ok(!appHtml.includes("Bonus rate"), "bonus UI section gone");
    ok(!appHtml.includes("auction-percent-btn"), "percent button CSS/markup gone");
    ok(!appHtml.replace(/delete obj\.bonusPercent;/g, "").includes("bonusPercent"),
       "no live bonusPercent reads/writes (only the normalize legacy-strip remains)");
  });
})();

// ---------------------------------------------------------------- wheel
// Prize-wheel page (admin-only). NOTE: never invoke wheelSpin()/
// wheelConfetti() here — the harness rAF stub re-enters synchronously.
console.log("\n[wheel]");
(() => {
  const s = reset(app, mkMembers(["A", "B", "C", "D"]));
  s.wheelHistory = {};
  app.setAdmin(true);

  t("wheel: admin page renders canvas + every roster name", () => {
    const html = app.call("buildWheelHtml");
    ok(html.includes("wheelCanvas"), "has wheel canvas");
    ok(html.includes("wheelSpinBtn"), "has spin button");
    for (const n of ["A", "B", "C", "D"]) ok(html.includes(">" + n + "</span>"), "lists member " + n);
  });

  t("wheel: non-admin gets the lock screen, no wheel UI", () => {
    app.setAdmin(false);
    const html = app.call("buildWheelHtml");
    ok(html.includes("admin เท่านั้น"), "lock text shown");
    ok(!html.includes("wheelCanvas"), "no canvas for guests");
    ok(!html.includes("wheelSpinBtn"), "no spin button for guests");
    app.setAdmin(true);
  });

  t("wheel: excluded member is never picked; everyone else reachable", () => {
    // exercises the REAL spin pick path: wheelEligibleMembers + wheelRandIndex
    app.call("wheelToggleMember", "B", false, null);
    const seen = {};
    for (let i = 0; i < 300; i++) {
      const list = app.call("wheelEligibleMembers");
      const w = list[app.call("wheelRandIndex", list.length)];
      ok(w && w.id !== "B", "excluded B must never win");
      seen[w.id] = true;
    }
    eq(Object.keys(seen).sort(), ["A", "C", "D"], "all eligible members reachable in 300 picks");
    app.call("wheelToggleMember", "B", true, null);
    eq(app.call("wheelEligibleMembers").length, 4, "toggle back restores B");
  });

  t("wheel: wheelRandIndex honors injected rng (deterministic) + edge cases", () => {
    eq(app.call("wheelRandIndex", 4, () => 0), 0, "rng→0 picks first index");
    eq(app.call("wheelRandIndex", 4, () => 0.999), 3, "rng→~1 picks last index");
    eq(app.call("wheelRandIndex", 0), -1, "n=0 → -1 (no pick)");
    const i = app.call("wheelRandIndex", 5);
    ok(i >= 0 && i < 5, "crypto path stays in range");
  });

  t("wheel: history entry is shape-locked + length-clamped", () => {
    const e = app.call("wheelMakeHistoryEntry",
      { id: "m1", name: "X".repeat(100) }, " " + "P".repeat(200), "admin@example.com", 42);
    eq(Object.keys(e).sort(), ["at", "by", "prize", "winnerId", "winnerName"], "exact field set");
    eq(e.at, 42, "timestamp passthrough");
    eq(e.winnerId, "m1", "winner id");
    eq(e.winnerName.length, 64, "name clamped to 64");
    eq(e.prize.length, 120, "prize trimmed+clamped to 120");
  });

  t("wheel: wheelTrimDeletions keeps only the newest max", () => {
    eq(app.call("wheelTrimDeletions", ["a", "b", "c", "d", "e"], 3), ["a", "b"], "oldest two deleted");
    eq(app.call("wheelTrimDeletions", ["a", "b"], 3), [], "under cap → nothing");
    eq(app.call("wheelTrimDeletions", [], 3), [], "empty → nothing");
  });

  t("wheel: saving a result must NOT shrink the wheel (ทุกคนมีสิทธิ์ทุกรอบ)", () => {
    const W = app.wheelUI();
    ok(W, "wheelUI bridged out of the vm");
    const before = app.call("wheelEligibleMembers").length;
    W.pendingResult = { id: "A", name: "A", job: "Knight" };
    W.prize = "การ์ดบอส 1 ใบ";
    app.call("wheelSaveResult");
    eq(W.pendingResult, null, "pending result cleared after save");
    eq(app.call("wheelEligibleMembers").length, before, "pool unchanged — no winner removal");
  });

  t("wheel: discard clears pending result without touching the pool", () => {
    const W = app.wheelUI();
    W.pendingResult = { id: "C", name: "C", job: "Knight" };
    app.call("wheelDiscardResult");
    eq(W.pendingResult, null, "pending cleared");
    eq(app.call("wheelEligibleMembers").length, 4, "pool intact");
  });

  t("wheel: history renders newest-first with prize + actor", () => {
    s.wheelHistory = {
      k1: { at: 1000, by: "boss@x.com", winnerId: "A", winnerName: "A", prize: "ของเก่า" },
      k2: { at: 2000, by: "boss@x.com", winnerId: "B", winnerName: "B", prize: "ของใหม่" },
    };
    const html = app.call("buildWheelHtml");
    ok(html.indexOf("ของใหม่") < html.indexOf("ของเก่า"), "newest entry first");
    ok(html.includes("โดย boss"), "actor shown (email prefix)");
    s.wheelHistory = {};
  });

  t("wheel: mode plumbing complete (tab, dropdown, css, boot guard, dispatch)", () => {
    const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
    ok(appHtml.includes('data-mode="wheel"'), "header tab present");
    ok((appHtml.match(/seg-admin/g) || []).length >= 3, "wheel tab is admin-gated (seg-admin)");
    ok(appHtml.includes('<option value="wheel" class="user-option-admin">'), "mobile dropdown option (admin-gated)");
    ok(appHtml.includes('body[data-mode="wheel"]'), "css hides sidebar on wheel page");
    ok(appHtml.includes('t.classList.toggle("wheel-active", state.mode === "wheel")'), "indicator class wired");
    ok(/state\.mode === "users" \|\| state\.mode === "wheel"\) \{\s*\n\s*state\.parties = state\.partiesLeague/.test(appHtml),
       "boot guard maps wheel → partiesLeague");
    ok(/state\.mode === "wheel"\) \{[\s\S]{0,400}?if \(!wheelUI\.spinning\)/.test(appHtml),
       "renderBattlefields wheel branch is spin-guarded (the single choke point)");
  });

  t("wheel: review fixes locked in (frozen spin list, at-ordered trim, save-fail restore)", () => {
    const appHtml = require("fs").readFileSync(require("path").join(__dirname, "..", "app.html"), "utf8");
    ok(appHtml.includes("wheelUI.spinList = list"), "spin freezes the eligible list it picked from");
    ok(appHtml.includes("(wheelUI.spinning && wheelUI.spinList) ? wheelUI.spinList : wheelEligibleMembers()"),
       "drawWheel slices from the frozen list mid-spin (pointer can't desync from winner)");
    ok(/sort\(\(a, b\) => \(\(all\[a\] && all\[a\]\.at\) \|\| 0\) - \(\(all\[b\] && all\[b\]\.at\) \|\| 0\)\)/.test(appHtml),
       "history trim orders by entry time, matching the display order");
    ok(appHtml.includes("wheelUI.pendingResult = r;"), "failed save restores the result for retry");
  });

  t("wheel: rules file has shape-locked admin-write wheel_history node", () => {
    const rules = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "database.rules.json"), "utf8"));
    const node = rules.rules.wheel_history;
    ok(node, "wheel_history node exists");
    eq(node[".read"], "auth != null", "authed read");
    ok(String(node[".write"]).includes("root.child('admins')"), "admin-only write");
    const wid = node["$wid"];
    ok(wid && wid["$other"] && wid["$other"][".validate"] === false, "$other locked");
    for (const f of ["at", "by", "winnerId", "winnerName", "prize"]) ok(wid[f], "field rule: " + f);
  });
})();

console.log("\n=== " + pass + " passed, " + fail + " failed ===\n");
if (fail) { console.log("FAILURES:\n  - " + failures.join("\n  - ") + "\n"); process.exit(1); }
