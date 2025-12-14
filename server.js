// ==========================================================
//  BOT1 LOOP (COMPACT FORMAT — REAL COUNTS)
// ==========================================================
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

            // 🔹 COMPACT MESSAGE
            const lines = [];
            lines.push(`🚨 ${name} fired: ${total} alerts in ${windowSeconds}s`);

            for (const g of groups) {
                lines.push(`• ${g} count: ${counts[g]}`);
            }

            await sendToTelegram1(lines.join("\n"));

            // ❗ DO NOT CLEAR BUFFERS (prevents starvation)
            cooldownUntil[name] = nowSec() + COOLDOWN_SECONDS;
            saveState();
        }
    }
}, CHECK_MS);

// ==========================================================
//  STRONG SIGNAL — AGGREGATED (COMPACT)
// ==========================================================
const strongSignals = [];

function recordStrongSignal(symbol, body, ts) {
    strongSignals.push({ symbol, ts });
}

setInterval(async () => {
    const WINDOW = 45 * 1000;
    const cutoff = nowMs() - WINDOW;

    while (strongSignals.length && strongSignals[0].ts < cutoff) {
        strongSignals.shift();
    }

    if (strongSignals.length > 0) {
        await sendToTelegram2(
            `🔥 STRONG_SIGNAL fired: ${strongSignals.length} alerts in 45s`
        );
        strongSignals.length = 0;
    }
}, 5000);
