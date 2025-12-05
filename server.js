import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ---------- Env ----------
const TELEGRAM_BOT_TOKEN_1 = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TELEGRAM_CHAT_ID_1   = (process.env.TELEGRAM_CHAT_ID || "").trim();

const TELEGRAM_BOT_TOKEN_2 = (process.env.TELEGRAM_BOT_TOKEN_2 || "").trim();
const TELEGRAM_CHAT_ID_2   = (process.env.TELEGRAM_CHAT_ID_2 || "").trim();

const WINDOW_SECONDS_DEF   = Number((process.env.WINDOW_SECONDS || "45").trim());
const CHECK_MS             = Number((process.env.CHECK_MS || "1000").trim());
const ALERT_SECRET         = (process.env.ALERT_SECRET || "").trim();
const COOLDOWN_SECONDS     = Number((process.env.COOLDOWN_SECONDS || "60").trim());

// ---------- RULES (for Bot1 only) ----------
let RULES = [];
try {
    const raw = (process.env.RULES || "").trim();
    RULES = raw ? JSON.parse(raw) : [];
} catch (e) {
    console.error("❌ Failed to parse RULES JSON:", e);
    RULES = [];
}

// Normalize rule fields
RULES = RULES.map((r, idx) => {
    const name = (r.name || `rule${idx + 1}`).toString();
    const groups = Array.isArray(r.groups) ? r.groups.map(s => String(s).trim()).filter(Boolean) : [];
    const threshold = Number(r.threshold || 3);
    const windowSeconds = Number(r.windowSeconds || WINDOW_SECONDS_DEF);
    return { name, groups, threshold, windowSeconds };
}).filter(r => r.groups.length > 0);

// ---------- In-Memory Buffers ----------
const events = {};
const cooldownUntil = {};

const nowMs = () => Date.now();
const nowSec = () => Math.floor(Date.now() / 1000);

// Keep only recent events inside window
function pruneOld(buf, windowMs) {
    const cutoff = nowMs() - windowMs;
    let i = 0;
    while (i < buf.length && buf[i].time < cutoff) i++;
    if (i > 0) buf.splice(0, i);
}

// Compute max window (for pruning)
function maxWindowMs() {
    if (!RULES.length) return WINDOW_SECONDS_DEF * 1000;
    return Math.max(...RULES.map(r => r.windowSeconds)) * 1000;
}

// ---------- Telegram Senders ----------
async function sendToTelegram1(text) {
    if (!TELEGRAM_BOT_TOKEN_1 || !TELEGRAM_CHAT_ID_1) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_1}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_1, text })
    });
}

async function sendToTelegram2(text) {
    if (!TELEGRAM_BOT_TOKEN_2 || !TELEGRAM_CHAT_ID_2) return;
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN_2}/sendMessage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID_2, text })
    });
}

// ---------- Incoming Webhook ----------
app.post("/incoming", (req, res) => {
    try {
        const body = req.body || {};
        if (ALERT_SECRET && body.secret !== ALERT_SECRET) {
            return res.sendStatus(401);
        }

        const group = (body.group || body.symbol || "unknown").toString();
        if (!events[group]) events[group] = [];

        events[group].push({ time: nowMs(), data: body });

        pruneOld(events[group], maxWindowMs());

        console.log("📥 Received alert:", body);

        // -------- STRONG SIGNAL CHECK (Bot2) --------
        try {
            const dir = body.direction?.toLowerCase();
            const mom = body.momentum?.toLowerCase();

            if (dir && mom && dir === mom) {
                const message =
                    `🔥 STRONG SIGNAL\n` +
                    `Pair: ${body.symbol}\n` +
                    `Level: ${body.level}\n` +
                    `Direction: ${dir}\n` +
                    `Momentum: ${mom}\n` +
                    `Time: ${body.time}`;

                sendToTelegram2(message);
                console.log("➡️ Sent to Bot2 (strong signal)");
            }
        } catch (e) {
            console.error("Bot2 strong-signal error", e);
        }

        return res.sendStatus(200);

    } catch (e) {
        console.error("❌ /incoming error:", e);
        return res.sendStatus(200);
    }
});

// ---------- Bot1 Aggregation Loop ----------
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
            // Build message
            const lines = [];
            lines.push(`🚨 Rule "${name}" fired: ${total} alerts in last ${windowSeconds}s`);

            for (const g of groups) {
                lines.push(`• ${g} count: ${counts[g]}`);
            }

            lines.push("");
            lines.push("Recent alerts:");

            for (const g of groups) {
                const buf = access(g);
                const tail = buf.slice(-5);
                tail.forEach((e, i) => {
                    const d = e.data;
                    lines.push(`[${g}] symbol=${d.symbol} price=${d.price} time=${d.time}`);
                });
            }

            const text = lines.join("\n");

            await sendToTelegram1(text);
            console.log("📨 Bot1 aggregation sent:", name);

            // reset buffers and cooldown
            for (const g of groups) events[g] = [];
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
        }
    }
}, CHECK_MS);

// ---------- REST API ----------
app.get("/ping", (req, res) => {
    res.json({ ok: true, rules: RULES.map(r => r.name) });
});

// ---------- Start ----------
const PORT = Number((process.env.PORT || "10000").trim());
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
