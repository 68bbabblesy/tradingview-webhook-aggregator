// ==========================================================
//  PART 1 — IMPORTS, CONFIG, HELPERS, NORMALIZATION, STORAGE
// ==========================================================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

// 🔑 SERVICE ROLE (MAIN vs STAGING)
const IS_MAIN = process.env.SERVICE_ROLE === "main";

console.log(
  "🚦 Service role:",
  process.env.SERVICE_ROLE,
  "| IS_MAIN:",
  IS_MAIN
);

const app = express();
app.use(express.json());

// -----------------------------
// PERSISTENCE (State File)
// -----------------------------
const STATE_FILE = "./state.json";

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, "utf8");
            return JSON.parse(raw);
        }
    } catch {}
    return { lastAlert: {}, trackingStart: {}, lastBig: {}, cooldownUntil: {} };
}

function saveState() {
    // 🔒 STAGING MUST NEVER PERSIST STATE
    if (!IS_MAIN) return;

    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(
                { lastAlert, trackingStart, lastBig, cooldownUntil },
                null,
                2
            ),
            "utf8"
        );
    } catch (err) {
        console.error("❌ Failed to save state:", err);
    }
}

// Load previous state
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
// SPECIAL SYMBOLS (BOT 8 MIRROR)
// -----------------------------
const SPECIAL_SYMBOLS = new Set(
    (process.env.SPECIAL_SYMBOLS || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
);

async function forwardToShadow(payload) {
    const url = process.env.SHADOW_URL;
    if (!url) return;

    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Shadow-Forward": "true"
        },
        body: JSON.stringify(payload)
    }).catch(err => {
        console.error("⚠️ Shadow forward failed:", err.message);
    });
}

// -----------------------------
// BOT1 RULES (unchanged)
// -----------------------------
let RULES = [];
try {
    const raw = (process.env.RULES || "").trim();
    RULES = raw ? JSON.parse(raw) : [];
} catch { RULES = []; }

RULES = RULES.map((r, idx) => ({
    name: (r.name || `rule${idx + 1}`),
    groups: Array.isArray(r.groups) ? r.groups.map(s => String(s).trim()).filter(Boolean) : [],
    threshold: Number(r.threshold || 3),
    windowSeconds: Number(r.windowSeconds || WINDOW_SECONDS_DEF)
})).filter(r => r.groups.length);

// -----------------------------
// TIME HELPERS
// -----------------------------
const nowMs  = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// -----------------------------
// TELEGRAM SENDERS
// -----------------------------
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

// Telegram sender for Bot 3
async function sendToTelegram3(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}
// Telegram sender for Bot 4
async function sendToTelegram4(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_4 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_4 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// Telegram sender for Bot 5
async function sendToTelegram5(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_5 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_5 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// Telegram sender for Bot 6
async function sendToTelegram6(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_6 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_6 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// Telegram sender for Bot 7
async function sendToTelegram7(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_7 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_7 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// Telegram sender for Bot 8
async function sendToTelegram8(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_8 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_8 || "").trim();
    if (!token || !chat) return;

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// -----------------------------
// BOT 8 MIRROR HELPER (SPECIAL SYMBOLS)
// -----------------------------
function mirrorToBot8IfSpecial(symbol, text) {
    if (!symbol) return;
    if (!SPECIAL_SYMBOLS.has(symbol)) return;
    sendToTelegram8(text);
}

// -----------------------------
// STATE (in-memory)
// -----------------------------
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};
const cooldownUntil = persisted.cooldownUntil || {};

// Safe accessor
function safeGet(symbol, group) {
    return lastAlert[symbol]?.[group] || null;
}

// Record alert
function recordAlert(symbol, group, ts, payload) {
    if (!lastAlert[symbol]) lastAlert[symbol] = {};
    lastAlert[symbol][group] = { time: ts, payload };
    saveState();
}
// -----------------------------
// TIME / WINDOW HELPERS
// -----------------------------
function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    let i = 0;
    while (i < buf.length && buf[i].time < cutoff) i++;
    if (i > 0) buf.splice(0, i);
}

function maxWindowMs() {
    if (!RULES.length) return WINDOW_SECONDS_DEF * 1000;
    return Math.max(...RULES.map(r => r.windowSeconds)) * 1000;
}

// ==========================================================
//  TRACKING ENGINE
// ==========================================================

const TRACKING1A_MAX_MS = 30 * 60 * 1000;
const TRACKING1B_MAX_MS = 120 * 60 * 1000;

function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups   = ["G", "H"];

    if (startGroups.includes(group)) {
        trackingStart[symbol] = {
            startGroup: group,
            startTime: ts,
            payload: body
        };
        saveState();
        return;
    }

    if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];
        const diffMs = ts - start.startTime;

        if (diffMs > TRACKING1B_MAX_MS) {
            delete trackingStart[symbol];
            saveState();
            return;
        }

        let label = diffMs <= TRACKING1A_MAX_MS
            ? "📌📌 TRACKING 1a 📌📌"
            : "⏳⏳ TRACKING 1b ⏳⏳";

        const msg =
            `${label}\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${start.startGroup}\n` +
            `Start Time: ${new Date(start.startTime).toLocaleString()}\n` +
            `End Group: ${group}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`;

        sendToTelegram4(msg);

        delete trackingStart[symbol];
        saveState();
    }
}

function processTracking2and3(symbol, group, ts, body) {
    const big = ["F", "G", "H"];
    if (!big.includes(group)) return;

    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    if (!last) {
        lastBig[symbol] = ts;
        saveState();
        return;
    }

    const TWO = 2 * 60 * 60 * 1000;
    const FIVE = 5 * 60 * 60 * 1000;

    if (diff >= FIVE) {
        sendToTelegram2(
            `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group}\nGap: ${(diff/3600000).toFixed(2)} hours`
        );
        lastBig[symbol] = ts;
        saveState();
        return;
    }

    if (diff >= TWO) {
        sendToTelegram2(
            `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group}\nGap: ${(diff/3600000).toFixed(2)} hours`
        );
    }

    lastBig[symbol] = ts;
    saveState();
}

// ==========================================================
//  MATCHING ENGINE
// ==========================================================

const MATCH_WINDOW_MS = 65 * 1000;

function processMatching1(symbol, group, ts, body) {
    const AD = ["A", "B", "C", "D"];
    const GH = ["G", "H"];

    if (AD.includes(group)) {
        const candidate = GH.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram4(
                `🔁 MATCHING 1\nSymbol: ${symbol}\nGroups: ${group} ↔ ${candidate.payload.group}`
            );
        }
        return;
    }

    if (GH.includes(group)) {
        const candidate = AD.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram4(
                `🔁 MATCHING 1\nSymbol: ${symbol}\nGroups: ${candidate.payload.group} ↔ ${group}`
            );
        }
    }
}
function processMatching2(symbol, group, ts, body) {
    const AD = ["A", "B", "C", "D"];
    const GH = ["G", "H"];

    if (AD.includes(group)) {
        const candidate = GH.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram5(
                `🔁 MATCHING 2\nSymbol: ${symbol}\nGroups: ${group} ↔ ${candidate.payload.group}`
            );
        }
        return;
    }

    if (GH.includes(group)) {
        const candidate = AD.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram5(
                `🔁 MATCHING 2\nSymbol: ${symbol}\nGroups: ${candidate.payload.group} ↔ ${group}`
            );
        }
    }
}

function processMatching3(symbol, group, ts, body) {
    const AD = ["A", "B", "C", "D"];
    const GH = ["G", "H"];

    if (AD.includes(group)) {
        const candidate = GH.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram6(
                `🔁 MATCHING 3\nSymbol: ${symbol}\nGroups: ${group} ↔ ${candidate.payload.group}`
            );
        }
        return;
    }

    if (GH.includes(group)) {
        const candidate = AD.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram6(
                `🔁 MATCHING 3\nSymbol: ${symbol}\nGroups: ${candidate.payload.group} ↔ ${group}`
            );
        }
    }
}

// ==========================================================
//  JUPITER & SATURN (Directional: G/H tracks A–D)
// ==========================================================

const JUPITER_WINDOW_MS = 5 * 60 * 1000;
const SATURN_WINDOW_MS  = 50 * 60 * 1000;

function processJupiterSaturn(symbol, group, ts) {
    if (!["G", "H"].includes(group)) return;

    const AD = ["A", "B", "C", "D"];

    const ads = AD
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.time <= ts);

    if (!ads.length) return;

    let firedJupiter = false;
    let firedSaturn  = false;

    for (const ad of ads) {
        const diffMs = ts - ad.time;
        if (diffMs < 0) continue;

        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        if (diffMs <= JUPITER_WINDOW_MS && !firedJupiter) {
            firedJupiter = true;
            sendToTelegram7(
                `🟠 JUPITER\nSymbol: ${symbol}\nAD Group: ${ad.payload.group}\nGH Group: ${group}\nGap: ${diffMin}m ${diffSec}s`
            );
        }

        if (diffMs <= SATURN_WINDOW_MS && !firedSaturn) {
            firedSaturn = true;
            sendToTelegram7(
                `🪐 SATURN\nSymbol: ${symbol}\nAD Group: ${ad.payload.group}\nGH Group: ${group}\nGap: ${diffMin}m ${diffSec}s`
            );
        }

        if (firedJupiter && firedSaturn) break;
    }
}

// ==========================================================
//  WEBHOOK
// ==========================================================

app.post("/incoming", (req, res) => {
    res.sendStatus(200);

    const body = req.body || {};
    if (body.secret !== ALERT_SECRET) return;

    if (!IS_MAIN && !req.headers["x-shadow-forward"]) return;

    const symbol = String(body.symbol || "").trim();
    const group  = String(body.group || "").trim();
    const ts     = nowMs();

    if (!symbol || !group) return;

    recordAlert(symbol, group, ts, body);

    processTracking1(symbol, group, ts, body);
    processTracking2and3(symbol, group, ts, body);
    processMatching1(symbol, group, ts, body);
    processMatching2(symbol, group, ts, body);
    processMatching3(symbol, group, ts, body);
    processJupiterSaturn(symbol, group, ts);
});

// -----------------------------
// HEALTH CHECK
// -----------------------------
app.get("/ping", (req, res) => {
    res.json({ ok: true });
});

// -----------------------------
// START SERVER
// -----------------------------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
