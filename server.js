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
                gandoState: parsed.gandoState || {},
                scoreState: parsed.scoreState || {},
                lastSeenState: parsed.lastSeenState || {},
                godzillaState: parsed.godzillaState || {},
                bazookaState: parsed.bazookaState || {},
                hashMemory: parsed.hashMemory || {},
                wakandaState: parsed.wakandaState || {},
                boomPairState: parsed.boomPairState || {},

                kookyMemory: parsed.kookyMemory || {},
                speshMemory: parsed.speshMemory || {},
                kookyComboState: parsed.kookyComboState || {},
                speshComboState: parsed.speshComboState || {},
                cobraComboState: parsed.cobraComboState || {},
                cabalState: parsed.cabalState || {},
                mambaFirstState: parsed.mambaFirstState || {},
                events: parsed.events || {},
                blackPantherMemory: parsed.blackPantherMemory || {},
                gammaMemory: parsed.gammaMemory || {},
                mamamiaHashMemory: parsed.mamamiaHashMemory || {},
                salsaMemory: parsed.salsaMemory || {},
                neptuneMemory: parsed.neptuneMemory || {},
                zuluState: parsed.zuluState || {},
                sideFlipMemory: parsed.sideFlipMemory || {},
                mambaMemory: parsed.mambaMemory || {},
                boomMemory: parsed.boomMemory || {},
                jupiterState: parsed.jupiterState || {},
                yabaMemory: parsed.yabaMemory || {},
                zoneforgeMemory: parsed.zoneforgeMemory || {},
                zoneforgeLastFire: parsed.zoneforgeLastFire || {},
                anchorforgeMemory: parsed.anchorforgeMemory || {},
                anchorforgeLastFire: parsed.anchorforgeLastFire || {},
                peterforgeMemory: parsed.peterforgeMemory || {},
                peterforgeLastFire: parsed.peterforgeLastFire || {},
                telegramOutbox: parsed.telegramOutbox || []



















            };
        }
    } catch {}

    return {
        lastAlert: {},
        cooldownUntil: {},
        tangoState: {},
        gandoState: {},
        scoreState: {},
        lastSeenState: {},
        godzillaState: {},
        bazookaState: {},
        hashMemory: {},
        wakandaState: {},
        boomPairState: {},

        kookyMemory: {},
        speshMemory: {},
        kookyComboState: {},
        speshComboState: {},
        cobraComboState: {},
        cabalState: {},
        mambaFirstState: {},
        events: {},
        blackPantherMemory: {},
        gammaMemory: {},
        mamamiaHashMemory: {},
        salsaMemory: {},
        neptuneMemory: {},
        zuluState: {},
        sideFlipMemory: {},
        mambaMemory: {},
        boomMemory: {},
        jupiterState: {},
        yabaMemory: {},
        zoneforgeMemory: {},
        zoneforgeLastFire: {},
        anchorforgeMemory: {},
        anchorforgeLastFire: {},
        peterforgeMemory: {},
        peterforgeLastFire: {},
        telegramOutbox: []



















    };
}

let saveStateTimer = null;
let saveStateInProgress = false;
let saveStatePending = false;

const STATE_SAVE_DELAY_MS = Number((process.env.STATE_SAVE_DELAY_MS || "1000").trim());

function buildStateSnapshot() {
    return {
        lastAlert,
        cooldownUntil,
        tangoState,
        gandoState,
        scoreState,
        lastSeenState,
        godzillaState,
        bazookaState,
        hashMemory,
        wakandaState,
        boomPairState,

        kookyMemory,
        speshMemory,
        kookyComboState,
        speshComboState,
        cobraComboState,
        cabalState,
        mambaFirstState,
        events,
        blackPantherMemory,
        gammaMemory,
        mamamiaHashMemory,
        salsaMemory,
        neptuneMemory,
        zuluState,
        sideFlipMemory,
        mambaMemory,
        boomMemory,
        jupiterState,
        yabaMemory,
        zoneforgeMemory: typeof zoneforgeMemory !== "undefined" ? zoneforgeMemory : {},
        zoneforgeLastFire: typeof zoneforgeLastFire !== "undefined" ? zoneforgeLastFire : {},
        anchorforgeMemory: typeof anchorforgeMemory !== "undefined" ? anchorforgeMemory : {},
        anchorforgeLastFire: typeof anchorforgeLastFire !== "undefined" ? anchorforgeLastFire : {},
        peterforgeMemory: typeof peterforgeMemory !== "undefined" ? peterforgeMemory : {},
        peterforgeLastFire: typeof peterforgeLastFire !== "undefined" ? peterforgeLastFire : {},
        telegramOutbox
    };
}

function writeStateNow() {
    if (saveStateInProgress) {
        saveStatePending = true;
        return;
    }

    saveStateInProgress = true;

    try {
        pruneStateBeforeSave();

        // Compact JSON. This is much smaller/faster than JSON.stringify(..., null, 2).
        fs.writeFileSync(
            STATE_FILE,
            JSON.stringify(buildStateSnapshot()),
            "utf8"
        );

    } catch (err) {
        console.error("❌ Failed to save state:", err);
    } finally {
        saveStateInProgress = false;

        if (saveStatePending) {
            saveStatePending = false;
            saveState();
        }
    }
}

function saveState(immediate = false) {
    if (immediate) {
        if (saveStateTimer) {
            clearTimeout(saveStateTimer);
            saveStateTimer = null;
        }

        writeStateNow();
        return;
    }

    if (saveStateTimer) return;

    saveStateTimer = setTimeout(() => {
        saveStateTimer = null;
        writeStateNow();
    }, STATE_SAVE_DELAY_MS);
}

function pruneStateBeforeSave() {
    const ts = Date.now();

    // Keep Bot1 aggregation memory small.
    try {
        const maxMs = maxWindowMs();
        for (const g of Object.keys(events || {})) {
            if (!Array.isArray(events[g])) {
                delete events[g];
                continue;
            }

            pruneOld(events[g], maxMs);

            // Hard safety cap per group.
            if (events[g].length > 200) {
                events[g] = events[g].slice(-200);
            }
        }
    } catch {}

    // Hard prune combo repeat states to 2h + small buffer.
    pruneCompactComboState(kookyComboState, ts, 2 * 60 * 60 * 1000);
    pruneCompactComboState(speshComboState, ts, 2 * 60 * 60 * 1000);
    pruneCompactComboState(cobraComboState, ts, 2 * 60 * 60 * 1000);

    // Telegram outbox cap.
    if (Array.isArray(telegramOutbox) && telegramOutbox.length > TELEGRAM_OUTBOX_MAX) {
        telegramOutbox.splice(0, telegramOutbox.length - TELEGRAM_OUTBOX_MAX);
    }
}

function pruneCompactComboState(state, ts, windowMs) {
    if (!state || typeof state !== "object") return;

    const cutoff = ts - windowMs - (5 * 60 * 1000);

    for (const sym of Object.keys(state)) {
        const combos = state[sym];

        if (!combos || typeof combos !== "object") {
            delete state[sym];
            continue;
        }

        for (const key of Object.keys(combos)) {
            const value = combos[key];
            const time = typeof value === "number" ? value : value?.time;

            if (!time || time < cutoff) {
                delete combos[key];
            }
        }

        if (!Object.keys(combos).length) {
            delete state[sym];
        }
    }
}

// Load previous state
const persisted = loadState();
let ledgeforge2LastFire = persisted.ledgeforge2LastFire || {};

let ledgeforge2Memory = persisted.ledgeforge2Memory || {};

let bowlbridge2LastFire = persisted.bowlbridge2LastFire || {};

let bowlbridge2Memory = persisted.bowlbridge2Memory || {};

let ledgeforgeLastFire = persisted.ledgeforgeLastFire || {};

let ledgeforgeMemory = persisted.ledgeforgeMemory || {};

let bowlbridgeLastFire = persisted.bowlbridgeLastFire || {};

let bowlbridgeMemory = persisted.bowlbridgeMemory || {};

let peterforgeLastFire = persisted.peterforgeLastFire || {};

let peterforgeMemory = persisted.peterforgeMemory || {};

let anchorforgeLastFire = persisted.anchorforgeLastFire || {};

let anchorforgeMemory = persisted.anchorforgeMemory || {};

let zoneforgeLastFire = persisted.zoneforgeLastFire || {};

let zoneforgeMemory = persisted.zoneforgeMemory || {};




process.on("SIGTERM", () => {
    try { saveState(true); } catch {}
    process.exit(0);
});

process.on("SIGINT", () => {
    try { saveState(true); } catch {}
    process.exit(0);
});

let scoreState = persisted.scoreState || {};
let lastSeenState = persisted.lastSeenState || {};

let speshMemory = persisted.speshMemory || {};
let kookyMemory = persisted.kookyMemory || {};
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
// TELEGRAM SENDERS — OUTBOX + RETRY QUEUE
// -----------------------------
// Why:
// - /incoming must return 200 to TradingView quickly.
// - Telegram/network stalls should not hold webhook processing hostage.
// - Failed sends are kept in telegramOutbox and retried.
//
// Notes:
// - Bot tokens are NEVER printed in logs.
// - Set TELEGRAM_SEND_TIMEOUT_MS / TELEGRAM_MAX_ATTEMPTS / TELEGRAM_OUTBOX_MAX in Render if needed.

let telegramOutbox = Array.isArray(persisted.telegramOutbox)
    ? persisted.telegramOutbox
    : [];

let telegramOutboxRunning = false;
let telegramOutboxTimer = null;
let telegramOutboxSaveTimer = null;

const TELEGRAM_SEND_TIMEOUT_MS = Number((process.env.TELEGRAM_SEND_TIMEOUT_MS || "6000").trim());
const TELEGRAM_MAX_ATTEMPTS = Number((process.env.TELEGRAM_MAX_ATTEMPTS || "8").trim());
const TELEGRAM_OUTBOX_MAX = Number((process.env.TELEGRAM_OUTBOX_MAX || "2000").trim());
const TELEGRAM_RETRY_BASE_MS = Number((process.env.TELEGRAM_RETRY_BASE_MS || "15000").trim());

function requestTelegramOutboxSave() {
    if (telegramOutboxSaveTimer) return;

    telegramOutboxSaveTimer = setTimeout(() => {
        telegramOutboxSaveTimer = null;
        saveState();
    }, 250);
}

function getTelegramCreds(botNo) {
    if (botNo === 1) {
        return {
            token: TELEGRAM_BOT_TOKEN_1,
            chat: TELEGRAM_CHAT_ID_1
        };
    }

    if (botNo === 2) {
        return {
            token: TELEGRAM_BOT_TOKEN_2,
            chat: TELEGRAM_CHAT_ID_2
        };
    }

    const token = (process.env[`TELEGRAM_BOT_TOKEN_${botNo}`] || "").trim();
    const chat = (process.env[`TELEGRAM_CHAT_ID_${botNo}`] || "").trim();

    return { token, chat };
}

function telegramErrorSummary(err) {
    if (!err) return "unknown error";

    const parts = [];

    if (err.name) parts.push(`name=${err.name}`);
    if (err.code) parts.push(`code=${err.code}`);
    if (err.type) parts.push(`type=${err.type}`);
    if (err.status) parts.push(`status=${err.status}`);
    if (err.retryAfterMs) parts.push(`retryAfterMs=${err.retryAfterMs}`);
    if (err.message) parts.push(`message=${err.message}`);

    return parts.length ? parts.join(" | ") : String(err);
}

function telegramBackoffMs(attempts, err) {
    if (err?.retryAfterMs) {
        return Math.max(err.retryAfterMs, TELEGRAM_RETRY_BASE_MS);
    }

    const exp = Math.min(attempts, 6);
    const jitter = Math.floor(Math.random() * 1000);

    return (TELEGRAM_RETRY_BASE_MS * Math.pow(2, exp - 1)) + jitter;
}

function scheduleTelegramOutbox(delayMs = 0) {
    if (telegramOutboxTimer) {
        clearTimeout(telegramOutboxTimer);
        telegramOutboxTimer = null;
    }

    telegramOutboxTimer = setTimeout(() => {
        telegramOutboxTimer = null;
        processTelegramOutbox().catch(err => {
            console.error("⚠️ Telegram outbox worker crashed:", telegramErrorSummary(err));
        });
    }, Math.max(0, delayMs));
}

const TELEGRAM_SAFE_MESSAGE_LEN = Number((process.env.TELEGRAM_SAFE_MESSAGE_LEN || "3500").trim());

function splitTelegramMessage(text, maxLen = TELEGRAM_SAFE_MESSAGE_LEN) {
    const raw = String(text ?? "");

    if (raw.length <= maxLen) {
        return [raw];
    }

    const lines = raw.split("\n");
    const chunks = [];
    let current = "";

    for (const line of lines) {
        const candidate = current
            ? current + "\n" + line
            : line;

        if (candidate.length <= maxLen) {
            current = candidate;
            continue;
        }

        if (current) {
            chunks.push(current);
            current = "";
        }

        // If a single line is too long, hard-split it.
        let rest = line;
        while (rest.length > maxLen) {
            chunks.push(rest.slice(0, maxLen));
            rest = rest.slice(maxLen);
        }

        current = rest;
    }

    if (current) {
        chunks.push(current);
    }

    const total = chunks.length;

    return chunks.map((chunk, i) =>
        total > 1
            ? `Part ${i + 1}/${total}\n${chunk}`
            : chunk
    );
}

function enqueueTelegram(botNo, text) {
    const { token, chat } = getTelegramCreds(botNo);

    if (!token || !chat) {
        console.error(`⚠️ Bot${botNo} send skipped: missing token/chat env`);
        return;
    }

    const now = Date.now();
    const parts = splitTelegramMessage(text);

    for (const part of parts) {
        telegramOutbox.push({
            id: `${now}-${botNo}-${Math.random().toString(36).slice(2)}`,
            botNo,
            text: String(part ?? ""),
            attempts: 0,
            createdAt: now,
            nextAttemptAt: now,
            lastError: null
        });
    }

    if (parts.length > 1) {
        console.log(`✂️ Telegram message split: Bot${botNo} | parts=${parts.length}`);
    }

    // Hard cap so a long Telegram outage cannot grow /data/state.json forever.
    if (telegramOutbox.length > TELEGRAM_OUTBOX_MAX) {
        const removed = telegramOutbox.splice(0, telegramOutbox.length - TELEGRAM_OUTBOX_MAX);
        console.error(`⚠️ Telegram outbox trimmed: dropped ${removed.length} oldest queued messages`);
    }

    requestTelegramOutboxSave();
    scheduleTelegramOutbox(0);
}

async function rawTelegramSend(botNo, text) {
    const { token, chat } = getTelegramCreds(botNo);

    if (!token || !chat) {
        const err = new Error(`missing token/chat env for Bot${botNo}`);
        err.code = "MISSING_TELEGRAM_ENV";
        throw err;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chat,
                text
            }),
            signal: controller.signal
        });

        if (!res.ok) {
            let detail = "";

            try {
                detail = await res.text();
            } catch {}

            const err = new Error(`Telegram HTTP ${res.status} ${res.statusText} ${detail}`.trim());
            err.status = res.status;

            if (res.status === 429) {
                try {
                    const parsed = JSON.parse(detail);
                    const retryAfter = Number(parsed?.parameters?.retry_after || 0);
                    if (retryAfter > 0) {
                        err.retryAfterMs = retryAfter * 1000;
                    }
                } catch {}
            }

            throw err;
        }

        return true;

    } finally {
        clearTimeout(timer);
    }
}

async function processTelegramOutbox() {
    if (telegramOutboxRunning) return;
    telegramOutboxRunning = true;

    try {
        while (true) {
            const now = Date.now();

            let idx = telegramOutbox.findIndex(item =>
                item &&
                Number(item.nextAttemptAt || 0) <= now
            );

            if (idx === -1) {
                const nextDue = telegramOutbox
                    .map(item => Number(item.nextAttemptAt || 0))
                    .filter(Boolean)
                    .sort((a, b) => a - b)[0];

                if (nextDue) {
                    scheduleTelegramOutbox(Math.max(1000, nextDue - Date.now()));
                }

                break;
            }

            const item = telegramOutbox[idx];

            try {
                await rawTelegramSend(item.botNo, item.text);

                telegramOutbox.splice(idx, 1);
                requestTelegramOutboxSave();

                console.log(`✅ Telegram outbox sent: Bot${item.botNo} | remaining=${telegramOutbox.length}`);

            } catch (err) {
                item.attempts = Number(item.attempts || 0) + 1;
                item.lastError = telegramErrorSummary(err);

                console.error(
                    `⚠️ Telegram send failed: Bot${item.botNo} | attempt=${item.attempts}/${TELEGRAM_MAX_ATTEMPTS} | ${item.lastError}`
                );

                if (err.status === 400) {
                    console.error(
                        `❌ Telegram outbox dropping permanent 400: Bot${item.botNo} | createdAt=${formatDateTime(item.createdAt)} | error=${item.lastError}`
                    );

                    telegramOutbox.splice(idx, 1);

                } else if (item.attempts >= TELEGRAM_MAX_ATTEMPTS) {
                    console.error(
                        `❌ Telegram outbox giving up: Bot${item.botNo} | createdAt=${formatDateTime(item.createdAt)} | error=${item.lastError}`
                    );

                    telegramOutbox.splice(idx, 1);
                } else {
                    item.nextAttemptAt = Date.now() + telegramBackoffMs(item.attempts, err);
                }

                requestTelegramOutboxSave();

                // If Telegram/network is sick, do not hammer it. Pause until next due item.
                const nextDelay = item?.nextAttemptAt
                    ? Math.max(1000, item.nextAttemptAt - Date.now())
                    : TELEGRAM_RETRY_BASE_MS;

                scheduleTelegramOutbox(nextDelay);
                break;
            }
        }
    } finally {
        telegramOutboxRunning = false;
    }
}

// Resume unsent messages after deploy/restart.
if (telegramOutbox.length) {
    console.log(`📮 Telegram outbox restored: ${telegramOutbox.length} queued messages`);
    scheduleTelegramOutbox(1000);
}

function sendToTelegram1(text) { enqueueTelegram(1, text); }
function sendToTelegram2(text) { enqueueTelegram(2, text); }
function sendToTelegram3(text) { enqueueTelegram(3, text); }
function sendToTelegram4(text) { enqueueTelegram(4, text); }
function sendToTelegram5(text) { enqueueTelegram(5, text); }
function sendToTelegram6(text) { enqueueTelegram(6, text); }
function sendToTelegram7(text) { enqueueTelegram(7, text); }
function sendToTelegram8(text) { enqueueTelegram(8, text); }
function sendToTelegram9(text) { enqueueTelegram(9, text); }
function sendToTelegram10(text) { enqueueTelegram(10, text); }
function sendToTelegram11(text) { enqueueTelegram(11, text); }
function sendToTelegram12(text) { enqueueTelegram(12, text); }
function sendToTelegram13(text) { enqueueTelegram(13, text); }
function sendToTelegram14(text) { enqueueTelegram(14, text); }
function sendToTelegram15(text) { enqueueTelegram(15, text); }
console.log("🟣 MANUAL @ ECOSYSTEM LOADED — Bot10 route active");

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

let events = persisted.events || {};
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
//  Source:
//    - Any group starting with # is accepted
//  Bot 3
// ==========================================================

// godzillaState[symbol] = {
//   sourceTime: ts,
//   sourceGroup: group
// }

let godzillaState = persisted.godzillaState || {};

const GODZILLA_EXPIRE_MS = 2 * 60 * 60 * 1000; // 2 hours

function activateGodzilla(symbol, source, sourceTime, sourceGroup) {
    return;
}

function processGodzilla(symbol, group, ts) {
    return;
}
// ==========================================================
// STC setup removed intentionally.
// ==========================================================
// ==========================================================
//  HASH MEMORY (PERSISTENT — used by BAZOOKA + PREMIER)
//  Stores recent # alerts so reverse-mode setups can fire:
//    - HASH → YABA  = BAZOOKA Mode 2
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
//  BAZOOKA (BASIC HASH REPORTER)
//  Bot 4
//
//  Rule:
//    - Any group starting with #
//    - Same alert reports immediately
//    - No 5-minute cluster
//    - No count logic
//    - No WAKANDA scanner
// ==========================================================

// Kept for persistence compatibility only.
let bazookaState = persisted.bazookaState || {};

function isBazookaHashGroup(group) {
    return String(group || "").trim().startsWith("#");
}

function bazookaField(body, keys, fallback = "n/a") {
    for (const key of keys) {
        const value = body?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return String(value).trim();
        }
    }

    return fallback;
}

function processBazooka(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;
    if (!isBazookaHashGroup(group)) return;

    const cleanGroup = String(group || "").trim().toUpperCase();
    const cleanSymbol = symbol || normalizeSymbol(body?.symbol) || normalizeSymbol(body?.ticker) || "n/a";

    const price = bazookaField(body, ["price", "close", "current_price"]);
    const kind = bazookaField(body, ["kind", "type", "signal"], "");
    const range = bazookaField(body, ["range"], "");
    const windowName = bazookaField(body, ["window"], "");
    const layer = bazookaField(body, ["layer"], "");
    const note = bazookaField(body, ["note", "message", "reason", "context"], "");

    let msg =
        "💥 BAZOOKA\n" +
        "Mode: BASIC HASH REPORT\n" +
        "Symbol: " + cleanSymbol + "\n" +
        "Group: " + cleanGroup + "\n" +
        "Price: " + price + "\n" +
        "Time: " + formatDateTime(ts);

    if (kind && kind !== "n/a") {
        msg += "\nKind: " + kind;
    }

    if (range && range !== "n/a") {
        msg += "\nRange: " + range;
    }

    if (windowName && windowName !== "n/a") {
        msg += "\nWindow: " + windowName;
    }

    if (layer && layer !== "n/a") {
        msg += "\nLayer: " + layer;
    }

    if (note && note !== "n/a") {
        msg += "\n\nNote:\n" + note;
    }

    sendToTelegram4(msg);
    saveState();
}

// Old activation link remains dead.
function activateBazooka(symbol, source, sourceTime, sourceGroup) {
    return;
}

// ==========================================================
//  PREMIER

// ==========================================================
//  PREMIER

// ==========================================================
//  Mode-2 version of GODZILLA:
//    - # comes first
//  Bot 2
// ==========================================================

function processPremier(symbol, group, ts) {
    return;
}

// ==========================================================
//  WAKANDA DISABLED
//
//  Disabled by request.
//  BAZOOKA now handles every # alert as a basic report.
// ==========================================================

let wakandaState = persisted.wakandaState || {};

function processWakanda(symbol, group, ts) {
    return;
}

function activateWakanda(symbol, source, sourceTime, sourceGroup) {
    return;
}

// ==========================================================
//  STRUCTURED GROUP FILTER HELPER

// ==========================================================
//  STRUCTURED GROUP FILTER HELPER
//  Passes if at least ONE condition is met:
//    1) Same main number + alternate letters
//       Example: 26C + 26E, 28W + 28Y
//    2) Sequential main numbers
//       Example: 29A + 30B, 40Y + 41Z
//
//  No third rule yet:
//    40Y + 40Z does NOT qualify unless another rule is added later.
// ==========================================================

function parseStructuredGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    // Accept 29A, 40Y, 31W. Also accepts plain numeric groups for number sequencing.
    const m = raw.match(/^(\d+)([A-Z])?$/);
    if (!m) return null;

    const num = Number(m[1]);
    const letter = m[2] || "";

    return {
        raw,
        num,
        letter,
        letterIndex: letter ? letter.charCodeAt(0) - 65 : null
    };
}

function findStructuredGroupMatch(groups) {
    const parsed = [...new Set((groups || []).map(g => String(g || "").trim().toUpperCase()))]
        .map(parseStructuredGroup)
        .filter(Boolean);

    if (parsed.length < 2) return null;

    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            const a = parsed[i];
            const b = parsed[j];

            const sameNumberAlternateLetters =
                a.num === b.num &&
                a.letter &&
                b.letter &&
                Math.abs(a.letterIndex - b.letterIndex) === 2;

            if (sameNumberAlternateLetters) {
                return {
                    type: "same-number alternate letters",
                    groups: [a.raw, b.raw],
                    label: a.raw + " + " + b.raw + " | same number, alternate letters"
                };
            }

            const sequentialNumbers =
                Math.abs(a.num - b.num) === 1;

            if (sequentialNumbers) {
                return {
                    type: "sequential numbers",
                    groups: [a.raw, b.raw],
                    label: a.raw + " + " + b.raw + " | sequential numbers"
                };
            }
        }
    }

    return null;
}

function passesStructuredGroupFilter(groups) {
    return !!findStructuredGroupMatch(groups);
}


// ==========================================================
//  LEGACY PLACEHOLDERS — PHASE 2 CLEANED
//
//  Old BLACK_PANTHER / SOURCE RANGE / GAMMA logic removed.
//  Names kept only so we can reuse them later.
// ==========================================================

let blackPantherMemory = persisted.blackPantherMemory || {};
let gammaMemory = persisted.gammaMemory || {};


// ==========================================================
//  BLACKPANTHER — SPECIAL ECOSYSTEM FAMILY CROSS
//  Bot 3
//
//  Rule:
//    - Same symbol
//    - Eligible ecosystems only: #, ~, ^, @
//    - Excluded ecosystems: $, normal/no-prefix
//    - Families must be different
//    - Match must occur within 1 hour
//    - Same eligible ecosystem is allowed if families are different
//      Example: ~1 and ~2
// ==========================================================

const BLACKPANTHER_SPECIAL_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function blackPantherSpecialEcosystem(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return "";

    if (raw.startsWith("#")) return "HASH";
    if (raw.startsWith("~")) return "ZEBRA";
    if (raw.startsWith("^")) return "KANGAROO";
    if (raw.startsWith("@")) return "MANUAL";

    // Explicitly exclude DOLLAR and normal/no-prefix.
    return "";
}

function blackPantherFamilyFromGroup(group) {
    const raw = String(group || "").trim().toUpperCase();
    if (!raw) return "";

    // Remove ecosystem prefix.
    const body = raw.slice(1);

    // Primary family = first number after the ecosystem character.
    // Examples: ~1 => 1, ~2 => 2, #37A => 37, @41K => 41.
    const num = body.match(/^(\d+)/);
    if (num) return num[1];

    // Fallback for non-numeric special groups.
    // Example: #TOP_ALERT => TOP
    const word = body.match(/^([A-Z]+)/);
    if (word) return word[1];

    return body || raw;
}

function blackPantherEventLine(e, index) {
    return (
        (index + 1) + ") " +
        e.ecosystem +
        " | Family " + e.family +
        " | " + e.group +
        " | Price " + (e.price ?? "n/a") +
        " @ " + formatDateTime(e.time)
    );
}

function processBlackPanther(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim();
    const ecosystem = blackPantherSpecialEcosystem(rawGroup);

    // Only #, ~, ^, @ are eligible.
    // $ and normal/no-prefix are excluded.
    if (!ecosystem) return;

    const family = blackPantherFamilyFromGroup(rawGroup);
    if (!family) return;

    if (!blackPantherMemory[symbol] || typeof blackPantherMemory[symbol] !== "object") {
        blackPantherMemory[symbol] = {
            events: [],
            lastSentKey: ""
        };
    }

    const state = blackPantherMemory[symbol];

    if (!Array.isArray(state.events)) {
        state.events = [];
    }

    const current = {
        ecosystem,
        family,
        group: rawGroup,
        time: ts,
        price:
            body?.price ??
            body?.close ??
            body?.current_price ??
            "n/a"
    };

    const cutoff = ts - BLACKPANTHER_SPECIAL_WINDOW_MS;

    state.events = state.events
        .filter(e =>
            e &&
            typeof e.time === "number" &&
            e.time >= cutoff &&
            e.symbol !== null
        )
        .sort((a, b) => a.time - b.time);

    const prior = state.events
        .filter(e => String(e.family) !== String(current.family))
        .sort((a, b) => b.time - a.time)[0];

    if (prior) {
        const gapMs = Math.abs(current.time - prior.time);

        if (gapMs <= BLACKPANTHER_SPECIAL_WINDOW_MS) {
            const first = prior.time <= current.time ? prior : current;
            const second = prior.time <= current.time ? current : prior;

            const pairKey = [
                first.ecosystem + ":" + first.family + ":" + first.group + ":" + first.time,
                second.ecosystem + ":" + second.family + ":" + second.group + ":" + second.time
            ].sort().join("|");

            if (state.lastSentKey !== pairKey) {
                const gapMin = Math.floor(gapMs / 60000);
                const gapSec = Math.floor((gapMs % 60000) / 1000);

                sendToTelegram3(
                    "🖤 BLACKPANTHER\n" +
                    "Rule: eligible special ecosystems, different families within 1 hour\n" +
                    "Eligible: #, ~, ^, @\n" +
                    "Excluded: $, normal\n" +
                    "Symbol: " + symbol + "\n" +
                    "Span: " + gapMin + "m " + gapSec + "s\n\n" +
                    "Alerts:\n" +
                    blackPantherEventLine(first, 0) + "\n" +
                    blackPantherEventLine(second, 1)
                );

                state.lastSentKey = pairKey;
            }
        }
    }

    // Keep latest event.
    state.events.push(current);

    // Safety cap.
    if (state.events.length > 100) {
        state.events = state.events.slice(-100);
    }

    // Global cleanup.
    if (Object.keys(blackPantherMemory).length > 5000) {
        const oldCutoff = ts - (2 * BLACKPANTHER_SPECIAL_WINDOW_MS);

        for (const sym of Object.keys(blackPantherMemory)) {
            const st = blackPantherMemory[sym];

            if (!st || typeof st !== "object" || !Array.isArray(st.events)) {
                delete blackPantherMemory[sym];
                continue;
            }

            st.events = st.events.filter(e => e && e.time >= oldCutoff);

            if (!st.events.length) {
                delete blackPantherMemory[sym];
            }
        }
    }

    saveState();
}

function processGamma(symbol, group, ts, body) {
    return;
}

function processRangeRepeatEngine(...args) {
    return;
}

// ==========================================================
//  FAMILY PAIR HELPERS

// ==========================================================
//  FAMILY PAIR HELPERS

// ==========================================================
//  FAMILY PAIR HELPERS

// ==========================================================
//  FAMILY PAIR HELPERS
//
//  BABABIA:
//    - Same symbol
//    - 2 numeric-family alerts within 5 minutes
//    - Family numbers must be consecutive
//    - Examples: 37X + 38J, 41K + 42M
//    - 2 slots maximum per symbol per 2-hour cycle
//
//  MAMAMIA:
//    - Same symbol
//    - 2 numeric-family alerts within 5 minutes
//    - Family numbers must be NON-consecutive
//    - Examples: 44K + 38G, 37X + 42K
//    - 2 slots maximum per symbol per 2-hour cycle
//
//  Both send to Bot 2.
// ==========================================================

const FAMILY_PAIR_WINDOW_MS = 5 * 60 * 1000;
const FAMILY_PAIR_CYCLE_MS = 2 * 60 * 60 * 1000;
const FAMILY_PAIR_MAX_SLOTS = 2;

// Reuse existing persisted container.
let mamamiaHashMemory = persisted.mamamiaHashMemory || {};

function parseFamilyPairGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw || raw.startsWith("#")) return null;

    const m = raw.match(/^(\d+)([A-Z]+)?$/);
    if (!m) return null;

    return {
        raw,
        family: Number(m[1]),
        suffix: m[2] || "",
        time: null
    };
}

function getFamilyPairStore(key) {
    if (!mamamiaHashMemory[key] || typeof mamamiaHashMemory[key] !== "object") {
        mamamiaHashMemory[key] = {};
    }

    return mamamiaHashMemory[key];
}

function resetFamilyPairSymbolState(store, symbol, ts) {
    store[symbol] = {
        windowStart: ts,
        slots: [],
        events: []
    };

    return store[symbol];
}

function getFamilyPairSymbolState(store, symbol, ts) {
    const existing = store[symbol];

    if (
        !existing ||
        typeof existing.windowStart !== "number" ||
        !Array.isArray(existing.slots) ||
        !Array.isArray(existing.events) ||
        (ts - existing.windowStart >= FAMILY_PAIR_CYCLE_MS)
    ) {
        return resetFamilyPairSymbolState(store, symbol, ts);
    }

    return existing;
}

function pruneFamilyPairEvents(events, ts) {
    const cutoff = ts - FAMILY_PAIR_WINDOW_MS;

    return (events || [])
        .filter(e =>
            e &&
            typeof e.time === "number" &&
            e.time >= cutoff
        )
        .sort((a, b) => a.time - b.time);
}

function familyPairFormatEvent(e) {
    return String(e.raw) +
        " | family " + e.family +
        " @ " + formatDateTime(e.time);
}

function familyPairSlotLines(slots) {
    if (!Array.isArray(slots) || !slots.length) return "none";

    return slots
        .map((slot, i) =>
            (i + 1) + ") " +
            slot.first.raw + " + " + slot.second.raw +
            " | gap " + slot.gapMin + "m " + slot.gapSec + "s" +
            " | " + formatDateTime(slot.time)
        )
        .join("\n");
}

function addFamilyPairEvent(state, event) {
    state.events = pruneFamilyPairEvents(state.events, event.time);
    state.events.push(event);
    state.events.sort((a, b) => a.time - b.time);
}

function findFamilyPairMatch(state, event, mode) {
    const candidates = pruneFamilyPairEvents(state.events, event.time)
        .filter(e => e.raw !== event.raw);

    candidates.sort((a, b) => b.time - a.time);

    for (const prior of candidates) {
        const diff = Math.abs(Number(prior.family) - Number(event.family));

        if (mode === "CONSECUTIVE" && diff === 1) {
            return prior;
        }

        if (mode === "NON_CONSECUTIVE" && diff > 1) {
            return prior;
        }
    }

    return null;
}

function processFamilyPairTwoSlotDetector(cfg, symbol, group, ts) {

    if (!symbol || !group) return;

    const parsed = parseFamilyPairGroup(group);
    if (!parsed) return;

    const store = getFamilyPairStore(cfg.storeKey);
    const state = getFamilyPairSymbolState(store, symbol, ts);

    const event = {
        raw: parsed.raw,
        family: parsed.family,
        suffix: parsed.suffix,
        time: ts
    };

    if (state.slots.length >= FAMILY_PAIR_MAX_SLOTS) {
        return;
    }

    state.events = pruneFamilyPairEvents(state.events, ts);

    const match = findFamilyPairMatch(state, event, cfg.mode);

    if (!match) {
        addFamilyPairEvent(state, event);
        saveState();
        return;
    }

    const first = match.time <= event.time ? match : event;
    const second = match.time <= event.time ? event : match;

    const gapMs = second.time - first.time;
    const gapMin = Math.floor(gapMs / 60000);
    const gapSec = Math.floor((gapMs % 60000) / 1000);

    const slotNo = state.slots.length + 1;

    const slot = {
        first,
        second,
        gapMin,
        gapSec,
        time: ts
    };

    state.slots.push(slot);

    addFamilyPairEvent(state, event);

    cfg.sender(
        cfg.emoji + " " + cfg.name + "\n" +
        "Symbol: " + symbol + "\n" +
        "Slot: " + slotNo + "/" + FAMILY_PAIR_MAX_SLOTS + "\n" +
        "Cycle: 2 hours\n" +
        "Pair Window: 5 minutes\n" +
        "Rule: " + cfg.ruleLabel + "\n\n" +

        "1) " + familyPairFormatEvent(first) + "\n" +
        "2) " + familyPairFormatEvent(second) + "\n" +
        "Gap: " + gapMin + "m " + gapSec + "s\n\n" +

        "Slots Used This Cycle:\n" +
        familyPairSlotLines(state.slots)
    );

    saveState();
}

// ==========================================================
//  BABABIA — consecutive family pair
//  Bot 15
// ==========================================================

function processBababia(symbol, group, ts) {
    processFamilyPairTwoSlotDetector(
        {
            name: "BABABIA",
            emoji: "🎉",
            mode: "CONSECUTIVE",
            ruleLabel: "family numbers must be consecutive",
            storeKey: "__BABABIA_FAMILY_PAIR_2SLOT_STATE__",
            sender: sendToTelegram15
        },
        symbol,
        group,
        ts
    );
}

// ==========================================================
//  MAMAMIA — NON-consecutive family pair
//  Bot 15
// ==========================================================

function processMAMAMIA(symbol, group, ts) {
    processFamilyPairTwoSlotDetector(
        {
            name: "MAMAMIA",
            emoji: "🎶",
            mode: "NON_CONSECUTIVE",
            ruleLabel: "family numbers must be non-consecutive",
            storeKey: "__MAMAMIA_FAMILY_PAIR_2SLOT_STATE__",
            sender: sendToTelegram15
        },
        symbol,
        group,
        ts
    );
}


// ==========================================================
//  CHECK

// ==========================================================
//  CHECK

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

    sendToTelegram13(msg);
}

// ==========================================================
//  LEGACY PLACEHOLDERS — PHASE 2 CLEANED
//
//  Old SALSA / TANGO logic removed.
//  Names kept only so we can reuse them later.
// ==========================================================

let salsaMemory = persisted.salsaMemory || {};
let tangoState = persisted.tangoState || {};
let gandoState = persisted.gandoState || {};

// Shared helper still needed by live engines such as ZULU.
function getFamily(group) {
    if (!group) return "";

    const raw = String(group || "").trim().toUpperCase();

    if (
        raw.startsWith("@") ||
        raw.startsWith("#") ||
        raw.startsWith("~") ||
        raw.startsWith("^")
    ) {
        return "";
    }

    const match = raw.match(/^(\d+)/);
    if (match) return match[1];

    return raw;
}

function processSalsa(symbol, group, ts, body) {
    return;
}

function processTango(symbol, group, ts, body) {
    return;
}

// ==========================================================
//  NEPTUNE (NORMAL + HASH CROSS-ECOSYSTEM CORRELATION)

// ==========================================================
//  NEPTUNE (NORMAL + HASH CROSS-ECOSYSTEM CORRELATION)
//  Bot 5
//
//  Rule:
//    - Same symbol
//    - NORMAL ecosystem alert + # ecosystem alert
//    - Either one can come first
//    - Must be within 30 minutes
// ==========================================================

const NEPTUNE_CROSS_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// neptuneMemory[symbol] = {
//   lastNormal: { group, time } | null,
//   lastHash: { group, time } | null,
//   lastSentKey: string
// }
let neptuneMemory = persisted.neptuneMemory || {};

function neptuneKindFromGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return "";
    if (raw.startsWith("#")) return "HASH";
    if (raw.startsWith("@")) return "";
    if (raw.startsWith("~")) return "";
    if (raw.startsWith("^")) return "";

    return "NORMAL";
}

function getNeptuneState(symbol) {
    const current = neptuneMemory[symbol];

    const invalid =
        !current ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        (
            !Object.prototype.hasOwnProperty.call(current, "lastNormal") &&
            !Object.prototype.hasOwnProperty.call(current, "lastHash")
        );

    if (invalid) {
        neptuneMemory[symbol] = {
            lastNormal: null,
            lastHash: null,
            lastSentKey: ""
        };
    }

    return neptuneMemory[symbol];
}

function neptunePairKey(a, b) {
    return [
        a.kind + ":" + a.group + ":" + a.time,
        b.kind + ":" + b.group + ":" + b.time
    ].sort().join("|");
}

function neptuneEventLine(e, index) {
    return (
        (index + 1) + ") " +
        e.kind +
        " | " + e.group +
        " @ " + formatDateTime(e.time)
    );
}

function processNeptune(symbol, group, ts) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim().toUpperCase();
    const kind = neptuneKindFromGroup(rawGroup);

    if (!kind) return;

    const state = getNeptuneState(symbol);

    const current = {
        kind,
        group: rawGroup,
        time: ts
    };

    const oppositeKey = kind === "HASH" ? "lastNormal" : "lastHash";
    const ownKey = kind === "HASH" ? "lastHash" : "lastNormal";

    const prior = state[oppositeKey];

    if (prior && typeof prior.time === "number") {
        const gapMs = Math.abs(ts - prior.time);

        if (gapMs <= NEPTUNE_CROSS_WINDOW_MS) {
            const first = prior.time <= current.time ? prior : current;
            const second = prior.time <= current.time ? current : prior;

            const pairKey = neptunePairKey(first, second);

            if (state.lastSentKey !== pairKey) {
                const gapMin = Math.floor(gapMs / 60000);
                const gapSec = Math.floor((gapMs % 60000) / 1000);

                sendToTelegram5(
                    "🌊 NEPTUNE\n" +
                    "Symbol: " + symbol + "\n" +
                    "Rule: NORMAL + HASH within 30 minutes\n" +
                    "Span: " + gapMin + "m " + gapSec + "s\n\n" +
                    "Alerts:\n" +
                    neptuneEventLine(first, 0) + "\n" +
                    neptuneEventLine(second, 1)
                );

                state.lastSentKey = pairKey;
            }
        }
    }

    // Always store latest alert from this ecosystem.
    state[ownKey] = current;

    // Safety cleanup.
    if (Object.keys(neptuneMemory).length > 5000) {
        const cutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(neptuneMemory)) {
            const st = neptuneMemory[sym];

            if (!st || typeof st !== "object") {
                delete neptuneMemory[sym];
                continue;
            }

            const n = st.lastNormal?.time || 0;
            const h = st.lastHash?.time || 0;

            if (Math.max(n, h) < cutoff) {
                delete neptuneMemory[sym];
            }
        }
    }

    saveState();
}

// ==========================================================
//  ZULU

// ==========================================================
//  ZULU

// ==========================================================
//  ZULU (Subgroup Pair Detector — SAME FAMILY)
//  Condition:
//    - Groups like 26A, 26B, 19X, etc.
//    - Same family (e.g. 26)
//    - Two DIFFERENT subgroups
//    - First occurrence in 4 hours (per family)
//    - Pair must occur within 10 minutes
//  One cycle per symbol+family → resets after fire
// Bot 3
// ==========================================================

const ZULU_ANCHOR_WINDOW_MS = 4 * 60 * 60 * 1000;  // 4 hours
const ZULU_PAIR_WINDOW_MS  = 10 * 60 * 1000;      // 10 minutes

// zuluState[symbol][family] = {
//   first: { group, time }
// }

let zuluState = persisted.zuluState || {};

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
    // ========================
    if (!state.first || (ts - state.first.time > ZULU_ANCHOR_WINDOW_MS)) {
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

        const zuluStructuredMatch = findStructuredGroupMatch([first.group, group]);

        if (!zuluStructuredMatch) {
            return;
        }

        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram3(
            `🟡 ZULU\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n` +
            `1) ${first.group} @ ${formatDateTime(first.time)}\n` +
            `2) ${group} @ ${formatDateTime(ts)}\n` +
            `Gap: ${diffMin}m ${diffSec}s\n` +
            `Structure: ${zuluStructuredMatch.label}\n` +
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
let sideFlipMemory = persisted.sideFlipMemory || {};

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
const MAMBA_ANCHOR_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// mambaMemory[symbol][family] = { group, time }
let mambaMemory = persisted.mambaMemory || {};

// mambaFirstState[symbol][family] = lastFireTimestamp
let mambaFirstState = persisted.mambaFirstState || {};

function getMambaFamily(group) {
    const match = String(group || "").match(/^(\d+)[A-Z]$/);
    return match ? match[1] : "";
}

function processMamba(symbol, group, ts, body) {
    return;
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

function processSpesh(symbol, group, ts, body) {
    return;
}

// ==========================================================
//  CABAL (PERSISTENT — first 2 SPESH/COBRA combo-repeat events)
//  Source:
//    - SPESH repeat events
//    - COBRA repeat events
//
//  Rule:
//    - Same symbol
//    - First 2 accepted SPESH/COBRA events within 2 hours
//    - Can be SPESH+SPESH, COBRA+COBRA, or SPESH+COBRA
//    - Avoid duplicate/encompassed events from same live cluster
//    - If duplicate/encompassed, keep the stronger event:
//        1) more matched combos
//        2) bigger best combo size
//  Bot 3
// ==========================================================

const CABAL_SLOT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const CABAL_MAX_SLOTS = 2;
const CABAL_DUPLICATE_CLUSTER_MS = 60 * 1000; // collapse SPESH/COBRA duplicates around same cluster

// cabalState[symbol] = {
//   windowStart: ts,
//   slots: [{ source, time, liveGroups, bestCombo, comboCount, bestComboSize, score }]
// }
let cabalState = persisted.cabalState || {};

function processCabal(symbol, group, ts, body) {
    return;
}

function cabalGroupSet(groups) {
    return new Set([...(groups || [])].map(String).filter(Boolean));
}

function cabalIsSubset(aGroups, bGroups) {
    const a = cabalGroupSet(aGroups);
    const b = cabalGroupSet(bGroups);

    if (!a.size || !b.size) return false;

    for (const x of a) {
        if (!b.has(x)) return false;
    }

    return true;
}

function cabalIsSameOrEncompassed(a, b) {
    if (!a || !b) return false;

    const closeInTime = Math.abs(Number(a.time || 0) - Number(b.time || 0)) <= CABAL_DUPLICATE_CLUSTER_MS;
    if (!closeInTime) return false;

    const liveA = a.liveGroups || [];
    const liveB = b.liveGroups || [];

    const bestA = a.bestCombo || [];
    const bestB = b.bestCombo || [];

    return (
        cabalIsSubset(liveA, liveB) ||
        cabalIsSubset(liveB, liveA) ||
        cabalIsSubset(bestA, bestB) ||
        cabalIsSubset(bestB, bestA)
    );
}

function cabalCandidateScore(candidate) {
    return (Number(candidate.comboCount || 0) * 1000) + Number(candidate.bestComboSize || 0);
}

function cabalBuildCandidate(cfg, symbol, ts, liveGroups, repeated) {

    const sortedRepeated = [...(repeated || [])].sort((a, b) => {
        const comboDiff = (b.groups?.length || 0) - (a.groups?.length || 0);
        if (comboDiff !== 0) return comboDiff;

        const gapDiff = Number(a.gapMs || 0) - Number(b.gapMs || 0);
        if (gapDiff !== 0) return gapDiff;

        return String(a.key || "").localeCompare(String(b.key || ""));
    });

    const best = sortedRepeated[0] || {
        groups: [],
        previousTime: ts,
        gapMs: 0,
        key: "n/a"
    };

    const candidate = {
        source: cfg.name,
        symbol,
        time: ts,
        liveGroups: [...new Set(liveGroups || [])].sort(),
        bestCombo: [...new Set(best.groups || [])].sort(),
        bestComboKey: comboKeyFromGroups(best.groups || []),
        previousTime: best.previousTime || ts,
        gapMs: Number(best.gapMs || 0),
        comboCount: repeated.length,
        bestComboSize: (best.groups || []).length
    };

    candidate.score = cabalCandidateScore(candidate);

    return candidate;
}

function registerCabalFromComboRepeat(cfg, symbol, ts, liveGroups, repeated) {

    if (!cfg || !["SPESH", "COBRA"].includes(cfg.name)) return;
    if (!symbol || !Array.isArray(repeated) || !repeated.length) return;

    const candidate = cabalBuildCandidate(cfg, symbol, ts, liveGroups, repeated);

    if (
        !cabalState[symbol] ||
        typeof cabalState[symbol].windowStart !== "number" ||
        !Array.isArray(cabalState[symbol].slots) ||
        (ts - cabalState[symbol].windowStart >= CABAL_SLOT_WINDOW_MS)
    ) {
        cabalState[symbol] = {
            windowStart: ts,
            slots: []
        };
    }

    const state = cabalState[symbol];

    // Collapse duplicate/encompassed SPESH/COBRA events from the same cluster.
    for (let i = 0; i < state.slots.length; i++) {
        const slot = state.slots[i];

        if (cabalIsSameOrEncompassed(candidate, slot)) {

            if (candidate.score > Number(slot.score || 0)) {
                state.slots[i] = candidate;

                console.log(
                    "CABAL replaced duplicate/encompassed slot with stronger event:",
                    symbol,
                    "source:", candidate.source,
                    "bestCombo:", comboFormatGroups(candidate.bestCombo),
                    "comboCount:", candidate.comboCount
                );

                saveState();
            }

            return;
        }
    }

    // Only first 2 accepted events inside the 2h window.
    if (state.slots.length >= CABAL_MAX_SLOTS) {
        console.log(
            "CABAL blocked:",
            symbol,
            "source:", candidate.source,
            "reason: 2 slots already used in this 2h window"
        );
        return;
    }

    state.slots.push(candidate);

    const slotNo = state.slots.length;

    sendCabalSlotAlert(symbol, state, candidate, slotNo);
    saveState();
}

function sendCabalSlotAlert(symbol, state, candidate, slotNo) {

    const gapMin = Math.floor(candidate.gapMs / 60000);
    const gapSec = Math.floor((candidate.gapMs % 60000) / 1000);

    const slotsUsed = state.slots
        .map((s, i) =>
            (i + 1) +
            ") " + s.source +
            " | " + comboFormatGroups(s.bestCombo) +
            " | Combos: " + s.comboCount +
            " | " + formatDateTime(s.time)
        )
        .join("\n");

    sendToTelegram3(
        "🧿 CABAL\n" +
        "Symbol: " + symbol + "\n" +
        "Source: " + candidate.source + "\n" +
        "Slot: " + slotNo + "/" + CABAL_MAX_SLOTS + "\n" +
        "Rule: First 2 SPESH/COBRA in 2 hours\n" +
        "Duplicate rule: same/encompassed cluster ignored\n\n" +

        "Live Cluster: " + comboFormatGroups(candidate.liveGroups) + "\n" +
        "Matched Combos: " + candidate.comboCount + "\n" +
        "Best Combo: " + comboFormatGroups(candidate.bestCombo) + "\n" +
        "Previous: " + formatDateTime(candidate.previousTime) + "\n" +
        "Current: " + formatDateTime(candidate.time) + "\n" +
        "Gap: " + gapMin + "m " + gapSec + "s\n" +
        "Window Start: " + formatDateTime(state.windowStart) + "\n\n" +

        "Slots Used:\n" + slotsUsed
    );
}


// ==========================================================
//  BOOM (ZEBRA-1 → NORMAL SEQUENCE TRACKER)
//  Bot 13
//
//  Rule:
//    - Same symbol
//    - Sequence must be:
//        1) ZEBRA seed first: ~1__TOP or ~1__BOTTOM
//        2) NORMAL ecosystem alert after it
//    - Max span: 2 hours
//    - If normal arrives after 2 hours, tracking resets/no alert
//    - Other ~ flavours do NOT count:
//        ~2__TOP, ~TOP_MAX, ~A, etc. are ignored by BOOM.
//    - Hash, manual, and kangaroo are ignored.
// ==========================================================

const BOOM_TRACK_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const BOOM_VALID_ZEBRA_SEEDS = new Set(["~1__TOP", "~1__BOTTOM"]);

// boomMemory[symbol] = {
//   seed: { group, time }
// }
let boomMemory = persisted.boomMemory || {};

// kept for persistence compatibility; no longer used for BOOM throttling
let boomPairState = persisted.boomPairState || {};

function isBoomZebraSeed(group) {
    const raw = String(group || "").trim().toUpperCase();
    return BOOM_VALID_ZEBRA_SEEDS.has(raw);
}

function isBoomNormalGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return false;
    if (raw.startsWith("@")) return false;
    if (raw.startsWith("#")) return false;
    if (raw.startsWith("~")) return false;
    if (raw.startsWith("^")) return false;

    return true;
}

function getBoomState(symbol) {
    const current = boomMemory[symbol];

    const invalid =
        !current ||
        typeof current !== "object" ||
        Array.isArray(current);

    if (invalid) {
        boomMemory[symbol] = {
            seed: null
        };
    }

    return boomMemory[symbol];
}

function processBoom(symbol, group, ts) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim().toUpperCase();

    // Step 1: exact ZEBRA seed starts/restarts tracking.
    if (isBoomZebraSeed(rawGroup)) {
        const state = getBoomState(symbol);

        state.seed = {
            group: rawGroup,
            time: ts
        };

        saveState();
        return;
    }

    // Ignore every other ~ flavour and all non-normal ecosystems.
    if (!isBoomNormalGroup(rawGroup)) {
        return;
    }

    // Step 2: normal alert can only confirm an existing seed.
    const state = getBoomState(symbol);
    const seed = state.seed;

    if (!seed || typeof seed.time !== "number") {
        saveState();
        return;
    }

    const spanMs = ts - seed.time;

    // Wrong sequence / bad timestamp safety.
    if (spanMs < 0) {
        state.seed = null;
        saveState();
        return;
    }

    // Over 2 hours: restart/clear tracking, no alert.
    if (spanMs > BOOM_TRACK_WINDOW_MS) {
        state.seed = null;
        saveState();
        return;
    }

    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    sendToTelegram1(
        "💥 BOOM\n" +
        "Symbol: " + symbol + "\n" +
        "Sequence: ZEBRA-1 → NORMAL\n" +
        "Window: 2 hours max\n" +
        "Rule: ~1__TOP or ~1__BOTTOM must come before normal ecosystem\n" +
        "Span: " + spanMin + "m " + spanSec + "s\n\n" +
        "Alerts:\n" +
        "1) ZEBRA | " + seed.group + " @ " + formatDateTime(seed.time) + "\n" +
        "2) NORMAL | " + rawGroup + " @ " + formatDateTime(ts)
    );

    // Reset after fire. A new ~1__TOP/~1__BOTTOM is needed for the next BOOM.
    state.seed = null;

    // Safety cleanup.
    if (Object.keys(boomMemory).length > 5000) {
        const cutoff = ts - BOOM_TRACK_WINDOW_MS;

        for (const sym of Object.keys(boomMemory)) {
            const st = boomMemory[sym];

            if (
                !st ||
                typeof st !== "object" ||
                !st.seed ||
                typeof st.seed.time !== "number" ||
                st.seed.time < cutoff
            ) {
                delete boomMemory[sym];
            }
        }
    }

    saveState();
}

// ==========================================================
//  KOOKY

// ==========================================================
//  KOOKY

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
//  Bucket 1: C/D
//  Bucket 2: M/N
//  Condition:
//    - First C or D in 4 hours
//    - First M or N in 4 hours
//    - Must occur within 20 minutes of each other
//  One cycle per symbol → resets after fire
//  Bot 4
// ==========================================================

const JUPITER_ANCHOR_WINDOW_MS = 4 * 60 * 60 * 1000;  // 4 hours
const JUPITER_PAIR_WINDOW_MS  = 20 * 60 * 1000;      // 20 minutes

const JUPITER_CD = new Set(["C", "D"]);
const JUPITER_MN = new Set(["M", "N"]);

// jupiterState[symbol] = {
//   cdTime: timestamp,
//   mnTime: timestamp
// }

let jupiterState = persisted.jupiterState || {};

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

        if (!state.cdTime || (ts - state.cdTime > JUPITER_ANCHOR_WINDOW_MS)) {
            state.cdTime = ts;
        } else {
            return; // ignore non-first
        }
    }

    // ========================
    // HANDLE MN SIDE
    // ========================
    if (isMN) {

        if (!state.mnTime || (ts - state.mnTime > JUPITER_ANCHOR_WINDOW_MS)) {
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
//  YABA ($ → ANY OTHER ECOSYSTEM CORRELATION)
//  Bot 9
//
//  Rule:
//    - Same symbol
//    - One $ ecosystem alert
//    - One NON-$ ecosystem alert
//    - Other ecosystem can be NORMAL, #, ~, ^, or @
//    - Either order is valid
//    - Must match within 1 hour
// ==========================================================

const YABA_CROSS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// yabaMemory[symbol] = {
//   lastDollar: { ecosystem, group, time, price },
//   lastOther: { ecosystem, group, time, price },
//   lastSentKey: string
// }
let yabaMemory = persisted.yabaMemory || {};

function yabaEcosystemFromGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return "";

    if (raw.startsWith("$")) return "DOLLAR";
    if (raw.startsWith("#")) return "HASH";
    if (raw.startsWith("~")) return "ZEBRA";
    if (raw.startsWith("^")) return "KANGAROO";
    if (raw.startsWith("@")) return "MANUAL";

    return "NORMAL";
}

function getYabaSymbolState(symbol) {
    const current = yabaMemory[symbol];

    const invalid =
        !current ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        (
            !Object.prototype.hasOwnProperty.call(current, "lastDollar") &&
            !Object.prototype.hasOwnProperty.call(current, "lastOther")
        );

    if (invalid) {
        yabaMemory[symbol] = {
            lastDollar: null,
            lastOther: null,
            lastSentKey: ""
        };
    }

    return yabaMemory[symbol];
}

function yabaPairKey(a, b) {
    return [
        a.ecosystem + ":" + a.group + ":" + a.time,
        b.ecosystem + ":" + b.group + ":" + b.time
    ].sort().join("|");
}

function yabaEventLine(e, index) {
    return (
        (index + 1) + ") " +
        e.ecosystem +
        " | " + e.group +
        " | Price " + (e.price ?? "n/a") +
        " @ " + formatDateTime(e.time)
    );
}

function pruneYabaMemory(ts) {
    if (!yabaMemory || typeof yabaMemory !== "object") return;

    const cutoff = ts - (2 * YABA_CROSS_WINDOW_MS);

    for (const sym of Object.keys(yabaMemory)) {
        const st = yabaMemory[sym];

        if (!st || typeof st !== "object") {
            delete yabaMemory[sym];
            continue;
        }

        const d = st.lastDollar?.time || 0;
        const o = st.lastOther?.time || 0;

        if (Math.max(d, o) < cutoff) {
            delete yabaMemory[sym];
        }
    }
}

function processYaba(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim();
    const ecosystem = yabaEcosystemFromGroup(rawGroup);

    if (!ecosystem) return;

    const state = getYabaSymbolState(symbol);

    const current = {
        ecosystem,
        group: rawGroup,
        time: ts,
        price:
            body?.price ??
            body?.close ??
            body?.current_price ??
            "n/a"
    };

    const isDollar = ecosystem === "DOLLAR";
    const opposite = isDollar ? state.lastOther : state.lastDollar;

    if (opposite && typeof opposite.time === "number") {
        const gapMs = Math.abs(ts - opposite.time);

        if (gapMs <= YABA_CROSS_WINDOW_MS) {
            const first = opposite.time <= current.time ? opposite : current;
            const second = opposite.time <= current.time ? current : opposite;
            const pairKey = yabaPairKey(first, second);

            if (state.lastSentKey !== pairKey) {
                const gapMin = Math.floor(gapMs / 60000);
                const gapSec = Math.floor((gapMs % 60000) / 1000);

                sendToTelegram9(
                    "🟨 YABA\n" +
                    "Rule: $ + any other ecosystem within 1 hour\n" +
                    "Symbol: " + symbol + "\n" +
                    "Span: " + gapMin + "m " + gapSec + "s\n\n" +
                    "Alerts:\n" +
                    yabaEventLine(first, 0) + "\n" +
                    yabaEventLine(second, 1)
                );

                state.lastSentKey = pairKey;
            }
        }
    }

    if (isDollar) {
        state.lastDollar = current;
    } else {
        state.lastOther = current;
    }

    pruneYabaMemory(ts);
    saveState();
}

// ==========================================================
//  BUNDLE

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
//  Bot 15
// ==========================================================

const MINTA_WINDOW_MS = 5 * 60 * 1000;
const MINTA_MIN_COUNT = 6;

const mintaState = {};

// mintaState[symbol] = { events: [], timer }

function processMinta(symbol, group, ts, body) {
    return;
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



const COMBO_REPEAT_WINDOW_SPESH_COBRA_MS = 16 * 60 * 1000; // 16 minutes for SPESH + COBRA
const COMBO_MAX_SUBSET_SIZE = Number((process.env.COMBO_MAX_SUBSET_SIZE || "4").trim()); // store 2-4 group combos
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

        if (picked.length >= COMBO_MAX_SUBSET_SIZE) {
            return;
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

function pruneComboState(state, ts, windowMs = COMBO_REPEAT_WINDOW_MS) {
    const cutoff = ts - windowMs;

    for (const sym of Object.keys(state)) {
        for (const key of Object.keys(state[sym])) {
            const value = state[sym][key];
            const time = typeof value === "number" ? value : value?.time;

            if (!time || time < cutoff) {
                delete state[sym][key];
            }
        }

        if (!Object.keys(state[sym]).length) {
            delete state[sym];
        }
    }
}

function processComboRepeatEngine(...args) {
    return;
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

function processCobra(symbol, group, ts, body = {}) {

    const rawGroup = String(group || "").trim();
    const upperGroup = rawGroup.toUpperCase();

    if (!rawGroup) return;

    const specialChar = upperGroup[0];

    const ecosystemMap = {
        "#": "HASH",
        "~": "ZEBRA",
        "@": "MANUAL",
        "^": "KANGAROO",
        "$": "DOLLAR"
    };

    const ecosystem = ecosystemMap[specialChar];

    // COBRA only wants TOP alerts that also carry an ecosystem special character.
    if (!ecosystem) return;
    if (!upperGroup.includes("TOP")) return;

    const cleanSymbol =
        symbol ||
        normalizeSymbol(body?.symbol) ||
        normalizeSymbol(body?.ticker) ||
        "n/a";

    const price =
        body?.price ??
        body?.close ??
        body?.current_price ??
        "n/a";

    const kind =
        body?.kind ??
        body?.type ??
        body?.signal ??
        body?.action ??
        "";

    const timeframe =
        body?.timeframe ??
        body?.tf ??
        body?.interval ??
        "";

    const source =
        body?.source ??
        body?.indicator ??
        body?.script ??
        "";

    let msg =
        "🐍 COBRA\n" +
        "Rule: TOP + ecosystem special character\n" +
        "Ecosystem: " + ecosystem + "\n" +
        "Symbol: " + cleanSymbol + "\n" +
        "Group: " + rawGroup + "\n" +
        "Price: " + price + "\n" +
        "Time: " + formatDateTime(ts);

    if (kind && String(kind).trim()) {
        msg += "\nKind: " + String(kind).trim();
    }

    if (timeframe && String(timeframe).trim()) {
        msg += "\nTimeframe: " + String(timeframe).trim();
    }

    if (source && String(source).trim()) {
        msg += "\nSource: " + String(source).trim();
    }

    sendToTelegram7(msg);
}

// ==========================================================
// Bot 8
//
// Rule:
//   - Normal ecosystem only; route ignores # groups before calling this
//   - Same symbol
//   - First alert starts a 1h search cycle
//   - Any later alert with a DIFFERENT exact group completes the pair
//   - Same exact group is ignored
//   - If 1h expires with no different exact group, cycle restarts
//
// Valid:
//   40L then 40M
//   40L then 42L
//   39A then 41Z
//   A then B
//
// Invalid:
//   40L then 40L
//   39A then 39A
//
// Persistence:

//   - lastSeenState is already persisted in state.json
// ==========================================================













// ==========================================================
//  PETERFORGE PAYLOAD HELPERS
//  Runtime safety:
//    - /incoming uses isPeterForgePayload() before split pipeline.
//    - These helpers prevent ReferenceError if Peterforge block is absent.
// ==========================================================

function textFromBody(body) {
    if (!body || typeof body !== "object") return "";

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
    if (!body || typeof body !== "object") return false;

    const text = textFromBody(body).toUpperCase();

    if (text.includes("PETER")) return true;

    // Fallback for Peter_o JSON that may not carry the word PETER,
    // but carries the distinctive MTF divergence fields.
    const hasCombo = Boolean(
        body.matched_tfs ||
        body.timeframes ||
        body.tfs ||
        body.tf_combo
    );

    const hasPrice =
        body.price !== undefined &&
        body.price !== null &&
        String(body.price).trim() !== "";

    const dir = String(body.direction || body.dir || "").toUpperCase();

    const hasDirection =
        dir === "POSITIVE" ||
        dir === "NEGATIVE" ||
        dir === "BUY" ||
        dir === "SELL";

    return hasCombo && hasPrice && hasDirection && !group;
}


// ==========================================================
//  PETERFORGE NO-OP FALLBACK
//  Keeps route safe if Peterforge was removed/commented out.
// ==========================================================

function processPeterforge(symbol, group, ts, body) {
    return;
}


// ==========================================================
//  @ MANUAL REMINDER ECOSYSTEM
//  Bot 10
//
//  Rule:
//    - Any group starting with @ is manual-only.
//    - Examples: @MANUAL, @1A, @ B, @AA
//    - Sends to Bot10.
//    - Must return before normal/# ecosystems.
// ==========================================================

function isManualAtGroup(group) {
    return String(group || "").trim().startsWith("@");
}

function manualField(body, keys, fallback = "n/a") {
    for (const key of keys) {
        const value = body?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return String(value).trim();
        }
    }

    return fallback;
}

function processManualReminderBot10(symbol, group, ts, body) {

    const cleanGroup = String(group || "").trim();
    const cleanSymbol = symbol || normalizeSymbol(body?.ticker) || "n/a";

    const price = manualField(body, ["price", "close", "current_price"]);
    const target = manualField(body, ["target", "level", "manual_level", "alert_price"]);
    const note = manualField(body, ["note", "reason", "context", "memo", "message"], "");
    const source = manualField(body, ["source", "from", "setup", "bot_source"], "");
    const timeframe = manualField(body, ["timeframe", "tf", "interval"], "");

    let msg =
        "📝 MANUAL REMINDER\n" +
        "Symbol: " + cleanSymbol + "\n" +
        "Group: " + cleanGroup + "\n" +
        "Price: " + price + "\n" +
        "Target: " + target + "\n" +
        "Time: " + formatDateTime(ts);

    if (timeframe && timeframe !== "n/a") {
        msg += "\nTimeframe: " + timeframe;
    }

    if (source && source !== "n/a") {
        msg += "\nSource: " + source;
    }

    if (note) {
        msg += "\n\nNote:\n" + note;
    }

    console.log("🟣 manual reminder sending to Bot10:", cleanSymbol, cleanGroup);
    sendToTelegram10(msg);
}


// ==========================================================
//  ZEBRA ~ ECOSYSTEM
//  Bot 2
//
//  Rule:
//    - Any group starting with ~ belongs to ZEBRA.
//    - Examples: ~1A, ~B, ~AA, ~37X
//    - Sends to Bot2.
//    - Must return before normal/# ecosystems.
// ==========================================================

function isZebraGroup(group) {
    return String(group || "").trim().startsWith("~");
}

function zebraField(body, keys, fallback = "n/a") {
    for (const key of keys) {
        const value = body?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return String(value).trim();
        }
    }

    return fallback;
}

function processZebraEcosystem(symbol, group, ts, body) {

    const cleanGroup = String(group || "").trim();
    const cleanSymbol = symbol || normalizeSymbol(body?.ticker) || "n/a";

    const price = zebraField(body, ["price", "close", "current_price"]);
    const level = zebraField(body, ["level", "target", "alert_price", "manual_level"], "");
    const note = zebraField(body, ["note", "reason", "context", "memo", "message"], "");
    const source = zebraField(body, ["source", "from", "setup", "bot_source"], "");
    const timeframe = zebraField(body, ["timeframe", "tf", "interval"], "");
    const direction = zebraField(body, ["direction", "dir", "side", "signal"], "");

    let msg =
        "🦓 ZEBRA\n" +
"Symbol: " + cleanSymbol + "\n" +
        "Group: " + cleanGroup + "\n" +
        "Price: " + price + "\n" +
        "Time: " + formatDateTime(ts);

    if (level && level !== "n/a") {
        msg += "\nLevel: " + level;
    }

    if (direction && direction !== "n/a") {
        msg += "\nDirection: " + direction;
    }

    if (timeframe && timeframe !== "n/a") {
        msg += "\nTimeframe: " + timeframe;
    }

    if (source && source !== "n/a") {
        msg += "\nSource: " + source;
    }

    if (note && note !== "n/a") {
        msg += "\n\nNote:\n" + note;
    }
    sendToTelegram2(msg);
}



// ==========================================================
//  KANGAROO ^ ECOSYSTEM
//  Bot 14
//
//  Rule:
//    - Any group starting with ^ belongs to KANGAROO.
//    - Examples: ^A, ^1A, ^AA, ^37X
//    - Sends to Bot14 only.
//    - Does NOT feed BOOM.
//    - Does NOT enter normal, hash, ZEBRA, or manual logic.
// ==========================================================

function isKangarooGroup(group) {
    return String(group || "").trim().startsWith("^");
}

function kangarooField(body, keys, fallback = "n/a") {
    for (const key of keys) {
        const value = body?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return String(value).trim();
        }
    }

    return fallback;
}

function processKangarooEcosystem(symbol, group, ts, body) {

    const cleanGroup = String(group || "").trim();
    const cleanSymbol = symbol || normalizeSymbol(body?.ticker) || "n/a";

    const price = kangarooField(body, ["price", "close", "current_price"]);
    const level = kangarooField(body, ["level", "target", "alert_price", "manual_level"], "");
    const note = kangarooField(body, ["note", "reason", "context", "memo", "message"], "");
    const source = kangarooField(body, ["source", "from", "setup", "bot_source"], "");
    const timeframe = kangarooField(body, ["timeframe", "tf", "interval"], "");
    const direction = kangarooField(body, ["direction", "dir", "side", "signal"], "");

    let msg =
        "🦘 KANGAROO\n" +
        "Symbol: " + cleanSymbol + "\n" +
        "Group: " + cleanGroup + "\n" +
        "Price: " + price + "\n" +
        "Time: " + formatDateTime(ts);

    if (level && level !== "n/a") {
        msg += "\nLevel: " + level;
    }

    if (direction && direction !== "n/a") {
        msg += "\nDirection: " + direction;
    }

    if (timeframe && timeframe !== "n/a") {
        msg += "\nTimeframe: " + timeframe;
    }

    if (source && source !== "n/a") {
        msg += "\nSource: " + source;
    }

    if (note && note !== "n/a") {
        msg += "\n\nNote:\n" + note;
    }

    sendToTelegram14(msg);
}


// ==========================================================
//  GANDO (NORMAL ECOSYSTEM FAMILY SUBGROUP BURST)
//  Bot 15
//
//  Rule:
//    - Normal ecosystem only
//    - Same symbol
//    - Same numeric family
//    - 6 or more DISTINCT subgroups within 15 minutes
//    - Duplicate subgroup does not count twice.
//      Example: 38A + 38A still counts as 1 subgroup.
// ==========================================================

const GANDO_WINDOW_MS = 15 * 60 * 1000;
const GANDO_MIN_SUBGROUPS = 6;

// gandoState[symbol][family] = {
//   events: [{ group, family, subgroup, time }],
//   lastSentKey: "",
//   lastSentAt: 0
// }

function parseGandoNormalGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return null;

    // Normal ecosystem only. Exclude all special-character lanes.
    if (
        raw.startsWith("@") ||
        raw.startsWith("#") ||
        raw.startsWith("~") ||
        raw.startsWith("^")
    ) {
        return null;
    }

    const m = raw.match(/^(\d+)([A-Z]+)$/);
    if (!m) return null;

    return {
        raw,
        family: m[1],
        subgroup: raw
    };
}

function getGandoFamilyState(symbol, family) {
    if (!gandoState[symbol] || typeof gandoState[symbol] !== "object") {
        gandoState[symbol] = {};
    }

    if (
        !gandoState[symbol][family] ||
        typeof gandoState[symbol][family] !== "object" ||
        !Array.isArray(gandoState[symbol][family].events)
    ) {
        gandoState[symbol][family] = {
            events: [],
            lastSentKey: "",
            lastSentAt: 0
        };
    }

    return gandoState[symbol][family];
}

function pruneGandoEvents(events, ts) {
    const cutoff = ts - GANDO_WINDOW_MS;

    return (events || [])
        .filter(e =>
            e &&
            typeof e.time === "number" &&
            e.time >= cutoff &&
            e.time <= ts + 60000 &&
            e.group &&
            e.family &&
            e.subgroup
        )
        .sort((a, b) => a.time - b.time);
}

function gandoSubgroupKey(events) {
    return events
        .map(e => String(e.subgroup))
        .sort()
        .join("|");
}

function gandoEventLines(events) {
    return events
        .slice()
        .sort((a, b) => a.time - b.time)
        .map((e, i) =>
            (i + 1) + ") " +
            e.group +
            " @ " + formatDateTime(e.time)
        )
        .join("\n");
}

function processGando(symbol, group, ts) {

    if (!symbol || !group) return;

    const parsed = parseGandoNormalGroup(group);
    if (!parsed) return;

    const state = getGandoFamilyState(symbol, parsed.family);

    let events = pruneGandoEvents(state.events, ts);

    // Keep only one latest record per exact subgroup.
    // So 38A repeated refreshes 38A but does not count as 2.
    events = events.filter(e => e.subgroup !== parsed.subgroup);

    events.push({
        group: parsed.raw,
        family: parsed.family,
        subgroup: parsed.subgroup,
        time: ts
    });

    events = pruneGandoEvents(events, ts);
    state.events = events;

    if (events.length < GANDO_MIN_SUBGROUPS) {
        saveState();
        return;
    }

    const key = gandoSubgroupKey(events);

    // Avoid duplicate spam for the exact same subgroup set.
    // Allow the same set again after the 15-minute window has rolled.
    if (
        state.lastSentKey === key &&
        Number(state.lastSentAt || 0) &&
        ts - Number(state.lastSentAt || 0) < GANDO_WINDOW_MS
    ) {
        saveState();
        return;
    }

    const sorted = events.slice().sort((a, b) => a.time - b.time);
    const firstTime = sorted[0].time;
    const lastTime = sorted[sorted.length - 1].time;

    const spanMs = lastTime - firstTime;
    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    sendToTelegram15(
        "🦘 GANDO\n" +
        "Symbol: " + symbol + "\n" +
        "Family: " + parsed.family + "\n" +
        "Subgroups: " + events.length + "\n" +
        "Window: 15 minutes\n" +
        "Rule: 6+ distinct subgroups in same family\n" +
        "Span: " + spanMin + "m " + spanSec + "s\n\n" +
        "Alerts:\n" +
        gandoEventLines(sorted)
    );

    state.lastSentKey = key;
    state.lastSentAt = ts;

    // Safety cleanup.
    if (Object.keys(gandoState).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(gandoState)) {
            const families = gandoState[sym];

            if (!families || typeof families !== "object") {
                delete gandoState[sym];
                continue;
            }

            for (const fam of Object.keys(families)) {
                const famState = families[fam];

                if (
                    !famState ||
                    typeof famState !== "object" ||
                    !Array.isArray(famState.events)
                ) {
                    delete families[fam];
                    continue;
                }

                famState.events = famState.events.filter(e => e && e.time >= pruneCutoff);

                if (!famState.events.length) {
                    delete families[fam];
                }
            }

            if (!Object.keys(families).length) {
                delete gandoState[sym];
            }
        }
    }

    saveState();
}


// ==========================================================
//  LEGACY ENGINE PLACEHOLDERS — LOGIC CLEARED
//
//  These names are intentionally kept for future reuse:
//  MAMBA, BLACK_PANTHER, CABAL, SPESH, COBRA,
//  YABA, SALSA, GAMMA, MINTA, TANGO.
// ==========================================================


// ==========================================================
//  DOLLAR $ ECOSYSTEM
//  Bot 11
//
//  Rule:
//    - Any group starting with $ belongs to DOLLAR.
//    - Examples: $A, $1A, $AA, $37X, $1__TOP
//    - Sends to Bot11 only.
//    - Does NOT enter normal, hash, ZEBRA, KANGAROO, or manual logic.
// ==========================================================

function isDollarGroup(group) {
    return String(group || "").trim().startsWith("$");
}

function dollarField(body, keys, fallback = "n/a") {
    for (const key of keys) {
        const value = body?.[key];

        if (
            value !== undefined &&
            value !== null &&
            String(value).trim() !== ""
        ) {
            return String(value).trim();
        }
    }

    return fallback;
}

function processDollarEcosystem(symbol, group, ts, body) {

    const cleanGroup = String(group || "").trim();
    const cleanSymbol = symbol || normalizeSymbol(body?.ticker) || "n/a";

    const price = dollarField(body, ["price", "close", "current_price"]);
    const level = dollarField(body, ["level", "target", "alert_price", "manual_level"], "");
    const note = dollarField(body, ["note", "reason", "context", "memo", "message"], "");
    const source = dollarField(body, ["source", "from", "setup", "bot_source"], "");
    const timeframe = dollarField(body, ["timeframe", "tf", "interval"], "");
    const direction = dollarField(body, ["direction", "dir", "side", "signal"], "");

    let msg =
        "💵 DOLLAR\n" +
        "Symbol: " + cleanSymbol + "\n" +
        "Group: " + cleanGroup + "\n" +
        "Price: " + price + "\n" +
        "Time: " + formatDateTime(ts);

    if (level && level !== "n/a") {
        msg += "\nLevel: " + level;
    }

    if (direction && direction !== "n/a") {
        msg += "\nDirection: " + direction;
    }

    if (timeframe && timeframe !== "n/a") {
        msg += "\nTimeframe: " + timeframe;
    }

    if (source && source !== "n/a") {
        msg += "\nSource: " + source;
    }

    if (note && note !== "n/a") {
        msg += "\n\nNote:\n" + note;
    }

    sendToTelegram11(msg);
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
        const isManual = group.startsWith("@");
        const isZebra = group.startsWith("~");
        const isKangaroo = group.startsWith("^");
        const isDollar = group.startsWith("$");
        const isPeterPayload = isPeterForgePayload(body, group);

        const ts = nowMs();

        const effectiveHashGroup = group || (isPeterPayload
            ? `PETER-${body.direction || ""}-${body.matched_tfs || body.timeframes || body.tfs || body.tf_combo || ""}`
            : "");

        const hash = alertHash(symbol, effectiveHashGroup, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        // 🐍 COBRA global TOP-special detector.
        // Runs before isolated ecosystem returns so #, ~, @ and ^ can all be caught.
        processCobra(symbol, group, ts, body);
        // 🟨 YABA global $ cross-ecosystem detector.
        // Runs before isolated ecosystem returns so $, #, ~, @, ^ and normal can all be caught.
        processYaba(symbol, group, ts, body);
        // 🖤 BLACKPANTHER global special-family cross detector.
        // Runs before isolated ecosystem returns so #, ~, @ and ^ can all be caught.
        // $ and normal are ignored inside processBlackPanther.
        processBlackPanther(symbol, group, ts, body);



        // 🟣 @ MANUAL ECOSYSTEM
        // Manual reminders go to Bot10 only and must not enter normal/hash logic.
        if (isManual) {
            console.log("🟣 @ manual alert received:", symbol, group, JSON.stringify(body));
            processManualReminderBot10(symbol, group, ts, body);
            saveState();
            return res.sendStatus(200);
        }



        // 🦘 KANGAROO ^ ECOSYSTEM
        // Fully isolated. Does not feed BOOM or any other ecosystem.
        if (isKangaroo) {
            processKangarooEcosystem(symbol, group, ts, body);
            saveState();
            return res.sendStatus(200);
        }



        // 💵 DOLLAR $ ECOSYSTEM
        // Fully isolated. Does not feed BOOM or any other ecosystem.
        if (isDollar) {
            processDollarEcosystem(symbol, group, ts, body);
            saveState();
            return res.sendStatus(200);
        }

        // 🦓 ZEBRA ~ ECOSYSTEM
        // Separate non-manual ecosystem. Must not enter normal/hash logic.
        if (isZebra) {
            processBoom(symbol, group, ts);
            processZebraEcosystem(symbol, group, ts, body);
            saveState();
            return res.sendStatus(200);
        }

        if (!symbol) return res.sendStatus(200);
        if (!group && !isPeterPayload) return res.sendStatus(200);

        if (group) {
            if (!events[group]) events[group] = [];
            events[group].push({ time: ts, data: body });
            pruneOld(events[group], maxWindowMs());
        }



        //processCheck(symbol, group, ts, body);
		
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
        processGando(symbol, group, ts);
        processSideFlip(symbol, group, ts);
        // processGamma(symbol, group, ts); // disabled by request
        // processYaba moved to global $ cross-ecosystem detector
        // processSalsa(symbol, group, ts); // disabled by request
        processTango(symbol, group, ts);
        // processCobra moved to global TOP-special detector
        processNeptune(symbol, group, ts);
        // processZulu(symbol, group, ts); // disabled by request
        processMinta(symbol, group, ts);
        processMamba(symbol, group, ts);
        processSpesh(symbol, group, ts);
        processCabal(symbol, group, ts);
        processBoom(symbol, group, ts);
        processKooky(symbol, group, ts);        
        //processTesting(symbol, group, ts);
        //processAudit(symbol, group, ts, body);
        processBababia(symbol, group, ts);
        processMAMAMIA(symbol, group, ts);
        // processZoneforge(symbol, group, ts, body); // disabled temporarily
        // processAnchorforge(symbol, group, ts, body); // disabled temporarily for CABAL Bot3
        //processWakanda(symbol, group, ts, body);
        processJupiter(symbol, group, ts);
    }

    // processPeterforge(symbol, group, ts, body); // disabled by forge cleanup

} else {
    // 🔴 HASH ECOSYSTEM (isolated)
    // Any # group is reported by BAZOOKA. WAKANDA is disabled.

    recordHashEvent(symbol, group, ts);

    processNeptune(symbol, group, ts);

    processBoom(symbol, group, ts);

    processGodzilla(symbol, group, ts);

    if (typeof processBazooka === "function") {
        processBazooka(symbol, group, ts, body);
    }

    // WAKANDA disabled by request. BAZOOKA now reports every # alert.
    // if (typeof processWakanda === "function") {
    //     processWakanda(symbol, group, ts);
    // }
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

        // GLOBAL PERSISTENCE SWEEP
        // Schedule compact persistence of JSON-safe detector memories + Telegram outbox.
        saveState();

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

            await sendToTelegram13(lines.join("\n"));

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
