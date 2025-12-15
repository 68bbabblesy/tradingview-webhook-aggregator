import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ==========================================================
// ENV
// ==========================================================
const BOT1_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT1_CHAT  = process.env.TELEGRAM_CHAT_ID || "";

const BOT2_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2 || "";
const BOT2_CHAT  = process.env.TELEGRAM_CHAT_ID_2 || "";

const WINDOW_SECONDS = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

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
// BOT 1 — AGGREGATION (FIXED)
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch {
  RULES = [];
}

RULES = RULES.map((r, i) => ({
  name: r.name || `rule${i + 1}`,
  groups: r.groups || [],
  threshold: Number(r.threshold || 3),
  windowSeconds: Number(r.windowSeconds || WINDOW_SECONDS)
}));

const events = {};
const cooldownUntil = {};

function prune(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (buf.length && buf[0].time < cutoff) buf.shift();
}

// ==========================================================
// BOT 2 — STORAGE
// ==========================================================
const lastAlert = {};
const trackingStart = {};
const lastBig = {};

// ==========================================================
// NORMALIZE
// ==========================================================
function normalize(group, body) {
  if (group === "H" && body.level) {
    const n = Number(body.level);
    if (!isNaN(n)) return [n, -n];
  }
  if (group === "G" && body.fib_level) {
    const n = Number(body.fib_level);
    if (!isNaN(n)) return [n, -n];
  }
  if (group === "F") return [1.3, -1.3];
  return [];
}

function saveAlert(symbol, group, ts, body) {
  if (!lastAlert[symbol]) lastAlert[symbol] = {};
  lastAlert[symbol][group] = { time: ts, payload: body };
}

function get(symbol, group) {
  return lastAlert[symbol]?.[group];
}

// ==========================================================
// BOT 2 — TRACKING
// ==========================================================
function tracking1(symbol, group, ts, body) {
  const start = ["A","B","C","D"];
  const end = ["G","H"];

  if (start.includes(group)) {
    trackingStart[symbol] = { group, ts, body };
    return;
  }

  if (end.includes(group) && trackingStart[symbol]) {
    const s = trackingStart[symbol];
    send(
      BOT2_TOKEN,
      BOT2_CHAT,
      `📌 TRACKING 1\nSymbol: ${symbol}\n${s.group} → ${group}\n${new Date(s.ts).toLocaleString()} → ${new Date(ts).toLocaleString()}`
    );
    delete trackingStart[symbol];
  }
}

function tracking2and3(symbol, group, ts) {
  if (!["F","G","H"].includes(group)) return;

  const prev = lastBig[symbol];
  lastBig[symbol] = ts;

  if (!prev) return;

  const diff = ts - prev;
  const hrs = diff / 3600000;

  if (hrs >= 5) {
    send(
      BOT2_TOKEN,
      BOT2_CHAT,
      `⏱ TRACKING 3\nSymbol: ${symbol}\nFirst F/G/H in ${hrs.toFixed(2)}h`
    );
  } else if (hrs >= 2) {
    send(
      BOT2_TOKEN,
      BOT2_CHAT,
      `⏱ TRACKING 2\nSymbol: ${symbol}\nFirst F/G/H in ${hrs.toFixed(2)}h`
    );
  }
}

// ==========================================================
// BOT 2 — MATCHING
// ==========================================================
const MATCH_WINDOW = 65 * 1000;

function matching1(symbol, group, ts) {
  const AD = ["A","B","C","D"];
  const FGH = ["F","G","H"];

  if (AD.includes(group)) {
    const hit = FGH.map(g => get(symbol,g))
      .find(x => x && ts - x.time <= MATCH_WINDOW);
    if (hit) send(BOT2_TOKEN,BOT2_CHAT,`🔁 MATCHING 1\n${symbol}: ${group} ↔ ${hit.payload.group}`);
  }

  if (FGH.includes(group)) {
    const hit = AD.map(g => get(symbol,g))
      .find(x => x && ts - x.time <= MATCH_WINDOW);
    if (hit) send(BOT2_TOKEN,BOT2_CHAT,`🔁 MATCHING 1\n${symbol}: ${hit.payload.group} ↔ ${group}`);
  }
}

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const symbol = body.symbol;
  const group = body.group;
  const ts = nowMs();

  if (!symbol || !group) return res.sendStatus(200);

  if (!events[group]) events[group] = [];
  events[group].push({ time: ts, body });

  saveAlert(symbol, group, ts, body);

  tracking1(symbol, group, ts, body);
  tracking2and3(symbol, group, ts);
  matching1(symbol, group, ts);

  res.sendStatus(200);
});

// ==========================================================
// BOT 1 LOOP
// ==========================================================
setInterval(async () => {
  for (const r of RULES) {
    const windowMs = r.windowSeconds * 1000;
    let total = 0;
    const counts = {};

    for (const g of r.groups) {
      if (!events[g]) events[g] = [];
      prune(events[g], windowMs);
      counts[g] = events[g].length;
      total += counts[g];
    }

    if (total >= r.threshold && (cooldownUntil[r.name] || 0) <= nowSec()) {
      const lines = [];
      lines.push(`🚨 ${r.name}: ${total} alerts in ${r.windowSeconds}s`);
      for (const g of r.groups) lines.push(`• ${g}: ${counts[g]}`);
      lines.push("");
      lines.push("Recent:");
      for (const g of r.groups) {
        events[g].forEach(e => lines.push(`[${g}] ${e.body.symbol}`));
      }

      await send(BOT1_TOKEN, BOT1_CHAT, lines.join("\n"));
      cooldownUntil[r.name] = nowSec() + COOLDOWN_SECONDS;
    }
  }
}, CHECK_MS);

// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log("🚀 Server running"));
