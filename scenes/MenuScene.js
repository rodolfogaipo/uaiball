/* ============================================================
   MenuScene – logo, perfil (nível/XP), jogar, desafio do dia,
   dificuldade, conquistas e ranking (com luzes de vitrine)
   ============================================================ */

/** miniatura de uma mesa (desenhada uma vez e guardada) */
UAI.thumb = function (scene, def) {
  if (def.art && scene.textures.exists(def.art)) return def.art;
  const key = 'thumb_' + def.id;
  if (!scene.textures.exists(key)) UAI.Tex.add(scene, key, UAI.TableArt.render(def, 0.5));
  return key;
};

/** fundo de madeira com luzes de vitrine em volta (usado em várias telas) */
UAI.menuBackdrop = function (scene, dark = 0.62, texKey = 'mesa') {
  const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT;
  scene.add.image(W / 2, H / 2, texKey).setDisplaySize(W, H);
  scene.add.rectangle(W / 2, H / 2, W, H, 0x0b0603, dark);
  scene.lights = new UAI.LightRig(scene);
  scene.rim = [];
  const pad = 22, step = 52;
  const edge = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / step);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      scene.rim.push(scene.lights.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
        { r: 22, color: scene.rim.length % 2 ? 0xff7a2a : 0xffd27a, base: 0.08, depth: 2 }));
    }
  };
  edge(pad, pad, W - pad, pad); edge(W - pad, pad, W - pad, H - pad);
  edge(W - pad, H - pad, pad, H - pad); edge(pad, H - pad, pad, pad);
};
UAI.chaseRim = function (scene, time, delta, speed = 0.012) {
  scene.rim.forEach((L, i) => { const ph = ((i - time * speed) % 7 + 7) % 7; L.extra = ph < 2 ? 0.75 : 0; });
  scene.lights.update(delta);
};

/** barra de XP de madeira */
UAI.xpBar = function (scene, x, y, w, info, depth = 5) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x1a0b04, 0.9).fillRoundedRect(x - w / 2, y - 12, w, 24, 12);
  g.lineStyle(2, 0xc9973f, 1).strokeRoundedRect(x - w / 2, y - 12, w, 24, 12);
  const fill = scene.add.graphics().setDepth(depth);
  const draw = f => { fill.clear(); if (f > 0.01) fill.fillStyle(0xffb040, 1).fillRoundedRect(x - w / 2 + 3, y - 9, Math.max(18, (w - 6) * Math.min(1, f)), 18, 9); };
  draw(info.frac);
  return { g, fill, draw };
};

class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT, UI = UAI.UI;
    this.difficulty = UAI.Store.get('difficulty', 'medio');
    if (!UAI.DIFFICULTIES[this.difficulty]) this.difficulty = 'medio';
    UAI.menuBackdrop(this);

    // logo
    this.halo = this.add.image(W / 2, 220, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff9a30).setDisplaySize(700, 560).setAlpha(0.35);
    const logo = this.add.image(W / 2, 220, 'logo');
    logo.setScale(420 / logo.width);
    this.tweens.add({ targets: logo, y: 230, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // cartão do jogador
    const p = UAI.Progress.load(), info = UAI.Progress.levelInfo(p.xp);
    const card = this.add.graphics();
    card.fillStyle(0x2a1508, 0.88).fillRoundedRect(110, 410, W - 220, 128, 20);
    card.lineStyle(3, 0xc9973f, 1).strokeRoundedRect(110, 410, W - 220, 128, 20);
    this.add.text(140, 428, 'NÍVEL ' + info.level, { fontFamily: UI.FONT_NUM, fontSize: '26px', color: '#ffd27a' });
    this.add.text(W - 140, 430, info.title, { fontFamily: UI.FONT_TITLE, fontSize: '28px', color: '#ffe7b8' }).setOrigin(1, 0);
    UAI.xpBar(this, W / 2, 482, W - 280, info);
    this.add.text(W / 2, 482, UAI.fmt(info.into) + ' / ' + UAI.fmt(info.need) + ' XP', {
      fontFamily: UI.FONT_NUM, fontSize: '13px', color: '#2a1406'
    }).setOrigin(0.5).setDepth(6);
    const maxStars = UAI.TABLES.length * 3, nAch = Object.keys(p.ach).length;
    this.add.text(W / 2, 515, '⭐ ' + UAI.Progress.totalStars(p) + '/' + maxStars + '   ·   🔓 ' + UAI.Progress.unlockedCount(p) + '/' + UAI.TABLES.length + ' mesas   ·   🏅 ' + nAch + '/' + UAI.Progress.ACHIEVEMENTS.length, {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f3dfb4'
    }).setOrigin(0.5);

    // JOGAR
    this.playBtn = UI.button(this, W / 2, 625, 460, 104, 'JOGAR', () => this.play(), { size: 52, glow: 0xffb040 });
    this.tweens.add({ targets: this.playBtn.glow, alpha: { from: 0.15, to: 0.7 }, duration: 700, yoyo: true, repeat: -1 });

    // desafio do dia
    const d = UAI.Progress.daily(p);
    const dg = this.add.graphics();
    dg.fillStyle(d.done ? 0x123a18 : 0x3a2008, 0.92).fillRoundedRect(110, 712, W - 220, 108, 18);
    dg.lineStyle(3, d.done ? 0x7dff9a : 0xffd27a, 1).strokeRoundedRect(110, 712, W - 220, 108, 18);
    this.add.text(W / 2, 736, d.done ? '✔ DESAFIO DO DIA VENCIDO!' : '📅 DESAFIO DO DIA  ·  +1.000 XP', {
      fontFamily: UI.FONT_NUM, fontSize: '20px', color: d.done ? '#7dff9a' : '#ffd27a'
    }).setOrigin(0.5);
    this.add.text(W / 2, 772, UAI.Progress.dailyText(d), {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#ffe7b8', align: 'center', wordWrap: { width: W - 260 }
    }).setOrigin(0.5);
    if (p.streak && p.streak.n > 1) this.add.text(W / 2, 802, '🔥 ' + p.streak.n + ' dias seguidos', { fontFamily: 'Georgia, serif', fontSize: '17px', color: '#ffb070' }).setOrigin(0.5);
    const dz = this.add.zone(W / 2, 766, W - 220, 108).setInteractive({ useHandCursor: true });
    dz.on('pointerup', () => { UAI.Sfx.click(); this.go('Game', { table: d.table, difficulty: this.difficulty, daily: true }); });

    // dificuldade
    this.diffBtns = {};
    ['facil', 'medio', 'dificil'].forEach((k, i) => {
      this.diffBtns[k] = UI.button(this, W / 2 + (i - 1) * 230, 880, 212, 64, UAI.DIFFICULTIES[k].label, () => this.selectDiff(k), { size: 26 });
    });
    this.diffDesc = this.add.text(W / 2, 932, '', { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f3dfb4', fontStyle: 'italic' }).setOrigin(0.5);
    this.selectDiff(this.difficulty, true);

    UI.button(this, W / 2 - 170, 1020, 310, 76, 'CONQUISTAS', () => this.go('Profile'), { size: 28 });
    UI.button(this, W / 2 + 170, 1020, 310, 76, 'RANKING', () => this.go('Ranking', { from: 'Menu' }), { size: 28 });

    const touch = this.sys.game.device.input.touch;
    this.add.text(W / 2, 1120, touch
      ? 'Toque esquerda/direita = palhetas · arraste p/ cima no canto direito = mola\ntoque no alto da tela = sacudir (sem exagero: TILT!)'
      : '← / A e → / D = palhetas · segure ↓ ou Espaço = mola · ↑ = sacudir', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#d8b98a', align: 'center'
    }).setOrigin(0.5);

    const snd = this.add.text(W - 70, 70, UAI.Sfx.enabled ? '🔊' : '🔇', { fontSize: '40px' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    snd.on('pointerup', () => { snd.setText(UAI.Sfx.toggle() ? '🔊' : '🔇'); UAI.Sfx.click(); });

    this.input.keyboard.on('keydown-ENTER', () => this.play());
    this.input.keyboard.on('keydown-SPACE', () => this.play());
  }

  selectDiff(k, silent) {
    this.difficulty = k;
    UAI.Store.set('difficulty', k);
    Object.entries(this.diffBtns).forEach(([key, b]) => b.setSelected(key === k));
    this.diffDesc.setText(UAI.DIFFICULTIES[k].desc);
    if (!silent) this.lights.flashAll(this.rim, 0.8);
  }

  go(scene, data) {
    UAI.Sfx.unlock();
    this.cameras.main.flash(200, 255, 190, 110);
    this.time.delayedCall(150, () => this.scene.start(scene, data));
  }

  play() { UAI.Sfx.bonus(); this.go('TableSelect'); }

  update(time, delta) {
    this.halo.setAlpha(0.3 + 0.12 * Math.sin(time / 500));
    UAI.chaseRim(this, time, delta);
  }
}
