/* ============================================================
   UAI BALL – SISTEMA DE LUZES (no estilo do Space Cadet)
   Cada lâmpada tem: halo colorido + miolo branco + brilho em estrela
   (flare) quando estoura. Estados (como TLight do Space Cadet):
     base    – brilho mínimo (apagada, mas o vidro aparece)
     on      – acesa fixa
     flash   – pico que decai sozinho (batidas)
     blink   – "flasher": pisca por um tempo e depois fica acesa/apagada
     extra   – brilho calculado a cada quadro (perseguições)
   Animações de grupo (como TLightGroup): corrida, show de luzes,
   acender aleatório e apagar em sequência.
   gi = iluminação geral (baixa tudo quando a bola cai)
   ============================================================ */
window.UAI = window.UAI || {};

UAI.LightRig = class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.shows = [];
    this.gi = 1;
    this.giTarget = 1;
    this.t = 0;
    this.hasFlare = scene.textures.exists('flare');
  }

  add(x, y, o = {}) {
    const s = this.scene;
    const r = o.r || 20;
    const depth = o.depth != null ? o.depth : 3;
    const color = o.color != null ? o.color : 0xffb347;
    const img = s.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color).setDisplaySize(r * 2.3, r * 2.3).setDepth(depth).setAlpha(0);
    const core = o.core === false ? null : s.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff8e6).setDisplaySize(r * 0.8, r * 0.8).setDepth(depth).setAlpha(0);
    const flare = (o.core === false || !this.hasFlare || r < 18) ? null : s.add.image(x, y, 'flare').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color).setDisplaySize(r * 2.6, r * 2.6).setDepth(depth + 0.05).setAlpha(0).setRotation(Math.random() * 0.6);
    const L = {
      img, core, flare, x, y, r, color,
      base: o.base != null ? o.base : 0.1,
      onLevel: o.onLevel != null ? o.onLevel : 0.95,
      decay: o.decay || 350,
      on: false, flash: 0, extra: 0, blinkUntil: 0, blinkPeriod: 120, stay: null
    };
    this.list.push(L);
    return L;
  }

  flash(L, amount = 1) { if (L) L.flash = Math.max(L.flash, amount); }
  flashAll(list, amount = 1) { (list || []).forEach(L => this.flash(L, amount)); }

  /** "flasher": pisca por ms (período p) e depois fica acesa (stay=true) ou apagada (false) */
  blink(L, ms = 1200, p = 110, stay = null) { if (!L) return; L.blinkUntil = this.t + ms; L.blinkPeriod = p; L.stay = stay; }
  blinkAll(list, ms, p, stay) { (list || []).forEach((L, i) => this.blink(L, ms, p, stay)); }

  /** animação de grupo: 'chase' (corrida), 'show' (show de luzes), 'random' (aleatório), 'off' (apaga em sequência) */
  show(list, mode = 'show', ms = 2000) { if (list && list.length) this.shows.push({ list, mode, start: this.t, end: this.t + ms }); }

  setColor(L, color) { if (L.color !== color) { L.color = color; L.img.setTint(color); if (L.flare) L.flare.setTint(color); } }

  move(L, x, y) { L.x = x; L.y = y; L.img.setPosition(x, y); if (L.core) L.core.setPosition(x, y); if (L.flare) L.flare.setPosition(x, y); }

  clear() {
    this.list.forEach(L => { L.img.destroy(); if (L.core) L.core.destroy(); if (L.flare) L.flare.destroy(); });
    this.list = []; this.shows = [];
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.gi += (this.giTarget - this.gi) * Math.min(1, dt / 140);
    // animações de grupo por cima de tudo
    this.shows = this.shows.filter(S => t < S.end);
    for (const S of this.shows) {
      const n = S.list.length, k = (t - S.start) / (S.end - S.start);
      S.list.forEach((L, i) => {
        if (S.mode === 'chase') L.extra += ((Math.floor(t / 60) - i) % 6 + 6) % 6 === 0 ? 0.9 : 0;
        else if (S.mode === 'show') L.extra += (Math.sin(t / 90 + i * 0.7) > 0.3 ? 0.85 : 0) * (1 - k * 0.3);
        else if (S.mode === 'random') L.extra += Math.random() < 0.25 ? 0.9 : 0;
        else if (S.mode === 'off') L.extra -= i / n < k ? 1 : 0;
      });
    }
    for (const L of this.list) {
      L.flash = Math.max(0, L.flash - dt / L.decay);
      let on = L.on;
      if (L.blinkUntil > t) { on = Math.floor(t / L.blinkPeriod) % 2 === 0; }
      else if (L.stay !== null) { L.on = L.stay; on = L.stay; L.stay = null; }
      const lvl = Math.max(0, Math.min(1.2, (on ? L.onLevel : L.base) + L.extra + L.flash)) * this.gi;
      L.img.setAlpha(Math.min(1, lvl));
      if (L.core) L.core.setAlpha(Math.max(0, Math.min(1, (lvl - 0.25) * 1.3)));
      if (L.flare) {
        const f = Math.max(0, (L.flash + (on ? 0.1 : 0) + L.extra * 0.5 - 0.55)) * 1.6 * this.gi;
        L.flare.setAlpha(Math.min(0.9, f));
        if (f > 0) L.flare.rotation += dt * 0.0012;
      }
      L.extra = 0; // a cena recalcula a cada quadro
    }
  }
};
