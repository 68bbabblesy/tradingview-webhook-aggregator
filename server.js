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
const SPECIAL_TOKENS = new Set(
    (process.env.SPECIAL_TOKENS || "")
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

// ==========================================================
//  BOT3 — TRACKING 4 (H level switching tracking)
// ==========================================================

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

// Telegram sender for Bot 9
async function sendToTelegram9(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_9 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_9 || "").trim();
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
    if (!SPECIAL_TOKENS.has(symbol)) return;
    sendToTelegram8(text);
}


// Stores last absolute H-level per symbol
const tracking4 = {};
// tracking4[symbol] = { absLevel, rawLevel, time }

// Format helper for level text
function formatLevelBot3(level) {
    const lv = Number(level);
    if (isNaN(lv)) return "";
    return lv > 0 ? `+${lv}` : `${lv}`;
}

// TRACKING 4 ENGINE
function processTracking4(symbol, group, ts, body) {
    if (group !== "H") return;

    const raw = parseFloat(body.level);
    if (isNaN(raw)) return;

    const absLevel = Math.abs(raw);

    // First time: store and exit
    if (!tracking4[symbol]) {
        tracking4[symbol] = {
            absLevel,
            rawLevel: raw,
            time: ts
        };
        return;
    }

    const prev = tracking4[symbol];

    // No change in absolute level → ignore
    if (prev.absLevel === absLevel) return;

    // Compute time gap  
    const diffMs = ts - prev.time;
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    const msg =
        `🔄 TRACKING 4 SWITCH\n` +
        `Symbol: ${symbol}\n` +
        `From: H (${formatLevelBot3(prev.rawLevel)})\n` +
        `To:   H (${formatLevelBot3(raw)})\n` +
        `Gap: ${diffMin}m ${diffSec}s\n` +
        `Time: ${new Date(ts).toLocaleString()}`;

    sendToTelegram3(msg);

    // Update stored state
    tracking4[symbol] = {
        absLevel,
        rawLevel: raw,
        time: ts
    };
}
function processTracking5(symbol, group, ts, body) {
    const allowed = ["G", "P"];
    if (!allowed.includes(group)) return;

    const { numericLevels } = normalizeFibLevel(group, body);
    if (!numericLevels.length) return;

    const currentLevel = numericLevels[0];
    const prev = lastGPLevel[symbol];

    // First occurrence → start tracking only
    if (!prev) {
        lastGPLevel[symbol] = {
            level: currentLevel,
            time: ts,
            group
        };
        return;
    }

    // Same level → ignore
    if (prev.level === currentLevel) return;

    const gapMs = ts - prev.time;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    const msg =
        `🔄 TRACKING 5 SWITCH\n` +
        `Symbol: ${symbol}\n` +
        `From: ${prev.group} (${prev.level})\n` +
        `To: ${group} (${currentLevel})\n` +
        `Gap: ${gapMin}m ${gapSec}s\n` +
        `Time: ${new Date(ts).toLocaleString()}`;

    sendToTelegram3(msg);

    // Update state
    lastGPLevel[symbol] = {
        level: currentLevel,
        time: ts,
        group
    };
}

// -----------------------------
// STORAGE FOR BOT1 AGGREGATION
// -----------------------------

const events = {};
const cooldownUntil = persisted.cooldownUntil || {};

const recentHashes = new Set();
function alertHash(symbol, group, ts) {
    return `${symbol}-${group}-${Math.floor(ts / 1000)}`;
}

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
//  BOT2 ENGINE STORAGE (tracking + matching)
// ==========================================================

// RESTORED FROM DISK (persistence)
const lastAlert     = persisted.lastAlert     || {};
const trackingStart = persisted.trackingStart || {};
const lastBig       = persisted.lastBig       || {};

// Tracking 4 (H level switch)
const lastHLevel = {};

// Tracking 5 (G ↔ P level switch)
const lastGPLevel = {};

// Cross-level switch (H ↔ G ↔ P)
const lastCrossLevel = {}; // symbol → { group, level, time }



// G/H memory for Level Correlation
const recentGH = {};
// recentGH[symbol] = { group, level, time }

// Divergence Monitor memory (A–D same group within 1h)
const divergenceMonitor = {};
// divergenceMonitor[symbol][group] = lastTime





// TANGO memory (A/B buffered within 8 minutes)
const tangoBuf = {};
// tangoBuf[symbol][group] = [ts1, ts2, ...]






// -----------------------------
// FIB LEVEL NORMALIZATION
// -----------------------------
function normalizeFibLevel(group, body) {
    if (group === "F") return { levelStr: "1.30", numericLevels: [1.30, -1.30] };

 if ((group === "G" || group === "H") && body.level) {
    const lv = parseFloat(body.level);
    if (!isNaN(lv)) {
        return { levelStr: body.level, numericLevels: [lv, -lv] };
    }
}

    return { levelStr: null, numericLevels: [] };
}

function saveAlert(symbol, group, ts, body) {
    if (!lastAlert[symbol]) lastAlert[symbol] = {};
    lastAlert[symbol][group] = { time: ts, payload: body };
}

// -----------------------------
// SAFE GET
// -----------------------------
function safeGet(symbol, group) {
    return lastAlert[symbol]?.[group] || null;
}

// -----------------------------
// GODZILLA ELIGIBILITY HELPERS
// -----------------------------
function markGodzillaEligible(symbol, ts) {
    // If symbol was already used recently, ignore new eligibility marks
    const lastUsed = godzillaLastUsed.get(symbol);
    if (lastUsed && ts - lastUsed < GODZILLA_ARM_COOLDOWN_MS) return;

    // Only set if not already eligible (keeps the earliest eligible time)
    if (!godzillaEligible.has(symbol)) {
        godzillaEligible.set(symbol, ts);
    }
}

function isGodzillaEligible(symbol, ts) {
    const eligibleAt = godzillaEligible.get(symbol);
    if (!eligibleAt) return false;

    // Expire eligibility after TTL
    if (ts - eligibleAt > GODZILLA_SOURCE_TTL_MS) {
        godzillaEligible.delete(symbol);
        return false;
    }

    return true;
}

function canArmGodzilla(symbol, ts) {
    const lastUsed = godzillaLastUsed.get(symbol);
    if (!lastUsed) return true; // never used before

    return (ts - lastUsed) >= GODZILLA_ARM_COOLDOWN_MS;
}

function consumeGodzillaEligibility(symbol, ts) {
    godzillaLastUsed.set(symbol, ts);
    godzillaEligible.delete(symbol); // one-shot until re-eligible later
}


function formatLevel(group, payload) {
    // No payload or no numericLevels => no level (A–D etc.)
    if (!payload || !payload.numericLevels || payload.numericLevels.length === 0) {
        return "";
    }

    // Prefer the raw level string coming from TradingView – this keeps the sign.
    let raw = "";
    if (typeof payload.level === "string" && payload.level.trim() !== "") {
        raw = payload.level.trim();
    } else if (typeof payload.fib_level === "string" && payload.fib_level.trim() !== "") {
        raw = payload.fib_level.trim();
    } else if (typeof payload.levelStr === "string" && payload.levelStr.trim() !== "") {
        raw = payload.levelStr.trim();
    }

    // If for some reason we still don't have anything, fall back to numericLevels[0].
    if (!raw) {
        return ` (${payload.numericLevels[0]})`;
    }

    // Make sure positive numbers have an explicit '+' sign for clarity.
    const n = Number(raw);
    if (!Number.isNaN(n)) {
        if (n > 0 && !raw.startsWith("+")) {
            raw = `+${raw}`;
        }
        // negative values already have '-' from TradingView
    }

    return ` (${raw})`;
}

function biasFromGroup(group) {
    if (["A", "C", "W"].includes(group)) return "Support Zone";
    if (["B", "D", "X"].includes(group)) return "Resistance Zone";
    return "Unknown";
}


// ==========================================================
//  TRACKING ENGINE
// ==========================================================

const TRACKING1A_MAX_MS = 30 * 60 * 1000;   // 30 minutes
const TRACKING1B_MAX_MS = 120 * 60 * 1000;  // 2 hours

function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups   = ["G", "H"];

    // Start tracking
    if (startGroups.includes(group)) {
        trackingStart[symbol] = {
            startGroup: group,
            startTime: ts,
            payload: body
        };
        saveState();
        return;
    }

    // Complete tracking
    if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];
        const diffMs = ts - start.startTime;

        // Over 2 hours → silent expiry
        if (diffMs > TRACKING1B_MAX_MS) {
            delete trackingStart[symbol];
            saveState();
            return;
        }

        // Signed level helper (unchanged logic)
        function getSignedLevel(payload) {
            if (!payload) return "";
            if (payload.level) return ` (${payload.level})`;
            if (payload.fib_level) return ` (${payload.fib_level})`;
            return "";
        }

        const startLevel = getSignedLevel(start.payload);
        const endLevel   = getSignedLevel(body);

        // Decide label
        let label = null;
        if (diffMs <= TRACKING1A_MAX_MS) {
            label = "📌📌 TRACKING 1a 📌📌";
        } else {
            label = "⏳⏳ TRACKING 1b ⏳⏳";
        }

        sendToTelegram4(
            `${label}\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${start.startGroup}${startLevel}\n` +
            `Start Time: ${new Date(start.startTime).toLocaleString()}\n` +
            `End Group: ${group}${endLevel}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`
        );

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

    const lvl = formatLevel(group, body);

    if (diff >= FIVE) {
        sendToTelegram2(
            `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group}${lvl}\nFirst F/G/H in over 5 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
        );
        lastBig[symbol] = ts;
        saveState();
        return;
    }

    if (diff >= TWO) {
        sendToTelegram2(
            `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group}${lvl}\nFirst F/G/H in over 2 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
        );
    }

    lastBig[symbol] = ts;
    saveState();
}

function processCrossSwitch1(symbol, group, ts, body) {
    const allowed = ["H", "G", "P"];
    if (!allowed.includes(group)) return;

    const { numericLevels } = normalizeFibLevel(group, body);
    if (!numericLevels.length) return;

    const currentLevel = numericLevels[0];
    const prev = lastCrossLevel[symbol];

    // First sighting
    if (!prev) {
        lastCrossLevel[symbol] = {
            group,
            level: currentLevel,
            time: ts
        };
        return;
    }

    // Same group + same level → ignore
    if (prev.group === group && prev.level === currentLevel) return;

    const gapMs = ts - prev.time;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    const msg =
        `🔀 CROSS SWITCH 1\n` +
        `Symbol: ${symbol}\n` +
        `From: ${prev.group} (${prev.level})\n` +
        `To: ${group} (${currentLevel})\n` +
        `Gap: ${gapMin}m ${gapSec}s\n` +
        `Time: ${new Date(ts).toLocaleString()}`;

    sendToTelegram3(msg);

    lastCrossLevel[symbol] = {
        group,
        level: currentLevel,
        time: ts
    };
}
const DIVERGENCE_SET_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

function adPair(group) {
    if (group === "A" || group === "C") return "AC";
    if (group === "B" || group === "D") return "BD";
    return null;
}

function processDivergenceMonitor(symbol, group, ts) {
    const GH = ["G", "H"];
    const pair = adPair(group);

    if (!divergenceMonitor[symbol]) {
        divergenceMonitor[symbol] = {};
    }

    /* -----------------------------
       STEP 1: A–D starts a SET
    ----------------------------- */
    if (pair) {
        if (!divergenceMonitor[symbol][pair]) {
            divergenceMonitor[symbol][pair] = {
                awaitingGH: false,
                lastSetTime: null
            };
        }

        divergenceMonitor[symbol][pair].awaitingGH = true;
        return;
    }

    /* -----------------------------
       STEP 2: G/H completes a SET
    ----------------------------- */
    if (!GH.includes(group)) return;

    for (const pairKey of ["AC", "BD"]) {
        const state = divergenceMonitor[symbol][pairKey];
        if (!state || !state.awaitingGH) continue;

        state.awaitingGH = false;

        // First SET
        if (!state.lastSetTime) {
            state.lastSetTime = ts;
            return;
        }

        const diffMs = ts - state.lastSetTime;

        if (diffMs <= DIVERGENCE_SET_WINDOW_MS) {
            const diffMin = Math.floor(diffMs / 60000);

            sendToTelegram6(
                `📊 DIVERGENCE MONITOR (PAIR SET)\n` +
                `Symbol: ${symbol}\n` +
                `Pair: ${pairKey}\n` +
                `Second set within ${diffMin} minutes\n` +
                `Time: ${new Date(ts).toLocaleString()}`
            );
        }

        // Reset window starting point
        state.lastSetTime = ts;
    }
}





const LEVEL_CORRELATION_WINDOW_MS = 45 * 1000;
// ==========================================================
//  JUPITER / SATURN WINDOWS (G/H → A–D directional tracking)
// ==========================================================

const JUPITER_WINDOW_MS = 5 * 60 * 1000;    // 5 minutes
const SATURN_WINDOW_MS  = 50 * 60 * 1000;   // 50 minutes


function processLevelCorrelation(symbol, group, ts, body) {
    if (!["G", "H"].includes(group)) return;

    const { numericLevels } = normalizeFibLevel(group, body);
    if (!numericLevels.length) return;

    const level = numericLevels[0];
    const prev = recentGH[symbol];

    // First sighting → store and wait
    if (!prev) {
        recentGH[symbol] = { group, level, time: ts };
        return;
    }

    // Must be opposite group (G ↔ H)
    if (prev.group === group) {
        recentGH[symbol] = { group, level, time: ts };
        return;
    }

    // Must be same level
    if (prev.level !== level) {
        recentGH[symbol] = { group, level, time: ts };
        return;
    }

    // Must be within window
    const diffMs = Math.abs(ts - prev.time);
    if (diffMs > LEVEL_CORRELATION_WINDOW_MS) {
        recentGH[symbol] = { group, level, time: ts };
        return;
    }

    const diffSec = Math.floor(diffMs / 1000);

    sendToTelegram5(
        `🎯 LEVEL CORRELATION\n` +
        `Symbol: ${symbol}\n` +
        `Groups: ${prev.group} ↔ ${group}\n` +
        `Level: ${level > 0 ? "+" : ""}${level}\n` +
        `Gap: ${diffSec}s\n` +
        `Time: ${new Date(ts).toLocaleString()}`
    );

    // Prevent duplicate fires
    delete recentGH[symbol];
}


function processMatching2(symbol, group, ts, body) {
    const FGH = ["F", "G", "H"];
    if (!FGH.includes(group)) return;

    const { numericLevels: lvls } = normalizeFibLevel(group, body);
    if (!lvls.length) return;

    const candidate = FGH
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.payload.group !== group)
        .filter(x => {
            const norm = normalizeFibLevel(x.payload.group, x.payload);
            return norm.numericLevels.some(v => lvls.includes(v));
        })
        .filter(x => Math.abs(ts - x.time) <= MATCH_WINDOW_MS)
        .sort((a,b) => b.time - a.time)[0];

    if (!candidate) return;

    sendToTelegram2(
        `🔁 MATCHING 2\nSymbol: ${symbol}\nLevels: ±${lvls[0]}\nGroups: ${candidate.payload.group} ↔ ${group}\nTimes:\n - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n - ${group}: ${new Date(ts).toLocaleString()}`
    );
}

function processContrarian(symbol, group, ts) {
    if (!contrarianState.active) return;

    // Expiry
    if (ts - contrarianState.since > CONTRARIAN_EXPIRY_MS) {
        contrarianState.active = false;
        contrarianState.buf = [];
        return;
    }

    const ACWSU = ["A", "C", "W", "S", "U"];
    const BDXTV = ["B", "D", "X", "T", "V"];


    // Determine which side we are waiting for
    const wantedGroups =
    contrarianState.fromGroup === "ACWSU" ? BDXTV : ACWSU;


    if (!wantedGroups.includes(group)) return;

    // Enforce different symbols
    if (contrarianState.buf.some(e => e.symbol === symbol)) return;

    // Add hit
    contrarianState.buf.push({ symbol, group, time: ts });

    // Prune to 50s window
    const cutoff = ts - CONTRARIAN_WINDOW_MS;
    contrarianState.buf = contrarianState.buf.filter(
        e => e.time >= cutoff
    );

    if (contrarianState.buf.length < 2) return;

    const lines = contrarianState.buf
        .map(e => `• ${e.symbol} (${e.group}) @ ${new Date(e.time).toLocaleTimeString()}`)
        .join("\n");

    sendToTelegram2(
        `⚖️ CONTRARIAN\n` +
        `After BAZOOKA from: ${contrarianState.fromGroup}\n` +
        `Matches: ${contrarianState.buf.length}\n` +
        `Window: 50s\n` +
        `Symbols:\n${lines}`
    );

    // One-shot per Bazooka
    contrarianState.active = false;
    contrarianState.buf = [];
}


function processMatching3(symbol, group, ts, body) {
    const GH = ["G", "H"];
    if (!GH.includes(group)) return;

    const { numericLevels: lvls } = normalizeFibLevel(group, body);
    if (!lvls.length) return;

    const candidate = GH
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => !(x.payload.group === group && x.time === ts))
        .filter(x => ts - x.time <= MATCH_WINDOW_MS)
        .find(x => {
            const norm = normalizeFibLevel(x.payload.group, x.payload);
            return norm.numericLevels.some(v => lvls.includes(v));
        });

    if (!candidate) return;

    sendToTelegram2(
        `🎯 MATCHING 3 (Same Level)\nSymbol: ${symbol}\nLevels: ±${lvls[0]}\nGroups: ${candidate.payload.group} ↔ ${group}\nTimes:\n - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n - ${group}: ${new Date(ts).toLocaleString()}`
    );
}

// ==========================================================
//  GODZILLA (ACW → M = SELL, BDX → N = BUY)
//  Fires on FIRST M / N (one-shot)
//  Multiple concurrent trackers per symbol
//  Bot 8
// ==========================================================

function processGodzilla(symbol, group, ts) {

    const ACW = ["A", "C", "W"];
    const BDX = ["B", "D", "X"];

    // -------------------------
    // ARM SELL TRACKER (ACW)
    // -------------------------
    if (ACW.includes(group)) {
        if (!isGodzillaEligible(symbol, ts)) return;
        if (!canArmGodzilla(symbol, ts)) return;

        if (!godzilllaState.sell[symbol]) {
            godzilllaState.sell[symbol] = [];
        }

        godzilllaState.sell[symbol].push({
            count: 0,
            times: [],
            startTime: ts
        });

        // consume eligibility immediately (prevents reuse)
        consumeGodzillaEligibility(symbol, ts);
        return;
    }

    // -------------------------
    // ARM BUY TRACKER (BDX)
    // -------------------------
    if (BDX.includes(group)) {
        if (!isGodzillaEligible(symbol, ts)) return;
        if (!canArmGodzilla(symbol, ts)) return;

        if (!godzilllaState.buy[symbol]) {
            godzilllaState.buy[symbol] = [];
        }

        godzilllaState.buy[symbol].push({
            count: 0,
            times: [],
            startTime: ts
        });

        // consume eligibility immediately
        consumeGodzillaEligibility(symbol, ts);
        return;
    }

    // -------------------------
    // PROCESS M (SELL) — FIRE ON FIRST M
    // -------------------------
    if (group === "M" && godzilllaState.sell[symbol]) {
        const trackers = godzilllaState.sell[symbol];

        for (let i = trackers.length - 1; i >= 0; i--) {
            const t = trackers[i];

            t.count++;
            t.times.push(ts);

            sendToTelegram8(
                `🦖 GODZILLA_SELL\n` +
                `Symbol: ${symbol}\n` +
                `Anchor: ACW\n` +
                `Anchor Time: ${new Date(t.startTime).toLocaleString()}\n` +
                `\n` +
                `M Time:\n` +
                `1) ${new Date(ts).toLocaleString()}`
            );

            // one-shot → remove tracker immediately
            trackers.splice(i, 1);
        }

        if (!trackers.length) delete godzilllaState.sell[symbol];
        return;
    }

    // -------------------------
    // PROCESS N (BUY) — FIRE ON FIRST N
    // -------------------------
    if (group === "N" && godzilllaState.buy[symbol]) {
        const trackers = godzilllaState.buy[symbol];

        for (let i = trackers.length - 1; i >= 0; i--) {
            const t = trackers[i];

            t.count++;
            t.times.push(ts);

            sendToTelegram8(
                `🦖 GODZILLA_BUY\n` +
                `Symbol: ${symbol}\n` +
                `Anchor: BDX\n` +
                `Anchor Time: ${new Date(t.startTime).toLocaleString()}\n` +
                `\n` +
                `N Time:\n` +
                `1) ${new Date(ts).toLocaleString()}`
            );

            // one-shot → remove tracker immediately
            trackers.splice(i, 1);
        }

        if (!trackers.length) delete godzilllaState.buy[symbol];
        return;
    }
}

// ==========================================================
//  BAZOOKA (GLOBAL ABCDWX burst detector — standalone)
//  Window: 50 seconds | Min count: 10 | Bot 6
// ==========================================================


// ==========================================================
//  BAZOOKA — FROZEN SNAPSHOT (windowed, split-safe)
// ==========================================================

const BAZOOKA_WINDOW_MS = 50 * 1000;
const BAZOOKA_MIN_COUNT = 10;
const BAZOOKA_CHUNK_SIZE = 12; // presentation only

const bazookaState = {
    active: false,
    symbols: new Map(), // symbol → { time, group }
    timer: null
};



// bazookaGlobal[group] = Map(symbol → time)

function processBazooka(symbol, group, ts) {
    // Same global groups as before (matches BABABIA/MAMAMIA universe)
    if (!["A","B","C","D","W","X","S","T","U","V"].includes(group)) return;

    // Start frozen snapshot on FIRST hit
    if (!bazookaState.active) {
        bazookaState.active = true;
        bazookaState.symbols.clear();

        bazookaState.timer = setTimeout(() => {
            const entries = [...bazookaState.symbols.entries()];
            const total = entries.length;

            // OPTION A: silent discard if below threshold
            if (total >= BAZOOKA_MIN_COUNT) {

                // Split ONLY for Telegram delivery
                const chunks = [];
                for (let i = 0; i < entries.length; i += BAZOOKA_CHUNK_SIZE) {
                    chunks.push(entries.slice(i, i + BAZOOKA_CHUNK_SIZE));
                }

                chunks.forEach((chunk, idx) => {
                    const lines = chunk
                        .sort((a, b) => a[1].time - b[1].time)
                        .map(([sym, info]) =>
                            `• ${sym} (${info.group}) @ ${new Date(info.time).toLocaleTimeString()}`
                        )
                        .join("\n");

                    const suffix =
                        chunks.length > 1
                            ? ` (Part ${idx + 1}/${chunks.length})`
                            : "";

                    sendToTelegram6(
                        `💥 BAZOOKA${suffix}\n` +
                        `Total Symbols: ${total}\n` +
                        `Window: 50s\n` +
                        `Symbols:\n${lines}`
                    );
                });

                // GODZILLA eligibility (unchanged semantics)
                for (const [sym] of entries) {
                    markGodzillaEligible(sym, ts);
                }

                // SALSA arm (unchanged)
                for (const [sym] of entries) {
                    salsaState.set(sym, { count: 0, armedAt: ts });
                }

                // CONTRARIAN arm (same as original global behavior)
                contrarianState.active = true;
                contrarianState.since = ts;
                contrarianState.buf = [];
                contrarianState.fromGroup = "ACWSU"; // global, same as before
            }

            // Reset snapshot (prevents late symbols)
            bazookaState.active = false;
            bazookaState.symbols.clear();
            clearTimeout(bazookaState.timer);
            bazookaState.timer = null;

        }, BAZOOKA_WINDOW_MS);
    }

    // Collect symbol ONCE during the window (no overwrite)
    if (!bazookaState.symbols.has(symbol)) {
        bazookaState.symbols.set(symbol, { time: ts, group });
    }
}


// ==========================================================
//  WAKANDA STATE (direction-neutral structure tracking)
// ==========================================================

const WAKANDA_WINDOW_MS = 120 * 1000; // 2 minutes

const wakandaState = {};
// wakandaState[symbol] = {
//   lastHigh: null,     // "E" or "J"
//   lastLow: null,      // "Q" or "R"
//   anchorSeen: false,
//   anchorTime: null,
//   fired: false
// }
function resetWakanda(symbol) {
    delete wakandaState[symbol];
}

function processWakanda(symbol, group, ts) {
if (!wakandaEligible.has(symbol)) return;
wakandaEligible.delete(symbol); // one-shot eligibility

    // -------------------------
    // STRUCTURE LETTERS
    // -------------------------
    const HIGH_STRUCT = ["E", "J"]; // HH → LH
    const LOW_STRUCT  = ["Q", "R"]; // LL → HL

    // -------------------------
    // ANCHORS (direction-neutral)
    // -------------------------
    const ANCHORS = ["A","C","W","S","U","B","D","X","T","V"];

    // -------------------------
    // INIT STATE
    // -------------------------
    if (!wakandaState[symbol]) {
        wakandaState[symbol] = {
            lastHigh: null,
            lastLow: null,
            anchorSeen: false,
            anchorTime: null,
            fired: false
        };
    }

    const state = wakandaState[symbol];

    // -------------------------
    // WINDOW EXPIRY
    // -------------------------
    if (state.anchorTime && ts - state.anchorTime > WAKANDA_WINDOW_MS) {
        resetWakanda(symbol);
        return;
    }

    // -------------------------
    // HANDLE ANCHOR
    // -------------------------
    if (ANCHORS.includes(group)) {
        state.anchorSeen = true;
        state.anchorTime = ts;
        return;
    }

    // -------------------------
    // IGNORE IF NO ANCHOR YET
    // -------------------------
    if (!state.anchorSeen) return;

    // -------------------------
    // HIGH STRUCTURE TRACKING
    // -------------------------
    if (HIGH_STRUCT.includes(group)) {

        // HH → LH combo
        if (state.lastHigh === "E" && group === "J" && !state.fired) {
            sendToTelegram5(
                `🧠 WAKANDA STRUCTURE\n` +
                `Symbol: ${symbol}\n` +
                `Pattern: HH → LH\n` +
                `Anchor Seen: YES\n` +
                `Time: ${new Date(ts).toLocaleString()}`
            );
            state.fired = true;
            return;
        }

        // Track latest high structure
        state.lastHigh = group;
        return;
    }

    // -------------------------
    // LOW STRUCTURE TRACKING
    // -------------------------
    if (LOW_STRUCT.includes(group)) {

        // LL → HL combo
        if (state.lastLow === "Q" && group === "R" && !state.fired) {
            sendToTelegram5(
                `🧠 WAKANDA STRUCTURE\n` +
                `Symbol: ${symbol}\n` +
                `Pattern: LL → HL\n` +
                `Anchor Seen: YES\n` +
                `Time: ${new Date(ts).toLocaleString()}`
            );
            state.fired = true;
            return;
        }

        // Track latest low structure
        state.lastLow = group;
        return;
    }
}



// ==========================================================
//  BLACK_PANTHER (10 groups → 3 distinct groups, ≤ 300s)
// ==========================================================

const BLACK_PANTHER_WINDOW_MS = 300 * 1000;

function processBlackPanther(symbol, group, ts) {
    const ABCDWXSTUV = ["A", "B", "C", "D", "W", "X", "S", "T", "U", "V"];

    if (!ABCDWXSTUV.includes(group)) return;

    // Collect recent distinct groups within window
    const recent = ABCDWXSTUV
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => Math.abs(ts - x.time) <= BLACK_PANTHER_WINDOW_MS);

    // We need at least 3 DISTINCT groups
    const distinct = {};
    for (const x of recent) {
        distinct[x.payload.group] = x;
    }

    const groups = Object.keys(distinct);
    if (groups.length < 3) return;

    // Pick the latest 3 distinct groups by time
    const picked = Object.values(distinct)
        .sort((a, b) => a.time - b.time)
        .slice(-3);

    const times = picked.map(p => new Date(p.time).toLocaleString());

    const msg =
        `🖤 BLACK_PANTHER\n` +
        `Symbol: ${symbol}\n` +
        `Groups: ${picked.map(p => p.payload.group).join(" → ")}\n` +
        `Times:\n` +
        `1) ${times[0]}\n` +
        `2) ${times[1]}\n` +
        `3) ${times[2]}`;

    sendToTelegram5(msg);
}

// ==========================================================
//  GAMMA (ACWSU / BDXTV → 4+ distinct groups within 8 minutes)
// ==========================================================

const GAMMA_WINDOW_MS = 8 * 60 * 1000; // 8 minutes

function processGamma(symbol, group, ts) {
    const GAMMA_GROUPS = ["A","C","W","S","U","B","D","X","T","V"];

    if (!GAMMA_GROUPS.includes(group)) return;

    // Collect recent distinct groups within window
    const recent = GAMMA_GROUPS
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => Math.abs(ts - x.time) <= GAMMA_WINDOW_MS);

    // Build distinct groups
    const distinct = {};
    for (const x of recent) {
        distinct[x.payload.group] = x;
    }

    const groups = Object.keys(distinct);

    // Need at least 4 distinct groups
    if (groups.length < 4) return;

    // Pick latest 4 (or more) by time
    const picked = Object.values(distinct)
        .sort((a, b) => a.time - b.time)
        .slice(-groups.length);

    const times = picked.map(p => new Date(p.time).toLocaleString());

    const msg =
        `🟣 GAMMA\n` +
        `Symbol: ${symbol}\n` +
        `Groups: ${picked.map(p => p.payload.group).join(" → ")}\n` +
        `Count: ${groups.length}\n` +
        `Window: 8m\n` +
        `Times:\n` +
        times.map((t, i) => `${i + 1}) ${t}`).join("\n");

    sendToTelegram5(msg);
}


// ==========================================================
//  BABABIA / MAMAMIA (GLOBAL ABCDWXSTUV burst detector)
// ==========================================================

const BABABIA_WINDOW_MS = 20 * 1000;
const MAMAMIA_WINDOW_MS = 50 * 1000;
const BABABIA_MIN_COUNT = 5;

const bababiaState = {
    A: { active: false, symbols: new Map(), timer: null },
    B: { active: false, symbols: new Map(), timer: null },
    C: { active: false, symbols: new Map(), timer: null },
    D: { active: false, symbols: new Map(), timer: null },
    W: { active: false, symbols: new Map(), timer: null },
    X: { active: false, symbols: new Map(), timer: null },
    S: { active: false, symbols: new Map(), timer: null },
    T: { active: false, symbols: new Map(), timer: null },
    U: { active: false, symbols: new Map(), timer: null },
    V: { active: false, symbols: new Map(), timer: null }
};

function processBababia(symbol, group, ts) {

    if (!bababiaState[group]) return;

    const state = bababiaState[group];

    if (!state.active) {
        state.active = true;
        state.symbols.clear();

        state.timer = setTimeout(() => {

            const entries = [...state.symbols.entries()];
            const count = entries.length;

            if (count >= BABABIA_MIN_COUNT) {

                const lines = entries
                    .sort((a, b) => a[1] - b[1])
                    .map(([s, t]) => `• ${s} @ ${new Date(t).toLocaleTimeString()}`)
                    .join("\n");

                // BABABIA (20s logic label)
                sendToTelegram9(
                    `🎉 BABABIA\n` +
                    `Group: ${group}\n` +
                    `Unique Symbols: ${count}\n` +
                    `Window: 20s\n` +
                    `Symbols:\n${lines}`
                );

                // MAMAMIA (50s label)
                sendToTelegram9(
                    `🎶 MAMAMIA\n` +
                    `Group: ${group}\n` +
                    `Unique Symbols: ${count}\n` +
                    `Window: 50s\n` +
                    `Symbols:\n${lines}`
                );

                for (const [sym] of entries) {
                    markGodzillaEligible(sym, Date.now());
                }

                for (const [sym] of entries) {
                    wakandaEligible.set(sym, Date.now());
                }
            }

            state.active = false;
            state.symbols.clear();
            clearTimeout(state.timer);
            state.timer = null;

        }, MAMAMIA_WINDOW_MS);
    }

    state.symbols.set(symbol, ts);
}


// ==========================================================
//  SALSA 
// ==========================================================

function processSalsa(symbol, group, ts) {
    // Only track E J Q R
    if (!["E", "J", "Q", "R"].includes(group)) return;

    const state = salsaState.get(symbol);
    if (!state) return; // not armed by BAZOOKA

    state.count += 1;

    sendToTelegram3(
        `💃 SALSA ${state.count}\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `Hit #: ${state.count}\n` +
        `Time: ${new Date(ts).toLocaleString()}`
    );

    // After 2nd hit → disarm
    if (state.count >= 2) {
        salsaState.delete(symbol);
    }
}


// ==========================================================
//  TANGO (Buffered repeat detector with per-group windows)
//  A/B → 3.5 minutes
//  W/X → 2.5 minutes
// ==========================================================

const TANGO_WINDOWS_MS = {
    A: 3.5 * 60 * 1000,
    B: 3.5 * 60 * 1000,
    W: 2.5 * 60 * 1000,
    X: 2.5 * 60 * 1000
};

function processTango(symbol, group, ts) {
    if (!TANGO_WINDOWS_MS[group]) return;

    if (!tangoBuf[symbol]) {
        tangoBuf[symbol] = {};
    }
    if (!tangoBuf[symbol][group]) {
        tangoBuf[symbol][group] = [];
    }

    const buf = tangoBuf[symbol][group];

    // Ignore exact duplicates / out-of-order
    if (buf.length && ts <= buf[buf.length - 1]) return;

    // Add hit
    buf.push(ts);

    // Prune old hits based on group-specific window
    const cutoff = ts - TANGO_WINDOWS_MS[group];
    while (buf.length && buf[0] < cutoff) {
        buf.shift();
    }

    // Need at least 2 hits to fire
    if (buf.length < 2) return;

    const first = buf[0];
    const second = buf[1];
    const diffMs = second - first;
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    const msg =
        `🟠 TANGO\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `First hit: ${new Date(first).toLocaleString()}\n` +
        `Second hit: ${new Date(second).toLocaleString()}\n` +
           `Gap: ${diffMin}m ${diffSec}s\n` +
        `Bias: ${biasFromGroup(group)}`;


    sendToTelegram3(msg);

    // Slide window (allow overlapping sequences)
    buf.shift();
}

// ==========================================================
//  NEPTUNE (GLOBAL R / J → any 2 hits within 180s)
//  Bot 4
// ==========================================================

const NEPTUNE_WINDOW_MS = 180 * 1000;

const neptuneGlobal = []; 
// [{ symbol, group, time }]

function processNeptune(symbol, group, ts) {
    if (!["R", "J"].includes(group)) return;

    neptuneGlobal.push({ symbol, group, time: ts });

    const cutoff = ts - NEPTUNE_WINDOW_MS;

    while (neptuneGlobal.length && neptuneGlobal[0].time < cutoff) {
        neptuneGlobal.shift();
    }

    if (neptuneGlobal.length < 2) return;

    const first = neptuneGlobal[0];
    const second = neptuneGlobal[1];

    const diffMs = second.time - first.time;
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    sendToTelegram4(
        `🪐 NEPTUNE\n` +
        `1) ${first.symbol} (${first.group}) @ ${new Date(first.time).toLocaleString()}\n` +
        `2) ${second.symbol} (${second.group}) @ ${new Date(second.time).toLocaleString()}\n` +
        `Gap: ${diffMin}m ${diffSec}s`
    );

    // Slide window (allows overlapping sequences)
    neptuneGlobal.shift();
}


// ==========================================================
//  CONTRARIAN (post-BAZOOKA opposite-group detector)
// ==========================================================

const CONTRARIAN_WINDOW_MS = 50 * 1000;
const CONTRARIAN_EXPIRY_MS = 3 * 60 * 60 * 1000; // 3 hours

const contrarianState = {
    active: false,
    fromGroup: null,   // "ACWSU" or "BDXTV"

    since: null,
    buf: []            // [{ symbol, group, time }]
};

// ==========================================================
//  GODZILLA STATE (ACW → M, BDX → N)
// ==========================================================

const godzilllaState = {
    sell: {}, // symbol → [ { count, times[] }, ... ]
    buy: {}   // symbol → [ { count, times[] }, ... ]
};

// ==========================================================
//  GODZILLA ELIGIBILITY (source + cooldown)
// ==========================================================

const GODZILLA_SOURCE_TTL_MS = 60 * 60 * 1000; // 1 hour max eligibility
const GODZILLA_ARM_COOLDOWN_MS = 20 * 60 * 1000; // 20 min per symbol

const godzillaEligible = new Map();
// symbol → lastEligibleTime
const godzillaLastUsed = new Map();
// symbol → last time we ARMED (used) the symbol

// ==========================================================
//  SALSA (Post-BAZOOKA EJQR sequence tracker)
// ==========================================================

// symbol → { count, armedAt }
const salsaState = new Map();


// ==========================================================
//  WAKANDA ELIGIBILITY (from BABABIA / MAMAMIA only)
// ==========================================================

const wakandaEligible = new Map();
// symbol → lastEligibleTime



// ==========================================================
//  SPESH (BTC ↔ ETH same-group within 90 seconds)
//  Groups: A B E J W X
//  Window-based persistence (overlapping matches allowed)
// ==========================================================

const SPESH_WINDOW_MS = 90 * 1000;
const SPESH_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT"]);
const SPESH_GROUPS = new Set(["A", "B", "W", "X"]);


const speshLast = {
    BTCUSDT: {},
    ETHUSDT: {}
};
// speshLast[symbol][group] = lastTime

function processSpesh(symbol, group, ts) {
    if (!SPESH_SYMBOLS.has(symbol)) return;
    if (!SPESH_GROUPS.has(group)) return;

    const otherSymbol = symbol === "BTCUSDT" ? "ETHUSDT" : "BTCUSDT";
    const otherTs = speshLast[otherSymbol][group];

    // If other side exists and is within window → fire
    if (otherTs && Math.abs(ts - otherTs) <= SPESH_WINDOW_MS) {
        const diffMs = Math.abs(ts - otherTs);
        const diffSec = Math.floor(diffMs / 1000);

        const msg =
            `🟢 SPESH\n` +
            `Group: ${group}\n` +
            `Symbols: BTCUSDT ↔ ETHUSDT\n` +
            `BTC Time: ${new Date(
                symbol === "BTCUSDT" ? ts : otherTs
            ).toLocaleString()}\n` +
            `ETH Time: ${new Date(
                symbol === "ETHUSDT" ? ts : otherTs
            ).toLocaleString()}\n` +
            `Gap: ${diffSec}s`;

        sendToTelegram2(msg);
    }

    // Always update latest timestamp (window controls validity)
    speshLast[symbol][group] = ts;
}

// ==========================================================
//  SNOWFLAKE (BTC ↔ ETH exact-group within 90 seconds)
//  Groups: A B E J K L W X
// ==========================================================

const SNOWFLAKE_WINDOW_MS = 90 * 1000;
const SNOWFLAKE_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT"]);
const SNOWFLAKE_GROUPS = new Set(["A", "B", "K", "L", "W", "X"]);


const snowflakeLast = {
    BTCUSDT: {},
    ETHUSDT: {}
};
// snowflakeLast[symbol][group] = lastTime

function processSnowflake(symbol, group, ts) {
    if (!SNOWFLAKE_SYMBOLS.has(symbol)) return;
    if (!SNOWFLAKE_GROUPS.has(group)) return;

    const otherSymbol = symbol === "BTCUSDT" ? "ETHUSDT" : "BTCUSDT";
    const otherTs = snowflakeLast[otherSymbol][group];

    // Fire if counterpart exists within window
    if (otherTs && Math.abs(ts - otherTs) <= SNOWFLAKE_WINDOW_MS) {
        const diffMs = Math.abs(ts - otherTs);
        const diffSec = Math.floor(diffMs / 1000);

        const msg =
            `❄️ SNOWFLAKE\n` +
            `Group: ${group}\n` +
            `Symbols: BTCUSDT ↔ ETHUSDT\n` +
            `BTC Time: ${new Date(
                symbol === "BTCUSDT" ? ts : otherTs
            ).toLocaleString()}\n` +
            `ETH Time: ${new Date(
                symbol === "ETHUSDT" ? ts : otherTs
            ).toLocaleString()}\n` +
            `Gap: ${diffSec}s`;

        sendToTelegram2(msg);
    }

    // Window-based persistence
    snowflakeLast[symbol][group] = ts;
}


// ==========================================================
//  JUPITER & SATURN (Directional: G/H tracks A–D)
// ==========================================================

function processJupiterSaturn(symbol, group, ts) {
    // ONLY G or H can trigger
    if (!["G", "H"].includes(group)) return;

    const AD = ["A", "B", "C", "D"];

    // Collect all past A–D alerts for this symbol
    const ads = AD
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.time <= ts); // look BACK only

    if (!ads.length) return;

    let firedJupiter = false;
    let firedSaturn  = false;

    for (const ad of ads) {
        const diffMs = ts - ad.time;
        if (diffMs < 0) continue; // safety

        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        // JUPITER (≤ 5 minutes)
        if (diffMs <= JUPITER_WINDOW_MS && !firedJupiter) {
            firedJupiter = true;
           const msg =
    `🟠 JUPITER\n` +
    `Symbol: ${symbol}\n` +
    `AD Group: ${ad.payload.group}\n` +
    `GH Group: ${group}\n` +
    `Gap: ${diffMin}m ${diffSec}s\n` +
    `AD Time: ${new Date(ad.time).toLocaleString()}\n` +
    `GH Time: ${new Date(ts).toLocaleString()}`;

sendToTelegram7(msg);
mirrorToBot8IfSpecial(symbol, msg);

        }

        // SATURN (≤ 50 minutes)
        if (diffMs <= SATURN_WINDOW_MS && !firedSaturn) {
            firedSaturn = true;
            const msg =
    `🪐 SATURN\n` +
    `Symbol: ${symbol}\n` +
    `AD Group: ${ad.payload.group}\n` +
    `GH Group: ${group}\n` +
    `Gap: ${diffMin}m ${diffSec}s`;

sendToTelegram7(msg);
mirrorToBot8IfSpecial(symbol, msg);

        }

        // If both fired for this G/H, stop
        if (firedJupiter && firedSaturn) break;
    }
}


// ==========================================================
//  WEBHOOK HANDLER
// ==========================================================

app.post("/incoming", (req, res) => {
    try {
        
		
		if (!IS_MAIN && !req.headers["x-shadow-forward"]) {
    return res.sendStatus(403);
}
		
		
		const body = req.body || {};
		
		if (IS_MAIN) {
    forwardToShadow(body);
}


		
        if (IS_MAIN) {
    if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
        return res.sendStatus(401);
    }
}


        const group  = (body.group || "").trim();
        const symbol = (body.symbol || "").trim();
        const ts = nowMs();

        const hash = alertHash(symbol, group, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!group || !symbol) return res.sendStatus(200);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        const norm = normalizeFibLevel(group, body);
        body.levelStr = norm.levelStr;
        body.numericLevels = norm.numericLevels;

        saveAlert(symbol, group, ts, body);
        saveState();

        processTracking1(symbol, group, ts, body);
        processTracking2and3(symbol, group, ts, body);
        
       
		
		processLevelCorrelation(symbol, group, ts, body);
       processDivergenceMonitor(symbol, group, ts);
        processMatching2(symbol, group, ts, body);
        processMatching3(symbol, group, ts, body);
		processBazooka(symbol, group, ts, body);
		processContrarian(symbol, group, ts);    
       	        
		processBlackPanther(symbol, group, ts);
        processGamma(symbol, group, ts);

        processSalsa(symbol, group, ts);
        processTango(symbol, group, ts);
		processNeptune(symbol, group, ts);

        processSpesh(symbol, group, ts);
        processSnowflake(symbol, group, ts);
        processBababia(symbol, group, ts);
		processGodzilla(symbol, group, ts);
		processWakanda(symbol, group, ts);
        

		processJupiterSaturn(symbol, group, ts);
		processTracking4(symbol, group, ts, body);
		processTracking5(symbol, group, ts, body);


        // Strong signal (unchanged)
        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();
            if (dir && mom && dir === mom) {
                sendToTelegram2(
                    `🔥 STRONG SIGNAL\nSymbol: ${symbol}\nLevel: ${body.level || body.fib_level || "n/a"}\nDirection: ${dir}\nMomentum: ${mom}\nTime: ${body.time}`
                );
            }
        } catch {}

        res.sendStatus(200);

    } catch (err) {
        console.error("❌ /incoming error:", err);
        res.sendStatus(200);
    }
});

// ==========================================================
//  BOT1 LOOP (unchanged)
// ==========================================================
setInterval(async () => {
    if (!RULES.length) return;

    const access = g => (events[g] || (events[g] = []));

    for (const r of RULES) {
        const { name, groups, threshold, windowSeconds } = r;

        for (const g of groups) pruneOld(access(g), windowSeconds * 1000);

        const counts = {};
        let total = 0;
        for (const g of groups) {
            counts[g] = access(g).length;
            total += counts[g];
        }

        const cd = cooldownUntil[name] || 0;
        if (total >= threshold && cd <= nowSec()) {
            const lines = [];
            lines.push(`🚨 Rule "${name}" fired: ${total} alerts in last ${windowSeconds}s`);
            for (const g of groups) lines.push(`• ${g} count: ${counts[g]}`);
            lines.push("");
            lines.push("Recent alerts:");

            for (const g of groups) {
                access(g).slice(-5).forEach(e => {
                    const d = e.data;
                    lines.push(`[${g}] symbol=${d.symbol} price=${d.price} time=${d.time}`);
                });
            }

            await sendToTelegram1(lines.join("\n"));

// STAGING FIX: do NOT clear buffers (prevents starvation)
if (process.env.ENV !== "staging") {
    for (const g of groups) events[g] = [];
}

cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
saveState();

        }
    }
}, CHECK_MS);

app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
