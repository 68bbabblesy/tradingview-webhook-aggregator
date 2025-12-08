import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// --------------------------------------------------------------
// ENVIRONMENT VARIABLES
// --------------------------------------------------------------
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF   = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS             = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET         = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS     = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// Tracking window (used by matching & tracking rules)
const TRACKING_WINDOW_MS = Number((process.env.WINDOW_SECONDS || "3600")) * 1000;

// --------------------------------------------------------------
// INTERNAL MEMORY STORAGE
// --------------------------------------------------------------
const events = {};                 // Per-symbol event list
const cooldownUntil = {};          // Bot1 cooldown per rule name
let RULES = [];                    // Filled by ENV
const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

function pruneOld(buf, maxAgeMs) {
    const cutoff = nowMs() - maxAgeMs;
    while (buf.length && buf[0].time < cutoff) buf.shift();
}

function maxWindowMs() {
    return WINDOW_SECONDS_DEF * 1000;
}

// --------------------------------------------------------------
// TELEGRAM SEND HELPERS
// --------------------------------------------------------------
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

// --------------------------------------------------------------
// BOT2 MATCHING + TRACKING LOGIC PLACEHOLDERS
// (Your full matching/tracking logic goes here and remains unchanged)
// --------------------------------------------------------------
function processMatchingRules(symbol) {}
function processTrackingRules(symbol) {}


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

        // --------------------------------------------------------------
        // FIX / NORMALIZE FIELDS BEFORE EXTRACTING group/symbol
        // --------------------------------------------------------------

        // Normalize GROUP
        if (!body.group || body.group === "") {
            if (body.Group) {
                body.group = body.Group.toString().trim();
            }
            else if (body.kind === "fib-cross") {
                body.group = "H";   // All H signals use fib-cross
            }
            else {
                body.group = "F";   // F indicator fallback
            }
        }

        // Normalize SYMBOL
        if (!body.symbol || body.symbol === "") {
            if (body.ticker) {
                body.symbol = body.ticker.toString().trim();
            }
        }

        // Normalize TIME
        if (!body.time || body.time === "") {
            body.time = nowMs();
        }

        // Normalize LEVELS for F / G / H
        if (body.group === "F") {
            body.level = "1.3";   // Always ±1.3
        }

        if (body.group === "G") {
            if (!body.level || body.level === "") {
                body.level = "1.29"; // Always ±1.29
            }
        }

        if (body.group === "H") {
            if (body.level === "0.7" || body.level === "-0.7") {
                body.level = "0.7";
            }
            else if (body.level === "1.29" || body.level === "-1.29") {
                body.level = "1.29";
            }
            else {
                body.level = "1.29"; // Default fallback
            }
        }

        // --------------------------------------------------------------
        // NOW extract cleaned values
        // --------------------------------------------------------------
        const group  = (body.group  || "").toString().trim();
        const symbol = (body.symbol || "").toString().trim();
        const ts     = Number(body.time);

        if (!group || !symbol) {
            console.log("🚫 Dropped invalid alert (missing group or symbol):", body);
            return res.sendStatus(200);
        }

        console.log(`📥 Received alert | Symbol=${symbol} | Group=${group} | Level=${body.level}`);

        // --------------------------------------------------------------
        // Store for Matching + Tracking (Bot2)
        // --------------------------------------------------------------
        if (!events[symbol]) events[symbol] = [];
        events[symbol].push({
            ts,
            group,
            level: body.level || null,
            raw: body
        });

        pruneOld(events[symbol], TRACKING_WINDOW_MS);

        // Execute Bot2 engines
        processMatchingRules(symbol);
        processTrackingRules(symbol);

        // --------------------------------------------------------------
        // Also feed into BOT1 group-based aggregation
        // --------------------------------------------------------------
        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        return res.sendStatus(200);

    } catch (err) {
        console.error("❌ /incoming error:", err);
        return res.sendStatus(200);
    }
});


// --------------------------------------------------------------
// BOT1 AGGREGATION LOOP (UNCHANGED FROM YOUR VERSION)
// --------------------------------------------------------------
setInterval(async () => {
    if (!RULES.length) return;

    const access = g => (events[g] || (events[g] = []));

    for (const rule of RULES) {
        const { name, groups, threshold, windowSeconds } = rule;

        for (const g of groups) pruneOld(access(g), windowSeconds * 1000);

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
// PING ENDPOINT
// --------------------------------------------------------------
app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});


// --------------------------------------------------------------
// START SERVER
// --------------------------------------------------------------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
