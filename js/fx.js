// ===== Effets visuels : neige, braises, éclairs, débris, confettis et feux d'artifice =====

const FX = (() => {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const GRAVITY = 0.16;
  const BRAND = ["#ffd60a", "#9b6dff", "#ffffff", "#ffe766", "#c4a8ff"];

  const stage = { cv: null, ctx: null, w: 0, h: 0, parts: [], visible: true };
  const top = { cv: null, ctx: null, w: 0, h: 0, parts: [] };
  let temp = null;      // Température ambiante (null : poussières calmes)
  let lastTime = 0;
  let bolt = 0;
  let stream = null;    // Pluie continue pendant les grands exploits

  function fit(layer, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    layer.w = w;
    layer.h = h;
    layer.cv.width = Math.round(w * dpr);
    layer.cv.height = Math.round(h * dpr);
    layer.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resize() {
    if (stage.cv) {
      const r = stage.cv.parentElement.getBoundingClientRect();
      fit(stage, r.width, r.height);
    }
    if (top.cv) fit(top, window.innerWidth, window.innerHeight);
  }

  function init(stageCanvas, topCanvas) {
    stage.cv = stageCanvas;
    stage.ctx = stageCanvas.getContext("2d");
    top.cv = topCanvas;
    top.ctx = topCanvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stageCanvas.parentElement);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((list) => { stage.visible = list[0].isIntersecting; }).observe(stageCanvas.parentElement);
    }
    requestAnimationFrame(loop);
  }

  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- Ambiance de la zone de jeu ----------

  function ambient(dt) {
    const { w, h, parts } = stage;
    if (parts.length > 420) return;
    let rate;
    if (temp === null) {
      rate = 0.05;
      if (Math.random() < rate * dt) parts.push({ k: "mote", x: rand(0, w), y: h + 6, vx: rand(-0.15, 0.15), vy: rand(-0.7, -0.25), s: rand(1, 2.6), life: 1, fade: 0.0035, c: Math.random() < 0.5 ? "#ffd60a" : "#c4a8ff" });
      return;
    }
    if (temp < 15) {
      const cold = Math.min(1, (15 - temp) / 288);
      rate = 0.12 + cold * 1.5;
      for (let i = 0; i < 3; i++) {
        if (Math.random() < (rate * dt) / 3) {
          parts.push({ k: "snow", x: rand(-20, w + 20), y: -8, vx: rand(-0.4, 0.4) + cold * 0.8, vy: rand(0.5, 1.2) + cold * 1.5, s: rand(1.5, 3 + cold * 4), rot: rand(0, 6), vr: rand(-0.03, 0.03), sway: rand(0, 6), life: 1, fade: 0.0028 });
        }
      }
      return;
    }
    if (temp < 60) {
      if (Math.random() < 0.08 * dt) parts.push({ k: "mote", x: rand(0, w), y: h + 6, vx: rand(-0.2, 0.2), vy: rand(-0.8, -0.3), s: rand(1.2, 2.8), life: 1, fade: 0.004, c: "#2ee6a6" });
      return;
    }
    const hot = Math.min(1, Math.log10(Math.max(temp, 60) / 60) / 2.22);
    rate = 0.15 + hot * 3.2;
    for (let i = 0; i < 4; i++) {
      if (Math.random() < (rate * dt) / 4) {
        const white = temp > 7000;
        parts.push({
          k: "ember", x: rand(0, w), y: h + 6,
          vx: rand(-0.6, 0.6), vy: -rand(0.8, 1.6) - hot * rand(1, 3.2), s: rand(1, 2.2 + hot * 2.6),
          sway: rand(0, 6), life: 1, fade: rand(0.006, 0.014),
          c: white ? (Math.random() < 0.5 ? "#ffffff" : "#bfe3ff") : Math.random() < 0.5 ? "#ffb020" : temp > 1000 ? "#ff4726" : "#ffd60a",
        });
      }
    }
    if (temp >= 9000) {
      bolt -= dt;
      if (bolt <= 0) {
        bolt = rand(7, 34);
        const pts = [];
        let x = rand(0, w);
        let y = 0;
        while (y < h) {
          pts.push([x, y]);
          x += rand(-28, 28);
          y += rand(14, 34);
        }
        parts.push({ k: "bolt", pts, life: 1, fade: 0.09 });
      }
    }
  }

  // ---------- Dessin ----------

  function drawPart(ctx, p) {
    const a = Math.max(0, Math.min(1, p.life));
    ctx.globalAlpha = a;
    switch (p.k) {
      case "snow":
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "#dff4ff";
        ctx.lineWidth = 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const ang = (i * Math.PI) / 3;
          ctx.moveTo(-Math.cos(ang) * p.s, -Math.sin(ang) * p.s);
          ctx.lineTo(Math.cos(ang) * p.s, Math.sin(ang) * p.s);
        }
        ctx.stroke();
        ctx.restore();
        break;
      case "ember":
      case "mote":
      case "spark":
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = p.c;
        // La lueur coûte cher : on la coupe quand il y a beaucoup de particules
        ctx.shadowColor = p.c;
        ctx.shadowBlur = top.parts.length + stage.parts.length < 260 ? 8 : 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s * (p.k === "ember" ? a : 1), 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      case "bolt":
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#cfe6ff";
        ctx.shadowColor = "#7fb6ff";
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2;
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      case "shard":
      case "confetti":
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, p.k === "confetti" ? Math.cos(p.flip) : 1);
        ctx.fillRect(-p.s / 2, -p.h / 2, p.s, p.h);
        ctx.restore();
        break;
      case "ring":
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 1 + 6 * a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.stroke();
        break;
      default:
    }
  }

  function step(p, dt) {
    switch (p.k) {
      case "snow":
        p.sway += 0.03 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.5) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        break;
      case "ember":
        p.sway += 0.08 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.7) * dt;
        p.y += p.vy * dt;
        break;
      case "mote":
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        break;
      case "spark":
        p.vx *= 1 - 0.018 * dt;
        p.vy = p.vy * (1 - 0.018 * dt) + GRAVITY * 0.35 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        break;
      case "shard":
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        break;
      case "confetti":
        p.vy = Math.min(p.vy + GRAVITY * 0.45 * dt, 3.6);
        p.vx *= 1 - 0.012 * dt;
        p.sway += 0.06 * dt;
        p.x += (p.vx + Math.sin(p.sway) * 0.6) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += 0.14 * dt;
        break;
      case "ring":
        p.r += p.vr * dt;
        break;
      default:
    }
    p.life -= p.fade * dt;
  }

  function drawLayer(layer, dt) {
    const { ctx, parts, w, h } = layer;
    ctx.clearRect(0, 0, w, h);
    let kept = 0;
    for (const p of parts) {
      step(p, dt);
      if (p.life > 0 && p.y < h + 40 && p.y > -60) {
        drawPart(ctx, p);
        parts[kept++] = p;
      }
    }
    parts.length = kept;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(time) {
    const dt = Math.min(3, (time - lastTime) / 16.67 || 1);
    lastTime = time;
    if (stage.cv && stage.visible) {
      if (!motion.matches) ambient(dt);
      drawLayer(stage, dt);
    }
    if (top.cv) {
      if (stream) stream(dt);
      if (top.parts.length || top.dirty) {
        drawLayer(top, dt);
        top.dirty = top.parts.length > 0;
      }
    }
    requestAnimationFrame(loop);
  }

  // ---------- Effets ponctuels (coordonnées de la fenêtre) ----------

  function push(part) {
    if (top.parts.length < 1500) top.parts.push(part);
  }

  // Débris d'une partie de la barre qui vient d'être éliminée
  function crumble(rect, amount = 28, colors = ["#9b6dff", "#c4a8ff", "#ffd60a"]) {
    if (motion.matches || rect.width <= 0) return;
    const count = Math.min(amount, 12 + Math.round(rect.width / 5));
    for (let i = 0; i < count; i++) {
      push({
        k: "shard", x: rand(rect.left, rect.right), y: rand(rect.top, rect.bottom),
        vx: rand(-1.4, 1.4), vy: rand(-3.6, -0.6), s: rand(2, 7), h: rand(2, 7),
        rot: rand(0, 6), vr: rand(-0.3, 0.3), life: 1, fade: rand(0.014, 0.024), c: colors[i % colors.length],
      });
    }
  }

  function explode(x, y, amount = 60, colors = BRAND, power = 1) {
    if (motion.matches) return;
    for (let i = 0; i < amount; i++) {
      const a = rand(0, 6.283);
      const v = rand(1, 7.5) * power;
      push({ k: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rand(1, 3.2), life: 1, fade: rand(0.012, 0.028), c: colors[i % colors.length] });
    }
    push({ k: "ring", x, y, r: 6, vr: 8 * power, life: 1, fade: 0.035, c: colors[0] });
  }

  function confetti(amount = 140, colors = BRAND) {
    if (motion.matches) return;
    for (let i = 0; i < amount; i++) {
      const left = i % 2 === 0;
      push({
        k: "confetti",
        x: left ? rand(-10, 40) : top.w + rand(-40, 10), y: top.h * rand(0.45, 0.9),
        vx: (left ? 1 : -1) * rand(2.5, 11), vy: -rand(5, 13.5), s: rand(5, 10), h: rand(8, 15),
        rot: rand(0, 6), vr: rand(-0.2, 0.2), flip: rand(0, 6), sway: rand(0, 6), life: 1, fade: rand(0.0035, 0.006), c: colors[i % colors.length],
      });
    }
  }

  function firework(colors = BRAND) {
    explode(rand(top.w * 0.12, top.w * 0.88), rand(top.h * 0.12, top.h * 0.6), 70, colors, rand(0.8, 1.35));
  }

  // Pluie de confettis qui continue tant que stopStream n'est pas appelé
  function startStream(colors = BRAND, density = 1) {
    if (motion.matches) return;
    stream = (dt) => {
      if (Math.random() < 0.9 * density * dt) {
        push({
          k: "confetti", x: rand(0, top.w), y: -10, vx: rand(-0.6, 0.6), vy: rand(1.2, 3), s: rand(4, 9), h: rand(7, 14),
          rot: rand(0, 6), vr: rand(-0.15, 0.15), flip: rand(0, 6), sway: rand(0, 6), life: 1, fade: 0.0028, c: colors[Math.floor(rand(0, colors.length))],
        });
      }
    };
  }

  return {
    init,
    setTemp(t) { temp = t; },
    clearStage() { stage.parts.length = 0; },
    crumble, explode, confetti, firework, startStream,
    stopStream() { stream = null; },
    get reduced() { return motion.matches; },
  };
})();
