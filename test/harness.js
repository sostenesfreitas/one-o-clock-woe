"use strict";
/**
 * Test harness for the single-file woe-party app.
 *
 * Loads the REAL inline <script> from app.html into a Node `vm` context with
 * lightweight stubs for the browser APIs the app touches (DOM, Firebase,
 * localStorage, timers, etc.), then exposes the app's functions + live `state`
 * so tests can drive real code paths — no build step, no npm dependencies.
 *
 * Why a vm context: the app is vanilla JS in one HTML file. Function
 * declarations (computeAuction, buildAuctionView, ...) leak onto the context
 * global and are callable directly. `let state` / `const` are lexically scoped
 * and DON'T leak, so we inject a tiny export shim right before the boot block
 * to bridge them out (and to override isAdmin / todayBkkISO for deterministic
 * tests).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const INDEX_HTML = path.join(__dirname, "..", "app.html");

/** Extract the concatenated inline (non-src) <script> contents from the HTML. */
function extractInlineScript(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m, all = "";
  while ((m = re.exec(html))) {
    if (/\bsrc=/.test(m[1])) continue; // skip external <script src=...>
    all += m[2] + "\n";
  }
  return all;
}

/** A CSSStyleDeclaration-ish stub: indexable + the methods app code may call. */
function makeStyle() {
  return new Proxy({
    setProperty() {}, removeProperty() { return ""; }, getPropertyValue() { return ""; },
    item() { return ""; }, get length() { return 0; },
  }, {
    get(o, p) { return p in o ? o[p] : ""; },   // unknown CSS prop reads as ""
    set(o, p, v) { o[p] = v; return true; },     // and is assignable
  });
}

/** A forgiving fake DOM element: known props behave, unknown access is a no-op. */
function makeEl() {
  const t = {
    _html: "", _text: "",
    style: makeStyle(), dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; },
    get textContent() { return this._text; }, set textContent(v) { this._text = v; },
    value: "", selectionStart: 0, checked: false, offsetWidth: 0, offsetHeight: 0,
    appendChild(x) { return x; }, removeChild(x) { return x; }, insertBefore(x) { return x; },
    replaceChild(x) { return x; }, cloneNode() { return makeEl(); }, closest() { return null; },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; }, hasAttribute() { return false; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getElementsByClassName() { return []; }, getElementsByTagName() { return []; },
    focus() {}, blur() {}, click() {}, select() {}, setSelectionRange() {}, scrollIntoView() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    getContext() { return {}; }, remove() {},
  };
  return new Proxy(t, {
    get(o, p) { return p in o ? o[p] : (() => {}); },
    set(o, p, v) { o[p] = v; return true; },
  });
}

/** A universal callable/chainable stub for the Firebase compat SDK. */
function makeFirebaseStub() {
  const node = new Proxy(function () {}, {
    get() { return node; },
    apply() { return node; },
    construct() { return {}; },
  });
  return node;
}

/** Build a fresh sandbox, load the app, and return an API for tests. */
function loadApp() {
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const script = extractInlineScript(html);

  // Inject export hooks immediately before the boot block (`load();`). At this
  // point every function/const/let we need is already defined, and this runs
  // BEFORE the DOM/Firebase boot tail — so exports survive even if boot throws.
  const INJECT = `
;(function(){
  Object.defineProperty(globalThis, "__T_state", { configurable: true, get: function(){ return state; } });
  globalThis.__T_ADR  = AUCTION_DEFAULT_RATES;
  globalThis.__T_AIPP = AUCTION_ITEMS_PER_PAGE;
  globalThis.__T_APP_VERSION = (typeof APP_VERSION !== "undefined") ? APP_VERSION : null;
  globalThis.__T_setSearch = function(v){ _auctionSearch = v; };
  globalThis.__T_setAdmin  = function(v){ isAdmin = function(){ return !!v; }; };
  globalThis.__T_setToday  = function(v){ todayBkkISO = function(){ return v; }; };
  globalThis.__T_save = function(){ try { save(); } catch(e){} };
  globalThis.__T_setRosterCache = function(v){ rosterCache = v; };
  globalThis.__T_setMembersRef  = function(r){ _fbMembersRef = r; };
  globalThis.__T_ROSTER_LIMITS  = { fields: ROSTER_FIELD_MAX, cp: ROSTER_CP_MAX };
  globalThis.__T_wheelUI = function(){ return (typeof wheelUI !== "undefined") ? wheelUI : null; };
})();
`;
  const marker = "\nload();";
  const idx = script.indexOf(marker);
  if (idx === -1) throw new Error("harness: could not find boot marker `load();` to inject before");
  const injected = script.slice(0, idx) + "\n" + INJECT + script.slice(idx);

  const ls = new Map();
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    setTimeout: (fn) => { return 0; },          // don't actually defer in tests
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (fn) => { try { fn(0); } catch (e) {} return 0; },
    cancelAnimationFrame: () => {},
    localStorage: {
      getItem: (k) => (ls.has(k) ? ls.get(k) : null),
      setItem: (k, v) => ls.set(k, String(v)),
      removeItem: (k) => ls.delete(k),
      clear: () => ls.clear(),
      key: (i) => [...ls.keys()][i] || null,
      get length() { return ls.size; },
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
    Image: class { set src(_) {} },
    alert: () => {}, confirm: () => true, prompt: () => null,
    firebase: makeFirebaseStub(),
    navigator: { userAgent: "node-test", language: "th", clipboard: { writeText: () => Promise.resolve() } },
    // Real randomness for the prize wheel (assumes Uint32Array callers,
    // which is all the app uses). Cross-realm safe: fills via plain writes.
    crypto: {
      getRandomValues(arr) {
        const bytes = require("crypto").randomBytes(arr.length * 4);
        for (let i = 0; i < arr.length; i++) arr[i] = bytes.readUInt32LE(i * 4);
        return arr;
      },
    },
  };
  // document
  sandbox.document = {
    body: makeEl(), documentElement: makeEl(), head: makeEl(),
    cookie: "", readyState: "complete", title: "",
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    getElementsByClassName: () => [], getElementsByTagName: () => [],
    createElement: () => makeEl(), createElementNS: () => makeEl(), createTextNode: () => makeEl(),
    addEventListener: () => {}, removeEventListener: () => {},
  };
  // window === global (so window.foo resolves to the same bindings)
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.scrollTo = () => {};
  sandbox.scrollX = 0; sandbox.scrollY = 0;
  sandbox.innerWidth = 1280; sandbox.innerHeight = 800;
  sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  sandbox.getComputedStyle = () => ({ getPropertyValue: () => "" });
  sandbox.location = { href: "http://localhost/app.html", search: "", hash: "", reload() {}, assign() {}, replace() {} };

  const context = vm.createContext(sandbox);

  let bootError = null;
  try {
    vm.runInContext(injected, context, { filename: "index.inline.js" });
  } catch (e) {
    bootError = e; // boot block may throw on a DOM call we didn't stub — fine,
                   // all functions + state are already defined by then.
  }

  const need = (name) => {
    const v = context[name];
    if (typeof v !== "function") throw new Error(`harness: expected function '${name}' missing (bootError: ${bootError && bootError.message})`);
    return v;
  };

  return {
    bootError,
    ctx: context,
    get state() { return context.__T_state; },
    AUCTION_DEFAULT_RATES: context.__T_ADR,
    AUCTION_ITEMS_PER_PAGE: context.__T_AIPP,
    appVersion: context.__T_APP_VERSION,
    setAdmin: context.__T_setAdmin,
    setToday: context.__T_setToday,
    setSearch: context.__T_setSearch,
    setRosterCache: context.__T_setRosterCache,
    setMembersRef: context.__T_setMembersRef,
    rosterLimits: context.__T_ROSTER_LIMITS,
    wheelUI: () => context.__T_wheelUI(),
    // app functions (resolved live so isAdmin/today overrides take effect)
    call: (name, ...args) => need(name)(...args),
    fn: (name) => need(name),
  };
}

module.exports = { loadApp, extractInlineScript };
