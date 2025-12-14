// ==========================================================
//  PART 1 — IMPORTS, CONFIG, HELPERS, PERSISTENCE
// ==========================================================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// -----------------------------
// PERSISTENCE (HYBRID MEMORY)
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
// ENV
// -----------------------------
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();
const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || "45");
const CHECK_MS = Number(process.env.CHECK_MS || "1000");
const ALERT_SECRET = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || "60");

// -----------------------------
// BOT1 RULES
// -----------------------------
let RULES = [];
try {
    RULES = JSON.parse((process.env.RULES || "").trim());
} catch {}

RULES = RULES.map((r, i) => ({
    name: r.name || `rule${i + 1}`,
    groups: Array.isArray(r.groups) ? r.groups : [],
    threshold: Number(r.threshold || 3),
    windowSeconds: Number(r.windowSeconds || WINDOW_SECONDS_DEF)
})).filter(r => r.groups.length);

// -----------------------------
// TIME HELPERS
// -----------------------------
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
// TELEGRAM SENDERS
// ==========================================================
async function sendToTelegram(token, chat, text) {
    if (!token || !chat) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// ==========================================================
// STORAGE
// ==========================================================
const events = {};
const recentHashes = new Set();

const lastAlert     = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig       = persisted.lastBig || {};
const cooldownUntil = persisted.cooldownUntil || {};

// ==========================================================
// NORMALIZATION (F, G, H, P)
// ==========================================================
function normalizeFibLevel(group, body) {
    if (group === "F") return { numericLevels: [1.3, -1.3] };

    if ((group === "G" || group === "P") && body.fib_level) {
        const lv = parseFloat(body.fib_level);
        if (!isNaN(lv)) return { numericLevels: [lv, -lv] };
    }

    if (group === "H" && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { numericLevels: [lv, -lv] };
    }

    return { numericLevels: [] };
}

// ==========================================================
// BOT2 TRACKING (UNCHANGED LOGIC, FIXED MEMORY)
// ==========================================================
function processTracking2and3(symbol, group, ts) {
    if (!["F","G","H"].includes(group)) return;

    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    if (!last) {
        lastBig[symbol] = ts;
        saveState();
        return;
    }

    if (diff >= 5 * 3600000) {
        sendToTelegram(
            TELEGRAM_BOT_TOKEN_2,
            TELEGRAM_CHAT_ID_2,
            `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group}`
        );
    } else if (diff >= 2 * 3600000) {
        sendToTelegram(
            TELEGRAM_BOT_TOKEN_2,
            TELEGRAM_CHAT_ID_2,
            `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group}`
        );
    }

    lastBig[symbol] = ts;
    saveState();
}

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

        const symbol = (body.symbol || "").trim();
        const group  = (body.group || "").trim();
        const ts = nowMs();

        if (!symbol || !group) return res.sendStatus(200);

        const hash = `${symbol}-${group}-${Math.floor(ts/1000)}`;
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });

        lastAlert[symbol] ??= {};
        lastAlert[symbol][group] = { time: ts, payload: body };

        processTracking2and3(symbol, group, ts);

        saveState();
        res.sendStatus(200);

    } catch {
        res.sendStatus(200);
    }
});

// ==========================================================
// BOT1 LOOP — STARVATION FIX
// ==========================================================
setInterval(async () => {
    for (const r of RULES) {
        let total = 0;
        for (const g of r.groups) total += (events[g] || []).length;

        if (total >= r.threshold && (cooldownUntil[r.name] || 0) <= nowSec()) {
            await sendToTelegram(
                TELEGRAM_BOT_TOKEN_1,
                TELEGRAM_CHAT_ID_1,
                `🚨 Rule "${r.name}" fired (${total})`
            );

            // 🔴 CRITICAL FIX — DO NOT WIPE BUFFERS
            cooldownUntil[r.name] = nowSec() + COOLDOWN_SECONDS;
            saveState();
        }
    }
}, CHECK_MS);

// ==========================================================
// HEARTBEAT
// ==========================================================
app.get("/ping", (req, res) => {
    res.json({
        ok: true,
        time: new Date().toISOString(),
        rules: RULES.map(r => r.name),
        symbolsTracked: Object.keys(lastAlert).length
    });
});

// ==========================================================
// START
// ==========================================================
const PORT = Number(process.env.PORT || "10000");
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
