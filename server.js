import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ---------- Env (trim + defaults) ----------
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID   = (process.env.TELEGRAM_CHAT_ID || "").trim();
const WINDOW_SECONDS_DEF = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET       = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS   = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// RULES is a JSON array. Example below in step 2.
let RULES = [];
try {
  const raw = (process.env.RULES || "").trim();
  RULES = raw ? JSON.parse(raw) : [];
} catch (e) {
  console.error("❌ Failed to parse RULES JSON:", e);
  RULES = [];
}

// Basic validation + defaults per rule
RULES = RULES.map((r, idx) => {
  const name = (r.name || `rule${idx + 1}`).toString();
  const groups = Array.isArray(r.groups) ? r.groups.map(s => String(s).trim()).filter(Boolean) : [];
  const required = r.required ? String(r.required).trim() : null; // can be null/undefined if not required
  const threshold = Number(r.threshold || 3);
  const windowSeconds = Number(r.windowSeconds || WINDOW_SECONDS_DEF);
  return { name, groups, required, threshold, windowSeconds };
}).filter(r => r.groups.length >= 1);

console.log("🔧 ENV CHECK", {
  hasToken: !!TELEGRAM_BOT_TOKEN,
  tokenPrefix: TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.slice(0, 8) : null,
  tokenHasColon: TELEGRAM_BOT_TOKEN.includes(":"),
  chatIdSet: !!TELEGRAM_CHAT_ID,
  checkMs: CHECK_MS,
  defaultWindow: WINDOW_SECONDS_DEF,
  cooldownSec: COOLDOWN_SECONDS,
  rules: RULES,
});

// ---------- In-memory store ----------
// events[group] = [{ time, data }, ...]
const events = Object.create(null);
// cooldowns per rule name: unixSec until which we suppress repeats
const cooldownUntil = Object.create(null);

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// Prune a buffer to only keep events within windowMs
function pruneOld(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  let i = 0;
  while (i < buf.length && buf[i].time < cutoff) i++;
  if (i > 0) buf.splice(0, i);
}

// Compute the maximum window across all rules so we can keep buffers big enough
function maxRuleWindowMs() {
  if (!RULES.length) return WINDOW_SECONDS_DEF * 1000;
  return Math.max(...RULES.map(r => r.windowSeconds)) * 1000;
}

// ---------- Webhook ----------
app.post("/incoming", (req, res) => {
  try {
    const body = req.body || {};
    if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
      console.log("❌ invalid secret");
      return res.sendStatus(401);
    }

    // Group key is required for multi-pair logic; fallback to symbol if you want
    const key = (body.group || body.symbol || "unknown").toString();

    if (!events[key]) events[key] = [];
    events[key].push({ time: nowMs(), data: body });

    // Prune using the largest window across all rules
    pruneOld(events[key], maxRuleWindowMs());

    console.log("📥 received", {
      key,
      body,
      countNow: events[key].length,
    });

    res.sendStatus(200);
  } catch (e) {
    console.error("❌ /incoming error:", e);
    res.sendStatus(200);
  }
});

// ---------- Aggregation loop ----------
setInterval(async () => {
  if (!RULES.length) return;

  const byGroup = (g) => {
    const buf = events[g] || (events[g] = []);
    return buf;
  };

  for (const rule of RULES) {
    const { name, groups, required, threshold, windowSeconds } = rule;

    // Trim each group's buffer to this rule's window (each rule can have different windows)
    for (const g of groups) pruneOld(byGroup(g), windowSeconds * 1000);

    // Count per group and sum
    const counts = {};
    let total = 0;
    for (const g of groups) {
      const c = byGroup(g).length;
      counts[g] = c;
      total += c;
    }
    const requiredCount = required ? (counts[required] || 0) : null;

    // Cooldown check
    const cds = cooldownUntil[name] || 0;
    const onCooldown = cds > nowSec();

    const passesRequired = required ? requiredCount >= 1 : true;
    const meetsThreshold = total >= threshold;

    if (meetsThreshold && passesRequired && !onCooldown) {
      // Build message
      const header = `🚨 Rule "${name}" fired: ${total} alerts in last ${windowSeconds}s`;
      const lines = [
        header,
        ...(required ? [`• required "${required}" count: ${requiredCount}`] : []),
        ...groups.map(g => `• ${g} count: ${counts[g] || 0}`),
        "",
        "Recent alerts:",
      ];

      // Include a few recent entries per group
      for (const g of groups) {
        const buf = byGroup(g);
        const tail = buf.slice(-Math.min(5, buf.length));
        tail.forEach((e, i) => {
          lines.push(`[${g}] #${buf.length - tail.length + i + 1} ` +
            `symbol=${e.data.symbol ?? "?"} price=${e.data.price ?? "?"} time=${e.data.time ?? "?"}`);
        });
      }
      const text = lines.join("\n");

      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
        });
        const resp = await r.text();
        console.log("📩 telegram", name, "status", r.status, "resp:", resp.slice(0, 300));
      } catch (err) {
        console.error("❌ telegram error", err);
      } finally {
        // Clear just these groups (so this rule doesn't immediately fire again on the same events)
        for (const g of groups) events[g] = [];
        // Start cooldown for this rule
        cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
      }
    }
  }
}, CHECK_MS);

// ---------- Diagnostics ----------
app.get("/rules", (_req, res) => {
  res.json({ rules: RULES });
});

app.get("/debug/:key", (req, res) => {
  const key = req.params.key;
  const buf = events[key] || [];
  // prune with max window just for a consistent view
  pruneOld(buf, maxRuleWindowMs());
  res.json({ key, count: buf.length, sample: buf.slice(-5) });
});

app.get("/ping", (_req, res) => {
  res.json({ ok: true, groupsKnown: Object.keys(events), rules: RULES.map(r => r.name) });
});

// ---------- Start ----------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`Running on :${PORT}`));
