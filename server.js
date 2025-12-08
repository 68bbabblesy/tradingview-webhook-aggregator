// ==========================================================
//  tradingview-webhook-aggregator — CLEAN FULL SERVER
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

// Bot2 timing
const MATCH_WINDOW_MS = 65 * 1000;                 // 65 seconds for matching rules
const TWO_HOURS_MS    = 2 * 60 * 60 * 1000;
const FIVE_HOURS_MS   = 5 * 60 * 60 * 1000;

// -----------------------------
// BOT1 RULES (same as before)
// -----------------------------
let RULES = [];
try {
    const raw = (process.env.RULES || "").trim();
    RULES = raw ? JSON.parse(raw) : [];
} catch (e) {
    console.error("❌ Failed to parse RULES JSON:", e);
    RULES = [];
}

RULES = RULES.map((r, idx) => {
    const name = (r.name || `rule${idx + 1}`).toString();
    const groups = Array.isArray(r.groups)
        ? r.groups.map(s => String(s).trim()).filter(Boolean)
        : [];
    const threshold     = Number(r.threshold || 3);
    const windowSeconds = Number(r.windowSeconds || WINDOW_SECONDS_DEF);
    return { name, groups, threshold, windowSeconds };
}).filter(r => r.groups.length > 0);

// -----------------------------
// HELPERS
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
/*  BOT1 STORAGE + HELPERS (unchanged style)               */
// ==========================================================
const events = {};           // per-group events for Bot1
const cooldownUntil = {};   // cooldown per rule name

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
/*  BOT2 STATE (tracking + matching)                       */
// ==========================================================

// last alert per (symbol, group)
const lastBySymbolGroup = {};   // { [symbol]: { [group]: { ts, level } } }

// Tracking1: after A–D, wait for G/H
const trackingStart = {};       // { [symbol]: { group, ts } }

// Tracking2/3: last time F/G/H fired
const lastBigTs = {};           // { [symbol]: ms }

// helper to record last alert
function updateLastSymbolGroup(symbol, group, ts, level) {
    if (!lastBySymbolGroup[symbol]) lastBySymbolGroup[symbol] = {};
    lastBySymbolGroup[symbol][group] = { ts, level };
}

// ==========================================================
//  BOT2 — TRACKING RULES
// ==========================================================
function runTrackingRules(symbol, group, ts) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups   = ["G", "H"];
    const bigGroups   = ["F", "G", "H"];

    // TRACKING 1: A–D then first G/H
    if (startGroups.includes(group)) {
        trackingStart[symbol] = { group, ts };
    } else if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];
        const msg =
            `📌 TRACKING 1 COMPLETE\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${start.group}\n` +
            `End Group: ${group}\n` +
            `Start Time: ${new Date(start.ts).toLocaleString()}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`;
        sendToTelegram2(msg);
        delete trackingStart[symbol];
    }

    // TRACKING 2 & 3: first F/G/H after 2h / 5h
    if (bigGroups.includes(group)) {
        const last = lastBigTs[symbol] || 0;
        if (last) {
            const diff = ts - last;
            if (diff >= FIVE_HOURS_MS) {
                const msg =
                    `⏱ TRACKING 3\n` +
                    `Symbol: ${symbol}\n` +
                    `Group: ${group}\n` +
                    `First F/G/H in over 5 hours\n` +
                    `Gap: ${(diff / 3600000).toFixed(2)} hours\n` +
                    `Time: ${new Date(ts).toLocaleString()}`;
                sendToTelegram2(msg);
            } else if (diff >= TWO_HOURS_MS) {
                const msg =
                    `⏱ TRACKING 2\n` +
                    `Symbol: ${symbol}\n` +
                    `Group: ${group}\n` +
                    `First F/G/H in over 2 hours\n` +
                    `Gap: ${(diff / 3600000).toFixed(2)} hours\n` +
                    `Time: ${new Date(ts).toLocaleString()}`;
                sendToTelegram2(msg);
            }
        }
        lastBigTs[symbol] = ts;
    }
}

// ==========================================================
//  BOT2 — MATCHING RULES
// ==========================================================
function runMatchingRules(symbol, group, ts, level) {
    const last = lastBySymbolGroup[symbol] || {};
    const startGroups = ["A", "B", "C", "D"];
    const bigGroups   = ["F", "G", "H"];
    const ghGroups    = ["G", "H"];

    // MATCHING 1: A–D within 65s of F/G/H (both directions)
    if (startGroups.includes(group)) {
        // current is A–D → look back for F/G/H
        for (const g of bigGroups) {
            const e = last[g];
            if (e && ts - e.ts <= MATCH_WINDOW_MS) {
                const msg =
                    `🔁 MATCHING 1\n` +
                    `Symbol: ${symbol}\n` +
                    `Groups: ${group} ↔ ${g}\n` +
                    `Times:\n` +
                    ` - ${group}: ${new Date(ts).toLocaleString()}\n` +
                    ` - ${g}: ${new Date(e.ts).toLocaleString()}`;
                sendToTelegram2(msg);
                break;
            }
        }
    } else if (bigGroups.includes(group)) {
        // current is F/G/H → look back for A–D
        for (const g of startGroups) {
            const e = last[g];
            if (e && ts - e.ts <= MATCH_WINDOW_MS) {
                const msg =
                    `🔁 MATCHING 1\n` +
                    `Symbol: ${symbol}\n` +
                    `Groups: ${g} ↔ ${group}\n` +
                    `Times:\n` +
                    ` - ${g}: ${new Date(e.ts).toLocaleString()}\n` +
                    ` - ${group}: ${new Date(ts).toLocaleString()}`;
                sendToTelegram2(msg);
                break;
            }
        }
    }

    // MATCHING 2: F/G/H within 65s of each other
    if (bigGroups.includes(group)) {
        for (const g of bigGroups) {
            if (g === group) continue;
            const e = last[g];
            if (e && ts - e.ts <= MATCH_WINDOW_MS) {
                const msg =
                    `🔁 MATCHING 2\n` +
                    `Symbol: ${symbol}\n` +
                    `Groups: ${g} ↔ ${group}\n` +
                    `Times:\n` +
                    ` - ${g}: ${new Date(e.ts).toLocaleString()}\n` +
                    ` - ${group}: ${new Date(ts).toLocaleString()}`;
                sendToTelegram2(msg);
                break;
            }
        }
    }

    // MATCHING 3: G/H within 65s, same fib level
    if (ghGroups.includes(group) && level) {
        for (const g of ghGroups) {
            const e = last[g];
            if (!e || !e.level) continue;
            if (ts - e.ts > MATCH_WINDOW_MS) continue;
            if (e.level === level) {
                const msg =
                    `🎯 MATCHING 3 (Same Level)\n` +
                    `Symbol: ${symbol}\n` +
                    `Level: ${level}\n` +
                    `Groups: ${g} ↔ ${group}\n` +
                    `Times:\n` +
                    ` - ${g}: ${new Date(e.ts).toLocaleString()}\n` +
                    ` - ${group}: ${new Date(ts).toLocaleString()}`;
                sendToTelegram2(msg);
                break;
            }
        }
    }
}

// ==========================================================
//  INCOMING WEBHOOK HANDLER
// ==========================================================
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};

        // Optional secret
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
            return res.sendStatus(401);
        }

        const group  = (body.group  || "").toString().trim();
        const symbol = (body.symbol || "").toString().trim();
        const ts     = nowMs();

        if (!group || !symbol) {
            console.log("🚫 Dropped invalid alert (missing group or symbol):", body);
            return res.sendStatus(200);
        }

        // BOT1 storage
        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        // Determine fib level for matching
        let level = null;
        if (group === "F") {
            level = "1.3"; // fixed for F
        } else if (group === "G" && body.fib_level) {
            level = String(body.fib_level);
        } else if (group === "H" && body.level) {
            level = String(body.level);
        }

        console.log(`📥 Received alert | Symbol=${symbol} | Group=${group} | Level=${level || "n/a"}`);

        // BOT2 tracking + matching (use previous state, then update)
        runTrackingRules(symbol, group, ts);
        runMatchingRules(symbol, group, ts, level);
        updateLastSymbolGroup(symbol, group, ts, level);

        // Optional: original "strong signal" logic (direction/momentum)
        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();
            if (dir && mom && dir === mom) {
                const msg =
                    `🔥 STRONG SIGNAL\n` +
                    `Symbol: ${symbol}\n` +
                    `Level: ${body.level || body.fib_level || "n/a"}\n` +
                    `Direction: ${dir}\n` +
                    `Momentum: ${mom}\n` +
                    `Time: ${body.time || ts}`;
                sendToTelegram2(msg);
            }
        } catch (e) {
            console.error("Strong-signal logic error:", e);
        }

        return res.sendStatus(200);
    } catch (err) {
        console.error("❌ /incoming error:", err);
        return res.sendStatus(200);
    }
});

// ==========================================================
//  BOT1 AGGREGATION LOOP  (original behaviour)
// ==========================================================
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

// ==========================================================
//  /PING ENDPOINT
// ==========================================================
app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
