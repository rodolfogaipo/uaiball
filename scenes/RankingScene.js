/* ============================================================
   RankingScene – Top 10 (Firebase online, ou local como reserva)
   ============================================================ */
class RankingScene extends Phaser.Scene {
  constructor() { super('Ranking'); }

  init(data) {
    this.from = (data && data.from) || 'Menu';
    this.highlight = data && data.highlight;
  }

  create() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT, UI = UAI.UI;
    this.add.image(W / 2, H / 2, 'mesa').setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0603, 0.74);

    // placa de madeira
    const g = this.add.graphics();
    g.fillStyle(0x3b1f0c, 0.92).fillRoundedRect(70, 180, W - 140, 800, 26);
    g.lineStyle(4, 0xc9973f, 1).strokeRoundedRect(70, 180, W - 140, 800, 26);

    this.lights = new UAI.LightRig(this);
    this.bulbs = [];
    for (let i = 0; i < 14; i++) this.bulbs.push(this.lights.add(100 + i * ((W - 200) / 13), 180, { r: 24, color: 0xffc060, base: 0.1 }));

    this.add.text(W / 2, 110, 'RANKING GLOBAL', {
      fontFamily: UI.FONT_TITLE, fontSize: '62px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 9
    }).setOrigin(0.5).setShadow(0, 0, '#ff8a20', 20, false, true);

    this.sourceTxt = this.add.text(W / 2, 222, '', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#d8b98a', fontStyle: 'italic'
    }).setOrigin(0.5);
    this.loading = this.add.text(W / 2, 560, 'Carregando...', {
      fontFamily: UI.FONT_TITLE, fontSize: '36px', color: '#ffe7b8'
    }).setOrigin(0.5);

    UI.button(this, W / 2, 1070, 320, 82, 'VOLTAR', () => this.scene.start(this.from === 'GameOver' ? 'Menu' : this.from), { size: 34 });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));

    this.load10();
  }

  async load10() {
    const { list, source, error } = await UAI.Ranking.top(10);
    if (!this.sys.isActive()) return;
    this.loading.destroy();
    this.sourceTxt.setText(source === 'online'
      ? '🌐 Ranking online'
      : (error ? '⚠ Sem conexão – mostrando ranking deste aparelho' : '📱 Ranking deste aparelho (configure o Firebase no config.js)'));

    const W = UAI.CONFIG.WIDTH, UI = UAI.UI;
    if (!list.length) {
      this.add.text(W / 2, 560, 'Ninguém jogou ainda.\nSeja o primeiro, uai!', {
        fontFamily: UI.FONT_TITLE, fontSize: '34px', color: '#ffe7b8', align: 'center'
      }).setOrigin(0.5);
      return;
    }
    const medal = ['#ffd700', '#d9d9d9', '#cd7f32'];
    let marked = false;
    list.forEach((e, i) => {
      const y = 290 + i * 66;
      const isMe = !marked && this.highlight && e.name === this.highlight.name && e.score === this.highlight.score;
      if (isMe) {
        marked = true;
        const hl = this.add.image(W / 2, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa040).setDisplaySize(W - 160, 90);
        this.tweens.add({ targets: hl, alpha: { from: 0.2, to: 0.6 }, duration: 500, yoyo: true, repeat: -1 });
      }
      const color = medal[i] || '#ffe7b8';
      const delay = i * 70;
      const row = [
        this.add.text(120, y, (i + 1) + 'º', { fontFamily: UI.FONT_NUM, fontSize: '30px', color }).setOrigin(0, 0.5),
        this.add.text(210, y, e.name, { fontFamily: UI.FONT_TITLE, fontSize: '32px', color: '#ffe7b8' }).setOrigin(0, 0.5),
        this.add.text(W - 120, y, UAI.fmt(e.score), { fontFamily: UI.FONT_NUM, fontSize: '30px', color }).setOrigin(1, 0.5)
      ];
      if (e.diff && UAI.DIFFICULTIES[e.diff]) {
        row.push(this.add.text(W - 120, y + 24, UAI.DIFFICULTIES[e.diff].label, {
          fontFamily: 'Georgia, serif', fontSize: '14px', color: '#b8956a'
        }).setOrigin(1, 0.5));
      }
      row.forEach(t => { t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, x: t.x, duration: 300, delay }); });
    });
  }

  update(time, delta) {
    this.bulbs.forEach((L, i) => { L.extra = ((Math.floor(time / 160) + i) % 3 === 0) ? 0.8 : 0; });
    this.lights.update(delta);
  }
}
