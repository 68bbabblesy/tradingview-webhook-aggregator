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
                lastSeenState: parsed.lastSeenState || {}
            };
        }
    } catch {}

    return {
        lastAlert: {},
        cooldownUntil: {},
        tangoState: {},
        scoreState: {},
        lastSeenState: {}
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
                    lastSeenState
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

// ==========================================================
// STC SOURCE CONFIG (EASY CONTROL)
// ==========================================================

const STC_SOURCE_CONFIG = {
    TANGO:   { enabled: true },
    GAMMA:   { enabled: true },
    ZULU:    { enabled: true },
    JUPITER: { enabled: true }
};

function isSTCSourceAllowed(source) {
    return STC_SOURCE_CONFIG[source]?.enabled === true;
}

// ==========================================================
// REGISTER STC SOURCE
// ==========================================================

function registerSTCSource(symbol, source, ts) {

    if (!isSTCSourceAllowed(source)) return;

    stcWatch[symbol] = {
        source,
        startTime: ts
    };
}

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
//  GODZILLA (Buffered #E / #J merge detector)
//  Condition:
//    - Track ALL groups per symbol
//    - Wait for BOTH #E and #J
//    - Delay output to batch events
//  Bot 3
// ==========================================================

const GODZILLA_DELAY_MS = 60 * 1000; // 🔧 change to 120000 if you want 2 mins

const godzillaState = {};

// godzillaState[symbol] = {
//   events: [{ group, time }],
//   hasE: false,
//   hasJ: false,
//   triggered: false,
//   timer: null
// }

function processGodzilla(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!godzillaState[symbol]) {
        godzillaState[symbol] = {
            events: [],
            hasE: false,
            hasJ: false,
            triggered: false,
            timer: null
        };
    }

    const state = godzillaState[symbol];

    // Always collect everything
    state.events.push({
        group,
        time: ts
    });

    if (group === "#E") state.hasE = true;
    if (group === "#J") state.hasJ = true;

    // Trigger condition met
    if (state.hasE && state.hasJ && !state.triggered) {

        state.triggered = true;

        // 🔥 Start delay timer (batching phase)
        state.timer = setTimeout(() => {

            const lines = state.events
                .sort((a,b)=>a.time-b.time)
                .map(e =>
                    `• ${e.group} @ ${formatTime(e.time)}`
                )
                .join("\n");

            sendToTelegram3(
                `🦖 GODZILLA\n` +
                `Symbol: ${symbol}\n` +
                `Trigger: #E + #J\n` +
                `Count: ${state.events.length}\n` +
                `Events:\n${lines}`
            );

            // Reset AFTER sending
            delete godzillaState[symbol];

        }, GODZILLA_DELAY_MS);
    }

    // Optional cleanup
    if (Object.keys(godzillaState).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);
        for (const sym of Object.keys(godzillaState)) {
            const s = godzillaState[sym];
            if (!s.events.length || s.events[s.events.length - 1].time < cutoff) {
                delete godzillaState[sym];
            }
        }
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
                            `• ${sym} (${info.group}) @ ${formatTime(info.time)}`
                        )
                        .join("\n");

                    const suffix =
                        chunks.length > 1
                            ? ` (Part ${idx + 1}/${chunks.length})`
                            : "";

                    sendToTelegram9(
                        `💥 BAZOOKA${suffix}\n` +
                        `Total Symbols: ${total}\n` +
                        `Window: 50s\n` +
                        `Symbols:\n${lines}`
                    );
                });

                

                

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
//  WAKANDA (STC CONFIRMATION ENGINE — SOURCE CONTROLLED)
//  Bot 9
// ==========================================================

function processWakanda(symbol, group, ts, body) {

    // Only STC signals
    if (group !== "#F") return;

    if (!symbol) return;

    const watch = stcWatch[symbol];

    // Must have valid source
    if (!watch || !isSTCSourceAllowed(watch.source)) {
        return;
    }

    // Only valid for 15 minutes after trigger
    if (ts - watch.startTime > 15 * 60 * 1000) {
        delete stcWatch[symbol];
        delete scoreState[symbol];
        return;
    }

    if (!scoreState[symbol]) {
        scoreState[symbol] = {
            hits: []
        };
    }

    const state = scoreState[symbol];

    const dir = body.dir || "UNKNOWN";

    // Add hit
    state.hits.push({ time: ts, dir });

    // Keep last 2 minutes
    const cutoff = ts - (2 * 60 * 1000);
    state.hits = state.hits.filter(x => x.time > cutoff);

    const count = state.hits.length;

    let strength = "LOW";
    if (count >= 2) strength = "MEDIUM";
    if (count >= 3) strength = "HIGH";

    // Direction bias
    let longCount = state.hits.filter(x => x.dir === "LONG").length;
    let shortCount = state.hits.filter(x => x.dir === "SHORT").length;

    let bias = "NEUTRAL";
    if (longCount > shortCount) bias = "LONG";
    if (shortCount > longCount) bias = "SHORT";

    // Fire only if meaningful
    if (count >= 2) {

        sendToTelegram9(
            `🚨 STC CONFIRMATION\n` +
            `Symbol: ${symbol}\n` +
            `Source: ${watch.source}\n` +
            `Bias: ${bias}\n` +
            `Strength: ${strength}\n` +
            `Signals: ${count} in 2m\n\n` +
            `⚠️ Post-${watch.source} structure forming`
        );
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

    sendToTelegram4(msg);
	
	

	
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
			registerSTCSource(symbol, "GAMMA", ts);
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
//  MAMAMIA (Buffered Burst Engine — E / Q)
//  Logical Window: 50 seconds
//  Delivery Buffer: 60 seconds
// ==========================================================

const MAMAMIA_WINDOW_MS = 50 * 1000;
const MAMAMIA_BUFFER_MS = 60 * 1000;
const MAMAMIA_MIN_COUNT = 10;

const mamamiaState = {
    E: { active: false, symbols: new Map(), startTime: null, timer: null },
    Q: { active: false, symbols: new Map(), startTime: null, timer: null }
};

function processMAMAMIA(symbol, group, ts) {

    if (!mamamiaState[group]) return;

    const state = mamamiaState[group];

    if (!state.active) {
        state.active = true;
        state.startTime = ts;
        state.symbols.clear();

        state.timer = setTimeout(() => {

            const cutoff = state.startTime + MAMAMIA_WINDOW_MS;

            const entries = [...state.symbols.entries()]
                .filter(([_, time]) => time <= cutoff);

            if (entries.length >= MAMAMIA_MIN_COUNT) {

                const lines = entries
                    .sort((a, b) => a[1] - b[1])
                    .map(([sym, time]) =>
                        `• ${sym} @ ${new Date(time).toLocaleTimeString()}`
                    )
                    .join("\n");

                sendToTelegram9(
                    `🎶 MAMAMIA\n` +
                    `Group: ${group}\n` +
                    `Unique Symbols: ${entries.length}\n` +
                    `Window: 50s\n` +
                    `Symbols:\n${lines}`
                );
            }

            state.active = false;
            state.symbols.clear();
            state.startTime = null;
            clearTimeout(state.timer);
            state.timer = null;

        }, MAMAMIA_WINDOW_MS + MAMAMIA_BUFFER_MS);
    }

    state.symbols.set(symbol, ts);
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


// ==========================================================
// STC TRACKING STATE
// ==========================================================
let stcWatch = {};


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
		registerSTCSource(symbol, "TANGO", ts);

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

        sendToTelegram6(
            `🟡 ZULU\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n` +
            `1) ${first.group} @ ${formatDateTime(first.time)}\n` +
            `2) ${group} @ ${formatDateTime(ts)}\n` +
            `Gap: ${diffMin}m ${diffSec}s\n` +
            `Condition: First-in-4h + Pair ≤10m`
        );
		registerSTCSource(symbol, "ZULU", ts);

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
//  MAMBA (Batch detector — mandatory Y or Z)
//  Condition: Same symbol must include at least one "Y" or "Z"
//  Window: 5 minutes
//  Batch delay: 5 minutes
//  Bot 8
// ==========================================================

const MAMBA_WINDOW_MS = 5 * 60 * 1000;

const mambaState = {};

// mambaState[symbol] = { events: [], timer }

function processMamba(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!mambaState[symbol]) {

        mambaState[symbol] = {
            events: [],
            timer: null
        };

        mambaState[symbol].timer = setTimeout(() => {

            const state = mambaState[symbol];
            const events = state.events;

            const hasYZ = events.some(e =>
                e.group === "Y" || e.group === "Z"
            );

            if (events.length >= 2 && hasYZ) {

                const lines = events
                    .sort((a,b)=>a.time-b.time)
                    .map(e =>
                        `• ${e.group} @ ${formatTime(e.time)}`
                    )
                    .join("\n");

                sendToTelegram8(
                    `🐍 MAMBA\n` +
                    `Symbol: ${symbol}\n` +
                    `Count: ${events.length}\n` +
                    `Window: 5m\n` +
                    `Alerts:\n${lines}`
                );
            }

            delete mambaState[symbol];

        }, MAMBA_WINDOW_MS);
    }

    mambaState[symbol].events.push({
        group,
        time: ts
    });
}
// ==========================================================
//  SPESH (BTCUSDT ↔ TOTAL same-group within 45s)
//  Groups: AA → ZZ
//  Bot 7
// ==========================================================

const SPESH_WINDOW_MS = 45 * 1000;

const SPESH_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

// AA → ZZ auto-generate
const SPESH_GROUPS = new Set(
    Array.from({ length: 26 }, (_, i) => {
        const letter = String.fromCharCode(65 + i);
        return letter + letter;
    })
);

const speshLast = {
    BTCUSDT: {},
    TOTAL: {}
};

function processSpesh(symbol, group, ts) {

    if (!SPESH_SYMBOLS.has(symbol)) return;
    if (!SPESH_GROUPS.has(group)) return;

    const otherSymbol = symbol === "BTCUSDT" ? "TOTAL" : "BTCUSDT";
    const otherTs = speshLast[otherSymbol][group];

    if (otherTs && Math.abs(ts - otherTs) <= SPESH_WINDOW_MS) {

        const diffMs = Math.abs(ts - otherTs);
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram7(
            `🟢 SPESH\n` +
            `Group: ${group}\n` +
            `BTCUSDT: ${new Date(
                symbol === "BTCUSDT" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
            `TOTAL: ${new Date(
                symbol === "TOTAL" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
            `Gap: ${diffSec}s`
        );
    }

    speshLast[symbol][group] = ts;
}

// ==========================================================
//  CABAL (BTCUSDT ↔ TOTAL same-group within 5 minutes)
//  Any group allowed
//  Bot 7
// ==========================================================

const CABAL_WINDOW_MS = 5 * 60 * 1000;

const CABAL_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

const cabalLast = {
    BTCUSDT: {},
    TOTAL: {}
};

function processCabal(symbol, group, ts) {

    if (!CABAL_SYMBOLS.has(symbol)) return;
    if (!group) return;

    const otherSymbol = symbol === "BTCUSDT" ? "TOTAL" : "BTCUSDT";
    const otherTs = cabalLast[otherSymbol][group];

    if (otherTs && Math.abs(ts - otherTs) <= CABAL_WINDOW_MS) {

        const diffMs = Math.abs(ts - otherTs);
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram7(
            `🔵 CABAL\n` +
            `Group: ${group}\n` +
            `BTCUSDT: ${new Date(
                symbol === "BTCUSDT" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
            `TOTAL: ${new Date(
                symbol === "TOTAL" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
            `Gap: ${diffMin}m ${diffSec}s`
        );
    }

    cabalLast[symbol][group] = ts;
}

// ==========================================================
//  BOOM (BTCUSDT / TOTAL same symbol — AAA→ZZZ groups)
//  Any 2 distinct groups within 5.5 minutes
//  Bot 7
// ==========================================================

const BOOM_WINDOW_MS = 5.5 * 60 * 1000;

const BOOM_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

// AAA → ZZZ checker
function isTripleLetter(group) {
    return /^[A-Z]{3}$/.test(group) &&
           group[0] === group[1] &&
           group[1] === group[2];
}

// boomMemory[symbol] = [{ group, time }]
const boomMemory = {};

function processBoom(symbol, group, ts) {

    if (!BOOM_SYMBOLS.has(symbol)) return;
    if (!isTripleLetter(group)) return;

    if (!boomMemory[symbol]) {
        boomMemory[symbol] = [];
    }

    const buf = boomMemory[symbol];

    // remove expired entries
    const cutoff = ts - BOOM_WINDOW_MS;
    while (buf.length && buf[0].time < cutoff) {
        buf.shift();
    }

    // look for different group
    const existing = buf.find(e => e.group !== group);

    if (existing) {

        const diffMs = ts - existing.time;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram7(
    `💥 BOOM\n` +
    `Symbol: ${symbol}\n` +
    `1) ${existing.group} @ ${formatTime(existing.time)}\n` +
    `2) ${group} @ ${formatTime(ts)}\n` +
    `Gap: ${diffMin}m ${diffSec}s`
     );
    }

    // avoid duplicate same-group stacking
    if (!buf.some(e => e.group === group)) {
        buf.push({ group, time: ts });
    }

    // safety prune
    if (Object.keys(boomMemory).length > 5000) {
        const pruneCutoff = ts - (60 * 60 * 1000);
        for (const sym of Object.keys(boomMemory)) {
            const arr = boomMemory[sym];
            if (!arr.length || arr[arr.length - 1].time < pruneCutoff) {
                delete boomMemory[sym];
            }
        }
    }
}


// ==========================================================
//  KOOKY (BTCUSDT ↔ TOTAL same-group within 45s)
//  Groups: AAA → ZZZ
//  Bot 7
// ==========================================================

const KOOKY_WINDOW_MS = 45 * 1000;

const KOOKY_SYMBOLS = new Set(["BTCUSDT", "TOTAL"]);

// AAA → ZZZ auto-generate
const KOOKY_GROUPS = new Set(
    Array.from({ length: 26 }, (_, i) => {
        const letter = String.fromCharCode(65 + i);
        return letter + letter + letter;
    })
);

const kookyLast = {
    BTCUSDT: {},
    TOTAL: {}
};

function processKooky(symbol, group, ts) {

    if (!KOOKY_SYMBOLS.has(symbol)) return;
    if (!KOOKY_GROUPS.has(group)) return;

    const otherSymbol = symbol === "BTCUSDT" ? "TOTAL" : "BTCUSDT";
    const otherTs = kookyLast[otherSymbol][group];

    if (otherTs && Math.abs(ts - otherTs) <= KOOKY_WINDOW_MS) {

        const diffMs = Math.abs(ts - otherTs);
        const diffSec = Math.floor(diffMs / 1000);

        sendToTelegram7(
    `🟣 KOOKY\n` +
    `Group: ${group}\n` +
    `BTCUSDT: ${formatTime(
        symbol === "BTCUSDT" ? ts : otherTs
    )}\n` +
    `TOTAL: ${formatTime(
        symbol === "TOTAL" ? ts : otherTs
    )}\n` +
    `Gap: ${diffSec}s`
    );
    }

    kookyLast[symbol][group] = ts;
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
			registerSTCSource(symbol, "JUPITER", ts);

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
//  COBRA (Same symbol Y/Z repeat within 30 minutes)
//  Groups: Y or Z
//  Same symbol
//  Window: 30 minutes
//  Bot 8
// ==========================================================

const COBRA_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// cobraMemory[symbol] = { group, time }
const cobraMemory = {};

function processCobra(symbol, group, ts) {

    if (!["Y", "Z"].includes(group)) return;

    const last = cobraMemory[symbol];

    if (last && (ts - last.time <= COBRA_WINDOW_MS)) {

        const diffMs  = ts - last.time;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram8(
            `🐍 COBRA\n` +
            `Symbol: ${symbol}\n` +
            `1) ${last.group} @ ${new Date(last.time).toLocaleString()}\n` +
            `2) ${group} @ ${formatDateTime(ts)}\n` +
            `Gap: ${diffMin}m ${diffSec}s`
        );

        // Reset for this symbol after firing
        delete cobraMemory[symbol];
        return;
    }

    // Always update latest hit
    cobraMemory[symbol] = { group, time: ts };

    // Optional pruning safety (memory guard)
    if (Object.keys(cobraMemory).length > 5000) {
        const cutoff = ts - (60 * 60 * 1000); // keep only last 1h
        for (const sym of Object.keys(cobraMemory)) {
            if (cobraMemory[sym].time < cutoff) {
                delete cobraMemory[sym];
            }
        }
    }
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
    }

    // else → ignore
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

        const ts = nowMs();
		

        const hash = alertHash(symbol, group, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!group || !symbol) return res.sendStatus(200);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        

        processCheck(symbol, group, ts, body);
		processFirst(symbol, group, ts);

// ==========================================
// 🧠 SPLIT PIPELINE
// ==========================================

if (!isHash) {
    // 🔵 NORMAL ECOSYSTEM

    processAnyTwo(symbol, group, ts);	
    processBundle(symbol, group, ts);      
    processBazooka(symbol, group, ts, body);

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
    processTesting(symbol, group, ts);
    processAudit(symbol, group, ts, body);
    processBababia(symbol, group, ts);
    processMAMAMIA(symbol, group, ts);
    processWakanda(symbol, group, ts, body);
    processJupiter(symbol, group, ts);

} else {
    // 🔴 HASH ECOSYSTEM (isolated)

    //processGodzilla(symbol, group, ts);

    // 👉 future hash bots go here
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
