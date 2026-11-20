/* ============================================================
   UAI BALL – inicialização do Phaser
   ============================================================ */
(function () {
  const C = UAI.CONFIG;
  // celular comprido: aumenta a altura visível em vez de mostrar faixas pretas
  const ratio = (window.innerHeight || 1) / (window.innerWidth || 1);
  const VH = ratio > C.HEIGHT / C.WIDTH + 0.02 ? Math.min(2100, Math.round(C.WIDTH * ratio)) : C.HEIGHT;
  UAI.view = { H: VH, OFF: Math.round((VH - C.HEIGHT) / 2) };
  UAI.Sfx.init();
  UAI.Haptic.init();

  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#1a0f08',
    width: C.WIDTH,
    height: UAI.view.H,
    scale: {
      mode: Phaser.Scale.FIT,               // encaixa a mesa inteira na tela, sem cortar
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 4 },           // multitoque: duas palhetas + mola ao mesmo tempo
    scene: [BootScene, MenuScene, TableSelectScene, ProfileScene, GameScene, GameOverScene, RankingScene]
  };

  window.game = new Phaser.Game(config);

  // Navegadores só liberam áudio depois de um toque/tecla
  const unlock = () => UAI.Sfx.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // PWA: funciona offline e pode ser instalado / empacotado no Capacitor
  // APK: botão VOLTAR do Android
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (UAI.native && App) {
    let lastBack = 0;
    App.addListener('backButton', () => {
      const modal = document.getElementById('nameModal');
      if (modal && !modal.classList.contains('hidden')) { document.getElementById('nameSkip').click(); return; }
      const active = game.scene.getScenes(true).map(s => s.sys.settings.key);
      if (active.includes('Game')) {
        const g = game.scene.getScene('Game');
        if (g.over) { g.gameOver(); return; }                 // já acabou: vai para o resultado
        if (!g.editorOn) g.togglePause();
        return;
      }
      if (active.includes('Menu')) {
        if (Date.now() - lastBack < 2000) App.exitApp();
        else { lastBack = Date.now(); UAI.toast('Aperte VOLTAR de novo para sair'); }
        return;
      }
      game.scene.getScenes(true).forEach(s => s.scene.stop());
      game.scene.start('Menu');
    });
    App.addListener('pause', () => { const g = game.scene.getScene('Game'); if (g && g.sys.isActive() && !g.paused && !g.over) g.togglePause(); });
  }

  if (!UAI.native && 'serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
