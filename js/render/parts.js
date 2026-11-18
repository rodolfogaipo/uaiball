/* ============================================================
   UAI BALL – PEÇAS NO ESTILO DO 3D PINBALL DO WINDOWS (Space Cadet)
   ------------------------------------------------------------
   Estudado no código aberto do Space Cadet (k4zmu2a/SpaceCadetPinball):
   • TBumper: cada bumper tem vários NÍVEIS; cada nível tem um desenho
     apagado e um ACESO. Ao bater: mostra o aceso por um instante,
     pontua conforme o nível (lá: 500/1000/1500/2000) e o nível cai
     sozinho se passar 60 s sem subir (BumperGroupControl).
   • TLight: lâmpada com estados ligada/desligada/"flasher" (pisca com
     tempo aceso e apagado), "pisca por X s e depois fica acesa".
   • TLightGroup: animações de grupo – corrida para frente/para trás,
     show de luzes, apagar em sequência, acender aleatório.
   Aqui os desenhos são gerados (sem imagens), com as cores de cada mesa.
   ============================================================ */
window.UAI = window.UAI || {};

UAI.Parts = {
  hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  sh(c, t, a = 1) { const v = this.hex(c), m = t >= 0 ? v.map(x => x + (255 - x) * t) : v.map(x => x * (1 + t)); return 'rgba(' + m.map(Math.round).join(',') + ',' + a + ')'; },
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; },

  /** cores dos 4 níveis do bumper (frio → quente), puxadas da paleta da mesa */
  levelColors(def) {
    const A = UAI.TableArt.artOf(def), P = A.paint;
    return [P[3], P[1], P[4], '#ffd23a'];
  },

  /** bumper 3D: saia cromada com parafusos, cúpula de acrílico com gomos, miolo cromado */
  bumper(color, level, lit) {
    const S = 256, C = S / 2, c = this.canvas(S), x = c.getContext('2d');
    // sombra no tabuleiro
    x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(C + 8, C + 12, 118, 112, 0, 0, 7); x.fill();
    // saia de metal
    let g = x.createRadialGradient(C - 40, C - 50, 10, C, C, 124);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9ced6'); g.addColorStop(0.75, '#6b717a'); g.addColorStop(1, '#25282d');
    x.fillStyle = g; x.beginPath(); x.arc(C, C, 120, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 3; x.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + 0.26, bx = C + Math.cos(a) * 109, by = C + Math.sin(a) * 109;
      const bg = x.createRadialGradient(bx - 2, by - 2, 0.5, bx, by, 5);
      bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#3a3e44');
      x.fillStyle = bg; x.beginPath(); x.arc(bx, by, 4.5, 0, 7); x.fill();
    }
    // anel de borracha preta
    x.strokeStyle = '#111'; x.lineWidth = 10; x.beginPath(); x.arc(C, C, 97, 0, 7); x.stroke();
    // cúpula de acrílico
    const r = 92;
    g = x.createRadialGradient(C - 28, C - 34, 6, C, C, r);
    g.addColorStop(0, lit ? '#ffffff' : this.sh(color, 0.55)); g.addColorStop(lit ? 0.35 : 0.3, lit ? this.sh(color, 0.55) : this.sh(color, 0.05));
    g.addColorStop(0.8, this.sh(color, lit ? 0 : -0.45)); g.addColorStop(1, this.sh(color, lit ? -0.25 : -0.7));
    x.fillStyle = g; x.beginPath(); x.arc(C, C, r, 0, 7); x.fill();
    // gomos (raios) da cúpula
    for (let i = 0; i < 12; i++) {
      const a0 = i * Math.PI / 6, a1 = a0 + Math.PI / 12;
      x.fillStyle = i % 2 ? (lit ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.08)') : 'rgba(0,0,0,.12)';
      x.beginPath(); x.moveTo(C, C); x.arc(C, C, r, a0, a1); x.closePath(); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; x.beginPath(); x.moveTo(C + Math.cos(a) * 30, C + Math.sin(a) * 30); x.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r); x.stroke(); }
    // brilho interno quando aceso
    if (lit) {
      g = x.createRadialGradient(C, C, 0, C, C, r);
      g.addColorStop(0, 'rgba(255,255,240,.95)'); g.addColorStop(0.45, 'rgba(255,255,220,.35)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      x.fillStyle = g; x.beginPath(); x.arc(C, C, r, 0, 7); x.fill();
    }
    // miolo cromado com estrela
    g = x.createRadialGradient(C - 8, C - 10, 2, C, C, 30);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#b8bec6'); g.addColorStop(1, '#3a3e44');
    x.fillStyle = g; x.beginPath(); x.arc(C, C, 28, 0, 7); x.fill();
    x.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 8 : 20; i ? x.lineTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr) : x.moveTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr); }
    x.closePath(); x.fillStyle = lit ? '#fff6c0' : this.sh(color, -0.1); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1.5; x.stroke();
    // reflexo do vidro na cúpula
    x.fillStyle = 'rgba(255,255,255,' + (lit ? 0.55 : 0.4) + ')';
    x.beginPath(); x.ellipse(C - 32, C - 44, 34, 15, -0.6, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(C + 40, C + 46, 14, 6, -0.6, 0, 7); x.fill();
    // marcadores de nível (como os do Space Cadet)
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (0.62 + i * 0.25), px = C + Math.cos(a) * 109, py = C + Math.sin(a) * 109;
      x.fillStyle = i <= level ? (lit ? '#fffbe0' : '#ffd23a') : '#2a2a2a';
      x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 1.5; x.stroke();
    }
    return c;
  },

  /** brilho em estrela (o "flare" das lâmpadas do Space Cadet) */
  flare() {
    const S = 128, C = S / 2, c = this.canvas(S), x = c.getContext('2d');
    const ray = (w, len, a) => {
      x.save(); x.translate(C, C); x.rotate(a);
      const g = x.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, len, w, 0, 0, 7); x.fill(); x.restore();
    };
    ray(3.2, 62, 0); ray(3.2, 62, Math.PI / 2); ray(1.6, 40, Math.PI / 4); ray(1.6, 40, -Math.PI / 4);
    const g = x.createRadialGradient(C, C, 0, C, C, 20); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(C, C, 20, 0, 7); x.fill();
    return c;
  },

  /** anel da onda de choque */
  ring() {
    const S = 128, C = S / 2, c = this.canvas(S), x = c.getContext('2d');
    const g = x.createRadialGradient(C, C, 38, C, C, 62);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return c;
  },

  /** gera (uma vez) as texturas da mesa */
  ensure(scene, def) {
    const T = scene.textures;
    if (!T.exists('flare')) UAI.Tex.add(scene, 'flare', this.flare());
    if (!T.exists('ringfx')) UAI.Tex.add(scene, 'ringfx', this.ring());
    const cols = this.levelColors(def), keys = [];
    for (let lv = 0; lv < 4; lv++) {
      const k0 = 'bmp_' + def.id + '_' + lv + '_0', k1 = 'bmp_' + def.id + '_' + lv + '_1';
      if (!T.exists(k0)) UAI.Tex.add(scene, k0, this.bumper(cols[lv], lv, false));
      if (!T.exists(k1)) UAI.Tex.add(scene, k1, this.bumper(cols[lv], lv, true));
      keys.push([k0, k1]);
    }
    return { keys, colors: cols.map(c => parseInt(c.slice(1), 16)) };
  }
};
