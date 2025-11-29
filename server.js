const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// =========================
// TELEGRAM CONFIG
// =========================
const BOT1 = process.env.TELEGRAM_BOT_TOKEN;
const CHAT1 = process.env.TELEGRAM_CHAT_ID;

const BOT2 = process.env.TELEGRAM_BOT_TOKEN_2;
const CHAT2 = process.env.TELEGRAM_CHAT_ID_2;

const TG1 = `https://api.telegram.org/bot${BOT1}/sendMessage`;
const TG2 = `https://api.telegram.org/bot${BOT2}/sendMessage`;

// =========================
// CORE SETTINGS
// =========================
const WINDOW = parseInt(process.env.WINDOW_SECONDS || "45");     // any-3-in-45s
const CHECK_MS = parseInt(process.env.CHECK_MS || "1000");        // engine pulse
const SPECIAL_TOKENS = (process.env.SPECIAL_TOKENS || "").split(",");

// =========================
// DATA STORAGE
// =========================
let recent = [];         // for ANY-3-in-45s bot
let urgentRecent = [];   // for urgent rules
let lastP = {};          // per-symbol timestamp memory

// =========================
// HELPER FUNCTIONS
// =========================
function now() {
  return Date.now();
}

function ageMs(t) {
  return now() - t;
}

async function sendTelegram(url, chat, text) {
  try {
    await axios.post(url, {
      chat_id: chat,
      text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

// =========================
// RULE EVALUATION LOOP
// =========================
setInterval(() => {
  const tNow = now();

  // Purge windows
  recent = recent.filter(a => tNow - a.ts <= WINDOW * 1000);
  urgentRecent = urgentRecent.filter(a => tNow - a.ts <= 5 * 60 * 1000);

  // ---- NORMAL BOT: ANY-3-in-45s across groups A–F ----
  if (recent.length >= 3) {
    const last3 = recent.slice(-3);
    const counts = { A:0,B:0,C:0,D:0,E:0,F:0 };

    last3.forEach(a => {
      if (counts[a.group] !== undefined) counts[a.group]++;
    });

    const msg =
      `🚨 Rule "ANY3" fired: 3 alerts in last ${WINDOW}s\n` +
      `• A: ${counts.A}\n` +
      `• B: ${counts.B}\n` +
      `• C: ${counts.C}\n` +
      `• D: ${counts.D}\n` +
      `• E: ${counts.E}\n` +
      `• F: ${counts.F}\n\n` +
      `Recent alerts:\n` +
      last3.map(a => 
        `[${a.group}] symbol=${a.symbol} price=${a.price} time=${a.time}`
      ).join("\n");

    sendTelegram(TG1, CHAT1, msg);
    recent = [];   // reset window
  }

  // ---- URGENT BOT ----
  urgentRecent.forEach((a, i) => {
    for (let j = i + 1; j < urgentRecent.length; j++) {
      const b = urgentRecent[j];
      const diff = Math.abs(a.ts - b.ts);

      // Rule 1: Group B, same symbol, <=20s
      if (a.group === "B" && b.group === "B" && a.symbol === b.symbol && diff <= 20*1000) {
        sendTelegram(TG2, CHAT2,
          `🔥 URGENT: Group B pair in 20s\n${a.symbol}\nTimes:\n${a.time}\n${b.time}`);
      }

      // Rule 2: Group E, same symbol, <=20s
      if (a.group === "E" && b.group === "E" && a.symbol === b.symbol && diff <= 20*1000) {
        sendTelegram(TG2, CHAT2,
          `🔥 URGENT: Group E pair in 20s\n${a.symbol}\nTimes:\n${a.time}\n${b.time}`);
      }

      // Rule 3: ANY group A–F: same symbol, <=30s
      if (["A","B","C","D","E","F"].includes(a.group) &&
          a.group === b.group &&
          a.symbol === b.symbol &&
          diff <= 30*1000) 
      {
        sendTelegram(TG2, CHAT2,
          `🔥 URGENT: Same symbol in 30s\nGroup ${a.group}\nSymbol: ${a.symbol}`);
      }

      // Rule 4: SPECIAL TOKENS list: same group, same symbol, <=4min
      if (SPECIAL_TOKENS.includes(a.symbol) &&
          a.group === b.group &&
          a.symbol === b.symbol &&
          diff <= 4*60*1000)
      {
        sendTelegram(TG2, CHAT2,
          `🔥 URGENT: Special Token (${a.symbol}) repeated in 4m\nGroup ${a.group}`);
      }
    }
  });

}, CHECK_MS);

// =========================
// RECEIVING ALERTS
// =========================
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const group = body.group;
  const symbol = body.symbol;
  const price = body.price;
  const time = body.time;

  if (!group || !symbol || !time) {
    return res.json({ ok:false, error:"Missing fields" });
  }

  const ts = now();

  // Normal bot groups A–F
  if (["A","B","C","D","E","F"].includes(group)) {
    recent.push({ group, symbol, price, time, ts });
  }

  // Urgent bot listens to everything A–Z
  urgentRecent.push({ group, symbol, price, time, ts });

  res.json({ ok:true });
});

// =========================
app.get("/ping", (req, res) => res.json({ ok:true }));
// =========================

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on", PORT));
