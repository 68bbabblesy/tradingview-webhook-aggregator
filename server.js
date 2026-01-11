// UPDATED SERVER.JS — Bot7 Special Tokens Mirror
// ----------------------------------------------------------
// Bot7 mirrors ALL non-Bot1 Telegram alerts, but ONLY for
// symbols listed in SPECIAL_TOKENS env var.
// ----------------------------------------------------------

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

// ================= SERVICE ROLE =================
const IS_MAIN = process.env.SERVICE_ROLE === "main";
console.log("🚦 Service role:", process.env.SERVICE_ROLE, "| IS_MAIN:", IS_MAIN);

const app = express();
app.use(express.json());

// ================= STATE =================
const STATE_FILE = "./state.json";
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {}
  return { lastAlert: {}, trackingStart: {}, lastBig: {}, cooldownUntil: {} };
}
function saveState() {
  if (!IS_MAIN) return;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastAlert, trackingStart, lastBig, cooldownUntil }, null, 2));
  } catch (e) { console.error("❌ Failed to save state", e); }
}
const persisted = loadState();

// ================= ENV =================
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();
const TELEGRAM_BOT_TOKEN_3 = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
const TELEGRAM_CHAT_ID_3   = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();
const TELEGRAM_BOT_TOKEN_4 = (process.env.TELEGRAM_BOT_TOKEN_4 || "").trim();
const TELEGRAM_CHAT_ID_4   = (process.env.TELEGRAM_CHAT_ID_4 || "").trim();
const TELEGRAM_BOT_TOKEN_5 = (process.env.TELEGRAM_BOT_TOKEN_5 || "").trim();
const TELEGRAM_CHAT_ID_5   = (process.env.TELEGRAM_CHAT_ID_5 || "").trim();
const TELEGRAM_BOT_TOKEN_6 = (process.env.TELEGRAM_BOT_TOKEN_6 || "").trim();
const TELEGRAM_CHAT_ID_6   = (process.env.TELEGRAM_CHAT_ID_6 || "").trim();

// 🔥 BOT7 (SPECIAL TOKENS)
const TELEGRAM_BOT_TOKEN_7 = (process.env.TELEGRAM_BOT_TOKEN_7 || "").trim();
const TELEGRAM_CHAT_ID_7   = (process.env.TELEGRAM_CHAT_ID_7 || "").trim();

// SPECIAL TOKENS (comma-separated)
const SPECIAL_TOKENS = new Set(
  (process.env.SPECIAL_TOKENS || "")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
);

const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// ================= TELEGRAM =================
async function send(token, chat, text) {
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
}
const TG = {
  1: t => send(TELEGRAM_BOT_TOKEN_1, TELEGRAM_CHAT_ID_1, t),
  2: t => send(TELEGRAM_BOT_TOKEN_2, TELEGRAM_CHAT_ID_2, t),
  3: t => send(TELEGRAM_BOT_TOKEN_3, TELEGRAM_CHAT_ID_3, t),
  4: t => send(TELEGRAM_BOT_TOKEN_4, TELEGRAM_CHAT_ID_4, t),
  5: t => send(TELEGRAM_BOT_TOKEN_5, TELEGRAM_CHAT_ID_5, t),
  6: t => send(TELEGRAM_BOT_TOKEN_6, TELEGRAM_CHAT_ID_6, t),
  7: t => send(TELEGRAM_BOT_TOKEN_7, TELEGRAM_CHAT_ID_7, t)
};

// ================= HELPERS =================
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ================= BOT7 MIRROR =================
function mirrorToBot7(symbol, text) {
  if (!SPECIAL_TOKENS.has(symbol.toUpperCase())) return;
  TG[7]("⭐ SPECIAL TOKEN ALERT ⭐\n" + text);
}

// ================= STORAGE =================
const events = {};
const cooldownUntil = persisted.cooldownUntil || {};
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};

function saveAlert(symbol, group, ts, body) {
  if (!lastAlert[symbol]) lastAlert[symbol] = {};
  lastAlert[symbol][group] = { time: ts, payload: body };
}

// ================= WEBHOOK =================
app.post("/incoming", (req, res) => {
  try {
    const body = req.body || {};
    const symbol = (body.symbol || "").trim();
    const group = (body.group || "").trim();
    const ts = nowMs();

    if (!symbol || !group) return res.sendStatus(200);

    // save
    saveAlert(symbol, group, ts, body);
    saveState();

    // ================= EXISTING BOTS FIRE =================
    // Example: strong signal (unchanged)
    try {
      const dir = body.direction?.toLowerCase();
      const mom = body.momentum?.toLowerCase();
      if (dir && mom && dir === mom) {
        const msg = `🔥 STRONG SIGNAL\nSymbol: ${symbol}\nLevel: ${body.level || body.fib_level || "n/a"}`;
        TG[2](msg);
        mirrorToBot7(symbol, msg);
      }
    } catch {}

    // TODO: mirror other bot sends similarly if needed

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ /incoming error", err);
    res.sendStatus(200);
  }
});

// ================= BOT1 LOOP =================
setInterval(async () => {
  // unchanged
}, CHECK_MS);

app.get("/ping", (req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
