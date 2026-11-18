/* ============================================================
   ProfileScene – nível, título, estatísticas e conquistas
   ============================================================ */
class ProfileScene extends Phaser.Scene {
  constructor() { super('Profile'); }

  create() {
    const W = UAI.CONFIG.WIDTH, UI = UAI.UI, PR = UAI.Progress;
    const p = PR.load(), info = PR.levelInfo(p.xp);
    UAI.menuBackdrop(this, 0.8);

    this.add.text(W / 2, 70, 'CONQUISTAS', {
      fontFamily: UI.FONT_TITLE, fontSize: '54px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 8
    }).setOrigin(0.5).setShadow(0, 0, '#ff8a20', 18, false, true);

    const g = this.add.graphics();
    g.fillStyle(0x2a1508, 0.9).fillRoundedRect(70, 120, W - 140, 190, 20);
    g.lineStyle(3, 0xc9973f, 1).strokeRoundedRect(70, 120, W - 140, 190, 20);
    this.add.text(100, 138, 'NÍVEL ' + info.level, { fontFamily: UI.FONT_NUM, fontSize: '30px', color: '#ffd27a' });
    this.add.text(W - 100, 140, info.title, { fontFamily: UI.FONT_TITLE, fontSize: '32px', color: '#ffe7b8' }).setOrigin(1, 0);
    UAI.xpBar(this, W / 2, 202, W - 200, info);
    this.add.text(W / 2, 202, UAI.fmt(info.into) + ' / ' + UAI.fmt(info.need) + ' XP', { fontFamily: UI.FONT_NUM, fontSize: '13px', color: '#2a1406' }).setOrigin(0.5).setDepth(6);
    const nextTitle = PR.TITLES[Math.min(PR.TITLES.length - 1, Math.floor((info.level - 1) / 3) + 1)];
    const lvNext = (Math.floor((info.level - 1) / 3) + 1) * 3 + 1;
    const lines = [
      'Partidas: ' + p.games + '   ·   Pontos somados: ' + UAI.fmt(p.total),
      '⭐ Estrelas: ' + PR.totalStars(p) + '/' + UAI.TABLES.length * 3 + '   ·   🔥 Dias seguidos: ' + ((p.streak && p.streak.n) || 0),
      nextTitle !== info.title ? 'Próximo título no nível ' + lvNext + ': ' + nextTitle : 'Você é uma LENDA DE MINAS!'
    ];
    this.add.text(W / 2, 260, lines.join('\n'), { fontFamily: 'Georgia, serif', fontSize: '19px', color: '#f3dfb4', align: 'center', lineSpacing: 4 }).setOrigin(0.5);

    // grade de medalhas (2 colunas)
    const A = PR.ACHIEVEMENTS, colW = (W - 160) / 2;
    A.forEach((a, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 80 + col * (colW + 0) + colW / 2, y = 360 + row * 74;
      const got = !!p.ach[a.id];
      const bg = this.add.graphics();
      bg.fillStyle(got ? 0x3a2408 : 0x1a1008, 0.92).fillRoundedRect(x - colW / 2 + 6, y - 32, colW - 12, 66, 12);
      bg.lineStyle(2, got ? 0xffd27a : 0x4a3420, 1).strokeRoundedRect(x - colW / 2 + 6, y - 32, colW - 12, 66, 12);
      this.add.text(x - colW / 2 + 40, y, got ? a.icon : '🔒', { fontSize: '30px' }).setOrigin(0.5).setAlpha(got ? 1 : 0.5);
      this.add.text(x - colW / 2 + 70, y - 14, a.name, { fontFamily: UI.FONT_TITLE, fontSize: '19px', color: got ? '#ffe7b8' : '#8a7058' }).setOrigin(0, 0.5);
      this.add.text(x - colW / 2 + 70, y + 12, a.desc, { fontFamily: 'Georgia, serif', fontSize: '14px', color: got ? '#d8b98a' : '#6a5440', wordWrap: { width: colW - 90 } }).setOrigin(0, 0.5);
    });

    UI.button(this, W / 2, 1060 + Math.max(0, Math.ceil(A.length / 2) - 9) * 74, 320, 76, 'VOLTAR', () => this.scene.start('Menu'), { size: 32 });
    this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  update(time, delta) { UAI.chaseRim(this, time, delta); }
}
