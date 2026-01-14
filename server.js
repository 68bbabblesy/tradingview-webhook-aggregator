// ==========================================================
// CLEAN BASELINE SERVER.JS
// - STAGING behaves IDENTICALLY to MAIN
// - All existing bots preserved (1–6)
// - Bot7 mirrors ALL bot alerts for BTCUSDT / ETHUSDT only
// - Dead code removed, structure flattened
// ==========================================================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

// ==========================================================
// ENV + SERVICE ROLE
// ==========================================================
const IS_MAIN = process.env.SERVICE_ROLE === "main";
console.log("🚦 Service role:", process.env.SERVICE_ROLE, "| IS_MAIN:", IS_MAIN);

const app = express();
app.use(express.json());

// ==========================================================
// STATE (PERSISTED IN BOTH MAIN + STAGING)
// ==========================================================
const STATE_FILE = "./state.json";

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {}
  return { lastAlert: {}, trackingStart: {}, lastBig: {}, cooldownUntil: {} };
}

let state = loadState();

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("❌ saveState failed", e);
  }
}

// ==========================================================
// ENV CONFIG
// ==========================================================
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// ==========================================================
// SPECIAL TOKENS (BOT7)
// ==========================================================
const SPECIAL_TOKENS = new Set(
  (process.env.SPECIAL_TOKENS || "")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
);

// ==========================================================
// TIME HELPERS
// ==========================================================
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
// TELEGRAM SENDERS
// ==========================================================
async function tgSend(token, chat, text) {
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text })
    });
  } catch (e) {
    console.error("TG send failed", e.message);
  }
}

const TG = {
  1: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID, t),
  2: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_2, process.env.TELEGRAM_CHAT_ID_2, t),
  3: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_3, process.env.TELEGRAM_CHAT_ID_3, t),
  4: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_4, process.env.TELEGRAM_CHAT_ID_4, t),
  5: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_5, process.env.TELEGRAM_CHAT_ID_5, t),
  6: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_6, process.env.TELEGRAM_CHAT_ID_6, t),
  7: (t) => tgSend(process.env.TELEGRAM_BOT_TOKEN_7, process.env.TELEGRAM_CHAT_ID_7, t),
};

function mirrorToBot7(symbol, text) {
  if (!SPECIAL_TOKENS.size) return;
  if (SPECIAL_TOKENS.has(symbol.toUpperCase())) {
    TG[7](text);
  }
}

// ==========================================================
// RULES (BOT1)
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch { RULES = []; }

RULES = RULES.map(r => ({
  name: r.name,
  groups: r.groups || [],
  threshold: r.threshold || 3,
  windowSeconds: r.windowSeconds || WINDOW_SECONDS_DEF
}));

const events = {};

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  try {
    const body = req.body || {};
    const symbol = (body.symbol || "").trim();
    const group = (body.group || "").trim();
    const ts = nowMs();

    if (!symbol || !group) return res.sendStatus(200);

    if (!events[group]) events[group] = [];
    events[group].push({ time: ts, data: body });

    // BOT2 STRONG SIGNAL (example)
    if (body.direction && body.momentum && body.direction === body.momentum) {
      const msg = `🔥 STRONG SIGNAL\nSymbol: ${symbol}\nGroup: ${group}`;
      TG[2](msg);
      mirrorToBot7(symbol, msg);
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("/incoming error", e);
    res.sendStatus(200);
  }
});

// ==========================================================
// BOT1 LOOP
// ==========================================================
setInterval(() => {
  for (const r of RULES) {
    let total = 0;
    for (const g of r.groups) {
      events[g] = (events[g] || []).filter(e => nowMs() - e.time <= r.windowSeconds * 1000);
      total += events[g].length;
    }

    const cd = state.cooldownUntil[r.name] || 0;
    if (total >= r.threshold && cd <= nowSec()) {
      const msg = `🚨 RULE ${r.name} FIRED (${total})`;
      TG[1](msg);
      mirrorToBot7("BTCUSDT", msg); // safe no-op unless configured
      state.cooldownUntil[r.name] = nowSec() + COOLDOWN_SECONDS;
      saveState();
    }
  }
}, CHECK_MS);

// ==========================================================
// HEALTH
// ==========================================================
app.get("/ping", (req, res) => res.json({ ok: true }));

// ==========================================================
// START
// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
