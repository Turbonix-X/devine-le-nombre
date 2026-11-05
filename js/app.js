// ===== Devine le Nombre : l'interface, le déroulement des parties, la sauvegarde =====

const SAVE_KEY = "dln-save-v1";
const PREFS_KEY = "tx-prefs";
const GAMES_MAX = 100;
const BONUS_MAX_FREE = 20;     // Indices bonus maximum hors mode Essais limités
const FORBIDDEN_MAX = 1000;

const MODES = {
  classic: { name: "Classique", emoji: "🎯" },
  limited: { name: "Essais limités", emoji: "🎟️" },
  forbidden: { name: "Chiffre interdit", emoji: "☠️" },
  time: { name: "Contre la montre", emoji: "⏱️" },
  hints: { name: "Indices", emoji: "🧩" },
};
const FEEDBACKS = { heat: "🌡️ Chaleur", range: "↕️ Plus / moins", both: "🔥 Les deux", hints: "🧩 Indices" };
const OUTCOMES = {
  win: "Trouvé",
  out: "Plus d'essais",
  mine: "Chiffre interdit",
  time: "Temps écoulé",
  quit: "Abandon",
};

const $ = (id) => document.getElementById(id);
const fmt = Logic.fmt;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, FX.reduced ? Math.min(ms, 30) : ms));
const clampInt = (v, lo, hi, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
const plural = (n, word) => `${fmt(n)} ${word}${n > 1 ? "s" : ""}`;

const els = {};
for (const id of [
  "modes", "modeGlider", "stage", "bubble", "bubbleText", "bot", "arrow", "arrowSlot", "arrowLabel", "gauge", "tempRead", "zoneName", "tempValue",
  "thermo", "thermoScale", "orb", "guessLabel", "guessDigits", "countdown", "stageBanner", "timeBar", "timeFill", "timeBig",
  "setupBox", "minInput", "maxInput", "randRangeBtn", "rangePresets", "rangeInfo", "rangeError", "feedbackBox", "feedbackSwitch",
  "optLimited", "triesInput", "triesPresets", "optForbidden", "forbiddenInput", "forbiddenMax", "forbiddenPresets", "showForbidden",
  "optTime", "durationInput", "durationPresets", "hintsNote", "bonusToggle", "bonusRow", "bonusInput", "bonusNote", "bonusOff",
  "gameBox", "loVal", "hiVal", "spanVal", "rbar", "zbar", "endLo", "endHi", "eliminated", "zoomBox", "zoomLo", "zoomHi",
  "kpiTries", "kpi2Val", "kpi2Label", "kpiBonus", "guessInput", "guessPrompt", "bonusBtn", "guessError", "factsBox", "factsList",
  "endBox", "endTitle", "endTargetLabel", "endTarget", "endStars", "endScore", "endBest", "endRows",
  "mainBtn", "ghostBtn", "result", "hintLine", "triesTitle", "triesList", "triesEmpty",
  "gamesList", "gamesEmpty", "gamesCount", "resetBtn", "statPlayed", "statWins", "statBest", "statAvg", "statBars", "zonesHelp",
  "legend", "legendKicker", "legendTitle", "legendNumber", "legendOdds", "legendText", "legendCopy", "legendClose",
  "soundBtn", "vibBtn", "shareBtn", "clearBtn", "themeBtn", "shareDialog", "shareLink", "copyLinkBtn", "fileWarn", "pasteLink", "loadLinkBtn", "pasteError",
  "exportBtn", "importInput", "confirmDialog", "resetDialog", "toast", "year", "main",
]) els[id] = $(id);


// ---------- État ----------

const defaultCfg = () => ({
  mode: "classic", min: 1, max: 100, feedback: "both", tries: 7, forbidden: 3, showForbidden: false,
  duration: 60, bonusOn: false, bonusCount: 2,
});
const defaultStats = () => ({ played: 0, wins: 0, best: 0, winTries: 0, oneShots: 0, bestByMode: {} });

let app = { cfg: defaultCfg(), stats: defaultStats(), games: [] };
const prefs = { sound: true, vibration: true };
let phase = "idle";   // idle | play | end
let game = null;      // Partie en cours
let busy = false;
let bubbleTimer = null;
let timerId = null;
let quitArmed = 0;
let saveTimer = null;
let tweens = {};
let legendTimers = [];
let lastBrag = "";

const commit = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
};


// ---------- Saisie des nombres ----------

// « 1 000 », « 1000 », « 1k », « 2M », « 1Md » → nombre (NaN si invalide)
function parseNum(text) {
  const s = String(text).replace(/[\s.]/g, "").toLowerCase();
  const m = s.match(/^(\d+)(k|m|md)?$/);
  if (!m) return NaN;
  const factor = { k: 1e3, m: 1e6, md: 1e9 }[m[2]] || 1;
  return Number(m[1]) * factor;
}

// Ajoute les espaces pendant la frappe sans faire sauter le curseur
function liveFormat(input) {
  input.addEventListener("input", () => {
    const raw = input.value;
    if (!/^[\d\s]*$/.test(raw)) return;
    const caret = input.selectionStart ?? raw.length;
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (digits.length > 12) return;
    const out = digits ? fmt(Number(digits)) : "";
    if (out === raw) return;
    input.value = out;
    let pos = 0;
    let seen = 0;
    while (pos < out.length && seen < digitsBefore) {
      if (/\d/.test(out[pos])) seen += 1;
      pos += 1;
    }
    input.setSelectionRange(pos, pos);
  });
}


// ---------- Réglages ----------

const size = () => app.cfg.max - app.cfg.min + 1;
const forbiddenCap = () => Math.max(1, Math.min(FORBIDDEN_MAX, Math.floor(size() / 2)));
const bonusCap = () => (app.cfg.mode === "limited" ? Math.floor(app.cfg.tries / 3) : BONUS_MAX_FREE);

function rangeProblem() {
  const a = parseNum(els.minInput.value);
  const b = parseNum(els.maxInput.value);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return "Écris deux nombres entiers.";
  if (a > Logic.LIMIT || b > Logic.LIMIT) return "Le plus grand nombre possible est 1 000 000 000.";
  if (a >= b) return "Le premier nombre doit être plus petit que le deuxième.";
  return null;
}

function readRange() {
  const problem = rangeProblem();
  els.rangeError.textContent = problem || "";
  els.rangeError.classList.toggle("hidden", !problem);
  if (problem) {
    els.rangeInfo.classList.add("hidden");
    return false;
  }
  app.cfg.min = parseNum(els.minInput.value);
  app.cfg.max = parseNum(els.maxInput.value);
  renderSetup(true);
  commit();
  return true;
}

function positionGlider() {
  const active = els.modes.querySelector(".mode-card.active");
  if (!active) return;
  els.modeGlider.style.width = `${active.offsetWidth}px`;
  els.modeGlider.style.height = `${active.offsetHeight}px`;
  els.modeGlider.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
}

function chipsFor(box, values, current, label = (v) => fmt(v)) {
  box.innerHTML = "";
  for (const v of values) {
    const chip = document.createElement("button");
    chip.className = "chip" + (v === current ? " active" : "");
    chip.dataset.v = v;
    chip.textContent = label(v);
    box.appendChild(chip);
  }
}

function setFeedbackSwitch() {
  const order = ["heat", "range", "both"];
  const idx = Math.max(0, order.indexOf(app.cfg.feedback));
  els.feedbackSwitch.dataset.active = idx;
  els.feedbackSwitch.querySelectorAll("button").forEach((b, i) => b.classList.toggle("active", i === idx));
}

function renderSetup(keepRangeInputs = false) {
  const c = app.cfg;
  if (!keepRangeInputs) {
    els.minInput.value = fmt(c.min);
    els.maxInput.value = fmt(c.max);
  }
  // Modes
  els.modes.querySelectorAll(".mode-card").forEach((b) => b.classList.toggle("active", b.dataset.mode === c.mode));
  positionGlider();

  // Pastilles d'intervalle
  els.rangePresets.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", c.min === 1 && c.max === Number(chip.dataset.max));
  });

  const n = size();
  const opt = Logic.optimalTries(n);
  els.rangeInfo.classList.remove("hidden");
  els.rangeInfo.textContent = `${fmt(n)} nombres possibles. En coupant toujours en deux, il faut au plus ${plural(opt, "essai")}.`;
  els.rangeError.classList.add("hidden");

  // Options selon le mode
  els.feedbackBox.classList.toggle("hidden", c.mode === "hints");
  els.hintsNote.classList.toggle("hidden", c.mode !== "hints");
  els.optLimited.classList.toggle("hidden", c.mode !== "limited");
  els.optForbidden.classList.toggle("hidden", c.mode !== "forbidden");
  els.optTime.classList.toggle("hidden", c.mode !== "time");
  setFeedbackSwitch();

  // Essais limités
  c.tries = clampInt(c.tries, 1, 100, 7);
  if (document.activeElement !== els.triesInput) els.triesInput.value = c.tries;
  chipsFor(els.triesPresets, [...new Set([1, 3, 5, Math.min(100, opt), 10, 20])].sort((a, b) => a - b), c.tries);

  // Chiffres interdits
  const cap = forbiddenCap();
  c.forbidden = clampInt(c.forbidden, 1, cap, 1);
  els.forbiddenInput.max = cap;
  els.forbiddenMax.textContent = `(1 à ${fmt(cap)})`;
  if (document.activeElement !== els.forbiddenInput) els.forbiddenInput.value = c.forbidden;
  chipsFor(els.forbiddenPresets, [...new Set([1, 3, 5, 10, 50, 1000])].filter((v) => v <= cap), c.forbidden);
  els.showForbidden.checked = c.showForbidden;

  // Durée
  c.duration = clampInt(c.duration, 5, 3600, 60);
  if (document.activeElement !== els.durationInput) els.durationInput.value = c.duration;
  els.durationPresets.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", Number(chip.dataset.v) === c.duration));

  // Indices bonus
  const bonusMax = bonusCap();
  const allowed = bonusMax > 0;
  if (!allowed) c.bonusOn = false;
  els.bonusToggle.disabled = !allowed;
  els.bonusToggle.checked = c.bonusOn;
  c.bonusCount = clampInt(c.bonusCount, 1, Math.max(1, bonusMax), 1);
  els.bonusInput.max = bonusMax;
  if (document.activeElement !== els.bonusInput) els.bonusInput.value = c.bonusCount;
  els.bonusRow.classList.toggle("hidden", !c.bonusOn);
  els.bonusNote.textContent = c.mode === "limited"
    ? `Maximum ${bonusMax} : 1 indice par tranche de 3 essais. Chacun enlève 10 % au score s'il est utilisé.`
    : `Maximum ${bonusMax}. Chacun enlève 10 % au score s'il est utilisé.`;
  els.bonusOff.classList.toggle("hidden", allowed);
  els.bonusOff.textContent = allowed ? "" : "Il faut au moins 3 essais pour avoir un indice bonus.";
  if (phase === "idle") renderIdleStage();
}

// Bob fait coucou, puis se calme
let helloTimer = 0;
function sayHello() {
  setMood("hello");
  clearTimeout(helloTimer);
  helloTimer = setTimeout(() => { if (phase === "idle") setMood("neutral"); }, 2600);
}

// Texte d'accueil de la scène
function idleLine() {
  const c = app.cfg;
  const rangeText = `entre ${fmt(c.min)} et ${fmt(c.max)}`;
  switch (c.mode) {
    case "limited": return `Je vais choisir un nombre ${rangeText}. Tu n'auras que ${plural(c.tries, "essai")} !`;
    case "forbidden": return `Je choisis un nombre ${rangeText} et je cache ${plural(c.forbidden, "chiffre")} interdit${c.forbidden > 1 ? "s" : ""}. Ne tombe pas dessus !`;
    case "time": return `Un nombre ${rangeText}, et ${formatDuration(c.duration)} pour le trouver. Prêt ?`;
    case "hints": return `Un nombre ${rangeText}. Je te dirai juste des indices, de plus en plus précis.`;
    default: return `Salut, moi c'est Bob ! Je vais choisir un nombre ${rangeText}. Essaie de le trouver !`;
  }
}

function formatDuration(s) {
  if (s < 60) return `${s} secondes`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} minute${m > 1 ? "s" : ""}`;
}

function renderIdleStage() {
  const fb = app.cfg.mode === "hints" ? "hints" : app.cfg.feedback;
  applyFeedbackLayout(fb);
  say(idleLine(), false);
}


// ---------- Scène ----------

function applyFeedbackLayout(fb) {
  els.stage.dataset.feedback = fb;
  const heat = fb === "heat" || fb === "both";
  els.thermo.style.display = heat ? "" : "none";
  els.tempRead.style.display = heat ? "" : "none";
  els.orb.style.display = fb === "hints" ? "grid" : "none";
  // La flèche va à la place du thermomètre quand elle est seule
  if (fb === "range") els.gauge.insertBefore(els.arrow, els.gauge.querySelector(".guess-num"));
  else els.arrowSlot.appendChild(els.arrow);
  if (phase !== "play" && fb === "range") setArrow("up");
  else if (phase !== "play") setArrow("");
}

function setArrow(dir) {
  // Relance l'animation à chaque réponse
  els.arrow.dataset.dir = "";
  void els.arrow.offsetWidth;
  els.arrow.dataset.dir = dir;
  els.arrowLabel.textContent = dir === "up" ? "Plus haut" : dir === "down" ? "Plus bas" : "";
}

function setMood(mood) {
  els.bot.dataset.mood = mood;
  els.bubble.dataset.tone = mood;
}

// Bob réfléchit : trois points dans la bulle à la place du texte
function sayThinking() {
  clearInterval(bubbleTimer);
  els.bot.classList.remove("talking");
  els.bubble.classList.remove("typing");
  els.bubble.classList.add("thinking");
}

function say(text, pop = true) {
  clearInterval(bubbleTimer);
  els.bubble.classList.remove("thinking");
  if (pop) {
    els.bubble.classList.remove("pop");
    void els.bubble.offsetWidth;
    els.bubble.classList.add("pop");
  }
  if (FX.reduced) {
    els.bubbleText.textContent = text;
    return;
  }
  let i = 0;
  els.bubbleText.textContent = "";
  els.bubble.classList.add("typing");
  els.bot.classList.add("talking");
  bubbleTimer = setInterval(() => {
    i += 2;
    els.bubbleText.textContent = text.slice(0, i);
    if (i >= text.length) {
      clearInterval(bubbleTimer);
      els.bubble.classList.remove("typing");
      els.bot.classList.remove("talking");
    }
  }, 18);
}

function tween(key, from, to, duration, onFrame, onDone) {
  if (tweens[key]) cancelAnimationFrame(tweens[key]);
  if (FX.reduced || duration <= 0) {
    onFrame(to);
    if (onDone) onDone();
    return;
  }
  const start = performance.now();
  const frame = (now) => {
    const k = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - k) ** 3;
    onFrame(from + (to - from) * eased);
    if (k < 1) tweens[key] = requestAnimationFrame(frame);
    else {
      tweens[key] = 0;
      if (onDone) onDone();
    }
  };
  tweens[key] = requestAnimationFrame(frame);
}

let shownTemp = null;

function setTemperature(t, animate = true) {
  const from = shownTemp === null ? 20 : shownTemp;
  const color = Logic.tempColor(t);
  const zone = Logic.zoneOf(t);
  els.stage.style.setProperty("--fluid", color);
  els.stage.style.setProperty("--level", Logic.thermoLevel(t).toFixed(2));
  els.stage.style.setProperty("--cold", t < 15 ? Math.min(1, 0.15 + (15 - t) / 240).toFixed(3) : 0);
  els.stage.style.setProperty("--hot", t >= 60 ? Math.min(1, Math.log10(t / 60) / 2).toFixed(3) : 0);
  els.zoneName.textContent = `${zone.emoji} ${zone.name}`;
  FX.setTemp(t);
  if (!animate) {
    els.tempValue.textContent = Logic.formatTemp(t);
  } else {
    let ticked = -1;
    tween("temp", from, t, 1000, (v) => {
      els.tempValue.textContent = Logic.formatTemp(v);
      const step = Math.floor(performance.now() / 60);
      if (step !== ticked) {
        ticked = step;
        Sound.tick(0.35);
      }
    }, () => { els.tempValue.textContent = Logic.formatTemp(t); });
    els.tempRead.classList.remove("pulse");
    void els.tempRead.offsetWidth;
    els.tempRead.classList.add("pulse");
  }
  shownTemp = t;
  els.thermo.classList.toggle("overheat", t >= 5500);
  els.thermo.classList.toggle("frozen", t < -80);
}

function resetThermo() {
  shownTemp = null;
  if (tweens.temp) cancelAnimationFrame(tweens.temp);
  els.stage.style.setProperty("--fluid", "#9b6dff");
  els.stage.style.setProperty("--level", "20");
  els.stage.style.setProperty("--cold", 0);
  els.stage.style.setProperty("--hot", 0);
  els.zoneName.textContent = "En attente";
  els.tempValue.textContent = "—";
  els.thermo.classList.remove("overheat", "frozen", "bursting");
  FX.setTemp(null);
}

function showDigits(n, cls = "") {
  const text = n === null ? "?" : fmt(n);
  const box = els.guessDigits;
  box.className = "guess-digits" + (cls ? ` ${cls}` : "");
  box.innerHTML = "";
  const width = box.parentElement.clientWidth || 200;
  const chars = Math.max(text.length, 2);
  box.style.fontSize = `${Math.min(window.innerWidth <= 560 ? 36 : 50, width / (chars * 0.58))}px`;
  [...text].forEach((ch, i) => {
    const s = document.createElement("span");
    s.className = "d";
    s.textContent = ch === " " || ch === " " || ch === " " ? " " : ch;
    s.style.animationDelay = `${i * 30}ms`;
    box.appendChild(s);
  });
}

function retrigger(el, cls, ms) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  if (ms) setTimeout(() => el.classList.remove(cls), ms);
}

function shakeInput(el) {
  retrigger(el, "invalid", 400);
}

function flyNumber(n) {
  if (FX.reduced) return;
  const from = els.guessInput.getBoundingClientRect();
  const to = els.guessDigits.getBoundingClientRect();
  if (!from.width || !to.width) return;
  const el = document.createElement("div");
  el.className = "flying-num";
  el.textContent = fmt(n);
  el.style.left = `${from.left + from.width / 2}px`;
  el.style.top = `${from.top + from.height / 2}px`;
  el.style.fontSize = "1.5rem";
  document.body.appendChild(el);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  el.animate([
    { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
    { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.55 - 44}px)) scale(1.5) rotate(-6deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`, opacity: 0.3 },
  ], { duration: 460, easing: "cubic-bezier(.3,.7,.3,1)" }).onfinish = () => el.remove();
}

function burstInStage(amount, big) {
  const zone = els.stage;
  const colors = ["#ffd60a", "#9b6dff", "#ffffff", "#ffe766", "#c4a8ff"];
  if (FX.reduced) return;
  for (let k = 0; k < amount; k++) {
    const p = document.createElement("span");
    p.className = big && k % 3 === 0 ? "particle star" : "particle";
    p.style.background = p.style.color = colors[k % colors.length];
    const s = (big ? 6 : 4) + Math.random() * (big ? 10 : 7);
    p.style.width = p.style.height = `${s}px`;
    if (big) {
      p.style.left = `${20 + Math.random() * 60}%`;
      p.style.top = `${25 + Math.random() * 50}%`;
    }
    zone.appendChild(p);
    const a = Math.random() * Math.PI * 2;
    const d = (big ? 90 : 70) + Math.random() * (big ? 160 : 110);
    p.animate([
      { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.3,1)" }).onfinish = () => p.remove();
  }
}

function stageBanner(title, sub, ms = 3600) {
  const b = els.stageBanner;
  b.innerHTML = "";
  const s = document.createElement("span");
  s.textContent = title;
  const small = document.createElement("small");
  small.textContent = sub;
  b.append(s, small);
  b.classList.remove("hidden");
  b.style.animation = "none";
  void b.offsetWidth;
  b.style.animation = "";
  setTimeout(() => b.classList.add("hidden"), ms);
}


// ---------- Barre de l'intervalle ----------

function renderBar(bar, viewLo, viewHi, segs) {
  const span = Math.max(1, viewHi - viewLo + 1);
  const pct = (n) => ((n - viewLo) / span) * 100;
  const box = bar.querySelector(".rbar-segs");
  while (box.children.length < segs.length) {
    const seg = document.createElement("span");
    seg.className = "rseg";
    seg.style.left = "0%";
    seg.style.width = "100%";
    box.appendChild(seg);
  }
  while (box.children.length > segs.length) box.lastChild.remove();
  segs.forEach(([a, b], i) => {
    const seg = box.children[i];
    seg.style.left = `${pct(a)}%`;
    seg.style.width = `${Math.max(0.2, ((b - a + 1) / span) * 100)}%`;
  });

  const pins = bar.querySelector(".rbar-pins");
  pins.innerHTML = "";
  const list = game.guesses.slice(-80);
  list.forEach((g, i) => {
    if (g.n < viewLo || g.n > viewHi) return;
    const pin = document.createElement("span");
    const last = i === list.length - 1;
    pin.className = "pin" + (last ? " latest" : "") + (last && game.pinFresh ? " new" : "");
    pin.style.left = `${pct(g.n + 0.5)}%`;
    pin.style.setProperty("--c", g.t === null ? "#ffffff" : Logic.tempColor(g.t));
    pin.title = fmt(g.n);
    pins.appendChild(pin);
  });
  if (game.showForbidden) {
    let k = 0;
    for (const m of game.mines) {
      if (k >= 150) break;
      if (m < viewLo || m > viewHi) continue;
      const pin = document.createElement("span");
      pin.className = "pin mine" + (game.guesses.length ? "" : " reveal");
      pin.style.left = `${pct(m + 0.5)}%`;
      pin.style.animationDelay = `${k * 40}ms`;
      pin.textContent = "☠️";
      pin.title = fmt(m);
      pins.appendChild(pin);
      k += 1;
    }
  }
}

function renderRange(animate) {
  const g = game;
  const lo = g.segs[0][0];
  const hi = g.segs[g.segs.length - 1][1];
  const count = Logic.segCount(g.segs);

  if (animate) {
    if (lo !== g.shownLo) {
      const oldLo = g.shownLo;
      tween("lo", oldLo, lo, 800, (v) => { els.loVal.textContent = fmt(Math.round(v)); });
      retrigger(els.loVal.parentElement, "bump", 700);
      crumbleBar(oldLo, lo);
    }
    if (hi !== g.shownHi) {
      const oldHi = g.shownHi;
      tween("hi", oldHi, hi, 800, (v) => { els.hiVal.textContent = fmt(Math.round(v)); });
      retrigger(els.hiVal.parentElement, "bump", 700);
      crumbleBar(hi + 1, oldHi + 1);
    }
    tween("span", g.shownCount, count, 800, (v) => { els.spanVal.textContent = fmt(Math.round(v)); });
  } else {
    els.loVal.textContent = fmt(lo);
    els.hiVal.textContent = fmt(hi);
    els.spanVal.textContent = fmt(count);
  }
  g.shownLo = lo;
  g.shownHi = hi;
  g.shownCount = count;

  els.endLo.textContent = fmt(g.lo0);
  els.endHi.textContent = fmt(g.hi0);
  const out = 1 - count / g.size;
  els.eliminated.textContent = count === g.size ? "" : `${out >= 0.9999 ? ">99,99" : (out * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % éliminés`;
  renderBar(els.rbar, g.lo0, g.hi0, g.segs);

  // Zoom quand ce qui reste devient trop petit pour bien se voir
  const zoom = (hi - lo + 1) / g.size < 0.12 && hi > lo;
  els.zoomBox.classList.toggle("hidden", !zoom);
  if (zoom) {
    const pad = Math.max(1, Math.round((hi - lo) * 0.1));
    const vLo = Math.max(g.lo0, lo - pad);
    const vHi = Math.min(g.hi0, hi + pad);
    els.zoomLo.textContent = fmt(vLo);
    els.zoomHi.textContent = fmt(vHi);
    renderBar(els.zbar, vLo, vHi, g.segs);
  }
}

// Fait tomber en morceaux la partie de la barre qui vient d'être éliminée
function crumbleBar(fromN, toN) {
  const r = els.rbar.getBoundingClientRect();
  const pctA = (fromN - game.lo0) / game.size;
  const pctB = (toN - game.lo0) / game.size;
  FX.crumble({ left: r.left + r.width * pctA, right: r.left + r.width * pctB, top: r.top, bottom: r.bottom, width: r.width * (pctB - pctA) }, 34);
}


// ---------- Lancer une partie ----------

function placeMines(lo, hi, target, count) {
  const mines = new Set();
  while (mines.size < count) {
    const n = Logic.randInt(lo, hi);
    if (n !== target) mines.add(n);
  }
  return mines;
}

async function startGame() {
  if (busy || phase === "play") return;
  const problem = rangeProblem();
  if (problem) {
    readRange();
    shakeInput(els.minInput);
    Sound.error();
    return;
  }
  readRange();
  const c = app.cfg;
  const lo = c.min;
  const hi = c.max;
  const target = Logic.randInt(lo, hi);
  const fb = c.mode === "hints" ? "hints" : c.feedback;
  const bonus = c.bonusOn && bonusCap() > 0 ? Math.min(c.bonusCount, bonusCap()) : 0;

  game = {
    mode: c.mode, feedback: fb, lo0: lo, hi0: hi, size: hi - lo + 1, width: hi - lo, target,
    segs: [[lo, hi]], guesses: [], facts: [],
    limit: c.mode === "limited" ? c.tries : 0,
    forbidden: c.mode === "forbidden" ? c.forbidden : 0,
    showForbidden: c.mode === "forbidden" && c.showForbidden,
    mines: c.mode === "forbidden" ? placeMines(lo, hi, target, c.forbidden) : new Set(),
    duration: c.mode === "time" ? c.duration : 0,
    endAt: 0, startedAt: 0, frozenLeft: null,
    bonusTotal: bonus, bonusLeft: bonus, bonusUsed: 0,
    engine: Logic.createFactEngine(target),
    shownLo: lo, shownHi: hi, shownCount: hi - lo + 1, pinFresh: false,
  };

  phase = "play";
  setBusy(true);
  try {
    Sound.whoosh();
    Haptics.buzz(15);
    FX.clearStage();
    resetThermo();
    applyFeedbackLayout(fb);
    setArrow("");
    showDigits(null);
    els.guessLabel.textContent = "Ton nombre";
    els.stage.classList.remove("jackpot", "danger", "boom");
    els.stage.dataset.phase = "play";
    els.result.textContent = "";
    els.setupBox.classList.add("hidden");
    els.endBox.classList.add("hidden");
    els.gameBox.classList.remove("hidden");
    els.factsBox.classList.add("hidden");
    els.factsList.innerHTML = "";
    els.guessInput.value = "";
    els.guessError.classList.add("hidden");
    els.triesList.innerHTML = "";
    els.triesEmpty.classList.add("hidden");
    els.triesTitle.textContent = "Tes essais";
    els.modes.querySelectorAll(".mode-card").forEach((b) => { b.disabled = true; });
    updateActions();
    renderRange(false);
    renderKpis();
    setHintLine();

    if (c.mode === "time") await countdown();

    if (phase !== "play") return;
    setMood("neutral");
    if (fb === "hints") {
      giveFact(false);
    } else {
      const rangeText = `entre ${fmt(lo)} et ${fmt(hi)}`;
      say(c.mode === "forbidden"
        ? `J'ai choisi mon nombre ${rangeText}, et ${plural(game.forbidden, "piège")} ${game.showForbidden ? "sont sur la barre" : "sont cachés"} !`
        : `J'ai choisi mon nombre ${rangeText}. À toi de jouer !`);
    }
    if (c.mode === "time") startTimer();
    game.startedAt = performance.now();
  } finally {
    setBusy(false);
  }
  focusGuess();
}

function focusGuess() {
  if (phase === "play" && matchMedia("(hover: hover)").matches) els.guessInput.focus();
}

async function countdown() {
  const box = els.countdown;
  box.classList.remove("hidden");
  for (const label of ["3", "2", "1", "GO !"]) {
    box.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = label;
    box.appendChild(s);
    Sound.beep(label === "GO !");
    Haptics.buzz(label === "GO !" ? 60 : 15);
    await wait(label === "GO !" ? 420 : 720);
    if (phase !== "play") break;
  }
  box.classList.add("hidden");
}

function startTimer() {
  els.timeBar.classList.remove("hidden");
  els.timeBig.classList.remove("hidden");
  game.endAt = performance.now() + game.duration * 1000;
  let lastSec = null;
  clearInterval(timerId);
  const tick = () => {
    if (phase !== "play") return;
    const left = Math.max(0, (game.endAt - performance.now()) / 1000);
    els.timeFill.style.transform = `scaleX(${left / game.duration})`;
    const sec = Math.ceil(left);
    if (sec !== lastSec) {
      lastSec = sec;
      els.timeBig.textContent = sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : `${sec} s`;
      els.kpi2Val.textContent = els.timeBig.textContent;
      const low = sec <= 10 && sec > 0;
      els.timeBig.classList.toggle("low", low);
      els.kpi2Val.classList.toggle("low", low);
      els.stage.classList.toggle("danger", low);
      if (low) {
        Sound.heart();
        Haptics.buzz(20);
      }
    }
    if (left <= 0) endGame("time");
  };
  tick();
  timerId = setInterval(tick, 100);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  els.stage.classList.remove("danger");
  els.timeBig.classList.remove("low");
  els.kpi2Val.classList.remove("low");
}

function setBusy(on) {
  busy = on;
  document.body.classList.toggle("busy", on);
  els.mainBtn.disabled = on;
  els.guessInput.readOnly = on;
  els.bonusBtn.disabled = on;
}

function setHintLine() {
  if (phase === "play") {
    els.hintLine.innerHTML = "Astuce : <kbd>Entrée</kbd> pour valider · tu peux écrire <code>1 000</code>, <code>2k</code>, <code>3M</code> ou <code>1Md</code>.";
  } else {
    els.hintLine.innerHTML = "Astuce : <kbd>Espace</kbd> pour lancer la partie · tu peux écrire <code>2k</code>, <code>3M</code> ou <code>1Md</code> dans les champs.";
  }
}

function updateActions() {
  document.body.dataset.phase = phase;
  const main = els.mainBtn;
  const ghost = els.ghostBtn;
  clearTimeout(quitArmed);
  quitArmed = 0;
  if (phase === "idle") {
    main.textContent = `${MODES[app.cfg.mode].emoji} Lancer la partie`;
    ghost.classList.add("hidden");
  } else if (phase === "play") {
    main.textContent = "🔎 Valider ce nombre";
    ghost.textContent = "🏳️ Abandonner";
    ghost.classList.remove("hidden");
  } else {
    main.textContent = "🔁 Rejouer";
    ghost.textContent = "⚙️ Changer les réglages";
    ghost.classList.remove("hidden");
  }
}

function renderKpis() {
  const g = game;
  retriggerText(els.kpiTries, String(g.guesses.length));
  els.kpiBonus.parentElement.style.display = g.bonusTotal ? "" : "none";
  els.kpiBonus.textContent = g.bonusTotal ? `${g.bonusLeft}/${g.bonusTotal}` : "0";
  els.bonusBtn.classList.toggle("hidden", !g.bonusTotal);
  els.bonusBtn.textContent = `💡 Indice (${g.bonusLeft})`;
  els.bonusBtn.style.display = g.bonusLeft > 0 ? "" : "none";

  const second = els.kpi2Val;
  second.classList.remove("low");
  if (g.mode === "limited") {
    const left = g.limit - g.guesses.length;
    els.kpi2Label.textContent = left > 1 ? "restants" : "restant";
    retriggerText(second, String(left));
    second.classList.toggle("low", left <= 1);
  } else if (g.mode === "forbidden") {
    els.kpi2Label.textContent = "interdits";
    second.textContent = fmt(g.forbidden);
  } else if (g.mode === "time") {
    els.kpi2Label.textContent = "temps";
    second.textContent = `${g.duration} s`;
  } else if (g.mode === "hints") {
    els.kpi2Label.textContent = "indices";
    second.textContent = String(g.facts.length);
  } else {
    els.kpi2Label.textContent = "essai idéal";
    second.textContent = String(Logic.optimalTries(g.size, g.feedback));
  }
}

function retriggerText(el, text) {
  if (el.textContent !== text) retrigger(el, "pop", 500);
  el.textContent = text;
}


// ---------- Un essai ----------

function guessProblem(n) {
  const g = game;
  if (!Number.isInteger(n)) return "Écris un nombre entier.";
  if (n < g.lo0 || n > g.hi0) return `Ton nombre doit être entre ${fmt(g.lo0)} et ${fmt(g.hi0)}.`;
  if (g.guesses.some((x) => x.n === n)) return `Tu as déjà essayé ${fmt(n)} !`;
  const lo = g.segs[0][0];
  const hi = g.segs[g.segs.length - 1][1];
  if (n < lo || n > hi) return `${fmt(n)} est déjà éliminé : il reste de ${fmt(lo)} à ${fmt(hi)}. Cet essai ne compte pas.`;
  return null;
}

async function submitGuess() {
  if (phase !== "play" || busy) return;
  const n = parseNum(els.guessInput.value);
  const problem = guessProblem(n);
  if (problem) {
    els.guessError.textContent = problem;
    els.guessError.classList.remove("hidden");
    shakeInput(els.guessInput);
    Sound.error();
    Haptics.buzz(30);
    focusGuess();
    return;
  }
  els.guessError.classList.add("hidden");

  const g = game;
  // Le chrono s'arrête dès la validation si c'est gagné
  const left = g.mode === "time" ? Math.max(0, (g.endAt - performance.now()) / 1000) : 0;
  const isWin = n === g.target;
  const isMine = g.mines.has(n);
  if (g.mode === "time" && (isWin || isMine)) {
    g.frozenLeft = left;
    stopTimer();
  }

  setBusy(true);
  try {
    Sound.whoosh();
    Haptics.buzz(10);
    flyNumber(n);
    setMood("think");
    Sound.think();
    sayThinking();
    await wait(g.mode === "time" ? 170 : 460);
    if (phase !== "play") return;
    els.guessInput.value = "";

    if (isMine) {
      recordGuess(n, null, null);
      await endGame("mine");
    } else if (isWin) {
      recordGuess(n, Logic.HIT, null);
      await endGame("win");
    } else {
      answerWrong(n);
      if (g.mode === "limited" && g.guesses.length >= g.limit) await endGame("out");
      else if (Logic.segCount(g.segs) === 1) {
        // Plus qu'un seul nombre possible : pas besoin de le taper, et aucun essai de plus
        g.lastLeft = true;
        if (g.mode === "time") {
          g.frozenLeft = left;
          stopTimer();
        }
        await wait(900);
        if (phase === "play") await endGame("win");
      }
    }
  } finally {
    setBusy(false);
  }
  focusGuess();
}

function recordGuess(n, t, dir) {
  const g = game;
  g.guesses.push({ n, t, dir });
  g.pinFresh = true;
  addTryItem(g.guesses.length, n, t, dir, n === g.target, g.mines.has(n));
  showDigits(n);
  renderKpis();
}

function answerWrong(n) {
  const g = game;
  const d = Math.abs(n - g.target);
  const t = Logic.temperature(d, g.width);
  const zone = Logic.zoneOf(t);
  const dir = g.target > n ? "up" : "down";
  const heat = g.feedback === "heat" || g.feedback === "both";
  const range = g.feedback === "range" || g.feedback === "both";

  recordGuess(n, heat ? t : null, range ? dir : null);

  // Ce que le joueur vient d'apprendre
  if (heat) {
    const radius = Logic.heatRadius(d);
    g.segs = Logic.intersect(g.segs, [[n - radius, n + radius]]);
  }
  if (range) g.segs = Logic.intersect(g.segs, dir === "up" ? [[n + 1, g.hi0]] : [[g.lo0, n - 1]]);
  g.segs = Logic.subtract(g.segs, n);
  renderRange(true);
  g.pinFresh = false;

  const dirText = dir === "up" ? "C'est plus haut." : "C'est plus bas.";

  if (g.feedback === "hints") {
    setMood("neutral");
    giveFact(false);
    els.result.innerHTML = "";
    setResultLine(n, "pas encore !");
    return;
  }

  if (heat) {
    setTemperature(t);
    Sound.heat(Logic.thermoLevel(t));
    if (t < 0) Sound.ice();
    else if (t >= 300) Sound.fire(Math.min(1, t / 6000));
    if (t >= 9000) {
      retrigger(els.stage, "shake-3", 950);
      Haptics.buzz([40, 30, 60]);
    } else if (t >= 3000) {
      retrigger(els.stage, "shake-2", 650);
      Haptics.buzz(35);
    } else if (t >= 300 || t <= -200) {
      retrigger(els.stage, "shake-1", 380);
      Haptics.buzz(15);
    }
    if (t >= 3000) burstInStage(Math.round(t / 400), false);
    setMood(zone.mood);
  } else {
    setMood("neutral");
  }
  if (range) {
    setArrow(dir);
    if (dir === "up") Sound.up(); else Sound.down();
    Haptics.buzz(12);
  }

  let line;
  if (g.feedback === "both") line = `${Logic.pick(zone.say)} ${dirText}`;
  else if (g.feedback === "heat") line = Logic.pick(zone.say);
  else line = Logic.pick(dir === "up" ? ["Plus haut !", "Vise plus haut !", "Non, c'est au-dessus !", "Encore plus grand !"] : ["Plus bas !", "Vise plus bas !", "Non, c'est en dessous !", "Encore plus petit !"]);
  say(line);

  const parts = [];
  if (heat) parts.push(`${zone.emoji} ${Logic.formatTemp(t)}`);
  if (range) parts.push(dir === "up" ? "⬆️ plus haut" : "⬇️ plus bas");
  setResultLine(n, parts.join(" · "));
}

function setResultLine(n, text) {
  const r = els.result;
  r.innerHTML = "";
  const label = document.createElement("span");
  label.className = "result-label line";
  label.textContent = `Essai n°${game.guesses.length}`;
  const strong = document.createElement("strong");
  strong.textContent = fmt(n);
  const rest = document.createElement("span");
  rest.textContent = `→ ${text}`;
  r.append(label, strong, rest);
  retrigger(r, "reveal");
}

// Le dernier nombre possible, trouvé par Bob : il ne compte pas comme un essai
function addFreeItem(n) {
  const li = document.createElement("li");
  li.className = "recent-item try-item good";
  const num = document.createElement("span");
  num.className = "recent-obj";
  num.textContent = "Bob";
  const arrow = document.createElement("span");
  arrow.className = "recent-arrow";
  arrow.textContent = "→";
  const strong = document.createElement("strong");
  strong.textContent = fmt(n);
  const info = document.createElement("small");
  info.textContent = "🎁 Pas compté";
  li.append(num, arrow, strong, info);
  els.triesList.prepend(li);
}

function addTryItem(index, n, t, dir, good, mine) {
  const li = document.createElement("li");
  li.className = "recent-item try-item" + (good ? " good" : "") + (mine ? " mine" : "");
  if (t !== null && !good) li.style.setProperty("--c", Logic.tempColor(t));
  const num = document.createElement("span");
  num.className = "recent-obj";
  num.textContent = `n°${index}`;
  const arrow = document.createElement("span");
  arrow.className = "recent-arrow";
  arrow.textContent = "→";
  const strong = document.createElement("strong");
  strong.textContent = fmt(n);
  const info = document.createElement("small");
  if (good) info.textContent = "🎯 Trouvé !";
  else if (mine) info.textContent = "☠️ Interdit";
  else {
    const bits = [];
    if (t !== null) bits.push(`${Logic.zoneOf(t).emoji} ${Logic.formatTemp(t)}`);
    if (dir) bits.push(dir === "up" ? "⬆️" : "⬇️");
    info.textContent = bits.join(" ") || "❌ Raté";
  }
  li.append(num, arrow, strong, info);
  els.triesList.prepend(li);
}


// ---------- Indices ----------

function giveFact(isBonus) {
  const g = game;
  const boost = isBonus ? 2 : 0;
  const fact = g.engine.next(g.segs, boost);
  g.facts.push({ text: fact.text, bonus: isBonus });
  const li = document.createElement("li");
  li.className = "fact" + (isBonus ? " bonus" : "");
  const b = document.createElement("b");
  b.textContent = isBonus ? "💡" : `n°${g.facts.length}`;
  const span = document.createElement("span");
  span.textContent = fact.text;
  li.append(b, span);
  els.factsList.prepend(li);
  els.factsBox.classList.remove("hidden");

  if (fact.range) {
    const before = Logic.segCount(g.segs);
    g.segs = Logic.intersect(g.segs, [fact.range]);
    if (Logic.segCount(g.segs) !== before) renderRange(true);
  }
  Sound.hint();
  say(isBonus ? `Indice bonus : ${fact.text}` : fact.text);
  if (g.feedback === "hints") retrigger(els.orb, "flash", 750);
  renderKpis();
}

function useBonus() {
  if (phase !== "play" || busy || game.bonusLeft <= 0) return;
  game.bonusLeft -= 1;
  game.bonusUsed += 1;
  setMood("think");
  giveFact(true);
  setTimeout(() => { if (phase === "play") setMood("neutral"); }, 600);
  Haptics.buzz(15);
  focusGuess();
}


// ---------- Fin de partie ----------

async function endGame(outcome) {
  if (phase !== "play") return;
  const g = game;
  phase = "end";
  stopTimer();
  clearInterval(bubbleTimer);
  els.timeBar.classList.add("hidden");
  els.timeBig.classList.add("hidden");
  els.modes.querySelectorAll(".mode-card").forEach((b) => { b.disabled = false; });

  const win = outcome === "win";
  const elapsed = g.startedAt ? (performance.now() - g.startedAt) / 1000 : 0;
  let result = { total: 0, rows: [], stars: 0 };
  if (win) {
    const timeLeft = g.mode === "time" ? (g.frozenLeft ?? 0) : 0;
    result = Logic.score({
      size: g.size, tries: g.guesses.length, mode: g.mode, feedback: g.feedback, limit: g.limit,
      forbidden: g.forbidden, showForbidden: g.showForbidden, duration: g.duration, timeLeft, bonusUsed: g.bonusUsed, lastLeft: g.lastLeft,
    });
  }

  const isRecord = recordGame(g, outcome, result.total, elapsed);
  renderEnd(g, outcome, result, isRecord);
  updateActions();
  setHintLine();
  renderGames();
  renderStats();
  commit();

  els.gameBox.classList.add("hidden");
  els.endBox.classList.remove("hidden");

  if (win) playWin(g);
  else playLoss(g, outcome);
}

function renderEnd(g, outcome, result, isRecord) {
  const win = outcome === "win";
  const n = g.guesses.length;
  els.endTitle.className = `end-title ${win ? "win" : "lose"}`;
  els.endTitle.textContent = win
    ? (n === 1 && !g.lastLeft ? "🎯 Du premier coup !" : `🎉 Trouvé en ${plural(n, "essai")} !`)
    : { out: "💀 Plus d'essais !", mine: "💥 Chiffre interdit !", time: "⏰ Temps écoulé !", quit: "🏳️ Partie abandonnée" }[outcome];
  els.endTargetLabel.textContent = win ? "Le nombre était bien" : "Le nombre était";
  els.endTarget.textContent = fmt(g.target);

  els.endStars.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const s = document.createElement("span");
    s.textContent = "★";
    if (i < result.stars) {
      s.className = "on";
      s.style.animationDelay = `${0.2 + i * 0.22}s`;
    }
    els.endStars.appendChild(s);
  }
  tween("score", 0, result.total, win ? 1300 : 0, (v) => { els.endScore.textContent = fmt(Math.round(v)); });
  els.endBest.classList.toggle("hidden", !isRecord);

  els.endRows.innerHTML = "";
  const rows = win ? result.rows : [
    { label: "Essais réalisés", value: String(n) },
    { label: "Pas de points sur une défaite", value: "0 pt" },
  ];
  if (g.forbidden) {
    const shown = [...g.mines].sort((a, b) => a - b).slice(0, 12).map(fmt).join(" · ");
    rows.push({ label: `☠️ Interdits : ${shown}${g.mines.size > 12 ? " …" : ""}`, value: fmt(g.mines.size) });
  }
  rows.forEach((row, i) => {
    const li = document.createElement("li");
    li.style.animationDelay = `${0.1 + i * 0.09}s`;
    const a = document.createElement("span");
    a.textContent = row.label;
    const b = document.createElement("b");
    b.textContent = row.value;
    li.append(a, b);
    els.endRows.appendChild(li);
  });
  els.triesTitle.textContent = `Tes essais : ${plural(n, "essai")} dans cette partie`;
  els.triesEmpty.classList.toggle("hidden", n > 0);
}

function playWin(g) {
  const oneShot = g.guesses.length === 1 && !g.lastLeft;
  const tier = oneShot ? Logic.oneShotTier(g.size) : 0;
  if (g.lastLeft) addFreeItem(g.target);
  showDigits(g.target, "win");
  els.guessLabel.textContent = "Le nombre !";
  setMood("happy");
  if (g.feedback !== "hints" && els.thermo.style.display !== "none") {
    setTemperature(Logic.HIT);
    els.zoneName.textContent = "🎯 TROUVÉ !";
    retrigger(els.thermo, "bursting");
    setTimeout(() => {
      if (phase !== "end") return;
      const r = els.thermo.getBoundingClientRect();
      FX.explode(r.left + 60, r.top + 20, 90, ["#ffd60a", "#ffffff", "#ffe766", "#ff8a3c"], 1.3);
      Sound.boom();
    }, 620);
  }
  if (g.feedback === "range") setArrow("");
  if (g.feedback === "hints") els.orb.querySelector("span").textContent = "✓";

  say(g.lastLeft ? `Il ne restait plus que ${fmt(g.target)} ! Pas besoin d'un essai de plus, c'est gagné !` : oneShot ? "QUOI ?! Du premier coup ?! Tu as triché, avoue !" : Logic.pick(["Bravo, tu l'as trouvé !", "Bien joué ! C'était bien celui-là !", "Exactement ! Tu m'as eu !"]));
  retrigger(els.stage, "landed", 1000);
  burstInStage(40, false);
  Sound.win();
  Haptics.buzz([20, 40, 30]);
  FX.confetti(tier ? 60 : 130);
  setResultWin(g);

  if (oneShot) {
    if (tier) {
      setTimeout(() => showLegend(tier, g), 500);
    } else {
      els.stage.classList.add("jackpot");
      stageBanner("DU PREMIER COUP !", `1 chance sur ${fmt(g.size)}`);
      Sound.fanfare(1);
      burstInStage(40, true);
      setTimeout(() => els.stage.classList.remove("jackpot"), 3600);
    }
  }
}

function setResultWin(g) {
  const r = els.result;
  r.innerHTML = "";
  const label = document.createElement("span");
  label.className = "result-label line";
  label.textContent = "Résultat";
  const strong = document.createElement("strong");
  strong.textContent = fmt(g.target);
  const rest = document.createElement("span");
  rest.textContent = `trouvé en ${plural(g.guesses.length, "essai")}`;
  r.append(label, strong, rest);
  retrigger(r, "reveal");
}

function playLoss(g, outcome) {
  showDigits(g.target, "lost");
  els.guessLabel.textContent = "Le nombre était";
  els.result.innerHTML = "";
  const label = document.createElement("span");
  label.className = "result-label line";
  label.textContent = "Résultat";
  const strong = document.createElement("strong");
  strong.textContent = fmt(g.target);
  const rest = document.createElement("span");
  rest.textContent = `était le nombre à trouver`;
  els.result.append(label, strong, rest);
  retrigger(els.result, "reveal");

  if (outcome === "mine") {
    const lastN = g.guesses[g.guesses.length - 1].n;
    say(`BOUM ! ${fmt(lastN)} était un chiffre interdit ! Le nombre à trouver était ${fmt(g.target)}.`);
    setMood("dead");
    els.stage.style.setProperty("--fluid", "#ff2d3d");
    els.stage.style.setProperty("--hot", 1);
    FX.setTemp(4000);
    retrigger(els.stage, "boom", 950);
    retrigger(els.main, "earthquake", 950);
    const r = els.stage.getBoundingClientRect();
    FX.explode(r.left + r.width / 2, r.top + r.height / 2, 140, ["#ff4d6d", "#ff8a3c", "#ffd60a", "#ffffff"], 1.8);
    Sound.boom();
    Haptics.buzz([120, 50, 200]);
  } else if (outcome === "time") {
    say(`Temps écoulé ! Me voilà congelé… Le nombre était ${fmt(g.target)}.`);
    setMood("frozen");
    if (els.thermo.style.display !== "none") setTemperature(Logic.ABS_ZERO);
    else {
      els.stage.style.setProperty("--cold", 1);
      FX.setTemp(Logic.ABS_ZERO);
    }
    Sound.freeze();
    Haptics.buzz([60, 40, 120]);
  } else if (outcome === "out") {
    say(`Tu n'as plus d'essais ! Le nombre était ${fmt(g.target)}. Une revanche ?`);
    setMood("sad");
    Sound.lose();
    Haptics.buzz([60, 40, 60]);
  } else {
    say(`Tu abandonnes ? Le nombre était ${fmt(g.target)}. À bientôt !`);
    setMood("sad");
    Sound.lose();
  }
}

function recordGame(g, outcome, points, elapsed) {
  const win = outcome === "win";
  const n = g.guesses.length;
  if (outcome === "quit" && n === 0) return false;
  const stats = app.stats;
  stats.played += 1;
  let isRecord = false;
  if (win) {
    stats.wins += 1;
    stats.winTries += n;
    if (n === 1 && !g.lastLeft) stats.oneShots += 1;
    if (points > stats.best) {
      isRecord = stats.best > 0;
      stats.best = points;
    }
    if (points > (stats.bestByMode[g.mode] || 0)) stats.bestByMode[g.mode] = points;
  }
  app.games.unshift({
    m: g.mode, f: g.feedback, lo: g.lo0, hi: g.hi0, t: g.target, o: outcome, s: points, d: Date.now(),
    el: Math.round(elapsed),
    l: g.limit, x: g.forbidden, du: g.duration, b: g.bonusUsed, a: g.lastLeft ? 1 : 0,
    g: g.guesses.map((x) => [x.n, x.t === null ? null : Math.round(x.t * 100) / 100, x.dir === "up" ? 1 : x.dir === "down" ? -1 : 0]),
  });
  app.games.length = Math.min(app.games.length, GAMES_MAX);
  return isRecord;
}

function backToIdle() {
  phase = "idle";
  game = null;
  stopTimer();
  clearInterval(bubbleTimer);
  els.timeBar.classList.add("hidden");
  els.timeBig.classList.add("hidden");
  els.stage.classList.remove("jackpot", "danger", "boom");
  els.stage.dataset.phase = "idle";
  els.endBox.classList.add("hidden");
  els.gameBox.classList.add("hidden");
  els.setupBox.classList.remove("hidden");
  els.result.textContent = "";
  els.triesList.innerHTML = "";
  els.triesEmpty.classList.remove("hidden");
  els.triesTitle.textContent = "Tes essais";
  els.modes.querySelectorAll(".mode-card").forEach((b) => { b.disabled = false; });
  els.orb.querySelector("span").textContent = "?";
  els.guessLabel.textContent = "Ton nombre";
  resetThermo();
  FX.clearStage();
  sayHello();
  showDigits(null);
  renderSetup();
  updateActions();
  setHintLine();
}


// ---------- Le grand message du premier coup ----------

const LEGENDS = {
  1: {
    kicker: "Du premier coup !",
    title: "INCROYABLE !",
    text: () => "Un seul essai, et c'est le bon. Bob vérifie ses circuits : tout marche. C'est juste toi qui es trop fort.",
  },
  2: {
    kicker: "Bob n'en croit pas ses capteurs",
    title: "LÉGENDAIRE !!!",
    text: () => "Tu viens de trouver le bon nombre du premier coup parmi plus d'un million. Les statistiques disent que c'est impossible. Elles se trompaient. Ce moment entre dans l'histoire de Turbonix.",
  },
  3: {
    kicker: "Un seul essai. Un milliard de possibilités.",
    title: "DIVIN",
    text: (g) => `C'est environ ${fmt(Math.round(g.size / 19068840))} fois moins probable que de gagner le gros lot du Loto avec une seule grille. Le thermomètre a fondu, Bob s'incline, et Turbonix Entertainment te décerne le titre suprême. Montre vite cet écran à tout le monde : personne ne te croira.`,
  },
};

function showLegend(tier, g) {
  const def = LEGENDS[tier];
  const box = els.legend;
  box.className = `legend tier-${tier}`;
  els.legendKicker.textContent = def.kicker;
  els.legendNumber.textContent = fmt(g.target);
  els.legendOdds.textContent = `1 chance sur ${fmt(g.size)}`;
  els.legendText.textContent = def.text(g);
  els.legendTitle.textContent = def.title;
  if (tier === 3) {
    els.legendTitle.setAttribute("aria-label", def.title);
    els.legendTitle.innerHTML = "";
    [...def.title].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch;
      s.style.animationDelay = `${0.9 + i * 0.13}s`;
      els.legendTitle.appendChild(s);
    });
  } else {
    els.legendTitle.removeAttribute("aria-label");
  }
  lastBrag = `J'ai trouvé ${fmt(g.target)} du premier coup sur ${fmt(g.size)} nombres à Devine le Nombre (Turbonix) ! 1 chance sur ${fmt(g.size)} !`;
  box.classList.remove("hidden");
  els.legendClose.focus({ preventScroll: true });

  const timer = (fn, ms) => legendTimers.push(setTimeout(fn, ms));
  const repeat = (fn, ms) => legendTimers.push(setInterval(fn, ms));
  Sound.fanfare(tier);
  Haptics.buzz(tier === 3 ? [100, 50, 100, 50, 100, 50, 400] : [60, 40, 60, 40, 200]);

  if (tier === 1) {
    FX.confetti(220);
    timer(() => FX.firework(), 300);
    timer(() => FX.firework(), 800);
    timer(() => FX.firework(), 1300);
  } else if (tier === 2) {
    retrigger(els.main, "earthquake", 950);
    FX.confetti(380);
    FX.startStream(undefined, 1);
    for (let i = 0; i < 6; i++) timer(() => FX.firework(), 200 + i * 480);
    repeat(() => FX.firework(), 1300);
  } else {
    const gold = ["#ffd60a", "#fff6a8", "#ffffff", "#e6b800", "#ffe45c"];
    timer(() => {
      retrigger(els.main, "earthquake", 950);
      FX.confetti(700, gold);
      FX.startStream(gold, 3);
      for (let i = 0; i < 12; i++) timer(() => FX.firework(gold), i * 230);
    }, 1400);
    repeat(() => { FX.firework(gold); FX.firework(); }, 700);
  }
}

function closeLegend() {
  legendTimers.forEach((id) => { clearTimeout(id); clearInterval(id); });
  legendTimers = [];
  FX.stopStream();
  els.legend.classList.add("hidden");
}


// ---------- Historique et statistiques ----------

function renderGames() {
  const list = els.gamesList;
  list.innerHTML = "";
  els.gamesEmpty.classList.toggle("hidden", app.games.length > 0);
  els.gamesCount.textContent = app.games.length ? `${plural(app.games.length, "partie")} (les ${GAMES_MAX} dernières au maximum)` : "";
  app.games.forEach((p, idx) => {
    const win = p.o === "win";
    const li = document.createElement("li");
    li.className = `game-item ${win ? "win" : "lose"}`;
    if (idx < 12) li.style.animationDelay = `${idx * 0.03}s`;

    const top = document.createElement("div");
    top.className = "game-top";
    const title = document.createElement("strong");
    title.textContent = `${MODES[p.m].emoji} ${MODES[p.m].name} · ${win ? "🏆" : "❌"} ${OUTCOMES[p.o]}`;
    const pts = document.createElement("span");
    pts.className = "game-score";
    pts.textContent = win ? `${fmt(p.s)} pts` : "0 pt";
    top.append(title, pts);

    const meta = document.createElement("div");
    meta.className = "game-meta";
    const addBold = (text) => {
      const b = document.createElement("b");
      b.textContent = text;
      meta.appendChild(b);
    };
    addBold(plural(p.g.length, "essai"));
    meta.append(` · de ${fmt(p.lo)} à ${fmt(p.hi)} · le nombre était `);
    addBold(fmt(p.t));
    const extras = [];
    if (p.m === "limited") extras.push(`limite de ${p.l}`);
    if (p.m === "forbidden") extras.push(plural(p.x, "interdit"));
    if (p.m === "time") extras.push(`chrono de ${p.du} s`);
    if (p.b) extras.push(`${p.b} indice${p.b > 1 ? "s" : ""} bonus`);
    extras.push(FEEDBACKS[p.f]);
    extras.push(new Date(p.d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    meta.append(` · ${extras.join(" · ")}`);

    const chips = document.createElement("div");
    chips.className = "gchips";
    p.g.forEach(([n, t, dir]) => {
      const chip = document.createElement("span");
      const good = n === p.t;
      const mine = p.o === "mine" && n === p.g[p.g.length - 1][0];
      chip.className = "gchip" + (good ? " good" : "") + (mine ? " mine" : "");
      chip.textContent = fmt(n) + (good ? " 🎯" : mine ? " ☠️" : dir === 1 ? " ⬆" : dir === -1 ? " ⬇" : "");
      if (t !== null && !good) {
        chip.style.setProperty("--c", Logic.tempColor(t));
        chip.title = Logic.formatTemp(t);
      }
      chips.appendChild(chip);
    });
    if (p.a) {
      const chip = document.createElement("span");
      chip.className = "gchip good";
      chip.textContent = `${fmt(p.t)} 🎁 pas compté`;
      chips.appendChild(chip);
    }
    li.append(top, meta, chips);
    list.appendChild(li);
  });
}

function renderStats() {
  const s = app.stats;
  els.statPlayed.textContent = fmt(s.played);
  els.statWins.textContent = s.played ? `${fmt(s.wins)} (${Math.round((s.wins / s.played) * 100)} %)` : "—";
  els.statBest.textContent = s.best ? fmt(s.best) : "—";
  els.statAvg.textContent = s.wins ? (s.winTries / s.wins).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) : "—";
  const top = Math.max(1, ...Object.values(s.bestByMode));
  els.statBars.innerHTML = "";
  for (const [id, m] of Object.entries(MODES)) {
    const v = s.bestByMode[id] || 0;
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("div");
    label.className = "bar-label";
    const a = document.createElement("span");
    a.textContent = `${m.emoji} ${m.name}`;
    const b = document.createElement("small");
    b.textContent = v ? `${fmt(v)} pts` : "—";
    label.append(a, b);
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = "0%";
    bar.appendChild(fill);
    row.append(label, bar);
    els.statBars.appendChild(row);
    requestAnimationFrame(() => { fill.style.width = `${(v / top) * 100}%`; });
  }
}

function renderZonesHelp() {
  const samples = [10000, 9999, 9000, 5500, 3000, 1000, 300, 100, 60, 30, 15, 0, -20, -80, -200, -272.4, -273.15];
  els.zonesHelp.innerHTML = "";
  Logic.ZONES.forEach((z, i) => {
    const li = document.createElement("li");
    const dot = document.createElement("i");
    const color = Logic.tempColor(samples[i]);
    dot.style.background = dot.style.color = color;
    const name = document.createElement("strong");
    name.textContent = `${z.emoji} ${z.name}`;
    const from = document.createElement("span");
    if (i === 0) from.textContent = "10 000 °C";
    else if (i === 1) from.textContent = "9 999 °C";
    else if (i === Logic.ZONES.length - 1) from.textContent = "0 K (−273,15 °C)";
    else from.textContent = `dès ${Logic.formatTemp(z.min)}`;
    li.append(dot, name, from);
    els.zonesHelp.appendChild(li);
  });
}

function renderThermoScale() {
  els.thermoScale.innerHTML = "";
  for (const [t, label] of [[10000, "10 000°"], [5000, "5 000°"], [1000, "1 000°"], [100, "100°"], [0, "0°"], [Logic.ABS_ZERO, "0 K"]]) {
    const s = document.createElement("span");
    s.style.bottom = `${Logic.thermoLevel(t)}%`;
    s.textContent = label;
    els.thermoScale.appendChild(s);
  }
}


// ---------- Sauvegarde ----------

function serialize() {
  return { v: 1, cfg: app.cfg, stats: app.stats, games: app.games };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (e) { /* stockage indisponible */ }
}

function savePrefs() {
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...all, sound: prefs.sound, vibration: prefs.vibration }));
  } catch (e) { /* stockage indisponible */ }
}

function sanitizeCfg(o) {
  const c = defaultCfg();
  if (!o || typeof o !== "object") return c;
  if (MODES[o.mode]) c.mode = o.mode;
  if (["heat", "range", "both"].includes(o.feedback)) c.feedback = o.feedback;
  const min = clampInt(o.min, 0, Logic.LIMIT, 1);
  const max = clampInt(o.max, 0, Logic.LIMIT, 100);
  if (min < max) {
    c.min = min;
    c.max = max;
  }
  c.tries = clampInt(o.tries, 1, 100, c.tries);
  c.forbidden = clampInt(o.forbidden, 1, FORBIDDEN_MAX, c.forbidden);
  c.showForbidden = o.showForbidden === true;
  c.duration = clampInt(o.duration, 5, 3600, c.duration);
  c.bonusOn = o.bonusOn === true;
  c.bonusCount = clampInt(o.bonusCount, 1, BONUS_MAX_FREE, c.bonusCount);
  return c;
}

function sanitizeGames(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const p of list.slice(0, GAMES_MAX)) {
    if (!p || !MODES[p.m] || !OUTCOMES[p.o] || !FEEDBACKS[p.f] || !Array.isArray(p.g)) continue;
    out.push({
      m: p.m, f: p.f, o: p.o,
      lo: clampInt(p.lo, 0, Logic.LIMIT, 0), hi: clampInt(p.hi, 0, Logic.LIMIT, 0), t: clampInt(p.t, 0, Logic.LIMIT, 0),
      s: clampInt(p.s, 0, 1e12, 0), d: clampInt(p.d, 0, 9e15, 0), el: clampInt(p.el, 0, 1e7, 0),
      a: p.a === 1 ? 1 : 0, l: clampInt(p.l, 0, 100, 0), x: clampInt(p.x, 0, FORBIDDEN_MAX, 0), du: clampInt(p.du, 0, 3600, 0), b: clampInt(p.b, 0, BONUS_MAX_FREE, 0),
      g: p.g.filter(Array.isArray).slice(0, 5000).map(([n, t, dir]) => [
        clampInt(n, 0, Logic.LIMIT, 0),
        Number.isFinite(t) ? Math.max(Logic.ABS_ZERO, Math.min(Logic.HIT, t)) : null,
        dir === 1 || dir === -1 ? dir : 0,
      ]),
    });
  }
  return out;
}

function sanitizeStats(o) {
  const s = defaultStats();
  if (!o || typeof o !== "object") return s;
  s.played = clampInt(o.played, 0, 1e12, 0);
  s.wins = clampInt(o.wins, 0, s.played, 0);
  s.best = clampInt(o.best, 0, 1e12, 0);
  s.winTries = clampInt(o.winTries, 0, 1e15, 0);
  s.oneShots = clampInt(o.oneShots, 0, 1e12, 0);
  if (o.bestByMode && typeof o.bestByMode === "object") {
    for (const id of Object.keys(MODES)) {
      if (Number.isFinite(o.bestByMode[id])) s.bestByMode[id] = clampInt(o.bestByMode[id], 0, 1e12, 0);
    }
  }
  return s;
}

function applyData(data) {
  app = { cfg: sanitizeCfg(data.cfg), stats: sanitizeStats(data.stats), games: sanitizeGames(data.games) };
}

function loadSave() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    if (p) {
      prefs.sound = p.sound !== false;
      prefs.vibration = p.vibration !== false;
    }
  } catch (e) { /* rien à charger */ }
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (data && data.cfg) applyData(data);
  } catch (e) { /* sauvegarde illisible : on garde les valeurs par défaut */ }
}

function exportFile() {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "devine-le-nombre-sauvegarde.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Fichier téléchargé 💾");
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !data.cfg) throw new Error("format");
      applyData(data);
      backToIdle();
      renderGames();
      renderStats();
      commit();
      els.shareDialog.close();
      toast("Sauvegarde chargée depuis le fichier ✔");
    } catch (e) {
      toast("Ce fichier n'est pas une sauvegarde valide.");
    }
  };
  reader.readAsText(file);
}


// ---------- Lien de partage ----------

function b64urlEncode(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function encodeShare() {
  return "j" + b64urlEncode(new TextEncoder().encode(JSON.stringify(app.cfg)));
}

function decodeShare(code) {
  if (code[0] !== "j") throw new Error("lien invalide");
  return JSON.parse(new TextDecoder().decode(b64urlDecode(code.slice(1))));
}

function extractCode(text) {
  const m = text.match(/[#?&]c=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  const t = text.trim();
  return /^j[A-Za-z0-9_-]+$/.test(t) ? t : null;
}

function loadCode(code) {
  const data = decodeShare(code);
  if (!data || typeof data !== "object" || !MODES[data.mode]) throw new Error("lien invalide");
  app.cfg = sanitizeCfg(data);
  if (phase !== "idle") backToIdle();
  renderSetup();
  updateActions();
  commit();
}

function openShare() {
  els.pasteError.classList.add("hidden");
  els.pasteLink.value = "";
  els.fileWarn.classList.toggle("hidden", location.protocol !== "file:");
  els.shareLink.value = `${location.href.split("#")[0]}#c=${encodeShare()}`;
  els.shareDialog.showModal();
  els.shareLink.select();
}

async function copyText(text, input) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    if (input) {
      input.select();
      document.execCommand("copy");
    }
  }
}

function loadFromHash() {
  const code = extractCode(location.hash);
  if (!code) return;
  try {
    loadCode(code);
    toast("Réglages chargés depuis le lien 🔗");
  } catch (e) {
    toast("Le lien de configuration est invalide.");
  }
  history.replaceState(null, "", location.pathname + location.search);
}


// ---------- Préférences, notifications ----------

function renderPrefs() {
  Sound.enabled = prefs.sound;
  Haptics.enabled = prefs.vibration;
  els.soundBtn.classList.toggle("off", !prefs.sound);
  els.soundBtn.setAttribute("aria-pressed", prefs.sound);
  els.soundBtn.title = prefs.sound ? "Sons activés" : "Sons coupés";
  els.vibBtn.classList.toggle("off", !prefs.vibration);
  els.vibBtn.setAttribute("aria-pressed", prefs.vibration);
  els.vibBtn.title = prefs.vibration
    ? (navigator.vibrate ? "Vibrations activées" : "Vibrations activées (sur téléphone uniquement)")
    : "Vibrations coupées";
}

let toastTimer = null;
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}


// ---------- Événements ----------

els.soundBtn.addEventListener("click", () => {
  prefs.sound = !prefs.sound;
  renderPrefs();
  savePrefs();
  Sound.click();
  toast(prefs.sound ? "Sons activés 🔊" : "Sons coupés 🔇");
});
els.vibBtn.addEventListener("click", () => {
  prefs.vibration = !prefs.vibration;
  renderPrefs();
  savePrefs();
  Sound.click();
  Haptics.buzz(30);
  toast(prefs.vibration ? "Vibrations activées 📳" : "Vibrations coupées");
});
els.themeBtn.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try {
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    all.theme = theme;
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch (e) { /* stockage indisponible */ }
  Sound.click();
});
els.shareBtn.addEventListener("click", openShare);
els.clearBtn.addEventListener("click", () => {
  els.confirmDialog.returnValue = "";
  els.confirmDialog.showModal();
});
els.resetBtn.addEventListener("click", () => {
  els.resetDialog.returnValue = "";
  els.resetDialog.showModal();
});
els.confirmDialog.addEventListener("close", () => {
  if (els.confirmDialog.returnValue !== "ok") return;
  try {
    localStorage.removeItem(SAVE_KEY);
    const all = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    delete all.sound;
    delete all.vibration;
    localStorage.setItem(PREFS_KEY, JSON.stringify(all));
  } catch (e) { /* stockage indisponible */ }
  clearTimeout(saveTimer);
  app = { cfg: defaultCfg(), stats: defaultStats(), games: [] };
  prefs.sound = prefs.vibration = true;
  backToIdle();
  renderPrefs();
  renderGames();
  renderStats();
  toast("Sauvegarde effacée 🗑️");
});
els.resetDialog.addEventListener("close", () => {
  if (els.resetDialog.returnValue !== "ok") return;
  app.stats = defaultStats();
  app.games = [];
  renderGames();
  renderStats();
  commit();
  toast("Statistiques remises à zéro");
});

els.copyLinkBtn.addEventListener("click", async () => {
  await copyText(els.shareLink.value, els.shareLink);
  toast("Lien copié ! 🔗");
});
els.loadLinkBtn.addEventListener("click", () => {
  const code = extractCode(els.pasteLink.value);
  try {
    if (!code) throw new Error("vide");
    loadCode(code);
    els.shareDialog.close();
    toast("Réglages chargés ✔");
  } catch (e) {
    els.pasteError.textContent = "Ce lien ne contient pas de réglages valides.";
    els.pasteError.classList.remove("hidden");
  }
});
els.exportBtn.addEventListener("click", exportFile);
els.importInput.addEventListener("change", () => {
  if (els.importInput.files[0]) importFile(els.importInput.files[0]);
  els.importInput.value = "";
});

// Réglages
els.modes.addEventListener("click", (e) => {
  const card = e.target.closest(".mode-card");
  if (!card || card.disabled) return;
  if (phase === "end") backToIdle();
  app.cfg.mode = card.dataset.mode;
  Sound.click();
  renderSetup();
  updateActions();
  commit();
});
els.feedbackSwitch.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  app.cfg.feedback = b.dataset.feedback;
  Sound.click();
  renderSetup();
  commit();
});
[els.minInput, els.maxInput].forEach((input) => {
  liveFormat(input);
  input.addEventListener("input", readRange);
  input.addEventListener("blur", () => {
    const v = parseNum(input.value);
    if (Number.isFinite(v)) input.value = fmt(v);
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
});
els.rangePresets.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  app.cfg.min = 1;
  app.cfg.max = Number(chip.dataset.max);
  Sound.click();
  renderSetup();
  commit();
});
els.randRangeBtn.addEventListener("click", () => {
  const max = Logic.randomLogInt(10, Logic.LIMIT);
  app.cfg.min = Math.random() < 0.7 ? 1 : Logic.randInt(0, Math.floor(max / 2));
  app.cfg.max = max;
  Sound.click();
  renderSetup();
  commit();
});

function numberOption(input, box, key, lo, hi) {
  input.addEventListener("input", () => {
    const v = Number(input.value);
    if (!Number.isInteger(v) || v < lo() || v > hi()) return;
    app.cfg[key] = v;
    renderSetup();
    commit();
  });
  input.addEventListener("blur", () => {
    input.value = app.cfg[key];
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") startGame(); });
  if (box) {
    box.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      app.cfg[key] = Number(chip.dataset.v);
      input.value = chip.dataset.v;
      Sound.click();
      renderSetup();
      commit();
    });
  }
}
numberOption(els.triesInput, els.triesPresets, "tries", () => 1, () => 100);
numberOption(els.forbiddenInput, els.forbiddenPresets, "forbidden", () => 1, forbiddenCap);
numberOption(els.durationInput, els.durationPresets, "duration", () => 5, () => 3600);
numberOption(els.bonusInput, null, "bonusCount", () => 1, () => Math.max(1, bonusCap()));

els.showForbidden.addEventListener("change", () => {
  app.cfg.showForbidden = els.showForbidden.checked;
  Sound.click();
  commit();
});
els.bonusToggle.addEventListener("change", () => {
  app.cfg.bonusOn = els.bonusToggle.checked;
  Sound.click();
  renderSetup();
  commit();
});

// Partie
liveFormat(els.guessInput);
els.guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitGuess();
  }
});
els.guessInput.addEventListener("input", () => els.guessError.classList.add("hidden"));
els.bonusBtn.addEventListener("click", useBonus);

els.mainBtn.addEventListener("click", () => {
  if (phase === "play") submitGuess();
  else startGame();
});
els.ghostBtn.addEventListener("click", () => {
  if (phase === "end") {
    Sound.click();
    backToIdle();
    return;
  }
  if (phase !== "play" || busy) return;
  if (!quitArmed) {
    els.ghostBtn.textContent = "Vraiment ? Clique encore";
    quitArmed = setTimeout(() => {
      quitArmed = 0;
      if (phase === "play") els.ghostBtn.textContent = "🏳️ Abandonner";
    }, 3000);
    return;
  }
  clearTimeout(quitArmed);
  quitArmed = 0;
  endGame("quit");
});

// Grand message
els.legendClose.addEventListener("click", closeLegend);
els.legendCopy.addEventListener("click", async () => {
  await copyText(lastBrag);
  toast("Exploit copié ! 📋");
});

// Raccourcis clavier
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.legend.classList.contains("hidden")) {
    closeLegend();
    return;
  }
  if (e.code !== "Space" || e.repeat) return;
  const tag = e.target.tagName;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY", "A"].includes(tag)) return;
  if (document.querySelector("dialog[open]") || !els.legend.classList.contains("hidden")) return;
  e.preventDefault();
  if (phase === "play") {
    els.guessInput.focus();
    return;
  }
  startGame();
});

// Bob suit la souris du regard
document.addEventListener("pointermove", (e) => {
  if (FX.reduced || els.bot.dataset.mood === "think") return;
  const r = els.bot.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height * 0.42);
  const len = Math.hypot(dx, dy) || 1;
  const reach = Math.min(1, len / 240);
  els.bot.querySelector(".bob-eyes").style.transform = `translate(${(dx / len) * 6 * reach}px, ${(dy / len) * 4 * reach}px)`;
  els.bot.style.setProperty("--look", ((dx / len) * reach).toFixed(2));
}, { passive: true });

if ("ResizeObserver" in window) new ResizeObserver(positionGlider).observe(els.modes);
// Bob réagit quand on le touche (hors partie, il répond aussi, pour ne pas cacher une réponse)
const BOB_POKES = [
  "Hé, ça chatouille !",
  "Je suis Bob, pas un bouton !",
  "Tu ne me feras pas dire le nombre, je ne l'ai même pas encore choisi.",
  "Mon réacteur est très sensible, doucement !",
  "Si tu appuies encore, je mets 10 000 degrés.",
  "Oui ? Tu veux jouer ?",
];
els.bot.addEventListener("click", () => {
  retrigger(els.bot, "poked", 520);
  Sound.tick(1);
  Haptics.buzz(10);
  if (phase === "idle") say(Logic.pick(BOB_POKES));
});
window.addEventListener("load", positionGlider);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionGlider);
window.addEventListener("beforeunload", save);


// ---------- Démarrage ----------

els.year.textContent = new Date().getFullYear();
FX.init($("stageFx"), $("topFx"));
loadSave();
renderThermoScale();
renderZonesHelp();
renderPrefs();
renderSetup();
updateActions();
setHintLine();
showDigits(null);
sayHello();
renderGames();
renderStats();
loadFromHash();
