/* ============================================================
   UAI BALL – inicialização do Phaser
   ============================================================ */
(function () {
  const C = UAI.CONFIG;
  UAI.Sfx.init();

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a0f08',
    width: C.WIDTH,
    height: C.HEIGHT,
    scale: {
      mode: Phaser.Scale.FIT,               // encaixa a mesa inteira na tela, sem cortar
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 4 },           // multitoque: duas palhetas + mola ao mesmo tempo
    physics: {
      default: 'matter',
      matter: {
        gravity: { x: 0, y: 1 },            // a dificuldade troca esse valor na GameScene
        enableSleeping: false,              // bola nunca "dorme"
        positionIterations: 10,             // mais iterações = colisões mais firmes
        velocityIterations: 8,
        constraintIterations: 4,
        autoUpdate: false,                  // a GameScene faz sub-passos manuais (anti-atravessamento)
        debug: false
      }
    },
    scene: [BootScene, MenuScene, GameScene, GameOverScene, RankingScene]
  };

  window.game = new Phaser.Game(config);

  // Navegadores só liberam áudio depois de um toque/tecla
  const unlock = () => UAI.Sfx.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // PWA: funciona offline e pode ser instalado / empacotado no Capacitor
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
