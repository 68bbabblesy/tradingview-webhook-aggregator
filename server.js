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
// -----------------------------
// PERSISTENCE (State File)
// -----------------------------
const STATE_FILE = "/data/state.json";

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, "utf8");
            const parsed = JSON.parse(raw);

            return {
                lastAlert: parsed.lastAlert || {},
                cooldownUntil: parsed.cooldownUntil || {},
                tangoState: parsed.tangoState || {},
                scoreState: parsed.scoreState || {},
                lastSeenState: parsed.lastSeenState || {},
                godzillaState: parsed.godzillaState || {},
                bazookaState: parsed.bazookaState || {},
                hashMemory: parsed.hashMemory || {},
                wakandaState: parsed.wakandaState || {},
                boomPairState: parsed.boomPairState || {},
                inauguralState: parsed.inauguralState || {},
                kookyMemory: parsed.kookyMemory || {},
                speshMemory: parsed.speshMemory || {},
                kookyComboState: parsed.kookyComboState || {},
                speshComboState: parsed.speshComboState || {},
                cobraComboState: parsed.cobraComboState || {},
                cabalState: parsed.cabalState || {},
                mambaFirstState: parsed.mambaFirstState || {}
            };
        }
    } catch {}

    return {
        lastAlert: {},
        cooldownUntil: {},
        tangoState: {},
        scoreState: {},
        lastSeenState: {},
        godzillaState: {},
        bazookaState: {},
        hashMemory: {},
        wakandaState: {},
        boomPairState: {},
        inauguralState: {},
        kookyMemory: {},
        speshMemory: {},
        kookyComboState: {},
        speshComboState: {},
        cobraComboState: {},
        cabalState: {},
        mambaFirstState: {}
    };
}

function saveState() {
    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(
                {
                    lastAlert,
                    cooldownUntil,
                    tangoState,
                    scoreState,
                    lastSeenState,
                    godzillaState,
                    bazookaState,
                    hashMemory,
                    wakandaState,
                    boomPairState,
                    inauguralState,
                    kookyMemory,
                    speshMemory,
                    kookyComboState,
                    speshComboState,
                    cobraComboState,
                    cabalState,
                    mambaFirstState
                },
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

let scoreState = persisted.scoreState || {};
let lastSeenState = persisted.lastSeenState || {};


// ==========================================================
// 🔒 GLOBAL LAST-SEEN ENGINE (PERSISTENT)
// ==========================================================

function getLastSeen(symbol, key) {
    return lastSeenState[symbol]?.[key] || null;
}

function setLastSeen(symbol, key, ts) {
    if (!lastSeenState[symbol]) {
        lastSeenState[symbol] = {};
    }
    lastSeenState[symbol][key] = ts;
    saveState();
}
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

// Optional: disable selected RULES without editing the big RULES JSON.
// Example Render env:
// DISABLED_RULES=ANY3
const DISABLED_RULES = new Set(
    (process.env.DISABLED_RULES || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
);

// -----------------------------
// TIME HELPERS
// -----------------------------
const nowMs  = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// ==========================================================
//  TIME FORMATTER (UK timezone)
// ==========================================================
function formatTime(ts) {
    return new Date(ts).toLocaleTimeString("en-GB", {
        timeZone: "Europe/London"
    });
}

function formatDateTime(ts) {
    return new Date(ts).toLocaleString("en-GB", {
        timeZone: "Europe/London"
    });
}

// -----------------------------
// SYMBOL NORMALIZATION
// -----------------------------
function normalizeSymbol(raw) {
    if (!raw) return "";

    let s = raw.includes(":") ? raw.split(":")[1] : raw;
    s = s.replace(".P", "");

    return s.trim().toUpperCase();
}

// 👇 PARSER HELPER (NEW — KEEP THIS)

function parseNumbers(group) {
    const match = group.match(/(\d+)[^\d]+(\d+)/);
    if (!match) return [];
    return [parseInt(match[1]), parseInt(match[2])];
}


// -----------------------------
// TELEGRAM SENDERS
// -----------------------------
async function sendToTelegram1(text) {
    if (!TELEGRAM_BOT_TOKEN_1 || !TELEGRAM_CHAT_ID_1) return;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_1}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_1, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot1 send failed:", err.message);
    }
}

async function sendToTelegram2(text) {
    if (!TELEGRAM_BOT_TOKEN_2 || !TELEGRAM_CHAT_ID_2) return;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_2}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_2, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot2 send failed:", err.message);
    }
}

// ==========================================================
//  BOT3 — TRACKING 4 (H level switching tracking)
// ==========================================================

// Telegram sender for Bot 3
async function sendToTelegram3(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_3 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_3 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot3 send failed:", err.message);
    }
}

// Telegram sender for Bot 4
async function sendToTelegram4(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_4 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_4 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot4 send failed:", err.message);
    }
}

// Telegram sender for Bot 5
async function sendToTelegram5(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_5 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_5 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot5 send failed:", err.message);
    }
}

// Telegram sender for Bot 6
async function sendToTelegram6(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_6 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_6 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot6 send failed:", err.message);
    }
}

// Telegram sender for Bot 7
async function sendToTelegram7(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_7 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_7 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot7 send failed:", err.message);
    }
}

// Telegram sender for Bot 8
async function sendToTelegram8(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_8 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_8 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot8 send failed:", err.message);
    }
}

// Telegram sender for Bot 9
async function sendToTelegram9(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN_9 || "").trim();
    const chat  = (process.env.TELEGRAM_CHAT_ID_9 || "").trim();
    if (!token || !chat) return;

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text }),
            timeout: 10000
        });
    } catch (err) {
        console.error("⚠️ Bot9 send failed:", err.message);
    }
}


// -----------------------------
// BOT 8 MIRROR HELPER (SPECIAL SYMBOLS)
// -----------------------------
function mirrorToBot8IfSpecial(symbol, text) {
    if (!symbol) return;
    if (!SPECIAL_TOKENS.has(symbol)) return;
    sendToTelegram8(text);
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

// ==========================================================
// FIRST ENGINE (PER SYMBOL 4H COOLDOWN)
// ==========================================================

// ❌ Removed old firstState — now using global lastSeenState

// RESTORED FROM DISK (persistence)
const lastAlert = persisted.lastAlert || {};


// -----------------------------
// SAFE GET
// -----------------------------
function safeGet(symbol, group) {
    return lastAlert[symbol]?.[group] || null;
}



function biasFromGroup(group) {
    if (["A", "C", "W"].includes(group)) return "Support Zone";
    if (["B", "D", "X"].includes(group)) return "Resistance Zone";
    return "Unknown";
}


// ==========================================================
//  TRACKING ENGINE
// ==========================================================










// ==========================================================
//  GODZILLA (PERSISTENT — FIRST → FIRST HASH CONFIRMATION)
//  Source:
//    - FIRST fires first
//    - Then same symbol must receive the FIRST # group of any kind
//    - Any group starting with # is accepted
//  Bot 3
// ==========================================================

// godzillaState[symbol] = {
//   source: "FIRST",
//   sourceTime: ts,
//   sourceGroup: group
// }

let godzillaState = persisted.godzillaState || {};

const GODZILLA_EXPIRE_MS = 2 * 60 * 60 * 1000; // 2 hours

function activateGodzilla(symbol, source, sourceTime, sourceGroup) {

    if (!symbol || !source) return;

    godzillaState[symbol] = {
        source,
        sourceTime,
        sourceGroup: sourceGroup || "n/a"
    };

    saveState();
}

function processGodzilla(symbol, group, ts) {

    if (!symbol || !group) return;

    // GODZILLA listens to the first # group after FIRST
    if (!group.startsWith("#")) return;

    const state = godzillaState[symbol];

    // Must be activated by FIRST first
    if (!state) return;

    const gapFromSourceMs = ts - state.sourceTime;

    // Expire stale FIRST → # tracking after 2 hours
    if (gapFromSourceMs > GODZILLA_EXPIRE_MS) {
        console.log(
            "GODZILLA expired:",
            symbol,
            "source:",
            state.source,
            "sourceTime:",
            formatDateTime(state.sourceTime),
            "hash:",
            group,
            "hashTime:",
            formatDateTime(ts)
        );

        delete godzillaState[symbol];
        saveState();
        return;
    }
    const gapMin = Math.floor(gapFromSourceMs / 60000);
    const gapSec = Math.floor((gapFromSourceMs % 60000) / 1000);

    sendToTelegram3(
        `🦖 GODZILLA\n` +
        `Source: ${state.source}\n` +
        `Symbol: ${symbol}\n\n` +

        `${state.source} Alert:\n` +
        `Group: ${state.sourceGroup || "n/a"}\n` +
        `Time: ${formatDateTime(state.sourceTime)}\n\n` +

        `Hash Confirmation:\n` +
        `Group: ${group}\n` +
        `Time: ${formatDateTime(ts)}\n\n` +

        `Gap from ${state.source}: ${gapMin}m ${gapSec}s`
    );

    // Reset after first hash confirmation
    delete godzillaState[symbol];
    saveState();
}
// ==========================================================
// STC setup removed intentionally.
// ==========================================================
// ==========================================================
//  HASH MEMORY (PERSISTENT — used by BAZOOKA + PREMIER)
//  Stores recent # alerts so reverse-mode setups can fire:
//    - HASH → YABA  = BAZOOKA Mode 2
//    - HASH → FIRST = PREMIER
// ==========================================================

let hashMemory = persisted.hashMemory || {};

const HASH_LOOKBACK_MS = 30 * 60 * 1000; // 30 minutes

// hashMemory[symbol] = [{ group, time }]
function recordHashEvent(symbol, group, ts) {

    if (!symbol || !group) return;
    if (!group.startsWith("#")) return;

    if (!hashMemory[symbol]) {
        hashMemory[symbol] = [];
    }

    hashMemory[symbol].push({
        group,
        time: ts
    });

    const cutoff = ts - HASH_LOOKBACK_MS;
    hashMemory[symbol] = hashMemory[symbol].filter(e => e.time >= cutoff);

    // Safety cleanup
    if (Object.keys(hashMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(hashMemory)) {
            hashMemory[sym] = hashMemory[sym].filter(e => e.time >= pruneCutoff);

            if (!hashMemory[sym].length) {
                delete hashMemory[sym];
            }
        }
    }

    saveState();
}

function getRecentHashBefore(symbol, ts, windowMs) {

    const events = hashMemory[symbol] || [];
    const cutoff = ts - windowMs;

    const recent = events
        .filter(e => e.time <= ts && e.time >= cutoff)
        .sort((a, b) => b.time - a.time);

    return recent[0] || null;
}

// ==========================================================
//  BAZOOKA (PERSISTENT — YABA ↔ HASH CONFIRMATION)
//  Modes:
//    - Mode 1: YABA → HASH within 30m
//    - Mode 2: HASH → YABA within 30m
//  Bot 7
// ==========================================================

// bazookaState[symbol] = {
//   source: "YABA",
//   sourceTime: ts,
//   sourceGroup: group
// }

let bazookaState = persisted.bazookaState || {};

const BAZOOKA_EXPIRE_MS = 30 * 60 * 1000; // 30 minutes

function sendBazookaAlert(symbol, mode, sourceGroup, sourceTime, hashGroup, hashTime) {

    const firstTime = sourceTime <= hashTime ? sourceTime : hashTime;
    const secondTime = sourceTime <= hashTime ? hashTime : sourceTime;

    const gapMs = secondTime - firstTime;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    sendToTelegram7(
        `💥 BAZOOKA\n` +
        `Mode: ${mode}\n` +
        `Source: YABA\n` +
        `Symbol: ${symbol}\n\n` +

        `YABA Alert:\n` +
        `Group: ${sourceGroup || "n/a"}\n` +
        `Time: ${formatDateTime(sourceTime)}\n\n` +

        `Hash Confirmation:\n` +
        `Group: ${hashGroup}\n` +
        `Time: ${formatDateTime(hashTime)}\n\n` +

        `Gap: ${gapMin}m ${gapSec}s`
    );
}

function activateBazooka(symbol, source, sourceTime, sourceGroup) {

    if (!symbol || !source) return;

    // BAZOOKA is currently only for YABA.
    if (source !== "YABA") return;

    // MODE 2: HASH → YABA
    // If a recent hash already happened before YABA, fire Mode 2 immediately.
    const priorHash = getRecentHashBefore(symbol, sourceTime, BAZOOKA_EXPIRE_MS);

    if (priorHash) {
        sendBazookaAlert(
            symbol,
            "HASH → YABA",
            sourceGroup,
            sourceTime,
            priorHash.group,
            priorHash.time
        );
    }

    // IMPORTANT:
    // Even if Mode 2 fired, still arm Mode 1.
    // This allows a later hash after YABA to fire YABA → HASH as well.
    bazookaState[symbol] = {
        source,
        sourceTime,
        sourceGroup: sourceGroup || "n/a"
    };

    saveState();
}

function processBazooka(symbol, group, ts) {

    if (!symbol || !group) return;

    // BAZOOKA listens to the first # group after YABA
    if (!group.startsWith("#")) return;

    const state = bazookaState[symbol];

    // Must be activated by YABA first
    if (!state) return;

    const gapFromSourceMs = ts - state.sourceTime;

    // Expire stale YABA → HASH tracking after 30 minutes
    if (gapFromSourceMs > BAZOOKA_EXPIRE_MS) {
        console.log(
            "BAZOOKA expired:",
            symbol,
            "source:",
            state.source,
            "sourceTime:",
            formatDateTime(state.sourceTime),
            "hash:",
            group,
            "hashTime:",
            formatDateTime(ts)
        );

        delete bazookaState[symbol];
        saveState();
        return;
    }

    // MODE 1: YABA → HASH
    sendBazookaAlert(
        symbol,
        "YABA → HASH",
        state.sourceGroup,
        state.sourceTime,
        group,
        ts
    );

    // Reset only after Mode 1 completes.
    delete bazookaState[symbol];
    saveState();
}

// ==========================================================
//  PREMIER (PERSISTENT HASH MEMORY — HASH → FIRST)
//  Mode-2 version of GODZILLA:
//    - # comes first
//    - FIRST fires within 30m after #
//  Bot 2
// ==========================================================

function processPremier(symbol, firstGroup, firstTime) {

    if (!symbol) return;

    const priorHash = getRecentHashBefore(symbol, firstTime, HASH_LOOKBACK_MS);

    if (!priorHash) return;

    const gapMs = firstTime - priorHash.time;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    sendToTelegram6(
        `🏆 PREMIER\n` +
        `Mode: HASH → FIRST\n` +
        `Source: FIRST\n` +
        `Symbol: ${symbol}\n\n` +

        `Hash Confirmation:\n` +
        `Group: ${priorHash.group}\n` +
        `Time: ${formatDateTime(priorHash.time)}\n\n` +

        `FIRST Alert:\n` +
        `Group: ${firstGroup || "n/a"}\n` +
        `Time: ${formatDateTime(firstTime)}\n\n` +

        `Gap: ${gapMin}m ${gapSec}s`
    );
}

// ==========================================================
//  WAKANDA (PERSISTENT — GAMMA ↔ HASH CONFIRMATION)
//  Modes:
//    - Mode 1: GAMMA → HASH within 30m
//    - Mode 2: HASH → GAMMA within 30m
//  Bot 7
// ==========================================================

// wakandaState[symbol] = {
//   source: "GAMMA",
//   sourceTime: ts,
//   sourceGroup: group
// }

let wakandaState = persisted.wakandaState || {};

const WAKANDA_EXPIRE_MS = 30 * 60 * 1000; // 30 minutes

function sendWakandaAlert(symbol, mode, sourceGroup, sourceTime, hashGroup, hashTime) {

    const firstTime = sourceTime <= hashTime ? sourceTime : hashTime;
    const secondTime = sourceTime <= hashTime ? hashTime : sourceTime;

    const gapMs = secondTime - firstTime;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    sendToTelegram7(
        `🚨 WAKANDA\n` +
        `Mode: ${mode}\n` +
        `Source: GAMMA\n` +
        `Symbol: ${symbol}\n\n` +

        `GAMMA Alert:\n` +
        `Group: ${sourceGroup || "n/a"}\n` +
        `Time: ${formatDateTime(sourceTime)}\n\n` +

        `Hash Confirmation:\n` +
        `Group: ${hashGroup}\n` +
        `Time: ${formatDateTime(hashTime)}\n\n` +

        `Gap: ${gapMin}m ${gapSec}s`
    );
}

function activateWakanda(symbol, source, sourceTime, sourceGroup) {

    if (!symbol || !source) return;

    // WAKANDA is currently only for GAMMA.
    if (source !== "GAMMA") return;

    // MODE 2: HASH → GAMMA
    // If a recent hash already happened before GAMMA, fire Mode 2 immediately.
    const priorHash = getRecentHashBefore(symbol, sourceTime, WAKANDA_EXPIRE_MS);

    if (priorHash) {
        sendWakandaAlert(
            symbol,
            "HASH → GAMMA",
            sourceGroup,
            sourceTime,
            priorHash.group,
            priorHash.time
        );
    }

    // Even if Mode 2 fired, still arm Mode 1.
    // This allows a later hash after GAMMA to fire GAMMA → HASH as well.
    wakandaState[symbol] = {
        source,
        sourceTime,
        sourceGroup: sourceGroup || "n/a"
    };

    saveState();
}

function processWakanda(symbol, group, ts) {

    if (!symbol || !group) return;

    // WAKANDA listens to the first # group after GAMMA
    if (!group.startsWith("#")) return;

    const state = wakandaState[symbol];

    // Must be activated by GAMMA first
    if (!state) return;

    const gapFromSourceMs = ts - state.sourceTime;

    // Expire stale GAMMA → HASH tracking after 30 minutes
    if (gapFromSourceMs > WAKANDA_EXPIRE_MS) {
        console.log(
            "WAKANDA expired:",
            symbol,
            "source:",
            state.source,
            "sourceTime:",
            formatDateTime(state.sourceTime),
            "hash:",
            group,
            "hashTime:",
            formatDateTime(ts)
        );

        delete wakandaState[symbol];
        saveState();
        return;
    }

    // MODE 1: GAMMA → HASH
    sendWakandaAlert(
        symbol,
        "GAMMA → HASH",
        state.sourceGroup,
        state.sourceTime,
        group,
        ts
    );

    // Reset only after Mode 1 completes.
    delete wakandaState[symbol];
    saveState();
}

// ==========================================================
//  BLACK_PANTHER (Family subgroup burst detector)
//  Condition:
//    - Same symbol
//    - Same family: 16A/16B/16C => family 16
//    - 3 DISTINCT subgroups within 1 minute
//  Bot 4
// ==========================================================

const BLACK_PANTHER_WINDOW_MS = 60 * 1000; // 1 minute

// blackPantherMemory[symbol][family] = [{ group, time }]
const blackPantherMemory = {};

function processBlackPanther(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getFamily(group);
    if (!family) return;

    if (!blackPantherMemory[symbol]) {
        blackPantherMemory[symbol] = {};
    }

    if (!blackPantherMemory[symbol][family]) {
        blackPantherMemory[symbol][family] = [];
    }

    const buf = blackPantherMemory[symbol][family];

    // Keep only last 1 minute
    const cutoff = ts - BLACK_PANTHER_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    // Keep groups distinct: if same subgroup repeats, refresh its timestamp
    const existingIndex = buf.findIndex(e => e.group === group);
    if (existingIndex !== -1) {
        buf.splice(existingIndex, 1);
    }

    buf.push({ group, time: ts });

    // Need 3 distinct subgroups
    if (buf.length < 3) return;

    const picked = buf
        .slice()
        .sort((a, b) => a.time - b.time)
        .slice(-3);

    const firstTime = picked[0].time;
    const lastTime  = picked[picked.length - 1].time;

    const gapMs  = lastTime - firstTime;
    const gapSec = Math.floor(gapMs / 1000);

    sendToTelegram4(
        `🖤 BLACK_PANTHER\n` +
        `Symbol: ${symbol}\n` +
        `Family: ${family}\n` +
        `Subgroups: ${picked.map(e => e.group).join(" → ")}\n` +
        `Window: ${gapSec}s\n\n` +
        `Times:\n` +
        picked.map((e, i) =>
            `${i + 1}) ${e.group} @ ${formatDateTime(e.time)}`
        ).join("\n")
    );

    // Reset this symbol+family after firing to avoid spam
    delete blackPantherMemory[symbol][family];

    // Safety cleanup
    if (Object.keys(blackPantherMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(blackPantherMemory)) {
            const families = blackPantherMemory[sym];

            for (const fam of Object.keys(families)) {
                const arr = families[fam];
                if (!arr.length || arr[arr.length - 1].time < pruneCutoff) {
                    delete families[fam];
                }
            }

            if (!Object.keys(families).length) {
                delete blackPantherMemory[sym];
            }
        }
    }
}

// ==========================================================
//  GAMMA (EXACT GROUP REPEAT — ANY GROUP)
//  Condition:
//    - Same symbol + SAME group repeats
//    - ≤10 min → REAL ALERT
//    - 10–15 min → NEAR MISS
//  Bot 4
// ==========================================================

const GAMMA_WINDOW_MS = 10 * 60 * 1000;        // 10 minutes
const GAMMA_NEAR_BUFFER_MS = 5 * 60 * 1000;   // extra 5 minutes (10–15 range)

// gammaMemory[symbol][group] = lastTimestamp
const gammaMemory = {};

function processGamma(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!gammaMemory[symbol]) {
        gammaMemory[symbol] = {};
    }

    const last = gammaMemory[symbol][group];

    if (last) {

        const diffMs = ts - last;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

   // ======================================================
// 🟣 REAL ALERT (≤10 min)
// ======================================================
if (diffMs <= GAMMA_WINDOW_MS) {

    sendToTelegram4(
        `🟣 GAMMA\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n\n` +
        `First hit: ${formatDateTime(last)}\n` +
        `Second hit: ${formatDateTime(ts)}\n` +
        `Gap: ${diffMin}m ${diffSec}s`
    );


    

    activateWakanda(symbol, "GAMMA", ts, group);
// existing (leave this)


    // 🔥 ADD THIS LINE (for BAZOOKA)

}
        // ======================================================
        // 🟡 NEAR MISS (10–15 min)
        // ======================================================
        else if (diffMs <= GAMMA_WINDOW_MS + GAMMA_NEAR_BUFFER_MS) {

            sendToTelegram4(
                `🟡 GAMMA NEAR MISS\n` +
                `Symbol: ${symbol}\n` +
                `Group: ${group}\n\n` +
                `First hit: ${formatDateTime(last)}\n` +
                `Second hit: ${formatDateTime(ts)}\n` +
                `Gap: ${diffMin}m ${diffSec}s\n\n` +
                `Threshold: 10m\n` +
                `Range: 10–15m`
            );
        }
    }

    // ======================================================
    // Always update latest hit
    // ======================================================
    gammaMemory[symbol][group] = ts;

    // ======================================================
    // Safety cleanup
    // ======================================================
    if (Object.keys(gammaMemory).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(gammaMemory)) {
            const groups = gammaMemory[sym];

            for (const g of Object.keys(groups)) {
                if (groups[g] < cutoff) {
                    delete groups[g];
                }
            }

            if (!Object.keys(groups).length) {
                delete gammaMemory[sym];
            }
        }
    }
}

// ==========================================================
//  BABABIA (Buffered Burst Engine)
//  Logical Window: 50 seconds
//  Delivery Buffer: 60 seconds
// ==========================================================

const BABABIA_WINDOW_MS = 50 * 1000;
const BABABIA_BUFFER_MS = 60 * 1000;
const BABABIA_MIN_COUNT = 10;

const bababiaState = {
    O: { active: false, symbols: new Map(), startTime: null, timer: null },
    P: { active: false, symbols: new Map(), startTime: null, timer: null }
};

function processBababia(symbol, group, ts) {

    if (!bababiaState[group]) return;

    const state = bababiaState[group];

    // Start burst on first hit
    if (!state.active) {
        state.active = true;
        state.startTime = ts;
        state.symbols.clear();

        state.timer = setTimeout(() => {

            // Only count hits within logical 50s window
            const cutoff = state.startTime + BABABIA_WINDOW_MS;

            const entries = [...state.symbols.entries()]
                .filter(([_, time]) => time <= cutoff);

            if (entries.length >= BABABIA_MIN_COUNT) {

                const lines = entries
                    .sort((a, b) => a[1] - b[1])
                    .map(([sym, time]) =>
                        `• ${sym} @ ${new Date(time).toLocaleTimeString()}`
                    )
                    .join("\n");

                sendToTelegram9(
                    `🎉 BABABIA\n` +
                    `Group: ${group}\n` +
                    `Unique Symbols: ${entries.length}\n` +
                    `Window: 50s\n` +
                    `Symbols:\n${lines}`
                );
            }

            // Reset
            state.active = false;
            state.symbols.clear();
            state.startTime = null;
            clearTimeout(state.timer);
            state.timer = null;

        }, BABABIA_WINDOW_MS + BABABIA_BUFFER_MS);
    }

    // Always collect (we filter later)
    state.symbols.set(symbol, ts);
}


// ==========================================================
//  MAMAMIA (HASH ECOSYSTEM — same symbol, different # groups)
//  Condition:
//    - # ecosystem only
//    - Same symbol
//    - Different # groups
//    - Within 20 seconds
//  Bot 1
// ==========================================================

const MAMAMIA_HASH_WINDOW_MS = 20 * 1000; // 20 seconds

// mamamiaHashMemory[symbol] = [{ group, time }]
const mamamiaHashMemory = {};

function processMAMAMIA(symbol, group, ts) {

    if (!symbol || !group) return;

    // MAMAMIA is only for # ecosystem
    if (!group.startsWith("#")) return;

    if (!mamamiaHashMemory[symbol]) {
        mamamiaHashMemory[symbol] = [];
    }

    let buf = mamamiaHashMemory[symbol];

    // Keep only last 20 seconds
    const cutoff = ts - MAMAMIA_HASH_WINDOW_MS;
    buf = buf.filter(e => e.time >= cutoff);
    mamamiaHashMemory[symbol] = buf;

    // Find a DIFFERENT # group inside the 20s window
    const match = buf.find(e => e.group !== group);

    if (match) {

        const firstTime = match.time <= ts ? match.time : ts;
        const secondTime = match.time <= ts ? ts : match.time;

        const firstGroup = match.time <= ts ? match.group : group;
        const secondGroup = match.time <= ts ? group : match.group;

        const diffMs = secondTime - firstTime;
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram1(
            `🎶 MAMAMIA\n` +
            `Symbol: ${symbol}\n` +
            `Condition: Different # groups within 20s\n\n` +
            `1) ${firstGroup} @ ${formatDateTime(firstTime)}\n` +
            `2) ${secondGroup} @ ${formatDateTime(secondTime)}\n` +
            `Gap: ${diffSec}s`
        );

        // Reset cluster, but keep current # as fresh seed for future pairs
        mamamiaHashMemory[symbol] = [
            {
                group,
                time: ts
            }
        ];

        return;
    }

    // Avoid stacking exact same # repeatedly; refresh timestamp instead
    const sameIndex = buf.findIndex(e => e.group === group);

    if (sameIndex !== -1) {
        buf[sameIndex] = {
            group,
            time: ts
        };
    } else {
        buf.push({
            group,
            time: ts
        });
    }

    mamamiaHashMemory[symbol] = buf;

    // Safety cleanup
    if (Object.keys(mamamiaHashMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(mamamiaHashMemory)) {
            mamamiaHashMemory[sym] = mamamiaHashMemory[sym]
                .filter(e => e.time >= pruneCutoff);

            if (!mamamiaHashMemory[sym].length) {
                delete mamamiaHashMemory[sym];
            }
        }
    }
}

// ==========================================================
//  CHECK (RAW ALL ALERTS — DEBUG)
//  Sends EVERYTHING to Bot 1
// ==========================================================

function processCheck(symbol, group, ts, body) {

    const msg =
        `🧪 CHECK\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `Price: ${body.price || "n/a"}\n` +
        `Time: ${formatDateTime(ts)}\n` +
        `Raw:\n${JSON.stringify(body)}`;

    sendToTelegram1(msg);
}

// ==========================================================
//  SALSA (Exact subgroup repeat detector)
//  Condition:
//    - Same symbol
//    - EXACT same group repeats
//    - Within 90 seconds
//  Bot 9
// ==========================================================

const SALSA_WINDOW_MS = 90 * 1000; // 90 seconds

// salsaMemory[symbol][group] = lastTimestamp
const salsaMemory = {};

function processSalsa(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!salsaMemory[symbol]) {
        salsaMemory[symbol] = {};
    }

    const last = salsaMemory[symbol][group];

    // 🔥 FIRE if repeat within 90 seconds
    if (last && (ts - last <= SALSA_WINDOW_MS)) {

        const diffMs = ts - last;
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram9(
            `💃 SALSA\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n\n` +
            `First hit: ${formatDateTime(last)}\n` +
            `Second hit: ${formatDateTime(ts)}\n` +
            `Gap: ${diffSec}s\n` +
            `Window: 90s`
        );
    }

    // Always update latest hit
    salsaMemory[symbol][group] = ts;

    // Safety cleanup
    if (Object.keys(salsaMemory).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(salsaMemory)) {
            const groups = salsaMemory[sym];

            for (const g of Object.keys(groups)) {
                if (groups[g] < cutoff) {
                    delete groups[g];
                }
            }

            if (!Object.keys(groups).length) {
                delete salsaMemory[sym];
            }
        }
    }
}
// ==========================================================
//  TANGO (FIRST per SYMBOL + GROUP FAMILY)
//  Family = prefix (26A → 26, 43X → 43, C → C)
//  Window: 4 hours
//  Bot 4
// ==========================================================

const TANGO_WINDOW_MS = 4 * 60 * 60 * 1000;

// PERSISTED STATE
let tangoState = persisted.tangoState || {};


// STC tracking state removed intentionally.

// tangoState[symbol][family] = lastTimestamp

function getFamily(group) {
    if (!group) return "";

    // Extract numeric prefix (26A → 26)
    const match = group.match(/^(\d+)/);
    if (match) return match[1];

    // Single letter groups
    return group;
}

function processTango(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getFamily(group);

    if (!tangoState[symbol]) {
        tangoState[symbol] = {};
    }

    const last = tangoState[symbol][family];

    // ------------------------------------------------------
    // 1️⃣ FIRST after 4h → FIRE
    // ------------------------------------------------------
    if (!last || (ts - last >= TANGO_WINDOW_MS)) {

        sendToTelegram4(
            `🟠 TANGO\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n` +
            `Family: ${family}\n` +
            `Time: ${formatDateTime(ts)}`
        );


        tangoState[symbol][family] = ts;
        saveState();
        return;
    }

    // else → ignore
}


// ==========================================================
//  NEPTUNE (Same-group repeat detector — ANY group)
//  Condition: Same symbol + SAME group, 3+ hits within 1 hour
//  Bot 9
// ==========================================================

const NEPTUNE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// neptuneMemory[symbol][group] = [timestamps]
const neptuneMemory = {};

function processNeptune(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!neptuneMemory[symbol]) {
        neptuneMemory[symbol] = {};
    }

    if (!neptuneMemory[symbol][group]) {
        neptuneMemory[symbol][group] = [];
    }

    const buf = neptuneMemory[symbol][group];

    // Add current hit
    buf.push(ts);

    // Prune old hits
    const cutoff = ts - NEPTUNE_WINDOW_MS;
    while (buf.length && buf[0] < cutoff) {
        buf.shift();
    }

    // Trigger on 3rd hit
    if (buf.length >= 3) {

        const first = buf[0];
        const last  = buf[buf.length - 1];

        const diffMs = last - first;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        const lines = buf
            .map((t, i) =>
                `${i + 1}) ${formatDateTime(t)}`
            )
            .join("\n");

        sendToTelegram5(
            `🌊 NEPTUNE\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n` +
            `Hits: ${buf.length}\n` +
            `Window: 1h\n` +
            `Span: ${diffMin}m ${diffSec}s\n` +
            `Times:\n${lines}`
        );

        // Reset after firing (per group only)
        delete neptuneMemory[symbol][group];
    }

    // Optional memory cleanup
    if (Object.keys(neptuneMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);
        for (const sym of Object.keys(neptuneMemory)) {
            const groups = neptuneMemory[sym];
            for (const g of Object.keys(groups)) {
                const arr = groups[g];
                if (!arr.length || arr[arr.length - 1] < pruneCutoff) {
                    delete groups[g];
                }
            }
            if (!Object.keys(groups).length) {
                delete neptuneMemory[sym];
            }
        }
    }
}

// ==========================================================
//  ZULU (Subgroup Pair Detector — SAME FAMILY)
//  Condition:
//    - Groups like 26A, 26B, 19X, etc.
//    - Same family (e.g. 26)
//    - Two DIFFERENT subgroups
//    - First occurrence in 4 hours (per family)
//    - Pair must occur within 10 minutes
//  One cycle per symbol+family → resets after fire
//  Bot 6
// ==========================================================

const ZULU_FIRST_WINDOW_MS = 4 * 60 * 60 * 1000;  // 4 hours
const ZULU_PAIR_WINDOW_MS  = 10 * 60 * 1000;      // 10 minutes

// zuluState[symbol][family] = {
//   first: { group, time }
// }

const zuluState = {};

function processZulu(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getFamily(group);
    if (!family) return; // ignore non-subgroups

    if (!zuluState[symbol]) {
        zuluState[symbol] = {};
    }

    if (!zuluState[symbol][family]) {
        zuluState[symbol][family] = {
            first: null
        };
    }

    const state = zuluState[symbol][family];

    // ========================
    // FIRST HIT (per 4h window)
    // ========================
    if (!state.first || (ts - state.first.time > ZULU_FIRST_WINDOW_MS)) {
        state.first = { group, time: ts };
        return;
    }

    // ========================
    // SECOND HIT
    // ========================
    const first = state.first;

    // Must be DIFFERENT subgroup
    if (first.group === group) return;

    const diffMs = ts - first.time;

    if (diffMs <= ZULU_PAIR_WINDOW_MS) {

        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram4(
            `🟡 ZULU\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n` +
            `1) ${first.group} @ ${formatDateTime(first.time)}\n` +
            `2) ${group} @ ${formatDateTime(ts)}\n` +
            `Gap: ${diffMin}m ${diffSec}s\n` +
            `Condition: First-in-4h + Pair ≤10m`
        );


        // RESET after fire
        delete zuluState[symbol][family];
    }

    // ========================
    // SAFETY CLEANUP
    // ========================
    if (Object.keys(zuluState).length > 5000) {
        const cutoff = ts - (6 * 60 * 60 * 1000);
        for (const sym of Object.keys(zuluState)) {
            for (const fam of Object.keys(zuluState[sym])) {
                const s = zuluState[sym][fam];
                if (!s.first || s.first.time < cutoff) {
                    delete zuluState[sym][fam];
                }
            }
            if (!Object.keys(zuluState[sym]).length) {
                delete zuluState[sym];
            }
        }
    }
}

// ==========================================================
//  ANY_TWO (Batch version — same structure as MINTA)
//  Condition: Same symbol, must involve A or B
//  Special case allowed: A→A and B→B
//  Window: 5 minutes
//  Batch delay: 5 minutes
//  Bot 5
// ==========================================================

const ANY_TWO_WINDOW_MS = 5 * 60 * 1000;

const anyTwoState = {};

// anyTwoState[symbol] = { events: [], timer }

function processAnyTwo(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!anyTwoState[symbol]) {

        anyTwoState[symbol] = {
            events: [],
            timer: null
        };

        anyTwoState[symbol].timer = setTimeout(() => {

            const state = anyTwoState[symbol];
            const events = state.events;

            let valid = false;

            for (let i = 0; i < events.length; i++) {

                for (let j = i + 1; j < events.length; j++) {

                    const g1 = events[i].group;
                    const g2 = events[j].group;

                    const isAB1 = g1 === "A" || g1 === "B";
                    const isAB2 = g2 === "A" || g2 === "B";

                    const pairValid =
                        (isAB1 && g1 !== g2) ||      // A/B with other group
                        (isAB2 && g1 !== g2) ||      // other group with A/B
                        (g1 === g2 && isAB1);        // A→A or B→B

                    if (pairValid) {
                        valid = true;
                        break;
                    }
                }

                if (valid) break;
            }

            if (valid) {

                const lines = events
                    .sort((a,b)=>a.time-b.time)
                    .map(e =>
                        `• ${e.group} @ ${formatTime(e.time)}`
                    )
                    .join("\n");

                sendToTelegram5(
                    `🔁 ANY_TWO\n` +
                    `Symbol: ${symbol}\n` +
                    `Count: ${events.length}\n` +
                    `Window: 5m\n` +
                    `Alerts:\n${lines}`
                );
				registerTrinity(symbol, "ANY_TWO");
            }

            delete anyTwoState[symbol];

        }, ANY_TWO_WINDOW_MS);
    }

    anyTwoState[symbol].events.push({
        group,
        time: ts
    });
}

// ==========================================================
//  SIDE_FLIP (Structural side oscillation detector)
//  Support side: A C W S U Y
//  Resistance side: B D X T V Z
//  Pattern: S → R → S  OR  R → S → R
//  Window: 4 minutes
//  Bot 6
// ==========================================================

const SIDE_FLIP_WINDOW_MS = 4 * 60 * 1000;

const SUPPORT_SIDE = new Set(["A","C","W","S","U","Y"]);
const RESIST_SIDE  = new Set(["B","D","X","T","V","Z"]);

// sideFlipMemory[symbol] = [{ side, group, time }]
const sideFlipMemory = {};

function processSideFlip(symbol, group, ts) {

    let side = null;

    if (SUPPORT_SIDE.has(group)) side = "S";
    else if (RESIST_SIDE.has(group)) side = "R";
    else return;

    if (!sideFlipMemory[symbol]) {
        sideFlipMemory[symbol] = [];
    }

    const buf = sideFlipMemory[symbol];

    // remove old events
    const cutoff = ts - SIDE_FLIP_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    buf.push({ side, group, time: ts });

    if (buf.length < 3) return;

    const a = buf[buf.length - 3];
    const b = buf[buf.length - 2];
    const c = buf[buf.length - 1];

    const pattern1 = a.side === "S" && b.side === "R" && c.side === "S";
    const pattern2 = a.side === "R" && b.side === "S" && c.side === "R";

    if (!pattern1 && !pattern2) return;

    const diffMs = c.time - a.time;
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    sendToTelegram6(
        `🔁 SIDE_FLIP\n` +
        `Symbol: ${symbol}\n` +
        `Pattern: ${a.side} → ${b.side} → ${c.side}\n` +
        `1) ${a.group} @ ${new Date(a.time).toLocaleTimeString()}\n` +
        `2) ${b.group} @ ${new Date(b.time).toLocaleTimeString()}\n` +
        `3) ${c.group} @ ${new Date(c.time).toLocaleTimeString()}\n` +
        `Window: ${diffMin}m ${diffSec}s`
    );
}


// ==========================================================
//  MAMBA (PERSISTENT — first family cross in 2h)
//  Condition:
//    - Main ecosystem only
//    - Same symbol
//    - Same numeric family, e.g. 16A + 16B
//    - Different exact subgroups
//    - Pair must occur within 90 seconds
//    - Only first valid cross per symbol+family in 2 hours
//  Bot 6
// ==========================================================

const MAMBA_PAIR_WINDOW_MS = 90 * 1000; // 90 seconds
const MAMBA_FIRST_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// mambaMemory[symbol][family] = { group, time }
const mambaMemory = {};

// mambaFirstState[symbol][family] = lastFireTimestamp
let mambaFirstState = persisted.mambaFirstState || {};

function getMambaFamily(group) {
    const match = String(group || "").match(/^(\d+)[A-Z]$/);
    return match ? match[1] : "";
}

function processMamba(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getMambaFamily(group);
    if (!family) return;

    if (!mambaMemory[symbol]) {
        mambaMemory[symbol] = {};
    }

    if (!mambaFirstState[symbol]) {
        mambaFirstState[symbol] = {};
    }

    const lastSeen = mambaMemory[symbol][family];
    const lastFire = mambaFirstState[symbol][family] || null;

    // If already fired for this symbol+family inside 2h, only refresh memory and ignore alert.
    const stillInsideFirstWindow =
        lastFire && (ts - lastFire < MAMBA_FIRST_WINDOW_MS);

    if (
        lastSeen &&
        lastSeen.group !== group &&
        (ts - lastSeen.time <= MAMBA_PAIR_WINDOW_MS)
    ) {

        if (!stillInsideFirstWindow) {

            const diffMs = ts - lastSeen.time;
            const diffSec = Math.floor(diffMs / 1000);

            sendToTelegram6(
                `🐍 MAMBA\n` +
                `Symbol: ${symbol}\n` +
                `Family: ${family}\n` +
                `Rule: First family cross in 2 hours\n` +
                `Condition: Different same-family subgroups within 90s\n\n` +
                `1) ${lastSeen.group} @ ${formatDateTime(lastSeen.time)}\n` +
                `2) ${group} @ ${formatDateTime(ts)}\n` +
                `Gap: ${diffSec}s\n` +
                `Last MAMBA: ${lastFire ? formatDateTime(lastFire) : "none"}`
            );

            mambaFirstState[symbol][family] = ts;
            saveState();
        }

        // Reset family memory after a valid cross attempt, but keep current subgroup as fresh seed.
        mambaMemory[symbol][family] = {
            group,
            time: ts
        };

        return;
    }

    // Always update latest subgroup seen for this symbol+family.
    mambaMemory[symbol][family] = {
        group,
        time: ts
    };

    // Safety cleanup for persisted first-fire state.
    if (Object.keys(mambaFirstState).length > 5000) {
        const pruneCutoff = ts - (4 * 60 * 60 * 1000);

        for (const sym of Object.keys(mambaFirstState)) {
            const families = mambaFirstState[sym];

            for (const fam of Object.keys(families)) {
                if (families[fam] < pruneCutoff) {
                    delete families[fam];
                }
            }

            if (!Object.keys(families).length) {
                delete mambaFirstState[sym];
            }
        }

        saveState();
    }
}

// ==========================================================
//  SPESH (PERSISTENT — number-letter subgroup combo repeat)
//  Condition:
//    - Same symbol
//    - 2+ exact number-letter subgroups within 20 seconds
//    - Example: 16B + 28K + 43X
//    - Stores all subset combos size 2+
//    - Same combo repeats within 2 hours
//  Bot 7
// ==========================================================

// speshComboState[symbol][comboKey] = { time, groups }
let speshComboState = persisted.speshComboState || {};
const speshComboRuntime = {};

function processSpesh(symbol, group, ts) {
    processComboRepeatEngine(
        {
            name: "SPESH",
            emoji: "🟢",
            description: "Number-letter subgroup combo repeat",
            state: speshComboState,
            runtime: speshComboRuntime,
            isValidGroup: isComboNumberLetter
        },
        symbol,
        group,
        ts
    );
}

// ==========================================================
//  CABAL (PERSISTENT — 29/30 family subgroup pair detector)
//  Condition:
//    - Main ecosystem only
//    - Same symbol
//    - Only families 29 and 30
//    - Same family only: 29A + 29C OR 30J + 30F
//    - Different exact subgroups
//    - Pair within 20 seconds
//  Bot 5
// ==========================================================

const CABAL_WINDOW_MS = 20 * 1000; // 20 seconds

// cabalState[symbol][family] = [{ group, time }]
let cabalState = persisted.cabalState || {};

function getCabalFamily(group) {
    if (/^29[A-Z]$/.test(group)) return "29";
    if (/^30[A-Z]$/.test(group)) return "30";
    return "";
}

function processCabal(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getCabalFamily(group);
    if (!family) return;

    if (!cabalState[symbol]) {
        cabalState[symbol] = {};
    }

    if (!cabalState[symbol][family]) {
        cabalState[symbol][family] = [];
    }

    let buf = cabalState[symbol][family];

    // Keep only last 20 seconds
    const cutoff = ts - CABAL_WINDOW_MS;
    buf = buf.filter(e => e.time >= cutoff);

    // Look for a DIFFERENT subgroup in the SAME 29/30 family
    const match = buf.find(e => e.group !== group);

    if (match) {

        const firstTime = match.time <= ts ? match.time : ts;
        const secondTime = match.time <= ts ? ts : match.time;

        const firstGroup = match.time <= ts ? match.group : group;
        const secondGroup = match.time <= ts ? group : match.group;

        const diffMs = secondTime - firstTime;
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram5(
            `🔵 CABAL\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n` +
            `Condition: 2 different ${family} subgroups within 20s\n\n` +
            `1) ${firstGroup} @ ${formatDateTime(firstTime)}\n` +
            `2) ${secondGroup} @ ${formatDateTime(secondTime)}\n` +
            `Gap: ${diffSec}s`
        );

        // Reset cluster but keep current subgroup as fresh seed
        cabalState[symbol][family] = [
            {
                group,
                time: ts
            }
        ];

        saveState();
        return;
    }

    // Avoid stacking exact same subgroup repeatedly; refresh timestamp instead
    const sameIndex = buf.findIndex(e => e.group === group);

    if (sameIndex !== -1) {
        buf[sameIndex] = {
            group,
            time: ts
        };
    } else {
        buf.push({
            group,
            time: ts
        });
    }

    cabalState[symbol][family] = buf;
    saveState();

    // Safety cleanup
    if (Object.keys(cabalState).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(cabalState)) {
            const families = cabalState[sym];

            for (const fam of Object.keys(families)) {
                families[fam] = families[fam].filter(e => e.time >= pruneCutoff);

                if (!families[fam].length) {
                    delete families[fam];
                }
            }

            if (!Object.keys(families).length) {
                delete cabalState[sym];
            }
        }

        saveState();
    }
}

// ==========================================================
//  BOOM (Single-letter group pair detector)
//  Condition:
//    - Same symbol
//    - Single-letter alphabet groups only: A-Z
//    - Different groups
//    - Within 20 minutes
//    - Max 2 alerts per same symbol+pair within 2 hours
//  Bot 8
// ==========================================================

const BOOM_WINDOW_MS = 20 * 60 * 1000; // 20 minutes
const BOOM_PAIR_LIMIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const BOOM_PAIR_MAX_ALERTS = 2;

// boomMemory[symbol] = [{ group, time }]
const boomMemory = {};

// boomPairState[symbol][pairKey] = [fireTimestamps]
let boomPairState = persisted.boomPairState || {};

function isSingleLetterGroup(group) {
    return /^[A-Z]$/.test(group);
}

function boomPairKey(g1, g2) {
    return [g1, g2].sort().join("+");
}

function canFireBoomPair(symbol, pairKey, ts) {

    if (!boomPairState[symbol]) {
        boomPairState[symbol] = {};
    }

    if (!boomPairState[symbol][pairKey]) {
        boomPairState[symbol][pairKey] = [];
    }

    const cutoff = ts - BOOM_PAIR_LIMIT_WINDOW_MS;

    boomPairState[symbol][pairKey] = boomPairState[symbol][pairKey]
        .filter(t => t >= cutoff);

    return boomPairState[symbol][pairKey].length < BOOM_PAIR_MAX_ALERTS;
}

function recordBoomPairFire(symbol, pairKey, ts) {

    if (!boomPairState[symbol]) {
        boomPairState[symbol] = {};
    }

    if (!boomPairState[symbol][pairKey]) {
        boomPairState[symbol][pairKey] = [];
    }

    boomPairState[symbol][pairKey].push(ts);
    saveState();
}

function processBoom(symbol, group, ts) {

    if (!symbol || !group) return;
    if (!isSingleLetterGroup(group)) return;

    if (!boomMemory[symbol]) {
        boomMemory[symbol] = [];
    }

    let buf = boomMemory[symbol];

    // Keep only last 20 minutes
    const cutoff = ts - BOOM_WINDOW_MS;
    buf = buf.filter(e => e.time >= cutoff);

    // Look for a DIFFERENT single-letter group inside the window
    const match = buf.find(e => e.group !== group);

    if (match) {

        const pairKey = boomPairKey(match.group, group);

        const firstTime = match.time <= ts ? match.time : ts;
        const secondTime = match.time <= ts ? ts : match.time;

        const firstGroup = match.time <= ts ? match.group : group;
        const secondGroup = match.time <= ts ? group : match.group;

        const diffMs = secondTime - firstTime;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        if (canFireBoomPair(symbol, pairKey, ts)) {

            sendToTelegram8(
                `💥 BOOM\n` +
                `Symbol: ${symbol}\n` +
                `Pair: ${pairKey}\n` +
                `Condition: Different single-letter groups within 20m\n` +
                `Pair cap: max 2 alerts per 2h\n\n` +
                `1) ${firstGroup} @ ${formatDateTime(firstTime)}\n` +
                `2) ${secondGroup} @ ${formatDateTime(secondTime)}\n` +
                `Gap: ${diffMin}m ${diffSec}s`
            );

            recordBoomPairFire(symbol, pairKey, ts);
        }

        // Reset cluster but keep current group as fresh seed for future pairs
        boomMemory[symbol] = [
            {
                group,
                time: ts
            }
        ];

        return;
    }

    // Avoid stacking exact same group repeatedly; refresh timestamp instead
    const sameIndex = buf.findIndex(e => e.group === group);

    if (sameIndex !== -1) {
        buf[sameIndex] = { group, time: ts };
    } else {
        buf.push({ group, time: ts });
    }

    boomMemory[symbol] = buf;

    // Safety cleanup
    if (Object.keys(boomMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(boomMemory)) {
            boomMemory[sym] = boomMemory[sym].filter(e => e.time >= pruneCutoff);

            if (!boomMemory[sym].length) {
                delete boomMemory[sym];
            }
        }
    }
}

// ==========================================================
//  KOOKY (PERSISTENT — single-letter combo repeat)
//  Condition:
//    - Same symbol
//    - 2+ single-letter groups within 20 seconds
//    - Example: A + K + G
//    - Stores all subset combos size 2+
//    - Same combo repeats within 2 hours
//  Bot 7
// ==========================================================

// kookyComboState[symbol][comboKey] = { time, groups }
let kookyComboState = persisted.kookyComboState || {};
const kookyComboRuntime = {};

function processKooky(symbol, group, ts) {
    processComboRepeatEngine(
        {
            name: "KOOKY",
            emoji: "🟣",
            description: "Single-letter combo repeat",
            state: kookyComboState,
            runtime: kookyComboRuntime,
            isValidGroup: isComboSingleLetter
        },
        symbol,
        group,
        ts
    );
}

// ==========================================================
//  AUDIT (Raw BTCUSDT + TOTAL logger)
//  Bot 3
// ==========================================================

const AUDIT_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

function processAudit(symbol, group, ts, body) {

    if (!AUDIT_SYMBOLS.has(symbol)) return;

    const price = body.price || "n/a";

    sendToTelegram7(
        `📋 AUDIT\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `Price: ${price}\n` +
        `Time: ${formatDateTime(ts)}`
    );
}


// ==========================================================
//  TESTING (BTCUSDT ↔ TOTAL any double-letter group within 90s)
//  AA → ZZ (does NOT require same group)
//  Bot 3
// ==========================================================

const TESTING_WINDOW_MS = 90 * 1000;

const TESTING_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

// Check if group is double letter like AA, BB, CC...
function isDoubleLetter(group) {
    return /^[A-Z]{2}$/.test(group) && group[0] === group[1];
}

const testingGlobal = []; 
// [{ symbol, group, time }]

function processTesting(symbol, group, ts) {

    if (!TESTING_SYMBOLS.has(symbol)) return;
    if (!isDoubleLetter(group)) return;

    testingGlobal.push({ symbol, group, time: ts });

    const cutoff = ts - TESTING_WINDOW_MS;

    // Remove old entries
    while (testingGlobal.length && testingGlobal[0].time < cutoff) {
        testingGlobal.shift();
    }

    if (testingGlobal.length < 2) return;

    const first = testingGlobal[0];
    const second = testingGlobal[1];

    // Must be different symbols
    if (first.symbol === second.symbol) return;

    const diffMs = second.time - first.time;
    const diffSec = Math.floor(diffMs / 1000);

    sendToTelegram3(
        `🧪 TESTING\n` +
        `1) ${first.symbol} (${first.group}) @ ${new Date(first.time).toLocaleTimeString()}\n` +
        `2) ${second.symbol} (${second.group}) @ ${new Date(second.time).toLocaleTimeString()}\n` +
        `Gap: ${diffSec}s`
    );

    // Slide window
    testingGlobal.shift();
}

// ==========================================================
//  JUPITER (STRICT FIRST-OF-4H + PAIR WITHIN 20M)
//  Bucket 1: C/D
//  Bucket 2: M/N
//  Condition:
//    - First C or D in 4 hours
//    - First M or N in 4 hours
//    - Must occur within 20 minutes of each other
//  One cycle per symbol → resets after fire
//  Bot 4
// ==========================================================

const JUPITER_FIRST_WINDOW_MS = 4 * 60 * 60 * 1000;  // 4 hours
const JUPITER_PAIR_WINDOW_MS  = 20 * 60 * 1000;      // 20 minutes

const JUPITER_CD = new Set(["C", "D"]);
const JUPITER_MN = new Set(["M", "N"]);

// jupiterState[symbol] = {
//   cdTime: timestamp,
//   mnTime: timestamp
// }

const jupiterState = {};

function processJupiter(symbol, group, ts) {

    const isCD = JUPITER_CD.has(group);
    const isMN = JUPITER_MN.has(group);

    if (!isCD && !isMN) return;

    if (!jupiterState[symbol]) {
        jupiterState[symbol] = {
            cdTime: null,
            mnTime: null
        };
    }

    const state = jupiterState[symbol];

    // ========================
    // HANDLE CD SIDE
    // ========================
    if (isCD) {

        // Only accept if FIRST in 4h
        if (!state.cdTime || (ts - state.cdTime > JUPITER_FIRST_WINDOW_MS)) {
            state.cdTime = ts;
        } else {
            return; // ignore non-first
        }
    }

    // ========================
    // HANDLE MN SIDE
    // ========================
    if (isMN) {

        // Only accept if FIRST in 4h
        if (!state.mnTime || (ts - state.mnTime > JUPITER_FIRST_WINDOW_MS)) {
            state.mnTime = ts;
        } else {
            return; // ignore non-first
        }
    }

    // ========================
    // CHECK PAIR
    // ========================
    if (state.cdTime && state.mnTime) {

        const diffMs = Math.abs(state.cdTime - state.mnTime);

        if (diffMs <= JUPITER_PAIR_WINDOW_MS) {

            const firstTime  = Math.min(state.cdTime, state.mnTime);
            const secondTime = Math.max(state.cdTime, state.mnTime);

            const diffMin = Math.floor(diffMs / 60000);
            const diffSec = Math.floor((diffMs % 60000) / 1000);

            sendToTelegram4(
                `🟠 JUPITER\n` +
                `Symbol: ${symbol}\n` +
                `C/D Time: ${formatDateTime(state.cdTime)}\n` +
                `M/N Time: ${formatDateTime(state.mnTime)}\n` +
                `Gap: ${diffMin}m ${diffSec}s\n` +
                `Condition: First-in-4h + Pair ≤20m`
            );


            // 🔥 RESET after firing (one clean cycle)
            delete jupiterState[symbol];
        }
    }

    // ========================
    // SAFETY CLEANUP
    // ========================
    if (Object.keys(jupiterState).length > 5000) {
        const cutoff = ts - (6 * 60 * 60 * 1000);
        for (const sym of Object.keys(jupiterState)) {
            const s = jupiterState[sym];
            const latest = Math.max(s.cdTime || 0, s.mnTime || 0);
            if (latest < cutoff) delete jupiterState[sym];
        }
    }
}


// ==========================================================
//  TRINITY / TRINITY_FLIP Fusion Detector
//  Combines signals from ANY_TWO, MAMBA, MINTA, SIDE_FLIP
//  Window: 5 minutes
//  Bot 6
// ==========================================================

const TRINITY_WINDOW_MS = 5 * 60 * 1000;

const trinityState = {};

// trinityState[symbol] = { anyTwo, mamba, minta, sideFlip, timer }

function registerTrinity(symbol, type) {

    if (!symbol) return;

    if (!trinityState[symbol]) {

        trinityState[symbol] = {
            anyTwo: false,
            mamba: false,
            minta: false,
            sideFlip: false,
            timer: null
        };

        trinityState[symbol].timer = setTimeout(() => {

            const s = trinityState[symbol];

            if (s.anyTwo && s.mamba && s.minta) {

                if (s.sideFlip) {

                    sendToTelegram6(
                        `⚡ TRINITY_FLIP+\n` +
                        `Symbol: ${symbol}\n` +
                        `Signals: ANY_TWO + MAMBA + MINTA + SIDE_FLIP\n` +
                        `Window: 5m`
                    );

                } else {

                    sendToTelegram6(
                        `⚡ TRINITY\n` +
                        `Symbol: ${symbol}\n` +
                        `Signals: ANY_TWO + MAMBA + MINTA\n` +
                        `Window: 5m`
                    );

                }
            }

            delete trinityState[symbol];

        }, TRINITY_WINDOW_MS);
    }

    if (type === "ANY_TWO") trinityState[symbol].anyTwo = true;
    if (type === "MAMBA") trinityState[symbol].mamba = true;
    if (type === "MINTA") trinityState[symbol].minta = true;
    if (type === "SIDE_FLIP") trinityState[symbol].sideFlip = true;
}

// ==========================================================
//  YABA (Family cross detector — DIFFERENT subgroups)
//  Condition:
//    - Same symbol
//    - SAME family (e.g. 16A, 16B → family 16)
//    - DIFFERENT subgroup
//    - Within 90 seconds
//  Bot 9
// ==========================================================

const YABA_WINDOW_MS = 90 * 1000; // 90 seconds

// yabaMemory[symbol][family] = { group, time }
const yabaMemory = {};

function processYaba(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getFamily(group);
    if (!family) return;

    if (!yabaMemory[symbol]) {
        yabaMemory[symbol] = {};
    }

    const last = yabaMemory[symbol][family];

    // ======================================================
    // 🔥 FIRE: same family, DIFFERENT subgroup within 90s
    // ======================================================
    if (last && last.group !== group && (ts - last.time <= YABA_WINDOW_MS)) {

        const diffMs = ts - last.time;
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram9(
            `🟢 YABA\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n\n` +
            `1) ${last.group} @ ${formatDateTime(last.time)}\n` +
            `2) ${group} @ ${formatDateTime(ts)}\n` +
            `Gap: ${diffSec}s\n` +
            `Window: 90s`
        );


        
        activateBazooka(symbol, "YABA", ts, `${last.group} → ${group}`);
// 🔥 Reset after fire (one clean cycle)

        delete yabaMemory[symbol][family];
        return;
    }

    // ======================================================
    // Always update latest hit
    // ======================================================
    yabaMemory[symbol][family] = {
        group,
        time: ts
    };

    // ======================================================
    // Safety cleanup
    // ======================================================
    if (Object.keys(yabaMemory).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(yabaMemory)) {
            const families = yabaMemory[sym];

            for (const f of Object.keys(families)) {
                if (families[f].time < cutoff) {
                    delete families[f];
                }
            }

            if (!Object.keys(families).length) {
                delete yabaMemory[sym];
            }
        }
    }
}


// ==========================================================
//  BUNDLE (ACSWU / BDXTV burst collector)
//  Window: 2 minutes (delayed delivery)
//  Min Count: 4
//  Bot 2
// ==========================================================

const BUNDLE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const BUNDLE_MIN_COUNT = 4;

const BUNDLE_GROUPS = new Set(["A","C","S","W","U","B","D","X","T","V"]);

const bundleState = {
    active: false,
    startTime: null,
    entries: [],   // [{ symbol, group, time }]
    timer: null
};

function processBundle(symbol, group, ts) {

    if (!BUNDLE_GROUPS.has(group)) return;

    // Start window on first hit
    if (!bundleState.active) {

        bundleState.active = true;
        bundleState.startTime = ts;
        bundleState.entries = [];

        bundleState.timer = setTimeout(() => {

            const cutoff = bundleState.startTime + BUNDLE_WINDOW_MS;

            const valid = bundleState.entries
                .filter(e => e.time <= cutoff);

            if (valid.length >= BUNDLE_MIN_COUNT) {

                const lines = valid
                    .sort((a, b) => a.time - b.time)
                    .map(e =>
                        `• ${e.symbol} (${e.group}) @ ${formatTime(e.time)}`
                    )
                    .join("\n");

                sendToTelegram2(
                    `📦 BUNDLE\n` +
                    `Total: ${valid.length}\n` +
                    `Window: 2m\n` +
                    `Start: ${new Date(bundleState.startTime).toLocaleTimeString()}\n` +
                    `Entries:\n${lines}`
                );
            }

            // Reset state
            bundleState.active = false;
            bundleState.startTime = null;
            bundleState.entries = [];
            clearTimeout(bundleState.timer);
            bundleState.timer = null;

        }, BUNDLE_WINDOW_MS);
    }

    // Always collect during active window
    bundleState.entries.push({ symbol, group, time: ts });
}

// ==========================================================
//  MINTA (Same symbol multi-group batch detector)
//  Condition: 6+ alerts of ANY group
//  Window: 5 minutes
//  Batch delay: 5 minutes
//  Bot 9
// ==========================================================

const MINTA_WINDOW_MS = 5 * 60 * 1000;
const MINTA_MIN_COUNT = 6;

const mintaState = {};

// mintaState[symbol] = { events: [], timer }

function processMinta(symbol, group, ts) {

    if (!mintaState[symbol]) {

        mintaState[symbol] = {
            events: [],
            timer: null
        };

        mintaState[symbol].timer = setTimeout(() => {

            const state = mintaState[symbol];
            const events = state.events;

            if (events.length >= MINTA_MIN_COUNT) {

                const lines = events
                    .sort((a,b)=>a.time-b.time)
                    .map(e =>
                        `• ${e.group} @ ${formatTime(e.time)}`
                    )
                    .join("\n");

                sendToTelegram9(
                    `🍃 MINTA\n` +
                    `Symbol: ${symbol}\n` +
                    `Count: ${events.length}\n` +
                    `Window: 5m\n` +
                    `Alerts:\n${lines}`
                );
				registerTrinity(symbol, "MINTA");
            }

            delete mintaState[symbol];

        }, MINTA_WINDOW_MS);
    }

    mintaState[symbol].events.push({
        group,
        time: ts
    });
}

// ==========================================================
//  COMBO REPEAT ENGINE (shared by KOOKY / SPESH / COBRA)
//  Logic:
//    - Same symbol
//    - 2+ qualifying groups within 20 seconds = combo cluster
//    - Stores ALL subset combos of size 2+
//    - Order does not matter: A+K = K+A
//    - If the same combo appears again within 2 hours, alert
// ==========================================================

const COMBO_BUILD_WINDOW_MS  = 20 * 1000;             // 20 seconds
const COMBO_REPEAT_WINDOW_MS = 2 * 60 * 60 * 1000;    // 2 hours

function isComboSingleLetter(group) {
    return /^[A-Z]$/.test(group);
}

function isComboNumberLetter(group) {
    return /^\d+[A-Z]$/.test(group);
}

function comboKeyFromGroups(groups) {
    return [...new Set(groups)].sort().join("+");
}

function comboFormatGroups(groups) {
    return [...new Set(groups)].sort().join(" + ");
}

function comboGroupSubsets(groups) {
    const unique = [...new Set(groups)].sort();
    const result = [];

    function walk(start, picked) {
        if (picked.length >= 2) {
            result.push([...picked]);
        }

        for (let i = start; i < unique.length; i++) {
            picked.push(unique[i]);
            walk(i + 1, picked);
            picked.pop();
        }
    }

    walk(0, []);
    return result;
}

function pruneComboState(state, ts) {
    const cutoff = ts - COMBO_REPEAT_WINDOW_MS;

    for (const sym of Object.keys(state)) {
        for (const key of Object.keys(state[sym])) {
            if (!state[sym][key] || state[sym][key].time < cutoff) {
                delete state[sym][key];
            }
        }

        if (!Object.keys(state[sym]).length) {
            delete state[sym];
        }
    }
}

function processComboRepeatEngine(cfg, symbol, group, ts) {

    if (!symbol || !group) return;
    if (!cfg.isValidGroup(group)) return;

    if (!cfg.runtime[symbol]) {
        cfg.runtime[symbol] = {
            events: [],
            firedCombos: {}
        };
    }

    const rt = cfg.runtime[symbol];

    const cutoff = ts - COMBO_BUILD_WINDOW_MS;
    rt.events = rt.events.filter(e => e.time >= cutoff);

    // If old cluster expired fully, reset fired combo memory for this live cluster.
    if (!rt.events.length) {
        rt.firedCombos = {};
    }

    // Keep one live event per group in the 20s cluster; refresh repeated group timestamp.
    const existingIndex = rt.events.findIndex(e => e.group === group);

    if (existingIndex !== -1) {
        rt.events[existingIndex] = {
            group,
            time: ts
        };
    } else {
        rt.events.push({
            group,
            time: ts
        });
    }

    rt.events.sort((a, b) => a.time - b.time);

    const liveGroups = rt.events.map(e => e.group);
    const liveSubsets = comboGroupSubsets(liveGroups);

    if (!cfg.state[symbol]) {
        cfg.state[symbol] = {};
    }

    const repeated = [];

    for (const subset of liveSubsets) {
        const key = comboKeyFromGroups(subset);
        const previous = cfg.state[symbol][key];

        if (!previous) continue;

        const gapMs = ts - previous.time;

        const isNotSameLiveCluster = gapMs > COMBO_BUILD_WINDOW_MS;
        const isWithinRepeatWindow = gapMs <= COMBO_REPEAT_WINDOW_MS;
        const notAlreadyFiredInCluster = !rt.firedCombos[key];

        if (isNotSameLiveCluster && isWithinRepeatWindow && notAlreadyFiredInCluster) {
            repeated.push({
                key,
                groups: subset,
                previousTime: previous.time,
                gapMs
            });

            rt.firedCombos[key] = true;
        }
    }

    if (repeated.length) {

        const lines = repeated
            .sort((a, b) => a.groups.length - b.groups.length || a.key.localeCompare(b.key))
            .map((x, i) => {
                const gapMin = Math.floor(x.gapMs / 60000);
                const gapSec = Math.floor((x.gapMs % 60000) / 1000);

                return (
                    `${i + 1}) ${x.groups.length}-group combo: ${comboFormatGroups(x.groups)}\n` +
                    `   Previous: ${formatDateTime(x.previousTime)}\n` +
                    `   Current: ${formatDateTime(ts)}\n` +
                    `   Gap: ${gapMin}m ${gapSec}s`
                );
            })
            .join("\n\n");

        sendToTelegram7(
            `${cfg.emoji} ${cfg.name}\n` +
            `Symbol: ${symbol}\n` +
            `Type: ${cfg.description}\n` +
            `Live Cluster: ${comboFormatGroups(liveGroups)}\n` +
            `Matched Combos: ${repeated.length}\n` +
            `Window: repeat within 2h after 20s cluster\n\n` +
            lines
        );
    }

    // Store/refresh ALL subset combos from this live cluster.
    for (const subset of liveSubsets) {
        const key = comboKeyFromGroups(subset);

        cfg.state[symbol][key] = {
            time: ts,
            groups: [...subset].sort()
        };
    }

    pruneComboState(cfg.state, ts);
    saveState();
}

// ==========================================================
//  COBRA (PERSISTENT — any valid combo repeat)
//  Condition:
//    - Same symbol
//    - 2+ groups within 20 seconds
//    - Groups allowed: single letters OR number+letter subgroups
//    - Stores all subset combos size 2+
//    - Same combo repeats within 2 hours
//  Bot 7
// ==========================================================

// cobraComboState[symbol][comboKey] = { time, groups }
let cobraComboState = persisted.cobraComboState || {};
const cobraComboRuntime = {};

function processCobra(symbol, group, ts) {
    processComboRepeatEngine(
        {
            name: "COBRA",
            emoji: "🐍",
            description: "Single-letter + number-letter combo repeat",
            state: cobraComboState,
            runtime: cobraComboRuntime,
            isValidGroup: g => isComboSingleLetter(g) || isComboNumberLetter(g)
        },
        symbol,
        group,
        ts
    );
}

// ==========================================================
// FIRST (PER SYMBOL — 4H COOLDOWN, GLOBAL ENGINE)
// Bot 2
// ==========================================================

const FIRST_WINDOW_MS = 4 * 60 * 60 * 1000;

function processFirst(symbol, group, ts) {

    if (!symbol) return;

    const key = "ALL"; // 🔑 ONE KEY PER SYMBOL
    const last = getLastSeen(symbol, key);

    // 🔥 FIRST or after 4h
    if (!last || (ts - last >= FIRST_WINDOW_MS)) {

        sendToTelegram2(
            `🥇 FIRST\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n` +
            `Last: ${last ? formatDateTime(last) : "none"}\n` +
            `Now: ${formatDateTime(ts)}`
        );

        setLastSeen(symbol, key, ts);
        activateGodzilla(symbol, "FIRST", ts, group);


    
        processPremier(symbol, group, ts);
}

    // else → ignore
}


// ==========================================================
//  ZONEFORGE V2 (Intraday support/resistance pressure zones)
//  Bot 8
//
//  Upgrade:
//    - Still uses divergence direction:
//        positive_regular_divergence  → SUPPORT pressure
//        negative_regular_divergence  → RESISTANCE pressure
//    - Does NOT require an engine/name field in JSON.
//    - Infers engine class from group structure:
//        single-letter anchors, numbered families, double-letter groups.
//    - This allows CORE / PRIME to fire from the actual group mix.
// ==========================================================

const ZONEFORGE_MAX_WINDOW_MS = 15 * 60 * 1000;

const ZONEFORGE_TIERS = [
    {
        name: "FAST",
        emoji: "⚡",
        windowMs: 5 * 60 * 1000,
        minAlerts: 3,
        minGroups: 2,
        minFamilies: 1,
        minEngines: 1,
        cooldownMs: 25 * 60 * 1000
    },
    {
        name: "CORE",
        emoji: "🔥",
        windowMs: 10 * 60 * 1000,
        minAlerts: 4,
        minGroups: 3,
        minFamilies: 2,
        minEngines: 2,
        cooldownMs: 40 * 60 * 1000
    },
    {
        name: "PRIME",
        emoji: "🚨",
        windowMs: 15 * 60 * 1000,
        minAlerts: 6,
        minGroups: 4,
        minFamilies: 3,
        minEngines: 2,
        cooldownMs: 55 * 60 * 1000
    }
];

const ZONEFORGE_TIER_RANK = {
    FAST: 1,
    CORE: 2,
    PRIME: 3
};

// Single-letter groups are treated as inferred engine anchors.
// This avoids needing "engine" in the TradingView JSON.
const ZONEFORGE_SINGLE_ENGINE_MAP = {
    A: "AB_ANCHOR",
    B: "AB_ANCHOR",

    C: "CD_62TF",
    D: "CD_62TF",

    G: "GH_52TF",
    H: "GH_52TF",

    K: "KL_76TF",
    L: "KL_76TF",

    M: "MN_TF58",
    N: "MN_TF58",

    O: "OP_82TF",
    P: "OP_82TF",

    Q: "QR_69TF",
    R: "QR_69TF",

    S: "ST_ANCHOR",
    T: "ST_ANCHOR",

    U: "UV_ANCHOR",
    V: "UV_ANCHOR",

    W: "WX_ZAGALO",
    X: "WX_ZAGALO",

    Y: "YZ_ANCHOR",
    Z: "YZ_ANCHOR"
};

// zoneforgeMemory[symbol][bias] = [{ group, family, engine, groupClass, time }]
const zoneforgeMemory = {};

// zoneforgeLastFire[symbol][bias] = { tier, time }
const zoneforgeLastFire = {};

function cleanLabel(value, fallback) {
    const s = String(value || "").trim();
    return s || fallback;
}

function getZoneforgeBias(body) {
    const fields = [
        body.kind,
        body.signal,
        body.type,
        body.action,
        body.direction,
        body.name,
        body.source,
        body.message
    ]
        .filter(Boolean)
        .map(x => String(x).toLowerCase())
        .join(" ");

    if (
        fields.includes("positive_regular_divergence") ||
        fields.includes("positive regular divergence") ||
        fields.includes("positive_divergence")
    ) {
        return "SUPPORT";
    }

    if (
        fields.includes("negative_regular_divergence") ||
        fields.includes("negative regular divergence") ||
        fields.includes("negative_divergence")
    ) {
        return "RESISTANCE";
    }

    return null;
}

function zoneforgeGroupClass(group) {
    const g = String(group || "").trim().toUpperCase();

    if (/^[A-Z]$/.test(g)) return "SINGLE";
    if (/^\d+[A-Z]+$/.test(g)) return "NUMBERED";
    if (/^[A-Z]{2}$/.test(g)) return "DOUBLE";
    if (/^[A-Z]{3,}$/.test(g)) return "MULTI_LETTER";

    return "OTHER";
}

function inferZoneforgeFamily(group) {
    const g = String(group || "").trim().toUpperCase();

    const numeric = g.match(/^(\d+)/);
    if (numeric) return numeric[1];

    if (/^[A-Z]$/.test(g)) return g;
    if (/^[A-Z]{2,}$/.test(g)) return g;

    return getFamily(g) || "OTHER";
}

function inferZoneforgeEngineClass(group, body) {
    const g = String(group || "").trim().toUpperCase();

    if (/^[A-Z]$/.test(g)) {
        return ZONEFORGE_SINGLE_ENGINE_MAP[g] || `SINGLE_${g}`;
    }

    if (/^\d+[A-Z]+$/.test(g)) {
        return `NUM_${getFamily(g)}`;
    }

    if (/^[A-Z]{2}$/.test(g)) {
        return `DOUBLE_${g}`;
    }

    if (/^[A-Z]{3,}$/.test(g)) {
        return `MULTI_${g}`;
    }

    return cleanLabel(
        body.source ||
        body.engine ||
        body.name ||
        body.alert_name ||
        body.indicator ||
        body.script ||
        body.bot,
        "RAW"
    );
}

function zoneforgeReadLine(bias, tierName) {
    if (bias === "SUPPORT") {
        if (tierName === "FAST") return "EARLY SUPPORT PRESSURE";
        if (tierName === "CORE") return "SUPPORT ZONE FORMING";
        return "STRONG SUPPORT ZONE";
    }

    if (tierName === "FAST") return "EARLY RESISTANCE PRESSURE";
    if (tierName === "CORE") return "RESISTANCE ZONE FORMING";
    return "STRONG RESISTANCE ZONE";
}

function zoneforgeNextWatch(bias) {
    if (bias === "SUPPORT") {
        return "Retest / deviation below zone + fresh support pressure";
    }
    return "Retest / deviation above zone + fresh resistance pressure";
}

function processZoneforge(symbol, group, ts, body) {
    if (!symbol || !group || !body) return;
    if (group.startsWith("#")) return;

    const bias = getZoneforgeBias(body);
    if (!bias) return;

    const family = inferZoneforgeFamily(group);
    const engine = inferZoneforgeEngineClass(group, body);
    const groupClass = zoneforgeGroupClass(group);

    if (!zoneforgeMemory[symbol]) {
        zoneforgeMemory[symbol] = {};
    }

    if (!zoneforgeMemory[symbol][bias]) {
        zoneforgeMemory[symbol][bias] = [];
    }

    const buf = zoneforgeMemory[symbol][bias];

    buf.push({
        group,
        family,
        engine,
        groupClass,
        time: ts
    });

    // Keep only the maximum lookback needed by PRIME.
    const cutoff = ts - ZONEFORGE_MAX_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    let bestTier = null;
    let bestEvents = [];

    for (const tier of ZONEFORGE_TIERS) {
        const tierCutoff = ts - tier.windowMs;
        const recent = buf.filter(e => e.time >= tierCutoff);

        const groups = new Set(recent.map(e => e.group).filter(Boolean));
        const families = new Set(recent.map(e => e.family).filter(Boolean));
        const engines = new Set(recent.map(e => e.engine).filter(Boolean));

        const passed =
            recent.length >= tier.minAlerts &&
            groups.size >= tier.minGroups &&
            families.size >= tier.minFamilies &&
            engines.size >= tier.minEngines;

        if (passed) {
            bestTier = tier;
            bestEvents = recent;
        }
    }

    if (!bestTier) return;

    if (!zoneforgeLastFire[symbol]) {
        zoneforgeLastFire[symbol] = {};
    }

    const lastFire = zoneforgeLastFire[symbol][bias];
    const previousRank = lastFire ? ZONEFORGE_TIER_RANK[lastFire.tier] : 0;
    const newRank = ZONEFORGE_TIER_RANK[bestTier.name];

    const isUpgrade = lastFire && newRank > previousRank;
    const cooldownExpired = !lastFire || (ts - lastFire.time >= bestTier.cooldownMs);

    // Fire when this is a fresh zone or an upgrade FAST → CORE → PRIME.
    if (!isUpgrade && !cooldownExpired) return;

    const groups = [...new Set(bestEvents.map(e => e.group).filter(Boolean))];
    const families = [...new Set(bestEvents.map(e => e.family).filter(Boolean))];
    const engines = [...new Set(bestEvents.map(e => e.engine).filter(Boolean))];
    const singleAnchors = [...new Set(
        bestEvents
            .filter(e => e.groupClass === "SINGLE")
            .map(e => e.group)
            .filter(Boolean)
    )];

    const firstTime = bestEvents[0].time;
    const lastTime = bestEvents[bestEvents.length - 1].time;
    const spanMs = lastTime - firstTime;
    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    const groupLines = groups.slice(0, 18).join(", ") + (groups.length > 18 ? " ..." : "");
    const engineLines = engines.slice(0, 10).join(", ") + (engines.length > 10 ? " ..." : "");
    const anchorLines = singleAnchors.length ? singleAnchors.join(", ") : "none";

    const upgradeLine = isUpgrade ? `UPGRADE: ${lastFire.tier} → ${bestTier.name}\n` : "";

    sendToTelegram8(
        `${bestTier.emoji} ZONEFORGE ${bestTier.name} ${bias}\n` +
        upgradeLine +
        `Symbol: ${symbol}\n` +
        `Bias: ${bias}\n` +
        `Read: ${zoneforgeReadLine(bias, bestTier.name)}\n\n` +

        `Window: ${Math.floor(bestTier.windowMs / 60000)}m\n` +
        `Span: ${spanMin}m ${spanSec}s\n` +
        `Alerts: ${bestEvents.length}\n` +
        `Groups: ${groups.length} (${groupLines})\n` +
        `Families/classes: ${families.length} (${families.join(", ")})\n` +
        `Engine classes: ${engines.length} (${engineLines})\n` +
        `Single anchors: ${singleAnchors.length} (${anchorLines})\n\n` +

        `First: ${formatDateTime(firstTime)}\n` +
        `Latest: ${formatDateTime(lastTime)}\n` +
        `Next watch: ${zoneforgeNextWatch(bias)}`
    );

    zoneforgeLastFire[symbol][bias] = {
        tier: bestTier.name,
        time: ts
    };

    // Memory guard
    if (Object.keys(zoneforgeMemory).length > 5000) {
        const pruneCutoff = ts - (60 * 60 * 1000);

        for (const sym of Object.keys(zoneforgeMemory)) {
            for (const b of Object.keys(zoneforgeMemory[sym])) {
                zoneforgeMemory[sym][b] = zoneforgeMemory[sym][b]
                    .filter(e => e.time >= pruneCutoff);

                if (!zoneforgeMemory[sym][b].length) {
                    delete zoneforgeMemory[sym][b];
                }
            }

            if (!Object.keys(zoneforgeMemory[sym]).length) {
                delete zoneforgeMemory[sym];
            }
        }
    }
}


// ==========================================================
//  ANCHORFORGE (Single-letter anchor support/resistance zones)
//  Bot 3
//
//  Clean version: Peter_o is NOT included in ANCHORFORGE.
//  Concept:
//    - Single-letter groups are treated as anchor engines.
//    - Numbered groups and double-letter groups add pressure/context.
//    - Same symbol + same bias + anchor involvement = intraday zone.
//    - Ignores all # groups.
// ==========================================================

const ANCHORFORGE_ENABLED = (process.env.ANCHORFORGE_ENABLED || "true").toLowerCase() !== "false";
const ANCHORFORGE_MAX_WINDOW_MS = 15 * 60 * 1000;

const ANCHORFORGE_TIERS = [
    {
        name: "SPARK",
        emoji: "✨",
        windowMs: 4 * 60 * 1000,
        minAlerts: 3,
        minGroups: 2,
        minFamilies: 1,
        minAnchors: 1,
        cooldownMs: 20 * 60 * 1000
    },
    {
        name: "ANCHOR",
        emoji: "⚓",
        windowMs: 8 * 60 * 1000,
        minAlerts: 4,
        minGroups: 3,
        minFamilies: 2,
        minAnchors: 1,
        cooldownMs: 35 * 60 * 1000
    },
    {
        name: "FORGE",
        emoji: "🛠️",
        windowMs: 12 * 60 * 1000,
        minAlerts: 5,
        minGroups: 3,
        minFamilies: 2,
        minAnchors: 2,
        cooldownMs: 50 * 60 * 1000
    },
    {
        name: "CITADEL",
        emoji: "🛡️",
        windowMs: 15 * 60 * 1000,
        minAlerts: 7,
        minGroups: 4,
        minFamilies: 3,
        minAnchors: 2,
        cooldownMs: 75 * 60 * 1000
    }
];

const ANCHORFORGE_TIER_RANK = {
    SPARK: 1,
    ANCHOR: 2,
    FORGE: 3,
    CITADEL: 4
};

// anchorforgeMemory[symbol][bias] = [{ group, family, className, time }]
const anchorforgeMemory = {};

// anchorforgeLastFire[symbol][bias] = { tier, time }
const anchorforgeLastFire = {};

function isDoubleLetterGroup(group) {
    return /^[A-Z]{2}$/.test(group || "");
}

function isNumberedGroup(group) {
    return /^\d+[A-Z]+$/.test(group || "");
}

function getAnchorforgeClass(group) {
    if (isSingleLetterGroup(group)) return "SINGLE_ANCHOR";
    if (isNumberedGroup(group)) return "NUMBERED_PRESSURE";
    if (isDoubleLetterGroup(group)) return "DOUBLE_LETTER";
    return "OTHER";
}

function anchorforgeReadLine(bias, tierName) {
    if (bias === "SUPPORT") {
        if (tierName === "SPARK") return "EARLY SUPPORT ANCHOR";
        if (tierName === "ANCHOR") return "SUPPORT ZONE ANCHORING";
        if (tierName === "FORGE") return "SUPPORT ZONE BEING FORGED";
        return "STRONG SUPPORT CITADEL";
    }

    if (tierName === "SPARK") return "EARLY RESISTANCE ANCHOR";
    if (tierName === "ANCHOR") return "RESISTANCE ZONE ANCHORING";
    if (tierName === "FORGE") return "RESISTANCE ZONE BEING FORGED";
    return "STRONG RESISTANCE CITADEL";
}

function anchorforgeNextWatch(bias) {
    if (bias === "SUPPORT") {
        return "Retest / deviation below zone + fresh single-letter support anchor";
    }
    return "Retest / deviation above zone + fresh single-letter resistance anchor";
}

function processAnchorforge(symbol, group, ts, body) {
    if (!ANCHORFORGE_ENABLED) return;
    if (!symbol || !group || !body) return;
    if (group.startsWith("#")) return;

    // Peter_o is deliberately kept OUT of ANCHORFORGE.
    if (isPeterForgePayload(body, group)) return;

    const bias = getZoneforgeBias(body);
    if (!bias) return;

    const className = getAnchorforgeClass(group);

    // ANCHORFORGE is built around single-letter anchors.
    // Non-anchor groups can contribute only after an anchor exists in the same symbol+bias buffer.
    const isAnchor = className === "SINGLE_ANCHOR";
    const family = isNumberedGroup(group) ? getFamily(group) : group;

    if (!anchorforgeMemory[symbol]) {
        anchorforgeMemory[symbol] = {};
    }

    if (!anchorforgeMemory[symbol][bias]) {
        anchorforgeMemory[symbol][bias] = [];
    }

    const buf = anchorforgeMemory[symbol][bias];

    buf.push({
        group,
        family,
        className,
        isAnchor,
        time: ts
    });

    const cutoff = ts - ANCHORFORGE_MAX_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    let bestTier = null;
    let bestEvents = [];

    for (const tier of ANCHORFORGE_TIERS) {
        const tierCutoff = ts - tier.windowMs;
        const recent = buf.filter(e => e.time >= tierCutoff);

        const groups = new Set(recent.map(e => e.group).filter(Boolean));
        const families = new Set(recent.map(e => e.family).filter(Boolean));
        const anchorGroups = new Set(
            recent
                .filter(e => e.isAnchor)
                .map(e => e.group)
                .filter(Boolean)
        );

        const passed =
            recent.length >= tier.minAlerts &&
            groups.size >= tier.minGroups &&
            families.size >= tier.minFamilies &&
            anchorGroups.size >= tier.minAnchors;

        if (passed) {
            bestTier = tier;
            bestEvents = recent;
        }
    }

    if (!bestTier) return;

    if (!anchorforgeLastFire[symbol]) {
        anchorforgeLastFire[symbol] = {};
    }

    const lastFire = anchorforgeLastFire[symbol][bias];
    const previousRank = lastFire ? ANCHORFORGE_TIER_RANK[lastFire.tier] : 0;
    const newRank = ANCHORFORGE_TIER_RANK[bestTier.name];

    const isUpgrade = lastFire && newRank > previousRank;
    const cooldownExpired = !lastFire || (ts - lastFire.time >= bestTier.cooldownMs);

    if (!isUpgrade && !cooldownExpired) return;

    const groups = [...new Set(bestEvents.map(e => e.group).filter(Boolean))];
    const families = [...new Set(bestEvents.map(e => e.family).filter(Boolean))];
    const anchorGroups = [...new Set(
        bestEvents
            .filter(e => e.isAnchor)
            .map(e => e.group)
            .filter(Boolean)
    )];
    const numberedFamilies = [...new Set(
        bestEvents
            .filter(e => e.className === "NUMBERED_PRESSURE")
            .map(e => e.family)
            .filter(Boolean)
    )];
    const doubleGroups = [...new Set(
        bestEvents
            .filter(e => e.className === "DOUBLE_LETTER")
            .map(e => e.group)
            .filter(Boolean)
    )];

    const firstTime = bestEvents[0].time;
    const lastTime = bestEvents[bestEvents.length - 1].time;
    const spanMs = lastTime - firstTime;
    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    const groupLines = groups.slice(0, 20).join(", ") + (groups.length > 20 ? " ..." : "");
    const anchorLines = anchorGroups.slice(0, 14).join(", ") || "none";
    const numberedLines = numberedFamilies.slice(0, 14).join(", ") || "none";
    const doubleLines = doubleGroups.slice(0, 14).join(", ") || "none";
    const upgradeLine = isUpgrade ? `UPGRADE: ${lastFire.tier} → ${bestTier.name}\n` : "";

    sendToTelegram3(
        `${bestTier.emoji} ANCHORFORGE ${bestTier.name} ${bias}\n` +
        upgradeLine +
        `Symbol: ${symbol}\n` +
        `Bias: ${bias}\n` +
        `Read: ${anchorforgeReadLine(bias, bestTier.name)}\n\n` +

        `Window: ${Math.floor(bestTier.windowMs / 60000)}m\n` +
        `Span: ${spanMin}m ${spanSec}s\n` +
        `Alerts: ${bestEvents.length}\n` +
        `Groups: ${groups.length} (${groupLines})\n` +
        `Single-letter anchors: ${anchorGroups.length} (${anchorLines})\n` +
        `Numbered families: ${numberedFamilies.length} (${numberedLines})\n` +
        `Double-letter groups: ${doubleGroups.length} (${doubleLines})\n` +
        `Families/classes: ${families.length} (${families.join(", ")})\n\n` +

        `First: ${formatDateTime(firstTime)}\n` +
        `Latest: ${formatDateTime(lastTime)}\n` +
        `Next watch: ${anchorforgeNextWatch(bias)}`
    );

    anchorforgeLastFire[symbol][bias] = {
        tier: bestTier.name,
        time: ts
    };

    if (Object.keys(anchorforgeMemory).length > 5000) {
        const pruneCutoff = ts - (60 * 60 * 1000);

        for (const sym of Object.keys(anchorforgeMemory)) {
            for (const b of Object.keys(anchorforgeMemory[sym])) {
                anchorforgeMemory[sym][b] = anchorforgeMemory[sym][b]
                    .filter(e => e.time >= pruneCutoff);

                if (!anchorforgeMemory[sym][b].length) {
                    delete anchorforgeMemory[sym][b];
                }
            }

            if (!Object.keys(anchorforgeMemory[sym]).length) {
                delete anchorforgeMemory[sym];
            }
        }
    }
}


// ==========================================================
//  PETERFORGE (Peter_o isolated price-anchor engine)
//  Bot 3
//
//  Important:
//    - This does NOT feed into ANCHORFORGE.
//    - It stays silent unless Peter_o-style JSON appears.
//    - Peter_o direction is treated as a price-zone marker,
//      not as automatic support/resistance.
// ==========================================================

const PETERFORGE_ENABLED = (process.env.PETERFORGE_ENABLED || "true").toLowerCase() !== "false";
const PETERFORGE_WINDOW_MS = 30 * 60 * 1000;
const PETERFORGE_COOLDOWN_MS = 10 * 60 * 1000;

// peterforgeMemory[symbol] = [{ direction, combo, price, time }]
const peterforgeMemory = {};
const peterforgeLastFire = {};

function textFromBody(body) {
    return [
        body.kind,
        body.signal,
        body.type,
        body.action,
        body.direction,
        body.name,
        body.source,
        body.message,
        body.alert_name,
        body.indicator,
        body.script,
        body.bot
    ]
        .filter(Boolean)
        .map(x => String(x))
        .join(" ");
}

function isPeterForgePayload(body, group) {
    if (!body) return false;

    const text = textFromBody(body).toUpperCase();

    if (text.includes("PETER")) return true;

    // Fallback for Peter_o JSON that may not carry the word PETER,
    // but carries the distinctive MTF divergence fields.
    const hasCombo = Boolean(body.matched_tfs || body.timeframes || body.tfs || body.tf_combo);
    const hasPrice = body.price !== undefined && body.price !== null && String(body.price).trim() !== "";
    const dir = String(body.direction || body.dir || "").toUpperCase();
    const hasDirection = dir === "POSITIVE" || dir === "NEGATIVE" || dir === "BUY" || dir === "SELL";

    return hasCombo && hasPrice && hasDirection && !group;
}

function getPeterDirection(body) {
    const text = textFromBody(body).toUpperCase();
    const dir = String(body.direction || body.dir || "").toUpperCase();

    if (dir.includes("POS") || text.includes("POSITIVE")) return "POSITIVE";
    if (dir.includes("NEG") || text.includes("NEGATIVE")) return "NEGATIVE";

    return "UNKNOWN";
}

function getPeterCombo(body) {
    return cleanLabel(
        body.matched_tfs ||
        body.timeframes ||
        body.tfs ||
        body.tf_combo ||
        body.combo,
        "n/a"
    );
}

function getPeterPrice(body) {
    const raw = body.price || body.close || body.level;
    if (raw === undefined || raw === null || String(raw).trim() === "") return null;

    const n = Number(String(raw).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
}

function formatPct(n) {
    if (!Number.isFinite(n)) return "n/a";
    return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function processPeterforge(symbol, group, ts, body) {
    if (!PETERFORGE_ENABLED) return;
    if (!symbol || !body) return;
    if (!isPeterForgePayload(body, group)) return;

    const direction = getPeterDirection(body);
    const combo = getPeterCombo(body);
    const price = getPeterPrice(body);

    if (!peterforgeMemory[symbol]) {
        peterforgeMemory[symbol] = [];
    }

    const buf = peterforgeMemory[symbol];
    const cutoff = ts - PETERFORGE_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    const previous = buf.length ? buf[buf.length - 1] : null;

    buf.push({ direction, combo, price, time: ts });

    const lastKey = `${symbol}-${direction}-${combo}`;
    const lastSent = peterforgeLastFire[lastKey] || 0;
    if (ts - lastSent < PETERFORGE_COOLDOWN_MS) return;

    let title = "📍 PETERFORGE ANCHOR";
    let read = "PRICE-ZONE MARKER ONLY — not automatic support/resistance";
    let previousBlock = "Previous Peter_o: none";

    if (previous) {
        const sameDirection = previous.direction === direction;
        title = sameDirection ? "📌 PETERFORGE STACK" : "⚠️ PETERFORGE FLIP";
        read = sameDirection
            ? "Same-direction Peter_o stack — price zone has repeated"
            : "Opposite-direction Peter_o flip — possible failed zone / trap / deviation";

        const gapMs = ts - previous.time;
        const gapMin = Math.floor(gapMs / 60000);
        const gapSec = Math.floor((gapMs % 60000) / 1000);

        let priceMove = "n/a";
        if (price !== null && previous.price !== null && previous.price !== 0) {
            priceMove = formatPct(((price - previous.price) / previous.price) * 100);
        }

        previousBlock =
            `Previous Peter_o:\n` +
            `Direction: ${previous.direction}\n` +
            `Combo: ${previous.combo}\n` +
            `Price: ${previous.price !== null ? previous.price : "n/a"}\n` +
            `Time: ${formatDateTime(previous.time)}\n` +
            `Gap: ${gapMin}m ${gapSec}s\n` +
            `Price move: ${priceMove}`;
    }

    sendToTelegram3(
        `${title}\n` +
        `Symbol: ${symbol}\n` +
        `Direction: ${direction}\n` +
        `Combo: ${combo}\n` +
        `Price: ${price !== null ? price : "n/a"}\n` +
        `Time: ${formatDateTime(ts)}\n\n` +
        `${previousBlock}\n\n` +
        `Read: ${read}\n` +
        `Note: Peter_o is isolated and does NOT count inside ANCHORFORGE.`
    );

    peterforgeLastFire[lastKey] = ts;

    if (Object.keys(peterforgeMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);
        for (const sym of Object.keys(peterforgeMemory)) {
            peterforgeMemory[sym] = peterforgeMemory[sym].filter(e => e.time >= pruneCutoff);
            if (!peterforgeMemory[sym].length) delete peterforgeMemory[sym];
        }
    }
}


// ==========================================================
//  INAUGURAL (PERSISTENT — first 2 single-letter groups in 2h)
//  Condition:
//    - Main ecosystem only
//    - Same symbol
//    - Single-letter alphabet group only: A-Z
//    - Alert only first 2 DIFFERENT single-letter groups per symbol within 2h
//  Bot 1
// ==========================================================

const INAUGURAL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const INAUGURAL_MAX_ALERTS_PER_WINDOW = 2;

// inauguralState[symbol] = {
//   windowStart: timestamp,
//   alerts: [{ group, time }]
// }
let inauguralState = persisted.inauguralState || {};

function isInauguralSingleLetterGroup(group) {
    return /^[A-Z]$/.test(group);
}

function processInaugural(symbol, group, ts) {

    if (!symbol || !group) return;

    // Main ecosystem only — ignore # groups and subgroup families like 16A
    if (!isInauguralSingleLetterGroup(group)) return;

    const current = inauguralState[symbol];

    // Handle old persisted format safely.
    // Old version stored: inauguralState[symbol][group] = timestamp
    const invalidOldFormat =
        current &&
        (
            typeof current.windowStart !== "number" ||
            !Array.isArray(current.alerts)
        );

    // Start fresh if:
    // - no state
    // - old incompatible state
    // - 2h window has expired
    if (
        !current ||
        invalidOldFormat ||
        (ts - current.windowStart >= INAUGURAL_WINDOW_MS)
    ) {
        inauguralState[symbol] = {
            windowStart: ts,
            alerts: []
        };
    }

    const state = inauguralState[symbol];

    // If this exact group already alerted in this 2h window, ignore it.
    if (state.alerts.some(e => e.group === group)) {
        return;
    }

    // Only allow first 2 different single-letter groups in the 2h window.
    if (state.alerts.length >= INAUGURAL_MAX_ALERTS_PER_WINDOW) {
        return;
    }

    state.alerts.push({
        group,
        time: ts
    });

    const slot = state.alerts.length;

    sendToTelegram1(
        `🎖 INAUGURAL\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `Slot: ${slot}/${INAUGURAL_MAX_ALERTS_PER_WINDOW}\n` +
        `Rule: First 2 single-letter groups in 2 hours\n` +
        `Window Start: ${formatDateTime(state.windowStart)}\n` +
        `Now: ${formatDateTime(ts)}`
    );

    saveState();
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
        const symbol = normalizeSymbol(body.symbol);
        const isHash = group.startsWith("#");
        const isPeterPayload = isPeterForgePayload(body, group);

        const ts = nowMs();

        const effectiveHashGroup = group || (isPeterPayload
            ? `PETER-${body.direction || ""}-${body.matched_tfs || body.timeframes || body.tfs || body.tf_combo || ""}`
            : "");

        const hash = alertHash(symbol, effectiveHashGroup, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!symbol) return res.sendStatus(200);
        if (!group && !isPeterPayload) return res.sendStatus(200);

        if (group) {
            if (!events[group]) events[group] = [];
            events[group].push({ time: ts, data: body });
            pruneOld(events[group], maxWindowMs());
        }



        //processCheck(symbol, group, ts, body);
		
        // ✅ FIX: FIRST must IGNORE # groups and group-less Peter_o payloads
        if (group && !isHash) {
            processFirst(symbol, group, ts);
            processInaugural(symbol, group, ts);
        }

// ==========================================
// 🧠 SPLIT PIPELINE
// ==========================================

if (!isHash) {
    // 🔵 NORMAL ECOSYSTEM
    // Group-less Peter_o payloads are handled by PETERFORGE only.

    if (group) {
        processAnyTwo(symbol, group, ts);    
        processBundle(symbol, group, ts);      
        //processBazooka(symbol, group, ts, body);

        processBlackPanther(symbol, group, ts);
        processSideFlip(symbol, group, ts);
        processGamma(symbol, group, ts);
        processYaba(symbol, group, ts);
        processSalsa(symbol, group, ts);
        processTango(symbol, group, ts);
        processCobra(symbol, group, ts);
        processNeptune(symbol, group, ts);
        processZulu(symbol, group, ts);
        processMinta(symbol, group, ts);
        processMamba(symbol, group, ts);
        processSpesh(symbol, group, ts);
        processCabal(symbol, group, ts);
        processBoom(symbol, group, ts);
        processKooky(symbol, group, ts);        
        //processTesting(symbol, group, ts);
        //processAudit(symbol, group, ts, body);
        processBababia(symbol, group, ts);
        // processMAMAMIA(symbol, group, ts); // moved to hash ecosystem
        processZoneforge(symbol, group, ts, body);
        processAnchorforge(symbol, group, ts, body);
        //processWakanda(symbol, group, ts, body);
        processJupiter(symbol, group, ts);
    }

    processPeterforge(symbol, group, ts, body);

} else {
    // 🔴 HASH ECOSYSTEM (isolated)

    recordHashEvent(symbol, group, ts);

    processGodzilla(symbol, group, ts);

    if (typeof processBazooka === "function") {
        processBazooka(symbol, group, ts);
    }

    processWakanda(symbol, group, ts);

    // MAMAMIA may be active if you patched the hash-pair test bot.
    if (typeof processMAMAMIA === "function") {
    // processMAMAMIA(symbol, group, ts); // disabled while testing INAUGURAL
    }
}


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

        if (DISABLED_RULES.has(name)) continue;

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
