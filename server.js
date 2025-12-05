import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ---------- Env ----------
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET       = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS   = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// RULES from ENV (for ANY3 aggregation etc.)
let RULES = [];
try {
  const raw = (process.env.RULES || "").trim();
  RULES = raw ? JSON.parse(raw) : [];
} catch (e) {
  console.error("❌ Failed to parse RULES JSON:", e);
  RULES = [];
}

// Normalize rules
RULES = RULES.map((r, idx) => ({
  name: (r.name || `rule${idx + 1}`).toString(),
  groups: Array.isArray(r.groups) ? r.groups.map(s => String(s).trim()).filter(Boolean) : [],
  required: r.required || null,
  threshold: Number(r.threshold || 3),
  windowSeconds: Number(r.windowSeconds || WINDOW_SECONDS_DEF)
})).filter(r => r.groups.length);

// ---------- Senders ----------
async function sendToTelegram1(text) {
  if (!TELEGRAM_BOT_TOKEN_1 || !TELEGRAM_CHAT_ID_1) {
    console.error("❌ Bot 1 credentials missing");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_1}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_1, text })
  });
}

async function sendToTelegram2(text) {
  if (!TELEGRAM_BOT_TOKEN_2 || !TELEGRAM_CHAT_ID_2) {
    console.error("❌ Bot 2 credentials missing");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_2}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_2, text })
  });
}

// ---------- Buffers ----------
const events = {};          // events[group] = []
const cooldownUntil = {};   // cooldown until next aggregation per rule

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

function pruneOld(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  while (buf.length && buf[0].time < cutoff) buf.shift();
}

function maxRuleWindowMs() {
  return RULES.length
    ? Math.max(...RULES.map(r => r.windowSeconds)) * 1000
    : WINDOW_SECONDS_DEF * 1000;
}

// ---------- Webhook ----------
app.post("/incoming", async (req, res) => {
  try {
    const body = req.body || {};

    if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
      console.log("❌ invalid secret");
      return res.sendStatus(401);
    }

    const direction = (body.direction || "").toLowerCase();
    const momentum  = (body.momentum || "").toLowerCase();
    const symbol    = body.symbol || "?";

    // ---------- STRONG SIGNAL ----------
    const strong = (direction === momentum);

    if (strong) {
      const msg = `🔥 STRONG SIGNAL\n` +
                  `Symbol: ${symbol}\n` +
                  `Direction: ${direction}\n` +
                  `Momentum: ${momentum}`;

      await sendToTelegram2(msg);   // Bot2 gets strong signals
    }

    // ---------- ALWAYS continue to aggregator ----------
    const key = (body.group || body.symbol || "unknown").toString();
    if (!events[key]) events[key] = [];
    events[key].push({ time: nowMs(), data: body });

    pruneOld(events[key], maxRuleWindowMs());

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ /incoming error", err);
    res.sendStatus(200);
  }
});

// ---------- Aggregation Loop (unchanged) ----------
setInterval(async () => {
  if (!RULES.length) return;

  const byGroup = g => (events[g] || (events[g] = []));

  for (const rule of RULES) {
    const { name, groups, required, threshold, windowSeconds } = rule;

    for (const g of groups) pruneOld(byGroup(g), windowSeconds * 1000);

    const counts = {};
    let total = 0;

    for (const g of groups) {
      const c = byGroup(g).length;
      counts[g] = c;
      total += c;
    }

    const requiredCount = required ? (counts[required] || 0) : null;
    const onCooldown = (cooldownUntil[name] || 0) > nowSec();

    if (total >= threshold && (!required || requiredCount >= 1) && !onCooldown) {
      let text = `🚨 Rule "${name}" fired (${total} alerts)\n`;
      for (const g of groups) text += `• ${g}: ${counts[g]}\n`;

      await sendToTelegram1(text);

      for (const g of groups) events[g] = [];
      cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
    }
  }
}, CHECK_MS);

// ---------- Start ----------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`Running on :${PORT}`));
