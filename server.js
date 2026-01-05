// =============================
// SERVER.JS — STABLE BASELINE + BOT7 (FRESH)
// =============================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

// -----------------------------
// SERVICE ROLE
// -----------------------------
const IS_MAIN = process.env.SERVICE_ROLE === "main";
console.log("🚦 Service role:", process.env.SERVICE_ROLE, "| IS_MAIN:", IS_MAIN);

const app = express();
app.use(express.json());

// -----------------------------
// STATE (MAIN ONLY)
// -----------------------------
const STATE_FILE = "./state.json";

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {}
  return { lastAlert: {}, trackingStart: {}, lastBig: {}, cooldownUntil: {} };
}

function saveState() {
  if (!IS_MAIN) return;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastAlert, trackingStart, lastBig, cooldownUntil }, null, 2));
  } catch (err) {
    console.error("❌ Failed to save state:", err);
  }
}

const persisted = loadState();

// -----------------------------
// ENV
// -----------------------------
const TELEGRAM = n => ({
  token: (process.env[`TELEGRAM_BOT_TOKEN_${n}`] || "").trim(),
  chat:  (process.env[`TELEGRAM_CHAT_ID_${n}`] || "").trim()
});

async function send(n, text) {
  const { token, chat } = TELEGRAM(n);
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  }).catch(() => {});
}

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// -----------------------------
// STORAGE
// -----------------------------
const events = {};
const recentHashes = new Set();
const cooldownUntil = persisted.cooldownUntil || {};
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};

function alertHash(symbol, group, ts) {
  return `${symbol}-${group}-${Math.floor(ts / 1000)}`;
}

function pruneOld(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (buf.length && buf[0].time < cutoff) buf.shift();
}

// -----------------------------
// NORMALIZATION
// -----------------------------
function normalizeFibLevel(group, body) {
  if (group === "G" && body.fib_level) {
    const v = parseFloat(body.fib_level);
    if (!isNaN(v)) return { numericLevels: [v, -v] };
  }
  if (group === "H" && body.level) {
    const v = parseFloat(body.level);
    if (!isNaN(v)) return { numericLevels: [v, -v] };
  }
  return { numericLevels: [] };
}

function saveAlert(symbol, group, ts, body) {
  if (!lastAlert[symbol]) lastAlert[symbol] = {};
  lastAlert[symbol][group] = { time: ts, payload: body };
}

function safeGet(symbol, group) {
  return lastAlert[symbol]?.[group] || null;
}

// =============================
// BOT7 — LEVEL TRANSITION (FRESH)
// =============================

const bot7Last = {};

function processBot7(symbol, group, ts, body) {
  if (!['G', 'H'].includes(group)) return;

  let raw;
  if (group === 'H') raw = parseFloat(body.level);
  if (group === 'G') raw = parseFloat(body.fib_level);
  if (isNaN(raw)) return;

  const abs = Math.abs(raw);

  const valid =
    (group === 'H' && [1.29, 1.35].includes(abs)) ||
    (group === 'G' && [1.29, 3.0].includes(abs));

  if (!valid) return;

  const prev = bot7Last[symbol];
  if (!prev) {
    bot7Last[symbol] = { group, abs, raw };
    return;
  }

  if (prev.group === group && prev.abs !== abs) {
    send(7,
      `📐 BOT7 LEVEL FLIP\n` +
      `Symbol: ${symbol}\n` +
      `Group: ${group}\n` +
      `From: ${prev.raw}\n` +
      `To: ${raw}`
    );
  }

  bot7Last[symbol] = { group, abs, raw };
}

// =============================
// WEBHOOK
// =============================

app.post('/incoming', (req, res) => {
  try {
    const body = req.body || {};
    const group = (body.group || '').trim();
    const symbol = (body.symbol || '').trim();
    const ts = nowMs();

    if (!group || !symbol) return res.sendStatus(200);

    const hash = alertHash(symbol, group, ts);
    if (recentHashes.has(hash)) return res.sendStatus(200);
    recentHashes.add(hash);
    setTimeout(() => recentHashes.delete(hash), 300000);

    if (!events[group]) events[group] = [];
    events[group].push({ time: ts, data: body });

    saveAlert(symbol, group, ts, body);
    saveState();

    processBot7(symbol, group, ts, body);

    res.sendStatus(200);
  } catch (err) {
    console.error('❌ /incoming error:', err);
    res.sendStatus(200);
  }
});

app.get('/ping', (_, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
