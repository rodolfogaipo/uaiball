/* ============================================================
   GameOverScene – resultado da partida:
   pontos, ESTRELAS, XP e nível, mesa nova liberada, conquistas,
   desafio do dia e envio ao ranking da mesa
   ============================================================ */
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.savedEntry = null;
    this.g = Object.assign({ table: 'uaiball', score: 0, difficulty: 'medio', stats: {}, missionsDone: 0 }, data || {});
  }

  create() {
    const W = UAI.CONFIG.WIDTH, UI = UAI.UI;
    const r = this.r = UAI.Progress.finishGame(this.g);
    const def = r.def, score = this.g.score;
    UAI.menuBackdrop(this, 0.78, UAI.thumb(this, def));
    this.isRecord = r.isRecord && score > 0;

    this.add.text(W / 2, 92, 'FIM DE JOGO', {
      fontFamily: UI.FONT_TITLE, fontSize: '68px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 10
    }).setOrigin(0.5).setShadow(0, 0, '#ff5a20', 20, false, true);
    this.add.text(W / 2, 150, def.name + '  ·  ' + UAI.DIFFICULTIES[this.g.difficulty].label, {
      fontFamily: UI.FONT_TITLE, fontSize: '26px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5);

    const scoreTxt = this.add.text(W / 2, 222, '0', {
      fontFamily: UI.FONT_NUM, fontSize: '78px', color: '#fff0c8', stroke: '#2a1406', strokeThickness: 10
    }).setOrigin(0.5).setShadow(0, 0, '#ffa040', 24, false, true);
    this.tweens.addCounter({ from: 0, to: score, duration: Math.min(1500, 300 + score / 30), ease: 'Cubic.out',
      onUpdate: tw => scoreTxt.setText(UAI.fmt(tw.getValue())) });

    // estrelas
    const prevStars = r.stars - r.newStars;
    [0, 1, 2].forEach(i => {
      const x = W / 2 + (i - 1) * 110, y = 322;
      const on = i < r.stars;
      const s = this.add.text(x, y, on ? '★' : '☆', { fontFamily: 'Georgia, serif', fontSize: '96px', color: on ? '#ffd23a' : '#6a4a2a', stroke: '#2a1406', strokeThickness: 6 }).setOrigin(0.5);
      if (on) {
        s.setScale(0);
        this.tweens.add({ targets: s, scale: 1, duration: 380, delay: 700 + i * 320, ease: 'Back.out',
          onStart: () => { UAI.Sfx.tone(700 + i * 200, 0.18, 'triangle', 0.09); if (i >= prevStars) this.cameras.main.flash(120, 255, 220, 120); } });
      }
      const goal = (def.stars || [])[i];
      if (goal) this.add.text(x, y + 56, UAI.fmt(goal), { fontFamily: UI.FONT_NUM, fontSize: '14px', color: on ? '#ffd27a' : '#8a7058' }).setOrigin(0.5);
    });

    let y = 412;
    const line = (txt, color = '#ffe7b8', size = 26, font = UI.FONT_TITLE) => {
      const t = this.add.text(W / 2, y, txt, { fontFamily: font, fontSize: size + 'px', color, stroke: '#2a1406', strokeThickness: 5, align: 'center' }).setOrigin(0.5);
      y += size + 16;
      return t;
    };
    if (this.isRecord) {
      const rec = line('★ NOVO RECORDE DA MESA! ★', '#ffe066', 34);
      this.tweens.add({ targets: rec, scale: 1.08, duration: 420, yoyo: true, repeat: -1 });
      this.time.delayedCall(400, () => UAI.Sfx.record());
    } else line('Recorde da mesa: ' + UAI.fmt(r.best), '#e8c48a', 22, UI.FONT_NUM);
    if (r.newStars) line('+' + r.newStars + (r.newStars > 1 ? ' estrelas novas!' : ' estrela nova!'), '#ffd23a', 24);

    // XP
    const xb = UAI.xpBar(this, W / 2, y + 4, W - 300, r.before);
    const lvTxt = this.add.text(150, y + 4, 'NV ' + r.before.level, { fontFamily: UI.FONT_NUM, fontSize: '18px', color: '#ffd27a' }).setOrigin(1, 0.5);
    this.add.text(W - 140, y + 4, '+' + UAI.fmt(r.xp) + ' XP', { fontFamily: UI.FONT_NUM, fontSize: '18px', color: '#7dff9a' }).setOrigin(0, 0.5);
    this.tweens.addCounter({ from: r.before.xp, to: r.after.xp, duration: 1400, delay: 900, ease: 'Cubic.out',
      onUpdate: tw => { const inf = UAI.Progress.levelInfo(tw.getValue()); xb.draw(inf.frac); lvTxt.setText('NV ' + inf.level); } });
    y += 40;
    this.add.text(W / 2, y, r.xpParts.map(p => p[0] + ' +' + UAI.fmt(p[1])).join('  ·  '), {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#d8b98a', align: 'center', wordWrap: { width: W - 160 }
    }).setOrigin(0.5);
    y += 40;
    if (r.levelUp) {
      const t = line('SUBIU PARA O NÍVEL ' + r.after.level + '!  ' + r.after.title, '#9fe8ff', 26);
      t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, delay: 2300, duration: 300, onStart: () => UAI.Sfx.mult() });
    }
    r.unlocked.forEach(u => {
      const t = line('🔓 MESA NOVA LIBERADA: ' + u.name.toUpperCase(), '#7dff9a', 26);
      t.setAlpha(0); this.tweens.add({ targets: t, alpha: 1, scale: { from: 1.3, to: 1 }, delay: 1800, duration: 400, onStart: () => UAI.Sfx.record() });
    });
    if (r.dailyWon) line('📅 DESAFIO DO DIA VENCIDO!', '#7dff9a', 24);
    r.achievements.slice(0, 3).forEach(a => line('🏅 ' + a.name + ' – ' + a.desc, '#ffd27a', 20, 'Georgia, serif'));
    if (r.achievements.length > 3) line('+ ' + (r.achievements.length - 3) + ' conquistas', '#ffd27a', 20, 'Georgia, serif');

    this.status = this.add.text(W / 2, 852, '', { fontFamily: 'Georgia, serif', fontSize: '22px', color: '#f3dfb4', align: 'center' }).setOrigin(0.5);

    // botões
    const again = () => this.scene.start('Game', { table: def.id, difficulty: this.g.difficulty });
    UI.button(this, W / 2, 930, 440, 86, 'JOGAR DE NOVO', again, { size: 36, glow: 0xffb040 });
    const nx = r.next && UAI.Progress.isUnlocked(UAI.Progress.load(), r.next) ? r.next : null;
    if (nx) {
      UI.button(this, W / 2 - 160, 1030, 300, 72, 'PRÓXIMA MESA', () => this.scene.start('TableSelect', { table: nx.id }), { size: 24, glow: 0x7dff9a }).setSelected(r.unlocked.length > 0);
      UI.button(this, W / 2 + 160, 1030, 300, 72, 'MESAS', () => this.scene.start('TableSelect', { table: def.id }), { size: 26 });
    } else UI.button(this, W / 2, 1030, 340, 72, 'MESAS', () => this.scene.start('TableSelect', { table: def.id }), { size: 28 });
    UI.button(this, W / 2 - 160, 1118, 300, 66, 'RANKING', () => this.scene.start('Ranking', { from: 'GameOver', table: def.id, highlight: this.savedEntry }), { size: 24 });
    UI.button(this, W / 2 + 160, 1118, 300, 66, 'MENU', () => this.scene.start('Menu'), { size: 24 });

    this.countTxt = this.add.text(W / 2, 1172, '', { fontFamily: 'Georgia, serif', fontSize: '17px', color: '#b8956a' }).setOrigin(0.5);
    this.input.keyboard.on('keydown-ENTER', again);
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    this.input.on('pointerdown', () => { this.idleN = 30; });

    this.checkRanking().catch(() => {}).then(() => this.backToMenu());
  }

  /** se ninguém mexer, volta sozinho para o menu */
  backToMenu() {
    if (!this.sys.isActive()) return;
    this.idleN = 30;
    const tick = () => {
      if (!this.sys.isActive()) return;
      if (this.idleN <= 0) { this.scene.start('Menu'); return; }
      this.countTxt.setText(this.idleN <= 10 ? 'Voltando ao menu em ' + this.idleN + '...' : '');
      this.idleN--;
      this.time.delayedCall(1000, tick);
    };
    tick();
  }

  async checkRanking() {
    const score = this.g.score, table = this.g.table;
    if (score <= 0) { this.status.setText('Bora tentar de novo, sô!'); return; }
    this.status.setText('Conferindo o ranking da mesa...');
    const ok = await UAI.Ranking.qualifies(score, table);
    if (!this.sys.isActive()) return;
    if (!ok) { this.status.setText('Faltou pouco pro Top 10 desta mesa!'); return; }
    this.status.setText('Você entrou no Top 10 da mesa!');
    const name = await UAI.UI.askName(score);
    if (!this.sys.isActive()) return;
    if (!name) { this.status.setText('Pontuação não enviada.'); return; }
    this.status.setText('Enviando...');
    const res = await UAI.Ranking.submit(name, score, this.g.difficulty, table);
    if (!this.sys.isActive()) return;
    this.savedEntry = { name: UAI.Ranking.clean(name), score };
    this.status.setText(res.source === 'online' && res.ok ? 'Salvo no ranking global, ' + this.savedEntry.name + '!' : 'Salvo no ranking deste aparelho.');
    UAI.Sfx.bonus();
  }

  update(time, delta) { UAI.chaseRim(this, time, delta, this.isRecord ? 0.02 : 0.008); }
}
