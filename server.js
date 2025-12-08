
// ==========================================================
//  PART 1 — IMPORTS, CONFIG, HELPERS, NORMALIZATION, STORAGE
// ==========================================================

import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

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
// BOT1 RULES (unchanged)
// -----------------------------
let RULES = [];
try {
    const raw = (process.env.RULES || "").trim();
    RULES = raw ? JSON.parse(raw) : [];
} catch (e) {
    console.error("❌ Failed to parse RULES JSON:", e);
    RULES = [];
}

// Normalize rule fields for Bot1 only
RULES = RULES.map((r, idx) => {
    const name = (r.name || `rule${idx + 1}`).toString();
    const groups = Array.isArray(r.groups)
        ? r.groups.map(s => String(s).trim()).filter(Boolean)
        : [];
    const threshold = Number(r.threshold || 3);
    const windowSeconds = Number(r.windowSeconds || WINDOW_SECONDS_DEF);
    return { name, groups, threshold, windowSeconds };
}).filter(r => r.groups.length > 0);

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

// -----------------------------
// STORAGE FOR BOT1 AGGREGATION
// -----------------------------
const events = {};
const cooldownUntil = {};

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

// Record the *last alert* of each group for each symbol
const lastAlert = {};  
// Format:
// lastAlert[symbol] = {
//   A: {time: ms, payload: {}},
//   B: {...},
//   ...
//   F: {...},
//   G: {...},
//   H: {...}
// }

// Track the “waiting for H/G after A–D” state:
const trackingStart = {};  
// trackingStart[symbol] = {
//   startGroup: "A"|"B"|"C"|"D",
//   startTime: ms,
//   payload: {...}
// }

// For Tracking 2 & 3: last time ANY F/G/H alert happened per symbol
const lastBig = {};  
// lastBig[symbol] = ms

// -----------------------------
// FIB LEVEL NORMALIZATION
// -----------------------------
function normalizeFibLevel(group, body) {
    // GROUP F → always ±1.30
    if (group === "F") {
        return {
            levelStr: "1.30",
            numericLevels: [1.30, -1.30]
        };
    }

    // GROUP G → uses fib_level
    if (group === "G" && body.fib_level) {
        const lv = parseFloat(body.fib_level);
        if (!isNaN(lv)) return { levelStr: body.fib_level, numericLevels: [lv, -lv] };
    }

    // GROUP H → uses "level"
    if (group === "H" && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { levelStr: body.level, numericLevels: [lv, -lv] };
    }

    // Groups A–D
    return { levelStr: null, numericLevels: [] };
}

// -----------------------------
// SAVE ALERT TO lastAlert STRUCTURE
// -----------------------------
function saveAlert(symbol, group, timestamp, body) {
    if (!lastAlert[symbol]) lastAlert[symbol] = {};

    lastAlert[symbol][group] = {
        time: timestamp,
        payload: body
    };
}

// -----------------------------
// SAFE GET
// -----------------------------
function safeGet(symbol, group) {
    if (!lastAlert[symbol]) return null;
    return lastAlert[symbol][group] || null;
}

// ==========================================================
//  PART 2 — TRACKING ENGINE (Rules 1, 2, 3)
// ==========================================================

// --------------------------------------
//  TRACKING RULE 1 — A–D → first G/H
// --------------------------------------
function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups   = ["G", "H"];

    // If alert is A–D → set tracking start
    if (startGroups.includes(group)) {
        trackingStart[symbol] = {
            startGroup: group,
            startTime: ts,
            payload: body
        };
        return;
    }

    // If alert is G/H AND we are tracking
    if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];

        // Fire Bot2 message
        const msg =
            `📌 TRACKING 1 COMPLETE\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${start.startGroup}\n` +
            `Start Time: ${new Date(start.startTime).toLocaleString()}\n` +
            `End Group: ${group}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`;

        sendToTelegram2(msg);

        // Reset tracking
        delete trackingStart[symbol];
    }
}

// --------------------------------------
//  TRACKING RULES 2 & 3 — first F/G/H after long gaps
// --------------------------------------
function processTracking2and3(symbol, group, ts, body) {
    const bigGroups = ["F", "G", "H"];

    if (!bigGroups.includes(group)) return;

    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    // First time ever
    if (!last) {
        lastBig[symbol] = ts;
        return;
    }

    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const FIVE_HOURS = 5 * 60 * 60 * 1000;

    // RULE 3 (stronger) → 5 hours threshold
    if (diff >= FIVE_HOURS) {
        const msg =
            `⏱ TRACKING 3\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n` +
            `First F/G/H in over 5 hours\n` +
            `Gap: ${(diff / 3600000).toFixed(2)} hours\n` +
            `Time: ${new Date(ts).toLocaleString()}`;
        sendToTelegram2(msg);
        lastBig[symbol] = ts;
        return;
    }

    // RULE 2 → 2 hours threshold
    if (diff >= TWO_HOURS) {
        const msg =
            `⏱ TRACKING 2\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}\n` +
            `First F/G/H in over 2 hours\n` +
            `Gap: ${(diff / 3600000).toFixed(2)} hours\n` +
            `Time: ${new Date(ts).toLocaleString()}`;
        sendToTelegram2(msg);
    }

    // Update last timestamp
    lastBig[symbol] = ts;
}

// ==========================================================
//  PART 3 — MATCHING ENGINE (Rules 1, 2, 3)
// ==========================================================

// 65-second window (can adjust anytime)
const MATCH_WINDOW_MS = 65 * 1000;

// --------------------------------------------------
// MATCHING RULE 1 — A–D within 65s of F/G/H
// --------------------------------------------------
function processMatching1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const bigGroups   = ["F", "G", "H"];

    // CASE 1: A–D comes in → look for recent F/G/H
    if (startGroups.includes(group)) {
        const candidate = ["F", "G", "H"]
            .map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            const msg =
                `🔁 MATCHING 1\n` +
                `Symbol: ${symbol}\n` +
                `Groups: ${group} ↔ ${candidate.payload.group}\n` +
                `Times:\n` +
                ` - ${group}: ${new Date(ts).toLocaleString()}\n` +
                ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}`;
            sendToTelegram2(msg);
        }

        return;
    }

    // CASE 2: F/G/H comes in → look for recent A–D
    if (bigGroups.includes(group)) {
        const candidate = ["A", "B", "C", "D"]
            .map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            const msg =
                `🔁 MATCHING 1\n` +
                `Symbol: ${symbol}\n` +
                `Groups: ${candidate.payload.group} ↔ ${group}\n` +
                `Times:\n` +
                ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
                ` - ${group}: ${new Date(ts).toLocaleString()}`;
            sendToTelegram2(msg);
        }
    }
}

// --------------------------------------------------
// MATCHING RULE 2 — F/G/H ↔ F/G/H within 65 seconds
// --------------------------------------------------
function processMatching2(symbol, group, ts, body) {
    const bigGroups = ["F", "G", "H"];
    if (!bigGroups.includes(group)) return;

    const candidate = bigGroups
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .find(x => x.payload.group !== group && ts - x.time <= MATCH_WINDOW_MS);

    if (candidate) {
        const msg =
            `🔁 MATCHING 2\n` +
            `Symbol: ${symbol}\n` +
            `Groups: ${candidate.payload.group} ↔ ${group}\n` +
            `Times:\n` +
            ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
            ` - ${group}: ${new Date(ts).toLocaleString()}`;
        sendToTelegram2(msg);
    }
}

// --------------------------------------------------
// MATCHING RULE 3 — G/H ↔ G/H + SAME LEVEL ±
// --------------------------------------------------
function processMatching3(symbol, group, ts, body) {
    const allowed = ["G", "H"];
    if (!allowed.includes(group)) return;

    // Normalize current alert fib level
    const { numericLevels: lvls } = normalizeFibLevel(group, body);
    if (lvls.length === 0) return;

    // Look for recent G/H alert with same level
    const candidate = allowed
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .find(x => {
            if (ts - x.time > MATCH_WINDOW_MS) return false;

            // Normalize candidate levels
            const norm = normalizeFibLevel(x.payload.group, x.payload);
            const targetLvls = norm.numericLevels;

            // Compare (must match ±level)
            return (
                targetLvls.some(v => lvls.includes(v))
            );
        });

    if (candidate) {
        const msg =
            `🎯 MATCHING 3 (Same Level)\n` +
            `Symbol: ${symbol}\n` +
            `Levels: ±${lvls[0]}\n` +
            `Groups: ${candidate.payload.group} ↔ ${group}\n` +
            `Times:\n` +
            ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
            ` - ${group}: ${new Date(ts).toLocaleString()}`;
        sendToTelegram2(msg);
    }
}

// ==========================================================
//  PART 4 — WEBHOOK HANDLER + BOT1 LOOP + SERVER START
// ==========================================================


// --------------------------------------------------------------
//  HANDLE INCOMING ALERTS FROM TRADINGVIEW
// --------------------------------------------------------------
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};

        // Secret check
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
            return res.sendStatus(401);
        }

        // Extract essentials
        const group  = (body.group || "").toString().trim();
        const symbol = (body.symbol || "").toString().trim();
        const ts     = nowMs();

       if (!body.group || !body.symbol || !body.time) {
       console.log("🚫 Dropped invalid alert:", body);
      return res.sendStatus(200);
      }


        // Save to Bot1 structures
        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        console.log(`📥 Received alert | Symbol=${symbol} | Group=${group}`);

        // Save last seen alert for matching/tracking
        saveAlert(symbol, group, ts, body);

        // ---------------------------------
        // BOT2 ENGINE PROCESSING
        // ---------------------------------

        // 1. Tracking Rule 1 (A–D → G/H)
        processTracking1(symbol, group, ts, body);

        // 2. Tracking Rules 2 & 3 (First F/G/H after long gaps)
        processTracking2and3(symbol, group, ts, body);

        // 3. Matching Rule 1 (A–D ↔ F/G/H)
        processMatching1(symbol, group, ts, body);

        // 4. Matching Rule 2 (F/G/H ↔ F/G/H)
        processMatching2(symbol, group, ts, body);

        // 5. Matching Rule 3 (G/H ↔ G/H with same level)
        processMatching3(symbol, group, ts, body);

        // ---------------------------------
        // ORIGINAL STRONG SIGNAL LOGIC (kept)
        // ---------------------------------
        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();

            if (dir && mom && dir === mom) {
                const message =
                    `🔥 STRONG SIGNAL\n` +
                    `Symbol: ${symbol}\n` +
                    `Level: ${body.level || body.fib_level || "n/a"}\n` +
                    `Direction: ${dir}\n` +
                    `Momentum: ${mom}\n` +
                    `Time: ${body.time}`;
                sendToTelegram2(message);
                console.log("➡️ Sent to Bot2 (strong signal)");
            }
        } catch (err) {
            console.error("Bot2 strong-signal error:", err);
        }

        return res.sendStatus(200);

    } catch (err) {
        console.error("❌ /incoming handler error:", err);
        return res.sendStatus(200);
    }
});


// --------------------------------------------------------------
//  BOT1 AGGREGATION LOOP  (unchanged)
// --------------------------------------------------------------
setInterval(async () => {
    if (!RULES.length) return;

    const access = g => (events[g] || (events[g] = []));

    for (const rule of RULES) {
        const { name, groups, threshold, windowSeconds } = rule;

        // prune per-group
        for (const g of groups) pruneOld(access(g), windowSeconds * 1000);

        // count events
        const counts = {};
        let total = 0;
        for (const g of groups) {
            const c = access(g).length;
            counts[g] = c;
            total += c;
        }

        const cd = cooldownUntil[name] || 0;
        const inCooldown = cd > nowSec();

        if (total >= threshold && !inCooldown) {
            const lines = [];
            lines.push(`🚨 Rule "${name}" fired: ${total} alerts in last ${windowSeconds}s`);

            for (const g of groups) {
                lines.push(`• ${g} count: ${counts[g]}`);
            }

            lines.push("");
            lines.push("Recent alerts:");

            for (const g of groups) {
                const buf = access(g);
                buf.slice(-5).forEach(e => {
                    const d = e.data;
                    lines.push(`[${g}] symbol=${d.symbol} price=${d.price} time=${d.time}`);
                });
            }

            await sendToTelegram1(lines.join("\n"));
            console.log("📨 Bot1 aggregation sent:", name);

            for (const g of groups) events[g] = [];
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
        }
    }
}, CHECK_MS);


// --------------------------------------------------------------
//  SIMPLE /PING ENDPOINT
// --------------------------------------------------------------
app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});


// --------------------------------------------------------------
//  START SERVER
// --------------------------------------------------------------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
