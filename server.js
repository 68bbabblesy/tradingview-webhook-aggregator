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

// AD2 memory for Divergence Trio
const recentAD2 = {};
// recentAD2[symbol] = { time }

// G/H memory for Level Correlation
const recentGH = {};
// recentGH[symbol] = { group, level, time }

// Divergence Monitor memory (A–D same group within 1h)
const divergenceMonitor = {};
// divergenceMonitor[symbol][group] = lastTime



// AD2 global burst tracking for BIG MARKET MOVE
const recentAD2Global = [];


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


// ==========================================================
//  TRACKING ENGINE
// ==========================================================
function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups = ["G", "H"];

    if (startGroups.includes(group)) {
        trackingStart[symbol] = { startGroup: group, startTime: ts, payload: body };
        saveState();
        return;
    }

    if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];

        // use raw signed level if TradingView sent it
function getSignedLevel(payload) {
    if (!payload) return "";
    if (payload.level) return ` (${payload.level})`;     // H signals
    if (payload.fib_level) return ` (${payload.fib_level})`; // G signals
    return "";
}

const startLevel = getSignedLevel(start.payload); // A–D = "" automatically
const endLevel   = getSignedLevel(body);          // H/G = true signed level


        sendToTelegram4(
            `📌 TRACKING 1 COMPLETE\n` +
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




// ==========================================================
//  MATCHING ENGINE
// ==========================================================

const MATCH_WINDOW_MS = 65 * 1000;

function processMatching1(symbol, group, ts, body) {
     const AD = ["A", "B", "C", "D", "Q", "R"];

    const FGH = ["F", "G", "H"];

    if (AD.includes(group)) {
        const candidate = FGH.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram4(
                `🔁 MATCHING 1\nSymbol: ${symbol}\nGroups: ${group} ↔ ${candidate.payload.group}\nTimes:\n - ${group}: ${new Date(ts).toLocaleString()}\n - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}`
            );
        }
        return;
    }

    if (FGH.includes(group)) {
        const candidate = AD.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram4(
                `🔁 MATCHING 1\nSymbol: ${symbol}\nGroups: ${candidate.payload.group} ↔ ${group}\nTimes:\n - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n - ${group}: ${new Date(ts).toLocaleString()}`
            );
        }
    }
}

function processMatchingAD2(symbol, group, ts) {
    const AD = ["A", "B", "C", "D", "Q", "R"];

    if (!AD.includes(group)) return;

    const candidate = AD
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.payload.group !== group)
        .filter(x => Math.abs(ts - x.time) <= MATCH_WINDOW_MS)
        .sort((a,b) => b.time - a.time)[0];

    if (!candidate) return;

    sendToTelegram4(
        `🔁 AD-2 Divergence\nSymbol: ${symbol}\nGroups: ${candidate.payload.group} ↔ ${group}\nTimes:\n - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n - ${group}: ${new Date(ts).toLocaleString()}`
    );
	// Record AD2 for Divergence Trio
recentAD2[symbol] = { time: ts };

// Global AD2 burst tracking for BIG MARKET MOVE
processBigMarketMove(ts);


}

const TRIO_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

const BIG_MOVE_WINDOW_MS = 45 * 1000;
const BIG_MOVE_THRESHOLD = 3;

function processBigMarketMove(ts) {
    // Add timestamp
    recentAD2Global.push(ts);

    // Keep only recent timestamps
    const cutoff = ts - BIG_MOVE_WINDOW_MS;
    while (recentAD2Global.length && recentAD2Global[0] < cutoff) {
        recentAD2Global.shift();
    }

    if (recentAD2Global.length < BIG_MOVE_THRESHOLD) return;

    sendToTelegram6(
        `🚨 BIG MARKET MOVE\n` +
        `AD2 divergences: ${recentAD2Global.length}\n` +
        `Window: 45 seconds\n` +
        `Time: ${new Date(ts).toLocaleString()}`
    );

    // Reset after firing (once per burst)
    recentAD2Global.length = 0;
}



function processDivergenceTrio(symbol, group, ts, body) {
    if (!["G", "H"].includes(group)) return;

    const ad2 = recentAD2[symbol];
    if (!ad2) return;

    const diffMs = ts - ad2.time;
    if (diffMs > TRIO_WINDOW_MS) return;

    // Extract signed level for G/H
   let level = body.level || "";


    if (level && !String(level).startsWith("-") && !String(level).startsWith("+")) {
        level = `+${level}`;
    }

    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    sendToTelegram5(
        `🔺 DIVERGENCE TRIO\n` +
        `Symbol: ${symbol}\n` +
        `Trigger: ${group} (${level})\n` +
        `Gap: ${diffMin}m ${diffSec}s\n` +
        `Time: ${new Date(ts).toLocaleString()}`
    );

    // Prevent duplicate trio fires
    delete recentAD2[symbol];
}

const LEVEL_CORRELATION_WINDOW_MS = 45 * 1000;

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
		const side = (body.side || "").toUpperCase();
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
        processMatching1(symbol, group, ts, body);
        processMatchingAD2(symbol, group, ts);
		processDivergenceTrio(symbol, group, ts, body);
		processLevelCorrelation(symbol, group, ts, body);
       processDivergenceMonitor(symbol, group, ts);



        processMatching2(symbol, group, ts, body);
        processMatching3(symbol, group, ts, body);
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
