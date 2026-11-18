/* ============================================================
   TableSelectScene – escolha da mesa (cenário)
   Setas ou arrastar para os lados. Mesa trancada mostra o que
   falta para liberar (1 estrela na mesa anterior).
   ============================================================ */
class TableSelectScene extends Phaser.Scene {
  constructor() { super('TableSelect'); }

  init(data) {
    this.list = UAI.tablesSorted();
    const want = (data && data.table) || UAI.Store.get('lastTable', this.list[0].id);
    this.idx = Math.max(0, this.list.findIndex(t => t.id === want));
  }

  create() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT, UI = UAI.UI;
    this.p = UAI.Progress.load();
    UAI.menuBackdrop(this, 0.8);

    this.add.text(W / 2, 70, 'ESCOLHA A MESA', {
      fontFamily: UI.FONT_TITLE, fontSize: '50px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 8
    }).setOrigin(0.5).setShadow(0, 0, '#ff8a20', 18, false, true);
    this.counter = this.add.text(W / 2, 118, '', { fontFamily: UI.FONT_NUM, fontSize: '18px', color: '#d8b98a' }).setOrigin(0.5);

    // moldura da miniatura
    const fw = 420, fh = 562, cy = 440;
    this.frame = this.add.graphics();
    this.frame.fillStyle(0x000000, 0.5).fillRoundedRect(W / 2 - fw / 2 - 6, cy - fh / 2 + 4, fw + 20, fh + 16, 16);
    this.frame.fillStyle(0x4a250e, 1).fillRoundedRect(W / 2 - fw / 2 - 12, cy - fh / 2 - 12, fw + 24, fh + 24, 16);
    this.frame.lineStyle(4, 0xc9973f, 1).strokeRoundedRect(W / 2 - fw / 2 - 12, cy - fh / 2 - 12, fw + 24, fh + 24, 16);
    this.img = this.add.image(W / 2, cy, 'mesa').setDisplaySize(fw, fh);
    this.fw = fw; this.fh = fh;
    this.lockShade = this.add.rectangle(W / 2, cy, fw, fh, 0x000000, 0.72);
    this.lockTxt = this.add.text(W / 2, cy, '', {
      fontFamily: UI.FONT_TITLE, fontSize: '30px', color: '#ffe7b8', align: 'center', stroke: '#000', strokeThickness: 5, wordWrap: { width: fw - 40 }
    }).setOrigin(0.5);

    // setas
    const arrow = (x, dir) => {
      const c = UI.button(this, x, cy, 84, 120, dir < 0 ? '◀' : '▶', () => this.move(dir), { size: 44 });
      return c;
    };
    this.left = arrow(70, -1); this.right = arrow(W - 70, 1);

    // pontinhos (uma por mesa, cor = estrelas)
    this.dots = this.list.map((d, i) => this.add.circle(W / 2 + (i - (this.list.length - 1) / 2) * 30, 745, 9, 0x5a3a20).setStrokeStyle(2, 0xc9973f));

    this.nameTxt = this.add.text(W / 2, 795, '', { fontFamily: UI.FONT_TITLE, fontSize: '46px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 7 }).setOrigin(0.5);
    this.subTxt = this.add.text(W / 2, 840, '', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#f3dfb4', fontStyle: 'italic' }).setOrigin(0.5);
    this.starTxt = this.add.text(W / 2, 885, '', { fontSize: '40px' }).setOrigin(0.5);
    this.goalTxt = this.add.text(W / 2, 925, '', { fontFamily: UI.FONT_NUM, fontSize: '15px', color: '#d8b98a' }).setOrigin(0.5);
    this.bestTxt = this.add.text(W / 2, 955, '', { fontFamily: UI.FONT_NUM, fontSize: '20px', color: '#ffd27a' }).setOrigin(0.5);

    this.playBtn = UI.button(this, W / 2, 1035, 420, 92, 'JOGAR', () => this.play(), { size: 46, glow: 0xffb040 });
    UI.button(this, W / 2 - 165, 1128, 300, 66, 'RANKING', () => this.scene.start('Ranking', { from: 'TableSelect', table: this.def.id }), { size: 26 });
    UI.button(this, W / 2 + 165, 1128, 300, 66, 'VOLTAR', () => this.scene.start('Menu'), { size: 26 });
    this.diffTxt = this.add.text(W / 2, 985, '', { fontFamily: 'Georgia, serif', fontSize: '17px', color: '#b8956a' }).setOrigin(0.5);

    // arrastar para os lados
    this.input.on('pointerdown', p => { this.dragX = p.x; });
    this.input.on('pointerup', p => {
      if (this.dragX == null) return;
      const dx = p.x - this.dragX; this.dragX = null;
      if (Math.abs(dx) > 80 && p.y < 760) this.move(dx < 0 ? 1 : -1);
    });
    this.input.keyboard.on('keydown-LEFT', () => this.move(-1));
    this.input.keyboard.on('keydown-RIGHT', () => this.move(1));
    this.input.keyboard.on('keydown-ENTER', () => this.play());
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    this.show();
  }

  move(dir) {
    const n = this.list.length;
    this.idx = (this.idx + dir + n) % n;
    UAI.Sfx.click();
    this.show(dir);
  }

  show(dir = 0) {
    const W = UAI.CONFIG.WIDTH;
    const def = this.def = this.list[this.idx];
    const open = this.open = UAI.Progress.isUnlocked(this.p, def);
    const T = UAI.Progress.tableStats(this.p, def.id);
    this.img.setTexture(UAI.thumb(this, def)).setDisplaySize(this.fw, this.fh);
    if (dir) { this.img.x = W / 2 + dir * 60; this.img.alpha = 0.3; this.tweens.add({ targets: this.img, x: W / 2, alpha: 1, duration: 180 }); }
    this.lockShade.setVisible(!open);
    const prev = this.list[this.idx - 1];
    this.lockTxt.setText(open ? '' : '🔒\nTRANCADA\n\nGanhe 1 ⭐ na mesa\n' + (prev ? prev.name : '') + '\npara liberar');
    this.counter.setText('MESA ' + (this.idx + 1) + ' DE ' + this.list.length);
    this.nameTxt.setText(def.name);
    this.subTxt.setText(def.subtitle || '');
    this.starTxt.setText([0, 1, 2].map(i => i < (T.stars || 0) ? '⭐' : '☆').join(' ')).setColor('#ffd27a');
    this.goalTxt.setText((def.stars || []).map((s, i) => '★'.repeat(i + 1) + ' ' + UAI.fmt(s)).join('   ·   '));
    this.bestTxt.setText(T.best ? 'Seu recorde: ' + UAI.fmt(T.best) + (T.mastered ? '  ·  👑 DOMINADA' : '') : 'Ainda não jogada');
    this.dots.forEach((dot, i) => {
      const t = this.list[i], st = UAI.Progress.tableStats(this.p, t.id).stars || 0;
      const ok = UAI.Progress.isUnlocked(this.p, t);
      dot.setFillStyle(!ok ? 0x2a1a10 : [0x7a5a3a, 0xc98a3c, 0xffc040, 0xfff07a][st]);
      dot.setScale(i === this.idx ? 1.5 : 1);
    });
    this.playBtn.setAlpha(open ? 1 : 0.4);
    this.diffTxt.setText('Dificuldade: ' + UAI.DIFFICULTIES[UAI.Store.get('difficulty', 'medio')].label + ' (troque no menu)');
    // desenha a próxima de antemão para a troca ficar rápida
    this.time.delayedCall(250, () => {
      const nx = this.list[(this.idx + 1) % this.list.length];
      if (this.sys.isActive()) UAI.thumb(this, nx);
    });
  }

  play() {
    if (!this.open) { UAI.Sfx.drain(); this.cameras.main.shake(200, 0.006); return; }
    UAI.Sfx.unlock(); UAI.Sfx.bonus();
    UAI.Store.set('lastTable', this.def.id);
    this.cameras.main.flash(250, 255, 190, 110);
    const txt = this.add.text(UAI.CONFIG.WIDTH / 2, 440, 'Montando a mesa...', {
      fontFamily: UAI.UI.FONT_TITLE, fontSize: '34px', color: '#ffe7b8', stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5);
    this.time.delayedCall(120, () => this.scene.start('Game', { table: this.def.id, difficulty: UAI.Store.get('difficulty', 'medio') }));
  }

  update(time, delta) { UAI.chaseRim(this, time, delta); }
}
