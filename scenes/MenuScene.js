/* ============================================================
   MenuScene – logo, dificuldade, jogar, ranking (com luzes de vitrine)
   ============================================================ */
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT, UI = UAI.UI;
    this.difficulty = UAI.Store.get('difficulty', 'medio');
    if (!UAI.DIFFICULTIES[this.difficulty]) this.difficulty = 'medio';

    // Fundo: a própria mesa, escurecida
    this.add.image(W / 2, H / 2, 'mesa').setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0603, 0.62);

    // Luzes de vitrine em volta da tela (perseguição)
    this.lights = new UAI.LightRig(this);
    this.rim = [];
    const pad = 26, step = 52;
    const pushEdge = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / step);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        this.rim.push(this.lights.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
          { r: 22, color: this.rim.length % 2 ? 0xff7a2a : 0xffd27a, base: 0.08, depth: 2 }));
      }
    };
    pushEdge(pad, pad, W - pad, pad); pushEdge(W - pad, pad, W - pad, H - pad);
    pushEdge(W - pad, H - pad, pad, H - pad); pushEdge(pad, H - pad, pad, pad);

    // Logo com halo pulsante
    this.halo = this.add.image(W / 2, 320, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff9a30).setDisplaySize(820, 720).setAlpha(0.35);
    const logo = this.add.image(W / 2, 320, 'logo');
    logo.setScale(560 / logo.width);
    this.tweens.add({ targets: logo, y: 332, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.add.text(W / 2, 620, 'PINBALL MINEIRO', {
      fontFamily: UI.FONT_TITLE, fontSize: '34px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 6
    }).setOrigin(0.5);

    // Dificuldade
    this.add.text(W / 2, 690, 'DIFICULDADE', {
      fontFamily: UI.FONT_NUM, fontSize: '22px', color: '#e8c48a'
    }).setOrigin(0.5);
    this.diffBtns = {};
    const keys = ['facil', 'medio', 'dificil'];
    keys.forEach((k, i) => {
      const b = UI.button(this, W / 2 + (i - 1) * 245, 752, 225, 72, UAI.DIFFICULTIES[k].label,
        () => this.selectDiff(k), { size: 28 });
      this.diffBtns[k] = b;
    });
    this.diffDesc = this.add.text(W / 2, 812, '', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#f3dfb4', fontStyle: 'italic'
    }).setOrigin(0.5);
    this.selectDiff(this.difficulty, true);

    // Jogar / Ranking
    this.playBtn = UI.button(this, W / 2, 910, 440, 104, 'JOGAR', () => this.play(), { size: 52, glow: 0xffb040 });
    this.tweens.add({ targets: this.playBtn.glow, alpha: { from: 0.15, to: 0.7 }, duration: 700, yoyo: true, repeat: -1 });
    UI.button(this, W / 2, 1030, 330, 76, 'RANKING', () => this.scene.start('Ranking', { from: 'Menu' }), { size: 32 });

    // Recorde
    this.add.text(W / 2, 1105, 'RECORDE: ' + UAI.fmt(UAI.Store.getHigh()), {
      fontFamily: UI.FONT_NUM, fontSize: '26px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5);

    const touch = this.sys.game.device.input.touch;
    this.add.text(W / 2, 1150, touch
      ? 'Toque esquerda/direita = palhetas · arraste p/ cima no canto direito = mola'
      : '← / A e → / D = palhetas · segure ↓ ou Espaço = mola', {
      fontFamily: 'Georgia, serif', fontSize: '19px', color: '#d8b98a'
    }).setOrigin(0.5);

    // Som liga/desliga
    const snd = this.add.text(W - 70, 70, UAI.Sfx.enabled ? '🔊' : '🔇', { fontSize: '40px' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
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

  play() {
    UAI.Sfx.unlock(); UAI.Sfx.bonus();
    this.cameras.main.flash(250, 255, 190, 110);
    this.time.delayedCall(180, () => this.scene.start('Game', { difficulty: this.difficulty }));
  }

  update(time, delta) {
    const n = this.rim.length;
    this.rim.forEach((L, i) => {
      const ph = (i - time * 0.012) % 7;
      L.extra = ((ph + 7) % 7) < 2 ? 0.75 : 0;
    });
    this.halo.setAlpha(0.3 + 0.12 * Math.sin(time / 500));
    this.lights.update(delta);
  }
}
