/* ============================================================
   GameScene – jogo: motor de física próprio (js/physics.js),
   pontuação, luzes, buracos, túnel, debug e editor
   ------------------------------------------------------------
   A física roda a 1000 passos por segundo (como o Visual Pinball X),
   independente do FPS da tela. Esta cena só:
   • monta a mesa no motor a partir do config.js
   • liga teclado/toque às palhetas e à mola
   • reage aos eventos (batidas, sensores) com pontos, luzes e sons
   ============================================================ */

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.diffKey = (data && data.difficulty) || UAI.Store.get('difficulty', 'medio');
    this.diff = UAI.DIFFICULTIES[this.diffKey] || UAI.DIFFICULTIES.medio;
    this.debugOn = /[?&]debug=1/.test(location.search);
    this.editorOn = false;
  }

  /* =========================================================
     CRIAÇÃO
     ========================================================= */
  create() {
    const C = UAI.CONFIG, P = UAI.PHYSICS;
    this.W = C.WIDTH; this.H = C.HEIGHT;

    // motor de física
    this.world = new UAI.PinballWorld({
      gravity: this.diff.gravity,
      maxSpeed: P.maxSpeed,
      rollDrag: P.rollDrag
    });
    this.world.ball.r = P.ball.radius;
    this.world.onHit = (c, imp, kicked) => this.onHit(c, imp, kicked);
    this.world.onSensor = S => this.onSensor(S);

    this.layout = UAI.Layout.load();

    // Estado do jogo
    this.score = 0;
    this.lives = C.LIVES;
    this.mult = 1;
    this.high = UAI.Store.getHigh();
    this.paused = false;
    this.ballState = 'lane';                  // lane | play | hole | drain | over
    this.plunger = { charging: false, charge: 0, mode: null, pointerId: null, startY: 0, startT: 0 };
    this.ramp = { entryAt: -1e9, apexAt: -1e9, revAt: -1e9 };
    this.orbit = { entryAt: -1e9 };
    this.rollLit = [false, false, false];
    this.stuckTime = 0;
    this.party = 0;
    this.lastWallSound = 0;
    this.saveUntil = 0;
    this.slingChain = 0; this.lastSlingAt = 0;

    // Camadas visuais
    this.add.image(this.W / 2, this.H / 2, 'mesa').setDisplaySize(this.W, this.H).setDepth(0);
    this.ambient = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.36).setDepth(1);
    this.lights = new UAI.LightRig(this);
    this.plungerGfx = this.add.graphics().setDepth(6);

    this.tableObjs = [];
    this.flippers = [];
    this.editorBound = false;
    this.buildTable();
    this.createBall();
    this.createHUD();
    this.createInput();

    this.debugGfx = this.add.graphics().setDepth(60);
    this.resetBall();
    if (/[?&]editor=1/.test(location.search)) this.toggleEditor();
  }

  /* =========================================================
     MESA → MOTOR DE FÍSICA + VISUAL
     ========================================================= */
  buildTable() {
    const P = UAI.PHYSICS, L = this.layout, W = this.world;

    // limpa a versão anterior (o editor reconstrói tudo)
    W.clear();
    W.flippers = [];
    this.tableObjs.forEach(o => o.destroy());
    this.tableObjs = [];
    this.flippers.forEach(f => f.sprite.destroy());
    this.flippers = [];
    this.lights.clear();

    // --- Paredes (curvas suavizadas) ---
    L.walls.forEach(w => W.addPolyline(this.smoothPolyline(w.pts), w.mat === 'rubber' ? P.rubber : P.wall, 'wall'));

    // --- Portões de mão única ---
    (L.gates || []).forEach(g => {
      const [a, b] = g.pts;
      W.addSegment(a[0], a[1], b[0], b[1], Object.assign({}, P.wall, { pass: g.pass }), 'gate');
    });

    // --- Blocos sólidos ---
    (L.blocks || []).forEach(b => W.addPolyline(b.pts, P.wall, 'wall', true));

    // --- Bumpers ---
    this.bumpers = L.bumpers.map((b, i) => {
      let phys = null;
      if (b.sensor) {
        phys = W.addSensor(b.x, b.y, b.r, 'wheel', i);
      } else if (b.target) {
        phys = W.addSensor(b.x, b.y, b.r + 4, 'target', i);  // alvo: a bola passa por cima e acende
      } else if (b.shock) {
        phys = W.addSensor(b.x, b.y, b.r, 'shock', i);    // a bola passa por cima e leva o choque
      } else {
        phys = W.addCircle(b.x, b.y, b.r, P.bumper, 'bumper');
        phys.data = i;
      }
      // visual: engrenagem achatada pela perspectiva da arte
      const disp = 2 * (b.vr || b.r / P.bumper.spriteRatio);
      const persp = P.bumper.perspective;
      const halo = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff9a30).setDisplaySize(disp * 1.6, disp * 1.6 * persp).setDepth(4).setAlpha(0.25);
      const holder = this.add.container(b.x, b.y).setDepth(5).setScale(1, persp);
      const spr = b.hidden ? null : this.add.image(0, 0, 'bumper').setDisplaySize(disp, disp);
      if (spr) holder.add(spr);
      if (b.hidden) halo.setVisible(false);
      const cap = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfff0c8).setDisplaySize(disp * 0.9, disp * 0.9 * persp).setDepth(6).setAlpha(0);
      this.tableObjs.push(halo, holder, cap);
      return { ...b, phys, spr, holder, persp, halo, cap, flash: 0, last: 0, phase: i * 1.7, spin: (i % 2 ? -1 : 1) };
    });

    // --- Estilingues: face que chuta + lados de borracha ---
    this.slings = L.slings.map((s, i) => {
      const [ia, ib] = s.kick;
      const a = { x: s.pts[ia][0], y: s.pts[ia][1] }, b = { x: s.pts[ib][0], y: s.pts[ib][1] };
      const other = s.pts.find((p, k) => k !== ia && k !== ib);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      let n = { x: -t.y, y: t.x };
      if ((other[0] - a.x) * n.x + (other[1] - a.y) * n.y > 0) n = { x: -n.x, y: -n.y }; // normal para fora
      const face = W.addSegment(a.x, a.y, b.x, b.y, Object.assign({}, P.sling, { face: [n.x, n.y] }), 'sling');
      face.data = i;
      // os outros dois lados
      const pts = s.pts;
      for (let k = 0; k < 3; k++) {
        const p = pts[k], q = pts[(k + 1) % 3];
        const isFace = (k === ia && (k + 1) % 3 === ib) || (k === ib && (k + 1) % 3 === ia);
        if (!isFace) W.addSegment(p[0], p[1], q[0], q[1], P.rubber, 'rubber');
      }
      pts.forEach(p => W.addCircle(p[0], p[1], 5, P.rubber, 'rubber'));
      const lamps = [0.2, 0.5, 0.8].map(k => this.lights.add(a.x + (b.x - a.x) * k + n.x * 6, a.y + (b.y - a.y) * k + n.y * 6,
        { r: 30, color: 0xff5a2a, base: 0.12, decay: 260 }));
      return { a, b, n, t, len, lamps, last: 0 };
    });

    // --- Sensores: rampa, órbita, triângulos ---
    Object.entries(L.ramp).forEach(([which, [x, y, r]]) => W.addSensor(x, y, r, 'ramp', which));
    Object.entries(L.orbit || {}).forEach(([which, [x, y, r]]) => W.addSensor(x, y, r, 'orbit', which));
    this.rollLamps = L.rollovers.map(([x, y], i) => {
      W.addSensor(x, y, 20, 'rollover', i);
      return this.lights.add(x, y, { r: 40, color: 0x8fe3ff, base: 0.16 });
    });

    // --- Palhetas ---
    this.flippers = [this.makeFlipper('L', L.flippers.left), this.makeFlipper('R', L.flippers.right)];

    this.buildHoles();
    this.buildLights();
  }

  /* ---------------- BURACOS, BURACO NEGRO e MOLA ----------------
     • saucer: a bola cai no buraco, fica presa, pontua e é cuspida de volta
       (bola muito rápida passa por cima, como na vida real)
     • buraco negro: um campo puxa a bola (FieldEffect do Space Cadet);
       ela é sugada, viaja pelo TÚNEL e sai disparada pela MOLA
     • mola: se a bola encostar no pé da mola, ela dispara */
  buildHoles() {
    const L = this.layout, W = this.world, HP = UAI.PHYSICS.holes;
    this.holes = (L.holes || []).map((h, i) => {
      const black = h.type === 'blackhole';
      const sensor = W.addSensor(h.x, h.y, h.r || 13, 'hole', i);
      sensor.continuous = true;
      if (black) W.addField(h.x, h.y, HP.pullRadius, HP.pull);
      const size = black ? 80 : 40;
      const pit = this.add.image(h.x, h.y, 'pit').setDisplaySize(size, size * 0.9).setDepth(2.5).setAlpha(black ? 0.95 : 0.85);
      const swirl = black ? this.add.image(h.x, h.y, 'swirl').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xb070ff).setDisplaySize(size * 1.5, size * 1.35).setDepth(2.6).setAlpha(0.6) : null;
      if (swirl) this.tableObjs.push(swirl);
      this.tableObjs.push(pit);
      const lamp = this.lights.add(h.x, h.y, { r: black ? 70 : 36, color: black ? 0xa060ff : 0xffb040, base: black ? 0.2 : 0.1, onLevel: 0.7 });
      return { ...h, pit, swirl, lamp, lit: false, cooldown: 0 };
    });
    this.holeSet = this.holes.filter(H => H.type === 'saucer');

    const S = L.spring;
    this.spring = null;
    if (S) {
      W.addSensor(S.x, S.y, S.r || 16, 'spring', 0);
      const lamp = this.lights.add(S.x, S.y - 12, { r: 60, color: 0xffd27a, base: 0.08, decay: 500 });
      this.spring = { ...S, lamp, cooldown: 0 };
    }
  }

  /** A bola entrou num buraco */
  captureHole(H) {
    const now = this.time.now;
    if (!H || this.ballState !== 'play' || now < H.cooldown) return;
    const black = H.type === 'blackhole';
    const HP = UAI.PHYSICS.holes;
    if (this.world.speed() > HP.captureSpeed * (black ? 1.4 : 1)) return; // rápida demais: passa por cima
    this.ballState = 'hole';
    this.world.freeze(H.x, H.y);
    const P = UAI.CONFIG.POINTS;
    this.tweens.add({ targets: this.ballSpr, scale: this.ballSpr.scale * (black ? 0.15 : 0.55), alpha: black ? 0 : 0.6,
      angle: black ? 720 : 180, duration: black ? 700 : 260, ease: 'Cubic.in' });
    this.lights.flash(H.lamp, 1.2);
    this.party = black ? 1400 : 500;
    if (black) {
      UAI.Sfx.blackhole();
      this.cameras.main.shake(500, 0.004);
      this.addScore(P.blackhole, H.x, H.y - 40);
      this.banner('BURACO NEGRO!', 'Lá vai ela pelo túnel...', '#d8b0ff');
      this.time.delayedCall(1100, () => this.tunnel(H));
    } else {
      UAI.Sfx.saucer();
      this.addScore(P.saucer, H.x, H.y - 30);
      if (!H.lit) {
        H.lit = true;
        if (this.holeSet.length && this.holeSet.every(h => h.lit)) {
          this.addScore(P.saucerSet, H.x, H.y - 70);
          this.banner('MINA DE OURO!', 'Os 3 buracos acesos', '#ffe066');
          UAI.Sfx.bonus();
          this.party = 2000;
          this.time.delayedCall(1500, () => this.holeSet.forEach(h => (h.lit = false)));
        }
      }
      this.time.delayedCall(HP.holdTime, () => this.ejectFrom(H.x, H.y, H.eject, H));
    }
  }

  /** Solta a bola de um ponto, com direção [graus, velocidade px/s] (0° = direita, 90° = para baixo) */
  ejectFrom(x, y, eject, H) {
    if (this.ballState !== 'hole') return;
    const [deg, speed] = eject || [90, 650];
    const a = Phaser.Math.DegToRad(deg + Phaser.Math.Between(-10, 10));
    this.world.placeBall(x + Math.cos(a) * 4, y + Math.sin(a) * 4, Math.cos(a) * speed, Math.sin(a) * speed);
    this.tweens.killTweensOf(this.ballSpr);
    const R = UAI.PHYSICS.ball.radius;
    this.ballSpr.setAlpha(1).setAngle(0).setDisplaySize(R * 2 + 2, R * 2 + 2);
    const s0 = this.ballSpr.scale;
    this.ballSpr.setScale(s0 * 1.5);
    this.tweens.add({ targets: this.ballSpr, scale: s0, duration: 200, ease: 'Back.out' });
    if (H) H.cooldown = this.time.now + 1200;
    this.trailPts = [];
    this.ballState = 'play';
    UAI.Sfx.eject();
  }

  /** Túnel subterrâneo: uma luz corre por baixo da mesa até a mola */
  tunnel(H) {
    const S = this.spring;
    if (!S) { this.ejectFrom(H.x, H.y, [90, 700], H); return; }
    const spark = this.add.image(H.x, H.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xc090ff).setDisplaySize(70, 70).setDepth(9);
    const core = this.add.image(H.x, H.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffffff).setDisplaySize(26, 26).setDepth(9);
    UAI.Sfx.tunnel();
    const cx = (H.x + S.x) / 2 - 40, cy = Math.max(H.y, S.y) + 120;
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(H.x, H.y), new Phaser.Math.Vector2(cx, cy), new Phaser.Math.Vector2(S.x, S.y));
    const tmp = new Phaser.Math.Vector2();
    this.tweens.addCounter({
      from: 0, to: 1, duration: 900, ease: 'Sine.inOut',
      onUpdate: tw => {
        curve.getPoint(tw.getValue(), tmp);
        spark.setPosition(tmp.x, tmp.y); core.setPosition(tmp.x, tmp.y);
        this.lights.list.forEach(L => { if (Math.hypot(L.x - tmp.x, L.y - tmp.y) < 90) this.lights.flash(L, 0.7); });
      }
    });
    this.time.delayedCall(900, () => {
      spark.destroy(); core.destroy();
      if (this.ballState === 'hole') this.fireSpring(true);
    });
  }

  /** A mola dispara a bola (vindo do túnel ou porque a bola encostou nela) */
  fireSpring(fromTunnel) {
    const S = this.spring, now = this.time.now;
    if (!S) return;
    if (!fromTunnel) {
      if (this.ballState !== 'play' || now < S.cooldown) return;
      this.ballState = 'hole';
      this.world.freeze(S.x, S.y);
    }
    S.cooldown = now + 1500;
    this.lights.flash(S.lamp, 1.3);
    this.time.delayedCall(fromTunnel ? 150 : 300, () => {
      this.ejectFrom(S.x, S.y, S.eject, null);
      S.cooldown = this.time.now + 1500;
      this.addScore(UAI.CONFIG.POINTS.spring, S.x + 30, S.y - 30);
      this.banner('MOLA!', '', '#ffd27a');
      UAI.Sfx.launch(1);
      this.cameras.main.shake(160, 0.006);
      this.lights.flashAll(this.rim, 0.6);
    });
  }

  /** Choque elétrico do cubo da roda central */
  shock(B) {
    UAI.Sfx.shock();
    this.cameras.main.shake(120, 0.005);
    (this.sparks || []).forEach(L => this.lights.flash(L, 1.2));
    const wheel = this.bumpers.find(o => o.sensor);
    if (wheel) { wheel.flash = 1; wheel.spinBoost = 0.03; }
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, r1 = 18, r2 = 46 + Math.random() * 30;
      const g = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(3, 0x9fe8ff, 1);
      g.beginPath(); g.moveTo(B.x + Math.cos(a) * r1, B.y + Math.sin(a) * r1);
      const mx = B.x + Math.cos(a + 0.3) * (r1 + r2) / 2, my = B.y + Math.sin(a + 0.3) * (r1 + r2) / 2;
      g.lineTo(mx, my); g.lineTo(B.x + Math.cos(a) * r2, B.y + Math.sin(a) * r2); g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }
  }

  /** Suaviza curvas (Catmull-Rom) onde a linha dobra pouco; quinas fechadas continuam retas */
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
        const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const lim = (q, o) => {
          const d = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1, k = Math.min(1, L / d);
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

  /* ---------------- Palhetas ---------------- */
  makeFlipper(side, pv) {
    const P = UAI.PHYSICS.flipper;
    const len = P.length * this.diff.flipperScale;
    const f = this.world.addFlipper({
      px: pv[0], py: pv[1], side: side === 'L' ? 1 : -1, len,
      rb: P.baseRadius, rt: P.tipRadius,
      rest: Phaser.Math.DegToRad(P.restAngle), up: Phaser.Math.DegToRad(P.upAngle),
      omegaMax: this.diff.omega, accUp: P.accUp, omegaDown: P.omegaDown, accDown: P.accDown,
      e: P.e, fo: P.fo, mu: P.mu
    });
    // textura: esquerda = flipper.png (pivô à esquerda); direita = flipper2.png (pivô à direita)
    let key = 'flipper', flip = false;
    if (side === 'R') { if (this.textures.exists('flipper2')) key = 'flipper2'; else flip = true; }
    const src = this.textures.get(key).getSourceImage();
    const w = src.width, h = src.height;
    const k = len / Math.max(1, w - h);               // centro do rolamento → centro da ponta = len
    const ox = (h / 2) / w;
    const sprite = this.add.image(pv[0], pv[1], key).setDisplaySize(w * k, h * k).setDepth(7);
    const pivotOnRight = side === 'R' && !flip;
    sprite.setOrigin(pivotOnRight ? 1 - ox : ox, 0.5);
    const glow = this.add.image(pv[0], pv[1], 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffb347).setDisplaySize(len * 1.3, len * 0.9).setDepth(6).setAlpha(0);
    this.tableObjs.push(glow);
    return { side, phys: f, sprite, glow, pivotOnRight, flip };
  }

  /* ---------------- Bola ---------------- */
  createBall() {
    const R = UAI.PHYSICS.ball.radius;
    this.ballLamp = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf8a).setDisplaySize(300, 300).setAlpha(0.16).setDepth(2);
    this.trail = [];
    for (let i = 0; i < 8; i++) {
      this.trail.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd9a0).setDepth(7.5).setAlpha(0));
    }
    this.trailPts = [];
    this.ballSpr = this.add.image(0, 0, 'ball').setDisplaySize(R * 2 + 2, R * 2 + 2).setDepth(8);
    this.ballRot = 0;
  }

  resetBall() {
    const [x, y] = this.layout.ballStart;
    if (this.ballSpr) {
      this.tweens.killTweensOf(this.ballSpr);
      const R = UAI.PHYSICS.ball.radius;
      this.ballSpr.setAlpha(1).setAngle(0).setDisplaySize(R * 2 + 2, R * 2 + 2);
    }
    this.world.placeBall(x, y, 0, 0);
    this.ballState = 'lane';
    this.ramp = { entryAt: -1e9, apexAt: -1e9, revAt: -1e9 };
    this.orbit = { entryAt: -1e9 };
    this.plunger.charge = 0; this.plunger.charging = false;
    this.trailPts = [];
    this.lights.giTarget = 1;
    this.ambient.setAlpha(0.36);
    this.saveUntil = 0;
    const n = UAI.CONFIG.LIVES - this.lives + 1;
    this.banner('BOLA ' + n, this.sys.game.device.input.touch ? 'Arraste p/ cima no canto direito' : 'Segure ↓ e solte');
  }

  /* =========================================================
     LUZES
     ========================================================= */
  buildLights() {
    const L = this.layout, LT = L.lights || {};
    this.rim = [];
    const outer = (L.walls.find(w => w.id === 'externa') || L.walls[0]).pts;
    let carry = 0;
    for (let i = 0; i < outer.length - 1; i++) {
      const [x1, y1] = outer[i], [x2, y2] = outer[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let d = carry; d < len; d += 46) {
        const t = d / len;
        this.rim.push(this.lights.add(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t,
          { r: 24, color: this.rim.length % 3 === 2 ? 0xff5a2a : 0xffc060, base: 0.14, core: false }));
      }
      carry = Math.max(0, 46 - (len % 46));
    }
    this.chevrons = (LT.chevrons || []).map(([x, y]) => this.lights.add(x, y, { r: 34, color: 0xff8a1f, base: 0.18 }));
    this.grid = (LT.grid || []).map(([x, y]) => this.lights.add(x, y, { r: 52, color: 0xffc861, base: 0.14, onLevel: 0.8 }));
    this.extraLamps = (LT.extra || []).map(([x, y]) => this.lights.add(x, y, { r: 60, color: 0xffa24a, base: 0.18 }));
    const hub = L.bumpers.find(b => b.shock);
    this.sparks = hub ? [0, 1, 2, 3, 4, 5, 6, 7].map(k => this.lights.add(
      hub.x + Math.cos(k * Math.PI / 4) * 52, hub.y + Math.sin(k * Math.PI / 4) * 44,
      { r: 26, color: 0x9fe8ff, base: 0.0, decay: 300 })) : [];
    this.drainLamp = LT.drain ? this.lights.add(LT.drain[0], LT.drain[1], { r: 70, color: 0xff3a1a, base: 0.05, decay: 900 }) : null;
    // lâmpada de "bola salva" entre as palhetas
    this.saveLamp = LT.drain ? this.lights.add(LT.drain[0], LT.drain[1] - 30, { r: 46, color: 0x7dff9a, base: 0, onLevel: 0.85 }) : null;
    const [bx, by] = L.ballStart;
    this.meter = [];
    for (let i = 0; i < 8; i++) this.meter.push(this.lights.add(bx, by - 40 - i * 34, { r: 20, color: i < 5 ? 0xffd27a : 0xff4a1a, base: 0.03 }));
  }

  updateLights(dt, t) {
    const lanePhase = this.ballState === 'lane';
    this.rim.forEach((L, i) => {
      if (this.party > 0) L.extra = ((Math.floor(t / 90) + i) % 2) ? 0.85 : 0.1;
      else {
        const ph = ((i - t * (lanePhase ? 0.02 : 0.009)) % 9 + 9) % 9;
        L.extra = ph < 2 ? 0.8 : 0;
      }
    });
    const rampHot = this.time.now - this.ramp.entryAt < 3000;
    const nc = this.chevrons.length;
    this.chevrons.forEach((L, i) => {
      const ph = ((nc - 1 - i) + t * (rampHot ? 0.03 : 0.008)) % (nc + 2);
      L.extra = Math.abs(ph - nc / 2) < 0.8 ? 0.8 : 0;
    });
    this.grid.forEach((L, i) => {
      L.on = i < this.mult - 1;
      if (i === this.mult - 1) L.extra = 0.15 + 0.15 * Math.sin(t / 220);
      if (this.party > 0) L.extra += ((Math.floor(t / 120) + i) % 2) * 0.5;
    });
    this.rollLamps.forEach((L, i) => {
      L.on = this.rollLit[i];
      if (!L.on) L.extra = 0.12 + 0.12 * Math.sin(t / 300 + i);
    });
    this.extraLamps.forEach((L, i) => { L.extra = 0.2 + 0.18 * Math.sin(t / 700 + i * 2); });
    this.meter.forEach((L, i) => {
      if (this.plunger.charging) L.on = i < Math.round(this.plunger.charge * this.meter.length);
      else { L.on = false; if (lanePhase) L.extra = ((Math.floor(t / 110) % 10) === i) ? 0.7 : 0; }
    });
    if (this.saveLamp) {
      const left = this.saveUntil - this.time.now;
      this.saveLamp.on = left > 0 && (left > 2000 || Math.floor(t / 150) % 2 === 0);
    }
    this.bumpers.forEach(B => {
      B.flash = Math.max(0, B.flash - dt / 260);
      B.halo.setAlpha((0.22 + 0.08 * Math.sin(t / 420 + B.phase) + B.flash * 0.8) * this.lights.gi);
      B.cap.setAlpha(B.flash * 0.9 * this.lights.gi);
      B.spinBoost = Math.max(0, (B.spinBoost || 0) - dt * 0.00002);
      if (B.spr) B.spr.rotation += B.spin * dt * (0.00025 + B.flash * 0.004 + (B.spinBoost || 0));
    });
    this.flippers.forEach(f => {
      const target = f.phys.pressed ? 0.55 : 0;
      f.glow.setAlpha(f.glow.alpha + (target - f.glow.alpha) * Math.min(1, dt / 60));
    });
    (this.holes || []).forEach((H, i) => {
      if (H.type === 'blackhole') {
        if (H.swirl) H.swirl.rotation -= dt * (this.ballState === 'hole' ? 0.012 : 0.0025);
        H.lamp.extra = 0.25 + 0.2 * Math.sin(t / 380);
      } else {
        H.lamp.on = H.lit;
        if (!H.lit) H.lamp.extra = 0.1 + 0.1 * Math.sin(t / 260 + i * 2);
      }
    });
    if (this.spring) this.spring.lamp.extra = 0.12 + 0.1 * Math.sin(t / 500);
    this.party = Math.max(0, this.party - dt);
    this.lights.update(dt);
  }

  /* =========================================================
     HUD
     ========================================================= */
  createHUD() {
    const UI = UAI.UI, W = this.W;
    const g = this.add.graphics().setDepth(20);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0.75, 0, 0);
    g.fillRect(0, 0, W, 78);
    this.add.text(30, 10, 'PONTOS', { fontFamily: UI.FONT_NUM, fontSize: '15px', color: '#d8b98a' }).setDepth(21);
    this.scoreTxt = this.add.text(28, 26, '0', {
      fontFamily: UI.FONT_NUM, fontSize: '36px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 6
    }).setDepth(21).setShadow(0, 0, '#ff9a30', 12, false, true);
    this.multTxt = this.add.text(W / 2, 40, 'x1', {
      fontFamily: UI.FONT_NUM, fontSize: '40px', color: '#fff0c8', stroke: '#2a1406', strokeThickness: 6
    }).setOrigin(0.5).setDepth(21).setShadow(0, 0, '#ffb040', 14, false, true);
    this.add.text(W - 110, 10, 'RECORDE', { fontFamily: UI.FONT_NUM, fontSize: '15px', color: '#d8b98a' }).setOrigin(1, 0).setDepth(21);
    this.highTxt = this.add.text(W - 110, 28, UAI.fmt(this.high), {
      fontFamily: UI.FONT_NUM, fontSize: '26px', color: '#e8c48a', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(1, 0).setDepth(21);

    const pb = this.add.circle(W - 50, 40, 28, 0x4a250e).setStrokeStyle(3, 0xc9973f).setDepth(21)
      .setInteractive({ useHandCursor: true });
    this.add.text(W - 50, 40, 'II', { fontFamily: UI.FONT_NUM, fontSize: '24px', color: '#ffe7b8' }).setOrigin(0.5).setDepth(22);
    pb.on('pointerup', () => this.togglePause());

    this.livesIcons = [];
    for (let i = 0; i < UAI.CONFIG.LIVES; i++) {
      this.livesIcons.push(this.add.image(46 + i * 40, this.H - 34, 'ball').setDisplaySize(30, 30).setDepth(21));
    }
    this.add.text(this.W - 24, this.H - 34, this.diff.label, {
      fontFamily: UI.FONT_TITLE, fontSize: '24px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(1, 0.5).setDepth(21);

    this.bannerTxt = this.add.text(this.W / 2, 600, '', {
      fontFamily: UI.FONT_TITLE, fontSize: '58px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 9, align: 'center'
    }).setOrigin(0.5).setDepth(30).setAlpha(0).setShadow(0, 0, '#ff8a20', 24, false, true);
    this.bannerSub = this.add.text(this.W / 2, 660, '', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    this.editorTxt = this.add.text(12, this.H - 72,
      'EDITOR · arraste os pontos · N add ponto · X apaga ponto · +/- raio do bumper\nC copia JSON · R volta ao padrão · E sai (salva automático)', {
      fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', backgroundColor: '#000000cc', padding: { x: 8, y: 6 }
    }).setDepth(61).setVisible(false);

    this.updateHUD();
  }

  updateHUD() {
    this.scoreTxt.setText(UAI.fmt(this.score));
    this.multTxt.setText('x' + this.mult);
    if (this.score > this.high) this.highTxt.setText(UAI.fmt(this.score)).setColor('#fff0c8');
    this.livesIcons.forEach((ic, i) => ic.setAlpha(i < this.lives ? 1 : 0.15));
  }

  banner(text, sub = '', color = '#ffe7b8') {
    this.tweens.killTweensOf([this.bannerTxt, this.bannerSub]);
    this.bannerTxt.setText(text).setColor(color).setAlpha(0).setScale(0.6);
    this.bannerSub.setText(sub).setAlpha(0);
    this.tweens.add({ targets: this.bannerTxt, alpha: 1, scale: 1, duration: 220, ease: 'Back.out' });
    this.tweens.add({ targets: this.bannerSub, alpha: 1, duration: 220 });
    this.tweens.add({ targets: [this.bannerTxt, this.bannerSub], alpha: 0, delay: 1300, duration: 400 });
  }

  popup(x, y, txt, color = '#ffe9b0') {
    const t = this.add.text(x, y, txt, {
      fontFamily: UAI.UI.FONT_NUM, fontSize: '26px', color, stroke: '#2a1406', strokeThickness: 5
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
      if (this.ballState === 'lane' && x > this.W * 0.7 && y > this.H * 0.55) {
        this.plunger.pointerId = p.id; this.plunger.startY = y;
        this.startCharge('touch');
        return;
      }
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
    this.events.once('shutdown', () => this.game.events.off('blur', this.onBlur, this));
  }

  onBlur() { if (!this.paused && this.ballState !== 'over') this.togglePause(); }

  setFlipper(side, on) {
    const f = this.flippers[side === 'L' ? 0 : 1];
    if (!f || f.phys.pressed === on) return;
    f.phys.pressed = on;
    if (on && !this.paused) {
      UAI.Sfx.flipper();
      if (side === 'L') this.rollLit.push(this.rollLit.shift());
      else this.rollLit.unshift(this.rollLit.pop());
    }
  }

  /** Sacudir a mesa (seta ↑ / W): empurrãozinho na bola, como no fliperama */
  nudge() {
    if (this.paused || this.ballState !== 'play') return;
    const now = this.time.now;
    if (now - (this.lastNudge || 0) < 900) return;
    this.lastNudge = now;
    const b = this.world.ball;
    b.vx += Phaser.Math.Between(-120, 120); b.vy -= 260;
    this.cameras.main.shake(120, 0.006);
  }

  startCharge(mode) {
    if (this.paused || this.editorOn || this.ballState !== 'lane') return;
    this.plunger.charging = true; this.plunger.mode = mode; this.plunger.charge = 0;
    this.plunger.startT = performance.now();
  }

  /** Solta a mola: velocidade para cima proporcional à carga */
  fire() {
    const pl = this.plunger;
    const charge = pl.charge;
    pl.charging = false; pl.mode = null; pl.pointerId = null; pl.charge = 0;
    if (this.ballState !== 'lane') return;
    const b = this.world.ball, [bx, by] = this.layout.ballStart;
    if (Math.abs(b.x - bx) > 30 || b.y < by - 60) return;   // bola precisa estar na base do corredor
    const P = UAI.PHYSICS.plunger;
    const power = (P.min + (P.max - P.min) * charge) * this.diff.plunger;
    b.vx = 0; b.vy = -power;
    UAI.Sfx.launch(charge);
    this.lights.flashAll(this.meter, 0.9);
    this.lights.flashAll(this.rim, 0.4);
  }

  togglePause() {
    if (this.ballState === 'over') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.flippers.forEach(f => (f.phys.pressed = false));
      const W = this.W, H = this.H, UI = UAI.UI;
      const c = this.add.container(0, 0).setDepth(80);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive());
      c.add(this.add.text(W / 2, 420, 'PAUSADO', {
        fontFamily: UI.FONT_TITLE, fontSize: '72px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 10
      }).setOrigin(0.5));
      c.add(UI.button(this, W / 2, 570, 380, 90, 'CONTINUAR', () => this.togglePause(), { size: 40 }));
      c.add(UI.button(this, W / 2, 690, 380, 80, 'REINICIAR', () => this.scene.restart({ difficulty: this.diffKey }), { size: 32 }));
      c.add(UI.button(this, W / 2, 800, 380, 80, 'MENU', () => this.scene.start('Menu'), { size: 32 }));
      this.pauseUI = c;
    } else if (this.pauseUI) {
      this.pauseUI.destroy(); this.pauseUI = null;
      this.world.acc = 0;
    }
  }

  /* =========================================================
     EVENTOS DO MOTOR
     ========================================================= */
  onHit(c, imp, kicked) {
    if (this.ballState !== 'play' && this.ballState !== 'lane') return;
    switch (c.tag) {
      case 'bumper': if (kicked) this.hitBumper(this.bumpers[c.data], c.data); break;
      case 'sling': if (kicked) this.hitSling(this.slings[c.data], c); break;
      case 'flipper': this.slingChain = 0; break;
      default: {
        const now = this.time.now;
        if (imp > 350 && now - this.lastWallSound > 90) { UAI.Sfx.wall(); this.lastWallSound = now; }
      }
    }
  }

  onSensor(S) {
    if (this.ballState !== 'play') {
      // a bola lançada ainda está no corredor/arco: só os sensores de rampa acompanham
      if (this.ballState !== 'lane' || S.tag !== 'ramp') return;
    }
    switch (S.tag) {
      case 'ramp': this.onRampSensor(S.data); break;
      case 'orbit': this.onOrbitSensor(S.data); break;
      case 'rollover': this.onRollover(S.data); break;
      case 'hole': this.captureHole(this.holes[S.data]); break;
      case 'spring': this.fireSpring(false); break;
      case 'wheel': this.hitWheel(this.bumpers[S.data]); break;
      case 'shock': this.shockBoost(this.bumpers[S.data], S.data); break;
      case 'target': {
        const B = this.bumpers[S.data], now = this.time.now;
        if (B && now - B.last > 200) { B.last = now; this.hitBumper(B, S.data); }
        break;
      }
    }
  }

  hitBumper(B, i) {
    if (!B) return;
    this.slingChain = 0;
    if (B.shock) this.shock(B);
    B.flash = 1;
    if (B.holder) this.tweens.add({ targets: B.holder, scaleX: 1.12, scaleY: B.persp * 1.12, duration: 60, yoyo: true });
    UAI.Sfx.bumper(i);
    this.addScore(UAI.CONFIG.POINTS.bumper, B.x, B.y - B.r - 14);
    this.lights.flashAll(this.rim, 0.25);
  }

  /** Cubo da roda central: choque elétrico que ACELERA a bola na direção em que ela vai */
  shockBoost(B, i) {
    const now = this.time.now, SP = UAI.PHYSICS.shock;
    if (!B || now - B.last < SP.cool) return;
    B.last = now;
    const b = this.world.ball, sp = this.world.speed();
    if (sp < 200) {                       // bola quase parada em cima: o choque a joga para cima
      b.vx += Phaser.Math.Between(-300, 300); b.vy = -SP.minSpeed;
    } else {
      const ns = Math.min(UAI.PHYSICS.maxSpeed, Math.max(sp * SP.boost, sp + SP.minAdd, SP.minSpeed));
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
    this.hitBumper(B, i);
  }

  hitWheel(B) {
    const now = this.time.now;
    if (!B || now - B.last < 250) return;
    B.last = now; B.flash = 0.7;
    B.spinBoost = Math.min(0.04, this.world.speed() * 0.00002);
    this.addScore(UAI.CONFIG.POINTS.wheel, B.x, B.y - 30);
  }

  hitSling(S, c) {
    if (!S) return;
    const now = this.time.now;
    // anti pingue-pongue: estilingue atrás de estilingue sem tocar em mais nada perde força
    this.slingChain = (now - this.lastSlingAt < 1500) ? this.slingChain + 1 : 1;
    this.lastSlingAt = now;
    if (this.slingChain >= 3) {
      const b = this.world.ball, k = c.m.kick * 0.65;
      b.vx -= c.m.face[0] * k; b.vy -= c.m.face[1] * k;
    }
    this.lights.flashAll(S.lamps, 1);
    UAI.Sfx.sling();
    const b = this.world.ball;
    this.addScore(UAI.CONFIG.POINTS.sling, b.x, b.y - 30);
  }

  /** Rampa da ferradura: acelerador da direita → topo → saída esquerda */
  onRampSensor(which) {
    const now = this.time.now, R = this.ramp, b = this.world.ball;
    if (which === 'right') {
      if (this.ballState !== 'play') return;
      if (b.vy > -120) {                                   // descendo: pode ser o fim da rampa reversa
        if (now - R.apexAt < 3000 && now - (R.revAt || -1e9) < 6000) { this.rampComplete(true); R.entryAt = R.apexAt = R.revAt = -1e9; }
        return;
      }
      // acelerador: empurra a bola para subir a ferradura
      const P = UAI.PHYSICS, [dx, dy] = P.rampBoostDir, dl = Math.hypot(dx, dy) || 1;
      const sp = Math.max(Math.hypot(b.vx, b.vy), P.rampBoost);
      // o acelerador "pega" a bola e alinha no meio do canal antes de empurrar
      const [rx] = this.layout.ramp.right;
      b.x = Math.max(b.x, rx - 4);
      b.vx = (dx / dl) * sp; b.vy = (dy / dl) * sp;
      R.entryAt = now;
      this.lights.flashAll(this.chevrons, 1);
      UAI.Sfx.launch(0.5);
    } else if (which === 'apex') {
      if (now - R.entryAt < 4000 || now - (R.revAt || -1e9) < 4000) R.apexAt = now;
    } else if (which === 'left') {
      // descendo o braço: o trilho de saída entrega a bola para o lado esquerdo
      if (b.vy > 150) {
        const E = UAI.PHYSICS.rampExit, sp = Math.min(Math.hypot(b.vx, b.vy), E.maxSpeed);
        const dl = Math.hypot(E.dir[0], E.dir[1]);
        b.vx = E.dir[0] / dl * sp; b.vy = E.dir[1] / dl * sp;
      }
      if (now - R.apexAt < 3000 && now - R.entryAt < 6000) { this.rampComplete(false); R.entryAt = R.apexAt = R.revAt = -1e9; }
      else if (b.vy < -150) R.revAt = now;        // subindo o braço esquerdo = rampa ao contrário
    }

  }

  rampComplete(reverse) {
    const pos = this.layout.ramp.apex;
    this.addScore(UAI.CONFIG.POINTS.ramp, pos[0], pos[1] + 50);
    this.banner(reverse ? 'RAMPA REVERSA!' : 'RAMPA!', '+' + UAI.fmt(UAI.CONFIG.POINTS.ramp * this.mult), '#ffd27a');
    UAI.Sfx.ramp();
    this.party = 1200;
    this.lights.flashAll(this.chevrons, 1);
    this.cameras.main.flash(160, 255, 200, 120);
  }

  /** Órbita da câmara da mola: entrou por baixo subindo e chegou no alto */
  onOrbitSensor(which) {
    const now = this.time.now, b = this.world.ball;
    if (which === 'entry') { if (b.vy < -200) this.orbit.entryAt = now; return; }
    if (which === 'top' && now - this.orbit.entryAt < 3000) {
      this.orbit.entryAt = -1e9;
      const [x, y] = this.layout.orbit.top;
      this.addScore(UAI.CONFIG.POINTS.orbit, x, y + 40);
      this.banner('ÓRBITA!', 'Volta na câmara da mola', '#ffd27a');
      UAI.Sfx.ramp();
      this.party = 900;
    }
  }

  onRollover(i) {
    if (this.rollLit[i]) return;
    this.rollLit[i] = true;
    const [x, y] = this.layout.rollovers[i];
    this.addScore(UAI.CONFIG.POINTS.rollover, x, y - 30);
    UAI.Sfx.rollover();
    this.lights.flash(this.rollLamps[i], 1);
    if (this.rollLit.every(Boolean)) {
      this.addScore(UAI.CONFIG.POINTS.rolloverSet, x, y - 70);
      this.banner('TRIO MINEIRO!', '+' + UAI.fmt(UAI.CONFIG.POINTS.rolloverSet * this.mult), '#9fe8ff');
      UAI.Sfx.bonus();
      this.party = 900;
      this.time.delayedCall(900, () => { this.rollLit = [false, false, false]; });
    }
  }

  addScore(base, x, y) {
    const pts = base * this.mult;
    this.score += pts;
    if (x != null) this.popup(x, y, '+' + UAI.fmt(pts));
    const m = Math.min(UAI.CONFIG.MAX_MULT, 1 + Math.floor(this.score / UAI.CONFIG.POINTS.multStep));
    if (m > this.mult) {
      this.mult = m;
      this.banner('MULTIPLICADOR x' + m, 'Uai, que trem bão!', '#fff0c8');
      UAI.Sfx.mult();
      this.party = 1800;
      this.cameras.main.flash(220, 255, 210, 140);
      this.tweens.add({ targets: this.multTxt, scale: 1.6, duration: 160, yoyo: true });
    }
    this.updateHUD();
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
    this.world.update(dt / 1000);   // física em passos de 1 ms

    this.syncVisuals(dt);
    this.checkBall(dt);
    this.updateLights(dt, time);
    if (this.debugOn) this.drawDebug();
  }

  syncVisuals(dt) {
    const b = this.world.ball;
    // a bola "rola": gira conforme anda
    this.ballRot += (b.vx * dt / 1000) / b.r;
    this.ballSpr.setPosition(b.x, b.y).setRotation(this.ballRot);
    this.ballLamp.setPosition(b.x, b.y);
    this.trailPts.unshift({ x: b.x, y: b.y });
    if (this.trailPts.length > 16) this.trailPts.length = 16;
    const sp = this.world.speed();
    const k = Phaser.Math.Clamp((sp - 500) / 1500, 0, 1);
    this.trail.forEach((img, i) => {
      const q = this.trailPts[i * 2 + 1];
      if (!q || this.ballState === 'drain' || this.ballState === 'hole') { img.setAlpha(0); return; }
      const s = 34 - i * 3;
      img.setPosition(q.x, q.y).setDisplaySize(s, s).setAlpha(k * 0.5 * (1 - i / this.trail.length));
    });
    this.flippers.forEach(f => {
      const a = this.world.flipperAngle(f.phys);
      f.sprite.setRotation(f.pivotOnRight ? a - Math.PI : a);
    });
    const g = this.plungerGfx, [bx, by] = this.layout.ballStart;
    g.clear();
    const top = by + UAI.PHYSICS.ball.radius + 2 + this.plunger.charge * 22;
    g.fillStyle(0xc9973f, 1).fillRect(bx - 12, top, 24, 8);
    g.fillStyle(0x8a6a33, 1).fillRect(bx - 4, top + 8, 8, 30);
  }

  checkBall(dt) {
    if (this.ballState === 'drain' || this.ballState === 'over' || this.ballState === 'hole') return;
    const b = this.world.ball, C = UAI.CONFIG;
    // passou pelo portão do lançador → bola em jogo (+ bola salva)
    if (this.ballState === 'lane' && b.y < 300 && b.x < 800) {
      this.ballState = 'play';
      if (this.diff.ballSave > 0) this.saveUntil = this.time.now + this.diff.ballSave;
    }
    if (b.y > C.DRAIN_Y || b.x < -40 || b.x > this.W + 40 || b.y < -60) { this.drain(); return; }
    // bola presa (quase não sai do lugar por 3 s) → sacudida automática.
    // Palheta levantada segurando a bola não conta: é o jogador "segurando" a bola.
    if (this.ballState === 'play') {
      if (!this.stuckRef || Math.hypot(b.x - this.stuckRef.x, b.y - this.stuckRef.y) > 18) {
        this.stuckRef = { x: b.x, y: b.y }; this.stuckTime = 0;
      } else if (!this.flippers.some(f => f.phys.pressed)) {
        this.stuckTime += dt;
        if (this.stuckTime > 3000) {
          this.stuckTime = 0; this.stuckRef = null;
          b.vx += Phaser.Math.Between(-250, 250); b.vy -= 650;
          this.cameras.main.shake(180, 0.006);
          this.banner('SACUDIDA!');
        }
      }
    }
  }

  drain() {
    // bola salva: volta para o lançador sem perder vida
    if (this.ballState === 'play' && this.time.now < this.saveUntil) {
      this.banner('BOLA SALVA!', 'Tenta de novo, sô', '#7dff9a');
      UAI.Sfx.bonus();
      this.ballState = 'drain';
      this.world.freeze(-200, -200);
      this.time.delayedCall(900, () => {
        const [x, y] = this.layout.ballStart;
        this.world.placeBall(x, y, 0, 0);
        this.ballState = 'lane';
        this.saveUntil = 0;
      });
      return;
    }
    this.ballState = 'drain';
    this.lives--;
    this.world.freeze(-200, -200);
    UAI.Sfx.drain();
    this.lights.giTarget = 0.08;
    this.ambient.setAlpha(0.5);
    if (this.drainLamp) this.drainLamp.flash = 1.3;
    this.cameras.main.shake(250, 0.008);
    this.flippers.forEach(f => (f.phys.pressed = false));
    this.touchMap = {};
    this.updateHUD();
    if (this.lives > 0) {
      this.banner('BOLA PERDIDA', 'Sobrou ' + this.lives + (this.lives > 1 ? ' bolas' : ' bola'), '#ff9a6a');
      this.time.delayedCall(1500, () => this.resetBall());
    } else {
      this.ballState = 'over';
      this.banner('FIM DE JOGO', '', '#ff9a6a');
      UAI.Sfx.gameover();
      const isRecord = UAI.Store.saveHigh(this.score);
      this.time.delayedCall(1800, () => this.scene.start('GameOver', { score: this.score, difficulty: this.diffKey, isRecord }));
    }
  }

  /* =========================================================
     DEBUG: colisões em vermelho (tecla G ou ?debug=1)
     ========================================================= */
  drawDebug() {
    const g = this.debugGfx, W = this.world;
    g.clear();
    W.colliders.forEach(c => {
      const col = c.tag === 'gate' ? 0x30ff60 : c.tag === 'sling' ? 0xff8800 : (c.tag === 'bumper' || c.tag === 'shock') ? 0x30e0ff : 0xff2020;
      g.lineStyle(2, col, 0.95);
      if (c.type === 'seg') g.lineBetween(c.ax, c.ay, c.bx, c.by);
      else g.strokeCircle(c.x, c.y, c.r);
    });
    W.sensors.forEach(S => { g.lineStyle(1, 0xffe040, 0.9); g.strokeCircle(S.x, S.y, S.r); });
    W.fields.forEach(F => { g.lineStyle(1, 0xa060ff, 0.6); g.strokeCircle(F.x, F.y, F.r); });
    W.flippers.forEach(f => {
      const a = W.flipperAngle(f), tx = f.px + Math.cos(a) * f.len, ty = f.py + Math.sin(a) * f.len;
      g.lineStyle(2, 0xff2020, 1);
      g.strokeCircle(f.px, f.py, f.rb); g.strokeCircle(tx, ty, f.rt);
      const nx = -Math.sin(a), ny = Math.cos(a);
      g.lineBetween(f.px + nx * f.rb, f.py + ny * f.rb, tx + nx * f.rt, ty + ny * f.rt);
      g.lineBetween(f.px - nx * f.rb, f.py - ny * f.rb, tx - nx * f.rt, ty - ny * f.rt);
      g.fillStyle(0x00ff66, 1).fillCircle(f.px, f.py, 4);
    });
    if (!W.ball.frozen) { g.lineStyle(2, 0x40ff40, 1); g.strokeCircle(W.ball.x, W.ball.y, W.ball.r); }
    if (this.editorOn) {
      g.lineStyle(1, 0xffffff, 0.8);
      this.layout.walls.forEach(w => g.strokePoints(w.pts.map(([x, y]) => ({ x, y }))));
    }
  }

  /* =========================================================
     EDITOR DE PONTOS (tecla E ou ?editor=1)
     ========================================================= */
  toggleEditor() {
    this.editorOn = !this.editorOn;
    if (this.editorOn) {
      this.debugOn = true;
      this.flippers.forEach(f => (f.phys.pressed = false));
      this.buildHandles();
      this.editorTxt.setVisible(true);
      if (!this.editorBound) {
        this.editorBound = true;
        this.input.on('drag', (p, obj, x, y) => {
          if (!this.editorOn || !obj.setPos) return;
          x = Math.round(x); y = Math.round(y);
          obj.setPosition(x, y); obj.setPos(x, y);
          this.select(obj);
        });
        this.input.on('dragend', (p, obj) => { if (this.editorOn && obj.setPos) this.rebuild(); });
        this.input.on('gameobjectdown', (p, obj) => { if (this.editorOn && obj.meta) this.select(obj); });
      }
    } else {
      this.destroyHandles();
      this.editorTxt.setVisible(false);
      UAI.Layout.save(this.layout);
      if (!this.debugOn) this.debugGfx.clear();
    }
  }

  buildHandles() {
    this.destroyHandles();
    const L = this.layout;
    const mk = (x, y, color, set, meta) => {
      const h = this.add.circle(x, y, 9, color, 0.95).setStrokeStyle(2, 0x000000).setDepth(62)
        .setInteractive({ draggable: true, useHandCursor: true });
      h.setPos = set; h.meta = meta;
      this.handles.push(h);
      return h;
    };
    const P = (arr, color, kind) => arr.forEach(pt => mk(pt[0], pt[1], color, (x, y) => { pt[0] = x; pt[1] = y; }, { kind }));
    L.walls.forEach((w, wi) => w.pts.forEach((pt, pi) => mk(pt[0], pt[1], 0xff3030, (x, y) => { pt[0] = x; pt[1] = y; }, { kind: 'wall', wi, pi })));
    (L.gates || []).forEach(g => P(g.pts, 0x30ff60, 'gate'));
    (L.blocks || []).forEach(b => P(b.pts, 0xff8800, 'block'));
    L.slings.forEach(s => P(s.pts, 0xff8800, 'sling'));
    L.bumpers.forEach((b, i) => mk(b.x, b.y, 0x30e0ff, (x, y) => { b.x = x; b.y = y; }, { kind: 'bumper', i }));
    P([L.flippers.left, L.flippers.right], 0x30ff60, 'flipper');
    P(Object.values(L.ramp), 0xffe040, 'sensor');
    P(Object.values(L.orbit || {}), 0xffe040, 'sensor');
    P(L.rollovers, 0xffe040, 'sensor');
    const LT = L.lights || {};
    ['chevrons', 'grid', 'extra'].forEach(k => P(LT[k] || [], 0xff40ff, 'light'));
    if (LT.drain) P([LT.drain], 0xff40ff, 'light');
    (L.holes || []).forEach(hh => mk(hh.x, hh.y, 0xa060ff, (x, y) => { hh.x = x; hh.y = y; }, { kind: 'hole' }));
    if (L.spring) mk(L.spring.x, L.spring.y, 0xa060ff, (x, y) => { L.spring.x = x; L.spring.y = y; }, { kind: 'spring' });
    P([L.ballStart], 0x4080ff, 'start');
  }

  destroyHandles() { (this.handles || []).forEach(h => h.destroy()); this.handles = []; this.selected = null; }

  select(h) {
    if (this.selected && this.selected.active) this.selected.setStrokeStyle(2, 0x000000);
    this.selected = h; h.setStrokeStyle(4, 0xffffff);
  }

  rebuild() {
    const b = this.world.ball, saved = { x: b.x, y: b.y, frozen: b.frozen };
    this.buildTable();
    Object.assign(this.world.ball, saved);
    UAI.Layout.save(this.layout);
  }

  editorKey(ev) {
    const L = this.layout, m = this.selected && this.selected.meta;
    switch (ev.code) {
      case 'KeyC': {
        const json = JSON.stringify(L);
        console.log('UAI.DEFAULT_TABLE = ' + json + ';');
        const done = () => this.banner('JSON COPIADO', 'Cole em js/config.js');
        if (navigator.clipboard) navigator.clipboard.writeText(json).then(done, () => window.prompt('Copie:', json));
        else window.prompt('Copie:', json);
        break;
      }
      case 'KeyR':
        if (window.confirm('Voltar a mesa ao padrão do config.js?')) {
          this.layout = UAI.Layout.reset(); this.buildTable(); this.buildHandles();
        }
        break;
      case 'KeyN':
        if (m && m.kind === 'wall') {
          const pts = L.walls[m.wi].pts, a = pts[m.pi], b = pts[m.pi + 1] || [a[0] + 30, a[1]];
          pts.splice(m.pi + 1, 0, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)]);
          this.rebuild(); this.buildHandles();
        }
        break;
      case 'KeyX':
        if (m && m.kind === 'wall' && L.walls[m.wi].pts.length > 2) {
          L.walls[m.wi].pts.splice(m.pi, 1); this.rebuild(); this.buildHandles();
        }
        break;
      case 'Equal': case 'NumpadAdd': case 'Minus': case 'NumpadSubtract':
        if (m && m.kind === 'bumper') {
          const b = L.bumpers[m.i];
          const d = ev.code === 'Equal' || ev.code === 'NumpadAdd' ? 2 : -2;
          const ratio = b.vr ? b.vr / b.r : 0;
          b.r = Phaser.Math.Clamp(b.r + d, 8, 120);
          if (ratio) b.vr = Math.round(b.r * ratio);
          this.rebuild();
        }
        break;
    }
  }
}
