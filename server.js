import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
// STATE / PERSISTENCE
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
    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify({ lastAlert, trackingStart, lastBig, cooldownUntil }, null, 2)
        );
    } catch {}
}

const persisted = loadState();

// ==========================================================
// ENV
// ==========================================================
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);
const ALERT_SECRET = (process.env.ALERT_SECRET || "").trim();

// ==========================================================
// HEARTBEAT METRICS
// ==========================================================
const startedAt = Date.now();
let lastAlertTs = null;
let alertCounter = 0;
const alertHistory = []; // timestamps

function recordHeartbeat(ts) {
    lastAlertTs = ts;
    alertCounter++;
    alertHistory.push(ts);

    // keep only last 60 minutes
    const cutoff = ts - 60 * 60 * 1000;
    while (alertHistory.length && alertHistory[0] < cutoff) {
        alertHistory.shift();
    }
}

// ==========================================================
// TELEGRAM SENDERS
// ==========================================================
async function sendToTelegram1(text) {
    if (!TELEGRAM_BOT_TOKEN_1 || !TELEGRAM_CHAT_ID_1) return;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_1}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_1, text })
    });
}

async function sendToTelegram2(text) {
    if (!TELEGRAM_BOT_TOKEN_2 || !TELEGRAM_CHAT_ID_2) return;
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_2}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_2, text })
    });
}

// ==========================================================
// BOT1 AGGREGATION STORAGE
// ==========================================================
const events = {};
const cooldownUntil = persisted.cooldownUntil || {};

// ✔ FIXED DEDUPLICATION (no starvation)
const recentPayloads = new Set();
function payloadHash(symbol, group, body) {
    return `${symbol}|${group}|${JSON.stringify(body)}`;
}

// ==========================================================
// HELPERS
// ==========================================================
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    while (buf.length && buf[0].time < cutoff) buf.shift();
}

// ==========================================================
// NORMALIZATION (P INCLUDED)
// ==========================================================
function normalizeFibLevel(group, body) {
    if (group === "F") return { numericLevels: [1.3, -1.3] };

    if ((group === "G" || group === "P") && body.fib_level) {
        const v = parseFloat(body.fib_level);
        if (!isNaN(v)) return { numericLevels: [v, -v] };
    }

    if (group === "H" && body.level) {
        const v = parseFloat(body.level);
        if (!isNaN(v)) return { numericLevels: [v, -v] };
    }

    return { numericLevels: [] };
}

// ==========================================================
// STATE STORAGE (BOT2 / BOT3)
// ==========================================================
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

        const symbol = (body.symbol || "").trim();
        const group = (body.group || "").trim();
        const ts = nowMs();
        if (!symbol || !group) return res.sendStatus(200);

        recordHeartbeat(ts);

        // Dedup identical payloads only
        const ph = payloadHash(symbol, group, body);
        if (recentPayloads.has(ph)) return res.sendStatus(200);
        recentPayloads.add(ph);
        setTimeout(() => recentPayloads.delete(ph), 120000);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });

        const norm = normalizeFibLevel(group, body);
        body.numericLevels = norm.numericLevels;

        lastAlert[symbol] ??= {};
        lastAlert[symbol][group] = { time: ts, payload: body };

        saveState();
        res.sendStatus(200);

    } catch {
        res.sendStatus(200);
    }
});

// ==========================================================
// BOT1 LOOP (RESTORED)
// ==========================================================
setInterval(async () => {
    for (const g in events) pruneOld(events[g], WINDOW_SECONDS_DEF * 1000);

    for (const name in events) {
        const total = events[name].length;
        if (total >= 3 && (cooldownUntil[name] || 0) <= nowSec()) {
            await sendToTelegram1(`🚨 BOT1 ALERT\nGroup: ${name}\nCount: ${total}`);
            events[name] = [];
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
            saveState();
        }
    }
}, CHECK_MS);

// ==========================================================
// HEALTH ENDPOINT
// ==========================================================
app.get("/health", (req, res) => {
    res.json({
        ok: true,
        uptimeMinutes: Math.floor((Date.now() - startedAt) / 60000),
        lastAlertAt: lastAlertTs ? new Date(lastAlertTs).toISOString() : null,
        alertsLast60Min: alertHistory.length
    });
});

app.get("/ping", (req, res) => res.json({ ok: true }));

// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
