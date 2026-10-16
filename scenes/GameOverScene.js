/* ============================================================
   GameOverScene – pontuação final, recorde local e envio ao ranking
   ============================================================ */
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.final = (data && data.score) || 0;
    this.diffKey = (data && data.difficulty) || 'medio';
    this.isRecord = !!(data && data.isRecord);
  }

  create() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT, UI = UAI.UI;
    this.add.image(W / 2, H / 2, 'mesa').setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0b0603, 0.72);

    // luzes de festa (ou de luto, se não bateu recorde)
    this.lights = new UAI.LightRig(this);
    this.ring = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.ring.push(this.lights.add(W / 2 + Math.cos(a) * 330, 400 + Math.sin(a) * 200,
        { r: 26, color: this.isRecord ? (i % 2 ? 0xffd27a : 0xff6a2a) : 0xff5a2a, base: 0.08 }));
    }

    this.add.text(W / 2, 230, 'FIM DE JOGO', {
      fontFamily: UI.FONT_TITLE, fontSize: '76px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 10
    }).setOrigin(0.5).setShadow(0, 0, '#ff5a20', 20, false, true);

    this.add.text(W / 2, 330, UAI.DIFFICULTIES[this.diffKey].label, {
      fontFamily: UI.FONT_NUM, fontSize: '24px', color: '#e8c48a'
    }).setOrigin(0.5);

    const scoreTxt = this.add.text(W / 2, 420, '0', {
      fontFamily: UI.FONT_NUM, fontSize: '88px', color: '#fff0c8', stroke: '#2a1406', strokeThickness: 10
    }).setOrigin(0.5).setShadow(0, 0, '#ffa040', 24, false, true);
    this.tweens.addCounter({
      from: 0, to: this.final, duration: Math.min(1600, 300 + this.final / 20), ease: 'Cubic.out',
      onUpdate: tw => scoreTxt.setText(UAI.fmt(tw.getValue()))
    });

    if (this.isRecord) {
      const rec = this.add.text(W / 2, 520, '★ NOVO RECORDE! ★', {
        fontFamily: UI.FONT_TITLE, fontSize: '44px', color: '#ffe066', stroke: '#2a1406', strokeThickness: 8
      }).setOrigin(0.5);
      this.tweens.add({ targets: rec, scale: 1.1, duration: 420, yoyo: true, repeat: -1 });
      this.time.delayedCall(300, () => UAI.Sfx.record());
    } else {
      this.add.text(W / 2, 520, 'Recorde: ' + UAI.fmt(UAI.Store.getHigh()), {
        fontFamily: UI.FONT_NUM, fontSize: '28px', color: '#e8c48a'
      }).setOrigin(0.5);
    }

    this.status = this.add.text(W / 2, 640, '', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#f3dfb4', align: 'center'
    }).setOrigin(0.5);

    UI.button(this, W / 2, 790, 460, 96, 'JOGAR DE NOVO', () => this.scene.start('Game', { difficulty: this.diffKey }), { size: 40 });
    UI.button(this, W / 2, 910, 340, 78, 'RANKING', () => this.scene.start('Ranking', { from: 'GameOver', highlight: this.savedEntry }), { size: 32 });
    UI.button(this, W / 2, 1015, 340, 78, 'MENU', () => this.scene.start('Menu'), { size: 32 });

    this.checkRanking();
  }

  async checkRanking() {
    if (this.final <= 0) { this.status.setText('Bora tentar de novo, sô!'); return; }
    this.status.setText('Conferindo o ranking...');
    const ok = await UAI.Ranking.qualifies(this.final);
    if (!this.sys.isActive()) return;
    if (!ok) { this.status.setText('Faltou pouco pro Top 10!'); return; }
    this.status.setText('Você entrou no Top 10!');
    const name = await UAI.UI.askName(this.final);
    if (!this.sys.isActive()) return;
    if (!name) { this.status.setText('Pontuação não enviada.'); return; }
    this.status.setText('Enviando...');
    const res = await UAI.Ranking.submit(name, this.final, this.diffKey);
    if (!this.sys.isActive()) return;
    this.savedEntry = { name: UAI.Ranking.clean(name), score: this.final };
    this.status.setText(res.source === 'online' && res.ok
      ? 'Salvo no ranking global, ' + this.savedEntry.name + '!'
      : 'Salvo no ranking deste aparelho.');
    UAI.Sfx.bonus();
  }

  update(time, delta) {
    this.ring.forEach((L, i) => {
      const ph = ((i - time * 0.014) % 6 + 6) % 6;
      L.extra = ph < 2 ? (this.isRecord ? 0.85 : 0.45) : 0;
    });
    this.lights.update(delta);
  }
}
