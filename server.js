// ==========================================================
//  IMPORTS & APP SETUP
// ==========================================================
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
//  SERVICE ROLE
// ==========================================================
const IS_MAIN = process.env.SERVICE_ROLE === "main";
console.log("🚦 Service role:", process.env.SERVICE_ROLE, "| IS_MAIN:", IS_MAIN);

// ==========================================================
//  STATE (MAIN ONLY)
// ==========================================================
const STATE_FILE = "./state.json";

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        }
    } catch {}
    return { lastAlert: {}, trackingStart: {}, lastBig: {}, cooldownUntil: {} };
}

function saveState() {
    if (!IS_MAIN) return;
    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({ lastAlert, trackingStart, lastBig, cooldownUntil }, null, 2),
            "utf8"
        );
    } catch (err) {
        console.error("❌ Failed to save state:", err.message);
    }
}

const persisted = loadState();

// ==========================================================
//  ENV VARS
// ==========================================================
const ALERT_SECRET = (process.env.ALERT_SECRET || "").trim();
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// ==========================================================
//  SAFE TELEGRAM SENDER FACTORY
// ==========================================================
function makeTelegramSender(tokenEnv, chatEnv) {
    return async function send(text) {
        const token = process.env[tokenEnv];
        const chat = process.env[chatEnv];
        if (!token || !chat) return;

        try {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chat, text })
            });
        } catch (err) {
            console.error("Telegram send failed:", err.code || err.message);
        }
    };
}

const sendToTelegram1 = makeTelegramSender("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID");
const sendToTelegram2 = makeTelegramSender("TELEGRAM_BOT_TOKEN_2", "TELEGRAM_CHAT_ID_2");
const sendToTelegram3 = makeTelegramSender("TELEGRAM_BOT_TOKEN_3", "TELEGRAM_CHAT_ID_3");
const sendToTelegram4 = makeTelegramSender("TELEGRAM_BOT_TOKEN_4", "TELEGRAM_CHAT_ID_4");
const sendToTelegram5 = makeTelegramSender("TELEGRAM_BOT_TOKEN_5", "TELEGRAM_CHAT_ID_5");
const sendToTelegram6 = makeTelegramSender("TELEGRAM_BOT_TOKEN_6", "TELEGRAM_CHAT_ID_6");

// ==========================================================
//  HELPERS
// ==========================================================
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
//  NORMALIZATION
// ==========================================================
function normalizeFibLevel(group, body) {
    if ((group === "G" || group === "H") && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { numericLevels: [lv, -lv] };
    }
    return { numericLevels: [] };
}

// ==========================================================
//  STORAGE
// ==========================================================
const events = {};
const recentHashes = new Set();

const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};
const cooldownUntil = persisted.cooldownUntil || {};

const divergenceMonitor = {};
const recentAD2 = {};
const recentAD2Global = [];
const recentGH = {};

// ==========================================================
//  TRACKING & MATCHING ENGINES (UNCHANGED LOGIC)
// ==========================================================
function adPair(group) {
    if (group === "A" || group === "C") return "AC";
    if (group === "B" || group === "D") return "BD";
    return null;
}

const DIVERGENCE_SET_WINDOW_MS = 60 * 60 * 1000;

function processDivergenceMonitor(symbol, group, ts) {
    const pair = adPair(group);
    if (!divergenceMonitor[symbol]) divergenceMonitor[symbol] = {};

    if (pair) {
        divergenceMonitor[symbol][pair] = divergenceMonitor[symbol][pair] || {
            awaitingGH: false,
            lastSetTime: null
        };
        divergenceMonitor[symbol][pair].awaitingGH = true;
        return;
    }

    if (!["G", "H"].includes(group)) return;

    for (const key of ["AC", "BD"]) {
        const state = divergenceMonitor[symbol][key];
        if (!state || !state.awaitingGH) continue;

        state.awaitingGH = false;

        if (!state.lastSetTime) {
            state.lastSetTime = ts;
            return;
        }

        const diffMs = ts - state.lastSetTime;
        if (diffMs <= DIVERGENCE_SET_WINDOW_MS) {
            sendToTelegram6(
                `📊 DIVERGENCE MONITOR\nSymbol: ${symbol}\nPair: ${key}\nTime: ${new Date(ts).toLocaleString()}`
            );
        }

        state.lastSetTime = ts;
    }
}

// ==========================================================
//  WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (IS_MAIN && ALERT_SECRET && body.secret !== ALERT_SECRET) {
            return res.sendStatus(401);
        }

        const symbol = body.symbol;
        const group = body.group;
        if (!symbol || !group) return res.sendStatus(200);

        const ts = nowMs();
        const hash = `${symbol}-${group}-${Math.floor(ts / 1000)}`;
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        processDivergenceMonitor(symbol, group, ts);

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Webhook error:", err.message);
        res.sendStatus(200);
    }
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
