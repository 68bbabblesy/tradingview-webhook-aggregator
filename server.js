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
        zoneforgeMemory,
        zoneforgeLastFire,
        anchorforgeMemory,
        anchorforgeLastFire,
        peterforgeMemory,
        peterforgeLastFire,
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
//  BLACK_PANTHER (Family subgroup burst detector)
//  Condition:
//    - Same symbol
//    - Same family: 16A/16B/16C => family 16
//    - 3 DISTINCT subgroups within 1 minute
//  Bot 4
// ==========================================================

const BLACK_PANTHER_WINDOW_MS = 60 * 1000; // 1 minute

// blackPantherMemory[symbol][family] = [{ group, time }]
let blackPantherMemory = persisted.blackPantherMemory || {};

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

    const blackPantherStructuredMatch = findStructuredGroupMatch(
        picked.map(e => e.group)
    );

    if (!blackPantherStructuredMatch) {
        return;
    }

    sendToTelegram4(
        `🖤 BLACK_PANTHER\n` +
        `Symbol: ${symbol}\n` +
        `Family: ${family}\n` +
        `Subgroups: ${picked.map(e => e.group).join(" → ")}\n` +
        `Structure: ${blackPantherStructuredMatch.label}\n` +
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
//  GAMMA RANGE ENGINE
//  Condition:
//    - Same symbol
//    - Exact same group/subgroup
//    - 3 hits with span >=10m and <15m
//    - Family independent: all families/groups are watched
//    - Output controlled by INAUGURAL_10_TO_14 two-slot filter
//  Bot 5
// ==========================================================

const GAMMA_MIN_SPAN_MS = 10 * 60 * 1000;
const GAMMA_MAX_SPAN_MS = (15 * 60 * 1000) - 1;

// gammaMemory[symbol][group] = [timestamps]
let gammaMemory = persisted.gammaMemory || {};

function processGamma(symbol, group, ts) {
    processRangeRepeatEngine(
        {
            source: "GAMMA",
            emoji: "🟣",
            alertName: "INAUGURAL_10_TO_14",
            rangeLabel: "10m to 14m 59s",
            minSpanMs: GAMMA_MIN_SPAN_MS,
            maxSpanMs: GAMMA_MAX_SPAN_MS,
            memory: gammaMemory
        },
        symbol,
        group,
        ts
    );
}

// ==========================================================
//  POT HELPERS
//  POT 1 = main groups 27–34
//  POT 2 = main groups 37–45
//  Groups 35/36 and anything outside both pots are ignored.
//  Subgroups are ignored: 31A, 31W, 31Z all count as main group 31.
// ==========================================================

const POT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getMainGroupNumber(group) {
    const m = String(group || "").match(/^(\d+)/);
    return m ? Number(m[1]) : null;
}

function getPotInfo(group) {
    if (!group) return null;

    // Normal ecosystem only
    if (String(group).startsWith("#")) return null;

    const main = getMainGroupNumber(group);
    if (!main) return null;

    if (main >= 27 && main <= 34) {
        return {
            pot: "POT 1",
            main
        };
    }

    if (main >= 37 && main <= 45) {
        return {
            pot: "POT 2",
            main
        };
    }

    return null;
}

function potFormatEvent(e) {
    return String(e.rawGroup) +
        " → main " + e.main +
        " / " + e.pot +
        " @ " + formatDateTime(e.time);
}

function prunePotEvents(arr, ts) {
    const cutoff = ts - POT_WINDOW_MS;
    return (arr || []).filter(e => e && e.time >= cutoff);
}

function upsertPotMain(arr, event) {
    const next = (arr || []).filter(e => e.main !== event.main);
    next.push(event);
    next.sort((a, b) => a.time - b.time);
    return next;
}

function getPotDetectorStore(key) {
    if (!mamamiaHashMemory[key] || typeof mamamiaHashMemory[key] !== "object") {
        mamamiaHashMemory[key] = {};
    }

    return mamamiaHashMemory[key];
}

// ==========================================================
//  BABABIA (POT SAME-POT DETECTOR)
//  Condition:
//    - Normal ecosystem only
//    - Same symbol
//    - Main group only, subgroup ignored
//    - Any 2 DIFFERENT main groups from SAME pot
//    - Within 5 minutes
//  Bot 2
// ==========================================================

let mamamiaHashMemory = persisted.mamamiaHashMemory || {};

function processBababia(symbol, group, ts) {

    if (!symbol || !group) return;

    const info = getPotInfo(group);
    if (!info) return;

    const store = getPotDetectorStore("__BABABIA_POT_STATE__");

    if (!store[symbol]) {
        store[symbol] = {
            "POT 1": [],
            "POT 2": []
        };
    }

    const event = {
        rawGroup: group,
        main: info.main,
        pot: info.pot,
        time: ts
    };

    let buf = prunePotEvents(store[symbol][info.pot] || [], ts);

    // Need a DIFFERENT main group from the SAME pot inside 5 minutes.
    const match = [...buf]
        .filter(e => e.main !== event.main)
        .sort((a, b) => b.time - a.time)[0];

    if (match) {

        const bababiaStructuredMatch = findStructuredGroupMatch([match.rawGroup, event.rawGroup]);

        if (!bababiaStructuredMatch) {
            store[symbol][info.pot] = upsertPotMain(buf, event);
            saveState();
            return;
        }

        const first = match.time <= event.time ? match : event;
        const second = match.time <= event.time ? event : match;

        const gapMs = second.time - first.time;
        const gapMin = Math.floor(gapMs / 60000);
        const gapSec = Math.floor((gapMs % 60000) / 1000);

        sendToTelegram2(
            "🎉 BABABIA\n" +
            "Type: Same-pot main-group match\n" +
            "Symbol: " + symbol + "\n" +
            "Pot: " + info.pot + "\n" +
            "Window: 5 minutes\n" +
            "Structure: " + bababiaStructuredMatch.label + "\n\n" +
            "1) " + potFormatEvent(first) + "\n" +
            "2) " + potFormatEvent(second) + "\n" +
            "Gap: " + gapMin + "m " + gapSec + "s"
        );

        // Reset this symbol+pot cluster, keep current event as new seed.
        store[symbol][info.pot] = [event];
        saveState();
        return;
    }

    store[symbol][info.pot] = upsertPotMain(buf, event);

    // Safety cleanup.
    if (Object.keys(store).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(store)) {
            for (const pot of ["POT 1", "POT 2"]) {
                store[sym][pot] = (store[sym][pot] || []).filter(e => e.time >= pruneCutoff);
            }

            if (!store[sym]["POT 1"].length && !store[sym]["POT 2"].length) {
                delete store[sym];
            }
        }
    }

    saveState();
}

// ==========================================================
//  MAMAMIA (POT CROSS-POT DETECTOR)
//  Condition:
//    - Normal ecosystem only
//    - Same symbol
//    - Main group only, subgroup ignored
//    - One main group from POT 1 and one main group from POT 2
//    - Within 5 minutes
//  Bot 2
// ==========================================================

function processMAMAMIA(symbol, group, ts) {

    if (!symbol || !group) return;

    const info = getPotInfo(group);
    if (!info) return;

    const store = getPotDetectorStore("__MAMAMIA_POT_STATE__");

    if (!store[symbol]) {
        store[symbol] = {
            "POT 1": [],
            "POT 2": []
        };
    }

    const event = {
        rawGroup: group,
        main: info.main,
        pot: info.pot,
        time: ts
    };

    const otherPot = info.pot === "POT 1" ? "POT 2" : "POT 1";

    store[symbol]["POT 1"] = prunePotEvents(store[symbol]["POT 1"] || [], ts);
    store[symbol]["POT 2"] = prunePotEvents(store[symbol]["POT 2"] || [], ts);

    const match = [...store[symbol][otherPot]]
        .sort((a, b) => b.time - a.time)[0];

    if (match) {
        const first = match.time <= event.time ? match : event;
        const second = match.time <= event.time ? event : match;

        const gapMs = second.time - first.time;
        const gapMin = Math.floor(gapMs / 60000);
        const gapSec = Math.floor((gapMs % 60000) / 1000);

        sendToTelegram2(
            "🎶 MAMAMIA\n" +
            "Type: Cross-pot main-group match\n" +
            "Symbol: " + symbol + "\n" +
            "Condition: POT 1 + POT 2 within 5 minutes\n\n" +
            "1) " + potFormatEvent(first) + "\n" +
            "2) " + potFormatEvent(second) + "\n" +
            "Gap: " + gapMin + "m " + gapSec + "s"
        );

        // Reset this symbol cluster, keep current event as new seed only.
        store[symbol] = {
            "POT 1": [],
            "POT 2": []
        };

        store[symbol][info.pot] = [event];

        saveState();
        return;
    }

    store[symbol][info.pot] = upsertPotMain(store[symbol][info.pot], event);

    // Safety cleanup.
    if (Object.keys(store).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(store)) {
            for (const pot of ["POT 1", "POT 2"]) {
                store[sym][pot] = (store[sym][pot] || []).filter(e => e.time >= pruneCutoff);
            }

            if (!store[sym]["POT 1"].length && !store[sym]["POT 2"].length) {
                delete store[sym];
            }
        }
    }

    saveState();
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

    sendToTelegram1(msg);
}

// ==========================================================
//  SALSA RANGE ENGINE
//  Condition:
//    - Same symbol
//    - Exact same group/subgroup
//    - 3 hits with span >=3m and <10m
//    - Family independent: all families/groups are watched
//    - Output controlled by INAUGURAL_03_TO_09 two-slot filter
//  Bot 5
// ==========================================================

const SALSA_MIN_SPAN_MS = 3 * 60 * 1000;
const SALSA_MAX_SPAN_MS = (10 * 60 * 1000) - 1;

// salsaMemory[symbol][group] = [timestamps]
let salsaMemory = persisted.salsaMemory || {};

function processSalsa(symbol, group, ts) {
    processRangeRepeatEngine(
        {
            source: "SALSA",
            emoji: "💃",
            alertName: "INAUGURAL_03_TO_09",
            rangeLabel: "3m to 9m 59s",
            minSpanMs: SALSA_MIN_SPAN_MS,
            maxSpanMs: SALSA_MAX_SPAN_MS,
            memory: salsaMemory
        },
        symbol,
        group,
        ts
    );
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
//  NEPTUNE RANGE ENGINE
//  Condition:
//    - Same symbol
//    - Exact same group/subgroup
//    - 3 hits with span >=15m and <=35m
//    - Family independent: all families/groups are watched
//    - Output controlled by INAUGURAL_15_TO_60 two-slot filter
//  Bot 5
// ==========================================================

const NEPTUNE_MIN_SPAN_MS = 15 * 60 * 1000;
const NEPTUNE_MAX_SPAN_MS = 35 * 60 * 1000;

// neptuneMemory[symbol][group] = [timestamps]
let neptuneMemory = persisted.neptuneMemory || {};

function processNeptune(symbol, group, ts) {
    processRangeRepeatEngine(
        {
            source: "NEPTUNE",
            emoji: "🌊",
            alertName: "INAUGURAL_15_TO_60",
            rangeLabel: "15m to 35m",
            minSpanMs: NEPTUNE_MIN_SPAN_MS,
            maxSpanMs: NEPTUNE_MAX_SPAN_MS,
            memory: neptuneMemory
        },
        symbol,
        group,
        ts
    );
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

        const zuluStructuredMatch = findStructuredGroupMatch([first.group, group]);

        if (!zuluStructuredMatch) {
            return;
        }

        const diffMin = Math.floor(diffMs / 60000);
        const diffSec = Math.floor((diffMs % 60000) / 1000);

        sendToTelegram4(
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
const MAMBA_FIRST_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

// mambaMemory[symbol][family] = { group, time }
let mambaMemory = persisted.mambaMemory || {};

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

        const mambaStructuredMatch = findStructuredGroupMatch([lastSeen.group, group]);

        if (!mambaStructuredMatch) {
            mambaMemory[symbol][family] = {
                group,
                time: ts
            };
            return;
        }

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
                `Structure: ${mambaStructuredMatch.label}\n` +
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
            
            repeatWindowMs: COMBO_REPEAT_WINDOW_SPESH_COBRA_MS,
            repeatLabel: "16m",isValidGroup: isComboNumberLetter
        },
        symbol,
        group,
        ts
    );
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

function processCabal(symbol, group, ts) {
    // CABAL is now driven by SPESH/COBRA repeat events inside processComboRepeatEngine.
    // This route hook is intentionally kept as a no-op so CABAL can remain enabled safely.
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
let boomMemory = persisted.boomMemory || {};

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
//  YABA (Family cross detector — 3 distinct subgroups)
//  Condition:
//    - Same symbol
//    - SAME family, e.g. 16A/16B/16C => family 16
//    - 3 DISTINCT subgroups
//    - Within 90 seconds
//  Bot 9
// ==========================================================

const YABA_WINDOW_MS = 90 * 1000; // 90 seconds
const YABA_MIN_DISTINCT = 3;

// yabaMemory[symbol][family] = [{ group, time }]
let yabaMemory = persisted.yabaMemory || {};

function processYaba(symbol, group, ts) {

    if (!symbol || !group) return;

    const family = getFamily(group);
    if (!family) return;

    if (!yabaMemory[symbol]) {
        yabaMemory[symbol] = {};
    }

    if (!yabaMemory[symbol][family]) {
        yabaMemory[symbol][family] = [];
    }

    let buf = yabaMemory[symbol][family];

    // Keep only last 90 seconds
    const cutoff = ts - YABA_WINDOW_MS;
    buf = buf.filter(e => e.time >= cutoff);

    // Keep distinct subgroups. If same subgroup repeats, refresh timestamp.
    const existingIndex = buf.findIndex(e => e.group === group);

    if (existingIndex !== -1) {
        buf[existingIndex] = {
            group,
            time: ts
        };
    } else {
        buf.push({
            group,
            time: ts
        });
    }

    buf.sort((a, b) => a.time - b.time);
    yabaMemory[symbol][family] = buf;

    // Need 3 distinct subgroups inside 90 seconds
    if (buf.length >= YABA_MIN_DISTINCT) {

        const picked = buf.slice(-YABA_MIN_DISTINCT);

        const firstTime = picked[0].time;
        const lastTime = picked[picked.length - 1].time;

        const diffMs = lastTime - firstTime;
        const diffSec = Math.floor(diffMs / 1000);

        const groupSequence = picked.map(e => e.group).join(" → ");

        const lines = picked
            .map((e, i) =>
                `${i + 1}) ${e.group} @ ${formatDateTime(e.time)}`
            )
            .join("\n");

        sendToTelegram9(
            `🟢 YABA\n` +
            `Symbol: ${symbol}\n` +
            `Family: ${family}\n` +
            `Subgroups: ${groupSequence}\n` +
            `Window: ${diffSec}s / 90s\n\n` +
            `Times:\n${lines}`
        );
        // activateBazooka(symbol, "YABA", ts, groupSequence); // BAZOOKA disabled temporarily

        // Reset after firing to avoid spam from 4th/5th subgroup
        delete yabaMemory[symbol][family];
        return;
    }

    // Safety cleanup
    if (Object.keys(yabaMemory).length > 5000) {
        const pruneCutoff = ts - (2 * 60 * 60 * 1000);

        for (const sym of Object.keys(yabaMemory)) {
            const families = yabaMemory[sym];

            for (const fam of Object.keys(families)) {
                families[fam] = families[fam].filter(e => e.time >= pruneCutoff);

                if (!families[fam].length) {
                    delete families[fam];
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

            const mintaStructuredMatch = findStructuredGroupMatch(
                    events.map(e => e.group)
                );

            if (events.length >= MINTA_MIN_COUNT && mintaStructuredMatch) {

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
                    `Structure: ${mintaStructuredMatch.label}\n` +
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

    const repeatWindowMs = Number(cfg.repeatWindowMs || COMBO_REPEAT_WINDOW_MS);
    const repeatLabel = cfg.repeatLabel || "2h";

    const repeated = [];

    for (const subset of liveSubsets) {
        const key = comboKeyFromGroups(subset);
        const previous = cfg.state[symbol][key];

        if (!previous) continue;

        const previousTime = typeof previous === "number" ? previous : previous.time;
        const gapMs = ts - previousTime;

        const isNotSameLiveCluster = gapMs > COMBO_BUILD_WINDOW_MS;
        const isWithinRepeatWindow = gapMs <= repeatWindowMs;
        const notAlreadyFiredInCluster = !rt.firedCombos[key];

        if (isNotSameLiveCluster && isWithinRepeatWindow && notAlreadyFiredInCluster) {
            repeated.push({
                key,
                groups: subset,
                previousTime,
                gapMs
            });

            rt.firedCombos[key] = true;
        }
    }

    const needsStructuredComboFilter =
        cfg.name === "SPESH" ||
        cfg.name === "COBRA";

    const comboStructuredMatch = needsStructuredComboFilter
        ? findStructuredGroupMatch(liveGroups)
        : null;

    if (repeated.length && (!needsStructuredComboFilter || comboStructuredMatch)) {

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
            `Structure: ${comboStructuredMatch ? comboStructuredMatch.label : "n/a"}\n` +
            `Matched Combos: ${repeated.length}\n` +
            `Window: repeat within ${repeatLabel} after 20s cluster\n\n` +
            lines
        );
        registerCabalFromComboRepeat(cfg, symbol, ts, liveGroups, repeated);
    }

    // Store/refresh ALL subset combos from this live cluster.
    for (const subset of liveSubsets) {
        const key = comboKeyFromGroups(subset);

        cfg.state[symbol][key] = ts;
    }

    pruneComboState(cfg.state, ts, repeatWindowMs);
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
            
            repeatWindowMs: COMBO_REPEAT_WINDOW_SPESH_COBRA_MS,
            repeatLabel: "16m",isValidGroup: g => isComboSingleLetter(g) || isComboNumberLetter(g)
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
let zoneforgeMemory = persisted.zoneforgeMemory || {};

// zoneforgeLastFire[symbol][bias] = { tier, time }
let zoneforgeLastFire = persisted.zoneforgeLastFire || {};

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
let anchorforgeMemory = persisted.anchorforgeMemory || {};

// anchorforgeLastFire[symbol][bias] = { tier, time }
let anchorforgeLastFire = persisted.anchorforgeLastFire || {};

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
let peterforgeMemory = persisted.peterforgeMemory || {};
let peterforgeLastFire = persisted.peterforgeLastFire || {};

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

        const previousTime = typeof previous === "number" ? previous : previous.time;
        const gapMs = ts - previousTime;
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
//  SOURCE RANGE ENGINES + INAUGURAL FILTER (PERSISTENT)
//  Source engines:
//    - SALSA   = 3m to 9m 59s
//    - GAMMA   = 10m to 14m 59s
//    - NEPTUNE = 15m to 35m
//
//  Critical behaviour:
//    - SALSA / GAMMA / NEPTUNE fire to Bot 5 PER EXACT GROUP.
//    - Example: UNIUSDT 26E and UNIUSDT 26Y can both fire.
//    - INAUGURAL is only a separate Bot 1 filter layer.
// ==========================================================

let inauguralState = persisted.inauguralState || {};

const INAUGURAL_RANGE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const INAUGURAL_RANGE_MAX_SLOTS = 2;
const RANGE_REPEAT_MIN_HITS = 3;

function rangeFamilyFromGroup(group) {
    return getFamily(group);
}

function processRangeRepeatEngine(cfg, symbol, group, ts) {

    if (!symbol || !group) return;

    const memory = cfg.memory;

    if (!memory[symbol]) {
        memory[symbol] = {};
    }

    if (!memory[symbol][group]) {
        memory[symbol][group] = [];
    }

    // Add current hit to THIS source engine memory.
    // SALSA, GAMMA, and NEPTUNE each have separate memory objects.
    memory[symbol][group].push(ts);

    const cutoff = ts - cfg.maxSpanMs - (60 * 1000);

    let clean = memory[symbol][group]
        .filter(t => typeof t === "number" && t >= cutoff)
        .sort((a, b) => a - b);

    clean = [...new Set(clean)];
    memory[symbol][group] = clean;

    const picked = findRangeTripletEndingAtCurrent(
        clean,
        cfg.minSpanMs,
        cfg.maxSpanMs
    );

    if (!picked) return;

    const firstTime = picked[0];
    const lastTime = picked[picked.length - 1];
    const spanMs = lastTime - firstTime;

    // 1) ALWAYS send the raw source engine alert to Bot 5.
    // This is the old NEPTUNE-style behaviour: per symbol + exact group.
    sendRangeSourceAlert(
        cfg,
        symbol,
        group,
        picked,
        spanMs
    );

    // 2) Run INAUGURAL separately on Bot 1.
    const result = recordInauguralRangeAlert(
        cfg,
        symbol,
        group,
        ts,
        picked,
        spanMs
    );

    if (!result || !result.fired) {
        console.log(
            "INAUGURAL range matched but blocked:",
            cfg.alertName,
            "symbol:", symbol,
            "group:", group,
            "reason:", result?.reason || "unknown"
        );
    }

    // IMPORTANT:
    // Reset only this exact group for THIS source engine after source alert.
    // This preserves old NEPTUNE behaviour and prevents 4th/5th-hit spam.
    // It does NOT affect other groups like 26E vs 26Y.
    // It also does NOT affect other source engines because their memories are separate.
    delete memory[symbol][group];

    saveState();
}

function findRangeTripletEndingAtCurrent(buf, minSpanMs, maxSpanMs) {

    if (!Array.isArray(buf) || buf.length < RANGE_REPEAT_MIN_HITS) {
        return null;
    }

    const lastIndex = buf.length - 1;
    const lastTime = buf[lastIndex];

    // The newest/current hit must complete the 3-hit pattern.
    for (let i = 0; i <= lastIndex - 2; i++) {

        const firstTime = buf[i];
        const spanMs = lastTime - firstTime;

        if (spanMs > maxSpanMs) {
            continue;
        }

        if (spanMs < minSpanMs) {
            break;
        }

        // Any middle hit between first and current is enough.
        const middleTime = buf
            .slice(i + 1, lastIndex)
            .find(t => t > firstTime && t < lastTime);

        if (!middleTime) continue;

        return [firstTime, middleTime, lastTime];
    }

    return null;
}

function sendRangeSourceAlert(cfg, symbol, group, hitTimes, spanMs) {

    const family = rangeFamilyFromGroup(group);
    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    const hitLines = hitTimes
        .map((t, i) => (i + 1) + ") " + formatDateTime(t))
        .join("\n");

    sendToTelegram5(
        cfg.emoji + " " + cfg.source + "\n" +
        "Symbol: " + symbol + "\n" +
        "Group: " + group + "\n" +
        "Family: " + family + "\n" +
        "Hits: 3\n" +
        "Range: " + cfg.rangeLabel + "\n" +
        "Span: " + spanMin + "m " + spanSec + "s\n" +
        "Window: " + cfg.rangeLabel + "\n\n" +
        "Times:\n" + hitLines
    );
}

function recordInauguralRangeAlert(cfg, symbol, group, ts, hitTimes, spanMs) {

    if (!inauguralState || typeof inauguralState !== "object") {
        inauguralState = {};
    }

    if (!inauguralState[cfg.alertName] || typeof inauguralState[cfg.alertName] !== "object") {
        inauguralState[cfg.alertName] = {};
    }

    const family = rangeFamilyFromGroup(group);
    const current = inauguralState[cfg.alertName][symbol];

    const invalidOldFormat =
        current &&
        (
            typeof current.windowStart !== "number" ||
            !Array.isArray(current.slots)
        );

    if (
        !current ||
        invalidOldFormat ||
        (ts - current.windowStart >= INAUGURAL_RANGE_WINDOW_MS)
    ) {
        inauguralState[cfg.alertName][symbol] = {
            windowStart: ts,
            slots: []
        };
    }

    const state = inauguralState[cfg.alertName][symbol];

    if (state.slots.some(e => e.family === family)) {
        return {
            fired: false,
            reason: "same family already used in this 2h window"
        };
    }

    if (state.slots.length >= INAUGURAL_RANGE_MAX_SLOTS) {
        return {
            fired: false,
            reason: "2 slots already used in this 2h window"
        };
    }

    state.slots.push({
        source: cfg.source,
        family,
        group,
        time: ts
    });

    const slot = state.slots.length;
    const spanMin = Math.floor(spanMs / 60000);
    const spanSec = Math.floor((spanMs % 60000) / 1000);

    const hitLines = hitTimes
        .map((t, i) => (i + 1) + ") " + formatDateTime(t))
        .join("\n");

    const priorSlots = state.slots
        .map((e, i) =>
            (i + 1) +
            ") Family " + e.family +
            " | Group " + e.group +
            " | " + formatDateTime(e.time)
        )
        .join("\n");

    sendToTelegram1(
        "🎖 " + cfg.alertName + "\n" +
        "Source: " + cfg.source + "\n" +
        "Symbol: " + symbol + "\n" +
        "Group: " + group + "\n" +
        "Family: " + family + "\n" +
        "Slot: " + slot + "/" + INAUGURAL_RANGE_MAX_SLOTS + "\n" +
        "Rule: First 2 different families in 2 hours\n" +
        "Range: " + cfg.rangeLabel + "\n" +
        "Span: " + spanMin + "m " + spanSec + "s\n" +
        "Window Start: " + formatDateTime(state.windowStart) + "\n\n" +
        "3 Hits:\n" + hitLines + "\n\n" +
        "Slots Used:\n" + priorSlots
    );

    saveState();

    return {
        fired: true,
        reason: "sent",
        slot
    };
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
            // processFirst(symbol, group, ts); // disabled temporarily
            // processInaugural(symbol, group, ts); // disabled: now range-engine driven
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
        // processTango(symbol, group, ts); // disabled temporarily
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
        processMAMAMIA(symbol, group, ts);
        processZoneforge(symbol, group, ts, body);
        // processAnchorforge(symbol, group, ts, body); // disabled temporarily for CABAL Bot3
        //processWakanda(symbol, group, ts, body);
        processJupiter(symbol, group, ts);
    }

    processPeterforge(symbol, group, ts, body);

} else {
    // 🔴 HASH ECOSYSTEM (isolated)

    recordHashEvent(symbol, group, ts);

    processGodzilla(symbol, group, ts);
    // if (typeof processBazooka === "function") {
    //     processBazooka(symbol, group, ts);
    // } // disabled temporarily
    // processWakanda(symbol, group, ts); // disabled temporarily

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
