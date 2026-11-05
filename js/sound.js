// ===== Sons (générés en direct, aucun fichier audio) et vibrations =====

const Sound = (() => {
  let ctx = null;
  let noise = null;
  let enabled = true;

  function audio() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function noiseBuffer(c) {
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function envelope(c, peak, attack, decay, when = 0) {
    const g = c.createGain();
    const t = c.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(c.destination);
    return g;
  }

  function tone(c, type, freq, peak, attack, decay, when = 0, endFreq = null) {
    const o = c.createOscillator();
    o.type = type;
    const t = c.currentTime + when;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay);
    o.connect(envelope(c, peak, attack, decay, when));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function hiss(c, type, freq, q, peak, attack, decay, when = 0, endFreq = null) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    const t = c.currentTime + when;
    f.frequency.setValueAtTime(freq, t);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + attack + decay);
    src.connect(f).connect(envelope(c, peak, attack, decay, when));
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  const run = (fn) => (...args) => {
    const c = audio();
    if (c) fn(c, ...args);
  };

  return {
    click: run((c) => tone(c, "sine", 900, 0.08, 0.002, 0.05, 0, 500)),
    tick: run((c, strength = 1) => tone(c, "triangle", 1400, 0.05 * strength, 0.001, 0.03, 0, 700)),
    // Le nombre part vers le bot
    whoosh: run((c) => hiss(c, "bandpass", 400, 1.2, 0.09, 0.12, 0.3, 0, 1800)),
    // Le bot réfléchit
    think: run((c) => [0, 0.11, 0.22].forEach((w, i) => tone(c, "square", 700 + i * 180, 0.025, 0.003, 0.05, w))),
    // Note dont la hauteur dépend de la température
    heat: run((c, level) => tone(c, "sine", 130 * 2 ** (level / 25), 0.14, 0.01, 0.45)),
    // Glace qui craque
    ice: run((c) => {
      for (let i = 0; i < 5; i++) hiss(c, "highpass", 3000 + Math.random() * 3000, 2, 0.1, 0.001, 0.03, i * 0.04 + Math.random() * 0.03);
      tone(c, "sine", 2100, 0.05, 0.002, 0.3, 0, 1400);
    }),
    // Grésillement du feu
    fire: run((c, power = 1) => {
      hiss(c, "bandpass", 700, 0.8, 0.14 * power, 0.05, 0.6, 0, 2400);
      tone(c, "sawtooth", 70, 0.05 * power, 0.03, 0.5, 0, 45);
    }),
    up: run((c) => tone(c, "triangle", 380, 0.14, 0.01, 0.26, 0, 980)),
    down: run((c) => tone(c, "triangle", 980, 0.14, 0.01, 0.26, 0, 320)),
    hint: run((c) => [1318.5, 1760, 2093].forEach((f, i) => tone(c, "sine", f, 0.07, 0.005, 0.3, i * 0.06))),
    error: run((c) => { tone(c, "square", 170, 0.06, 0.005, 0.1); tone(c, "square", 130, 0.06, 0.005, 0.14, 0.09); }),
    beep: run((c, high) => tone(c, "square", high ? 1320 : 660, 0.09, 0.005, high ? 0.5 : 0.16)),
    // Battement de cœur des dernières secondes
    heart: run((c) => { tone(c, "sine", 72, 0.3, 0.01, 0.14, 0, 44); tone(c, "sine", 62, 0.24, 0.01, 0.16, 0.17, 38); }),
    // Mélodie de victoire
    win: run((c) => [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => {
      tone(c, "triangle", f, 0.13, 0.01, i === 4 ? 0.9 : 0.3, i * 0.09);
    })),
    lose: run((c) => [392, 349.2, 311.1, 233.1].forEach((f, i) => tone(c, "triangle", f, 0.12, 0.01, i === 3 ? 0.8 : 0.26, i * 0.2))),
    // Temps écoulé : tout gèle
    freeze: run((c) => { hiss(c, "highpass", 6000, 1, 0.09, 0.02, 1.1, 0, 2000); tone(c, "sine", 1800, 0.08, 0.01, 1, 0, 220); }),
    // Chiffre interdit
    boom: run((c) => {
      hiss(c, "lowpass", 2400, 0.5, 0.6, 0.005, 1.5, 0, 90);
      tone(c, "sine", 130, 0.6, 0.005, 1.1, 0, 26);
      tone(c, "square", 58, 0.14, 0.005, 0.6, 0.02, 28);
    }),
    // Fanfare, de plus en plus grande selon l'exploit (1 à 3)
    fanfare: run((c, tier = 1) => {
      const notes = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5, 1568, 2093];
      const times = [0, 0.1, 0.2, 0.32, 0.5, 0.6, 0.72, 0.84, 0.98];
      const count = tier === 1 ? 7 : 9;
      for (let k = 0; k < count; k++) {
        const last = k === count - 1;
        tone(c, "triangle", notes[k], 0.13, 0.01, last ? 1.3 : 0.22, times[k]);
        tone(c, "square", notes[k] / 2, 0.03, 0.01, last ? 1.3 : 0.22, times[k]);
      }
      if (tier >= 2) {
        hiss(c, "highpass", 5000, 0.7, 0.05, 0.02, 2, 0.9);
        [130.8, 196, 261.6].forEach((f) => tone(c, "sawtooth", f, 0.05, 0.3, 2.2, 0.9));
      }
      if (tier >= 3) {
        // Grand accord final, tenu très longtemps
        [65.4, 130.8, 261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5, 1568].forEach((f, i) => {
          tone(c, i < 3 ? "sawtooth" : "triangle", f, i < 3 ? 0.07 : 0.05, 0.8, 5, 1.8);
        });
        tone(c, "sine", 45, 0.4, 0.01, 2.4, 0, 28);
        for (let i = 0; i < 8; i++) hiss(c, "lowpass", 1600, 0.5, 0.18, 0.005, 0.7, 2.2 + i * 0.45, 200);
      }
    }),
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();

const Haptics = (() => {
  let enabled = true;
  return {
    buzz(pattern) {
      if (enabled && navigator.vibrate) {
        try { navigator.vibrate(pattern); } catch (e) { /* non supporté */ }
      }
    },
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
  };
})();
