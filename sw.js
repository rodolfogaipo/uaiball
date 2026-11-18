/* Uai Ball – Service Worker
   Rede primeiro (pega atualizações do GitHub Pages), cache se estiver offline.
   Troque CACHE ao publicar mudanças grandes. */
const CACHE = 'uaiball-v4';
const SHELL = [
  './', './index.html', './style.css', './main.js', './manifest.json',
  './js/config.js', './js/physics.js', './js/services.js', './js/lights.js', './js/progress.js',
  './js/tables/kit.js', './js/tables/t01_uaiball.js', './js/tables/t02_t06.js', './js/tables/t07_t11.js',
  './js/render/tableArt.js',
  './scenes/BootScene.js', './scenes/MenuScene.js', './scenes/TableSelectScene.js', './scenes/ProfileScene.js',
  './scenes/GameScene.js', './scenes/GameRules.js', './scenes/GameEditor.js',
  './scenes/GameOverScene.js', './scenes/RankingScene.js',
  './assets/logo.png', './assets/mesa.png', './assets/flipper.png', './assets/flipper2.png',
  './assets/bumper.png', './assets/ball.png',
  'https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebasedatabase.app')) return; // ranking sempre online
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req))
  );
});
