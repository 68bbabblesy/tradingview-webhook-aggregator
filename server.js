import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ---- Env (trim to avoid hidden spaces/newlines) ----
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID   = (process.env.TELEGRAM_CHAT_ID || "").trim();
const WINDOW_SECONDS     = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());

// Quick startup visibility (safe: only prefix shown)
console.log("🔧 ENV CHECK", {
  hasToken: !!TELEGRAM_BOT_TOKEN,
  tokenPrefix: TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.slice(0, 8) : null,
  tokenHasColon: TELEGRAM_BOT_TOKEN.includes(":"),
  chatIdSet: !!TELEGRAM_CHAT_ID,
  windowSec: WINDOW_SECONDS,
  checkMs: CHECK_MS,
});

// ---- In-memory buffers per symbol ----
const events = Object.create(null); // { [symbol]: [{ time, data }] }

const nowMs = () => Date.now();
function pruneOld(buf, windowMs) {
  const cutoff = nowMs() - windowMs;
  // remove from the front while too old
  let i = 0;
  while (i < buf.length && buf[i].time < cutoff) i++;
  if (i > 0) buf.splice(0, i);
}

// ---- Webhook endpoint from TradingView ----
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const symbol = (body.symbol || "unknown").toString();

  if (!events[symbol]) events[symbol] = [];
  events[symbol].push({ time: nowMs(), data: body });
  pruneOld(events[symbol], WINDOW_SECONDS * 1000);

  console.log("📥 received", {
    symbol,
    body,
    windowSec: WINDOW_SECONDS,
    countNow: events[symbol].length,
  });

  // Always 200 so TV doesn't retry
  res.sendStatus(200);
});

// ---- Aggregation loop ----
setInterval(async () => {
  for (const symbol of Object.keys(events)) {
    const buf = events[symbol];
    pruneOld(buf, WINDOW_SECONDS * 1000);

    const count = buf.length;
    if (count >= 3) {
      const lines = [
        `🚨 ${count} alerts for ${symbol} within last ${WINDOW_SECONDS}s`,
        ...buf.map((e, i) => `${i + 1}. price=${e.data.price ?? "?"} time=${e.data.time ?? "?"}`),
      ];
      const text = lines.join("\n");

      try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
        });

        const bodyText = await r.text();
        console.log("📩 telegram", symbol, "status", r.status, "resp:", bodyText.slice(0, 300));

        // Clear only this symbol's buffer regardless of success to avoid spam loops
        events[symbol] = [];
      } catch (err) {
        console.error("❌ telegram error", err);
        events[symbol] = []; // still clear to avoid infinite retries
      }
    }
  }
}, CHECK_MS);

// ---- Diagnostics ----
app.get("/debug/:symbol", (req, res) => {
  const symbol = req.params.symbol;
  const buf = events[symbol] || [];
  pruneOld(buf, WINDOW_SECONDS * 1000);
  res.json({ symbol, windowSec: WINDOW_SECONDS, count: buf.length, sample: buf.slice(-5) });
});

app.get("/ping", (_req, res) => {
  res.json({ ok: true, windowSec: WINDOW_SECONDS, symbols: Object.keys(events) });
});

// ---- Start server ----
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`Running on :${PORT}`));
