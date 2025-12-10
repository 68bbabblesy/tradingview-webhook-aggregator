import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS           = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET       = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS   = Number((process.env.COOLDOWN_SECONDS || "60").trim());

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

const nowMs  = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

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

const events = {};
const cooldownUntil = {};

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

const lastAlert = {};
const trackingStart = {};
const lastBig = {};

function normalizeFibLevel(group, body) {
    if (group === "F") return { levelStr: "1.30", numericLevels: [1.30, -1.30] };

    if (group === "G" && body.fib_level) {
        const lv = parseFloat(body.fib_level);
        if (!isNaN(lv)) return { levelStr: body.fib_level, numericLevels: [lv, -lv] };
    }

    if (group === "H" && body.level) {
        const lv = parseFloat(body.level);
        if (!isNaN(lv)) return { levelStr: body.level, numericLevels: [lv, -lv] };
    }

    return { levelStr: null, numericLevels: [] };
}

function saveAlert(symbol, group, ts, body) {
    if (!lastAlert[symbol]) lastAlert[symbol] = {};
    lastAlert[symbol][group] = { time: ts, payload: body };
}

function safeGet(symbol, group) {
    return lastAlert[symbol]?.[group] || null;
}

function processTracking1(symbol, group, ts, body) {
    const startGroups = ["A", "B", "C", "D"];
    const endGroups = ["G", "H"];

    if (startGroups.includes(group)) {
        trackingStart[symbol] = { startGroup: group, startTime: ts, payload: body };
        return;
    }

    if (endGroups.includes(group) && trackingStart[symbol]) {
        const start = trackingStart[symbol];
        sendToTelegram2(
            `📌 TRACKING 1 COMPLETE\n` +
            `Symbol: ${symbol}\n` +
            `Start Group: ${start.startGroup}\n` +
            `Start Time: ${new Date(start.startTime).toLocaleString()}\n` +
            `End Group: ${group}\n` +
            `End Time: ${new Date(ts).toLocaleString()}`
        );
        delete trackingStart[symbol];
    }
}

function processTracking2and3(symbol, group, ts, body) {
    const big = ["F", "G", "H"];
    if (!big.includes(group)) return;

    const last = lastBig[symbol] || 0;
    const diff = ts - last;

    if (!last) {
        lastBig[symbol] = ts;
        return;
    }

    const TWO = 2 * 60 * 60 * 1000;
    const FIVE = 5 * 60 * 60 * 1000;

    if (diff >= FIVE) {
        sendToTelegram2(
            `⏱ TRACKING 3\nSymbol: ${symbol}\nGroup: ${group}\nFirst F/G/H in over 5 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
        );
        lastBig[symbol] = ts;
        return;
    }

    if (diff >= TWO) {
        sendToTelegram2(
            `⏱ TRACKING 2\nSymbol: ${symbol}\nGroup: ${group}\nFirst F/G/H in over 2 hours\nGap: ${(diff/3600000).toFixed(2)} hours\nTime: ${new Date(ts).toLocaleString()}`
        );
    }

    lastBig[symbol] = ts;
}

const MATCH_WINDOW_MS = 65 * 1000;

function processMatching1(symbol, group, ts, body) {
    const AD = ["A", "B", "C", "D"];
    const FGH = ["F", "G", "H"];

    if (AD.includes(group)) {
        const candidate = FGH.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram2(
                `🔁 MATCHING 1\nSymbol: ${symbol}\n` +
                `Groups: ${group} ↔ ${candidate.payload.group}\nTimes:\n` +
                ` - ${group}: ${new Date(ts).toLocaleString()}\n` +
                ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}`
            );
        }
        return;
    }

    if (FGH.includes(group)) {
        const candidate = AD.map(g => safeGet(symbol, g))
            .filter(Boolean)
            .find(x => ts - x.time <= MATCH_WINDOW_MS);

        if (candidate) {
            sendToTelegram2(
                `🔁 MATCHING 1\nSymbol: ${symbol}\n` +
                `Groups: ${candidate.payload.group} ↔ ${group}\nTimes:\n` +
                ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
                ` - ${group}: ${new Date(ts).toLocaleString()}`
            );
        }
    }
}

function processMatchingAD2(symbol, group, ts) {
    const AD = ["A", "B", "C", "D"];
    if (!AD.includes(group)) return;

    const candidate = AD
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.payload.group !== group)
        .filter(x => Math.abs(ts - x.time) <= MATCH_WINDOW_MS)
        .sort((a,b) => b.time - a.time)[0];

    if (!candidate) return;

    sendToTelegram2(
        `🔁 AD-2 Divergence\n` +
        `Symbol: ${symbol}\n` +
        `Groups: ${candidate.payload.group} ↔ ${group}\n` +
        `Times:\n` +
        ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
        ` - ${group}: ${new Date(ts).toLocaleString()}`
    );
}

function processMatching2(symbol, group, ts, body) {
    const FGH = ["F", "G", "H"];
    if (!FGH.includes(group)) return;

    const { numericLevels: lvls } = normalizeFibLevel(group, body);
    if (!lvls.length) return;

    const candidate = FGH
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => x.payload.group !== group)
        .filter(x => {
            const norm = normalizeFibLevel(x.payload.group, x.payload);
            return norm.numericLevels.some(v => lvls.includes(v));
        })
        .filter(x => Math.abs(ts - x.time) <= MATCH_WINDOW_MS)
        .sort((a,b) => b.time - a.time)[0];

    if (!candidate) return;

    sendToTelegram2(
        `🔁 MATCHING 2\n` +
        `Symbol: ${symbol}\n` +
        `Levels: ±${lvls[0]}\n` +
        `Groups: ${candidate.payload.group} ↔ ${group}\n` +
        `Times:\n` +
        ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
        ` - ${group}: ${new Date(ts).toLocaleString()}`
    );
}

function processMatching3(symbol, group, ts, body) {
    const GH = ["G", "H"];
    if (!GH.includes(group)) return;

    const { numericLevels: lvls } = normalizeFibLevel(group, body);
    if (!lvls.length) return;

    const candidate = GH
        .map(g => safeGet(symbol, g))
        .filter(Boolean)
        .filter(x => !(x.payload.group === group && x.time === ts))
        .filter(x => ts - x.time <= MATCH_WINDOW_MS)
        .find(x => {
            const norm = normalizeFibLevel(x.payload.group, x.payload);
            return norm.numericLevels.some(v => lvls.includes(v));
        });

    if (!candidate) return;

    sendToTelegram2(
        `🎯 MATCHING 3 (Same Level)\n` +
        `Symbol: ${symbol}\n` +
        `Levels: ±${lvls[0]}\n` +
        `Groups: ${candidate.payload.group} ↔ ${group}\n` +
        `Times:\n` +
        ` - ${candidate.payload.group}: ${new Date(candidate.time).toLocaleString()}\n` +
        ` - ${group}: ${new Date(ts).toLocaleString()}`
    );
}

app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) return res.sendStatus(401);

        const group = (body.group || "").trim();
        const symbol = (body.symbol || "").trim();
        const ts = nowMs();

        const hash = alertHash(symbol, group, ts);
        if (recentHashes.has(hash)) return res.sendStatus(200);
        recentHashes.add(hash);
        setTimeout(() => recentHashes.delete(hash), 300000);

        if (!group || !symbol) return res.sendStatus(200);

        if (!events[group]) events[group] = [];
        events[group].push({ time: ts, data: body });
        pruneOld(events[group], maxWindowMs());

        const norm = normalizeFibLevel(group, body);
        body.levelStr = norm.levelStr;
        body.numericLevels = norm.numericLevels;

        saveAlert(symbol, group, ts, body);

        processTracking1(symbol, group, ts, body);
        processTracking2and3(symbol, group, ts, body);
        processMatching1(symbol, group, ts, body);
        processMatchingAD2(symbol, group, ts);
        processMatching2(symbol, group, ts, body);
        processMatching3(symbol, group, ts, body);

        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();
            if (dir && mom && dir === mom) {
                sendToTelegram2(
                    `🔥 STRONG SIGNAL\n` +
                    `Symbol: ${symbol}\n` +
                    `Level: ${body.level || body.fib_level || "n/a"}\n` +
                    `Direction: ${dir}\n` +
                    `Momentum: ${mom}\n` +
                    `Time: ${body.time}`
                );
            }
        } catch {}

        res.sendStatus(200);

    } catch {
        res.sendStatus(200);
    }
});

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
            for (const g of groups) events[g] = [];
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
        }
    }
}, CHECK_MS);

app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});

const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
