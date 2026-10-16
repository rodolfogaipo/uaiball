/* ============================================================
   BootScene – carrega imagens e fontes, mostra barra de progresso
   ============================================================ */
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const W = UAI.CONFIG.WIDTH, H = UAI.CONFIG.HEIGHT;
    this.add.text(W / 2, H / 2 - 70, 'UAI BALL', {
      fontFamily: 'Georgia, serif', fontSize: '64px', color: '#ffd27a'
    }).setOrigin(0.5);
    const bar = this.add.rectangle(W / 2 - 250, H / 2, 0, 18, 0xd9a441).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 504, 24).setStrokeStyle(2, 0xd9a441);
    const txt = this.add.text(W / 2, H / 2 + 40, 'Carregando, uai...', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe7b8'
    }).setOrigin(0.5);
    this.load.on('progress', p => { bar.width = 500 * p; });

    this.missing = [];
    this.load.on('loaderror', f => this.missing.push(f.key));

    // Os 5 assets (+ a palheta direita opcional)
    this.load.image('logo', 'assets/logo.png');
    this.load.image('mesa', 'assets/mesa.png');
    this.load.image('flipper', 'assets/flipper.png');
    this.load.image('flipper2', 'assets/flipper2.png');   // opcional: palheta direita com outra gravação
    this.load.image('bumper', 'assets/bumper.png');
    this.load.image('ball', 'assets/ball.png');
    this.txt = txt;
  }

  create() {
    UAI.Tex.glow(this);
    UAI.Tex.fallbacks(this);   // gera desenhos simples se algum PNG faltar
    const real = this.missing.filter(k => k !== 'flipper2');
    if (real.length) console.warn('[Uai Ball] Imagens não encontradas em /assets:', real.join(', '));

    // Espera as fontes do Google (no máximo 2,5 s) para os textos não "piscarem"
    const fonts = document.fonts
      ? Promise.all([document.fonts.load('40px Rye'), document.fonts.load('40px Bungee')])
      : Promise.resolve();
    const timeout = new Promise(r => setTimeout(r, 2500));
    Promise.race([fonts, timeout]).catch(() => {}).then(() => this.scene.start('Menu'));
  }
}
