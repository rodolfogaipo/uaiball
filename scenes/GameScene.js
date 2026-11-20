/* ============================================================
   GameScene – o jogo (vale para TODAS as mesas)
   ------------------------------------------------------------
   • a mesa vem de js/tables/ (dados) → física + desenho
   • física própria a 1000 passos/s (js/physics.js), várias bolas
   • regras clássicas de fliperama ficam em GameRules.js
   • depuração (G) e editor de pontos (E) ficam em GameEditor.js
   O relógio do jogo (this.now) é próprio: tudo que é regra usa
   this.after(ms, fn), então o jogo pausa e testa certinho.
   ============================================================ */

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    data = data || {};
    this.def = UAI.tableById(data.table || UAI.Store.get('lastTable', 'uaiball'));
    UAI.Store.set('lastTable', this.def.id);
    this.diffKey = UAI.DIFFICULTIES[data.difficulty] ? data.difficulty : UAI.Store.get('difficulty', 'medio');
    if (!UAI.DIFFICULTIES[this.diffKey]) this.diffKey = 'medio';
    this.diff = UAI.DIFFICULTIES[this.diffKey];
    this.isDaily = !!data.daily;
    this.debugOn = /[?&]debug=1/.test(location.search);
    this.editorOn = false;
    // a cena é reaproveitada a cada partida: zera as marcas da partida anterior
    this._ended = false; this.helpOpen = false; this.pauseUI = null; this.overAt = 0;
  }

  /* =========================================================
     CRIAÇÃO
     ========================================================= */
  create() {
    const C = UAI.CONFIG, P = UAI.PHYSICS;
    this.W = C.WIDTH; this.H = C.HEIGHT;
    UAI.setupView(this);
    this.mods = Object.assign({ gravity: 1, omega: 1, ballSave: 1 }, this.def.mods || {});
    this.rules = Object.assign({ lockHoles: [], locksNeeded: 3, multStep: 6000 }, this.def.rules || {});

    this.world = new UAI.PinballWorld({
      gravity: this.diff.gravity * this.mods.gravity,
      maxSpeed: P.maxSpeed, rollDrag: P.rollDrag, ballRadius: P.ball.radius
    });
    this.world.onHit = (c, imp, kicked, b) => this.onHit(c, imp, kicked, b);
    this.world.onSensor = (S, b) => this.onSensor(S, b);

    this.layout = UAI.Layout.load(this.def);
    this.now = 0;
    this.timers = [];
    this.resetGameState();

    // camadas visuais
    this.tableKey = this.ensureArt();
    this.tableImg = this.add.image(this.W / 2, this.H / 2, this.tableKey).setDisplaySize(this.W, this.H).setDepth(0);
    this.ambient = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, this.def.art ? 0.36 : 0.2).setDepth(1);
    this.parts = UAI.Parts.ensure(this, this.def);      // bumpers 3D e brilhos (estilo Space Cadet)
    this.lights = new UAI.LightRig(this);
    this.plungerGfx = this.add.graphics().setDepth(6);
    this.dynGfx = this.add.graphics().setDepth(4.6);
    this.spinGfx = this.add.graphics().setDepth(4.7);
    this.rampImg = this.textures.exists(this.tableKey + '_ramps')
      ? this.add.image(this.W / 2, this.H / 2, this.tableKey + '_ramps').setDisplaySize(this.W, this.H).setDepth(8.6) : null;

    this.tableObjs = [];
    this.flippers = [];
    this.editorBound = false;
    this.buildTable();
    this.createHUD();
    this.createInput();
    this.debugGfx = this.add.graphics().setDepth(60);

    this.buildDecorAnim();
    this.newBall(true);
    if (this.sys.game.device.input.touch && !UAI.Store.get('touchHelp', false)) this.showTouchHelp();
    if (/[?&]editor=1/.test(location.search)) this.toggleEditor();
  }

  /** DETALHES VIVOS: engrenagens girando, balão flutuando, estrelas piscando,
      fogueira tremendo, fumaça do trem e do café, brilho na água, reflexo do vidro */
  buildDecorAnim() {
    if (this.def.art) return;
    const TA = UAI.TableArt, icons = (this.layout.decor && this.layout.decor.icons) || [];
    this.decorFx = [];
    icons.forEach(([nm, x, y, sz = 70, rot = 0], i) => {
      const kind = TA.ANIM[nm];
      if (!kind) return;
      const size = sz >= 44 ? sz * 1.25 : sz * 1.1;
      if (TA.SPRITE_ANIM[kind]) {
        const key = 'ico_' + this.def.id + '_' + i;
        if (!this.textures.exists(key)) UAI.Tex.add(this, key, TA.iconCanvas(this.def, nm, size));
        const img = this.add.image(x, y, key).setDepth(0.6).setRotation(rot);
        if (kind === 'spin') this.tweens.add({ targets: img, angle: '+=360', duration: nm === 'sun' ? 30000 : 9000, repeat: -1 });
        if (kind === 'float') this.tweens.add({ targets: img, y: y - 7, angle: { from: -3, to: 3 }, duration: 1900 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        if (kind === 'twinkle') {
          this.tweens.add({ targets: img, scale: { from: 0.94, to: 1.06 }, duration: 900 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          const glint = this.add.image(x + size * 0.18, y - size * 0.22, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setDepth(1.2).setDisplaySize(size * 0.5, size * 0.5).setAlpha(0);
          this.tweens.add({ targets: glint, alpha: { from: 0, to: 0.9 }, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1800 + i * 400 });
        }
        return;
      }
      if (kind === 'flicker') {
        const g = this.add.image(x, y - size * 0.1, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff8a2a).setDepth(1.2).setDisplaySize(size * 1.8, size * 1.8).setAlpha(0.35);
        this.decorFx.push({ kind, g, base: 0.35 });
      } else if (kind === 'smoke') {
        this.decorFx.push({ kind, x: x + (nm === 'train' ? -size * 0.2 : 0), y: y - size * 0.45, size, next: 0 });
      } else if (kind === 'shimmer') {
        this.decorFx.push({ kind, x, y, size, next: 0 });
      }
    });
    // reflexo do vidro passando de vez em quando
    this.glass = this.add.image(-300, this.H / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff4e0)
      .setDisplaySize(160, this.H * 1.6).setRotation(0.35).setDepth(19).setAlpha(0.07);
    this.tweens.add({ targets: this.glass, x: this.W + 300, duration: 2600, repeat: -1, repeatDelay: 7000, ease: 'Sine.inOut' });
  }

  stepDecorAnim(dt, t) {
    (this.decorFx || []).forEach(F => {
      if (F.kind === 'flicker') F.g.setAlpha(F.base + Math.random() * 0.18 + 0.08 * Math.sin(t / 90));
      else if (t >= F.next) {
        if (F.kind === 'smoke') {
          F.next = t + 380 + Math.random() * 300;
          const p = this.add.image(F.x, F.y, 'glow').setTint(0xe8e2d6).setDepth(1.25).setAlpha(0.45).setDisplaySize(F.size * 0.22, F.size * 0.22);
          this.tweens.add({ targets: p, y: F.y - F.size * 0.9, x: F.x + (Math.random() - 0.3) * F.size * 0.5, alpha: 0, displayWidth: F.size * 0.8, displayHeight: F.size * 0.8, duration: 2200, onComplete: () => p.destroy() });
        } else {
          F.next = t + 250 + Math.random() * 400;
          const p = this.add.image(F.x + (Math.random() - 0.5) * F.size, F.y + (Math.random() - 0.5) * F.size * 0.6, 'glow')
            .setBlendMode(Phaser.BlendModes.ADD).setTint(0xbff4ff).setDepth(1.25).setDisplaySize(10, 10).setAlpha(0);
          this.tweens.add({ targets: p, alpha: 0.9, displayWidth: 22, displayHeight: 6, duration: 300, yoyo: true, onComplete: () => p.destroy() });
        }
      }
    });
  }

  /** arte da mesa: imagem (mesa 1) ou desenhada pelo jogo a partir dos dados */
  ensureArt() {
    const def = this.def;
    if (def.art && this.textures.exists(def.art)) return def.art;
    const edited = !!UAI.Store.get('layout_' + def.id, null) && JSON.stringify(this.layout) !== JSON.stringify(def.layout);
    const key = 'table_' + def.id + (edited ? '_ed' : '');
    if (!this.textures.exists(key) || edited) {
      const d = edited ? Object.assign({}, def, { layout: this.layout }) : def;
      UAI.Tex.add(this, key, UAI.TableArt.render(d, 1, { skipAnim: true }));   // os ícones que se mexem viram sprites
      const rc = UAI.TableArt.renderRamps(d, 1);
      if (rc) UAI.Tex.add(this, key + '_ramps', rc);
    }
    return key;
  }

  resetGameState() {
    const C = UAI.CONFIG;
    this.score = 0;
    this.lives = C.LIVES;
    this.ballNo = 0;
    this.mult = 1;
    this.bonus = 0; this.bonusX = 1;
    this.extraBallsGiven = 0;
    this.locks = 0; this.lockLit = 0;
    this.lockNeedsLit = this.hasAward('lockLit');
    this.multiball = false;
    this.jackpotValue = C.POINTS.jackpot; this.jackpotsThisMB = 0;
    this.missionIdx = 0; this.missionProg = 0; this.missionRound = 1; this.missionsDone = 0; this.mastered = false;
    this.stats = { shots: 0, ramps: 0, holes: 0, multiballs: 0, jackpots: 0, superJackpots: 0, skillShots: 0, maxCombo: 0, extraBalls: 0, drops: 0, lanes: 0, tilts: 0 };
    this.tiltLevel = 0; this.tilted = false; this.lastNudge = -1e9;
    this.combo = 0; this.lastShotAt = -1e9;
    this.bumperLevel = 0; this.bumperUpAt = 0;
    this.party = 0; this.saveUntil = 0;
    this.autoQueue = 0; this.nextAutoAt = 0;
    this.kickbackLit = {};
    this.balls = [];
    this.over = false; this.paused = false; this.betweenBalls = false;
    this.plunger = { charging: false, charge: 0, mode: null, pointerId: null, startY: 0, startT: 0 };
    this.skillLamp = 5;
    this.high = UAI.Progress.tableStats(UAI.Progress.load(), this.def.id).best || 0;
  }

  hasAward(a) {
    const L = this.def.layout;
    return [...(L.laneGroups || []), ...(L.dropBanks || []), ...(L.targetGroups || [])].some(g => g.award === a);
  }

  /* ---------- relógio do jogo ---------- */
  after(ms, fn) { this.timers.push({ at: this.now + ms, fn }); }
  runTimers() {
    if (!this.timers.length) return;
    const due = this.timers.filter(t => t.at <= this.now);
    if (!due.length) return;
    this.timers = this.timers.filter(t => t.at > this.now);
    due.forEach(t => t.fn());
  }

  /* =========================================================
     MESA → MOTOR DE FÍSICA + VISUAL
     ========================================================= */
  buildTable() {
    const P = UAI.PHYSICS, L = this.layout, W = this.world;
    W.clear();
    W.flippers = [];
    this.tableObjs.forEach(o => o.destroy());
    this.tableObjs = [];
    this.flippers.forEach(f => { f.sprite.destroy(); });
    this.flippers = [];
    this.lights.clear();
    const smooth = !!this.def.art;          // mesa desenhada à mão: curvas suavizadas

    // peças modernas geradas para a mesa (bumper e palhetas no estilo da arte)
    this.bumperKey = 'bumper'; this.flipKeys = null;
    if (false) {
      const id = this.def.id;
      if (!this.textures.exists('bumperM_' + id)) UAI.Tex.add(this, 'bumperM_' + id, UAI.TableArt.bumperCanvas(this.def));
      if (!this.textures.exists('flipM_' + id)) { UAI.Tex.add(this, 'flipM_' + id, UAI.TableArt.flipperCanvas(this.def, false)); UAI.Tex.add(this, 'flipM2_' + id, UAI.TableArt.flipperCanvas(this.def, true)); }
      this.bumperKey = 'bumperM_' + id; this.flipKeys = ['flipM_' + id, 'flipM2_' + id];
    }

    // paredes, portões, blocos, postes
    L.walls.forEach(w => {
      const mat = w.mat === 'rubber' ? P.rubber : P.wall;
      W.addPolyline(smooth ? this.smoothPolyline(w.pts) : w.pts, mat, 'wall', false, w.t || 0);
    });
    (L.gates || []).forEach(g => {
      const [a, b] = g.pts;
      W.addSegment(a[0], a[1], b[0], b[1], Object.assign({}, P.wall, { pass: g.pass }), 'gate', g.t || 0);
    });
    (L.blocks || []).forEach(b => W.addPolyline(b.pts, P.wall, 'wall', true));
    (L.posts || []).forEach(([x, y, r]) => W.addCircle(x, y, r || 6, P.rubber, 'post'));

    // bumpers (normais, alvos redondos, roda e choque)
    this.bumpers = (L.bumpers || []).map((b, i) => {
      const kind = b.kind || 'bumper';
      let phys;
      if (kind === 'bumper') { phys = W.addCircle(b.x, b.y, b.r, P.bumper, 'bumper'); phys.data = i; }
      else phys = W.addSensor(b.x, b.y, kind === 'target' ? b.r + 4 : b.r, kind === 'target' ? 'btarget' : kind, i);
      const disp = 2 * (b.vr || b.r / P.bumper.spriteRatio), persp = this.def.art ? P.bumper.perspective : 1;
      const hidden = kind === 'shock';
      const halo = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(kind === 'bumper' ? (this.def.theme && this.def.theme.bumperGlow) || 0xff9a30 : 0xff9a30)
        .setDisplaySize(disp * 1.6, disp * 1.6 * persp).setDepth(4).setAlpha(0.25).setVisible(!hidden);
      const holder = this.add.container(b.x, b.y).setDepth(5).setScale(1, persp);
      const spr = hidden ? null : this.add.image(0, 0, kind === 'wheel' ? 'bumper' : this.parts.keys[this.bumperLevel || 0][0]).setDisplaySize(disp * (kind === 'wheel' ? 1 : 1.04), disp * (kind === 'wheel' ? 1 : 1.04));
      if (spr) holder.add(spr);
      const cap = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfff0c8).setDisplaySize(disp * 0.9, disp * 0.9 * persp).setDepth(6).setAlpha(0);
      this.tableObjs.push(halo, holder, cap);
      return { ...b, kind, phys, spr, holder, persp, halo, cap, flash: 0, last: -1e9, phase: i * 1.7, spin: (i % 2 ? -1 : 1) };
    });

    // estilingues
    this.slings = (L.slings || []).map((s, i) => {
      const [ia, ib] = s.kick;
      const a = { x: s.pts[ia][0], y: s.pts[ia][1] }, b = { x: s.pts[ib][0], y: s.pts[ib][1] };
      const other = s.pts.find((p, k) => k !== ia && k !== ib);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      let n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
      if ((other[0] - a.x) * n.x + (other[1] - a.y) * n.y > 0) n = { x: -n.x, y: -n.y };
      const face = W.addSegment(a.x, a.y, b.x, b.y, Object.assign({}, P.sling, { face: [n.x, n.y] }), 'sling');
      face.data = i;
      for (let k = 0; k < 3; k++) {
        const p = s.pts[k], q = s.pts[(k + 1) % 3];
        const isFace = (k === ia && (k + 1) % 3 === ib) || (k === ib && (k + 1) % 3 === ia);
        if (!isFace) W.addSegment(p[0], p[1], q[0], q[1], P.rubber, 'rubber');
      }
      s.pts.forEach(p => W.addCircle(p[0], p[1], 5, P.rubber, 'rubber'));
      const lamps = [0.2, 0.5, 0.8].map(k => this.lights.add(a.x + (b.x - a.x) * k + n.x * 8, a.y + (b.y - a.y) * k + n.y * 8,
        { r: 30, color: 0xff5a2a, base: 0.12, decay: 260 }));
      return { a, b, n, lamps };
    });

    // sensores com nome (órbitas, outlanes, inlanes, rampas da mesa 1...)
    this.named = {};
    Object.entries(L.sensors || {}).forEach(([name, [x, y, r]]) => { this.named[name] = W.addSensor(x, y, r, 'named', name); });

    // pistas de rolagem (top lanes / trio)
    this.laneGroups = (L.laneGroups || []).map((G, gi) => {
      const lamps = G.lanes.map(([x, y], i) => {
        W.addSensor(x, y, 18, 'lane', { g: gi, i });
        return this.lights.add(x, y, { r: 38, color: 0x8fe3ff, base: 0.14 });
      });
      const letters = G.letters.map((ch, i) => this.add.text(G.lanes[i][0], G.lanes[i][1] + 26, ch, {
        fontFamily: UAI.UI.FONT_TITLE, fontSize: '20px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 4
      }).setOrigin(0.5).setDepth(4.8).setAlpha(0.55));
      this.tableObjs.push(...letters);
      return { ...G, lit: G.lanes.map(() => false), lamps, letters };
    });

    // alvos que caem
    this.dropBanks = (L.dropBanks || []).map((B, gi) => {
      const targets = B.targets.map((t, i) => {
        const c = W.addSegment(t[0], t[1], t[2], t[3], P.drop, 'drop', 5);
        c.data = { g: gi, i };
        const mx = (t[0] + t[2]) / 2, my = (t[1] + t[3]) / 2;
        const lamp = this.lights.add(mx, my, { r: 30, color: 0xffa040, base: 0.1, decay: 400 });
        return { c, pts: t, down: false, lamp };
      });
      const letters = (B.name || '').split('-');
      return { ...B, targets, letters, resetAt: 0 };
    });

    // alvos fixos com letras
    this.targetGroups = (L.targetGroups || []).map((G, gi) => {
      const targets = G.targets.map((t, i) => {
        const c = W.addSegment(t[0][0], t[0][1], t[1][0], t[1][1], P.rubber, 'target', 5);
        c.data = { g: gi, i };
        const lamp = this.lights.add((t[0][0] + t[1][0]) / 2, (t[0][1] + t[1][1]) / 2, { r: 30, color: 0xff60c0, base: 0.12, onLevel: 0.9 });
        return { c, pts: t, lit: false, lamp, last: -1e9 };
      });
      return { ...G, targets };
    });

    // spinners
    this.spinners = (L.spinners || []).map((S, i) => {
      W.addSensor(S.x, S.y, Math.max(18, S.w / 2), 'spinner', i);
      return { ...S, phase: 0, rate: 0, last: -1e9, lamp: this.lights.add(S.x, S.y, { r: 34, color: 0xfff0a0, base: 0.06, decay: 300 }) };
    });

    // rampas aéreas (boca no tabuleiro)
    this.ramps = (L.ramps || []).map((R, i) => {
      const [x, y, r] = R.sensor;
      W.addSensor(x, y, r, 'rampMouth', i);
      return { ...R, pts: UAI.TableArt.smoothPath(R.path, 6) };
    });

    // palhetas (inclusive as de cima)
    this.flippers = (L.flippers || []).map(f => this.makeFlipper(f));

    this.buildHoles();
    this.buildLights();
    this.redrawDyn();
  }

  buildHoles() {
    const L = this.layout, W = this.world, HP = UAI.PHYSICS.holes;
    this.holes = (L.holes || []).map((h, i) => {
      const black = h.type === 'blackhole';
      const sensor = W.addSensor(h.x, h.y, h.r || 13, 'hole', i);
      sensor.continuous = true;
      if (black) W.addField(h.x, h.y, HP.pullRadius, HP.pull);
      const size = black ? 80 : 40;
      if (this.def.art) {
        this.tableObjs.push(this.add.image(h.x, h.y, 'pit').setDisplaySize(size, size * 0.9).setDepth(2.5).setAlpha(black ? 0.95 : 0.85));
      }
      const swirl = black ? this.add.image(h.x, h.y, 'swirl').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xb070ff).setDisplaySize(size * 1.5, size * 1.35).setDepth(2.6).setAlpha(0.6) : null;
      if (swirl) this.tableObjs.push(swirl);
      const isLock = this.rules.lockHoles.includes(h.id);
      const lamp = this.lights.add(h.x, h.y, { r: black ? 70 : 40, color: black ? 0xa060ff : (isLock ? 0x7dff9a : 0xffb040), base: black ? 0.2 : 0.1, onLevel: 0.75 });
      return { ...h, swirl, lamp, isLock, cooldown: -1e9 };
    });
    this.kickers = (L.kickers || []).map((k, i) => {
      if (k.touch) W.addSensor(k.x, k.y, k.r || 16, 'kicker', i);
      const lamp = this.lights.add(k.x, k.y - 6, { r: 56, color: 0xffd27a, base: 0.08, decay: 500 });
      return { ...k, lamp, cooldown: -1e9 };
    });
  }

  /** Suaviza curvas (Catmull-Rom) onde a linha dobra pouco */
  smoothPolyline(pts) {
    if (pts.length < 3) return pts;
    const turn = i => {
      if (i <= 0 || i >= pts.length - 1) return 180;
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
      return d * 180 / Math.PI;
    };
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      if (turn(i) < 55 && turn(i + 1) < 55) {
        const Ln = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const lim = (q, o) => {
          const d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1, k = Math.min(1, Ln / d);
          return [o[0] + (q[0] - o[0]) * k, o[1] + (q[1] - o[1]) * k];
        };
        const p0 = lim(pts[i - 1], p1), p3 = lim(pts[i + 2], p2);
        for (let k = 1; k < 4; k++) {
          const t = k / 4, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      out.push(p2);
    }
    return out;
  }

  makeFlipper(F) {
    const P = UAI.PHYSICS.flipper;
    const len = F.len * this.diff.flipperScale * (F.upper ? 1 : 1);
    const f = this.world.addFlipper({
      px: F.x, py: F.y, side: F.side === 'L' ? 1 : -1, len,
      rb: F.upper ? P.baseRadius * 0.8 : P.baseRadius, rt: P.tipRadius,
      rest: Phaser.Math.DegToRad(P.restAngle), up: Phaser.Math.DegToRad(P.upAngle),
      omegaMax: this.diff.omega * this.mods.omega, accUp: P.accUp, omegaDown: P.omegaDown, accDown: P.accDown,
      e: P.e, fo: P.fo, mu: P.mu
    });
    let key = 'flipper', flip = false;
    if (F.side === 'R') { if (this.textures.exists('flipper2')) key = 'flipper2'; else flip = true; }
    if (this.flipKeys) { key = this.flipKeys[F.side === 'R' ? 1 : 0]; flip = false; }
    const src = this.textures.get(key).getSourceImage();
    const w = src.width, h = src.height;
    const k = len / Math.max(1, w - h);
    const ox = (h / 2) / w;
    const sprite = this.add.image(F.x, F.y, key).setDisplaySize(w * k, h * k).setDepth(7);
    const pivotOnRight = F.side === 'R' && !flip;
    sprite.setOrigin(pivotOnRight ? 1 - ox : ox, 0.5);
    const glow = this.add.image(F.x, F.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffb347).setDisplaySize(len * 1.3, len * 0.9).setDepth(6).setAlpha(0);
    this.tableObjs.push(glow);
    return { side: F.side, upper: !!F.upper, phys: f, sprite, glow, pivotOnRight, flip };
  }

  /* =========================================================
     BOLAS
     ========================================================= */
  spawnBall(x, y, vx = 0, vy = 0, state = 'play') {
    const R = UAI.PHYSICS.ball.radius;
    const b = this.world.addBall(x, y, vx, vy);
    const lamp = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf8a).setDisplaySize(260, 260).setAlpha(0.14).setDepth(2);
    const trail = [];
    for (let i = 0; i < 6; i++) trail.push(this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd9a0).setDepth(7.5).setAlpha(0));
    const spr = this.add.image(x, y, 'ball').setDisplaySize(R * 2 + 2, R * 2 + 2).setDepth(8);
    b.data = { state, spr, lamp, trail, trailPts: [], rot: 0, shots: {}, stuckRef: null, stuckT: 0, auto: false, skill: false, size: R * 2 + 2 };
    this.balls.push(b);
    return b;
  }

  removeBall(b) {
    const d = b.data;
    this.tweens.killTweensOf(d.spr);
    d.spr.destroy(); d.lamp.destroy(); d.trail.forEach(t => t.destroy());
    if (d.spark) { d.spark.forEach(s => s.destroy()); d.spark = null; }
    this.world.removeBall(b);
    this.balls = this.balls.filter(x => x !== b);
  }

  resetBallLook(b) {
    const d = b.data;
    this.tweens.killTweensOf(d.spr);
    d.spr.setAlpha(1).setAngle(0).setVisible(true).setDepth(8).setDisplaySize(d.size, d.size);
  }

  laneBall() { return this.balls.find(b => b.data.state === 'lane'); }
  activeBalls() { return this.balls.filter(b => b.data.state !== 'drain'); }

  /** Põe uma bola no lançador (auto = a máquina lança sozinha, na multibola) */
  addLaneBall(auto) {
    const [x, y] = this.layout.ballStart;
    const b = this.spawnBall(x, y, 0, 0, 'lane');
    b.data.auto = auto;
    if (auto) this.after(700, () => { if (b.data.state === 'lane') this.launch(b, 0.85 + Math.random() * 0.15, false); });
    return b;
  }

  /** Nova bola do jogador (início ou depois de perder uma) */
  newBall(first) {
    this.ballNo++;
    this.betweenBalls = false;
    this.bonus = 0; this.bonusX = 1;
    this.mult = 1; this.ballScore = 0;
    this.tilted = false; this.tiltLevel = 0;
    this.combo = 0;
    this.saveUntil = 0;
    this.lights.giTarget = 1;
    this.ambient.setAlpha(this.def.art ? 0.36 : 0.2);
    this.skillLamp = 4 + Math.floor(Math.random() * 4);
    if (first) (this.layout.outlanes || []).forEach(O => { if (O.kickback && O.kickback.litAtStart) this.kickbackLit[O.id] = true; });
    this.addLaneBall(false);
    this.lights.show(this.lights.list, 'random', 900);
    const n = this.ballNo;
    this.banner('BOLA ' + n, this.sys.game.device.input.touch ? 'Arraste p/ cima no canto direito' : 'Segure ↓ e solte na luz VERDE', '#ffe7b8');
    this.updateHUD();
  }

  /** Dispara a bola do lançador */
  launch(b, charge, byPlayer) {
    const P = UAI.PHYSICS.plunger;
    const power = (P.min + (P.max - P.min) * charge) * this.diff.plunger;
    b.vx = 0; b.vy = -power;
    b.data.launchedAt = this.now;
    if (byPlayer) UAI.Haptic.buzz(20 + Math.round(charge * 30));
    b.data.skill = byPlayer && Math.min(7, Math.floor(charge * 8)) === this.skillLamp;
    UAI.Sfx.launch(charge);
    this.lights.flashAll(this.meter, 0.9);
    this.lights.flashAll(this.rim, 0.4);
  }

  /* =========================================================
     LOOP PRINCIPAL
     ========================================================= */
  update(time, delta) {
    if (this.editorOn) { this.drawDebug(); this.lights.update(delta); return; }
    if (this.paused) return;
    if (this.plunger.charging && this.plunger.mode === 'key') {
      this.plunger.charge = Math.min(1, (performance.now() - this.plunger.startT) / UAI.PHYSICS.plunger.chargeTime);
    }
    const dt = Math.min(delta, 50);
    this.world.update(dt / 1000);
    this.logic(dt);
    this.syncVisuals(dt);
    this.updateLights(dt, time);
    this.stepDecorAnim(dt, time);
    if (this.debugOn) this.drawDebug();
  }

  /** Regras que andam com o tempo (chamada a cada quadro, ou pelos testes) */
  logic(dt) {
    this.now += dt;
    this.runTimers();
    this.balls.slice().forEach(b => {
      if (b.data.state === 'ramp') this.stepRamp(b, dt);
      if (b.data.tunnel) this.stepTunnel(b, dt);
    });
    // lançamento automático das bolas da multibola, uma por vez
    if (this.autoQueue > 0 && this.now >= this.nextAutoAt && !this.laneBall() && !this.over) {
      this.autoQueue--; this.nextAutoAt = this.now + 1400;
      this.addLaneBall(true);
    }
    this.checkBalls(dt);
    if (this.tiltLevel > 0) this.tiltLevel = Math.max(0, this.tiltLevel - dt / 3500);
    if (this.bumperLevel > 0 && this.now - this.bumperUpAt > 60000) { this.bumperLevel--; this.bumperUpAt = this.now; this.updateHUD(); }
    // alvos que caem voltam a subir
    this.dropBanks.forEach(B => { if (B.resetAt && this.now >= B.resetAt) this.resetDropBank(B); });
    this.spinners.forEach(S => { S.rate *= Math.pow(0.1, dt / 1000); });
    this.party = Math.max(0, this.party - dt);
    if (this.over && this.overAt && this.now - this.overAt > 7000) this.gameOver();
  }

  checkBalls(dt) {
    const L = this.layout, pl = L.plungerLane || { x0: 800, x1: 840, top: 320 };
    for (const b of this.balls.slice()) {
      const d = b.data;
      if (d.state === 'lane') {
        // passou pelo portão do lançador → em jogo
        if (b.y < pl.top - 30 || b.x < pl.x0 - 24) {
          d.state = 'play';
          if (!d.auto && this.diff.ballSave > 0 && !this.multiball && this.saveUntil < this.now) {
            this.saveUntil = this.now + this.diff.ballSave * this.mods.ballSave;
          }
          if (d.skill) { d.skill = false; this.skillShot(b); }
        } else if (b.y > L.ballStart[1] + 40) {
          this.world.placeBall(b, L.ballStart[0], L.ballStart[1], 0, 0);   // segurança
        }
      }
      if (d.state === 'play' || d.state === 'lane') {
        const out = b.x < -40 || b.x > this.W + 40 || b.y < -60;
        if (b.y > (L.drainY || 1185) || out) {
          if (out) console.warn('[Uai Ball] bola saiu da mesa em', Math.round(b.x), Math.round(b.y));
          this.ballDrained(b, out);
          continue;
        }
        this.checkStuck(b, dt);
      }
    }
  }

  /** bola parada no mesmo lugar por 3 s → sacudida automática */
  checkStuck(b, dt) {
    const d = b.data;
    if (d.state === 'lane' && Math.hypot(b.x - this.layout.ballStart[0], b.y - this.layout.ballStart[1]) < 30) { d.stuckRef = null; return; }
    if (!d.stuckRef || Math.hypot(b.x - d.stuckRef.x, b.y - d.stuckRef.y) > 18) {
      d.stuckRef = { x: b.x, y: b.y }; d.stuckT = 0; return;
    }
    if (this.flippers.some(f => f.phys.pressed) && b.y > 900) return;   // jogador segurando a bola na palheta
    d.stuckT += dt;
    if (d.stuckT > 3000) {
      d.stuckT = 0; d.stuckRef = null;
      b.vx += Phaser.Math.Between(-260, 260); b.vy -= 700;
      this.cameras.main.shake(180, 0.006);
      this.banner('SACUDIDA!', '', '#ffe7b8', 700);
    }
  }

  /* ---------- a bola caiu ---------- */
  ballDrained(b, escaped) {
    if (this.over) return;
    const others = this.activeBalls().filter(x => x !== b);
    b.data.state = 'drain';
    this.removeBall(b);
    if (escaped) { this.autoQueue++; return; }                         // erro de física: devolve sem castigo

    if (others.length > 0 || this.autoQueue > 0) {
      // multibola: só perde vida quando sobrar uma bola
      if (this.now < this.saveUntil && !this.tilted) { this.autoQueue++; this.banner('BOLA SALVA!', '', '#7dff9a', 800); return; }
      UAI.Sfx.drain();
      if (this.multiball && others.length + this.autoQueue <= 1) this.endMultiball();
      return;
    }
    // última bola em jogo
    if (this.now < this.saveUntil && !this.tilted) {
      this.banner('BOLA SALVA!', 'Tenta de novo, sô', '#7dff9a');
      UAI.Sfx.bonus();
      this.saveUntil = 0;
      this.after(700, () => this.addLaneBall(false));
      return;
    }
    if (this.multiball) this.endMultiball();
    this.loseBall();
  }

  loseBall() {
    this.lives--;
    UAI.Haptic.buzz([70, 50, 120]);
    this.betweenBalls = true;
    UAI.Sfx.drain();
    this.lights.show(this.lights.list.slice().sort((a, b) => b.y - a.y), 'off', 900);
    this.lights.giTarget = 0.08;
    this.ambient.setAlpha(0.55);
    if (this.drainLamp) this.drainLamp.flash = 1.3;
    this.cameras.main.shake(250, 0.008);
    this.flippers.forEach(f => (f.phys.pressed = false));
    this.touchMap = {};
    this.updateHUD();
    // bônus de fim de bola
    const total = this.tilted ? 0 : this.bonus * this.bonusX;
    if (total > 0) {
      this.banner('BÔNUS ' + UAI.fmt(total), UAI.fmt(this.bonus) + ' × ' + this.bonusX, '#ffd27a', 1500);
      this.after(900, () => { this.score += total; this.updateHUD(); UAI.Sfx.bonus(); });
    }
    const wait = total > 0 ? 2300 : 1300;
    if (this.lives > 0) {
      this.after(total > 0 ? 1700 : 0, () => this.banner('BOLA PERDIDA', 'Sobrou ' + this.lives + (this.lives > 1 ? ' bolas' : ' bola'), '#ff9a6a'));
      this.after(wait + 900, () => { if (!this.over) this.newBall(false); });
    } else {
      this.over = true;
      this.overAt = this.now;
      this.after(total > 0 ? 1700 : 200, () => { this.banner('FIM DE JOGO', '', '#ff9a6a', 2000); UAI.Sfx.gameover(); });
      this.after(wait + 1400, () => this.gameOver());
    }
  }

  gameOver() {
    if (this._ended) return;
    this._ended = true;
    if (this.pauseUI) { this.pauseUI.destroy(); this.pauseUI = null; }
    this.scene.start('GameOver', {
      table: this.def.id, score: this.score, difficulty: this.diffKey, daily: this.isDaily,
      stats: this.stats, missionsDone: this.missionsDone, mastered: this.mastered
    });
  }

  /* =========================================================
     VISUAIS
     ========================================================= */
  syncVisuals(dt) {
    for (const b of this.balls) {
      const d = b.data;
      d.rot += (b.vx * dt / 1000) / b.r;
      d.spr.setPosition(b.x, b.y).setRotation(d.rot);
      d.lamp.setPosition(b.x, b.y);
      d.trailPts.unshift({ x: b.x, y: b.y });
      if (d.trailPts.length > 12) d.trailPts.length = 12;
      const k = Phaser.Math.Clamp((Math.hypot(b.vx, b.vy) - 500) / 1500, 0, 1);
      const hide = d.state === 'hole' || d.state === 'ramp' || d.tunnel;
      d.trail.forEach((img, i) => {
        const q = d.trailPts[i * 2 + 1];
        if (!q || hide) { img.setAlpha(0); return; }
        const s = 32 - i * 3;
        img.setPosition(q.x, q.y).setDisplaySize(s, s).setAlpha(k * 0.5 * (1 - i / d.trail.length));
      });
    }
    this.flippers.forEach(f => {
      const a = this.world.flipperAngle(f.phys);
      f.sprite.setRotation(f.pivotOnRight ? a - Math.PI : a);
    });
    // mola
    const g = this.plungerGfx, [bx, by] = this.layout.ballStart;
    g.clear();
    const top = by + UAI.PHYSICS.ball.radius + 2 + this.plunger.charge * 22;
    g.fillStyle(0xc9973f, 1).fillRect(bx - 12, top, 24, 8);
    g.fillStyle(0x8a6a33, 1).fillRect(bx - 4, top + 8, 8, 30);
    // spinners girando
    const sg = this.spinGfx; sg.clear();
    this.spinners.forEach(S => {
      S.phase += S.rate * dt / 1000 * Math.PI * 2;
      const h = Math.abs(Math.cos(S.phase)) * 10 + 2;
      const c = Math.cos(S.angle || 0), s = Math.sin(S.angle || 0);
      sg.fillStyle(0x2a1406, 1).fillCircle(S.x - c * S.w / 2, S.y - s * S.w / 2, 5).fillCircle(S.x + c * S.w / 2, S.y + s * S.w / 2, 5);
      sg.lineStyle(h, 0xd9d9d9, 0.95);
      sg.lineBetween(S.x - c * S.w / 2, S.y - s * S.w / 2, S.x + c * S.w / 2, S.y + s * S.w / 2);
      sg.lineStyle(2, 0x4a4a4a, 1);
      sg.lineBetween(S.x - c * S.w / 2, S.y - s * S.w / 2, S.x + c * S.w / 2, S.y + s * S.w / 2);
    });
  }

  /** desenha alvos que caem e alvos fixos (muda só quando acertam) */
  redrawDyn() {
    const g = this.dynGfx; g.clear();
    const MM = { accent: '#e8a040', gold: '#ffe066' };
    const ACC = parseInt(MM.accent.slice(1), 16), GLD = parseInt(MM.gold.slice(1), 16);
    (this.dynTexts || []).forEach(t => t.destroy());
    this.dynTexts = [];
    const txt = (x, y, s, col) => this.dynTexts.push(this.add.text(x, y, s, {
      fontFamily: UAI.UI.FONT_TITLE, fontSize: '15px', color: col, stroke: '#1a0b04', strokeThickness: 4
    }).setOrigin(0.5).setDepth(4.9));
    this.dropBanks.forEach(B => B.targets.forEach((T, i) => {
      const [x0, y0, x1, y1] = T.pts, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (T.down) { g.lineStyle(4, 0x1a0b04, 0.8).lineBetween(x0, y0, x1, y1); return; }
      g.lineStyle(14, 0x1a0b04, 0.6).lineBetween(x0 + 4, y0 + 6, x1 + 4, y1 + 6);
      g.lineStyle(11, ACC, 1).lineBetween(x0, y0, x1, y1);
      g.lineStyle(3, 0xfff0c0, 0.7).lineBetween(x0, y0 - 3, x1, y1 - 3);
      if (B.letters[i]) txt(mx, my - 16, B.letters[i], '#ffe7b8');
    }));
    this.targetGroups.forEach(G => G.targets.forEach((T, i) => {
      const [[x0, y0], [x1, y1]] = T.pts, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      g.lineStyle(14, 0x1a0b04, 0.6).lineBetween(x0 + 3, y0 + 5, x1 + 3, y1 + 5);
      g.lineStyle(11, T.lit ? GLD : ACC, 1).lineBetween(x0, y0, x1, y1);
      if (G.letters[i]) txt(mx - (x0 === x1 ? 20 : 0), my - (x0 === x1 ? 0 : 18), G.letters[i], T.lit ? '#fff2c8' : '#f3e6c8');
    }));
  }

  /* =========================================================
     LUZES
     ========================================================= */
  buildLights() {
    const L = this.layout, LT = L.lights || {};
    this.rim = [];
    const outerW = L.walls.find(w => w.id === 'externa') || L.walls[0];
    const outer = outerW.pts;
    let carry = 0;
    for (let i = 0; i < outer.length - 1; i++) {
      const [x1, y1] = outer[i], [x2, y2] = outer[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = carry; d < len; d += 46) {
        const t = d / len;
        if (y1 + (y2 - y1) * t > 1120) continue;
        this.rim.push(this.lights.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
          { r: 24, color: this.rim.length % 3 === 2 ? 0xff5a2a : 0xffc060, base: 0.14, core: false }));
      }
      carry = Math.max(0, 46 - (len % 46));
    }
    const ins = (this.def.theme && this.def.theme.insert) ? parseInt(this.def.theme.insert.slice(1), 16) : 0xff8a1f;
    this.shotLamps = {};
    Object.entries(LT.shots || {}).forEach(([id, arr]) => {
      this.shotLamps[id] = arr.map(([x, y]) => this.lights.add(x, y, { r: 30, color: ins, base: 0.1, onLevel: 0.85 }));
    });
    this.grid = (LT.grid || []).map(([x, y]) => this.lights.add(x, y, { r: 50, color: 0xffc861, base: 0.14, onLevel: 0.8 }));
    this.extraLamps = (LT.extra || []).map(([x, y]) => this.lights.add(x, y, { r: 60, color: 0xffa24a, base: 0.18 }));
    const hub = this.bumpers.find(b => b.kind === 'shock');
    this.sparks = hub ? [0, 1, 2, 3, 4, 5, 6, 7].map(k => this.lights.add(
      hub.x + Math.cos(k * Math.PI / 4) * 52, hub.y + Math.sin(k * Math.PI / 4) * 44,
      { r: 26, color: 0x9fe8ff, base: 0.0, decay: 300 })) : [];
    this.drainLamp = LT.drain ? this.lights.add(LT.drain[0], LT.drain[1], { r: 70, color: 0xff3a1a, base: 0.05, decay: 900 }) : null;
    this.saveLamp = LT.drain ? this.lights.add(LT.drain[0], LT.drain[1] - 34, { r: 46, color: 0x7dff9a, base: 0, onLevel: 0.85 }) : null;
    this.kbLamps = (L.outlanes || []).filter(O => O.kickback).map(O => ({
      id: O.id, lamp: this.lights.add(O.kickback.x, O.kickback.y - 34, { r: 40, color: 0x7dff9a, base: 0.05, onLevel: 0.9 })
    }));
    const [bx, by] = L.ballStart;
    this.meter = [];
    for (let i = 0; i < 8; i++) this.meter.push(this.lights.add(bx, by - 40 - i * 34, { r: 20, color: 0xffd27a, base: 0.03 }));
  }

  updateLights(dt, t) {
    const lanePhase = !!this.laneBall();
    const mb = this.multiball;
    this.rim.forEach((L, i) => {
      if (this.party > 0 || mb) L.extra = ((Math.floor(t / (mb ? 70 : 90)) + i) % 2) ? 0.85 : 0.1;
      else {
        const ph = ((i - t * (lanePhase ? 0.02 : 0.009)) % 9 + 9) % 9;
        L.extra = ph < 2 ? 0.8 : 0;
      }
    });
    const m = this.mission();
    Object.entries(this.shotLamps).forEach(([id, lamps]) => {
      const sh = this.shotById(id);
      const jackpot = mb && sh && sh.jackpot;
      const missionHot = m && m.type === 'shot' && m.id === id;
      lamps.forEach((L, i) => {
        L.on = false;
        if (jackpot) L.extra = ((Math.floor(t / 110) + i) % 2) ? 0.95 : 0.15;
        else if (missionHot) L.extra = ((Math.floor(t / 260) + i) % lamps.length === 0) ? 0.85 : 0.15;
      });
    });
    this.grid.forEach((L, i) => {
      L.on = i < this.mult - 1;
      if (i === this.mult - 1) L.extra = 0.15 + 0.15 * Math.sin(t / 220);
      if (this.party > 0) L.extra += ((Math.floor(t / 120) + i) % 2) * 0.5;
    });
    this.laneGroups.forEach((G, gi) => G.lamps.forEach((L, i) => {
      L.on = G.lit[i];
      if (!L.on) L.extra = 0.1 + 0.1 * Math.sin(t / 300 + i + gi);
      G.letters[i].setAlpha(G.lit[i] ? 1 : 0.5).setColor(G.lit[i] ? '#9ff0ff' : '#ffe7b8');
    }));
    this.targetGroups.forEach(G => G.targets.forEach(T => { T.lamp.on = T.lit; }));
    this.dropBanks.forEach(B => B.targets.forEach(T => { T.lamp.extra = T.down ? 0 : 0.08 + 0.08 * Math.sin(t / 400); }));
    this.extraLamps.forEach((L, i) => { L.extra = 0.2 + 0.18 * Math.sin(t / 700 + i * 2); });
    this.meter.forEach((L, i) => {
      const skill = i === this.skillLamp;
      this.lights.setColor(L, skill ? 0x6dff7a : (i < 5 ? 0xffd27a : 0xff4a1a));
      if (this.plunger.charging) L.on = i <= Math.min(7, Math.floor(this.plunger.charge * 8));
      else { L.on = false; if (lanePhase) L.extra = skill ? 0.6 + 0.3 * Math.sin(t / 120) : (((Math.floor(t / 110) % 10) === i) ? 0.6 : 0); }
    });
    if (this.saveLamp) {
      const left = this.saveUntil - this.now;
      this.saveLamp.on = left > 0 && (left > 2000 || Math.floor(t / 150) % 2 === 0);
    }
    this.kbLamps.forEach(K => { K.lamp.on = !!this.kickbackLit[K.id]; });
    this.bumpers.forEach(B => {
      B.flash = Math.max(0, B.flash - dt / 260);
      B.halo.setAlpha((0.22 + 0.08 * Math.sin(t / 420 + B.phase) + B.flash * 0.8) * this.lights.gi);
      B.cap.setAlpha(B.flash * 0.9 * this.lights.gi);
      B.spinBoost = Math.max(0, (B.spinBoost || 0) - dt * 0.00002);
      if (B.spr && B.kind === 'wheel') B.spr.rotation += B.spin * dt * (0.00025 + B.flash * 0.004 + (B.spinBoost || 0));
      if (B.spr && B.kind !== 'wheel') {
        const lit = this.now < (B.litUntil || 0), key = this.parts.keys[this.bumperLevel][lit ? 1 : 0];
        if (B.spr.texture.key !== key) B.spr.setTexture(key);
      }
    });
    this.flippers.forEach(f => {
      const target = f.phys.pressed ? 0.55 : 0;
      f.glow.setAlpha(f.glow.alpha + (target - f.glow.alpha) * Math.min(1, dt / 60));
    });
    const lockHot = !this.multiball && (!this.lockNeedsLit || this.lockLit > 0);
    this.holes.forEach((H, i) => {
      if (H.type === 'blackhole') {
        if (H.swirl) H.swirl.rotation -= dt * 0.004;
        H.lamp.extra = 0.25 + 0.2 * Math.sin(t / 380);
        const hot = m && m.type === 'hole' && m.id === H.id;
        if (hot) H.lamp.extra += (Math.floor(t / 200) % 2) * 0.5;
      } else {
        const hot = (H.isLock && (lockHot || mb)) || (m && m.type === 'hole' && m.id === H.id);
        H.lamp.on = false;
        H.lamp.extra = hot ? ((Math.floor(t / 180) + i) % 2 ? 0.85 : 0.2) : 0.08 + 0.08 * Math.sin(t / 260 + i * 2);
      }
    });
    this.kickers.forEach(K => { K.lamp.extra = 0.1 + 0.08 * Math.sin(t / 500); });
    if (this.tilted) this.lights.giTarget = 0.12;
    this.lights.update(dt);
  }

  /* =========================================================
     HUD
     ========================================================= */
  createHUD() {
    const UI = UAI.UI, W = this.W, H = this.H, OFF = UAI.view.OFF;
    const T = OFF >= 104 ? -104 : 0;                       // placar acima da mesa quando a tela é comprida
    const BY = OFF >= 64 ? H + 34 : H - 27;                // barra de missão abaixo da mesa
    if (OFF > 0) {                                          // gabinete de madeira nas sobras
      if (!this.textures.exists('cabwood')) UAI.Tex.add(this, 'cabwood', UAI.TableArt.woodCanvas(256, 256, '#1a0d06', '#4a2a14', 77, 1, 0.8));
      this.add.tileSprite(W / 2, -OFF / 2, W, OFF, 'cabwood').setDepth(19);
      this.add.tileSprite(W / 2, H + OFF / 2, W, OFF, 'cabwood').setDepth(19);
      const sh = this.add.graphics().setDepth(19.5);
      sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.7, 0.7).fillRect(0, -18, W, 18);
      sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0, 0).fillRect(0, H, W, 18);
      sh.lineStyle(3, 0xc9973f, 1).lineBetween(0, -2, W, -2).lineBetween(0, H + 2, W, H + 2);
      // sobra de cima: logo e nome da mesa; sobra de baixo: onde tocar
      const freeTop = OFF - 104;
      if (freeTop > 90) {
        const lg = this.add.image(W / 2, -OFF + freeTop / 2, 'logo').setDepth(20);
        lg.setScale(Math.min(freeTop * 0.9 / lg.height, 260 / lg.width));
        this.add.image(W / 2, -OFF + freeTop / 2, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff9a30).setDisplaySize(420, freeTop * 1.4).setAlpha(0.25).setDepth(19.8);
      }
      const freeBot = OFF - 70;
      if (freeBot > 60) {
        const y = H + 70 + freeBot / 2, st = { fontFamily: UI.FONT_TITLE, fontSize: '30px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 6 };
        this.add.text(W * 0.25, y, '◀ PALHETA', st).setOrigin(0.5).setDepth(20).setAlpha(0.75);
        this.add.text(W * 0.75, y, 'PALHETA ▶', st).setOrigin(0.5).setDepth(20).setAlpha(0.75);
        const mid = this.add.graphics().setDepth(20); mid.lineStyle(2, 0xc9973f, 0.5).lineBetween(W / 2, H + 80, W / 2, H + OFF - 10);
      }
    }
    const g = this.add.graphics().setDepth(20);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.78, 0.78, 0, 0);
    g.fillRect(0, T, W, 96);
    this.add.text(30, T + 8, 'PONTOS', { fontFamily: UI.FONT_NUM, fontSize: '14px', color: '#d8b98a' }).setDepth(21);
    this.scoreTxt = this.add.text(28, T + 22, '0', {
      fontFamily: UI.FONT_NUM, fontSize: '34px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 6
    }).setDepth(21).setShadow(0, 0, '#ff9a30', 12, false, true);
    this.multTxt = this.add.text(W / 2, T + 32, 'x1', {
      fontFamily: UI.FONT_NUM, fontSize: '36px', color: '#fff0c8', stroke: '#2a1406', strokeThickness: 6
    }).setOrigin(0.5).setDepth(21).setShadow(0, 0, '#ffb040', 14, false, true);
    this.statusTxt = this.add.text(W / 2, T + 70, '', {
      fontFamily: UI.FONT_NUM, fontSize: '15px', color: '#f3dfb4', stroke: '#2a1406', strokeThickness: 4
    }).setOrigin(0.5).setDepth(21);
    this.add.text(W - 104, T + 8, 'RECORDE DA MESA', { fontFamily: UI.FONT_NUM, fontSize: '12px', color: '#d8b98a' }).setOrigin(1, 0).setDepth(21);
    this.highTxt = this.add.text(W - 104, T + 24, UAI.fmt(this.high), {
      fontFamily: UI.FONT_NUM, fontSize: '24px', color: '#e8c48a', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(1, 0).setDepth(21);
    const pb = this.add.circle(W - 50, T + 40, 28, 0x4a250e).setStrokeStyle(3, 0xc9973f).setDepth(21).setInteractive({ useHandCursor: true });
    this.add.text(W - 50, T + 40, 'II', { fontFamily: UI.FONT_NUM, fontSize: '24px', color: '#ffe7b8' }).setOrigin(0.5).setDepth(22);
    pb.on('pointerup', () => this.togglePause());

    // missão (embaixo, sobre o avental)
    const mg = this.add.graphics().setDepth(20);
    mg.fillStyle(0x000000, 0.55).fillRoundedRect(130, BY - 19, W - 260, 38, 12);
    this.missionTxt = this.add.text(W / 2, BY, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffe7b8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21);
    this.livesIcons = [];
    for (let i = 0; i < 5; i++) this.livesIcons.push(this.add.image(30 + i * 24, BY, 'ball').setDisplaySize(20, 20).setDepth(21));
    this.add.text(W - 22, BY, this.diff.label, {
      fontFamily: UI.FONT_TITLE, fontSize: '18px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 4
    }).setOrigin(1, 0.5).setDepth(21);

    this.bannerTxt = this.add.text(W / 2, 600, '', {
      fontFamily: UI.FONT_TITLE, fontSize: '56px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 9, align: 'center'
    }).setOrigin(0.5).setDepth(30).setAlpha(0).setShadow(0, 0, '#ff8a20', 24, false, true);
    this.bannerSub = this.add.text(W / 2, 660, '', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 5, align: 'center'
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.editorTxt = this.add.text(12, H - 120,
      'EDITOR · arraste os pontos · N add ponto · X apaga ponto · +/- raio do bumper\nC copia JSON · R volta ao padrão · E sai (salva automático)', {
      fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', backgroundColor: '#000000cc', padding: { x: 8, y: 6 }
    }).setDepth(61).setVisible(false);

    // nome da mesa aparece no começo
    const nm = this.add.text(W / 2, 470, this.def.name.toUpperCase(), {
      fontFamily: UI.FONT_TITLE, fontSize: '64px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 10
    }).setOrigin(0.5).setDepth(31).setShadow(0, 0, '#ff8a20', 24, false, true);
    this.tweens.add({ targets: nm, alpha: 0, y: 430, delay: 1400, duration: 700, onComplete: () => nm.destroy() });
    this.updateHUD();
  }

  updateHUD() {
    if (!this.scoreTxt) return;
    this.scoreTxt.setText(UAI.fmt(this.score));
    this.multTxt.setText('x' + this.mult);
    if (this.score > this.high) this.highTxt.setText(UAI.fmt(this.score)).setColor('#fff0c8');
    const lives = Math.max(0, this.lives - (this.betweenBalls ? 0 : 1));
    this.livesIcons.forEach((ic, i) => ic.setVisible(i < lives));
    const needed = this.rules.locksNeeded;
    const parts = ['BOLA ' + this.ballNo];
    if (this.bonusX > 1) parts.push('BÔNUS ' + this.bonusX + 'x');
    if (this.bumperLevel > 0) parts.push('BUMPERS N' + (this.bumperLevel + 1));
    if (this.multiball) parts.push('MULTIBOLA · JACKPOT ' + UAI.fmt(this.jackpotValue));
    else if (this.rules.lockHoles.length) parts.push('TRAVAS ' + this.locks + '/' + needed + (this.lockNeedsLit ? (this.lockLit > 0 ? ' ●' : ' ○') : ''));
    this.statusTxt.setText(parts.join('  ·  '));
    const m = this.mission();
    if (m) {
      const n = m.n * this.missionRound;
      const prog = n > 1 ? '  (' + Math.min(this.missionProg, n) + '/' + n + ')' : '';
      this.missionTxt.setText('★ ' + m.text.replace(/\b(\d+)\b/, (s, k) => this.missionRound > 1 ? String(+k * this.missionRound) : s) + prog);
    } else this.missionTxt.setText('');
  }

  banner(text, sub = '', color = '#ffe7b8', hold = 1300) {
    this.tweens.killTweensOf([this.bannerTxt, this.bannerSub]);
    this.bannerTxt.setText(text).setColor(color).setAlpha(0).setScale(0.6);
    this.bannerSub.setText(sub).setAlpha(0);
    this.tweens.add({ targets: this.bannerTxt, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 220 });
    this.tweens.add({ targets: [this.bannerTxt, this.bannerSub], alpha: 0, delay: hold, duration: 400 });
  }

  popup(x, y, txt, color = '#ffe9b0') {
    const t = this.add.text(x, y, txt, {
      fontFamily: UAI.UI.FONT_NUM, fontSize: '24px', color, stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5).setDepth(25).setShadow(0, 0, '#ff9a30', 10, false, true);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 750, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  /* =========================================================
     ENTRADAS (teclado + toque)
     ========================================================= */
  createInput() {
    const kb = this.input.keyboard;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    this.input.addPointer(3);
    this.touchMap = {};

    kb.on('keydown', ev => {
      if (ev.repeat) return;
      switch (ev.code) {
        case 'ArrowLeft': case 'KeyA': case 'ShiftLeft': this.setFlipper('L', true); break;
        case 'ArrowRight': case 'KeyD': case 'ShiftRight': this.setFlipper('R', true); break;
        case 'ArrowDown': case 'Space': case 'KeyS': case 'Enter': this.startCharge('key'); break;
        case 'ArrowUp': case 'KeyW': this.nudge(); break;
        case 'KeyP': case 'Escape': this.togglePause(); break;
        case 'KeyG': this.debugOn = !this.debugOn; if (!this.debugOn) this.debugGfx.clear(); break;
        case 'KeyE': this.toggleEditor(); break;
        default: if (this.editorOn) this.editorKey(ev);
      }
    });
    kb.on('keyup', ev => {
      switch (ev.code) {
        case 'ArrowLeft': case 'KeyA': case 'ShiftLeft': this.setFlipper('L', false); break;
        case 'ArrowRight': case 'KeyD': case 'ShiftRight': this.setFlipper('R', false); break;
        case 'ArrowDown': case 'Space': case 'KeyS': case 'Enter': if (this.plunger.mode === 'key') this.fire(); break;
      }
    });

    this.input.on('pointerdown', (p, over) => {
      if (this.editorOn || this.paused) return;
      if (over && over.length) return;
      const x = p.worldX, y = p.worldY;
      if (this.laneBall() && x > this.W * 0.7 && y > this.H * 0.55) {
        this.plunger.pointerId = p.id; this.plunger.startY = y;
        this.startCharge('touch');
        return;
      }
      if (y < 110 && y > -UAI.view.OFF) { this.nudge(); return; }        // toque no alto da tela = sacudir
      const side = x < this.W / 2 ? 'L' : 'R';
      this.touchMap[p.id] = side;
      this.setFlipper(side, true);
    });
    this.input.on('pointermove', p => {
      if (this.plunger.mode === 'touch' && p.id === this.plunger.pointerId) {
        this.plunger.charge = Phaser.Math.Clamp((this.plunger.startY - p.worldY) / UAI.PHYSICS.plunger.dragDistance, 0, 1);
      }
    });
    const up = p => {
      if (this.plunger.mode === 'touch' && p.id === this.plunger.pointerId) { this.fire(); return; }
      const side = this.touchMap[p.id];
      if (!side) return;
      delete this.touchMap[p.id];
      if (!Object.values(this.touchMap).includes(side)) this.setFlipper(side, false);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);

    this.game.events.on('blur', this.onBlur, this);
    this.game.events.on('hidden', this.onBlur, this);
    this.events.once('shutdown', () => {
      this.game.events.off('blur', this.onBlur, this);
      this.game.events.off('hidden', this.onBlur, this);
      const modal = document.getElementById('nameModal');
      if (modal) modal.classList.add('hidden');
    });
  }

  /** primeira vez no celular: mostra onde tocar */
  showTouchHelp() {
    const W = this.W, H = this.H, UI = UAI.UI;
    this.paused = true; this.helpOpen = true;
    const c = this.add.container(0, 0).setDepth(90);
    c.add(this.add.rectangle(W / 2, H / 2, W, UAI.view.H, 0x000000, 0.72).setInteractive());
    const zone = (x, y, w, h, color, title, sub) => {
      const g = this.add.graphics(); g.fillStyle(color, 0.22).fillRoundedRect(x, y, w, h, 24); g.lineStyle(4, color, 0.9).strokeRoundedRect(x, y, w, h, 24);
      c.add(g);
      c.add(this.add.text(x + w / 2, y + h / 2 - 22, title, { fontFamily: UI.FONT_TITLE, fontSize: '40px', color: '#ffffff', stroke: '#000', strokeThickness: 7, align: 'center' }).setOrigin(0.5));
      c.add(this.add.text(x + w / 2, y + h / 2 + 30, sub, { fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe7b8', stroke: '#000', strokeThickness: 5, align: 'center', wordWrap: { width: w - 30 } }).setOrigin(0.5));
    };
    zone(20, 140, W - 40, 150, 0xffd27a, 'SACUDIR', 'toque aqui em cima (sem exagero: dá TILT!)');
    zone(20, 640, W / 2 - 30, 420, 0x7dff9a, 'PALHETA\nESQUERDA', 'toque e segure');
    zone(W / 2 + 10, 640, W / 2 - 30, 300, 0x9fe8ff, 'PALHETA\nDIREITA', 'toque e segure');
    zone(W * 0.62, 950, W * 0.38 - 20, 200, 0xff9a6a, 'MOLA', 'arraste para cima e solte\nna luz verde = tacada de mestre');
    c.add(this.add.text(W / 2, 470, 'COMO JOGAR', { fontFamily: UI.FONT_TITLE, fontSize: '62px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 9 }).setOrigin(0.5));
    const tap = this.add.text(W / 2, 560, 'toque para começar', { fontFamily: 'Georgia, serif', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
    c.add(tap);
    this.tweens.add({ targets: tap, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    const opened = Date.now();
    const close = () => {
      if (Date.now() - opened < 500) return;           // ignora toque acidental logo ao abrir
      c.list[0].off('pointerup', close);
      UAI.Store.set('touchHelp', true); c.destroy(); this.helpOpen = false; this.paused = false; this.world.acc = 0; this.touchMap = {};
    };
    c.list[0].on('pointerup', close);
  }

  onBlur() { if (!this.paused && !this.over) this.togglePause(); }

  setFlipper(side, on) {
    const list = this.flippers.filter(f => f.side === side);
    if (!list.length) return;
    if (on && (this.tilted || this.betweenBalls)) on = false;
    if (list[0].phys.pressed === on) return;
    list.forEach(f => (f.phys.pressed = on));
    if (on && !this.paused) {
      UAI.Sfx.flipper();
      UAI.Haptic.buzz(8);
      this.rotateLanes(side);
    }
  }

  /** Sacudir a mesa (↑ / W / toque no alto). Sacudir demais = TILT */
  nudge() {
    if (this.paused || this.tilted || !this.balls.some(b => b.data.state === 'play')) return;
    if (this.now - this.lastNudge < 700) return;
    this.lastNudge = this.now;
    this.balls.forEach(b => { if (b.data.state === 'play') { b.vx += Phaser.Math.Between(-140, 140); b.vy -= 280; } });
    this.cameras.main.shake(120, 0.006);
    this.tiltLevel += 1;
    if (this.tiltLevel >= 3) this.tilt();
    else if (this.tiltLevel >= 2) { this.banner('CUIDADO!', 'Sacode mais e dá TILT', '#ff9a6a', 800); UAI.Sfx.shock(); }
  }

  tilt() {
    this.tilted = true;
    UAI.Haptic.buzz(350);
    this.stats.tilts++;
    this.flippers.forEach(f => (f.phys.pressed = false));
    this.banner('TILT', 'Sacudiu demais, sô! Bola perdida', '#ff5a3a', 2000);
    UAI.Sfx.gameover();
    this.saveUntil = 0;
  }

  startCharge(mode) {
    if (this.paused || this.editorOn || !this.laneBall()) return;
    this.plunger.charging = true; this.plunger.mode = mode; this.plunger.charge = 0;
    this.plunger.startT = performance.now();
  }

  fire() {
    const pl = this.plunger, charge = pl.charge;
    pl.charging = false; pl.mode = null; pl.pointerId = null; pl.charge = 0;
    const b = this.laneBall();
    if (!b || b.data.auto) return;
    const [bx, by] = this.layout.ballStart;
    if (Math.abs(b.x - bx) > 30 || b.y < by - 60) return;
    this.launch(b, charge, true);
  }

  togglePause() {
    if (this.over || this.helpOpen) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.flippers.forEach(f => (f.phys.pressed = false));
      const W = this.W, H = this.H, UI = UAI.UI;
      const c = this.add.container(0, 0).setDepth(80);
      c.add(this.add.rectangle(W / 2, H / 2, W, UAI.view.H, 0x000000, 0.7).setInteractive());
      c.add(this.add.text(W / 2, 330, 'PAUSADO', {
        fontFamily: UI.FONT_TITLE, fontSize: '72px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 10
      }).setOrigin(0.5));
      const m = this.mission();
      c.add(this.add.text(W / 2, 420, this.def.name + (m ? '\nMissão: ' + m.text : ''), {
        fontFamily: 'Georgia, serif', fontSize: '24px', color: '#ffe7b8', align: 'center', wordWrap: { width: 700 }
      }).setOrigin(0.5));
      c.add(UI.button(this, W / 2, 540, 400, 90, 'CONTINUAR', () => this.togglePause(), { size: 40 }));
      c.add(UI.button(this, W / 2, 650, 400, 76, 'REINICIAR', () => this.scene.restart({ table: this.def.id, difficulty: this.diffKey }), { size: 30 }));
      c.add(UI.button(this, W / 2, 745, 400, 76, 'TROCAR DE MESA', () => this.scene.start('TableSelect'), { size: 30 }));
      c.add(UI.button(this, W / 2, 840, 400, 76, 'MENU', () => this.scene.start('Menu'), { size: 30 }));
      this.pauseUI = c;
    } else if (this.pauseUI) {
      this.pauseUI.destroy(); this.pauseUI = null;
      this.world.acc = 0;
    }
  }
}
