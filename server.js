import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// =====================
// CONFIG
// =====================
const PORT = Number(process.env.PORT || 10000);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);
const ALERT_SECRET = (process.env.ALERT_SECRET || "").trim();

// =====================
// TELEGRAM
// =====================
const BOT1_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT1_CHAT  = process.env.TELEGRAM_CHAT_ID;

const BOT2_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2;
const BOT2_CHAT  = process.env.TELEGRAM_CHAT_ID_2;

async function tg(token, chat, text) {
    if (!token || !chat) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
}

// =====================
// BOT 1 — AGGREGATOR
// =====================
let RULES = [];
try {
    RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

RULES = RULES.map((r, i) => ({
    name: r.name || `rule${i+1}`,
    groups: r.groups,
    threshold: r.threshold,
    windowSeconds: r.windowSeconds || WINDOW_SECONDS_DEF
}));

const events = {};
const cooldownUntil = {};

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    while (buf.length && buf[0].time < cutoff) buf.shift();
}

function normalizeLevel(group, body) {
    if (group === "H" && body.level) return body.level;
    if (group === "G" && body.fib_level) return body.fib_level;
    return "";
}

// =====================
// BOT 2 — TRACKING (OLD FORMAT)
// =====================
const lastAlert = {};
const trackingStart = {};
const lastBig = {};

function saveAlert(symbol, group, ts, body) {
    if (!lastAlert[symbol]) lastAlert[symbol] = {};
    lastAlert[symbol][group] = { time: ts, payload: body };
}

function safeGet(symbol, group) {
    return lastAlert[symbol]?.[group];
}

function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A","B","C","D"];
    const endGroups = ["G","H"];

    if (startGroups.includes(group)) {
        trackingStart[symbol] = { group, time: ts };
        return;
    }

    if (endGroups.includes(group) && trackingStart[symbol]) {
        const s = trackingStart[symbol];
        const lvl = normalizeLevel(group, body);

        tg(BOT2_TOKEN, BOT2_CHAT,
            `📌 TRACKING 1 COMPLETE\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${s.group}\n` +
            `Start Time: ${new Date(s.time).toLocaleString()}\n` +
            `End Group: ${group}${lvl ? ` (${lvl})` : ""}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`
        );

        delete trackingStart[symbol];
    }
}

function processTracking2and3(symbol, group, ts, body) {
    if (!["F","G","H"].includes(group)) return;

    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    const TWO = 2 * 3600000;
    const FIVE = 5 * 3600000;

    const lvl = normalizeLevel(group, body);

    if (last && diff >= FIVE) {
        tg(BOT2_TOKEN, BOT2_CHAT,
            `⏱ TRACKING 3\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}${lvl ? ` (${lvl})` : ""}\n` +
            `First F/G/H in over 5 hours\n` +
            `Gap: ${(diff/3600000).toFixed(2)} hours\n` +
            `Time: ${new Date(ts).toLocaleString()}`
        );
    } else if (last && diff >= TWO) {
        tg(BOT2_TOKEN, BOT2_CHAT,
            `⏱ TRACKING 2\n` +
            `Symbol: ${symbol}\n` +
            `Group: ${group}${lvl ? ` (${lvl})` : ""}\n` +
            `First F/G/H in over 2 hours\n` +
            `Gap: ${(diff/3600000).toFixed(2)} hours\n` +
            `Time: ${new Date(ts).toLocaleString()}`
        );
    }

    lastBig[symbol] = ts;
}

// =====================
// WEBHOOK
// =====================
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

        const symbol = body.symbol;
        const group = body.group;
        const ts = nowMs();

        if (!symbol || !group) return res.sendStatus(200);

        // BOT 1 buffer
        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, body });
        pruneOld(events[group], maxWindowMs());

        saveAlert(symbol, group, ts, body);

        processTracking1(symbol, group, ts, body);
        processTracking2and3(symbol, group, ts, body);

        res.sendStatus(200);
    } catch {
        res.sendStatus(200);
    }
});

// =====================
// BOT 1 LOOP
// =====================
function maxWindowMs() {
    if (!RULES.length) return WINDOW_SECONDS_DEF * 1000;
    return Math.max(...RULES.map(r => r.windowSeconds)) * 1000;
}

setInterval(async () => {
    for (const r of RULES) {
        const { name, groups, threshold, windowSeconds } = r;

        let total = 0;
        const counts = {};

        for (const g of groups) {
            pruneOld(events[g] || (events[g]=[]), windowSeconds * 1000);
            counts[g] = events[g].length;
            total += counts[g];
        }

        if (total >= threshold && (cooldownUntil[name] || 0) <= nowSec()) {
            const lines = [];
            lines.push(`🚨 ${name}: ${total} alerts in ${windowSeconds}s`);

            for (const g of groups) {
                const last = events[g].slice(-5).map(e => {
                    const lvl = normalizeLevel(g, e.body);
                    return `[${g}] ${e.body.symbol}${lvl ? ` (${lvl})` : ""}`;
                });
                if (last.length) lines.push(...last);
            }

            await tg(BOT1_TOKEN, BOT1_CHAT, lines.join("\n"));
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
        }
    }
}, CHECK_MS);

// =====================
app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});
