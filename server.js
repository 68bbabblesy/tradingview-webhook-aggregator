import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// ==========================================================
// STATE PERSISTENCE
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
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        { lastAlert, trackingStart, lastBig, cooldownUntil },
        null,
        2
      )
    );
  } catch {}
}

const persisted = loadState();

// ==========================================================
// ENV
// ==========================================================
const BOT1_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT1_CHAT  = process.env.TELEGRAM_CHAT_ID || "";

const BOT2_TOKEN = process.env.TELEGRAM_BOT_TOKEN_2 || "";
const BOT2_CHAT  = process.env.TELEGRAM_CHAT_ID_2 || "";

const BOT3_TOKEN = process.env.TELEGRAM_BOT_TOKEN_3 || "";
const BOT3_CHAT  = process.env.TELEGRAM_CHAT_ID_3 || "";

const CHECK_MS = Number(process.env.CHECK_MS || 1000);
const WINDOW_SECONDS = Number(process.env.WINDOW_SECONDS || 45);
const COOLDOWN_SECONDS = Number(process.env.COOLDOWN_SECONDS || 60);

// ==========================================================
// TELEGRAM HELPERS
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
// BOT 1 — AGGREGATION (STABLE)
// ==========================================================
let RULES = [];
try {
  RULES = JSON.parse(process.env.RULES || "[]");
} catch {}

const events = {};
const cooldownUntil = persisted.cooldownUntil;

const prune = (arr, winMs) => {
  const cut = Date.now() - winMs;
  while (arr.length && arr[0].time < cut) arr.shift();
};

// ==========================================================
// NORMALIZATION
// ==========================================================
function normalize(group, body) {
  if (group === "H" && body.level) {
    const v = Number(body.level);
    return isNaN(v) ? [] : [v, -v];
  }
  if (group === "G" && body.fib_level) {
    const v = Number(body.fib_level);
    return isNaN(v) ? [] : [v, -v];
  }
  if (group === "F") return [1.3, -1.3];
  return [];
}

// ==========================================================
// BOT 2 — TRACKING (RESTORED FORMAT)
// ==========================================================
const lastAlert = persisted.lastAlert;
const trackingStart = persisted.trackingStart;
const lastBig = persisted.lastBig;

function tracking1(symbol, group, ts, body) {
  const start = ["A","B","C","D"];
  const end = ["G","H"];

  if (start.includes(group)) {
    trackingStart[symbol] = { group, ts, body };
    saveState();
    return;
  }

  if (end.includes(group) && trackingStart[symbol]) {
    const s = trackingStart[symbol];
    send(BOT2_TOKEN, BOT2_CHAT,
      `📌 TRACKING 1 COMPLETE
Symbol: ${symbol}
Start Group: ${s.group}
Start Time: ${new Date(s.ts).toLocaleString()}
End Group: ${group} (${body.level || body.fib_level || ""})
End Time: ${new Date(ts).toLocaleString()}`
    );
    delete trackingStart[symbol];
    saveState();
  }
}

function tracking2and3(symbol, group, ts, body) {
  if (!["F","G","H"].includes(group)) return;

  const last = lastBig[symbol];
  if (!last) {
    lastBig[symbol] = ts;
    saveState();
    return;
  }

  const diffH = (ts - last) / 3600000;
  const lvl = body.level || body.fib_level || "";

  if (diffH >= 5) {
    send(BOT2_TOKEN, BOT2_CHAT,
      `⏱ TRACKING 3
Symbol: ${symbol}
Group: ${group} (${lvl})
First F/G/H in over 5 hours
Gap: ${diffH.toFixed(2)} hours
Time: ${new Date(ts).toLocaleString()}`
    );
  } else if (diffH >= 2) {
    send(BOT2_TOKEN, BOT2_CHAT,
      `⏱ TRACKING 2
Symbol: ${symbol}
Group: ${group} (${lvl})
First F/G/H in over 2 hours
Gap: ${diffH.toFixed(2)} hours
Time: ${new Date(ts).toLocaleString()}`
    );
  }

  lastBig[symbol] = ts;
  saveState();
}

// ==========================================================
// BOT 3 — RESTORED (UNCHANGED LOGIC)
// ==========================================================
const lastH = {};
const lastGP = {};
const lastCross = {};

function bot3send(msg) {
  send(BOT3_TOKEN, BOT3_CHAT, msg);
}

function tracking4(symbol, group, ts, body) {
  if (group !== "H" || body.level === undefined) return;
  const lv = Math.abs(Number(body.level));
  if (isNaN(lv)) return;

  const prev = lastH[symbol];
  if (!prev) {
    lastH[symbol] = { lv, raw: body.level, ts };
    return;
  }
  if (prev.lv === lv) return;

  const gap = (ts - prev.ts) / 1000;
  bot3send(
`🔄 TRACKING 4 SWITCH
Symbol: ${symbol}
From: H (${prev.raw})
To: H (${body.level})
Gap: ${Math.floor(gap/60)}m ${Math.floor(gap%60)}s`
  );

  lastH[symbol] = { lv, raw: body.level, ts };
}

function tracking5(symbol, group, ts, body) {
  if (!["G","P"].includes(group)) return;
  const lv = normalize(group, body)[0];
  if (lv === undefined) return;

  const prev = lastGP[symbol];
  if (!prev) {
    lastGP[symbol] = { lv, group, ts };
    return;
  }
  if (prev.lv === lv && prev.group === group) return;

  const gap = (ts - prev.ts) / 1000;
  bot3send(
`🔄 TRACKING 5 SWITCH
Symbol: ${symbol}
From: ${prev.group} (${prev.lv})
To: ${group} (${lv})
Gap: ${Math.floor(gap/60)}m ${Math.floor(gap%60)}s`
  );

  lastGP[symbol] = { lv, group, ts };
}

// ==========================================================
// WEBHOOK
// ==========================================================
app.post("/incoming", (req, res) => {
  const body = req.body || {};
  const symbol = body.symbol;
  const group = body.group;
  if (!symbol || !group) return res.sendStatus(200);

  const ts = Date.now();

  // Bot 1 buffer
  if (!events[group]) events[group] = [];
  events[group].push({ time: ts, data: body });
  prune(events[group], WINDOW_SECONDS * 1000);

  // Bot 2
  tracking1(symbol, group, ts, body);
  tracking2and3(symbol, group, ts, body);

  // Bot 3
  tracking4(symbol, group, ts, body);
  tracking5(symbol, group, ts, body);

  res.sendStatus(200);
});

// ==========================================================
// BOT 1 LOOP
// ==========================================================
setInterval(async () => {
  for (const r of RULES) {
    const counts = {};
    let total = 0;

    for (const g of r.groups) {
      counts[g] = (events[g] || []).length;
      total += counts[g];
    }

    if (total >= r.threshold && (cooldownUntil[r.name] || 0) < Date.now()/1000) {
      let msg = `🚨 Rule "${r.name}" fired: ${total} alerts in ${r.windowSeconds}s\n`;
      for (const g of r.groups) msg += `• ${g} count: ${counts[g]}\n`;
      await send(BOT1_TOKEN, BOT1_CHAT, msg);

      cooldownUntil[r.name] = Date.now()/1000 + COOLDOWN_SECONDS;
      saveState();
    }
  }
}, CHECK_MS);

// ==========================================================
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => console.log("🚀 Server running"));
