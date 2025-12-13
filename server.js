// ==========================================================
//  PART 1 — IMPORTS, CONFIG, HELPERS, NORMALIZATION, STORAGE
// ==========================================================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// -----------------------------
// PERSISTENCE (State File)
// -----------------------------
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

// -----------------------------
// ENVIRONMENT VARIABLES
// -----------------------------
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET       = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS   = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// -----------------------------
// BOT1 RULES
// -----------------------------
let RULES = [];
try {
    RULES = JSON.parse((process.env.RULES || "").trim() || "[]");
} catch {}

RULES = RULES.map((r, i) => ({
    name: r.name || `rule${i + 1}`,
    groups: (r.groups || []).map(String).filter(Boolean),
    threshold: Number(r.threshold || 3),
    windowSeconds: Number(r.windowSeconds || WINDOW_SECONDS_DEF)
})).filter(r => r.groups.length);

// -----------------------------
// TIME HELPERS
// -----------------------------
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
//  TELEGRAM SENDERS
// ==========================================================

async function send(botToken, chatId, text) {
    if (!botToken || !chatId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
    });
}

const sendToTelegram1 = t => send(TELEGRAM_BOT_TOKEN_1, TELEGRAM_CHAT_ID_1, t);
const sendToTelegram2 = t => send(TELEGRAM_BOT_TOKEN_2, TELEGRAM_CHAT_ID_2, t);
const sendToTelegram3 = t =>
    send(process.env.TELEGRAM_BOT_TOKEN_3, process.env.TELEGRAM_CHAT_ID_3, t);

// ==========================================================
//  SILENT HEARTBEAT (NO LOGS)
// ==========================================================

let heartbeat = {
    startedAt: nowMs(),
    lastAlertAt: null,
    totalAlerts: 0
};

// ==========================================================
//  STORAGE
// ==========================================================

const events = {};
const cooldownUntil = persisted.cooldownUntil || {};
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};

const lastHLevel = {};
const lastGPLevel = {};
const lastCrossLevel = {};

const recentHashes = new Set();

function alertHash(symbol, group, ts) {
    return `${symbol}-${group}-${Math.floor(ts / 1000)}`;
}

function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    while (buf.length && buf[0].time < cutoff) buf.shift();
}

function maxWindowMs() {
    return Math.max(WINDOW_SECONDS_DEF * 1000, ...RULES.map(r => r.windowSeconds * 1000));
}

// ==========================================================
//  NORMALIZATION (F, G, H, **P**)
// ==========================================================

function normalizeFibLevel(group, body) {
    if (group === "F") return { numericLevels: [1.30, -1.30] };

    if ((group === "G" || group === "P") && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { numericLevels: [lv, -lv] };
    }

    if (group === "H" && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { numericLevels: [lv, -lv] };
    }

    return { numericLevels: [] };
}

// ==========================================================
//  TRACKING 4 — H SWITCH
// ==========================================================

function processTracking4(symbol, group, ts, body) {
    if (group !== "H") return;

    const lv = parseFloat(body.level);
    if (isNaN(lv)) return;

    const abs = Math.abs(lv);
    const prev = lastHLevel[symbol];

    if (!prev) {
        lastHLevel[symbol] = { abs, lv, ts };
        return;
    }

    if (prev.abs === abs) return;

    sendToTelegram3(
        `🔄 TRACKING 4 SWITCH\nSymbol: ${symbol}\nFrom: H (${prev.lv})\nTo: H (${lv})\nGap: ${Math.floor((ts - prev.ts)/60000)}m\nTime: ${new Date(ts).toLocaleString()}`
    );

    lastHLevel[symbol] = { abs, lv, ts };
}

// ==========================================================
//  TRACKING 5 — G ↔ P
// ==========================================================

function processTracking5(symbol, group, ts, body) {
    if (!["G", "P"].includes(group)) return;

    const { numericLevels } = normalizeFibLevel(group, body);
    if (!numericLevels.length) return;

    const lv = numericLevels[0];
    const prev = lastGPLevel[symbol];

    if (!prev) {
        lastGPLevel[symbol] = { lv, group, ts };
        return;
    }

    if (prev.lv === lv) return;

    sendToTelegram3(
        `🔄 TRACKING 5 SWITCH\nSymbol: ${symbol}\nFrom: ${prev.group} (${prev.lv})\nTo: ${group} (${lv})\nGap: ${Math.floor((ts - prev.ts)/60000)}m\nTime: ${new Date(ts).toLocaleString()}`
    );

    lastGPLevel[symbol] = { lv, group, ts };
}

// ==========================================================
//  WEBHOOK
// ==========================================================

app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

        const group = String(body.group || "").trim();
        const symbol = String(body.symbol || "").trim();
        const ts = nowMs();

        if (!group || !symbol) return res.sendStatus(200);

        const hash = alertHash(symbol, group, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        heartbeat.totalAlerts++;
        heartbeat.lastAlertAt = ts;

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        processTracking4(symbol, group, ts, body);
        processTracking5(symbol, group, ts, body);

        saveState();
        res.sendStatus(200);

    } catch {
        res.sendStatus(200);
    }
});

// ==========================================================
//  HEALTH CHECK (SILENT)
// ==========================================================

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        uptime_minutes: Math.floor((nowMs() - heartbeat.startedAt) / 60000),
        total_alerts_received: heartbeat.totalAlerts,
        last_alert_time: heartbeat.lastAlertAt
            ? new Date(heartbeat.lastAlertAt).toISOString()
            : null
    });
});

// ==========================================================
//  START SERVER
// ==========================================================

const PORT = Number(process.env.PORT || 10000);
app.listen(PORT);
