// ==========================================================
//  IMPORTS & APP
// ==========================================================
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
//  TIME HELPERS
// ==========================================================
const nowMs  = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
//  ENV
// ==========================================================
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();
const TELEGRAM_BOT_TOKEN_3 = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
const TELEGRAM_CHAT_ID_3   = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();

const CHECK_MS         = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);
const ALERT_SECRET     = (process.env.ALERT_SECRET || "").trim();

// ==========================================================
//  BOT 1 RULES
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

RULES = RULES.map((r, i) => ({
  name: r.name || `rule${i+1}`,
  groups: r.groups || [],
  threshold: Number(r.threshold || 3),
  windowSeconds: Number(r.windowSeconds || 45)
}));

// ==========================================================
//  TELEGRAM SENDERS
// ==========================================================
const send = async (token, chat, text) => {
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
};

// ==========================================================
//  STORAGE (SAFE + BOUNDED)
// ==========================================================
const events = {};           // group -> [{time, data}]
const cooldownUntil = {};    // rule -> ts

function prune(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (buf.length && buf[0].time < cutoff) buf.shift();
}

// ==========================================================
//  WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  try {
    const body = req.body || {};
    if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

    const group  = (body.group || "").trim();
    const symbol = (body.symbol || "").trim();
    if (!group || !symbol) return res.sendStatus(200);

    if (!events[group]) events[group] = [];
    events[group].push({ time: nowMs(), data: body });

    res.sendStatus(200);
  } catch {
    res.sendStatus(200);
  }
});

// ==========================================================
//  BOT 1 LOOP (CORRECTED)
// ==========================================================
setInterval(async () => {
  for (const rule of RULES) {
    const { name, groups, threshold, windowSeconds } = rule;
    const windowMs = windowSeconds * 1000;

    let total = 0;
    const counts = {};

    for (const g of groups) {
      const buf = events[g] || [];
      prune(buf, windowMs);
      counts[g] = buf.length;
      total += buf.length;
    }

    const cd = cooldownUntil[name] || 0;
    if (total >= threshold && nowSec() >= cd) {
      const lines = [];
      lines.push(`🚨 ${name}: ${total} alerts in ${windowSeconds}s`);
      for (const g of groups) lines.push(`• ${g}: ${counts[g]}`);

      await send(TELEGRAM_BOT_TOKEN_1, TELEGRAM_CHAT_ID_1, lines.join("\n"));
      cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
    }
  }
}, CHECK_MS);

// ==========================================================
//  HEALTH
// ==========================================================
app.get("/health", (_, res) => {
  res.json({ ok: true, uptime_minutes: Math.floor(process.uptime() / 60) });
});

// ==========================================================
//  START
// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
