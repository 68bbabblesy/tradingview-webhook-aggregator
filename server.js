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
// -----------------------------
// BODY PARSING (TradingView-tolerant)
// -----------------------------
// TradingView only sends "application/json" when the alert message is valid
// JSON. Messages like  "levels":["1H":"0.92","2H":"0.55"]  are NOT valid JSON
// (key:value pairs inside [ ]), so TradingView sends them as plain text and a
// plain express.json() would leave the body empty -> every bot ignores it.
// We read every body as text and parse it ourselves, repairing that pattern.

function repairTradingViewJson(text) {
    // ["1H":"0.92","2H":"0.55"]  ->  {"1H":"0.92","2H":"0.55"}
    return text.replace(
        /\[((?:\s*"[^"]*"\s*:\s*(?:"[^"]*"|-?[\d.]+(?:[eE][-+]?\d+)?|true|false|null)\s*,?)+)\]/g,
        "{$1}"
    );
}

function parseAlertBody(raw) {
    const text = String(raw || "").trim();
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {}

    try {
        return JSON.parse(repairTradingViewJson(text));
    } catch {}

    return null;
}

app.use(express.text({ type: () => true, limit: "1mb" }));

app.use((req, res, next) => {
    if (typeof req.body !== "string") {
        req.body = req.body && typeof req.body === "object" ? req.body : {};
        return next();
    }

    const parsed = parseAlertBody(req.body);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        req.body = parsed;
    } else {
        console.warn("⚠️ Unreadable alert body (not JSON):", req.body.slice(0, 300));
        req.body = {};
    }

    next();
});

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
                breadthState: parsed.breadthState || { events: [], lastFire: 0, lastLevel: 0 },
                censusState: parsed.censusState || { zones: {}, lastFire: 0, lastShare: 0 },
                neptuneMemory: parsed.neptuneMemory || {},
                zuluState: parsed.zuluState || {},
                sideFlipMemory: parsed.sideFlipMemory || {},
                mambaMemory: parsed.mambaMemory || {},
                boomMemory: parsed.boomMemory || {},
                jupiterState: parsed.jupiterState || {},
                yabaMemory: parsed.yabaMemory || {},
                zebraMemory: parsed.zebraMemory || {},
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
        breadthState: { events: [], lastFire: 0, lastLevel: 0 },
        censusState: { zones: {}, lastFire: 0, lastShare: 0 },
        neptuneMemory: {},
        zuluState: {},
        sideFlipMemory: {},
        mambaMemory: {},
        boomMemory: {},
        jupiterState: {},
        yabaMemory: {},
        zebraMemory: {},
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
        breadthState,
        censusState,
        neptuneMemory,
        zuluState,
        sideFlipMemory,
        mambaMemory,
        boomMemory,
        jupiterState,
        yabaMemory,
        zebraMemory,
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
    pruneCobraRepeatState(cobraComboState, ts, 30 * 60 * 1000);

    // Keep the breadth window small.
    try { breadthPrune(ts); } catch {}
    try { censusPrune(ts); } catch {}

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


function pruneCobraRepeatState(state, ts, windowMs = 30 * 60 * 1000) {
    if (!state || typeof state !== "object") return;

    const cutoff = ts - windowMs - (5 * 60 * 1000);

    for (const sym of Object.keys(state)) {
        const st = state[sym];

        if (!st || typeof st !== "object" || Array.isArray(st) || !Array.isArray(st.events)) {
            delete state[sym];
            continue;
        }

        st.events = st.events.filter(e =>
            e &&
            typeof e.time === "number" &&
            e.time >= cutoff &&
            e.group
        );

        if (!st.events.length) {
            delete state[sym];
            continue;
        }

        if (typeof st.lastSentKey !== "string") {
            st.lastSentKey = "";
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

// Telegram HTML helpers (used by bots that send formatted messages).
function tgEscape(v) {
    return String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function tgStripHtml(text) {
    return String(text ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

function enqueueTelegram(botNo, text, opts = {}) {
    const { token, chat } = getTelegramCreds(botNo);

    if (!token || !chat) {
        console.error(`⚠️ Bot${botNo} send skipped: missing token/chat env`);
        return;
    }

    const now = Date.now();

    // Formatted (HTML) messages are sent whole. If one is ever too long to send
    // in one piece, it falls back to plain text so splitting can't break the tags.
    let parseMode = null;
    let parts;

    if (opts.html && String(text).length <= TELEGRAM_SAFE_MESSAGE_LEN) {
        parseMode = "HTML";
        parts = [String(text)];
    } else {
        parts = splitTelegramMessage(opts.html ? tgStripHtml(text) : text);
    }

    for (const part of parts) {
        telegramOutbox.push({
            id: `${now}-${botNo}-${Math.random().toString(36).slice(2)}`,
            botNo,
            text: String(part ?? ""),
            parseMode,
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

async function rawTelegramSend(botNo, text, parseMode = null) {
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
                text,
                ...(parseMode ? { parse_mode: parseMode } : {})
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
                await rawTelegramSend(item.botNo, item.text, item.parseMode || null);

                telegramOutbox.splice(idx, 1);
                requestTelegramOutboxSave();

                console.log(`✅ Telegram outbox sent: Bot${item.botNo} | remaining=${telegramOutbox.length}`);

            } catch (err) {
                item.attempts = Number(item.attempts || 0) + 1;
                item.lastError = telegramErrorSummary(err);

                console.error(
                    `⚠️ Telegram send failed: Bot${item.botNo} | attempt=${item.attempts}/${TELEGRAM_MAX_ATTEMPTS} | ${item.lastError}`
                );

                if (err.status === 400 && item.parseMode) {
                    // Telegram didn't like the formatting: send the same message as plain text.
                    console.error(`⚠️ Telegram formatting rejected: Bot${item.botNo} | resending as plain text`);
                    item.text = tgStripHtml(item.text);
                    item.parseMode = null;
                    item.nextAttemptAt = Date.now();

                } else if (err.status === 400) {
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

/* ─────────────────────────────────────────────────────────────────────────────
   Bot 2 is now the BREADTH bot only. Bundle / Zebra / Dollar used to notify here
   and are disabled at your request. Their message-building code is untouched —
   it just goes to a sink instead of Telegram. To bring any of them back, swap
   sendToTelegram2Disabled(...) back to sendToTelegram2(...) at the call site.
───────────────────────────────────────────────────────────────────────────── */
const BOT2_LEGACY_ENABLED = (process.env.BOT2_LEGACY_ENABLED || "0").trim() === "1";
function sendToTelegram2Disabled(text) {
    if (BOT2_LEGACY_ENABLED) { sendToTelegram2(text); return; }
    // swallowed on purpose
}

function sendToTelegram3(text) { enqueueTelegram(3, text); }
function sendToTelegram3Html(text) { enqueueTelegram(3, text, { html: true }); }
function sendToTelegram4(text) { enqueueTelegram(4, text); }
function sendToTelegram5(text) { enqueueTelegram(5, text); }
function sendToTelegram5Html(text) { enqueueTelegram(5, text, { html: true }); }
function sendToTelegram5Disabled(text) { return; } // Bot 5 is reserved for NEPTUNE
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
//  💥 BAZOOKA — FULL-MATCH ALERT + TRAIL          -> Bot 4
//
//  Only these groups, and only when EVERY level matched
//  (matched_count === enabled_count):
//
//    17G  my.golden.pocket          18 of 18
//    62H  EARLY 0.5 RET to 0.883    18 of 18
//    44U  KOSOKO 0.618              4 of 4
//
//  Anything less (17 of 18, 3 of 4 ...) is ignored.
//
//  One message per full match: the alert details on top, and
//  underneath the trail of every full match for that symbol +
//  group so far, e.g. 1) 04:07  2) 04:11  3) 05:30 <- new
//
//  The trail starts fresh after BAZOOKA_TRAIL_RESET_HOURS
//  (default 24) with no new full match for that symbol + group.
//  The same bar arriving twice (e.g. BINANCE + OKX) counts once.
//
//  Optional Render settings (no need to set them):
//    BAZOOKA_GROUPS             default "17G,62H,44U"
//    BAZOOKA_TRAIL_RESET_HOURS  default 24
// ==========================================================

const BAZOOKA_GROUPS = new Set(
    (process.env.BAZOOKA_GROUPS || "17G,62H,44U")
        .split(",")
        .map(g => g.trim().toUpperCase())
        .filter(Boolean)
);

const BAZOOKA_TRAIL_RESET_MS =
    (Number(process.env.BAZOOKA_TRAIL_RESET_HOURS) || 24) * 60 * 60 * 1000;

const BAZOOKA_STATE_VERSION = 4;

// 🎯 FOCUS MODE: only BREADTH + CENSUS (Bot2), BLACKPANTHER (Bot3), BAZOOKA (Bot4), NEPTUNE (Bot5) and COBRA (Bot7) run.
// Every other bot is paused. Set FOCUS_MODE=0 on Render to run every bot again.
const FOCUS_MODE = (process.env.FOCUS_MODE || "1").trim() !== "0";
const BAZOOKA_MAX_TRAIL = 200;   // stored per symbol + group
const BAZOOKA_MAX_LINES = 25;    // shown in one Telegram message

let bazookaState = persisted.bazookaState || {};

// Drop anything saved by older BAZOOKA versions.
for (const key of Object.keys(bazookaState)) {
    const st = bazookaState[key];
    if (!st || st.v !== BAZOOKA_STATE_VERSION || !Array.isArray(st.trail)) delete bazookaState[key];
}

console.log("💥 BAZOOKA LOADED — Bot4 alert + trail | full match only | groups: " + [...BAZOOKA_GROUPS].join(", "));
console.log(FOCUS_MODE ? "🎯 FOCUS MODE: running Bot2 BREADTH+CENSUS, Bot3 BLACKPANTHER, Bot4 BAZOOKA, Bot5 NEPTUNE, Bot7 COBRA — all other bots paused" : "▶️ All bots active (FOCUS_MODE=0)");

function bazookaNum(v) {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
}

function bazookaTime(ts) {
    return new Date(ts).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function bazookaGap(ms) {
    const safe = Math.max(0, ms);
    const totalMin = Math.floor(safe / 60000);
    const h = Math.floor(totalMin / 60);
    if (h > 0) return h + "h " + (totalMin % 60) + "m";
    return totalMin + "m " + Math.floor((safe % 60000) / 1000) + "s";
}

function bazookaPct(from, to) {
    if (!from || !to) return "";
    const pct = ((to - from) / from) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function processBazooka(symbol, group, ts, body = {}) {
    if (!symbol || !group) return;

    const rawGroup = String(group).trim().toUpperCase();
    if (!BAZOOKA_GROUPS.has(rawGroup)) return;

    const matched = bazookaNum(body.matched_count);
    const enabled = bazookaNum(body.enabled_count);
    if (!enabled || matched !== enabled) return;   // full match only

    const key = symbol + "|" + rawGroup;
    let state = bazookaState[key];

    // Fresh trail if none yet, or it went quiet for too long.
    if (
        !state ||
        !state.trail.length ||
        ts - state.trail[state.trail.length - 1].time > BAZOOKA_TRAIL_RESET_MS
    ) {
        state = bazookaState[key] = { v: BAZOOKA_STATE_VERSION, trail: [] };
    }

    const barTime = bazookaNum(body.time) || ts;
    if (state.trail.some(e => e.barTime === barTime)) return;   // duplicate copy

    const current = { time: ts, barTime, price: bazookaNum(body.price ?? body.close) };
    state.trail.push(current);

    if (state.trail.length > BAZOOKA_MAX_TRAIL) {
        state.trail = state.trail.slice(-BAZOOKA_MAX_TRAIL);
    }

    const trail = state.trail;
    const first = trail[0];
    const shown = trail.slice(-BAZOOKA_MAX_LINES);
    const hidden = trail.length - shown.length;

    const lines = shown.map((e, i) => {
        const n = hidden + i + 1;
        const prev = trail[n - 2];
        let line = n + ") " + bazookaTime(e.time) + " | Price " + (e.price ?? "n/a");

        if (prev) line += " | +" + bazookaGap(e.time - prev.time);

        const pct = n > 1 ? bazookaPct(first.price, e.price) : "";
        if (pct) line += " | " + pct + " vs #1";

        if (e === current && trail.length > 1) line += "  ⬅️ new";
        return line;
    });

    if (hidden > 0) lines.unshift("… " + hidden + " earlier alert(s) not shown");

    const band =
        body.band_top !== undefined && body.band_bottom !== undefined
            ? body.band_top + " – " + body.band_bottom
            : "n/a";

    sendToTelegram4(
        "💥 BAZOOKA\n" +
        "Symbol: " + symbol + "\n" +
        "Group: " + rawGroup + " (" + matched + " of " + enabled + ")\n" +
        "Band: " + band + "\n" +
        "Price: " + (current.price ?? "n/a") + "\n" +
        "Time: " + bazookaTime(ts) + "\n\n" +
        "Trail (" + trail.length + " alert" + (trail.length > 1 ? "s over " + bazookaGap(current.time - first.time) : "") + "):\n" +
        lines.join("\n")
    );

    // Tidy up long-dead trails.
    if (Object.keys(bazookaState).length > 2000) {
        for (const k of Object.keys(bazookaState)) {
            const t = bazookaState[k]?.trail;
            if (!Array.isArray(t) || !t.length || ts - t[t.length - 1].time > BAZOOKA_TRAIL_RESET_MS) {
                delete bazookaState[k];
            }
        }
    }

    saveState();
}

// Old activation link kept dead for compatibility.
function activateBazooka(symbol, source, sourceTime, sourceGroup) {
    return;
}

// ==========================================================
//  WAKANDA DISABLED
//
//  Disabled by request.
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

let gammaMemory = persisted.gammaMemory || {};


// ==========================================================
//  🖤 BLACKPANTHER — ALERT + TRAIL, ALL GROUPS       -> Bot 3
//
//  Every alert whose group has at least one NUMBER and one
//  LETTER (17G, 44U, 62H, 91W, 35P, #12A ...). No match-count
//  filter: 13 of 18 counts just the same as 18 of 18.
//
//  Groups without both (e.g. "A", "#12", no group) are ignored,
//  which keeps BREADTH / CENSUS style payloads out.
//
//  One message per alert: the alert details on top, and the
//  trail of every alert for that symbol + group so far below.
//
//  The trail starts fresh after BLACKPANTHER_TRAIL_RESET_HOURS
//  (default 24) with no new alert for that symbol + group.
//  The same bar arriving twice (e.g. BINANCE + OKX) counts once.
//
//  Fully separate from BAZOOKA: own settings, helpers and memory.
// ==========================================================

const BLACKPANTHER_TRAIL_RESET_MS =
    (Number(process.env.BLACKPANTHER_TRAIL_RESET_HOURS) || 24) * 60 * 60 * 1000;

const BLACKPANTHER_STATE_VERSION = 2;
const BLACKPANTHER_MAX_TRAIL = 200;   // stored per symbol + group
const BLACKPANTHER_MAX_LINES = 25;    // shown in one Telegram message

let blackPantherMemory = persisted.blackPantherMemory || {};

// Drop anything saved by older BLACKPANTHER versions.
for (const key of Object.keys(blackPantherMemory)) {
    const st = blackPantherMemory[key];
    if (!st || st.v !== BLACKPANTHER_STATE_VERSION || !Array.isArray(st.trail)) delete blackPantherMemory[key];
}

console.log("🖤 BLACKPANTHER LOADED — Bot3 trail | every group with a number + letter");

function blackPantherGroupOk(group) {
    const g = String(group || "");
    return /[0-9]/.test(g) && /[A-Za-z]/.test(g);
}

function bpNum(v) {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
}

function bpHm(ts) {
    return new Date(ts).toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function bpDay(ts) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "numeric"
    }).formatToParts(new Date(ts));
    const day = parts.find(p => p.type === "day")?.value || "";
    const month = Number(parts.find(p => p.type === "month")?.value || 1);
    return day + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month - 1];
}

function bpGap(ms) {
    const safe = Math.max(0, ms);
    const totalMin = Math.floor(safe / 60000);
    const h = Math.floor(totalMin / 60);
    if (h > 0) return h + "h " + (totalMin % 60) + "m";
    return totalMin + "m " + Math.floor((safe % 60000) / 1000) + "s";
}

function bpPct(from, to) {
    if (!from || !to) return "";
    const pct = ((to - from) / from) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function processBlackPanther(symbol, group, ts, body = {}) {
    if (!symbol || !blackPantherGroupOk(group)) return;

    const rawGroup = String(group).trim().toUpperCase();
    const key = symbol + "|" + rawGroup;
    let state = blackPantherMemory[key];

    // Fresh trail if none yet, or it went quiet for too long.
    if (
        !state ||
        !state.trail.length ||
        ts - state.trail[state.trail.length - 1].time > BLACKPANTHER_TRAIL_RESET_MS
    ) {
        state = blackPantherMemory[key] = { v: BLACKPANTHER_STATE_VERSION, trail: [] };
    }

    const barTime = bpNum(body.time) || ts;
    if (state.trail.some(e => e.barTime === barTime)) return;   // duplicate copy

    const matched = bpNum(body.matched_count);
    const enabled = bpNum(body.enabled_count);

    const current = {
        time: ts,
        barTime,
        price: bpNum(body.price ?? body.close),
        match: matched !== null && enabled ? matched + "/" + enabled : ""
    };

    state.trail.push(current);

    if (state.trail.length > BLACKPANTHER_MAX_TRAIL) {
        state.trail = state.trail.slice(-BLACKPANTHER_MAX_TRAIL);
    }

    const trail = state.trail;
    const first = trail[0];
    const shown = trail.slice(-BLACKPANTHER_MAX_LINES);
    const hidden = trail.length - shown.length;

    // ---------- trail table ----------
    const rows = shown.map((e, i) => {
        const n = hidden + i + 1;
        return {
            n: String(n),
            time: bpHm(e.time),
            price: e.price === null || e.price === undefined ? "n/a" : String(e.price),
            chg: n === 1 ? "-" : (bpPct(first.price, e.price) || "-"),
            match: e.match || "-",
            day: bpDay(e.time),
            isNew: e === current && trail.length > 1
        };
    });

    const hasMatch = rows.some(r => r.match !== "-");
    const cols = [
        { key: "n", title: "#", right: true },
        { key: "time", title: "Time", right: false },
        { key: "price", title: "Price", right: true },
        { key: "chg", title: "Chg", right: true },
        ...(hasMatch ? [{ key: "match", title: "Match", right: true }] : [])
    ];

    for (const c of cols) {
        c.width = Math.max(c.title.length, ...rows.map(r => r[c.key].length));
    }

    const fmtRow = r => cols
        .map(c => c.right ? r[c.key].padStart(c.width) : r[c.key].padEnd(c.width))
        .join("  ")
        .trimEnd();

    const table = [fmtRow(Object.fromEntries(cols.map(c => [c.key, c.title])))];
    if (hidden > 0) table.push("… " + hidden + " earlier");

    rows.forEach((r, i) => {
        if (i > 0 && r.day !== rows[i - 1].day) table.push("── " + r.day + " ──");
        table.push(fmtRow(r) + (r.isNew ? "  ◀" : ""));
    });

    // ---------- header ----------
    const pctSinceFirst = trail.length > 1 ? bpPct(first.price, current.price) : "";

    let msg =
        "🖤 <b>BLACKPANTHER</b>\n" +
        "<b>" + tgEscape(symbol) + "</b>  ·  " + tgEscape(rawGroup) +
        (current.match ? "  ·  " + tgEscape(current.match) : "") + "\n" +
        "Price <b>" + tgEscape(current.price ?? "n/a") + "</b>" +
        (pctSinceFirst ? "  (" + tgEscape(pctSinceFirst) + " since #1)" : "") + "\n";

    if (body.band_top !== undefined && body.band_bottom !== undefined) {
        msg += "Band " + tgEscape(body.band_top) + " – " + tgEscape(body.band_bottom) + "\n";
    }

    msg +=
        "\n<pre>" + tgEscape(table.join("\n")) + "</pre>\n" +
        "<i>" +
        (trail.length > 1
            ? trail.length + " alerts over " + bpGap(current.time - first.time) + " · started " + bpDay(first.time) + " " + bpHm(first.time)
            : "First alert · " + bpDay(first.time) + " " + bpHm(first.time)) +
        "</i>";

    sendToTelegram3Html(msg);

    // Tidy up long-dead trails.
    if (Object.keys(blackPantherMemory).length > 3000) {
        for (const k of Object.keys(blackPantherMemory)) {
            const t = blackPantherMemory[k]?.trail;
            if (!Array.isArray(t) || !t.length || ts - t[t.length - 1].time > BLACKPANTHER_TRAIL_RESET_MS) {
                delete blackPantherMemory[k];
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
let breadthState = persisted.breadthState || { events: [], lastFire: 0, lastLevel: 0 };
let censusState = persisted.censusState || { zones: {}, lastFire: 0, lastShare: 0 };
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


/* ─────────────────────────────────────────────────────────────────────────────
   🌊 BREADTH  —  market-wide bias detector
   Individual alerts cannot tell you the market bias: each one looks the same
   whether the whole watchlist is falling or just that symbol. Breadth can,
   because it counts how many DISTINCT symbols are alerting at once.
   Normal is ~3 distinct symbols per 30 min. On 28 Sep 2026 it reached 64, with
   80% of them pullback-zone alerts — that was a market-wide decline in progress.
   Descriptive, not predictive: it tells you what IS happening, not what comes
   next. Sized to the whole watchlist, so it runs on EVERY incoming alert.
───────────────────────────────────────────────────────────────────────────── */
const BREADTH_ENABLED      = (process.env.BREADTH_ENABLED || "1").trim() !== "0";
const BREADTH_WINDOW_MS    = Number((process.env.BREADTH_WINDOW_MIN || "30").trim()) * 60 * 1000;
const BREADTH_THRESHOLD    = Number((process.env.BREADTH_THRESHOLD || "15").trim());
const BREADTH_STEP         = Number((process.env.BREADTH_STEP || "20").trim());
const BREADTH_COOLDOWN_MS  = Number((process.env.BREADTH_COOLDOWN_MIN || "20").trim()) * 60 * 1000;
const BREADTH_MAX_EVENTS   = 4000;

// Classify an alert by the ZONE ITS RANGE DEFINES, not by the levels it matched.
// The matched-level list contains whatever each timeframe happened to be on, which
// is noisy; the band edges / clause ranges are what the alert was actually asking for.
function breadthZone(body = {}) {
    const ranges = [
        body.band_top, body.band_bottom,
        body.clause_a_range, body.clause_b_range,
        body.a_range, body.b_range,
        body.deep_threshold, body.retracement_threshold
    ].map(v => (v === undefined || v === null) ? "" : String(v)).join(" ").toLowerCase();

    // "EXT x" and small ratios sit at the previous high; 0.35-1.05 is a pull back
    // into the range. A band spanning the high (e.g. 0.05 .. EXT 0.04) is zero-zone.
    const plain = [];
    const ext = [];
    const re = /(ext\s*)?(\d*\.?\d+)/g;
    let m;
    while ((m = re.exec(ranges)) !== null) {
        const n = Number(m[2]);
        if (!Number.isFinite(n)) continue;
        if (m[1]) ext.push(n); else plain.push(n);
    }

    const hasPullback = plain.some(n => n >= 0.35 && n <= 1.05);
    const nearHigh    = ext.length > 0 || plain.some(n => n <= 0.12);

    if (hasPullback && !nearHigh) return "pullback";
    if (nearHigh && !hasPullback) return "zero";
    if (nearHigh && hasPullback)  return "zero";   // band straddling the high
    return "other";
}

function breadthPrune(ts) {
    const cutoff = ts - BREADTH_WINDOW_MS;
    let arr = Array.isArray(breadthState.events) ? breadthState.events : [];
    arr = arr.filter(e => e && e.t >= cutoff);
    if (arr.length > BREADTH_MAX_EVENTS) arr = arr.slice(-BREADTH_MAX_EVENTS);
    breadthState.events = arr;
    return arr;
}


/* ─────────────────────────────────────────────────────────────────────────────
   🧭 CENSUS  —  live position of every watchlist symbol
   Fed by the CENSUS_REPORTER script on each symbol, which reports only when a
   symbol CHANGES zone. Unlike breadth (which counts setup alerts, and so only
   sees symbols that happened to fire) this is a true head count: we always know
   where every reporting symbol currently sits.
   Zones, by ratio from the reference timeframe's previous range:
     ABOVE (<0) · TOP (0-0.12) · MID (0.12-0.35) · PULLBACK (0.35-1) · BELOW (>1)
───────────────────────────────────────────────────────────────────────────── */
const CENSUS_ENABLED       = (process.env.CENSUS_ENABLED || "1").trim() !== "0";
const CENSUS_STALE_MS      = Number((process.env.CENSUS_STALE_HOURS || "12").trim()) * 60 * 60 * 1000;
const CENSUS_MIN_SYMBOLS   = Number((process.env.CENSUS_MIN_SYMBOLS || "20").trim());
const CENSUS_SHARE_TRIGGER = Number((process.env.CENSUS_SHARE || "0.6").trim());
const CENSUS_SHARE_STEP    = Number((process.env.CENSUS_SHARE_STEP || "0.15").trim());
const CENSUS_COOLDOWN_MS   = Number((process.env.CENSUS_COOLDOWN_MIN || "20").trim()) * 60 * 1000;
// After a restart the picture rebuilds one symbol at a time, so the first few reports can
// look like 100% of a tiny sample. Stay quiet until enough of the watchlist has checked in.
const CENSUS_WARMUP_MS     = Number((process.env.CENSUS_WARMUP_MIN || "20").trim()) * 60 * 1000;
const CENSUS_BOOT_TS       = Date.now();

function censusPrune(ts) {
    const z = censusState.zones || {};
    for (const s of Object.keys(z)) {
        if (!z[s] || (ts - (z[s].t || 0)) > CENSUS_STALE_MS) delete z[s];
    }
    censusState.zones = z;
    return z;
}

function censusIsReport(body = {}) {
    return String(body.condition || "").toLowerCase() === "census";
}

function processCensus(symbol, group, ts, body = {}) {
    if (!CENSUS_ENABLED || !symbol || !censusIsReport(body)) return true;

    if (!censusState || typeof censusState !== "object") {
        censusState = { zones: {}, lastFire: 0, lastShare: 0 };
    }
    if (!censusState.zones || typeof censusState.zones !== "object") censusState.zones = {};

    const zone = String(body.zone || "").toUpperCase();
    if (!zone) return true;
    censusState.zones[symbol] = { z: zone, t: ts, r: Number(body.ratio) };

    const z = censusPrune(ts);
    const symbols = Object.keys(z);
    const total = symbols.length;
    if (total < CENSUS_MIN_SYMBOLS) return true;
    if ((Date.now() - CENSUS_BOOT_TS) < CENSUS_WARMUP_MS) return true;

    const counts = { ABOVE: 0, TOP: 0, MID: 0, PULLBACK: 0, BELOW: 0 };
    for (const s of symbols) if (counts[z[s].z] !== undefined) counts[z[s].z]++;

    // Bearish share = pulled back or broken down. Bullish = at or above the high.
    const bear = (counts.PULLBACK + counts.BELOW) / total;
    const bull = (counts.ABOVE + counts.TOP) / total;
    const share = Math.max(bear, bull);
    const bias = bear >= bull ? "SELL-SIDE" : "BUY-SIDE";

    if (share < CENSUS_SHARE_TRIGGER) {
        if (share < CENSUS_SHARE_TRIGGER - 0.1) censusState.lastShare = 0;
        return true;
    }

    const cooled = (ts - (censusState.lastFire || 0)) >= CENSUS_COOLDOWN_MS;
    const grew = share >= (censusState.lastShare || 0) + CENSUS_SHARE_STEP;
    if ((censusState.lastShare || 0) > 0 && !grew && !cooled) return true;

    const pct = n => Math.round((n / total) * 100) + "%";
    const lines = [
        "🧭 CENSUS — " + bias,
        "",
        Math.round(share * 100) + "% of " + total + " symbols on the " +
            (bias === "SELL-SIDE" ? "sell" : "buy") + " side",
        "",
        "ABOVE prev high : " + counts.ABOVE + "  (" + pct(counts.ABOVE) + ")",
        "TOP  0-0.12     : " + counts.TOP + "  (" + pct(counts.TOP) + ")",
        "MID  0.12-0.35  : " + counts.MID + "  (" + pct(counts.MID) + ")",
        "PULLBACK 0.35-1 : " + counts.PULLBACK + "  (" + pct(counts.PULLBACK) + ")",
        "BELOW prev low  : " + counts.BELOW + "  (" + pct(counts.BELOW) + ")",
        "",
        bias === "SELL-SIDE"
            ? "Most of the watchlist has pulled back off its highs — do not read individual pullback alerts as buy setups."
            : "Most of the watchlist is at or above its previous high.",
        "",
        "⚠️ Describes what IS happening, not what happens next.",
        formatDateTime(ts)
    ];

    sendToTelegram2(lines.join("\n"));
    censusState.lastFire = ts;
    censusState.lastShare = share;
    saveState();
    return true;
}

function processBreadth(symbol, group, ts, body = {}) {
    if (!BREADTH_ENABLED || !symbol) return;

    if (!breadthState || typeof breadthState !== "object") {
        breadthState = { events: [], lastFire: 0, lastLevel: 0 };
    }
    if (!Array.isArray(breadthState.events)) breadthState.events = [];

    breadthState.events.push({ t: ts, s: symbol, z: breadthZone(body) });
    const arr = breadthPrune(ts);

    // Breadth = DISTINCT symbols in the window, not raw alert count. Ten alerts
    // from one symbol is one symbol moving; ten symbols is the market moving.
    const bySymbol = new Map();
    for (const e of arr) {
        if (!bySymbol.has(e.s)) bySymbol.set(e.s, []);
        bySymbol.get(e.s).push(e.z);
    }
    const breadth = bySymbol.size;
    if (breadth < BREADTH_THRESHOLD) {
        // Dropped back below the threshold: re-arm so the next surge can report.
        if (breadth < BREADTH_THRESHOLD * 0.6) breadthState.lastLevel = 0;
        return;
    }

    // Report on the first crossing, then only when it has grown by another STEP
    // since the last report, or after the cooldown. One burst = a couple of
    // messages, not one per alert.
    const lastAt = breadthState.lastLevel || 0;
    const cooledDown = (ts - (breadthState.lastFire || 0)) >= BREADTH_COOLDOWN_MS;
    const grewEnough = breadth >= lastAt + BREADTH_STEP;
    if (lastAt > 0 && !grewEnough && !cooledDown) return;

    const counts = { pullback: 0, zero: 0, mixed: 0, other: 0 };
    for (const [, zones] of bySymbol) {
        const pick = zones.includes("pullback") ? "pullback"
                   : zones.includes("zero")     ? "zero"
                   : zones.includes("mixed")    ? "mixed" : "other";
        counts[pick]++;
    }

    let bias = "UNCLEAR", note = "mixed alert types — no clear market-wide bias";
    if (counts.pullback >= breadth * 0.6) {
        bias = "SELL-SIDE";
        note = "most symbols have fallen into pullback zones — treat these as a market-wide decline, NOT as individual buy setups";
    } else if (counts.zero >= breadth * 0.6) {
        bias = "BUY-SIDE";
        note = "most symbols are pressing against their previous highs together";
    }

    const total = arr.length;
    const lines = [
        "🌊 BREADTH SURGE — " + bias,
        "",
        breadth + " distinct symbols in " + Math.round(BREADTH_WINDOW_MS / 60000) + " min  (normal ≈ 3)",
        total + " alerts total",
        "",
        "pullback-zone symbols : " + counts.pullback,
        "zero-zone symbols     : " + counts.zero,
        "mixed / other         : " + (counts.mixed + counts.other),
        "",
        note,
        "",
        "⚠️ Describes what IS happening, not what happens next.",
        formatDateTime(ts)
    ];

    sendToTelegram2(lines.join("\n"));
    breadthState.lastFire = ts;
    breadthState.lastLevel = breadth;
    saveState();
}

function processSalsa(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim().toUpperCase();

    // SALSA now only tracks exact group 52Y.
    if (rawGroup !== "52Y") return;

    const SALSA_MIN_GAP_MS = 15 * 60 * 1000;       // 15 minutes
    const SALSA_MAX_GAP_MS = 12 * 60 * 60 * 1000;  // 12 hours

    function salsaCleanPrice(b) {
        const raw =
            b?.price ??
            b?.close ??
            b?.current_price ??
            b?.alert_price ??
            b?.level ??
            "";

        const n = Number(
            String(raw)
                .replace(/,/g, "")
                .replace(/[^0-9.-]/g, "")
        );

        return Number.isFinite(n) && n > 0 ? String(n) : "n/a";
    }

    function salsaEventLine(e, index) {
        return (
            (index + 1) + ") " +
            e.group +
            " | Price " + (e.price ?? "n/a") +
            " @ " + formatDateTime(e.time)
        );
    }

    if (
        !salsaMemory[symbol] ||
        typeof salsaMemory[symbol] !== "object" ||
        Array.isArray(salsaMemory[symbol])
    ) {
        salsaMemory[symbol] = {
            events: [],
            lastSentKey: ""
        };
    }

    if (!Array.isArray(salsaMemory[symbol].events)) {
        salsaMemory[symbol] = {
            events: [],
            lastSentKey: ""
        };
    }

    const state = salsaMemory[symbol];

    const current = {
        group: rawGroup,
        time: ts,
        price: salsaCleanPrice(body)
    };

    const cutoff = ts - SALSA_MAX_GAP_MS - (10 * 60 * 1000);

    state.events = state.events
        .filter(e =>
            e &&
            e.group === "52Y" &&
            typeof e.time === "number" &&
            e.time >= cutoff
        )
        .sort((a, b) => a.time - b.time);

    // Check all previous 52Y alerts within the 12h window.
    const prior = state.events
        .map(e => {
            const gapMs = Math.abs(ts - e.time);

            return {
                event: e,
                gapMs
            };
        })
        .filter(x =>
            x.gapMs >= SALSA_MIN_GAP_MS &&
            x.gapMs <= SALSA_MAX_GAP_MS
        )
        .sort((a, b) => b.event.time - a.event.time)[0];

    if (prior) {
        const first = prior.event.time <= current.time ? prior.event : current;
        const second = prior.event.time <= current.time ? current : prior.event;

        const pairKey = [
            first.group + ":" + first.price + ":" + first.time,
            second.group + ":" + second.price + ":" + second.time
        ].sort().join("|");

        if (state.lastSentKey !== pairKey) {
            const gapHours = Math.floor(prior.gapMs / 3600000);
            const gapMin = Math.floor((prior.gapMs % 3600000) / 60000);
            const gapSec = Math.floor((prior.gapMs % 60000) / 1000);

            const gapText =
                gapHours > 0
                    ? gapHours + "h " + gapMin + "m " + gapSec + "s"
                    : gapMin + "m " + gapSec + "s";

            sendToTelegram8(
                "💃 SALSA\n" +
                "Symbol: " + symbol + "\n" +
                "Group: 52Y\n" +
                "Gap: " + gapText + "\n\n" +
                "Alerts:\n" +
                salsaEventLine(first, 0) + "\n" +
                salsaEventLine(second, 1) + "\n\n" +
                "Rule: exact 52Y repeat, 15 minutes to 12 hours"
            );

            state.lastSentKey = pairKey;
        }
    }

    state.events.push(current);

    if (state.events.length > 500) {
        state.events = state.events.slice(-500);
    }

    if (Object.keys(salsaMemory).length > 5000) {
        for (const sym of Object.keys(salsaMemory)) {
            const st = salsaMemory[sym];

            if (!st || typeof st !== "object" || !Array.isArray(st.events)) {
                delete salsaMemory[sym];
                continue;
            }

            st.events = st.events.filter(e =>
                e &&
                e.group === "52Y" &&
                typeof e.time === "number" &&
                e.time >= cutoff
            );

            if (!st.events.length) {
                delete salsaMemory[sym];
            }
        }
    }

    saveState();
}

function processTango(symbol, group, ts, body) {
    return;
}

// ==========================================================
//  🌊 NEPTUNE — CENSUS ZONE ALERTS + TRAIL          -> Bot 5
//
//  Only alerts with group "CENSUS", and only these zone moves
//  (either direction), kept apart as two separate sides:
//
//    🔺 ABOVE / TOP        TOP → ABOVE   or   ABOVE → TOP
//    🔻 BELOW / PULLBACK   PULLBACK → BELOW   or   BELOW → PULLBACK
//
//  Every other move (MID → TOP, PULLBACK → MID ...) is ignored.
//
//  One message per alert: the details on top and, underneath,
//  the trail of every alert for that symbol + side so far.
//  The trail starts fresh after NEPTUNE_TRAIL_RESET_HOURS
//  (default 24) with no new alert for that symbol + side.
//  The same bar arriving twice (e.g. BINANCE + BYBIT) counts once.
//
//  Fully separate from every other bot: own settings and memory.
// ==========================================================

const NEPTUNE_TRAIL_RESET_MS =
    (Number(process.env.NEPTUNE_TRAIL_RESET_HOURS) || 24) * 60 * 60 * 1000;

const NEPTUNE_STATE_VERSION = 2;
const NEPTUNE_MAX_TRAIL = 200;   // stored per symbol + side
const NEPTUNE_MAX_LINES = 25;    // shown in one Telegram message

const NEPTUNE_SIDES = {
    TOP: {
        zones: ["ABOVE", "TOP"],
        title: "🔺 <b>NEPTUNE · ABOVE / TOP</b>"
    },
    BOTTOM: {
        zones: ["BELOW", "PULLBACK"],
        title: "🔻 <b>NEPTUNE · BELOW / PULLBACK</b>"
    }
};

let neptuneMemory = persisted.neptuneMemory || {};

// Drop anything saved by the old NEPTUNE.
for (const key of Object.keys(neptuneMemory)) {
    const st = neptuneMemory[key];
    if (!st || st.v !== NEPTUNE_STATE_VERSION || !Array.isArray(st.trail)) delete neptuneMemory[key];
}

console.log("🌊 NEPTUNE LOADED — Bot5 | CENSUS only | ABOVE↔TOP and BELOW↔PULLBACK");

function neptuneSide(zone, prevZone) {
    for (const [side, cfg] of Object.entries(NEPTUNE_SIDES)) {
        if (zone !== prevZone && cfg.zones.includes(zone) && cfg.zones.includes(prevZone)) {
            return side;
        }
    }
    return null;
}

function npNum(v) {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
}

function npHm(ts) {
    return new Date(ts).toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function npDay(ts) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "numeric"
    }).formatToParts(new Date(ts));
    const day = parts.find(p => p.type === "day")?.value || "";
    const month = Number(parts.find(p => p.type === "month")?.value || 1);
    return day + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month - 1];
}

function npGap(ms) {
    const safe = Math.max(0, ms);
    const totalMin = Math.floor(safe / 60000);
    const h = Math.floor(totalMin / 60);
    if (h > 0) return h + "h " + (totalMin % 60) + "m";
    return totalMin + "m " + Math.floor((safe % 60000) / 1000) + "s";
}

function npPct(from, to) {
    if (!from || !to) return "";
    const pct = ((to - from) / from) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

function processNeptune(symbol, group, ts, body = {}) {
    if (!symbol) return;
    if (String(group || body.group || "").trim().toUpperCase() !== "CENSUS") return;

    const zone = String(body.zone || "").trim().toUpperCase();
    const prevZone = String(body.prev_zone || "").trim().toUpperCase();
    const side = neptuneSide(zone, prevZone);
    if (!side) return;

    const key = symbol + "|" + side;
    let state = neptuneMemory[key];

    // Fresh trail if none yet, or it went quiet for too long.
    if (
        !state ||
        !state.trail.length ||
        ts - state.trail[state.trail.length - 1].time > NEPTUNE_TRAIL_RESET_MS
    ) {
        state = neptuneMemory[key] = { v: NEPTUNE_STATE_VERSION, trail: [] };
    }

    const barTime = npNum(body.time) || ts;
    if (state.trail.some(e => e.barTime === barTime && e.zone === zone)) return;   // duplicate copy

    const current = {
        time: ts,
        barTime,
        zone,
        prevZone,
        price: npNum(body.price ?? body.close),
        ratio: npNum(body.ratio)
    };

    state.trail.push(current);

    if (state.trail.length > NEPTUNE_MAX_TRAIL) {
        state.trail = state.trail.slice(-NEPTUNE_MAX_TRAIL);
    }

    const trail = state.trail;
    const first = trail[0];
    const shown = trail.slice(-NEPTUNE_MAX_LINES);
    const hidden = trail.length - shown.length;

    // ---------- trail table ----------
    const rows = shown.map((e, i) => {
        const n = hidden + i + 1;
        return {
            n: String(n),
            time: npHm(e.time),
            price: e.price === null || e.price === undefined ? "n/a" : String(e.price),
            chg: n === 1 ? "-" : (npPct(first.price, e.price) || "-"),
            zone: e.zone,
            day: npDay(e.time),
            isNew: e === current && trail.length > 1
        };
    });

    const cols = [
        { key: "n", title: "#", right: true },
        { key: "time", title: "Time", right: false },
        { key: "price", title: "Price", right: true },
        { key: "chg", title: "Chg", right: true },
        { key: "zone", title: "Now", right: false }
    ];

    for (const c of cols) {
        c.width = Math.max(c.title.length, ...rows.map(r => r[c.key].length));
    }

    const fmtRow = r => cols
        .map(c => c.right ? r[c.key].padStart(c.width) : r[c.key].padEnd(c.width))
        .join("  ")
        .trimEnd();

    const table = [fmtRow(Object.fromEntries(cols.map(c => [c.key, c.title])))];
    if (hidden > 0) table.push("… " + hidden + " earlier");

    rows.forEach((r, i) => {
        if (i > 0 && r.day !== rows[i - 1].day) table.push("── " + r.day + " ──");
        table.push(fmtRow(r) + (r.isNew ? "  ◀" : ""));
    });

    // ---------- header ----------
    const pctSinceFirst = trail.length > 1 ? npPct(first.price, current.price) : "";
    const tf = body.tf ? " " + tgEscape(body.tf) : "";

    const msg =
        NEPTUNE_SIDES[side].title + "\n" +
        "<b>" + tgEscape(symbol) + "</b>  ·  CENSUS" + tf + "\n" +
        "Move <b>" + tgEscape(prevZone) + " → " + tgEscape(zone) + "</b>" +
        (current.ratio !== null ? "  ·  ratio " + tgEscape(current.ratio) : "") + "\n" +
        "Price <b>" + tgEscape(current.price ?? "n/a") + "</b>" +
        (pctSinceFirst ? "  (" + tgEscape(pctSinceFirst) + " since #1)" : "") + "\n" +
        "\n<pre>" + tgEscape(table.join("\n")) + "</pre>\n" +
        "<i>" +
        (trail.length > 1
            ? trail.length + " alerts over " + npGap(current.time - first.time) + " · started " + npDay(first.time) + " " + npHm(first.time)
            : "First alert · " + npDay(first.time) + " " + npHm(first.time)) +
        "</i>";

    sendToTelegram5Html(msg);

    // Tidy up long-dead trails.
    if (Object.keys(neptuneMemory).length > 3000) {
        for (const k of Object.keys(neptuneMemory)) {
            const t = neptuneMemory[k]?.trail;
            if (!Array.isArray(t) || !t.length || ts - t[t.length - 1].time > NEPTUNE_TRAIL_RESET_MS) {
                delete neptuneMemory[k];
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

                sendToTelegram5Disabled(   // muted: Bot 5 is NEPTUNE only
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

function processMamba(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim().toUpperCase();

    // MAMBA only tracks exact group 99F.
    if (rawGroup !== "99F") return;

    const matchTypeRaw =
        body?.match_type ??
        body?.matchType ??
        body?.matchtype ??
        body?.type ??
        "";

    const matchType = String(matchTypeRaw || "").trim().toUpperCase();

    // MAMBA needs a clear match type for the directional price rule.
    if (matchType !== "RETRACEMENTS" && matchType !== "EXTENSIONS") return;

    const priceRaw =
        body?.price ??
        body?.close ??
        body?.current_price ??
        body?.alert_price ??
        body?.level ??
        "";

    const price = Number(
        String(priceRaw)
            .replace(/,/g, "")
            .replace(/[^0-9.-]/g, "")
    );

    if (!Number.isFinite(price) || price <= 0) return;

    const MAMBA_MIN_GAP_MS = 5 * 60 * 1000;        // 5 minutes
    const MAMBA_MAX_GAP_MS = 24 * 60 * 60 * 1000;  // 24 hours

    function mambaPriceDiffPct(a, b) {
        const base = Math.abs(Number(a));
        const other = Math.abs(Number(b));

        if (!base || !other) return NaN;

        return Math.abs(other - base) / base * 100;
    }

    function mambaDirectionPass(previousPrice, latestPrice, latestMatchType) {
        const prev = Number(previousPrice);
        const latest = Number(latestPrice);

        if (!Number.isFinite(prev) || !Number.isFinite(latest)) return false;

        // For RETRACEMENTS, previous price must be lower than or equal to latest.
        if (latestMatchType === "RETRACEMENTS") {
            return prev >= latest;
        }

        // For EXTENSIONS, previous price must be higher than or equal to latest.
        if (latestMatchType === "EXTENSIONS") {
            return prev <= latest;
        }

        return false;
    }

    function mambaEventLine(e, index) {
        return (
            (index + 1) + ") " +
            e.group +
            " | " + (e.matchType || "n/a") +
            " | Price " + e.price +
            " @ " + formatDateTime(e.time)
        );
    }

    if (
        !mambaMemory[symbol] ||
        typeof mambaMemory[symbol] !== "object" ||
        Array.isArray(mambaMemory[symbol])
    ) {
        mambaMemory[symbol] = {
            events: [],
            lastSentKey: ""
        };
    }

    if (!Array.isArray(mambaMemory[symbol].events)) {
        mambaMemory[symbol] = {
            events: [],
            lastSentKey: ""
        };
    }

    const state = mambaMemory[symbol];

    const current = {
        group: rawGroup,
        matchType,
        time: ts,
        price
    };

    const cutoff = ts - MAMBA_MAX_GAP_MS - (10 * 60 * 1000);

    state.events = state.events
        .filter(e =>
            e &&
            e.group === "99F" &&
            typeof e.time === "number" &&
            e.time >= cutoff &&
            Number.isFinite(Number(e.price)) &&
            Number(e.price) > 0
        )
        .sort((a, b) => a.time - b.time);

    // Check all previous 99F alerts within the 24h window.
    // It does NOT have to be the most recent previous alert.
    const prior = state.events
        .map(e => {
            const gapMs = Math.abs(ts - e.time);
            const diffPct = mambaPriceDiffPct(e.price, current.price);
            const directionOk = mambaDirectionPass(e.price, current.price, current.matchType);

            return {
                event: e,
                gapMs,
                diffPct,
                directionOk
            };
        })
        .filter(x =>
            x.gapMs >= MAMBA_MIN_GAP_MS &&
            x.gapMs <= MAMBA_MAX_GAP_MS &&
            Number.isFinite(x.diffPct) &&
            x.directionOk
        )
        .sort((a, b) => b.event.time - a.event.time)[0];

    if (prior) {
        const first = prior.event.time <= current.time ? prior.event : current;
        const second = prior.event.time <= current.time ? current : prior.event;

        const pairKey = [
            first.group + ":" + (first.matchType || "") + ":" + first.price + ":" + first.time,
            second.group + ":" + (second.matchType || "") + ":" + second.price + ":" + second.time
        ].sort().join("|");

        if (state.lastSentKey !== pairKey) {
            const gapMin = Math.floor(prior.gapMs / 60000);
            const gapSec = Math.floor((prior.gapMs % 60000) / 1000);

            const directionText =
                current.matchType === "RETRACEMENTS"
                    ? "Previous price >= latest price"
                    : "Previous price <= latest price";

            sendToTelegram6(
                "🐍 MAMBA\n" +
                "Symbol: " + symbol + "\n" +
                "Group: 99F\n" +
                "Match type: " + current.matchType + "\n" +
                "Gap: " + gapMin + "m " + gapSec + "s\n" +
                "Price difference: " + prior.diffPct.toFixed(3) + "%\n\n" +
                "Alerts:\n" +
                mambaEventLine(first, 0) + "\n" +
                mambaEventLine(second, 1) + "\n\n" +
                "Direction check: " + directionText + "\n" +
                "Rule: exact 99F repeat, 5 minutes to 24 hours, no price-difference cap"
            );

            state.lastSentKey = pairKey;
        }
    }

    state.events.push(current);

    if (state.events.length > 500) {
        state.events = state.events.slice(-500);
    }

    if (Object.keys(mambaMemory).length > 5000) {
        for (const sym of Object.keys(mambaMemory)) {
            const st = mambaMemory[sym];

            if (!st || typeof st !== "object" || !Array.isArray(st.events)) {
                delete mambaMemory[sym];
                continue;
            }

            st.events = st.events.filter(e =>
                e &&
                e.group === "99F" &&
                typeof e.time === "number" &&
                e.time >= cutoff
            );

            if (!st.events.length) {
                delete mambaMemory[sym];
            }
        }
    }

    saveState();
}

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

let speshComboState = persisted.speshComboState || {};
const speshComboRuntime = {};

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

                sendToTelegram2Disabled(
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
//  COBRA — NORMAL ECOSYSTEM CLUSTER WITHIN 30 MINUTES
//  Bot 7
//
//  Rule:
//    - Same symbol
//    - NORMAL ecosystem only (no #, ~, ^, @, $ prefix)
//    - 2+ DIFFERENT exact groups within 30 minutes of each other
//    - Either order: 40L then 42A, or 42A then 40L
//    - Fires when a new group joins the 30-minute window and the
//      window then holds 2+ different groups
//    - The same group repeating inside the window does NOT re-fire
//      (it just refreshes that group's latest time)
//
//  Valid:
//    40L then 42A 12 min later       -> fires (40L + 42A)
//    then 39B 5 min after that        -> fires again (40L + 42A + 39B)
//
//  Invalid:
//    40L then 40L                     -> same group, no alert
//    40L then 42A 31 min later        -> outside window
//    40L then #12                     -> # is not normal ecosystem
//
//  State (persisted in state.json):
//    cobraComboState[symbol] = {
//      v: 2,
//      events: [{ group, time, price }],
//      lastSentKey: string
//    }
// ==========================================================

const COBRA_WINDOW_MS = 30 * 60 * 1000;   // 30 minutes
const COBRA_MIN_GROUPS = 2;                // different groups needed to fire
const COBRA_STATE_VERSION = 2;             // old 30s/family state is discarded
const COBRA_MAX_EVENTS_PER_SYMBOL = 200;   // hard safety cap
const COBRA_MAX_LINES = 20;                // max alert lines in one message

let cobraComboState = persisted.cobraComboState || {};

console.log("🐍 COBRA v2 LOADED — Bot7: 2+ different NORMAL groups within 30 minutes");

function cobraIsNormalGroup(group) {
    const raw = String(group || "").trim();
    if (!raw) return false;
    return !/^[#~^@$]/.test(raw);
}

function cobraCleanPrice(body) {
    const raw =
        body?.price ??
        body?.close ??
        body?.current_price ??
        body?.alert_price ??
        body?.level ??
        "";

    const n = Number(
        String(raw)
            .replace(/,/g, "")
            .replace(/[^0-9.-]/g, "")
    );

    return Number.isFinite(n) && n > 0 ? String(n) : "n/a";
}

function cobraFormatGap(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + "m " + s + "s";
}

function getCobraState(symbol) {
    const st = cobraComboState[symbol];

    if (
        !st ||
        typeof st !== "object" ||
        Array.isArray(st) ||
        st.v !== COBRA_STATE_VERSION ||
        !Array.isArray(st.events)
    ) {
        cobraComboState[symbol] = {
            v: COBRA_STATE_VERSION,
            events: [],
            lastSentKey: ""
        };
    }

    return cobraComboState[symbol];
}

// Latest occurrence of each distinct group, oldest first.
function cobraLatestPerGroup(events) {
    const latest = new Map();

    for (const e of events) {
        const prev = latest.get(e.group);
        if (!prev || e.time >= prev.time) {
            latest.set(e.group, e);
        }
    }

    return Array.from(latest.values()).sort((a, b) => a.time - b.time);
}

function processCobra(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;
    if (!cobraIsNormalGroup(group)) return;

    const rawGroup = String(group).trim().toUpperCase();
    const state = getCobraState(symbol);
    const cutoff = ts - COBRA_WINDOW_MS;

    // Keep only valid normal-ecosystem events inside the 30-minute window.
    state.events = state.events.filter(e =>
        e &&
        typeof e.time === "number" &&
        e.time >= cutoff &&
        e.group &&
        cobraIsNormalGroup(e.group)
    );

    const groupAlreadyInWindow = state.events.some(e => e.group === rawGroup);

    const current = {
        group: rawGroup,
        time: ts,
        price: cobraCleanPrice(body)
    };

    state.events.push(current);

    if (state.events.length > COBRA_MAX_EVENTS_PER_SYMBOL) {
        state.events = state.events.slice(-COBRA_MAX_EVENTS_PER_SYMBOL);
    }

    const cluster = cobraLatestPerGroup(state.events);

    console.log(
        "🐍 COBRA saw " + symbol + " " + rawGroup +
        " | groups in 30m window: " + cluster.map(e => e.group).join(", ")
    );

    if (!groupAlreadyInWindow && cluster.length >= COBRA_MIN_GROUPS) {
        const alertKey =
            cluster.map(e => e.group).sort().join("+") + "@" + ts;

        if (state.lastSentKey !== alertKey) {
            const first = cluster[0];
            const spanMs = current.time - first.time;

            const shown = cluster.slice(-COBRA_MAX_LINES);
            const hidden = cluster.length - shown.length;

            const lines = shown.map((e, i) =>
                (i + 1 + hidden) + ") " +
                e.group +
                " | Price " + (e.price ?? "n/a") +
                " @ " + formatDateTime(e.time) +
                (e === first ? "" : " (+" + cobraFormatGap(e.time - first.time) + ")") +
                (e === current ? "  ⬅️ new" : "")
            );

            if (hidden > 0) {
                lines.unshift("… " + hidden + " earlier group(s) not shown");
            }

            sendToTelegram7(
                "🐍 COBRA\n" +
                "Symbol: " + symbol + "\n" +
                "New group: " + current.group + "\n" +
                "Groups in window: " + cluster.length + "\n" +
                "Span: " + cobraFormatGap(spanMs) + "\n\n" +
                "Alerts:\n" +
                lines.join("\n") +
                "\n\n" +
                "Rule: " + COBRA_MIN_GROUPS + "+ different NORMAL groups within 30 minutes"
            );

            state.lastSentKey = alertKey;
        }
    }

    // Safety sweep when many symbols are tracked.
    if (Object.keys(cobraComboState).length > 5000) {
        pruneCobraRepeatState(cobraComboState, ts, COBRA_WINDOW_MS);
    }

    saveState();
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
//  ZEBRA — NORMAL + ANY SPECIAL ECOSYSTEM CORRELATION
//  Bot 2
//
//  Rule:
//    - Same symbol
//    - One NORMAL ecosystem alert
//    - One SPECIAL ecosystem alert
//    - Special can be #, ~, ^, @, or $
//    - Either order is valid
//    - Must match within 1 hour
//
//  Note:
//    - This replaces the old standalone "~ sends to Bot2" behaviour.
// ==========================================================

const ZEBRA_CROSS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

let zebraMemory = persisted.zebraMemory || {};

function isZebraGroup(group) {
    return String(group || "").trim().startsWith("~");
}

function zebraEcosystemFromGroup(group) {
    const raw = String(group || "").trim().toUpperCase();

    if (!raw) return "";

    if (raw.startsWith("#")) return "HASH";
    if (raw.startsWith("~")) return "ZEBRA";
    if (raw.startsWith("^")) return "KANGAROO";
    if (raw.startsWith("@")) return "MANUAL";
    if (raw.startsWith("$")) return "DOLLAR";

    return "NORMAL";
}

function getZebraSymbolState(symbol) {
    const current = zebraMemory[symbol];

    const invalid =
        !current ||
        typeof current !== "object" ||
        Array.isArray(current) ||
        (
            !Object.prototype.hasOwnProperty.call(current, "lastNormal") &&
            !Object.prototype.hasOwnProperty.call(current, "lastSpecial")
        );

    if (invalid) {
        zebraMemory[symbol] = {
            lastNormal: null,
            lastSpecial: null,
            lastSentKey: ""
        };
    }

    return zebraMemory[symbol];
}

function zebraPairKey(a, b) {
    return [
        a.ecosystem + ":" + a.group + ":" + a.time,
        b.ecosystem + ":" + b.group + ":" + b.time
    ].sort().join("|");
}

function zebraEventLine(e, index) {
    return (
        (index + 1) + ") " +
        e.ecosystem +
        " | " + e.group +
        " | Price " + (e.price ?? "n/a") +
        " @ " + formatDateTime(e.time)
    );
}

function pruneZebraMemory(ts) {
    if (!zebraMemory || typeof zebraMemory !== "object") return;

    const cutoff = ts - (2 * ZEBRA_CROSS_WINDOW_MS);

    for (const sym of Object.keys(zebraMemory)) {
        const st = zebraMemory[sym];

        if (!st || typeof st !== "object") {
            delete zebraMemory[sym];
            continue;
        }

        const n = st.lastNormal?.time || 0;
        const sp = st.lastSpecial?.time || 0;

        if (Math.max(n, sp) < cutoff) {
            delete zebraMemory[sym];
        }
    }
}

function processZebraEcosystem(symbol, group, ts, body = {}) {

    if (!symbol || !group) return;

    const rawGroup = String(group || "").trim();
    const ecosystem = zebraEcosystemFromGroup(rawGroup);

    if (!ecosystem) return;

    const state = getZebraSymbolState(symbol);

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

    const isNormal = ecosystem === "NORMAL";
    const opposite = isNormal ? state.lastSpecial : state.lastNormal;

    if (opposite && typeof opposite.time === "number") {
        const gapMs = Math.abs(ts - opposite.time);

        if (gapMs <= ZEBRA_CROSS_WINDOW_MS) {
            const first = opposite.time <= current.time ? opposite : current;
            const second = opposite.time <= current.time ? current : opposite;
            const pairKey = zebraPairKey(first, second);

            if (state.lastSentKey !== pairKey) {
                const gapMin = Math.floor(gapMs / 60000);
                const gapSec = Math.floor((gapMs % 60000) / 1000);

                sendToTelegram2Disabled(
                    "🦓 ZEBRA\n" +
                    "Rule: NORMAL + any special ecosystem within 1 hour\n" +
                    "Specials: #, ~, ^, @, $\n" +
                    "Symbol: " + symbol + "\n" +
                    "Span: " + gapMin + "m " + gapSec + "s\n\n" +
                    "Alerts:\n" +
                    zebraEventLine(first, 0) + "\n" +
                    zebraEventLine(second, 1)
                );

                state.lastSentKey = pairKey;
            }
        }
    }

    if (isNormal) {
        state.lastNormal = current;
    } else {
        state.lastSpecial = current;
    }

    pruneZebraMemory(ts);
    saveState();
}

// ==========================================================
//  KANGAROO ^ ECOSYSTEM

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
        console.warn("⛔ Alert rejected: missing/wrong \"secret\" in alert message | group=" + (body.group || "n/a") + " | symbol=" + (body.symbol || "n/a"));
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

        // 🎯 FOCUS MODE (default ON)
        // Only the bots in use run; every other bot is paused:
        //   Bot 2 — 🌊 BREADTH + 🧭 CENSUS
        //   Bot 3 — 🖤 BLACKPANTHER
        //   Bot 4 — 💥 BAZOOKA
        //   Bot 5 — 🌊 NEPTUNE
        //   Bot 7 — 🐍 COBRA
        // To run every bot again, set FOCUS_MODE=0 on Render.
        if (FOCUS_MODE) {
            processBazooka(symbol, group, ts, body);

            if (censusIsReport(body)) {
                processNeptune(symbol, group, ts, body);   // 🌊 Bot5: CENSUS ABOVE↔TOP / BELOW↔PULLBACK
                processCensus(symbol, group, ts, body);
                return res.sendStatus(200);
            }

            processBreadth(symbol, group, ts, body);
            processCobra(symbol, group, ts, body);          // normal groups only (checked inside)
            processBlackPanther(symbol, group, ts, body);   // groups with a number + letter

            return res.sendStatus(200);
        }

        // 🐍 COBRA is NORMAL-only now — called inside the normal pipeline below.
        // 🟨 YABA global $ cross-ecosystem detector.
        // Runs before isolated ecosystem returns so $, #, ~, @, ^ and normal can all be caught.
        processYaba(symbol, group, ts, body);
        // 🦓 ZEBRA global NORMAL + special ecosystem detector.
        // Runs before isolated ecosystem returns so normal, #, ~, @, ^ and $ can all be caught.
        processZebraEcosystem(symbol, group, ts, body);
        // 💥 BAZOOKA (Bot4): 17G / 62H / 44U full-match alert + trail.
        processBazooka(symbol, group, ts, body);
        // 💃 SALSA global 52Y 15m-to-12h detector.
        // Runs before isolated ecosystem returns so normal, #, ~, @, ^ and $ can all be caught.
        processSalsa(symbol, group, ts, body);
        // 🌊 BREADTH global market-wide bias detector.
        // Must run on EVERY alert regardless of ecosystem, so it sits with the other globals.
        // 🧭 CENSUS position reports are not trading setups - they only feed the head count,
        // so they are handled here and must not enter the normal/hash pipelines below.
        if (censusIsReport(body)) {
            processNeptune(symbol, group, ts, body);   // 🌊 Bot5: CENSUS ABOVE↔TOP / BELOW↔PULLBACK
            processCensus(symbol, group, ts, body);
            return res.sendStatus(200);
        }
        processBreadth(symbol, group, ts, body);
        // 🐍 MAMBA global 99F match-type direction detector.
        // Runs before isolated ecosystem returns so normal, #, ~, @, ^ and $ can all be caught.
        processMamba(symbol, group, ts, body);



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
        // processZebraEcosystem moved to global NORMAL + special detector
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
        processGando(symbol, group, ts);
        processSideFlip(symbol, group, ts);
        // processGamma(symbol, group, ts); // disabled by request
        // processYaba moved to global $ cross-ecosystem detector
        // processSalsa moved to global Bot8 price-time detector
        processTango(symbol, group, ts);
        processCobra(symbol, group, ts, body); // 🐍 Bot7: 2+ different normal groups within 30m
        // processZulu(symbol, group, ts); // disabled by request
        processMinta(symbol, group, ts);
        // processMamba moved to global Bot6 90m-to-7h price-time detector
        processSpesh(symbol, group, ts);
        processCabal(symbol, group, ts);
        processBoom(symbol, group, ts);
        processKooky(symbol, group, ts);        
        //processTesting(symbol, group, ts);
        //processAudit(symbol, group, ts, body);
        processBababia(symbol, group, ts);
        //processMAMAMIA(symbol, group, ts);
        // processZoneforge(symbol, group, ts, body); // disabled temporarily
        // processAnchorforge(symbol, group, ts, body); // disabled temporarily for CABAL Bot3
        //processWakanda(symbol, group, ts, body);
        processJupiter(symbol, group, ts);
    }

    // processPeterforge(symbol, group, ts, body); // disabled by forge cleanup

} else {
    // 🔴 HASH ECOSYSTEM (isolated)

    recordHashEvent(symbol, group, ts);

    processBoom(symbol, group, ts);

    processGodzilla(symbol, group, ts);

    // WAKANDA disabled by request.
    // if (typeof processWakanda === "function") {
    //     processWakanda(symbol, group, ts);
    // }
}

        // Strong signal (unchanged)
        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();
            if (dir && mom && dir === mom) {
                sendToTelegram2Disabled(
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

// ==========================================================
//  TEST LINKS (open in a browser)
//
//    /test/7?secret=YOUR_ALERT_SECRET      -> plain test message to Bot 7
//    /test/3?secret=YOUR_ALERT_SECRET      -> same for any bot number 1-15
//    /test/bazooka                          -> fake 17G trail of 3 -> Bot 4
//    /test/blackpanther                     -> fake 35P trail of 3 -> Bot 3
//    /test/neptune                          -> fake CENSUS moves -> Bot 5
//    /test/cobra?secret=YOUR_ALERT_SECRET  -> runs 2 fake NORMAL alerts
//                                             through the real COBRA logic
//
//  If ALERT_SECRET is not set on Render, the ?secret= part isn't needed.
// ==========================================================

function testSecretOk(req) {
    if (!ALERT_SECRET) return true;
    return String(req.query.secret || "") === ALERT_SECRET;
}

app.get("/test/cobra", (req, res) => {
    if (!testSecretOk(req)) return res.status(401).send("❌ Wrong or missing ?secret=");

    const testSymbol = "TEST_COBRA";
    const now = Date.now();

    delete cobraComboState[testSymbol];

    processCobra(testSymbol, "TEST1A", now - 5 * 60 * 1000, { price: "100" });
    processCobra(testSymbol, "TEST2B", now, { price: "101" });

    const fired = !!cobraComboState[testSymbol]?.lastSentKey;
    delete cobraComboState[testSymbol];

    const { token, chat } = getTelegramCreds(7);

    if (!token || !chat) {
        return res.status(500).send(
            "❌ COBRA logic ran, but Bot 7 is missing TELEGRAM_BOT_TOKEN_7 or TELEGRAM_CHAT_ID_7 on Render."
        );
    }

    res.send(
        fired
            ? "✅ COBRA fired and the message is queued for Bot 7. It should appear in Telegram within a few seconds. If it doesn't, check the Render logs for 'Telegram send failed: Bot7'."
            : "❌ COBRA ran but did not fire. Something is wrong in the COBRA logic, please share the Render logs."
    );
});

app.get("/test/bazooka", (req, res) => {
    if (!testSecretOk(req)) return res.status(401).send("❌ Wrong or missing ?secret=");

    const key = "TEST_BAZOOKA|17G";
    const now = Date.now();
    delete bazookaState[key];

    const fire = (min, price, time, matched = 18) =>
        processBazooka("TEST_BAZOOKA", "17G", now - min * 60000, {
            matched_count: matched, enabled_count: 18,
            band_top: "0.55", band_bottom: "0.66", price, time
        });

    fire(83, 99, 1, 17);   // 17 of 18 -> ignored
    fire(83, 100, 2);
    fire(79, 101, 3);
    fire(0, 98.5, 4);

    const count = bazookaState[key]?.trail?.length || 0;
    delete bazookaState[key];

    res.send(count === 3
        ? "✅ BAZOOKA test queued: 3 messages to Bot 4, the trail growing from 1 to 3 alerts (the 17 of 18 was correctly ignored)."
        : "❌ BAZOOKA test problem: trail count was " + count + " (expected 3). Please share the Render logs.");
});

app.get("/test/blackpanther", (req, res) => {
    if (!testSecretOk(req)) return res.status(401).send("❌ Wrong or missing ?secret=");

    const key = "TEST_BLACKPANTHER|35P";
    const now = Date.now();
    delete blackPantherMemory[key];

    const fire = (min, price, time, matched) =>
        processBlackPanther("TEST_BLACKPANTHER", "35P", now - min * 60000,
            { matched_count: matched, enabled_count: 18, price, time });

    processBlackPanther("TEST_BLACKPANTHER", "A", now, { price: 1, time: 9 });   // no number -> ignored
    fire(83, 100, 1, 13);
    fire(79, 101, 2, 18);
    fire(0, 98.5, 3, 15);

    const count = blackPantherMemory[key]?.trail?.length || 0;
    delete blackPantherMemory[key];

    res.send(count === 3
        ? "✅ BLACKPANTHER test queued: 3 messages to Bot 3, the trail growing from 1 to 3 alerts (group \"A\" was correctly ignored)."
        : "❌ BLACKPANTHER test problem: trail count was " + count + " (expected 3). Please share the Render logs.");
});

app.get("/test/neptune", (req, res) => {
    if (!testSecretOk(req)) return res.status(401).send("❌ Wrong or missing ?secret=");

    const sym = "TEST_NEPTUNE";
    const now = Date.now();
    delete neptuneMemory[sym + "|TOP"];
    delete neptuneMemory[sym + "|BOTTOM"];

    const fire = (min, zone, prev_zone, price, time, group = "CENSUS") =>
        processNeptune(sym, group, now - min * 60000,
            { condition: "Census", group, tf: "1D", zone, prev_zone, ratio: 0.01, price, time });

    fire(60, "TOP", "MID", 24.40, 1);            // MID -> TOP: ignored
    fire(55, "ABOVE", "TOP", 24.55, 2, "17G");   // not CENSUS: ignored
    fire(50, "ABOVE", "TOP", 24.55, 3);          // 🔺 #1
    fire(0, "TOP", "ABOVE", 24.41, 4);           // 🔺 #2
    fire(0, "BELOW", "PULLBACK", 0.042, 5);      // 🔻 #1

    const top = neptuneMemory[sym + "|TOP"]?.trail?.length || 0;
    const bottom = neptuneMemory[sym + "|BOTTOM"]?.trail?.length || 0;
    delete neptuneMemory[sym + "|TOP"];
    delete neptuneMemory[sym + "|BOTTOM"];

    res.send(top === 2 && bottom === 1
        ? "✅ NEPTUNE test queued: 3 messages to Bot 5 — two 🔺 ABOVE / TOP (trail of 2) and one 🔻 BELOW / PULLBACK."
        : "❌ NEPTUNE test problem: top=" + top + " bottom=" + bottom + " (expected 2 and 1).");
});

app.get("/test/:bot", async (req, res) => {
    if (!testSecretOk(req)) return res.status(401).send("❌ Wrong or missing ?secret=");

    const botNo = Number(req.params.bot);

    if (!Number.isInteger(botNo) || botNo < 1 || botNo > 15) {
        return res.status(400).send("❌ Use a bot number from 1 to 15, e.g. /test/7");
    }

    try {
        await rawTelegramSend(
            botNo,
            "✅ TEST — Bot " + botNo + " is connected and working\n" +
            "Service: " + (process.env.SERVICE_ROLE || "n/a") + "\n" +
            "Time: " + formatDateTime(Date.now())
        );

        res.send("✅ Test message sent to Bot " + botNo + ". Check Telegram.");
    } catch (err) {
        res.status(500).send(
            "❌ Bot " + botNo + " test failed: " + telegramErrorSummary(err)
        );
    }
});

app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
