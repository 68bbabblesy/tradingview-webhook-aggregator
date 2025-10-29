import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const DEST_URL = process.env.DEST_URL; // Destination for aggregated webhooks
let events = [];

app.post("/incoming", (req, res) => {
  events.push(req.body);
  res.sendStatus(200);
});

setInterval(async () => {
  if (events.length === 0) return;
  const summary = {
    total: events.length,
    events,
    sentAt: new Date().toISOString()
  };
  try {
    await fetch(DEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summary)
    });
  } catch (err) {
    console.error("Forwarding error:", err);
  }
  events = [];
}, 2 * 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
