import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
// CONFIG
// ==========================================================
const PORT = Number(process.env.PORT || 10000);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// ==========================================================
// TELEGRAM
// ==========================================================
const TG1_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG1_CHAT  = process.env.TELEGRAM_CHAT_ID || "";

const TG2_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2 || "";
const TG2_CHAT  = process.env.TELEGRAM_CHAT_ID_2 || "";

const TG3_TOKEN = process.env.TELEGRAM_BOT_TOKEN_3 || "";
const TG3_CHAT  = process.env.TELEGRAM_CHAT_ID_3 || "";

async function send(token, chat, text) {
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text })
  });
}

// ==========================================================
// STATE (Bot 2 persistence)
// ==========================================================
const STATE_FILE = "./state.json";
let state = { lastBig: {}, trackingStart: {} };

try {
  if (fs.existsSync(STATE_FILE)) {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  }
} catch {}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ==========================================================
// RULES (Bot 1)
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

RULES = RULES.map(r => ({
  name: r.name,
  groups: r.groups,
  threshold: r.threshold,
  windowSeconds: r.windowSeconds || WINDOW_SECONDS_DEF
}));

// ==========================================================
// HELPERS
// ==========================================================
const now = () => Date.now();

function normalizeLevel(group, body) {
  if (group === "H" && body.level) return body.level;
  if (group === "G" && body.fib_level) return body.fib_level;
  return "";
}

// ==========================================================
// BOT 1 STORAGE (AGGREGATION ONLY)
// ==========================================================
const events = {};
const cooldownUntil = {};

function prune(buf, windowMs) {
  const cut = now() - windowMs;
  while (buf.length && buf[0].time < cut) buf.shift();
}

// ==========================================================
// BOT 2 + 3 STORAGE
// ==========================================================
const lastBig = state.lastBig;
const trackingStart = state.trackingStart;
const tracking4 = {}; // Bot 3

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const group = (body.group || "").trim();
  const symbol = (body.symbol || "").trim();
  const ts = now();

  if (!group || !symbol) return res.sendStatus(200);

  // ---------- BOT 1 BUFFER ----------
  if (!events[group]) events[group] = [];
  events[group].push({ time: ts, body });

  // ---------- BOT 2 TRACKING ----------
  const big = ["F", "G", "H"];
  if (big.includes(group)) {
    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    const lvl = normalizeLevel(group, body);
    if (!last) {
      lastBig[symbol] = ts;
    } else if (diff >= 5 * 3600000) {
      send(TG2_TOKEN, TG2_CHAT,
        `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group} (${lvl})\nFirst F/G/H in over 5 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
      );
      lastBig[symbol] = ts;
    } else if (diff >= 2 * 3600000) {
      send(TG2_TOKEN, TG2_CHAT,
        `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group} (${lvl})\nFirst F/G/H in over 2 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
      );
      lastBig[symbol] = ts;
    }
    saveState();
  }

  // ---------- BOT 3 (H SWITCH) ----------
  if (group === "H" && body.level) {
    const abs = Math.abs(Number(body.level));
    const prev = tracking4[symbol];
    if (prev && prev.abs !== abs) {
      const gap = ts - prev.time;
      send(TG3_TOKEN, TG3_CHAT,
        `🔄 TRACKING 4 SWITCH\nSymbol: ${symbol}\nFrom: H (${prev.raw})\nTo: H (${body.level})\nGap: ${(gap/60000).toFixed(1)}m`
      );
    }
    tracking4[symbol] = { abs, raw: body.level, time: ts };
  }

  res.sendStatus(200);
});

// ==========================================================
// BOT 1 LOOP (FIXED)
// ==========================================================
setInterval(async () => {
  for (const r of RULES) {
    const { name, groups, threshold, windowSeconds } = r;
    let total = 0;
    const counts = {};

    for (const g of groups) {
      if (!events[g]) events[g] = [];
      prune(events[g], windowSeconds * 1000);
      counts[g] = events[g].length;
      total += counts[g];
    }

    if (total >= threshold && (cooldownUntil[name] || 0) <= now()) {
      const lines = [];
      lines.push(`🚨 ${name}: ${total} alerts in ${windowSeconds}s`);
      for (const g of groups) lines.push(`• ${g}: ${counts[g]}`);
      lines.push("");
      lines.push("Recent:");

      for (const g of groups) {
        events[g].slice(-10).forEach(e => {
          const lvl = normalizeLevel(g, e.body);
          lines.push(`[${g}] ${e.body.symbol}${lvl ? ` (${lvl})` : ""}`);
        });
      }

      await send(TG1_TOKEN, TG1_CHAT, lines.join("\n"));

      // 🔴 HARD RESET (CRITICAL FIX)
      for (const g of groups) events[g] = [];

      cooldownUntil[name] = now() + COOLDOWN_SECONDS * 1000;
    }
  }
}, CHECK_MS);

// ==========================================================
//  TEST-ONLY ENDPOINT (STAGING ONLY)
//  Path: /incoming-test
//  Groups: M / N (isolated from prod logic)
// ==========================================================

// Separate in-memory state for test shifts ONLY
const testLastLevel = {}; 
// testLastLevel[symbol] = { level, time }

// Test Telegram sender (reuse Bot 3 or dedicated test bot)
async function sendTestTelegram(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

app.post("/incoming-test", (req, res) => {
    try {
        const body = req.body || {};

        const symbol = (body.symbol || "").trim();
        const group  = (body.group || "").trim(); // expect M or N
        const level  = Number(body.level);

        if (!symbol || !["M", "N"].includes(group) || isNaN(level)) {
            return res.sendStatus(200);
        }

        const ts = Date.now();
        const prev = testLastLevel[symbol];

        // First observation → store only
        if (!prev) {
            testLastLevel[symbol] = { level, time: ts };
            return res.sendStatus(200);
        }

        // Level changed → TEST SHIFT
        if (prev.level !== level) {
            const gapMs  = ts - prev.time;
            const gapMin = Math.floor(gapMs / 60000);
            const gapSec = Math.floor((gapMs % 60000) / 1000);

            sendTestTelegram(
                `🧪 TEST SHIFT\n` +
                `Symbol: ${symbol}\n` +
                `Group: ${group}\n` +
                `From: ${prev.level}\n` +
                `To: ${level}\n` +
                `Gap: ${gapMin}m ${gapSec}s\n` +
                `Time: ${new Date(ts).toLocaleString()}`
            );

            testLastLevel[symbol] = { level, time: ts };
        }

        res.sendStatus(200);

    } catch (err) {
        console.error("❌ /incoming-test error:", err);
        res.sendStatus(200);
    }
});

// ==========================================================
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
