// ==========================================================
//  IMPORTS & SETUP
// ==========================================================
import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// ==========================================================
//  ENVIRONMENT VARIABLES
// ==========================================================
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET       = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS   = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// Tracking window (used by matching rules)
const TRACKING_WINDOW_MS = Number(process.env.WINDOW_SECONDS || "3600") * 1000;

// ==========================================================
//  DATABASE (in-memory)
// ==========================================================
const events = {};  // events[group] = [ { time, data }, ... ]

function nowMs() { return Date.now(); }

function maxWindowMs() {
    return (WINDOW_SECONDS_DEF || 45) * 1000;
}

function pruneOld(list, windowMs) {
    const cutoff = nowMs() - windowMs;
    while (list.length && list[0].time < cutoff) list.shift();
}

// ==========================================================
//  SEND MESSAGE TO TELEGRAM (BOTH BOTS)
// ==========================================================
async function sendTelegram(botToken, chatId, text) {
    if (!botToken || !chatId) return;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text })
        });
    } catch (e) {
        console.error("Telegram error:", e);
    }
}

// ==========================================================
//  NORMALIZE / FIX INCOMING ALERT BODY
// ==========================================================
function normalizeAlert(body) {
    const fixed = { ...body };

    // some alerts send numbers as strings — normalize
    if ("fib_level" in fixed) {
        let v = fixed.fib_level;
        if (typeof v === "string") {
            v = v.trim();
            if (v === "") fixed.fib_level = null;
            else fixed.fib_level = Number(v);
        }
    }

    return fixed;
}

// ==========================================================
//  INCOMING WEBHOOK HANDLER
// ==========================================================
app.post("/incoming", (req, res) => {
    try {
        let body = req.body || {};

        // Optional secret check
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
            return res.sendStatus(401);
        }

        // Fix / normalize the alert payload
        body = normalizeAlert(body);

        const group  = (body.group  || "").toString().trim();
        const symbol = (body.symbol || "").toString().trim();

        if (!group || !symbol) {
            console.log("🚫 Dropped invalid alert (missing group or symbol):", body);
            return res.sendStatus(200);
        }

        console.log(`📩 Received alert | Symbol=${symbol} | Group=${group} | Level=${body.fib_level}`);

        // Store the event
        const ts = nowMs();
        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        res.sendStatus(200);
    } catch (e) {
        console.error("❌ /incoming error:", e);
        res.sendStatus(500);
    }
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log("==> Your service is live ✨");
});
