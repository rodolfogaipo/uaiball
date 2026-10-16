/* ============================================================
   UAI BALL – SISTEMA DE LUZES
   Cada luz é um halo (textura 'glow') com mistura ADD,
   então as luzes "somam" brilho sobre a madeira.
   Estados de cada luz:
     base    – brilho mínimo (apagada, mas não morta)
     on      – acesa fixa (onLevel)
     flash   – pico que decai sozinho (batidas, bônus)
     extra   – brilho extra calculado a cada quadro (animações de perseguição)
   gi = "iluminação geral" – baixa tudo quando a bola cai (igual pinball de verdade)
   ============================================================ */
window.UAI = window.UAI || {};

UAI.LightRig = class LightRig {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.gi = 1;
    this.giTarget = 1;
  }

  add(x, y, o = {}) {
    const s = this.scene;
    const r = o.r || 20;
    const depth = o.depth != null ? o.depth : 3;
    const color = o.color != null ? o.color : 0xffb347;
    const img = s.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color).setDisplaySize(r * 2, r * 2).setDepth(depth).setAlpha(0);
    const core = o.core === false ? null : s.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff3d6).setDisplaySize(r * 0.7, r * 0.7).setDepth(depth).setAlpha(0);
    const L = {
      img, core, x, y, r, color,
      base: o.base != null ? o.base : 0.1,
      onLevel: o.onLevel != null ? o.onLevel : 0.95,
      decay: o.decay || 350,
      on: false, flash: 0, extra: 0
    };
    this.list.push(L);
    return L;
  }

  flash(L, amount = 1) { if (L) L.flash = Math.max(L.flash, amount); }
  flashAll(list, amount = 1) { list.forEach(L => this.flash(L, amount)); }

  setColor(L, color) { if (L.color !== color) { L.color = color; L.img.setTint(color); } }

  move(L, x, y) { L.x = x; L.y = y; L.img.setPosition(x, y); if (L.core) L.core.setPosition(x, y); }

  clear() {
    this.list.forEach(L => { L.img.destroy(); if (L.core) L.core.destroy(); });
    this.list = [];
  }

  update(dt) {
    this.gi += (this.giTarget - this.gi) * Math.min(1, dt / 140);
    for (const L of this.list) {
      L.flash = Math.max(0, L.flash - dt / L.decay);
      const lvl = Math.min(1.15, (L.on ? L.onLevel : L.base) + L.extra + L.flash) * this.gi;
      L.img.setAlpha(Math.min(1, lvl));
      if (L.core) L.core.setAlpha(Math.max(0, Math.min(1, (lvl - 0.25) * 1.2)));
      L.extra = 0; // a cena recalcula a cada quadro
    }
  }
};
