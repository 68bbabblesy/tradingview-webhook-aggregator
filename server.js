import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
// CONFIG
// ==========================================================
const PORT = Number(process.env.PORT || 10000);
const WINDOW_SECONDS = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// Telegram
const BOT1_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const BOT1_CHAT  = (process.env.TELEGRAM_CHAT_ID || "").trim();
const BOT2_TOKEN = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const BOT2_CHAT  = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();
const BOT3_TOKEN = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
const BOT3_CHAT  = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();

// ==========================================================
// HELPERS
// ==========================================================
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

async function send(token, chat, text) {
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
}

// ==========================================================
// BOT 1 — AGGREGATION (STABLE)
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

const events = {};
const cooldownUntil = {};

function prune(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (buf.length && buf[0].time < cutoff) buf.shift();
}

setInterval(async () => {
  for (const rule of RULES) {
    const groups = rule.groups || [];
    const windowMs = (rule.windowSeconds || WINDOW_SECONDS) * 1000;
    const threshold = rule.threshold || 3;

    let total = 0;
    const counts = {};

    for (const g of groups) {
      if (!events[g]) events[g] = [];
      prune(events[g], windowMs);
      counts[g] = events[g].length;
      total += counts[g];
    }

    if (total >= threshold && (cooldownUntil[rule.name] || 0) <= nowSec()) {
      const lines = [`🚨 ANY3: ${total} alerts in ${windowMs/1000}s`];
      for (const g of groups) lines.push(`• ${g}: ${counts[g]}`);

      lines.push("\nRecent:");
      for (const g of groups) {
        events[g].slice(-5).forEach(e => {
          const lvl = e.data.level || e.data.fib_level || "";
          lines.push(`[${g}] ${e.data.symbol}${lvl ? ` (${lvl})` : ""}`);
        });
      }

      await send(BOT1_TOKEN, BOT1_CHAT, lines.join("\n"));
      cooldownUntil[rule.name] = nowSec() + COOLDOWN_SECONDS;
    }
  }
}, CHECK_MS);

// ==========================================================
// BOT 2 — TRACKING & MATCHING (RESTORED)
// ==========================================================
const lastAlert = {};
const trackingStart = {};
const lastBig = {};

// ---------- normalize ----------
function normalizeLevel(group, body) {
  if (group === "H" && body.level) return body.level;
  if (group === "G" && body.fib_level) return body.fib_level;
  return "";
}

function saveAlert(symbol, group, ts, body) {
  if (!lastAlert[symbol]) lastAlert[symbol] = {};
  lastAlert[symbol][group] = { time: ts, body };
}

function get(symbol, group) {
  return lastAlert[symbol]?.[group] || null;
}

// ---------- TRACKING 1 (RESTORED) ----------
function tracking1(symbol, group, ts, body) {
  const START = ["A","B","C","D"];
  const END   = ["G","H"];

  if (START.includes(group)) {
    trackingStart[symbol] = { group, ts, body };
    return;
  }

  if (END.includes(group) && trackingStart[symbol]) {
    const s = trackingStart[symbol];
    const startLvl = normalizeLevel(s.group, s.body);
    const endLvl   = normalizeLevel(group, body);

    send(
      BOT2_TOKEN,
      BOT2_CHAT,
      `📌 TRACKING 1 COMPLETE\n` +
      `Symbol: ${symbol}\n` +
      `Start: ${s.group}${startLvl ? ` (${startLvl})` : ""}\n` +
      `End: ${group}${endLvl ? ` (${endLvl})` : ""}\n` +
      `Gap: ${((ts - s.ts)/60000).toFixed(2)} min`
    );

    delete trackingStart[symbol];
  }
}

// ---------- TRACKING 2 & 3 ----------
function tracking2and3(symbol, group, ts, body) {
  if (!["F","G","H"].includes(group)) return;

  const last = lastBig[symbol];
  lastBig[symbol] = ts;

  if (!last) return;

  const diffH = (ts - last) / 3600000;
  const lvl = normalizeLevel(group, body);

  if (diffH >= 5) {
    send(BOT2_TOKEN, BOT2_CHAT,
      `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group}${lvl ? ` (${lvl})` : ""}\nGap: ${diffH.toFixed(2)}h`
    );
  } else if (diffH >= 2) {
    send(BOT2_TOKEN, BOT2_CHAT,
      `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group}${lvl ? ` (${lvl})` : ""}\nGap: ${diffH.toFixed(2)}h`
    );
  }
}

// ---------- MATCHING 1 (RESTORED) ----------
const MATCH_MS = 65 * 1000;

function matching1(symbol, group, ts) {
  const AD = ["A","B","C","D"];
  const FGH = ["F","G","H"];

  if (AD.includes(group)) {
    for (const g of FGH) {
      const c = get(symbol, g);
      if (c && ts - c.time <= MATCH_MS) {
        send(BOT2_TOKEN, BOT2_CHAT,
          `🔁 MATCHING 1\nSymbol: ${symbol}\n${group} ↔ ${g}`
        );
        return;
      }
    }
  }

  if (FGH.includes(group)) {
    for (const g of AD) {
      const c = get(symbol, g);
      if (c && ts - c.time <= MATCH_MS) {
        send(BOT2_TOKEN, BOT2_CHAT,
          `🔁 MATCHING 1\nSymbol: ${symbol}\n${g} ↔ ${group}`
        );
        return;
      }
    }
  }
}

// ---------- AD DIVERGENCE (RESTORED) ----------
function adDivergence(symbol, group, ts) {
  const AD = ["A","B","C","D"];
  if (!AD.includes(group)) return;

  for (const g of AD) {
    if (g === group) continue;
    const c = get(symbol, g);
    if (c && Math.abs(ts - c.time) <= MATCH_MS) {
      send(BOT2_TOKEN, BOT2_CHAT,
        `🔁 AD DIVERGENCE\nSymbol: ${symbol}\n${g} ↔ ${group}`
      );
      return;
    }
  }
}

// ==========================================================
// BOT 3 — UNCHANGED
// ==========================================================
const lastH = {};
function bot3(symbol, group, ts, body) {
  if (group !== "H" || !body.level) return;
  const lvl = Math.abs(Number(body.level));
  const prev = lastH[symbol];
  if (!prev) {
    lastH[symbol] = { lvl, ts };
    return;
  }
  if (prev.lvl !== lvl) {
    send(BOT3_TOKEN, BOT3_CHAT,
      `🔄 TRACKING 4 SWITCH\nSymbol: ${symbol}\n${prev.lvl} → ${lvl}\nGap: ${((ts-prev.ts)/60000).toFixed(1)}m`
    );
    lastH[symbol] = { lvl, ts };
  }
}

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const group = body.group;
  const symbol = body.symbol;
  if (!group || !symbol) return res.sendStatus(200);

  const ts = nowMs();

  if (!events[group]) events[group] = [];
  events[group].push({ time: ts, data: body });

  saveAlert(symbol, group, ts, body);

  tracking1(symbol, group, ts, body);
  tracking2and3(symbol, group, ts, body);
  matching1(symbol, group, ts);
  adDivergence(symbol, group, ts);
  bot3(symbol, group, ts, body);

  res.sendStatus(200);
});

// ==========================================================
app.listen(PORT, () => console.log("🚀 PROD running"));
