/* ============================================================
   UAI BALL – DESENHISTA DE MESAS  (versão 2: arte de fliperama)
   ------------------------------------------------------------
   Como uma mesa de fliperama de verdade é feita (Jersey Jack /
   Stern, "Creating the playfield"): madeira → arte pintada →
   insertos de acrílico que acendem → verniz por cima → peças
   (plásticos, metais, borrachas) por cima de tudo.
   Aqui é igual, em camadas, a partir dos MESMOS dados da física:
    1. gabinete e madeira com veios (identidade rústica mineira)
    2. pintura do cenário de cada mesa (céu, serra, casario...) com
       contorno de nanquim e retícula, deixando o veio aparecer
    3. sol/raios atrás do título, faixas pintadas nas bordas
    4. insertos de luz: acrílico colorido com brilho e rótulos
       (as luzes do jogo acendem em cima deles)
    5. trilhos de madeira com filete de latão, guias cromadas,
       postes com borracha, estilingues de plástico colorido
    6. buracos com aro cromado, placas com nome, avental de metal
    7. verniz: brilho diagonal, luz quente vinda de cima, vinheta
   Ícones que se mexem no jogo (engrenagem, sol, balão, estrela...)
   saem num desenho separado (iconCanvas) para a cena animar.
   ============================================================ */
window.UAI = window.UAI || {};

UAI.TableArt = {
  /* ---------- direção de arte de cada mesa (paleta + cenário) ---------- */
  ART: {
    uaiball:     { paint: ['#1c0d05', '#e8892e', '#f2c14e', '#2e6b7a', '#b5322a'], sky: ['#f6d58a', '#e98a3a'], hills: ['#8a4a22', '#5e2e12'], skyline: ['church', 'house', 'tree', 'church', 'house'], sun: [600, 250] },
    cozinha:     { paint: ['#1e0e06', '#d9542b', '#f4c35a', '#5b8c3a', '#8a3b1f'], sky: ['#fde7b4', '#f3a65a'], hills: ['#9a6a3a', '#6b3d1c'], skyline: ['house', 'tree', 'house', 'tree'], sun: [610, 240] },
    mariafumaca: { paint: ['#160b06', '#c24a2c', '#e9b44c', '#3f5c7a', '#6b2f1a'], sky: ['#f2b56b', '#8a4a6a'], hills: ['#5a3a4a', '#3a2028'], skyline: ['church', 'tree', 'house', 'tree', 'church'], sun: [240, 260] },
    ouropreto:   { paint: ['#1a0c04', '#d4a017', '#f7e08a', '#7a2e1e', '#2f4a5a'], sky: ['#fbe7a0', '#e7a33a'], hills: ['#7a4a1e', '#4e2a10'], skyline: ['church', 'house', 'church', 'house', 'church'], sun: [418, 230] },
    canastra:    { paint: ['#10140c', '#3d8fc6', '#f2d16b', '#4d8a3a', '#a65a2a'], sky: ['#cfeefa', '#7cc2e8'], hills: ['#5f8a3a', '#3a5e24'], skyline: ['tree', 'tree', 'cow', 'tree'], sun: [230, 240] },
    mineirao:    { paint: ['#06100a', '#2f9e44', '#f5f5f5', '#1f4fa0', '#e8c13a'], sky: ['#0c1a3a', '#24508a'], hills: ['#1f3a2a', '#0f2418'], skyline: ['flags', 'flags'], sun: [620, 230], night: true },
    arraia:      { paint: ['#140806', '#e8452c', '#f6c945', '#2f7fbf', '#4caf50'], sky: ['#141a3e', '#4a2a5a'], hills: ['#3a2040', '#22122a'], skyline: ['house', 'tree', 'house'], sun: [250, 240], night: true },
    diamantina:  { paint: ['#080a14', '#5fd0f0', '#e8f6ff', '#6a3fa0', '#d9a441'], sky: ['#0a1030', '#2a3a7a'], hills: ['#2a2a4a', '#161630'], skyline: ['house', 'church', 'house', 'house', 'church'], sun: [610, 230], night: true },
    capitolio:   { paint: ['#08120f', '#1fb3c9', '#f3d27a', '#7a4a2a', '#2e7d4f'], sky: ['#d6f4ff', '#6cc6e6'], hills: ['#a0603a', '#6e3a1e'], skyline: ['tree', 'tree', 'tree'], sun: [610, 240] },
    inhotim:     { paint: ['#120a10', '#e0408f', '#ffd23f', '#2fb37a', '#3a5fd9'], sky: ['#ffe3f0', '#9ed8c8'], hills: ['#3f8a5a', '#24603a'], skyline: ['tree', 'sculpture', 'tree', 'tree'], sun: [230, 240] },
    avanco:      { paint: ['#04050c', '#7a8aff', '#9ff0ff', '#ff5fa8', '#ffd24a'], sky: ['#02030a', '#1a1f4a'], hills: ['#2a2f6a', '#141838'], skyline: [], sun: [610, 230], night: true, space: true }
  },

  /* ícones que a cena anima (o resto fica pintado na mesa) */
  ANIM: { gear: 'spin', sun: 'spin', star: 'twinkle', diamond: 'twinkle', balloon: 'float', rocket: 'float', moon: 'float', planet: 'float',
          bonfire: 'flicker', lantern: 'flicker', train: 'smoke', coffee: 'smoke', waterfall: 'shimmer', waves: 'shimmer' },
  SPRITE_ANIM: { spin: 1, twinkle: 1, float: 1 },

  /* ---------- utilidades ---------- */
  rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); },
  hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; },
  hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; },
  rgb(c, a = 1) { return 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')'; },
  shade(hex, t, a = 1) { const c = this.hex(hex); return this.rgb(t >= 0 ? this.mix(c, [255, 255, 255], t) : this.mix(c, [0, 0, 0], -t), a); },

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

  /** Madeira com veios (tábuas verticais) */
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
    g.addColorStop(0, '#fff7d8'); g.addColorStop(0.45, metal); g.addColorStop(1, '#3a2408');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,4,.85)'; ctx.lineWidth = Math.max(1, r * 0.25);
    ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.6, y + r * 0.2); ctx.stroke();
  },

  /** aço cromado: traço com degradê claro/escuro (guias, aros) */
  chromeStroke(ctx, w) {
    ctx.lineWidth = w + 2; ctx.strokeStyle = '#1a1c20'; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = '#8d939c'; ctx.stroke();
    ctx.lineWidth = Math.max(1, w * 0.45); ctx.strokeStyle = '#dfe4ea'; ctx.stroke();
    ctx.lineWidth = Math.max(0.8, w * 0.15); ctx.strokeStyle = '#ffffff'; ctx.stroke();
  },

  /** trilho de madeira envernizada com filete de latão no meio */
  rail(ctx, pts, t, th, pattern, opts = {}) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 9;
    this.pathPts(ctx, pts); ctx.strokeStyle = th.railDark; ctx.lineWidth = t * 2 + 3; ctx.stroke();
    ctx.shadowColor = 'transparent';
    this.pathPts(ctx, pts); ctx.strokeStyle = pattern || th.rail; ctx.lineWidth = t * 2 - 1; ctx.stroke();
    // verniz: brilho de cima e sombra de baixo
    ctx.save(); ctx.translate(-1.4, -1.8);
    this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(255,240,210,.32)'; ctx.lineWidth = Math.max(1.5, t * 0.5); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(1.6, 2.2);
    this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(20,8,2,.35)'; ctx.lineWidth = Math.max(1.5, t * 0.45); ctx.stroke();
    ctx.restore();
    if (opts.inlay !== false && t >= 6) {
      this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(40,20,4,.6)'; ctx.lineWidth = 2.6; ctx.stroke();
      this.pathPts(ctx, pts); ctx.strokeStyle = th.metal; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ctx.restore();
    if (opts.screws !== false && t >= 6) {
      let acc = 50;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], L = Math.hypot(x2 - x1, y2 - y1);
        while (acc < L) { const k = acc / L; this.screw(ctx, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 3.2, th.metal); acc += 140; }
        acc -= L;
      }
    }
  },

  /** poste: borracha branca em volta de um pino de plástico colorido */
  post(ctx, x, y, r, th, color) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#ece8dc'; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0.5, x, y, r);
    g.addColorStop(0, this.shade(color, 0.6)); g.addColorStop(0.5, color); g.addColorStop(1, this.shade(color, -0.5));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    this.screw(ctx, x, y, Math.max(2.2, r * 0.45), '#c8ccd2');
  },

  /* ---------- insertos (acrílico colorido que acende) ---------- */
  insertShape(ctx, kind, s) {
    ctx.beginPath();
    if (kind === 'arrow') { ctx.moveTo(18 * s, 0); ctx.lineTo(-12 * s, -14 * s); ctx.lineTo(-5 * s, 0); ctx.lineTo(-12 * s, 14 * s); ctx.closePath(); }
    else if (kind === 'tri') { ctx.moveTo(0, -14 * s); ctx.lineTo(13 * s, 10 * s); ctx.lineTo(-13 * s, 10 * s); ctx.closePath(); }
    else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 6 : 14) * s; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
    else if (kind === 'pill') { const w = 22 * s, h = 10 * s; ctx.moveTo(-w + h, -h); ctx.lineTo(w - h, -h); ctx.arc(w - h, 0, h, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-w + h, h); ctx.arc(-w + h, 0, h, Math.PI / 2, -Math.PI / 2); ctx.closePath(); }
    else ctx.arc(0, 0, 11 * s, 0, Math.PI * 2);
  },

  insert(ctx, x, y, kind, ang, color, s = 1, label, ink = '#140a04') {
    ctx.save(); ctx.translate(x, y); ctx.rotate((ang || 0) * Math.PI / 180);
    // recorte na madeira (sombra do encaixe)
    ctx.save(); ctx.scale(1.18, 1.18); this.insertShape(ctx, kind, s); ctx.fillStyle = 'rgba(10,5,2,.85)'; ctx.fill(); ctx.restore();
    // acrílico
    this.insertShape(ctx, kind, s);
    const g = ctx.createRadialGradient(-3 * s, -4 * s, 1, 0, 0, 16 * s);
    g.addColorStop(0, this.shade(color, 0.55, 0.95)); g.addColorStop(0.45, this.shade(color, 0, 0.9)); g.addColorStop(1, this.shade(color, -0.55, 0.92));
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
    // brilho do verniz
    ctx.save(); this.insertShape(ctx, kind, s); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.beginPath(); ctx.ellipse(-4 * s, -6 * s, 9 * s, 4 * s, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
    if (label) this.label(ctx, label, x, y + 22 * s + 6, 11, ink);
  },

  /** letreiro pequeno pintado (branco com contorno de nanquim) */
  label(ctx, text, x, y, size = 12, ink = '#140a04', fill = '#fff6e0', rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `${size}px Bungee, Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.42; ctx.strokeStyle = ink; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(text, 0, 0);
    ctx.restore();
  },

  /* ---------- gravuras ---------- */
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

  /** ícones feitos só de traços (não dá para pintar por dentro) */
  LINE_ICONS: { waves: 1, flags: 1, waterfall: 1, sun: 1, pickaxe: 0 },

  /** pirografia (queimado na madeira) – usado nos detalhes pequenos */
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

  /** ícone PINTADO estilo cartaz: cor chapada com degradê, retícula, contorno de nanquim e brilho */
  paintIcon(ctx, name, x, y, s, P, rot = 0, colorIdx) {
    const f = this.icons[name]; if (!f) return;
    const ink = P[0], base = P[colorIdx != null ? colorIdx : 1 + (this.hashStr(name) % 4)];
    const k = s / 100, lineOnly = this.LINE_ICONS[name];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // sombra projetada
    ctx.save(); ctx.translate(5, 7); ctx.beginPath(); f(ctx);
    if (!lineOnly) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 9; ctx.stroke(); ctx.restore();
    ctx.beginPath(); f(ctx);
    if (!lineOnly) {
      const g = ctx.createLinearGradient(-40, -45, 40, 45);
      g.addColorStop(0, this.shade(base, 0.45)); g.addColorStop(0.55, base); g.addColorStop(1, this.shade(base, -0.35));
      ctx.fillStyle = g; ctx.fill();
      // retícula de sombra no canto de baixo
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      for (let yy = -50; yy < 60; yy += 6) for (let xx = -60; xx < 60; xx += 6) if (xx + yy > 18) { ctx.beginPath(); ctx.arc(xx + (yy % 12 ? 3 : 0), yy, 1.2 + (xx + yy - 18) * 0.012, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); f(ctx);
      ctx.strokeStyle = ink; ctx.lineWidth = 6.5; ctx.stroke();
      ctx.save(); ctx.translate(-1.5, -1.8); ctx.beginPath(); f(ctx); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    } else {
      ctx.strokeStyle = ink; ctx.lineWidth = 11; ctx.stroke();
      ctx.strokeStyle = base; ctx.lineWidth = 5.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  },

  /** ícone animado num canvas próprio (a cena gira/flutua/pisca ele) */
  iconCanvas(def, name, size) {
    const P = this.artOf(def).paint, pad = 1.35;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(size * pad * 1.25);
    const ctx = c.getContext('2d');
    this.paintIcon(ctx, name, c.width / 2 - 3, c.height / 2 - 4, size, P, 0);
    return c;
  },

  artOf(def) {
    return Object.assign({ paint: ['#1c0d05', '#e8892e', '#f2c14e', '#2e6b7a', '#b5322a'], sky: ['#f6d58a', '#e98a3a'], hills: ['#8a4a22', '#5e2e12'], skyline: [], sun: [600, 240] },
      this.ART[def.id] || {}, (def.theme && def.theme.art) || {});
  },

  /** título: letras com volume (extrusão), contorno de nanquim, faixa atrás */
  title(ctx, text, x, y, size, th, rot = 0, P) {
    P = P || ['#1c0d05', th.insert, th.inlay[0]];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `${size}px Rye, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let w = ctx.measureText(text).width;
    if (w > 330) { size = Math.floor(size * 330 / w); ctx.font = `${size}px Rye, Georgia, serif`; w = ctx.measureText(text).width; }
    // faixa (fita) atrás do nome
    const bw = w / 2 + size * 0.55, bh = size * 0.42;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.moveTo(-bw - size * 0.35, -bh * 0.2); ctx.lineTo(-bw, -bh); ctx.lineTo(bw, -bh); ctx.lineTo(bw + size * 0.35, -bh * 0.2);
    ctx.lineTo(bw + size * 0.15, bh * 0.25); ctx.lineTo(bw + size * 0.35, bh); ctx.lineTo(-bw - size * 0.35, bh); ctx.lineTo(-bw - size * 0.15, bh * 0.25); ctx.closePath();
    const bg = ctx.createLinearGradient(0, -bh, 0, bh);
    bg.addColorStop(0, this.shade(P[4] || P[1], 0.15)); bg.addColorStop(1, this.shade(P[4] || P[1], -0.35));
    ctx.fillStyle = bg; ctx.fill();
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = P[0]; ctx.stroke();
    ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,180,.6)';
    ctx.beginPath(); ctx.moveTo(-bw + 6, -bh + 6); ctx.lineTo(bw - 6, -bh + 6); ctx.moveTo(-bw + 6, bh - 6); ctx.lineTo(bw - 6, bh - 6); ctx.stroke(); ctx.setLineDash([]);
    // extrusão (volume)
    for (let d = 7; d >= 1; d--) { ctx.fillStyle = d > 5 ? 'rgba(0,0,0,.45)' : P[0]; ctx.fillText(text, d * 0.5, d); }
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.14; ctx.strokeStyle = P[0]; ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(0.35, th.inlay[0]); g.addColorStop(0.62, th.inlay[1]); g.addColorStop(1, this.shade(th.inlay[1], -0.25));
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.strokeText(text, -1, -1.5);
    ctx.restore();
  },

  /* ---------- pintura do cenário ---------- */
  paintScene(ctx, def, A, seed) {
    const W = 896, H = 1200, r = this.rng(seed + 99), N = this.makeNoise(seed + 5);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), P = A.paint;
    const top = 70, horizon = A.space ? 560 : 430;
    // céu
    const sky = x.createLinearGradient(0, top, 0, horizon + 120);
    sky.addColorStop(0, A.sky[0]); sky.addColorStop(1, A.sky[1]);
    x.fillStyle = sky; x.fillRect(0, top, W, horizon + 140 - top);
    // estrelas (noite)
    if (A.night) for (let i = 0; i < 140; i++) {
      const sx = r() * W, sy = top + r() * (horizon - top), sr = r() * 1.6 + 0.4;
      x.fillStyle = 'rgba(255,255,240,' + (0.4 + r() * 0.6) + ')'; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill();
      if (sr > 1.7) { x.strokeStyle = 'rgba(255,255,240,.5)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(sx - 5, sy); x.lineTo(sx + 5, sy); x.moveTo(sx, sy - 5); x.lineTo(sx, sy + 5); x.stroke(); }
    }
    // sol / lua com raios
    const [sx, sy] = A.sun;
    x.save(); x.translate(sx, sy);
    for (let i = 0; i < 16; i++) {
      x.rotate(Math.PI / 8);
      x.fillStyle = A.night ? 'rgba(200,220,255,.07)' : 'rgba(255,250,220,.22)';
      x.beginPath(); x.moveTo(0, 0); x.lineTo(420, -40); x.lineTo(420, 40); x.closePath(); x.fill();
    }
    const sg = x.createRadialGradient(0, 0, 10, 0, 0, 120);
    sg.addColorStop(0, A.night ? 'rgba(240,245,255,.9)' : 'rgba(255,252,225,1)'); sg.addColorStop(0.45, A.night ? 'rgba(180,200,255,.35)' : 'rgba(255,220,140,.6)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 120, 0, 7); x.fill();
    x.fillStyle = A.night ? '#eef2ff' : '#fff6cf'; x.strokeStyle = P[0]; x.lineWidth = 4;
    x.beginPath(); x.arc(0, 0, 46, 0, 7); x.fill(); x.stroke();
    if (A.night) { x.fillStyle = 'rgba(120,130,170,.35)'; [[-14, -10, 9], [12, 8, 7], [8, -18, 5]].forEach(([a, b, rr]) => { x.beginPath(); x.arc(a, b, rr, 0, 7); x.fill(); }); }
    x.restore();
    // nuvens
    if (!A.space) for (let i = 0; i < 4; i++) {
      const cx = 140 + r() * 600, cy = top + 40 + r() * (horizon - top - 160), s = 0.7 + r() * 0.6;
      x.save(); x.translate(cx, cy); x.scale(s, s);
      const blobs = [[-40, 6, 22], [-12, -8, 30], [22, -2, 26], [46, 8, 18], [4, 12, 24]];
      const shape = () => { x.beginPath(); blobs.forEach(([a, b, rr]) => { x.moveTo(a + rr, b); x.arc(a, b, rr, 0, 7); }); };
      shape(); x.strokeStyle = this.rgb(this.hex(P[0]), A.night ? 0.25 : 0.45); x.lineWidth = 6; x.stroke();   // contorno só por fora
      shape(); x.fillStyle = A.night ? 'rgb(70,76,120)' : '#fffdf6'; x.fill();
      x.fillStyle = A.night ? 'rgba(20,24,60,.35)' : 'rgba(150,170,200,.35)';
      x.beginPath(); blobs.forEach(([a, b, rr]) => { x.moveTo(a + rr, b + rr * 0.35); x.arc(a, b + rr * 0.35, rr * 0.75, 0, Math.PI); }); x.fill();
      x.restore();
    }
    if (A.space) {
      // planeta gigante no horizonte e anéis
      x.save(); x.translate(418, horizon + 380);
      const pg = x.createRadialGradient(-120, -260, 40, 0, 0, 470);
      pg.addColorStop(0, this.shade(P[1], 0.3)); pg.addColorStop(0.6, P[1]); pg.addColorStop(1, this.shade(P[1], -0.7));
      x.fillStyle = pg; x.beginPath(); x.arc(0, 0, 440, 0, 7); x.fill();
      x.strokeStyle = P[0]; x.lineWidth = 5; x.stroke();
      x.strokeStyle = this.rgb(this.hex(P[2]), 0.6); x.lineWidth = 7; x.beginPath(); x.ellipse(0, -60, 620, 120, -0.08, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      x.restore();
    } else {
      // serra ao longe e morros perto (silhuetas com contorno)
      const ridge = (base, amp, freq, col, off) => {
        x.beginPath(); x.moveTo(0, H);
        for (let X = 0; X <= W; X += 8) x.lineTo(X, base - (N(X * freq + off, off) - 0.3) * amp - Math.sin(X / 140 + off) * amp * 0.25);
        x.lineTo(W, H); x.closePath();
        x.fillStyle = col; x.fill(); x.strokeStyle = P[0]; x.lineWidth = 3.5; x.stroke();
      };
      ridge(horizon, 120, 0.006, A.hills[0], 3.1);
      // casario / árvores em cima do morro de perto
      const near = horizon + 70;
      const sk = A.skyline || [];
      sk.forEach((nm, i) => {
        const px = 120 + (i + 0.5) * (656 / sk.length) + (r() - 0.5) * 40, sz = 46 + r() * 26;
        this.paintIcon(x, nm, px, near - sz * 0.28, sz, [P[0], this.shade(A.hills[1], -0.25), this.shade(A.hills[1], -0.1), this.shade(A.hills[1], -0.3), this.shade(A.hills[1], -0.2)], 0, 1 + (i % 4));
        // janelinhas acesas à noite
        if (A.night && (nm === 'house' || nm === 'church')) { x.fillStyle = 'rgba(255,214,120,.9)'; x.fillRect(px - 4, near - sz * 0.28 + 2, 6, 7); }
      });
      ridge(near + 10, 60, 0.01, A.hills[1], 7.7);
    }
    // retícula descendo (passagem do céu para a madeira)
    x.fillStyle = this.rgb(this.hex(P[0]), 0.16);
    for (let yy = horizon + 60; yy < horizon + 330; yy += 9) for (let xx = (yy / 9 % 2) * 4.5; xx < W; xx += 9) {
      const k = (yy - horizon - 60) / 270; x.beginPath(); x.arc(xx, yy, 0.6 + k * 2.6, 0, 7); x.fill();
    }
    // máscara: a pintura some aos poucos para baixo (deixa a madeira aparecer)
    x.globalCompositeOperation = 'destination-in';
    const m = x.createLinearGradient(0, 0, 0, H);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop((horizon + 120) / H, 'rgba(0,0,0,.95)'); m.addColorStop((horizon + 360) / H, 'rgba(0,0,0,0)');
    x.fillStyle = m; x.fillRect(0, 0, W, H);
    return c;
  },

  /* ---------- mesa completa ---------- */
  render(def, scale = 1, opts = {}) {
    const W = 896, H = 1200, L = def.layout;
    const th = Object.assign({
      wood: ['#6b3d18', '#b9793c'], frame: ['#2a160a', '#5a3214'], rail: '#8a5426', railDark: '#24120a',
      railWood: ['#7a4620', '#c48444'], metal: '#d9a441', burn: 'rgba(42,18,5,.78)', burnFill: 'rgba(42,18,5,.12)',
      inlay: ['#ffd89a', '#d08a3c'], insert: '#e8a040', apron: ['#1d0f07', '#3a1d0b'], grain: 1
    }, def.theme || {});
    const A = this.artOf(def), P = A.paint, ink = P[0];
    const seed = this.hashStr(def.id);
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale);

    // 1) gabinete
    ctx.drawImage(this.woodCanvas(Math.ceil(W * scale), Math.ceil(H * scale), th.frame[0], th.frame[1], seed + 7, scale, 0.8), 0, 0, W, H);
    const fg = ctx.createLinearGradient(0, 0, W, 0);
    fg.addColorStop(0, 'rgba(0,0,0,.45)'); fg.addColorStop(0.08, 'rgba(0,0,0,0)'); fg.addColorStop(0.92, 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);

    // 2) tabuleiro
    const outer = (L.walls.find(w => w.id === 'externa') || L.walls[0]).pts;
    ctx.save();
    this.pathPts(ctx, [...outer, [860, 1200], [32, 1200]], true); ctx.clip();
    const wood = this.woodCanvas(Math.ceil(W * scale), Math.ceil(H * scale), th.wood[0], th.wood[1], seed, scale, th.grain);
    ctx.drawImage(wood, 0, 0, W, H);
    // pintura do cenário em cima da madeira, e o veio de volta por cima (tinta sobre madeira)
    ctx.drawImage(this.paintScene(ctx, def, A, seed), 0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.38; ctx.drawImage(wood, 0, 0, W, H); ctx.restore();

    // raios atrás do título e faixas pintadas
    const D = L.decor || {};
    const tt = (D.texts || []).find(t => t.title);
    if (tt) {
      ctx.save(); ctx.translate(tt.x, tt.y);
      const rg = ctx.createRadialGradient(0, 0, 20, 0, 0, 320);
      rg.addColorStop(0, this.shade(P[2], 0, 0.55)); rg.addColorStop(1, this.shade(P[2], 0, 0));
      for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.fillStyle = i % 2 ? rg : 'rgba(0,0,0,0)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(340, -46); ctx.lineTo(340, 46); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    // parte de baixo: tinta escurecendo para o avental + medalhão atrás das luzes do multiplicador
    const low = ctx.createLinearGradient(0, 760, 0, 1160);
    low.addColorStop(0, this.shade(P[3], -0.3, 0)); low.addColorStop(1, this.shade(P[3], -0.45, 0.55));
    ctx.fillStyle = low; ctx.fillRect(0, 760, W, 440);
    const grid = L.lights.grid || [];
    if (grid.length) {
      const gx = grid.reduce((a, p) => a + p[0], 0) / grid.length, gy = grid.reduce((a, p) => a + p[1], 0) / grid.length;
      ctx.save(); ctx.translate(gx, gy);
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      const mg = ctx.createRadialGradient(0, -20, 10, 0, 0, 112);
      mg.addColorStop(0, this.shade(P[3], 0.15, 0.95)); mg.addColorStop(1, this.shade(P[3], -0.5, 0.95));
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, 108, 0, 7); ctx.fill();
      ctx.restore(); ctx.save(); ctx.translate(gx, gy);
      ctx.lineWidth = 5; ctx.strokeStyle = ink; ctx.beginPath(); ctx.arc(0, 0, 108, 0, 7); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.strokeStyle = th.metal; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(0, 0, 96, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.fillStyle = i % 2 ? P[2] : P[4]; ctx.beginPath(); ctx.arc(Math.cos(a) * 108, Math.sin(a) * 108, 5, 0, 7); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
      this.label(ctx, 'MULTIPLICADOR', gx, gy - 92, 10, ink, this.shade(P[2], 0.4));
    }
    // arabescos barrocos (como nas igrejas de Minas) ao lado das palhetas
    [[1, 0], [-1, 0]].forEach(([sgn]) => {
      ctx.save(); ctx.translate(418 + sgn * 190, 1105); ctx.scale(sgn, 1);
      ctx.strokeStyle = this.shade(P[2], 0, 0.55); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-70, 20); ctx.bezierCurveTo(-30, -30, 20, 30, 60, -10); ctx.bezierCurveTo(80, -30, 60, -50, 44, -36); ctx.bezierCurveTo(34, -26, 46, -14, 54, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-40, 6); ctx.bezierCurveTo(-50, -20, -20, -34, -12, -16); ctx.stroke();
      ctx.restore();
    });
    // faixa colorida ao longo da borda (pintura de fábrica)
    ctx.save(); this.pathPts(ctx, outer); ctx.lineJoin = 'round';
    ctx.strokeStyle = this.shade(P[4], 0, 0.75); ctx.lineWidth = 64; ctx.stroke();
    ctx.strokeStyle = this.shade(P[2], 0, 0.9); ctx.lineWidth = 40; ctx.stroke();
    ctx.strokeStyle = ink; ctx.lineWidth = 36; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
    // corredor do lançador
    const pl = L.plungerLane;
    if (pl) {
      const lg = ctx.createLinearGradient(pl.x0 - 8, 0, pl.x1 + 8, 0);
      lg.addColorStop(0, 'rgba(10,4,1,.7)'); lg.addColorStop(0.5, 'rgba(40,20,8,.35)'); lg.addColorStop(1, 'rgba(10,4,1,.7)');
      ctx.fillStyle = lg; ctx.fillRect(pl.x0 - 8, pl.top - 40, pl.x1 - pl.x0 + 16, H - pl.top + 40);
      this.label(ctx, 'TACADA DE MESTRE', (pl.x0 + pl.x1) / 2, pl.top + 260, 11, ink, '#ffe9b0', -Math.PI / 2);
    }
    // faixas das inlanes/outlanes
    (L.walls.filter(w => /^divisor/.test(w.id))).forEach(w => {
      ctx.save(); this.pathPts(ctx, w.pts); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = this.shade(P[1], 0, 0.5); ctx.lineWidth = 46; ctx.stroke(); ctx.restore();
    });

    // 3) gravuras: ícones grandes pintados, pequenos pirografados
    (D.icons || []).forEach(i => {
      const [nm, ix, iy, sz = 70, rot = 0] = i;
      if (opts.skipAnim && this.SPRITE_ANIM[this.ANIM[nm]]) return;
      if (sz >= 44) this.paintIcon(ctx, nm, ix, iy, sz * 1.25, P, rot);
      else this.icon(ctx, nm, ix, iy, sz, th, rot);
    });
    (D.texts || []).forEach(t => {
      if (t.title) this.title(ctx, t.text, t.x, t.y, t.size || 70, th, t.rot || 0, P);
      else this.label(ctx, t.text.toUpperCase(), t.x, t.y, Math.max(10, (t.size || 16) * 0.8), ink, this.shade(P[2], 0.5), t.rot || 0);
    });

    // 4) insertos de luz
    const ins = th.insert;
    Object.entries(L.lights.shots || {}).forEach(([id, arr]) => {
      const sh = (L.shots || []).find(s => s.id === id) || (L.ramps || []).find(s => s.id === id);
      arr.forEach(([x, y, a], k) => this.insert(ctx, x, y, 'arrow', a, k % 2 ? P[2] : ins, 1.05));
      if (sh && arr.length) { const [x, y] = arr[arr.length - 1]; this.label(ctx, (sh.name || '').replace(/!/g, ''), x, y + 30, 10, ink, '#ffffff'); }
    });
    (L.lights.grid || []).forEach(([x, y], i) => this.insert(ctx, x, y, 'circle', 0, i === 6 ? P[4] : P[2], 1.3, (i + 2) + 'X', ink));
    (L.laneGroups || []).forEach(g => g.lanes.forEach(([x, y]) => this.insert(ctx, x, y, g.lanes.length > 3 || y < 300 ? 'tri' : 'star', 0, P[3], 1.1)));
    (L.outlanes || []).forEach(o => {
      const s = L.sensors[o.sensor]; if (s) this.insert(ctx, s[0], s[1], 'circle', 0, P[4], 0.95);
      if (o.kickback) { this.insert(ctx, o.kickback.x, o.kickback.y - 34, 'arrow', -90, '#4ee07a', 1); this.label(ctx, 'KICKBACK', o.kickback.x, o.kickback.y + 2, 9, ink, '#c8ffd8'); }
    });
    (L.inlanes || []).forEach(o => { const s = L.sensors[o.sensor]; if (s) this.insert(ctx, s[0], s[1], 'circle', 0, ins, 0.8); });
    if (L.lights.drain) { this.insert(ctx, L.lights.drain[0], L.lights.drain[1] - 34, 'pill', 0, '#4ee07a', 1.2); this.label(ctx, 'BOLA SALVA', L.lights.drain[0], L.lights.drain[1] - 34, 9, ink, '#ffffff'); }
    if (L.ballStart) for (let i = 0; i < 8; i++) this.insert(ctx, L.ballStart[0], L.ballStart[1] - 40 - i * 34, 'circle', 0, i < 5 ? '#f2c14e' : '#e8452c', 0.62);
    // lâmpadas de iluminação geral na borda (soquetes)
    let carry = 0;
    for (let i = 0; i < outer.length - 1; i++) {
      const [x1, y1] = outer[i], [x2, y2] = outer[i + 1], len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = carry; d < len; d += 46) {
        const t = d / len, bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t;
        if (by > 1120) continue;
        ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
        const bg = ctx.createRadialGradient(bx - 1, by - 1, 0.5, bx, by, 4.5);
        bg.addColorStop(0, '#fffbe8'); bg.addColorStop(1, '#d8a040'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, 4.2, 0, 7); ctx.fill();
      }
      carry = Math.max(0, 46 - (len % 46));
    }

    // 5) buracos (aro cromado, anel de luz, placa com o nome)
    (L.holes || []).forEach(h => {
      const black = h.type === 'blackhole', r = black ? 30 : 20;
      if (black) {
        ctx.save(); ctx.translate(h.x, h.y);
        for (let k = 0; k < 4; k++) {
          ctx.rotate(Math.PI / 2); ctx.beginPath();
          for (let q = 0; q <= 30; q++) { const t = q / 30, rr = 10 + t * 52, a = t * 3.6; q ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.strokeStyle = 'rgba(150,80,255,.55)'; ctx.lineWidth = 6; ctx.stroke();
        }
        ctx.restore();
      }
      const g = ctx.createRadialGradient(h.x, h.y + 3, 2, h.x, h.y, r);
      g.addColorStop(0, '#000'); g.addColorStop(0.75, black ? '#12051c' : '#0e0603'); g.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(h.x, h.y, r - 3, 0, Math.PI * 2); this.chromeStroke(ctx, 4);
      ctx.beginPath(); ctx.arc(h.x, h.y, r + 6, 0, Math.PI * 2); ctx.strokeStyle = this.shade(black ? '#a060ff' : P[2], 0, 0.75); ctx.lineWidth = 4; ctx.stroke();
      if (h.label) {
        ctx.font = '10px Bungee, Impact, sans-serif'; const tw = ctx.measureText(h.label).width + 12;
        ctx.fillStyle = ink; ctx.strokeStyle = th.metal; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(h.x - tw / 2, h.y + r + 6, tw, 16, 4) : ctx.rect(h.x - tw / 2, h.y + r + 6, tw, 16); ctx.fill(); ctx.stroke();
        ctx.fillStyle = th.inlay[0]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(h.label, h.x, h.y + r + 14.5);
      }
    });
    (L.kickers || []).forEach(k => {
      ctx.fillStyle = '#0a0402'; ctx.beginPath(); ctx.arc(k.x, k.y, 18, 0, Math.PI * 2); ctx.fill();
      const kg = ctx.createRadialGradient(k.x - 5, k.y - 5, 2, k.x, k.y, 17);
      kg.addColorStop(0, '#fff2c0'); kg.addColorStop(0.5, th.metal); kg.addColorStop(1, '#4a2e08');
      ctx.strokeStyle = kg; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(k.x, k.y, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e8452c'; ctx.beginPath(); ctx.arc(k.x, k.y, 5, 0, 7); ctx.fill();
    });

    // 6) trilhos, guias, portões, postes
    const pat = ctx.createPattern(this.woodCanvas(160, 160, th.railWood[0], th.railWood[1], seed + 3, 1, 1.3), 'repeat');
    L.walls.forEach(w => {
      if (w.style === 'none') return;
      const t = w.t || 6;
      if (w.style === 'flap') { ctx.save(); this.pathPts(ctx, w.pts); ctx.lineCap = 'round'; ctx.strokeStyle = P[4]; ctx.lineWidth = t * 2 + 2; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); return; }
      if (w.style === 'guide') { ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 4; this.pathPts(ctx, w.pts); this.chromeStroke(ctx, t * 1.6); ctx.restore(); return; }
      if (w.style === 'outer') { this.rail(ctx, w.pts, t + 3, th, pat); return; }
      this.rail(ctx, w.pts, t, th, pat);
    });
    (L.blocks || []).forEach(b => { this.pathPts(ctx, b.pts, true); ctx.fillStyle = pat; ctx.fill(); ctx.strokeStyle = th.railDark; ctx.lineWidth = 3; ctx.stroke(); });
    (L.gates || []).forEach(g => {
      ctx.save(); ctx.lineCap = 'round'; this.pathPts(ctx, g.pts); this.chromeStroke(ctx, 3); ctx.restore();
      g.pts.forEach(([x, y]) => this.screw(ctx, x, y, 4, '#c8ccd2'));
    });
    (L.posts || []).forEach(([x, y, r], i) => this.post(ctx, x, y, r || 6, th, i % 2 ? P[1] : P[4]));

    // 7) estilingues de plástico colorido com borracha branca
    (L.slings || []).forEach(s => {
      const cx = (s.pts[0][0] + s.pts[1][0] + s.pts[2][0]) / 3, cy = (s.pts[0][1] + s.pts[1][1] + s.pts[2][1]) / 3;
      ctx.save(); ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 8;
      this.pathPts(ctx, s.pts, true); ctx.fillStyle = '#ece8dc'; ctx.lineWidth = 11; ctx.strokeStyle = '#ece8dc'; ctx.stroke(); ctx.fill();
      ctx.restore();
      ctx.save(); this.pathPts(ctx, s.pts, true); ctx.clip();
      const sg = ctx.createLinearGradient(cx - 50, cy - 60, cx + 50, cy + 60);
      sg.addColorStop(0, this.shade(P[1], 0.3)); sg.addColorStop(1, this.shade(P[1], -0.3));
      ctx.fillStyle = sg; ctx.fillRect(cx - 120, cy - 120, 240, 240);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let k = -120; k < 120; k += 14) { ctx.beginPath(); ctx.moveTo(cx + k, cy - 120); ctx.lineTo(cx + k + 6, cy - 120); ctx.lineTo(cx + k - 114, cy + 120); ctx.lineTo(cx + k - 120, cy + 120); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      this.pathPts(ctx, s.pts, true); ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = ink; ctx.stroke();
      this.paintIcon(ctx, 'lightning', cx, cy + 4, 40, P, 0, 2);
      s.pts.forEach(([x, y]) => this.post(ctx, x, y, 5, th, P[4]));
    });

    // 8) avental de metal com cartão de instruções
    ctx.save();
    ctx.beginPath(); ctx.moveTo(32, 1200); ctx.lineTo(32, 1148); ctx.quadraticCurveTo(418, 1186, 804, 1148); ctx.lineTo(804, 1200); ctx.closePath();
    const ap = ctx.createLinearGradient(0, 1140, 0, 1200); ap.addColorStop(0, this.shade(P[4], -0.35)); ap.addColorStop(1, this.shade(P[4], -0.75));
    ctx.fillStyle = ap; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(32, 1148); ctx.quadraticCurveTo(418, 1186, 804, 1148); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.restore();

    // 9) verniz: luz quente de cima, brilho diagonal e vinheta
    const gi = ctx.createRadialGradient(W / 2, 80, 30, W / 2, 200, 760);
    gi.addColorStop(0, 'rgba(255,230,170,.16)'); gi.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = gi; ctx.fillRect(0, 0, W, H);
    const gl = ctx.createLinearGradient(0, 0, W, H * 0.7);
    gl.addColorStop(0.3, 'rgba(255,255,255,0)'); gl.addColorStop(0.42, 'rgba(255,255,255,.07)'); gl.addColorStop(0.47, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(15,6,1,.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.restore(); // fim do recorte

    return c;
  },

  /** Rampas por cima da bola: arame cromado (ou madeira) + placa com o nome */
  renderRamps(def, scale = 1) {
    const L = def.layout; if (!L.ramps || !L.ramps.length) return null;
    const c = document.createElement('canvas'); c.width = Math.round(896 * scale); c.height = Math.round(1200 * scale);
    const ctx = c.getContext('2d'); ctx.scale(scale, scale);
    const th = def.theme || {}, metal = th.wire || '#dfe4ea', P = this.artOf(def).paint;
    L.ramps.forEach(R => {
      const pts = this.smoothPath(R.path, 12);
      if (R.style === 'wood') this.woodRamp(ctx, pts, def, R);
      else {
        ctx.save(); ctx.translate(12, 16); ctx.globalAlpha = 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        this.pathPts(ctx, pts); ctx.strokeStyle = '#000'; ctx.lineWidth = 32; ctx.stroke(); ctx.restore();
        const off = (k) => pts.map((p, i) => {
          const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
          const dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1;
          return [p[0] - dy / d * k, p[1] + dx / d * k];
        });
        const A = off(15), B = off(-15), A2 = off(10), B2 = off(-10);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < pts.length; i += 3) { ctx.strokeStyle = 'rgba(110,116,124,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(A[i][0], A[i][1]); ctx.lineTo(B[i][0], B[i][1]); ctx.stroke(); }
        [A2, B2].forEach(Q => { this.pathPts(ctx, Q); ctx.strokeStyle = '#4a4e55'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 1.4; ctx.stroke(); });
        [A, B].forEach(Q => {
          this.pathPts(ctx, Q); ctx.strokeStyle = '#2a2d32'; ctx.lineWidth = 6.5; ctx.stroke();
          this.pathPts(ctx, Q); ctx.strokeStyle = metal; ctx.lineWidth = 3.6; ctx.stroke();
          ctx.save(); ctx.translate(-0.8, -0.9); this.pathPts(ctx, Q); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        });
      }
      // aba de plástico colorido na entrada + placa com o nome
      const [m0] = R.path;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
      ctx.fillStyle = this.shade(P[1], 0, 0.92); ctx.beginPath(); ctx.arc(m0[0], m0[1], 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = P[0]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(m0[0], m0[1], 20, 0, Math.PI * 2); ctx.stroke();
      const name = (R.name || '').replace(/!/g, '');
      ctx.font = '12px Bungee, Impact, sans-serif'; const tw = ctx.measureText(name).width + 18;
      const sx = m0[0], sy = m0[1] - 38;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 4;
      ctx.fillStyle = P[4]; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - tw / 2, sy - 11, tw, 22, 6) : ctx.rect(sx - tw / 2, sy - 11, tw, 22); ctx.fill(); ctx.restore();
      ctx.strokeStyle = P[0]; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.strokeRect(sx - tw / 2 + 3, sy - 8, tw - 6, 16);
      this.label(ctx, name, sx, sy + 1, 12, P[0], '#ffffff');
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
    this.pathPts(ctx, pts); ctx.strokeStyle = 'rgba(30,14,4,.55)'; ctx.lineWidth = 30; ctx.stroke();
    this.pathPts(ctx, pts); ctx.strokeStyle = pat; ctx.globalAlpha = 0.55; ctx.lineWidth = 26; ctx.stroke(); ctx.globalAlpha = 1;
    this.pathPts(ctx, pts); ctx.strokeStyle = th.metal; ctx.lineWidth = 1.4; ctx.stroke();
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
