// ===== Logique pure du jeu : hasard, températures, intervalles, score, indices =====

const Logic = (() => {
  const LIMIT = 1e9;           // Le plus grand nombre autorisé
  const ABS_ZERO = -273.15;    // 0 kelvin, en degrés
  const HIT = 10000;           // Nombre trouvé
  const NEXT = 9999;           // Juste à côté

  const fmt = (n) => Number(n).toLocaleString("fr-FR");

  // ---------- Hasard ----------

  // Entier uniforme entre lo et hi inclus (sans biais, via crypto si possible)
  function randInt(lo, hi) {
    const range = hi - lo + 1;
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0x100000000 / range) * range;
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return lo + (buf[0] % range);
    }
    return lo + Math.floor(Math.random() * range);
  }

  const pick = (list) => list[randInt(0, list.length - 1)];

  // Autant de chances de tomber sur un petit que sur un grand nombre
  const randomLogInt = (min, max) => Math.round(Math.exp(Math.log(min) + Math.random() * (Math.log(max) - Math.log(min))));

  // ---------- Températures ----------

  function interp(knots, x) {
    if (x <= knots[0][0]) return knots[0][1];
    for (let i = 1; i < knots.length; i++) {
      if (x <= knots[i][0]) {
        const [x0, y0] = knots[i - 1];
        const [x1, y1] = knots[i];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return knots[knots.length - 1][1];
  }

  // Température selon la proximité relative (en puissances de 10)
  const CLOSENESS = [[0, ABS_ZERO], [0.125, -120], [0.3, 15], [0.6, 200], [1, 1000], [2, 4000], [3, 6000], [6, 8500], [9.1, 9500]];

  // d : distance au nombre, width : écart entre les deux bornes de départ.
  // Plus d est petit, plus c'est chaud. La fonction ne remonte jamais quand d grandit.
  function temperature(d, width) {
    if (d <= 0) return HIT;
    if (d === 1) return NEXT;
    if (d >= width) return ABS_ZERO;
    const u = -Math.log10(d / width);
    const s = u / Math.log10(width);
    const t = (1 - s ** 3) * interp(CLOSENESS, u) + s ** 3 * NEXT;
    return Math.min(NEXT - 1, t);
  }

  // Du plus chaud au plus froid. « min » est la température minimale de la zone.
  const ZONES = [
    { min: HIT, name: "TROUVÉ !", emoji: "🎯", mood: "happy", say: ["Trouvé !"] },
    { min: NEXT, name: "Juste à côté !", emoji: "💥", mood: "shock", say: ["9 999 degrés ! Tu y es presque, c'est juste à côté !", "Tu me brûles les circuits ! Plus qu'un petit pas !"] },
    { min: 9000, name: "Plasma stellaire", emoji: "⚡", mood: "shock", say: ["Plasma ! Tu es à deux doigts !", "Mes capteurs fondent, tu y es presque !"] },
    { min: 5500, name: "Plus chaud que le Soleil", emoji: "☀️", mood: "hot", say: ["Plus chaud que la surface du Soleil !", "Ça devient vraiment dangereux pour moi, là !"] },
    { min: 3000, name: "Fournaise", emoji: "🔆", mood: "hot", say: ["Une vraie fournaise, le métal fond !", "Waouh, tu chauffes énormément !"] },
    { min: 1000, name: "Lave en fusion", emoji: "🌋", mood: "hot", say: ["De la lave en fusion ! Continue par là !", "Ça brûle fort, tu es sur la bonne piste !"] },
    { min: 300, name: "Brûlant", emoji: "🔥", mood: "hot", say: ["Brûlant ! Tu te rapproches !", "Je commence à transpirer !"] },
    { min: 100, name: "Très chaud", emoji: "♨️", mood: "hot", say: ["Ça bout ! C'est très chaud !", "Ça chauffe bien, là !"] },
    { min: 60, name: "Chaud", emoji: "☕", mood: "neutral", say: ["Chaud comme un bon café.", "C'est chaud, continue !"] },
    { min: 30, name: "Ça chauffe", emoji: "🌡️", mood: "neutral", say: ["Ça commence à chauffer.", "Pas mal, ça se réchauffe !"] },
    { min: 15, name: "Tiède", emoji: "🌤️", mood: "neutral", say: ["Tiède. Ni chaud ni froid.", "Bof, c'est tiède."] },
    { min: 0, name: "Frais", emoji: "🍃", mood: "neutral", say: ["C'est plutôt frais par ici.", "Frais… tu peux faire mieux."] },
    { min: -20, name: "Froid", emoji: "❄️", mood: "cold", say: ["Il fait froid par ici !", "Brrr, c'est froid."] },
    { min: -80, name: "Gelé", emoji: "🧊", mood: "cold", say: ["Gelé ! On se croirait dans un congélateur.", "Mes doigts se transforment en glaçons."] },
    { min: -200, name: "Glacial", emoji: "🥶", mood: "cold", say: ["Glacial ! Tu es très loin.", "Mes circuits gèlent, tu n'y es pas du tout !"] },
    { min: -272.5, name: "Cryogénique", emoji: "🪐", mood: "cold", say: ["Il fait aussi froid que sur Pluton !", "Tu es à des années-lumière du nombre !"] },
    { min: -Infinity, name: "ZÉRO ABSOLU", emoji: "🌌", mood: "cold", say: ["0 kelvin. HYYYYYPER loin ! Impossible d'être plus froid !", "Zéro absolu ! Même les atomes ne bougent plus !"] },
  ];

  const zoneOf = (t) => ZONES.find((z) => t >= z.min);

  function formatTemp(t) {
    if (t <= -272.5) return "−273,15 °C";
    const v = Math.abs(t) >= 100 ? Math.round(t) : Math.round(t * 10) / 10;
    return fmt(v).replace("-", "−") + " °C";
  }

  // Hauteur (en %) sur la graduation du thermomètre
  const SCALE = [[ABS_ZERO, 0], [-100, 9], [0, 20], [20, 25], [100, 33], [300, 43], [1000, 56], [3000, 71], [6000, 85], [9000, 94], [NEXT, 98], [HIT, 100]];
  const thermoLevel = (t) => interp(SCALE, t);

  const COLORS = [
    [ABS_ZERO, [106, 77, 255]], [-200, [74, 108, 255]], [-80, [56, 189, 248]], [0, [127, 227, 255]],
    [20, [46, 230, 166]], [60, [184, 233, 134]], [100, [255, 228, 92]], [300, [255, 176, 32]],
    [1000, [255, 106, 31]], [3000, [255, 45, 61]], [5500, [255, 130, 90]], [7500, [255, 214, 170]],
    [9000, [232, 244, 255]], [NEXT, [255, 255, 255]], [HIT, [255, 214, 10]],
  ];
  function tempColor(t) {
    const c = [0, 1, 2].map((i) => Math.round(interp(COLORS.map(([x, rgb]) => [x, rgb[i]]), t)));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  // Ce que la chaleur apprend au joueur pour resserrer la barre : une tranche de distances
  // (1, 2-3, 4-15, 16-63, 64-255…). Elle reste utile à toutes les échelles sans tout dévoiler.
  function bandDistances(d) {
    if (d <= 1) return { dMin: 1, dMax: 1 };
    let dMin = 4;
    while (dMin * 4 <= d) dMin *= 4;
    if (d < 4) return { dMin: 2, dMax: 3 };
    return { dMin, dMax: dMin * 4 - 1 };
  }

  // ---------- Morceaux d'intervalle encore possibles ----------

  function intersect(segs, allowed) {
    const out = [];
    for (const [a, b] of segs) {
      for (const [c, d] of allowed) {
        const lo = Math.max(a, c);
        const hi = Math.min(b, d);
        if (lo <= hi) out.push([lo, hi]);
      }
    }
    return out.sort((x, y) => x[0] - y[0]);
  }

  function subtract(segs, n) {
    const out = [];
    for (const [a, b] of segs) {
      if (n < a || n > b) { out.push([a, b]); continue; }
      if (a <= n - 1) out.push([a, n - 1]);
      if (n + 1 <= b) out.push([n + 1, b]);
    }
    return out;
  }

  const segCount = (segs) => segs.reduce((sum, [a, b]) => sum + b - a + 1, 0);
  const inSegs = (segs, n) => segs.some(([a, b]) => n >= a && n <= b);

  // ---------- Score ----------

  // Essais qu'il faut pour un très bon joueur : plus Bob en dit, moins il en faut
  const IDEAL_SHARE = { range: 1, heat: 0.65, both: 0.5, hints: 0.6 };
  const optimalTries = (size, feedback = "range") => Math.max(1, Math.ceil(Math.log2(size) * IDEAL_SHARE[feedback]));

  // Niveau de l'exploit quand on trouve du premier coup : 0 à 3
  function oneShotTier(size) {
    if (size >= LIMIT) return 3;
    if (size >= 1e6) return 2;
    if (size > 1e4) return 1;
    return 0;
  }

  const FEEDBACK_BONUS = { both: 1, range: 1.1, heat: 1.25, hints: 1.4 };
  const times = (m) => `×${m.toFixed(2).replace(".", ",")}`;

  // Détail du score : la base dépend de l'écart des deux nombres, le reste des essais et du mode
  function score(o) {
    const opt = optimalTries(o.size, o.feedback);
    const base = Math.round(100 * Math.log2(o.size));
    const n = o.tries;
    const eff = n <= opt ? 1 + (opt - n) / opt : opt / n;
    const rows = [
      { label: `Intervalle de ${fmt(o.size)} nombres`, value: `${fmt(base)} pts` },
      { label: `${n} essai${n > 1 ? "s" : ""} (idéal : ${opt})`, value: times(eff) },
    ];
    let total = base * eff;
    const mult = (label, m) => {
      if (Math.abs(m - 1) < 0.005) return;
      rows.push({ label, value: times(m) });
      total *= m;
    };
    mult(o.feedback === "hints" ? "Seulement avec des indices" : o.feedback === "heat" ? "Seulement la chaleur" : "Seulement plus haut / plus bas", FEEDBACK_BONUS[o.feedback] || 1);
    if (o.mode === "limited") mult(`Limite de ${o.limit} essai${o.limit > 1 ? "s" : ""}`, 1 + 0.5 * Math.min(2, opt / o.limit));
    if (o.mode === "forbidden") {
      mult(o.showForbidden ? "Chiffres interdits visibles" : `${fmt(o.forbidden)} chiffre${o.forbidden > 1 ? "s" : ""} interdit${o.forbidden > 1 ? "s" : ""} cachés`,
        o.showForbidden ? 1.05 : 1 + Math.min(1, 0.1 + (4 * o.forbidden) / o.size));
    }
    if (o.mode === "time") {
      const pressure = 0.5 * Math.min(1, (opt * 4) / o.duration);
      mult(`Contre la montre (${Math.round(o.timeLeft)} s restantes)`, 1 + pressure + 0.5 * (o.timeLeft / o.duration));
    }
    if (o.bonusUsed > 0) mult(`${o.bonusUsed} indice${o.bonusUsed > 1 ? "s" : ""} bonus utilisé${o.bonusUsed > 1 ? "s" : ""}`, 0.9 ** o.bonusUsed);
    if (n === 1) mult("Du premier coup !", [1, 2, 5, 10][oneShotTier(o.size)]);
    return { total: Math.max(1, Math.round(total)), rows, stars: eff >= 1 ? 3 : eff >= 0.6 ? 2 : 1 };
  }

  // ---------- Indices ----------

  function isPrime(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    if (n % 3 === 0) return n === 3;
    for (let i = 5; i * i <= n; i += 6) {
      if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
  }
  const digitsOf = (n) => String(n).split("").map(Number);
  const digitSum = (n) => digitsOf(n).reduce((a, b) => a + b, 0);
  const isSquare = (n) => Number.isInteger(Math.sqrt(n));
  const isCube = (n) => Math.round(Math.cbrt(n)) ** 3 === n;
  const isPowerOf2 = (n) => n > 0 && Number.isInteger(Math.log2(n));
  const isPalindrome = (n) => { const s = String(n); return s === s.split("").reverse().join(""); };
  const hasRepeat = (n) => new Set(String(n)).size < String(n).length;
  const evenDigits = (n) => digitsOf(n).filter((d) => d % 2 === 0).length;

  // Tous les indices vrais pour ce nombre
  function buildFacts(t, lo, hi) {
    const facts = [];
    const add = (id, cat, text, test, range) => facts.push({ id, cat, text, test, range });

    add("parity", "parite", t % 2 === 0 ? "C'est un nombre pair." : "C'est un nombre impair.", (n) => n % 2 === t % 2);
    for (const k of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25, 50, 100, 250, 500, 1000, 10000, 100000]) {
      if (t > 0 && t % k === 0) add(`mult${k}`, "division", `C'est un multiple de ${fmt(k)}.`, (n) => n % k === 0);
    }
    for (const k of [3, 5, 7, 9]) {
      if (t % k !== 0) add(`notmult${k}`, "division", `Ce n'est pas un multiple de ${k}.`, (n) => n % k !== 0);
    }
    for (const k of [3, 4, 7, 9, 11, 13]) {
      const r = t % k;
      if (r > 0) add(`rem${k}`, "division", `Si tu le divises par ${k}, il reste ${r}.`, (n) => n % k === r);
    }

    const ds = digitsOf(t);
    const first = ds[0];
    const last = ds[ds.length - 1];
    add("digits", "taille", `Il s'écrit avec ${ds.length} chiffre${ds.length > 1 ? "s" : ""}.`, (n) => String(n).length === ds.length);
    add("lastHigh", "fin", last >= 5 ? "Son dernier chiffre vaut 5 ou plus." : "Son dernier chiffre est plus petit que 5.", (n) => (n % 10 >= 5) === (last >= 5));
    add("last", "fin", `Il se termine par ${last}.`, (n) => n % 10 === last);
    if (t >= 100) add("last2", "fin", `Ses deux derniers chiffres sont ${String(t % 100).padStart(2, "0")}.`, (n) => n % 100 === t % 100);
    if (ds.length > 1) {
      add("firstHigh", "debut", first >= 5 ? "Son premier chiffre vaut 5 ou plus." : "Son premier chiffre est plus petit que 5.", (n) => (digitsOf(n)[0] >= 5) === (first >= 5));
      add("first", "debut", `Il commence par ${first}.`, (n) => digitsOf(n)[0] === first);
    }
    if (ds.length > 2) {
      const two = String(t).slice(0, 2);
      add("first2", "debut", `Il commence par ${two}.`, (n) => String(n).slice(0, 2) === two);
    }

    const sum = digitSum(t);
    add("sumParity", "somme", `La somme de ses chiffres est ${sum % 2 === 0 ? "paire" : "impaire"}.`, (n) => digitSum(n) % 2 === sum % 2);
    const band = Math.floor(sum / 5) * 5;
    add("sumBand", "somme", `La somme de ses chiffres est entre ${band} et ${band + 4}.`, (n) => { const v = digitSum(n); return v >= band && v <= band + 4; });
    add("sum", "somme", `La somme de ses chiffres vaut ${sum}.`, (n) => digitSum(n) === sum);

    const prime = isPrime(t);
    add("prime", "special", prime ? "C'est un nombre premier." : "Ce n'est pas un nombre premier.", (n) => isPrime(n) === prime);
    if (isSquare(t)) add("square", "special", "C'est un carré parfait.", isSquare);
    if (t > 1 && isCube(t)) add("cube", "special", "C'est un cube parfait.", isCube);
    if (isPowerOf2(t)) add("pow2", "special", "C'est une puissance de 2.", isPowerOf2);
    if (t >= 10 && isPalindrome(t)) add("palin", "special", "Il se lit pareil dans les deux sens.", isPalindrome);

    if (ds.length > 1) {
      const rep = hasRepeat(t);
      add("repeat", "chiffres", rep ? "Au moins un de ses chiffres apparaît plusieurs fois." : "Tous ses chiffres sont différents.", (n) => hasRepeat(n) === rep);
      const ev = evenDigits(t);
      add("evens", "chiffres", ev === 0 ? "Il n'a aucun chiffre pair." : `Il a ${ev} chiffre${ev > 1 ? "s" : ""} pair${ev > 1 ? "s" : ""}.`, (n) => evenDigits(n) === ev);
    }
    const shown = [...new Set(ds)];
    const d = pick(shown);
    add(`has${d}`, "chiffres", `Il contient le chiffre ${d}.`, (n) => String(n).includes(String(d)));
    const absent = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !shown.includes(x));
    if (absent.length) {
      const a = pick(absent);
      add(`no${a}`, "chiffres", `Il ne contient aucun ${a}.`, (n) => !String(n).includes(String(a)));
    }

    // Fourchettes : elles resserrent aussi la barre
    const span = hi - lo + 1;
    for (const frac of [0.6, 0.5, 0.4, 0.3, 0.2, 0.12, 0.08, 0.05, 0.03, 0.02, 0.01, 0.005]) {
      const width = Math.ceil(span * frac);
      if (width < 2 || width >= span) continue;
      const step = 10 ** Math.max(0, Math.floor(Math.log10(width)) - 1);
      let a = t - randInt(0, width - 1);
      a = Math.max(lo, Math.floor(a / step) * step);
      let b = Math.min(hi, Math.ceil((a + width - 1) / step) * step);
      if (b < t) b = Math.min(hi, t);
      if (b - a + 1 >= span) continue;
      add(`range${frac}`, "fourchette", `Il se trouve entre ${fmt(a)} et ${fmt(b)}.`, (n) => n >= a && n <= b, [a, b]);
    }
    return facts;
  }

  // Part visée pour chaque indice : plus on avance, plus l'indice est précis
  const PRECISION = [0.55, 0.42, 0.32, 0.24, 0.18, 0.13, 0.1, 0.07, 0.05, 0.035, 0.025];

  function createFactEngine(target) {
    const used = new Set();
    const tests = [];
    let lastCat = "";
    let count = 0;

    // Retourne { text, range, level } ou null s'il n'y a plus rien à dire.
    function next(segs, boost = 0) {
      const lo = segs[0][0];
      const hi = segs[segs.length - 1][1];
      const total = segCount(segs);
      const small = total <= 2500;
      const keep = (n) => inSegs(segs, n) && tests.every((test) => test(n));

      const pool = [target];
      if (small) {
        for (const [a, b] of segs) for (let n = a; n <= b; n++) if (n !== target && keep(n)) pool.push(n);
      } else {
        for (let i = 0; i < 1200; i++) {
          const n = randInt(lo, hi);
          if (keep(n)) pool.push(n);
        }
      }

      const idx = Math.min(PRECISION.length - 1, count + boost);
      const goal = PRECISION[idx];
      const wantRange = (count + boost) % 3 === 2;
      let best = null;
      let bestCost = Infinity;

      for (const fact of buildFacts(target, lo, hi)) {
        if (used.has(fact.id) && fact.cat !== "fourchette") continue;
        if (used.has(fact.text)) continue;
        const hits = pool.reduce((sum, n) => sum + (fact.test(n) ? 1 : 0), 0);
        const share = hits / pool.length;
        // Inutile s'il n'apprend presque rien
        if (share > 0.93 && pool.length > 1) continue;
        // Trop précis s'il donne directement la réponse (seulement au tout début)
        const reveals = small && hits <= 1;
        if (reveals && count + boost < 6) continue;

        let cost = Math.abs(Math.log(Math.max(share, 1e-4) / goal)) + Math.random() * 0.25;
        if (fact.cat === lastCat) cost += 0.8;
        if (wantRange && fact.range) cost -= 1.2;
        if (!wantRange && fact.range && count + boost < 2) cost += 0.5;
        if (reveals) cost += 3;
        if (cost < bestCost) { bestCost = cost; best = fact; }
      }

      count += 1;
      if (!best) {
        const left = Math.max(pool.length, 1);
        const text = left <= 1
          ? "Je n'ai plus rien à t'apprendre : il ne reste plus qu'une seule possibilité !"
          : small
            ? `Tu sais presque tout : il ne reste que ${fmt(left)} possibilités !`
            : `Tu sais presque tout : il reste à peu près ${fmt(Math.round((left / 1200) * total))} possibilités.`;
        return { text, range: null, level: count };
      }
      used.add(best.id);
      used.add(best.text);
      tests.push(best.test);
      lastCat = best.cat;
      return { text: best.text, range: best.range || null, level: count };
    }

    return { next, get count() { return count; } };
  }

  return {
    LIMIT, ABS_ZERO, HIT, NEXT, ZONES, fmt, randInt, pick, randomLogInt,
    temperature, zoneOf, formatTemp, thermoLevel, tempColor, bandDistances,
    intersect, subtract, segCount, inSegs, optimalTries, oneShotTier, score, createFactEngine,
  };
})();
