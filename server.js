import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const WINDOW_SECONDS     = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS           = Number(process.env.CHECK_MS || 1000); // check every 1s

// Keep a rolling buffer per symbol: { [symbol]: [{time, data}, ...] }
const events = Object.create(null);

function nowMs() { return Date.now(); }
function pruneOld(arr) {
  const cutoff = nowMs() - WINDOW_SECONDS * 1000;
  let i = 0;
  while (i < arr.length && arr[i].time < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

// Incoming TradingView alerts
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const symbol = body.symbol || "unknown";

  if (!events[symbol]) events[symbol] = [];
  events[symbol].push({ data: body, time: nowMs() });

  // keep buffer roughly ordered by time (push already preserves order)
  pruneOld(events[symbol]);

  console.log("📥 received", { symbol, body, windowSec: WINDOW_SECONDS, countNow: events[symbol].length });
  res.sendStatus(200);
});

// Aggregation loop
setInterval(async () => {
  for (const symbol of Object.keys(events)) {
    const buf = events[symbol];
    pruneOld(buf);

    const count = buf.length;
    if (count >= 3) {
      const msg =
        `🚨 ${count} alerts for ${symbol} within last ${WINDOW_SECONDS}s\n` +
        buf.map((e, i) => `${i + 1}. price=${e.data.price ?? "?"} time=${e.data.time ?? "?"}`).join("\n");

      try {
        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg }),
        });
        console.log("📩 telegram", symbol, "status", r.status);
        // reset just this symbol’s buffer so other symbols aren’t affected
        events[symbol] = [];
      } catch (err) {
        console.error("❌ telegram error", err);
      }
    }
  }
}, CHECK_MS);

// Simple diagnostics
app.get("/debug/:symbol", (req, res) => {
  const symbol = req.params.symbol;
  const buf = events[symbol] || [];
  pruneOld(buf);
  res.json({ symbol, windowSec: WINDOW_SECONDS, count: buf.length, sample: buf.slice(-5) });
});

app.get("/ping", (_req, res) => res.json({ ok: true, windowSec: WINDOW_SECONDS, symbols: Object.keys(events) }));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Running on :${PORT}`));
