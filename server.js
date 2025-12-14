// ==========================================================
//  FINAL PRODUCTION BUILD — COMPACT + HYBRID MEMORY
// ==========================================================

import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
//  PERSISTENCE (HYBRID MEMORY)
// ==========================================================
const STATE_FILE = "./state.json";

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        }
    } catch {}
    return {
        lastAlert: {},
        trackingStart: {},
        lastBig: {},
        cooldownUntil: {}
    };
}

function saveState() {
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify(
            { lastAlert, trackingStart, lastBig, cooldownUntil },
            null,
            2
        )
    );
}

const persisted = loadState();

// ==========================================================
//  ENV
// ==========================================================
const TELEGRAM_BOT_TOKEN_1 = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID_1   = process.env.TELEGRAM_CHAT_ID || "";

const TELEGRAM_BOT_TOKEN_2 = process.env.TELEGRAM_BOT_TOKEN_2 || "";
const TELEGRAM_CHAT_ID_2   = process.env.TELEGRAM_CHAT_ID_2 || "";

const TELEGRAM_BOT_TOKEN_3 = process.env.TELEGRAM_BOT_TOKEN_3 || "";
const TELEGRAM_CHAT_ID_3   = process.env.TELEGRAM_CHAT_ID_3 || "";

const WINDOW_SECONDS_DEF = Number(process.env.WINDOW_SECONDS || 45);
const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);
const ALERT_SECRET = process.env.ALERT_SECRET || "";

// ==========================================================
//  TELEGRAM SENDERS
// ==========================================================
const send = async (token, chat, text) => {
    if (!token || !chat) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text })
    });
};

// ==========================================================
//  BOT 1 — COMPACT AGGREGATOR (FIXED)
// ==========================================================
let RULES = [];
try {
    RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

const events = {};
const cooldownUntil = persisted.cooldownUntil || {};

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    while (buf.length && buf[0].time < cutoff) buf.shift();
}

setInterval(async () => {
    for (const rule of RULES) {
        const { name, groups, threshold, windowSeconds } = rule;
        let total = 0;
        const counts = {};
        const recent = [];

        for (const g of groups) {
            const buf = events[g] || [];
            pruneOld(buf, windowSeconds * 1000);
            counts[g] = buf.length;
            total += buf.length;
            recent.push(...buf.map(e => `[${g}] ${e.data.symbol}`));
        }

        if (total >= threshold && (cooldownUntil[name] || 0) <= nowSec()) {
            let msg = `🚨 ${name}: ${total} alerts in ${windowSeconds}s\n`;
            for (const g of groups) msg += `• ${g}: ${counts[g]}\n`;
            msg += `\nRecent:\n${recent.join("\n")}`;

            await send(TELEGRAM_BOT_TOKEN_1, TELEGRAM_CHAT_ID_1, msg);
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
            saveState();
        }
    }
}, CHECK_MS);

// ==========================================================
//  BOT 2 + BOT 3 STORAGE
// ==========================================================
const lastAlert = persisted.lastAlert || {};
const trackingStart = persisted.trackingStart || {};
const lastBig = persisted.lastBig || {};
const lastGPLevel = {};
const lastCrossLevel = {};
const tracking4 = {};

// ==========================================================
//  NORMALIZATION
// ==========================================================
function normalizeFibLevel(group, body) {
    if (group === "F") return [1.3, -1.3];
    if (["G", "P"].includes(group) && body.fib_level) {
        const v = parseFloat(body.fib_level);
        return isNaN(v) ? [] : [v, -v];
    }
    if (group === "H" && body.level) {
        const v = parseFloat(body.level);
        return isNaN(v) ? [] : [v, -v];
    }
    return [];
}

// ==========================================================
//  WEBHOOK
// ==========================================================
app.post("/incoming", async (req, res) => {
    const body = req.body || {};
    if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

    const group = body.group;
    const symbol = body.symbol;
    const ts = nowMs();

    if (!group || !symbol) return res.sendStatus(200);

    events[group] = events[group] || [];
    events[group].push({ time: ts, data: body });

    lastAlert[symbol] = lastAlert[symbol] || {};
    lastAlert[symbol][group] = { time: ts, payload: body };

    // BOT 2 — 2h / 5h logic (HYBRID SAFE)
    if (["F", "G", "H"].includes(group)) {
        const prev = lastBig[symbol] || 0;
        const diff = ts - prev;

        if (prev && diff >= 5 * 3600000) {
            await send(
                TELEGRAM_BOT_TOKEN_2,
                TELEGRAM_CHAT_ID_2,
                `⏱ TRACKING 3\n${symbol}\nFirst F/G/H in ${(diff/3600000).toFixed(1)}h`
            );
        }
        lastBig[symbol] = ts;
    }

    // BOT 3 — H switch
    if (group === "H") {
        const lv = Math.abs(parseFloat(body.level));
        if (!tracking4[symbol]) {
            tracking4[symbol] = { lv, ts };
        } else if (tracking4[symbol].lv !== lv) {
            await send(
                TELEGRAM_BOT_TOKEN_3,
                TELEGRAM_CHAT_ID_3,
                `🔄 TRACKING 4\n${symbol}\n${tracking4[symbol].lv} → ${lv}`
            );
            tracking4[symbol] = { lv, ts };
        }
    }

    saveState();
    res.sendStatus(200);
});

// ==========================================================
//  HEALTH
// ==========================================================
app.get("/health", (_, res) => {
    res.json({
        ok: true,
        uptime_min: Math.floor(process.uptime() / 60),
        rules: RULES.map(r => r.name)
    });
});

// ==========================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 LIVE"));
