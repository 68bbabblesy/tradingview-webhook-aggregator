import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Environment variables (set these in Render)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let events = [];

// Handle incoming TradingView alerts
app.post("/incoming", (req, res) => {
  events.push({ data: req.body, time: Date.now() });
  console.log("✅ Webhook received:", req.body);
  res.sendStatus(200);
});

// Every 5 seconds, check number of alerts received in last 45 seconds
setInterval(async () => {
  const now = Date.now();

  // Keep only events from the last 45 seconds
  events = events.filter(e => now - e.time < 45000);

  if (events.length >= 3) {
    const message = `🚨 ${events.length} alerts received within 45 seconds!\nSymbols:\n${events
      .map(e => e.data.symbol)
      .join(", ")}`;

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
        }),
      });
      console.log("📩 Telegram alert sent:", message);

      // Reset events after sending
      events = [];
    } catch (err) {
      console.error("❌ Telegram error:", err);
    }
  }
}, 5000); // check every 5 seconds

// Listen on Render's default port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
