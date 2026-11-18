/* ============================================================
   UAI BALL – DESENHISTA DE MESAS (madeira pirogravada + latão)
   ------------------------------------------------------------
   Gera a arte da mesa a partir dos MESMOS dados da física:
   • madeira com veios (ruído) nas cores do tema
   • moldura do gabinete, corredor do lançador, avental
   • trilhos de madeira com sombra, brilho e parafusos de latão
   • estilingues, postes, buracos, insertos de luz
   • gravuras pirogravadas (ícones do tema) e título incrustado
   • rampas de arame numa camada separada (passa por cima da bola)
   ============================================================ */
window.UAI = window.UAI || {};

UAI.TableArt = {
  /* ---------- utilidades ---------- */
  rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
  hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; },
  hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },

  /** ruído de valor 2D suave */
  makeNoise(seed) {
    const r = this.rng(seed), P = new Float32Array(512 * 512);
    for (let i = 0; i < P.length; i++) P[i] = r();
    const at = (x, y) => P[((y & 511) << 9) | (x & 511)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  },

  /** Textura de madeira (veios verticais) num canvas w×h */
  woodCanvas(w, h, dark, light, seed, scale = 1, grain = 1) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), img = x.createImageData(w, h), D = img.data;
    const N = this.makeNoise(seed), A = this.hex(dark), B = this.hex(light);
    const k = 1 / scale;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = i * k, Y = j * k;
      const warp = N(X * 0.006, Y * 0.0015) * 40;
      const rings = Math.sin((X + warp * 3) * 0.09 + N(X * 0.02, Y * 0.004) * 6);
      const fine = N(X * 0.35, Y * 0.012);
      const plank = Math.floor((X + 6) / 112);
      const tone = N(plank * 13.1, 3.7) * 0.25;
      let t = 0.5 + rings * 0.18 * grain + (fine - 0.5) * 0.35 * grain + tone - 0.12;
      const seam = ((X + 6) % 112) < 1.4 * k + 0.6 ? -0.28 : 0;
      t = Math.max(0, Math.min(1, t + seam));
      const col = this.mix(A, B, t), o = (j * w + i) * 4;
      D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  },

  pathPts(ctx, pts, close) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  },

  screw(ctx, x, y, r = 4.5, metal = '#d9a441') {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 0.5, x, y, r);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.45, metal); g.addColorStop(1, '#4a3010');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,5,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.6, y + r * 0.2); ctx.stroke();
  },

  /** trilho de madeira ao longo de uma linha (largura 2t) */
  rail(ctx, pts, t, th, pattern, opts = {}) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // sombra
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
    this.pathPts(ctx, pts); ctx.strokeStyle = th.railDark; ctx.lineWidth = t * 2 + 2; ctx.stroke();
    ctx.shadowColor = 'transparent';
    // corpo com veio
    this.pathPts(ctx, pts); ctx.strokeStyle = pattern || th.rail; ctx.lineWidth = t * 2 - 2; ctx.stroke();
    // brilho superior
    ctx.translate(-1.2, -1.6);
    this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(255,236,200,.28)'; ctx.lineWidth = Math.max(1.5, t * 0.45); ctx.stroke();
    ctx.restore();
    // parafusos
    if (opts.screws !== false && t >= 6) {
      let acc = 60;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1);
        while (acc < L) { const k = acc / L; this.screw(ctx, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 3.4, th.metal); acc += 150; }
        acc -= L;
      }
    }
  },

  post(ctx, x, y, r, th) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#1b0f08'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    this.screw(ctx, x, y, r, th.metal);
  },

  /** insertos (lâmpadas embutidas): forma escura translúcida que acende com a luz do jogo */
  insert(ctx, x, y, kind, ang, color, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((ang || 0) * Math.PI / 180); ctx.scale(s, s);
    ctx.fillStyle = color; ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(30,14,4,.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (kind === 'arrow') { ctx.moveTo(14, 0); ctx.lineTo(-10, -11); ctx.lineTo(-5, 0); ctx.lineTo(-10, 11); ctx.closePath(); }
    else if (kind === 'tri') { ctx.moveTo(0, -12); ctx.lineTo(11, 9); ctx.lineTo(-11, 9); ctx.closePath(); }
    else ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    ctx.restore();
  },

  /* ---------- gravuras (pirografia) ---------- */
  icons: {
    church(c) { c.rect(-30, -5, 60, 45); c.moveTo(-30, -5); c.lineTo(0, -28); c.lineTo(30, -5); c.rect(-42, -28, 14, 68); c.rect(28, -28, 14, 68); c.moveTo(-42, -28); c.lineTo(-35, -42); c.lineTo(-28, -28); c.moveTo(28, -28); c.lineTo(35, -42); c.lineTo(42, -28); c.moveTo(0, -28); c.lineTo(0, -44); c.moveTo(-6, -38); c.lineTo(6, -38); c.rect(-8, 18, 16, 22); c.moveTo(-38, -14); c.arc(-35, -14, 3, 0, 7); c.moveTo(38, -14); c.arc(35, -14, 3, 0, 7); },
    coffee(c) { c.moveTo(-26, -10); c.lineTo(-22, 26); c.quadraticCurveTo(0, 34, 22, 26); c.lineTo(26, -10); c.closePath(); c.moveTo(26, -2); c.bezierCurveTo(44, -4, 44, 18, 22, 18); c.moveTo(-40, 32); c.quadraticCurveTo(0, 46, 40, 32); c.moveTo(-10, -18); c.bezierCurveTo(-18, -26, -2, -32, -10, -42); c.moveTo(6, -18); c.bezierCurveTo(-2, -26, 14, -32, 6, -42); },
    paoqueijo(c) { [[-22, 6, 18], [18, 8, 17], [-2, -16, 16]].forEach(([x, y, r]) => { c.moveTo(x + r, y); c.ellipse(x, y, r, r * 0.8, 0, 0, 7); c.moveTo(x - r * 0.4, y - 2); c.arc(x - r * 0.5, y - 2, 1.5, 0, 7); c.moveTo(x + r * 0.3, y + 3); c.arc(x + r * 0.2, y + 3, 1.5, 0, 7); }); },
    train(c) { c.rect(-40, -6, 52, 26); c.rect(4, -26, 26, 46); c.rect(-30, -24, 12, 18); c.moveTo(-34, -24); c.lineTo(-14, -24); c.moveTo(12, -18); c.rect(10, -20, 14, 12); c.moveTo(-40, 20); c.lineTo(-50, 30); c.lineTo(-40, 30); [-30, -10, 18].forEach(x => { c.moveTo(x + 8, 28); c.arc(x, 28, 8, 0, 7); }); c.moveTo(-24, -30); c.bezierCurveTo(-30, -44, -10, -44, -16, -56); c.bezierCurveTo(-10, -62, 6, -60, 2, -70); },
    mountain(c) { c.moveTo(-48, 30); c.lineTo(-16, -22); c.lineTo(0, 0); c.lineTo(16, -30); c.lineTo(48, 30); c.moveTo(-16, -22); c.lineTo(-22, -10); c.lineTo(-10, -12); c.moveTo(16, -30); c.lineTo(8, -16); c.lineTo(22, -18); },
    sun(c) { c.moveTo(14, 0); c.arc(0, 0, 14, 0, 7); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.moveTo(Math.cos(a) * 20, Math.sin(a) * 20); c.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); } },
    star(c) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 32; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); },
    gear(c) { for (let i = 0; i <= 24; i++) { const a = i * Math.PI / 12, r = (i % 2 ? 26 : 34); i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(r, 0); } c.moveTo(11, 0); c.arc(0, 0, 11, 0, 7); },
    rocket(c) { c.moveTo(0, -44); c.bezierCurveTo(18, -26, 16, 10, 12, 22); c.lineTo(-12, 22); c.bezierCurveTo(-16, 10, -18, -26, 0, -44); c.moveTo(7, -14); c.arc(0, -14, 7, 0, 7); c.moveTo(-12, 8); c.lineTo(-24, 28); c.lineTo(-10, 22); c.moveTo(12, 8); c.lineTo(24, 28); c.lineTo(10, 22); c.moveTo(-6, 26); c.lineTo(0, 42); c.lineTo(6, 26); },
    diamond(c) { c.moveTo(-34, -12); c.lineTo(-20, -30); c.lineTo(20, -30); c.lineTo(34, -12); c.lineTo(0, 36); c.closePath(); c.moveTo(-34, -12); c.lineTo(34, -12); c.moveTo(-20, -30); c.lineTo(-10, -12); c.lineTo(0, -30); c.lineTo(10, -12); c.lineTo(20, -30); c.moveTo(-10, -12); c.lineTo(0, 36); c.lineTo(10, -12); },
    cheese(c) { c.ellipse(0, -10, 40, 14, 0, 0, 7); c.moveTo(-40, -10); c.lineTo(-40, 14); c.ellipse(0, 14, 40, 14, 0, Math.PI, 0, true); c.moveTo(40, 14); c.lineTo(40, -10); c.moveTo(0, -10); c.lineTo(30, -20); c.moveTo(0, -10); c.lineTo(10, -24); },
    ball(c) { c.moveTo(30, 0); c.arc(0, 0, 30, 0, 7); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; i ? c.lineTo(Math.cos(a) * 11, Math.sin(a) * 11) : c.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); } c.closePath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; c.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); c.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } },
    goal(c) { c.moveTo(-46, 30); c.lineTo(-46, -24); c.lineTo(46, -24); c.lineTo(46, 30); for (let x = -36; x <= 36; x += 12) { c.moveTo(x, -24); c.lineTo(x * 0.8, 24); } for (let y = -12; y <= 24; y += 12) { c.moveTo(-44, y); c.lineTo(44, y); } },
    bonfire(c) { c.moveTo(-34, 30); c.lineTo(34, 12); c.moveTo(34, 30); c.lineTo(-34, 12); c.moveTo(0, 18); c.bezierCurveTo(-26, 4, -10, -16, -6, -30); c.bezierCurveTo(4, -16, 10, -26, 12, -38); c.bezierCurveTo(28, -14, 22, 8, 0, 18); c.moveTo(0, 10); c.bezierCurveTo(-10, 0, -2, -10, 2, -18); c.bezierCurveTo(10, -6, 8, 4, 0, 10); },
    balloon(c) { c.moveTo(0, -40); c.lineTo(22, -14); c.lineTo(14, 18); c.lineTo(-14, 18); c.lineTo(-22, -14); c.closePath(); c.moveTo(-22, -14); c.lineTo(22, -14); c.moveTo(-18, 2); c.lineTo(18, 2); c.moveTo(0, -40); c.lineTo(0, 18); c.moveTo(-8, 18); c.lineTo(-6, 28); c.lineTo(6, 28); c.lineTo(8, 18); c.moveTo(0, 30); c.bezierCurveTo(-4, 36, 4, 38, 0, 44); },
    flags(c) { c.moveTo(-50, -10); c.quadraticCurveTo(0, 12, 50, -10); for (let i = 0; i < 6; i++) { const x = -42 + i * 17, y = -8 + Math.sin((i + 0.5) / 6 * Math.PI) * 9; c.moveTo(x, y); c.lineTo(x + 6, y + 16); c.lineTo(x + 12, y + 1); } },
    waterfall(c) { c.moveTo(-40, -36); c.lineTo(-14, -36); c.lineTo(-14, -20); c.moveTo(14, -20); c.lineTo(14, -36); c.lineTo(40, -36); for (let x = -12; x <= 12; x += 6) { c.moveTo(x, -20); c.bezierCurveTo(x - 3, 0, x + 3, 12, x, 28); } c.moveTo(-36, 34); c.quadraticCurveTo(-18, 26, 0, 34); c.quadraticCurveTo(18, 42, 36, 34); },
    waves(c) { for (let k = 0; k < 3; k++) { const y = -14 + k * 14; c.moveTo(-44, y); for (let x = -44; x <= 44; x += 22) c.quadraticCurveTo(x + 11, y - 9, x + 22, y); } },
    pickaxe(c) { c.moveTo(-34, -24); c.quadraticCurveTo(0, -42, 34, -24); c.quadraticCurveTo(0, -32, -34, -24); c.moveTo(-3, -32); c.lineTo(-3, 40); c.lineTo(3, 40); c.lineTo(3, -32); },
    helmet(c) { c.moveTo(-34, 14); c.bezierCurveTo(-34, -30, 34, -30, 34, 14); c.lineTo(42, 14); c.lineTo(42, 20); c.lineTo(-42, 20); c.lineTo(-42, 14); c.closePath(); c.moveTo(8, -6); c.arc(0, -6, 8, 0, 7); c.moveTo(0, -24); c.lineTo(0, -14); },
    cart(c) { c.moveTo(-40, -16); c.lineTo(40, -16); c.lineTo(30, 16); c.lineTo(-30, 16); c.closePath(); [-20, 20].forEach(x => { c.moveTo(x + 9, 24); c.arc(x, 24, 9, 0, 7); }); c.moveTo(-50, 34); c.lineTo(50, 34); c.moveTo(-26, -16); c.arc(-16, -22, 10, Math.PI, 0); c.arc(6, -24, 12, Math.PI, 0); c.arc(26, -20, 8, Math.PI, 0); },
    viola(c) { c.ellipse(0, 18, 20, 18, 0, 0, 7); c.moveTo(14, -6); c.ellipse(0, -8, 15, 13, 0, 0, 7); c.moveTo(5, 18); c.arc(0, 18, 5, 0, 7); c.moveTo(-3, -20); c.lineTo(-3, -52); c.lineTo(3, -52); c.lineTo(3, -20); c.moveTo(-6, 30); c.lineTo(6, 30); },
    cow(c) { c.ellipse(0, 0, 34, 18, 0, 0, 7); c.moveTo(-34, -4); c.lineTo(-48, -14); c.lineTo(-52, 2); c.lineTo(-40, 8); c.moveTo(-46, -14); c.lineTo(-50, -24); [-24, -12, 14, 26].forEach(x => { c.moveTo(x, 14); c.lineTo(x, 34); }); c.moveTo(34, -4); c.quadraticCurveTo(44, 4, 40, 18); c.moveTo(-6, -8); c.ellipse(-4, -6, 7, 5, 0, 0, 7); c.moveTo(18, 2); c.ellipse(16, 2, 6, 4, 0, 0, 7); },
    moon(c) { c.arc(0, 0, 30, -1.1, 4.2); c.bezierCurveTo(-30, 12, 10, 26, 20, -6); c.closePath(); },
    planet(c) { c.moveTo(22, 0); c.arc(0, 0, 22, 0, 7); c.ellipse(0, 0, 44, 12, -0.35, 0, 7); },
    sculpture(c) { c.moveTo(-40, 30); c.bezierCurveTo(-30, -40, 10, 20, 20, -36); c.moveTo(20, -36); c.lineTo(40, 30); c.moveTo(-20, 30); c.arc(-10, 4, 12, 0, 7); c.rect(4, 6, 22, 24); },
    tree(c) { c.moveTo(-4, 40); c.lineTo(-4, 6); c.lineTo(4, 6); c.lineTo(4, 40); c.moveTo(0, -44); c.bezierCurveTo(40, -40, 40, 10, 0, 6); c.bezierCurveTo(-40, 10, -40, -40, 0, -44); },
    house(c) { c.rect(-30, -4, 60, 36); c.moveTo(-40, -2); c.lineTo(0, -36); c.lineTo(40, -2); c.rect(-8, 10, 16, 22); c.rect(-24, 4, 10, 10); c.rect(14, 4, 10, 10); },
    lantern(c) { c.rect(-14, -24, 28, 44); c.moveTo(-18, -24); c.lineTo(0, -36); c.lineTo(18, -24); c.moveTo(0, -36); c.lineTo(0, -46); c.moveTo(-18, 20); c.lineTo(18, 20); c.moveTo(0, 12); c.bezierCurveTo(-8, 2, -2, -8, 0, -14); c.bezierCurveTo(4, -6, 6, 4, 0, 12); },
    spring(c) { c.rect(-14, -46, 28, 10); c.rect(-14, 36, 28, 10); for (let i = 0; i < 7; i++) { const y = -36 + i * 10.3; c.moveTo(-12, y); c.lineTo(12, y + 5); c.lineTo(-12, y + 10.3); } },
    skull(c) { c.moveTo(-24, 6); c.bezierCurveTo(-30, -36, 30, -36, 24, 6); c.lineTo(16, 12); c.lineTo(16, 24); c.lineTo(-16, 24); c.lineTo(-16, 12); c.closePath(); c.moveTo(-3, -2); c.arc(-10, -4, 7, 0, 7); c.moveTo(17, -4); c.arc(10, -4, 7, 0, 7); c.moveTo(0, 4); c.lineTo(-4, 12); c.lineTo(4, 12); c.closePath(); c.moveTo(-8, 18); c.lineTo(-8, 24); c.moveTo(0, 18); c.lineTo(0, 24); c.moveTo(8, 18); c.lineTo(8, 24); },
    lightning(c) { c.moveTo(8, -40); c.lineTo(-16, 4); c.lineTo(2, 4); c.lineTo(-8, 40); c.lineTo(18, -8); c.lineTo(0, -8); c.closePath(); }
  },

  icon(ctx, name, x, y, s, th, rot = 0) {
    const f = this.icons[name]; if (!f) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 100, s / 100);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); f(ctx);
    ctx.fillStyle = th.burnFill; ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,.18)'; ctx.lineWidth = 4.2; ctx.translate(1.2, 1.4); ctx.stroke(); ctx.translate(-1.2, -1.4);
    ctx.strokeStyle = th.burn; ctx.lineWidth = 3.6; ctx.stroke();
    ctx.restore();
  },

  /** título incrustado (letras de madeira clara com contorno queimado) */
  title(ctx, text, x, y, size, th, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `${size}px Rye, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4;
    ctx.lineWidth = size * 0.16; ctx.strokeStyle = th.burn; ctx.strokeText(text, 0, 0);
    ctx.shadowColor = 'transparent';
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    g.addColorStop(0, th.inlay[0]); g.addColorStop(1, th.inlay[1]);
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,240,210,.45)'; ctx.strokeText(text, -1, -1);
    ctx.restore();
  },

  /* ---------- mesa completa ---------- */
  /** desenha a mesa num canvas 896×1200 (ou menor, com scale) */
  render(def, scale = 1) {
    const W = 896, H = 1200, L = def.layout, th = Object.assign({
      wood: ['#6b3d18', '#b9793c'], frame: ['#2a160a', '#5a3214'], rail: '#8a5426', railDark: '#24120a',
      railWood: ['#7a4620', '#c48444'], metal: '#d9a441', burn: 'rgba(42,18,5,.78)', burnFill: 'rgba(42,18,5,.12)',
      inlay: ['#ffd89a', '#d08a3c'], insert: '#e8a040', apron: ['#1d0f07', '#3a1d0b'], grain: 1
    }, def.theme || {});
    const seed = this.hashStr(def.id);
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale);

    // 1) moldura (gabinete)
    const frame = this.woodCanvas(Math.ceil(W * scale), Math.ceil(H * scale), th.frame[0], th.frame[1], seed + 7, scale, 0.8);
    ctx.drawImage(frame, 0, 0, W, H);

    // 2) tabuleiro de madeira recortado pelo contorno
    const outer = L.walls.find(w => w.id === 'externa').pts;
    ctx.save();
    this.pathPts(ctx, [...outer, [860, 1200], [32, 1200]], true); ctx.clip();
    const wood = this.woodCanvas(Math.ceil(W * scale), Math.ceil(H * scale), th.wood[0], th.wood[1], seed, scale, th.grain);
    ctx.drawImage(wood, 0, 0, W, H);
    // vinheta queimada
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(25,10,2,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // corredor do lançador (madeira mais escura)
    const pl = L.plungerLane;
    if (pl) { ctx.fillStyle = 'rgba(20,8,2,.35)'; ctx.fillRect(pl.x0 - 8, pl.top, pl.x1 - pl.x0 + 16, H - pl.top); }

    // 3) gravuras e título (por baixo dos trilhos)
    const D = L.decor || {};
    (D.icons || []).forEach(i => this.icon(ctx, i[0], i[1], i[2], i[3] || 70, th, i[4] || 0));
    (D.texts || []).forEach(t => {
      if (t.title) this.title(ctx, t.text, t.x, t.y, t.size || 70, th, t.rot || 0);
      else { ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot || 0); ctx.font = `${t.size || 18}px Rye, Georgia, serif`; ctx.textAlign = 'center'; ctx.fillStyle = th.burn; ctx.fillText(t.text, 0, 0); ctx.restore(); }
    });
    // insertos de luz
    const ins = th.insert;
    Object.values(L.lights.shots || {}).forEach(arr => arr.forEach(([x, y, a]) => this.insert(ctx, x, y, 'arrow', a, ins)));
    (L.lights.grid || []).forEach(([x, y], i) => this.insert(ctx, x, y, 'circle', 0, i === 6 ? '#ff6a3a' : ins, 1.25));
    (L.laneGroups || []).forEach(g => g.lanes.forEach(([x, y]) => this.insert(ctx, x, y, 'tri', 0, '#7fd4ff')));
    (L.outlanes || []).forEach(o => { const s = L.sensors[o.sensor]; if (s) this.insert(ctx, s[0], s[1], 'circle', 0, '#ff5a3a'); if (o.kickback) this.insert(ctx, o.kickback.x, o.kickback.y - 34, 'arrow', -90, '#7dff9a'); });
    (L.inlanes || []).forEach(o => { const s = L.sensors[o.sensor]; if (s) this.insert(ctx, s[0], s[1], 'circle', 0, ins, 0.8); });
    if (L.lights.drain) this.insert(ctx, L.lights.drain[0], L.lights.drain[1] - 34, 'circle', 0, '#7dff9a', 1.3);

    // 4) buracos (fundo escuro + aro de latão)
    (L.holes || []).forEach(h => {
      const black = h.type === 'blackhole', r = black ? 30 : 20;
      const g = ctx.createRadialGradient(h.x, h.y, 2, h.x, h.y, r);
      g.addColorStop(0, '#000'); g.addColorStop(0.7, black ? '#14061e' : '#120803'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, r - 4, 0, Math.PI * 2); ctx.stroke();
      if (h.label) { ctx.font = '14px Rye, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = th.burn; ctx.fillText(h.label, h.x, h.y + r + 14); }
    });
    // kickers (copo de latão)
    (L.kickers || []).forEach(k => {
      ctx.fillStyle = '#100703'; ctx.beginPath(); ctx.arc(k.x, k.y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = th.metal; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(k.x, k.y, 15, 0, Math.PI * 2); ctx.stroke();
    });

    // 5) trilhos, guias, postes
    const pat = ctx.createPattern(this.woodCanvas(160, 160, th.railWood[0], th.railWood[1], seed + 3, 1, 1.3), 'repeat');
    L.walls.forEach(w => {
      if (w.style === 'none') return;
      const t = w.t || 6;
      if (w.style === 'flap') { this.rail(ctx, w.pts, t, Object.assign({}, th, { railDark: '#140806' }), '#3a1608', { screws: false }); return; }
      if (w.style === 'outer') { this.rail(ctx, w.pts, t + 2, th, pat); return; }
      this.rail(ctx, w.pts, t, th, pat, { screws: w.style !== 'guide' });
    });
    (L.blocks || []).forEach(b => { this.pathPts(ctx, b.pts, true); ctx.fillStyle = pat; ctx.fill(); ctx.strokeStyle = th.railDark; ctx.lineWidth = 3; ctx.stroke(); });
    (L.gates || []).forEach(g => { ctx.save(); ctx.strokeStyle = '#b9b9b9'; ctx.lineWidth = 4; ctx.setLineDash([7, 5]); this.pathPts(ctx, g.pts); ctx.stroke(); ctx.restore(); });
    (L.posts || []).forEach(([x, y, r]) => this.post(ctx, x, y, r || 6, th));

    // 6) estilingues: madeira + borracha
    (L.slings || []).forEach(s => {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6;
      this.pathPts(ctx, s.pts, true); ctx.fillStyle = pat; ctx.fill();
      ctx.restore();
      this.pathPts(ctx, s.pts, true); ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#1a0b06'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
      const cx = (s.pts[0][0] + s.pts[1][0] + s.pts[2][0]) / 3, cy = (s.pts[0][1] + s.pts[1][1] + s.pts[2][1]) / 3;
      this.icon(ctx, 'lightning', cx, cy + 4, 34, th);
      s.pts.forEach(([x, y]) => this.screw(ctx, x, y, 6, th.metal));
    });

    // 7) avental (parte de baixo) com plaquinha
    ctx.save();
    const ap = ctx.createLinearGradient(0, 1140, 0, 1200); ap.addColorStop(0, th.apron[1]); ap.addColorStop(1, th.apron[0]);
    ctx.fillStyle = ap;
    ctx.beginPath(); ctx.moveTo(32, 1200); ctx.lineTo(32, 1150); ctx.quadraticCurveTo(418, 1185, 804, 1150); ctx.lineTo(804, 1200); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = th.metal; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, 1150); ctx.quadraticCurveTo(418, 1185, 804, 1150); ctx.stroke();
    ctx.restore();
    ctx.restore(); // fim do clip

    return c;
  },

  /** Camada das rampas de arame (transparente, vai por cima da bola) */
  renderRamps(def, scale = 1) {
    const L = def.layout; if (!L.ramps || !L.ramps.length) return null;
    const c = document.createElement('canvas'); c.width = Math.round(896 * scale); c.height = Math.round(1200 * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale);
    const th = def.theme || {}, metal = th.wire || '#cfd3d8';
    L.ramps.forEach(R => {
      const pts = this.smoothPath(R.path, 12);
      if (R.style === 'wood') { this.woodRamp(ctx, pts, def, R); return; }
      // sombra no tabuleiro
      ctx.save(); ctx.translate(10, 14); ctx.globalAlpha = 0.25; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      this.pathPts(ctx, pts); ctx.strokeStyle = '#000'; ctx.lineWidth = 30; ctx.stroke(); ctx.restore();
      // dois arames + travessas
      const off = (k) => pts.map((p, i) => {
        const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
        const dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1;
        return [p[0] - dy / d * k, p[1] + dx / d * k];
      });
      const A = off(15), B = off(-15);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < pts.length; i += 3) { ctx.strokeStyle = 'rgba(120,124,130,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(A[i][0], A[i][1]); ctx.lineTo(B[i][0], B[i][1]); ctx.stroke(); }
      [A, B].forEach(P => {
        this.pathPts(ctx, P); ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 6; ctx.stroke();
        this.pathPts(ctx, P); ctx.strokeStyle = metal; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.save(); ctx.translate(-0.8, -0.8); this.pathPts(ctx, P); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      });
      // aba de entrada (madeira)
      const [m0, m1] = [R.path[0], R.path[1] || R.path[0]];
      ctx.fillStyle = 'rgba(160,100,50,.85)'; ctx.beginPath(); ctx.arc(m0[0], m0[1], 16, 0, Math.PI * 2); ctx.fill();
    });
    return c;
  },

  /** rampa de madeira (a ferradura da mesa 1): calha larga com bordas e parafusos */
  woodRamp(ctx, pts, def, R) {
    const th = Object.assign({ railWood: ['#7a4620', '#c48444'], railDark: '#24120a', metal: '#d9a441' }, def.theme || {});
    const pat = ctx.createPattern(this.woodCanvas(160, 160, th.railWood[0], th.railWood[1], this.hashStr(def.id) + 11, 1, 1.3), 'repeat');
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(12, 16); ctx.globalAlpha = 0.35; this.pathPts(ctx, pts); ctx.strokeStyle = '#000'; ctx.lineWidth = 54; ctx.stroke(); ctx.restore();
    this.pathPts(ctx, pts); ctx.strokeStyle = th.railDark; ctx.lineWidth = 54; ctx.stroke();
    this.pathPts(ctx, pts); ctx.strokeStyle = pat; ctx.lineWidth = 48; ctx.stroke();
    this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(30,14,4,.55)'; ctx.lineWidth = 30; ctx.stroke();      // calha
    this.pathPts(ctx, pts); ctx.strokeStyle = pat; ctx.globalAlpha = 0.55; ctx.lineWidth = 26; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.translate(-1.5, -2); this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(255,236,200,.22)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    for (let i = 4; i < pts.length - 2; i += 6) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1;
      this.screw(ctx, p[0] - dy / d * 20, p[1] + dx / d * 20, 3.2, th.metal);
      this.screw(ctx, p[0] + dy / d * 20, p[1] - dx / d * 20, 3.2, th.metal);
    }
  },

  /** suaviza um caminho de pontos (Catmull-Rom) e devolve pontos espaçados ~step px */
  smoothPath(pts, step = 10) {
    if (pts.length < 2) return pts.slice();
    const P = [pts[0], ...pts, pts[pts.length - 1]], out = [];
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
};
