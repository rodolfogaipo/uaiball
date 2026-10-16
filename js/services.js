/* ============================================================
   UAI BALL – serviços compartilhados
   Store (localStorage) · Sfx (sons sintetizados, sem arquivos)
   Ranking (Firebase REST + local) · Layout (geometria salva)
   UI (botões, janela de nome) · Tex (texturas geradas)
   ============================================================ */
window.UAI = window.UAI || {};

/* ---------------- Armazenamento local ---------------- */
UAI.Store = {
  get(key, def) {
    try {
      const v = localStorage.getItem('uaiball_' + key);
      return v === null ? def : JSON.parse(v);
    } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem('uaiball_' + key, JSON.stringify(val)); } catch (e) { /* modo privado */ }
  },
  remove(key) { try { localStorage.removeItem('uaiball_' + key); } catch (e) {} },
  getHigh() { return UAI.Store.get('highscore', 0); },
  saveHigh(score) {
    const hi = UAI.Store.getHigh();
    if (score > hi) { UAI.Store.set('highscore', score); return true; }
    return false;
  }
};

UAI.fmt = n => Math.floor(n).toLocaleString('pt-BR');

/* ---------------- Sons (Web Audio, nada para baixar) ---------------- */
UAI.Sfx = {
  ctx: null, master: null, enabled: true,
  init() { this.enabled = UAI.Store.get('sound', true); },
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  toggle() { this.enabled = !this.enabled; UAI.Store.set('sound', this.enabled); return this.enabled; },
  tone(freq, dur = 0.1, type = 'sine', vol = 0.1, to = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur = 0.2, vol = 0.1, freq = 1200) {
    if (!this.enabled || !this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  },
  bumper(i = 0) { const f = [660, 740, 830, 880, 990, 523][i % 6]; this.tone(f, 0.13, 'triangle', 0.17, f * 1.5); this.tone(f * 2, 0.07, 'sine', 0.05); },
  sling() { this.tone(430, 0.07, 'square', 0.06, 250); },
  flipper() { this.tone(150, 0.05, 'square', 0.05, 80); this.noise(0.04, 0.05, 2500); },
  wall() { this.tone(240, 0.03, 'triangle', 0.035); },
  launch(p) { this.noise(0.3, 0.06 + 0.1 * p, 900); this.tone(170, 0.28, 'sawtooth', 0.05, 520); },
  rollover() { this.tone(1250, 0.06, 'sine', 0.08); },
  ramp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.13, 'square', 0.06, null, i * 0.07)); },
  bonus() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, null, i * 0.06)); },
  mult() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15, 'square', 0.06, null, i * 0.06)); },
  drain() { this.tone(330, 0.7, 'sawtooth', 0.08, 60); },
  click() { this.tone(700, 0.04, 'square', 0.04); },
  gameover() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.09, null, i * 0.22)); },
  record() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, 'square', 0.06, null, i * 0.1)); }
};

/* ---------------- Ranking (Firebase Realtime Database via REST) ----------------
   Sem SDK: usa fetch() direto na API REST do Firebase.
   Se FIREBASE_DB_URL estiver vazio ou a rede falhar, usa ranking local. */
UAI.Ranking = {
  online() { return !!(UAI.CONFIG.FIREBASE_DB_URL || '').trim(); },
  base() { return UAI.CONFIG.FIREBASE_DB_URL.replace(/\/+$/, '') + '/' + UAI.CONFIG.RANK_PATH; },
  clean(name) {
    return String(name || '').replace(/[<>"'`\\]/g, '').trim().toUpperCase().slice(0, 12) || 'ANÔNIMO';
  },
  valid(e) { return e && typeof e.name === 'string' && typeof e.score === 'number' && isFinite(e.score); },
  sort(list, n) { return list.filter(this.valid).sort((a, b) => b.score - a.score).slice(0, n); },
  localList() { return this.sort(UAI.Store.get('localrank', []), 10); },
  saveLocal(entry) {
    const list = this.localList(); list.push(entry);
    UAI.Store.set('localrank', this.sort(list, 10));
  },
  async fetchWithTimeout(url, opts = {}, ms = 6000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); }
    finally { clearTimeout(t); }
  },
  /** Retorna { list, source: 'online' | 'local', error } */
  async top(n = 10) {
    if (!this.online()) return { list: this.localList().slice(0, n), source: 'local' };
    try {
      // consulta ordenada (precisa da regra ".indexOn": ["score"] – veja firebase-rules.json)
      let r = await this.fetchWithTimeout(this.base() + '.json?orderBy=%22score%22&limitToLast=' + n);
      if (!r.ok) r = await this.fetchWithTimeout(this.base() + '.json'); // sem índice: baixa tudo
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      return { list: this.sort(Object.values(data || {}), n), source: 'online' };
    } catch (e) {
      return { list: this.localList().slice(0, n), source: 'local', error: true };
    }
  },
  async qualifies(score) {
    if (score <= 0) return false;
    const { list } = await this.top(10);
    return list.length < 10 || score > list[list.length - 1].score;
  },
  async submit(name, score, diff) {
    const entry = { name: this.clean(name), score: Math.floor(score), diff, date: Date.now() };
    this.saveLocal(entry);
    if (!this.online()) return { ok: true, source: 'local' };
    try {
      const r = await this.fetchWithTimeout(this.base() + '.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
      });
      return { ok: r.ok, source: 'online' };
    } catch (e) { return { ok: false, source: 'local' }; }
  }
};

/* ---------------- Geometria da mesa (padrão + edição salva) ---------------- */
UAI.Layout = {
  clone(o) { return JSON.parse(JSON.stringify(o)); },
  hash(o) {
    const s = JSON.stringify(o); let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  },
  /** Usa a versão editada no editor, a não ser que o config.js tenha mudado depois */
  load() {
    const saved = UAI.Store.get('layout', null);
    if (saved && saved.base === this.hash(UAI.DEFAULT_TABLE) && saved.data) return saved.data;
    return this.clone(UAI.DEFAULT_TABLE);
  },
  save(layout) { UAI.Store.set('layout', { base: this.hash(UAI.DEFAULT_TABLE), data: layout }); },
  reset() { UAI.Store.remove('layout'); return this.clone(UAI.DEFAULT_TABLE); }
};

/* ---------------- Interface ---------------- */
UAI.UI = {
  FONT_TITLE: 'Rye, Georgia, serif',
  FONT_NUM: 'Bungee, Impact, sans-serif',

  /** Botão de madeira com borda de latão e brilho */
  button(scene, x, y, w, h, label, onClick, opts = {}) {
    const c = scene.add.container(x, y);
    const glow = scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(opts.glow || 0xffa040).setDisplaySize(w * 1.35, h * 2.6).setAlpha(0);
    const g = scene.add.graphics();
    const t = scene.add.text(0, 2, label, {
      fontFamily: this.FONT_TITLE, fontSize: (opts.size || 30) + 'px',
      color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5);
    c.add([glow, g, t]);
    const r = Math.min(18, h * 0.3);
    const draw = sel => {
      g.clear();
      g.fillStyle(0x000000, 0.35); g.fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);
      g.fillStyle(sel ? 0xb8651c : 0x4a250e, 1); g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(0xffffff, sel ? 0.12 : 0.06); g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, r * 0.7);
      g.lineStyle(3, sel ? 0xffd27a : 0xc9973f, 1); g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    draw(false);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.selected = false;
    c.setSelected = s => { c.selected = s; draw(s); glow.setAlpha(s ? 0.35 : 0); return c; };
    c.on('pointerover', () => { c.setScale(1.04); glow.setAlpha(0.55); });
    c.on('pointerout', () => { c.setScale(1); glow.setAlpha(c.selected ? 0.35 : 0); });
    c.on('pointerdown', () => { UAI.Sfx.unlock(); c.setScale(0.97); });
    c.on('pointerup', () => { c.setScale(1.04); UAI.Sfx.click(); if (onClick) onClick(); });
    c.label = t; c.glow = glow;
    return c;
  },

  /** Janela HTML para digitar o nome. Resolve com o nome ou null (pular). */
  askName(score) {
    return new Promise(resolve => {
      const modal = document.getElementById('nameModal');
      const input = document.getElementById('nameInput');
      const ok = document.getElementById('nameOk');
      const skip = document.getElementById('nameSkip');
      document.getElementById('nameScore').textContent = UAI.fmt(score) + ' pontos';
      input.value = UAI.Store.get('lastname', '');
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
      const done = val => {
        modal.classList.add('hidden');
        ok.onclick = skip.onclick = input.onkeydown = null;
        if (val) UAI.Store.set('lastname', val);
        resolve(val);
      };
      ok.onclick = () => done(input.value.trim() || null);
      skip.onclick = () => done(null);
      input.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(input.value.trim() || null); };
    });
  }
};

/* ---------------- Texturas geradas (brilho + reservas se faltar imagem) ---------------- */
UAI.Tex = {
  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  add(scene, key, c) { if (scene.textures.exists(key)) scene.textures.remove(key); scene.textures.addCanvas(key, c); },

  /** Halo radial branco – tingido e somado (ADD) vira as luzes do jogo */
  glow(scene) {
    const c = this.canvas(128, 128), x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.16, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this.add(scene, 'glow', c);
  },

  /** Desenhos simples usados só se algum PNG não carregar */
  fallbacks(scene) {
    const T = scene.textures;
    if (!T.exists('ball')) {
      const c = this.canvas(128, 128), x = c.getContext('2d');
      const g = x.createRadialGradient(44, 40, 6, 64, 64, 64);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9cdd2'); g.addColorStop(1, '#4b4f55');
      x.fillStyle = g; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
      this.add(scene, 'ball', c);
    }
    if (!T.exists('bumper')) {
      const c = this.canvas(256, 256), x = c.getContext('2d');
      x.fillStyle = '#c9973f'; x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#5a2e12'; x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#d9a441'; x.beginPath(); x.arc(128, 128, 30, 0, Math.PI * 2); x.fill();
      this.add(scene, 'bumper', c);
    }
    if (!T.exists('flipper')) {
      const c = this.canvas(480, 112), x = c.getContext('2d');
      x.fillStyle = '#6b3415'; x.beginPath(); x.roundRect ? x.roundRect(4, 8, 472, 96, 48) : x.rect(4, 8, 472, 96); x.fill();
      x.strokeStyle = '#c9973f'; x.lineWidth = 6; x.stroke();
      x.fillStyle = '#c9cdd2'; x.beginPath(); x.arc(56, 56, 24, 0, Math.PI * 2); x.fill();
      this.add(scene, 'flipper', c);
    }
    if (!T.exists('logo')) {
      const c = this.canvas(640, 400), x = c.getContext('2d');
      x.font = '140px Rye, serif'; x.textAlign = 'center'; x.fillStyle = '#f0a040';
      x.strokeStyle = '#2a1406'; x.lineWidth = 14;
      x.strokeText('UAI', 320, 170); x.fillText('UAI', 320, 170);
      x.strokeText('BALL', 320, 330); x.fillText('BALL', 320, 330);
      this.add(scene, 'logo', c);
    }
    if (!T.exists('mesa')) {
      const c = this.canvas(896, 1200), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 896, 0);
      g.addColorStop(0, '#5a3214'); g.addColorStop(0.5, '#9a6232'); g.addColorStop(1, '#5a3214');
      x.fillStyle = g; x.fillRect(0, 0, 896, 1200);
      x.strokeStyle = 'rgba(40,20,5,0.25)';
      for (let i = 0; i < 140; i++) { x.beginPath(); const xx = Math.random() * 896; x.moveTo(xx, 0); x.bezierCurveTo(xx + 20, 400, xx - 20, 800, xx + 10, 1200); x.stroke(); }
      this.add(scene, 'mesa', c);
    }
  }
};
