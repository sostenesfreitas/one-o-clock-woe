/* =====================================================================
 * WoE Event Bot — avisa eventos do dia no WhatsApp (+ Discord opcional)
 *
 * Horários em HORÁRIO DE BRASÍLIA (UTC-3, sem DST). O calendário do jogo
 * é UTC-4 — já convertido (+1h) na tabela abaixo.
 *
 * Uso:
 *   cd bot && npm install && node index.js       → roda o bot (QR na 1ª vez)
 *   node index.js --test                          → self-check da lógica
 *
 * Config por env (opcionais):
 *   WA_GROUP_INVITE      código do convite do grupo (default: grupo da guild)
 *   DISCORD_WEBHOOK_URL  se setado, espelha as mensagens no Discord
 * ===================================================================== */

// dia da semana (0=domingo) → [[HH:MM em BRT, nome do evento]]
const EVENTS = {
  0: [["20:30", "Themed Party"], ["20:55", "Emperium Overrun"]],
  1: [["01:00", "Extreme Challenge"], ["20:55", "Dimension Drill"]],
  2: [["20:55", "Guild League"]],
  3: [["20:55", "Dimension Drill"]],
  4: [["20:55", "Guild League"]],
  // 5 (sexta) e 6 (sábado): sem eventos
};

const REMIND_MIN   = 10;      // avisa N minutos antes do evento
const SUMMARY_AT   = "09:00"; // resumo diário dos eventos do dia
const GROUP_INVITE = process.env.WA_GROUP_INVITE || "JhiZtT8ul3I5JzPmn4ltpP";
const DISCORD_URL  = process.env.DISCORD_WEBHOOK_URL || "";

/* ---------- relógio Brasília (UTC-3 fixo — Brasil não tem DST) ---------- */
function brtNow(ms = Date.now()) { return new Date(ms - 3 * 3600 * 1000); }
function hhmm(d) {
  return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

/* ---------- lógica pura (testável) ---------- */
function todaysEvents(d) { return EVENTS[d.getUTCDay()] || []; }

// mensagens que devem sair no minuto `d` (BRT). Lembrete dispara REMIND_MIN
// antes do evento; eventos < REMIND_MIN após a meia-noite lembram no dia
// anterior (ex.: Extreme Challenge 01:00 de segunda → lembrete 00:50 segunda).
function messagesFor(d) {
  const out = [];
  const now = hhmm(d);
  if (now === SUMMARY_AT && todaysEvents(d).length) {
    const lines = todaysEvents(d).map(([t, n]) => `• ${t} — ${n}`).join("\n");
    out.push(`📅 *Eventos de hoje:*\n${lines}\n_(horário de Brasília)_`);
  }
  const ahead = new Date(d.getTime() + REMIND_MIN * 60 * 1000);
  for (const [t, n] of todaysEvents(ahead)) {
    if (t === hhmm(ahead)) out.push(`⏰ *${n}* começa às ${t} — faltam ${REMIND_MIN} minutos!`);
  }
  return out;
}

/* ---------- self-check ---------- */
if (process.argv.includes("--test")) {
  const assert = require("assert");
  const at = (isoUtc) => brtNow(Date.parse(isoUtc));
  // qua 2026-07-29 20:45 BRT = 23:45 UTC → lembrete do Dimension Drill 20:55
  let m = messagesFor(at("2026-07-29T23:45:00Z"));
  assert.strictEqual(m.length, 1);
  assert.ok(m[0].includes("Dimension Drill") && m[0].includes("20:55"), m[0]);
  // dom 20:20 BRT → lembrete do Themed Party 20:30
  m = messagesFor(at("2026-08-02T23:20:00Z"));
  assert.ok(m.length === 1 && m[0].includes("Themed Party"), JSON.stringify(m));
  // seg 00:50 BRT → lembrete do Extreme Challenge 01:00
  m = messagesFor(at("2026-08-03T03:50:00Z"));
  assert.ok(m.length === 1 && m[0].includes("Extreme Challenge"), JSON.stringify(m));
  // seg 09:00 BRT → resumo com 2 eventos
  m = messagesFor(at("2026-08-03T12:00:00Z"));
  assert.ok(m.length === 1 && m[0].includes("01:00") && m[0].includes("20:55"), JSON.stringify(m));
  // sex 09:00 BRT → sem eventos, sem resumo
  assert.strictEqual(messagesFor(at("2026-07-31T12:00:00Z")).length, 0);
  // qua 20:44 BRT → nada
  assert.strictEqual(messagesFor(at("2026-07-29T23:44:00Z")).length, 0);
  console.log("SELF-CHECK OK");
  process.exit(0);
}

/* ---------- envio ---------- */
async function sendDiscord(text) {
  if (!DISCORD_URL) return;
  try {
    // webhook usa markdown do Discord — *bold* do WhatsApp vira **bold**
    const content = text.replace(/\*([^*\n]+)\*/g, "**$1**");
    const r = await fetch(DISCORD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!r.ok) console.error("[discord] HTTP", r.status);
  } catch (e) { console.error("[discord]", e.message); }
}

/* ---------- WhatsApp (whatsapp-web.js — não-oficial; use número secundário) ---------- */
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: __dirname + "/.wwebjs_auth" }),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});

let groupId = null;

client.on("qr", (qr) => {
  console.log("Escaneie o QR abaixo com o WhatsApp do número do bot:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("[wa] conectado como", client.info.wid.user);
  try {
    const info = await client.getInviteInfo(GROUP_INVITE);
    groupId = typeof info.id === "string" ? info.id : info.id._serialized;
    const chats = await client.getChats();
    if (!chats.some((c) => c.id._serialized === groupId)) {
      await client.acceptInvite(GROUP_INVITE);
      console.log("[wa] entrei no grupo via convite");
    }
    console.log("[wa] grupo alvo:", info.subject || groupId);
  } catch (e) {
    console.error("[wa] não achei o grupo pelo convite:", e.message);
    console.error("     confira WA_GROUP_INVITE ou se o número já está no grupo.");
  }
});

async function broadcast(text) {
  console.log("[send]", text.split("\n")[0]);
  if (groupId) {
    try { await client.sendMessage(groupId, text); }
    catch (e) { console.error("[wa] envio falhou:", e.message); }
  } else {
    console.error("[wa] sem grupo — mensagem não enviada no WhatsApp");
  }
  await sendDiscord(text);
}

/* ---------- loop: checa a cada 20s, dispara 1x por minuto ---------- */
let lastMinute = "";
setInterval(async () => {
  const d = brtNow();
  const key = d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  if (key === lastMinute) return;
  lastMinute = key;
  for (const msg of messagesFor(d)) await broadcast(msg);
}, 20 * 1000);

client.initialize();
console.log("WoE Event Bot iniciando… (Ctrl+C para parar)");
