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
const STATE_FILE = "./state.json";

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const raw = fs.readFileSync(STATE_FILE, "utf8");
            const parsed = JSON.parse(raw);

            return {
                lastAlert: parsed.lastAlert || {},
                cooldownUntil: parsed.cooldownUntil || {}
            };
        }
    } catch {}

    return { lastAlert: {}, cooldownUntil: {} };
}

function saveState() {
    // 🔒 STAGING MUST NEVER PERSIST STATE
    if (!IS_MAIN) return;

    try {
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(
                {
                    lastAlert,
                    cooldownUntil
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
// SYMBOL NORMALIZATION
// Removes exchange + .P suffix
// -----------------------------
function normalizeSymbol(raw) {
    if (!raw) return "";

    // Remove exchange prefix if present
    let s = raw.includes(":") ? raw.split(":")[1] : raw;

    // Remove .P suffix if present
    s = s.replace(".P", "");

    return s.trim().toUpperCase();
}


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
const lastAlert = persisted.lastAlert || {};











// TANGO memory (A/B buffered within 8 minutes)
const tangoBuf = {};
// tangoBuf[symbol][group] = [ts1, ts2, ...]








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
//  GODZILLA — FROZEN SNAPSHOT (Exact BAZOOKA clone)
//  Groups: A-Z
//  Window: 50 seconds
//  Min Count: 20
//  Bot 9
// ==========================================================

const GODZILLA_WINDOW_MS = 50 * 1000;
const GODZILLA_MIN_COUNT = 20;
const GODZILLA_CHUNK_SIZE = 12; // presentation only (unchanged)

const GODZILLA_GROUPS = new Set(
    Array.from({ length: 26 }, (_, i) =>
        String.fromCharCode(65 + i)
    )
);

const godzillaState = {
    active: false,
    symbols: new Map(),
    timer: null
};

function processGodzilla(symbol, group, ts) {

    if (!GODZILLA_GROUPS.has(group)) return;

    // Start frozen snapshot on FIRST hit
    if (!godzillaState.active) {
        godzillaState.active = true;
        godzillaState.symbols.clear();

        godzillaState.timer = setTimeout(() => {

            const entries = [...godzillaState.symbols.entries()];
            const total = entries.length;

            // EXACT same threshold logic as Bazooka
            if (total >= GODZILLA_MIN_COUNT) {

                const chunks = [];
                for (let i = 0; i < entries.length; i += GODZILLA_CHUNK_SIZE) {
                    chunks.push(entries.slice(i, i + GODZILLA_CHUNK_SIZE));
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
                        `💥 GODZILLA${suffix}\n` +
                        `Total Symbols: ${total}\n` +
                        `Window: 50s\n` +
                        `Symbols:\n${lines}`
                    );
                });

            }

            // Reset snapshot (identical to Bazooka)
            godzillaState.active = false;
            godzillaState.symbols.clear();
            clearTimeout(godzillaState.timer);
            godzillaState.timer = null;

        }, GODZILLA_WINDOW_MS);
    }

    // Collect symbol ONCE during window (no overwrite)
    if (!godzillaState.symbols.has(symbol)) {
        godzillaState.symbols.set(symbol, { time: ts, group });
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
//  WAKANDA (Buffered Burst Engine)
//  Logical Window: 50 seconds
//  Delivery Buffer: 60 seconds
//  Groups: A-Z
//  Min Count: 20
//  Bot 9
// ==========================================================

const WAKANDA_WINDOW_MS = 50 * 1000;
const WAKANDA_BUFFER_MS = 60 * 1000;
const WAKANDA_MIN_COUNT = 20;

const WAKANDA_GROUPS = new Set(
    Array.from({ length: 26 }, (_, i) =>
        String.fromCharCode(65 + i)
    )
);

const wakandaState = {};

function processWakanda(symbol, group, ts) {

    if (!WAKANDA_GROUPS.has(group)) return;

    if (!wakandaState[group]) {
        wakandaState[group] = {
            active: false,
            symbols: new Map(),
            startTime: null,
            timer: null
        };
    }

    const state = wakandaState[group];

    // Start burst on first hit
    if (!state.active) {
        state.active = true;
        state.startTime = ts;
        state.symbols.clear();

        state.timer = setTimeout(() => {

            const cutoff = state.startTime + WAKANDA_WINDOW_MS;

            const entries = [...state.symbols.entries()]
                .filter(([_, time]) => time <= cutoff);

            if (entries.length >= WAKANDA_MIN_COUNT) {

                const lines = entries
                    .sort((a, b) => a[1] - b[1])
                    .map(([sym, time]) =>
                        `• ${sym} @ ${new Date(time).toLocaleTimeString()}`
                    )
                    .join("\n");

                sendToTelegram9(
                    `🎉 WAKANDA\n` +
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

        }, WAKANDA_WINDOW_MS + WAKANDA_BUFFER_MS);
    }

    state.symbols.set(symbol, ts);
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

    sendToTelegram4(msg);
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
//  SALSA (Batch detector — mandatory "19" group)
//  Condition: Same symbol must include at least one group starting with "19"
//  Window: 5 minutes
//  Batch delay: 5 minutes
//  Bot 6
// ==========================================================

const SALSA_WINDOW_MS = 5 * 60 * 1000;

const salsaState = {};

// salsaState[symbol] = { events: [], timer }

function processSalsa(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!salsaState[symbol]) {

        salsaState[symbol] = {
            events: [],
            timer: null
        };

        salsaState[symbol].timer = setTimeout(() => {

            const state = salsaState[symbol];
            const events = state.events;

            const hasMandatory19 = events.some(e => e.group.startsWith("19"));

            if (events.length >= 2 && hasMandatory19) {

                const lines = events
                    .sort((a,b)=>a.time-b.time)
                    .map(e =>
                        `• ${e.group} @ ${new Date(e.time).toLocaleTimeString()}`
                    )
                    .join("\n");

                sendToTelegram6(
                    `💃 SALSA\n` +
                    `Symbol: ${symbol}\n` +
                    `Count: ${events.length}\n` +
                    `Window: 5m\n` +
                    `Alerts:\n${lines}`
                );
            }

            delete salsaState[symbol];

        }, SALSA_WINDOW_MS);
    }

    salsaState[symbol].events.push({
        group,
        time: ts
    });
}

// ==========================================================
//  TANGO (Buffered repeat detector with per-group windows)
//  ACWSU + BDXTV
//  All groups → 3.5 minutes
// ==========================================================

const TANGO_WINDOWS_MS = {
    A: 3.5 * 60 * 1000,
    C: 3.5 * 60 * 1000,
    W: 3.5 * 60 * 1000,
    S: 3.5 * 60 * 1000,
    U: 3.5 * 60 * 1000,
    B: 3.5 * 60 * 1000,
    D: 3.5 * 60 * 1000,
    X: 3.5 * 60 * 1000,
    T: 3.5 * 60 * 1000,
    V: 3.5 * 60 * 1000
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

    // Prune old hits based on uniform window
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

    sendToTelegram4(msg);

    // Slide window (allow overlapping sequences)
    buf.shift();
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
                `${i + 1}) ${new Date(t).toLocaleString()}`
            )
            .join("\n");

        sendToTelegram9(
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
//  ZULU (Batch detector — mandatory "9" group)
//  Condition: Same symbol must include at least one group starting with "9"
//  Window: 5 minutes
//  Batch delay: 5 minutes
//  Bot 6
// ==========================================================

const ZULU_WINDOW_MS = 5 * 60 * 1000;

const zuluState = {};

// zuluState[symbol] = { events: [], timer }

function processZulu(symbol, group, ts) {

    if (!symbol || !group) return;

    if (!zuluState[symbol]) {

        zuluState[symbol] = {
            events: [],
            timer: null
        };

        zuluState[symbol].timer = setTimeout(() => {

            const state = zuluState[symbol];
            const events = state.events;

            const hasMandatory9 = events.some(e => e.group.startsWith("9"));

            if (events.length >= 2 && hasMandatory9) {

                const lines = events
                    .sort((a,b)=>a.time-b.time)
                    .map(e =>
                        `• ${e.group} @ ${new Date(e.time).toLocaleTimeString()}`
                    )
                    .join("\n");

                sendToTelegram6(
                    `🟡 ZULU\n` +
                    `Symbol: ${symbol}\n` +
                    `Count: ${events.length}\n` +
                    `Window: 5m\n` +
                    `Alerts:\n${lines}`
                );
            }

            delete zuluState[symbol];

        }, ZULU_WINDOW_MS);
    }

    zuluState[symbol].events.push({
        group,
        time: ts
    });
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
                        `• ${e.group} @ ${new Date(e.time).toLocaleTimeString()}`
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
                        `• ${e.group} @ ${new Date(e.time).toLocaleTimeString()}`
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
            `1) ${existing.group} @ ${new Date(existing.time).toLocaleTimeString()}\n` +
            `2) ${group} @ ${new Date(ts).toLocaleTimeString()}\n` +
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
            `BTCUSDT: ${new Date(
                symbol === "BTCUSDT" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
            `TOTAL: ${new Date(
                symbol === "TOTAL" ? ts : otherTs
            ).toLocaleTimeString()}\n` +
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

    sendToTelegram3(
        `📋 AUDIT\n` +
        `Symbol: ${symbol}\n` +
        `Group: ${group}\n` +
        `Price: ${price}\n` +
        `Time: ${new Date(ts).toLocaleString()}`
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
//  JUPITER (Same symbol + same group repeat within 1 hour)
//  Groups: A C S W B D X T
//  Bot 7
// ==========================================================

const JUPITER_WINDOW_MS = 12 * 60 * 1000; // 1 hour

const JUPITER_GROUPS = new Set(["A","C","S","W","B","D","X","T"]);

// jupiterMemory[symbol][group] = lastTimestamp
const jupiterMemory = {};

function processJupiter(symbol, group, ts) {

    if (!JUPITER_GROUPS.has(group)) return;

    if (!jupiterMemory[symbol]) {
        jupiterMemory[symbol] = {};
    }

    const last = jupiterMemory[symbol][group];

    if (last && (ts - last <= JUPITER_WINDOW_MS)) {

        const diffMs = ts - last;
        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

       sendToTelegram4(
    `🟠 JUPITER\n` +
    `Symbol: ${symbol}\n` +
    `Group: ${group}\n` +
    `First Hit: ${new Date(last).toLocaleString()}\n` +
    `Second Hit: ${new Date(ts).toLocaleString()}\n` +
    `Gap: ${diffMin}m ${diffSec}s`
);


    }

    // Always update
    jupiterMemory[symbol][group] = ts;

    // Safety prune (optional but safe)
    if (Object.keys(jupiterMemory).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);
        for (const sym of Object.keys(jupiterMemory)) {
            const groups = jupiterMemory[sym];
            const latest = Math.max(...Object.values(groups));
            if (latest < cutoff) delete jupiterMemory[sym];
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
                        `• ${e.symbol} (${e.group}) @ ${new Date(e.time).toLocaleTimeString()}`
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
                        `• ${e.group} @ ${new Date(e.time).toLocaleTimeString()}`
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
            `2) ${group} @ ${new Date(ts).toLocaleString()}\n` +
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

        const ts = nowMs();

        const hash = alertHash(symbol, group, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!group || !symbol) return res.sendStatus(200);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        

       
        processAnyTwo(symbol, group, ts);	
		processBundle(symbol, group, ts);      
		processBazooka(symbol, group, ts, body);
		
        
		processBlackPanther(symbol, group, ts);
		processSideFlip(symbol, group, ts);
        processGamma(symbol, group, ts);
        
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
		processWakanda(symbol, group, ts);
        processGodzilla(symbol, group, ts);		
		processJupiter(symbol, group, ts);


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
