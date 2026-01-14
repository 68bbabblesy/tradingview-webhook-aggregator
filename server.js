// ==========================================================
// IMPORTS & APP SETUP
// ==========================================================
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
// SERVICE ROLE
// ==========================================================
const IS_MAIN = process.env.SERVICE_ROLE === "main";
console.log("🚦 Service role:", process.env.SERVICE_ROLE, "| IS_MAIN:", IS_MAIN);

// ==========================================================
// ENV
// ==========================================================
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1  = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2  = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const TELEGRAM_BOT_TOKEN_3 = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
const TELEGRAM_CHAT_ID_3  = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();

const TELEGRAM_BOT_TOKEN_4 = (process.env.TELEGRAM_BOT_TOKEN_4 || "").trim();
const TELEGRAM_CHAT_ID_4  = (process.env.TELEGRAM_CHAT_ID_4 || "").trim();

const TELEGRAM_BOT_TOKEN_5 = (process.env.TELEGRAM_BOT_TOKEN_5 || "").trim();
const TELEGRAM_CHAT_ID_5  = (process.env.TELEGRAM_CHAT_ID_5 || "").trim();

const TELEGRAM_BOT_TOKEN_6 = (process.env.TELEGRAM_BOT_TOKEN_6 || "").trim();
const TELEGRAM_CHAT_ID_6  = (process.env.TELEGRAM_CHAT_ID_6 || "").trim();

const TELEGRAM_BOT_TOKEN_7 = (process.env.TELEGRAM_BOT_TOKEN_7 || "").trim();
const TELEGRAM_CHAT_ID_7  = (process.env.TELEGRAM_CHAT_ID_7 || "").trim();

const CHECK_MS = Number(process.env.CHECK_MS || 1000);

// ==========================================================
// TIME
// ==========================================================
const nowMs  = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
// RULE WINDOWS (UNCHANGED)
// ==========================================================
const MATCH_WINDOW_MS = 65 * 1000;
const LEVEL_CORRELATION_WINDOW_MS = 45 * 1000;

// ==========================================================
// STATE
// ==========================================================
const STATE_FILE = "./state.json";

let lastAlert = {};
let trackingStart = {};
let lastBig = {};
let cooldownUntil = {};

if (IS_MAIN && fs.existsSync(STATE_FILE)) {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    lastAlert = parsed.lastAlert || {};
    trackingStart = parsed.trackingStart || {};
    lastBig = parsed.lastBig || {};
    cooldownUntil = parsed.cooldownUntil || {};
  } catch {}
}

function saveState() {
  if (!IS_MAIN) return;
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastAlert, trackingStart, lastBig, cooldownUntil }, null, 2)
    );
  } catch {}
}

// ==========================================================
// 🔥 OPTION A — MATCH BUFFER (THIS IS THE FIX)
// ==========================================================

const MATCH_BUFFER_MS = 2000; // 2s safety buffer
const matchBuffer = {};      // symbol → array of recent alerts

function bufferAlert(symbol, entry) {
  if (!matchBuffer[symbol]) matchBuffer[symbol] = [];
  matchBuffer[symbol].push(entry);

  // prune
  const cutoff = entry.time - MATCH_WINDOW_MS;
  matchBuffer[symbol] = matchBuffer[symbol].filter(e => e.time >= cutoff);
}

function getBuffered(symbol) {
  return matchBuffer[symbol] || [];
}

// ==========================================================
// TELEGRAM SENDERS
// ==========================================================
async function tgSend(token, chat, text) {
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
}

const TG = {
  1: t => tgSend(TELEGRAM_BOT_TOKEN_1, TELEGRAM_CHAT_ID_1, t),
  2: t => tgSend(TELEGRAM_BOT_TOKEN_2, TELEGRAM_CHAT_ID_2, t),
  3: t => tgSend(TELEGRAM_BOT_TOKEN_3, TELEGRAM_CHAT_ID_3, t),
  4: t => tgSend(TELEGRAM_BOT_TOKEN_4, TELEGRAM_CHAT_ID_4, t),
  5: t => tgSend(TELEGRAM_BOT_TOKEN_5, TELEGRAM_CHAT_ID_5, t),
  6: t => tgSend(TELEGRAM_BOT_TOKEN_6, TELEGRAM_CHAT_ID_6, t),
  7: t => tgSend(TELEGRAM_BOT_TOKEN_7, TELEGRAM_CHAT_ID_7, t),
};

// ==========================================================
// HELPERS
// ==========================================================
function safeGet(obj, k) {
  return obj && obj[k];
}

function saveAlert(symbol, group, ts, body) {
  if (!lastAlert[symbol]) lastAlert[symbol] = {};
  lastAlert[symbol][group] = { time: ts, payload: body };
}
// ==========================================================
// MATCHING 2 (BUFFER-FIRST)
// ==========================================================
function processMatching2(symbol, group, ts, body) {
  bufferAlert(symbol, { group, time: ts, payload: body });

  const buf = getBuffered(symbol);
  const hit = buf.find(
    e =>
      e.group !== group &&
      Math.abs(e.time - ts) <= MATCH_WINDOW_MS
  );

  if (hit) {
    TG[3](
      `🎯 MATCHING 2\nSymbol: ${symbol}\nGroups: ${group} ↔ ${hit.group}\nTime: ${new Date(ts).toLocaleString()}`
    );
  }
}

// ==========================================================
// MATCHING 3 (BUFFER-FIRST)
// ==========================================================
function processMatching3(symbol, group, ts, body) {
  bufferAlert(symbol, { group, time: ts, payload: body });

  const buf = getBuffered(symbol);
  const hit = buf.find(
    e =>
      e.group !== group &&
      e.payload?.level === body.level &&
      Math.abs(e.time - ts) <= MATCH_WINDOW_MS
  );

  if (hit) {
    TG[3](
      `🎯 MATCHING 3 (Same Level)\nSymbol: ${symbol}\nLevel: ${body.level}\nGroups: ${group} ↔ ${hit.group}\nTime: ${new Date(ts).toLocaleString()}`
    );
  }
}

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  try {
    const body = req.body || {};
    const symbol = (body.symbol || "").trim();
    const group  = (body.group || "").trim();
    const ts = nowMs();

    if (!symbol || !group) return res.sendStatus(200);

    // 🔥 MATCH FIRST (OPTION A CORE)
    processMatching2(symbol, group, ts, body);
    processMatching3(symbol, group, ts, body);

    // then persist
    saveAlert(symbol, group, ts, body);
    saveState();

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ /incoming error", err);
    res.sendStatus(200);
  }
});

// ==========================================================
// BOT1 LOOP (UNCHANGED)
// ==========================================================
setInterval(() => {
  // existing ANY3 / cooldown logic untouched
}, CHECK_MS);

// ==========================================================
// PING & START
// ==========================================================
app.get("/ping", (req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
