/* ============================================================
   GameScene – física, colisões, pontuação, luzes, debug e editor
   ------------------------------------------------------------
   COMO A FÍSICA FUNCIONA (resumo para ajustes):
   • Matter.js roda em SUB-PASSOS fixos (CONFIG.SUBSTEPS por quadro).
     Mais sub-passos = bola rápida não atravessa parede.
   • Paredes = retângulos estáticos finos seguindo as linhas do config
     + círculos nas juntas (a bola não engancha nas quinas).
   • Palhetas = corpos "cinemáticos": a cada sub-passo calculamos o
     ângulo e damos a velocidade certa, e o Matter transfere essa
     velocidade para a bola na colisão (é isso que dá a "tacada").
   • Bumpers/estilingues: além da restituição, aplicamos um chute
     (velocidade) para fora logo depois do passo de física.
   ============================================================ */

// Categorias de colisão (bits)
const CAT = { WALL: 0x0001, BALL: 0x0002, FLIP: 0x0004 };

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
    const C = UAI.CONFIG;
    this.W = C.WIDTH; this.H = C.HEIGHT;
    this.MJ = Phaser.Physics.Matter.Matter;
    this.Body = this.MJ.Body;
    this.Bodies = this.MJ.Bodies;

    const world = this.matter.world;
    world.autoUpdate = false;                 // nós chamamos world.step() em sub-passos
    world.setGravity(0, this.diff.gravity);   // gravidade da dificuldade (1 = padrão)

    this.layout = UAI.Layout.load();

    // Estado do jogo
    this.score = 0;
    this.lives = C.LIVES;
    this.mult = 1;
    this.high = UAI.Store.getHigh();
    this.paused = false;
    this.ballState = 'lane';                  // lane | play | drain | over
    this.plunger = { charging: false, charge: 0, mode: null, pointerId: null, startY: 0 };
    this.ramp = { entrySide: null, entryAt: 0, apexAt: 0 };
    this.rollLit = [false, false, false];
    this.acc = 0;
    this.stuckTime = 0;
    this.pendingKick = null;
    this.party = 0;                           // tempo de "festa" das luzes (ms)
    this.lastWallSound = 0;

    // Camadas visuais
    this.add.image(this.W / 2, this.H / 2, 'mesa').setDisplaySize(this.W, this.H).setDepth(0);
    this.ambient = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.36).setDepth(1);
    this.lights = new UAI.LightRig(this);
    this.plungerGfx = this.add.graphics().setDepth(6);

    this.tableBodies = [];
    this.tableObjs = [];
    this.flippers = [];
    this.buildTable();
    this.createBall();
    this.createHUD();
    this.createInput();

    this.debugGfx = this.add.graphics().setDepth(60);
    this.matter.world.on('collisionstart', this.onCollision, this);
    this.events.once('shutdown', () => {
      this.matter.world.off('collisionstart', this.onCollision, this);
      this.input.keyboard.removeAllListeners();
    });

    this.resetBall();
    if (/[?&]editor=1/.test(location.search)) this.toggleEditor();
  }

  /* =========================================================
     MESA: paredes, bumpers, estilingues, sensores, palhetas
     ========================================================= */
  buildTable() {
    const P = UAI.PHYSICS, L = this.layout;

    // limpa a versão anterior (o editor reconstrói tudo)
    this.tableBodies.forEach(b => this.matter.world.remove(b));
    this.tableBodies = [];
    this.tableObjs.forEach(o => o.destroy());
    this.tableObjs = [];
    this.flippers.forEach(f => { this.matter.world.remove(f.body); f.sprite.destroy(); });
    this.flippers = [];
    this.lights.clear();

    // --- Paredes ---
    L.walls.forEach(w => this.addPolyline(w.pts));

    // --- Blocos sólidos ---
    (L.blocks || []).forEach(b => {
      const body = this.polyBody(b.pts, { restitution: P.wall.restitution, friction: P.wall.friction });
      this.addBody(body, { type: 'wall' });
    });

    // --- Bumpers ---
    this.bumpers = L.bumpers.map((b, i) => {
      const body = this.Bodies.circle(b.x, b.y, b.r, {
        isStatic: true,
        isSensor: !!b.sensor,                // roda central: só detecta, não rebate
        restitution: P.bumper.restitution,   // quique alto
        friction: 0, label: 'bumper'
      });
      this.addBody(body, { type: 'bumper', i });
      const disp = (2 * b.r) / P.bumper.spriteRatio;
      const halo = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xff9a30).setDisplaySize(disp * 1.7, disp * 1.7).setDepth(4).setAlpha(0.25);
      const spr = this.add.image(b.x, b.y, 'bumper').setDisplaySize(disp, disp).setDepth(5);
      const cap = this.add.image(b.x, b.y, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xfff0c8).setDisplaySize(disp * 0.9, disp * 0.9).setDepth(6).setAlpha(0);
      this.tableObjs.push(halo, spr, cap);
      return { ...b, body, spr, halo, cap, flash: 0, last: 0, phase: i * 1.7, baseScale: spr.scaleX, spin: (i % 2 ? -1 : 1) };
    });

    // --- Estilingues (triângulos que chutam) ---
    this.slings = L.slings.map((s, i) => {
      const body = this.polyBody(s.pts, { restitution: P.sling.restitution, friction: 0 });
      this.addBody(body, { type: 'sling', i });
      const [ia, ib] = s.kick;
      const a = { x: s.pts[ia][0], y: s.pts[ia][1] }, b = { x: s.pts[ib][0], y: s.pts[ib][1] };
      const other = s.pts.find((p, k) => k !== ia && k !== ib);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      let n = { x: -t.y, y: t.x };
      if ((other[0] - a.x) * n.x + (other[1] - a.y) * n.y > 0) n = { x: -n.x, y: -n.y }; // normal para fora
      const lamps = [0.2, 0.5, 0.8].map(k => this.lights.add(a.x + (b.x - a.x) * k + n.x * 6, a.y + (b.y - a.y) * k + n.y * 6,
        { r: 30, color: 0xff5a2a, base: 0.12, decay: 260 }));
      return { a, b, n, t, len, lamps, last: 0 };
    });

    // --- Sensores da rampa ---
    Object.entries(L.ramp).forEach(([which, [x, y, r]]) => {
      const body = this.Bodies.circle(x, y, r, { isStatic: true, isSensor: true, label: 'ramp-' + which });
      this.addBody(body, { type: 'ramp', which });
    });

    // --- Triângulos de rolagem ---
    this.rollLamps = L.rollovers.map(([x, y], i) => {
      const body = this.Bodies.circle(x, y, 18, { isStatic: true, isSensor: true, label: 'rollover' });
      this.addBody(body, { type: 'rollover', i });
      return this.lights.add(x, y, { r: 40, color: 0x8fe3ff, base: 0.16 });
    });

    // --- Palhetas ---
    this.flippers = [this.makeFlipper('L', L.flippers.left), this.makeFlipper('R', L.flippers.right)];

    this.buildLights();
  }

  addBody(body, data) {
    body.uai = data || { type: 'wall' };
    this.matter.world.add(body);
    this.tableBodies.push(body);
    return body;
  }

  /** Suaviza curvas: onde a linha dobra pouco, troca o segmento reto por uma curva
      (Catmull-Rom). Quinas fechadas (> 55°) continuam retas. Menos quinas = a bola
      perde menos velocidade correndo pelos trilhos. */
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
        // vizinhos limitados ao tamanho do segmento: evita "barriga" quando um trecho é bem mais longo
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

  /** Linha poligonal → segmentos retangulares + círculos nas juntas */
  addPolyline(rawPts) {
    const P = UAI.PHYSICS.wall, T = P.thickness;
    const pts = this.smoothPolyline(rawPts);
    const opts = { isStatic: true, restitution: P.restitution, friction: P.friction, label: 'wall' };
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 1) continue;
      const seg = this.Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, T,
        Object.assign({}, opts, { angle: Math.atan2(y2 - y1, x2 - x1) }));
      this.addBody(seg, { type: 'wall' });
    }
    pts.forEach(([x, y]) => this.addBody(this.Bodies.circle(x, y, T / 2, Object.assign({}, opts)), { type: 'wall' }));
  }

  /** Polígono convexo estático posicionado exatamente nos vértices dados */
  polyBody(pts, extra) {
    const verts = pts.map(([x, y]) => ({ x, y }));
    const cx = verts.reduce((s, v) => s + v.x, 0) / verts.length;
    const cy = verts.reduce((s, v) => s + v.y, 0) / verts.length;
    const body = this.Bodies.fromVertices(cx, cy, [verts], Object.assign({ isStatic: true }, extra));
    // fromVertices centraliza pelo centro de massa: corrige para os vértices exatos
    const b = body.bounds, minX = Math.min(...pts.map(p => p[0])), minY = Math.min(...pts.map(p => p[1]));
    this.Body.translate(body, { x: minX - b.min.x, y: minY - b.min.y });
    return body;
  }

  /* ---------------- Palhetas ---------------- */
  makeFlipper(side, pv) {
    const P = UAI.PHYSICS.flipper;
    const s = side === 'L' ? 1 : -1;                       // espelhamento esquerda/direita
    const len = P.length * this.diff.flipperScale;         // escala da dificuldade
    const thick = P.thickness;
    const r = len / 2 - thick / 2;                         // distância pivô → centro do corpo
    const rest = Phaser.Math.DegToRad(P.restAngle);
    const up = Phaser.Math.DegToRad(P.upAngle);

    // textura: esquerda = flipper.png (pivô à esquerda); direita = flipper2.png (pivô à direita)
    let key = 'flipper', rotOffset = 0;
    if (side === 'R') {
      if (this.textures.exists('flipper2')) key = 'flipper2';
      else rotOffset = Math.PI;                            // reaproveita a esquerda girada 180°
    }
    const src = this.textures.get(key).getSourceImage();
    const aspect = src.width / src.height;

    const c = this.flipCenter(pv[0], pv[1], s, r, rest);
    const body = this.Bodies.rectangle(c.x, c.y, len, thick, {
      chamfer: { radius: thick / 2 - 1 },                  // pontas arredondadas
      density: 0.06,                                       // pesada: a bola não empurra a palheta
      friction: 0.0, frictionAir: 0,
      restitution: P.restitution,
      label: 'flipper',
      collisionFilter: { category: CAT.FLIP, mask: CAT.BALL } // só colide com a bola
    });
    this.Body.setAngle(body, s * rest);
    this.Body.setInertia(body, Infinity);                  // não gira por impacto, só pelo nosso controle
    body.ignoreGravity = true;
    body.uai = { type: 'flipper', side };
    this.matter.world.add(body);

    const sprite = this.add.image(c.x, c.y, key).setDisplaySize(len, len / aspect).setDepth(7);
    const glow = this.add.image(pv[0], pv[1], 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffb347).setDisplaySize(len * 1.3, len * 0.9).setDepth(6).setAlpha(0);
    this.tableObjs.push(glow);

    return { side, s, body, sprite, glow, rotOffset, pivot: { x: pv[0], y: pv[1] }, theta: rest, rest, up, r, len, pressed: false };
  }

  flipCenter(px, py, s, r, theta) {
    return { x: px + s * r * Math.cos(theta), y: py + r * Math.sin(theta) };
  }

  /** Avança a palheta um sub-passo e informa a velocidade ao Matter */
  stepFlipper(f, dt) {
    const P = UAI.PHYSICS.flipper, Body = this.Body;
    const k = dt / (1000 / 60);                            // fração de um quadro de 60 fps
    const target = f.pressed ? f.up : f.rest;
    const speed = (f.pressed ? P.upSpeed : P.downSpeed) * k;
    const d = target - f.theta;
    const step = Math.abs(d) <= speed ? d : Math.sign(d) * speed;
    const th0 = f.theta, th1 = th0 + step;                 // limite rígido: nunca passa do alvo
    const c0 = this.flipCenter(f.pivot.x, f.pivot.y, f.s, f.r, th0);
    const c1 = this.flipCenter(f.pivot.x, f.pivot.y, f.s, f.r, th1);
    Body.setAngle(f.body, f.s * th0, false);
    Body.setPosition(f.body, c0, false);
    Body.setAngularVelocity(f.body, (f.s * step) / k);
    Body.setVelocity(f.body, { x: (c1.x - c0.x) / k, y: (c1.y - c0.y) / k });
    f.theta = th1;
  }

  /* ---------------- Bola ---------------- */
  createBall() {
    const P = UAI.PHYSICS.ball;
    this.ball = this.Bodies.circle(0, 0, P.radius, {
      restitution: P.restitution,   // quique
      friction: P.friction,         // atrito de contato
      frictionStatic: 0,
      frictionAir: P.frictionAir,   // freio do ar
      density: P.density,           // massa
      label: 'ball',
      collisionFilter: { category: CAT.BALL, mask: CAT.WALL | CAT.FLIP }
    });
    this.matter.world.add(this.ball);

    // luz quente que acompanha a bola + rastro brilhante
    this.ballLamp = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf8a).setDisplaySize(300, 300).setAlpha(0.16).setDepth(2);
    this.trail = [];
    for (let i = 0; i < 8; i++) {
      this.trail.push(this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffd9a0).setDepth(7.5).setAlpha(0));
    }
    this.trailPts = [];
    this.ballSpr = this.add.image(0, 0, 'ball').setDisplaySize(P.radius * 2 + 2, P.radius * 2 + 2).setDepth(8);
  }

  resetBall() {
    const [x, y] = this.layout.ballStart;
    const Body = this.Body;
    if (this.ball.isStatic) Body.setStatic(this.ball, false);
    Body.setPosition(this.ball, { x, y });
    Body.setVelocity(this.ball, { x: 0, y: 0 });
    Body.setAngularVelocity(this.ball, 0);
    this.ballState = 'lane';
    this.ramp = { entrySide: null, entryAt: 0, apexAt: 0 };
    this.plunger.charge = 0; this.plunger.charging = false;
    this.trailPts = [];
    this.lights.giTarget = 1;
    this.ambient.setAlpha(0.36);
    const n = UAI.CONFIG.LIVES - this.lives + 1;
    this.banner('BOLA ' + n, this.sys.game.device.input.touch ? 'Arraste p/ cima no canto direito' : 'Segure ↓ e solte');
  }

  /* =========================================================
     LUZES
     ========================================================= */
  buildLights() {
    const L = this.layout, LT = L.lights || {};
    // Fita de LED seguindo a parede externa
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
    this.drainLamp = LT.drain ? this.lights.add(LT.drain[0], LT.drain[1], { r: 70, color: 0xff3a1a, base: 0.05, decay: 900 }) : null;
    // Medidor da mola, dentro do corredor
    const [bx, by] = L.ballStart;
    this.meter = [];
    for (let i = 0; i < 8; i++) this.meter.push(this.lights.add(bx, by - 40 - i * 34, { r: 20, color: i < 5 ? 0xffd27a : 0xff4a1a, base: 0.03 }));
  }

  updateLights(dt, t) {
    const lanePhase = this.ballState === 'lane';
    // fita de LED: perseguição lenta; em festa, pisca tudo alternado
    const n = this.rim.length;
    this.rim.forEach((L, i) => {
      if (this.party > 0) L.extra = ((Math.floor(t / 90) + i) % 2) ? 0.85 : 0.1;
      else {
        const ph = ((i - t * (lanePhase ? 0.02 : 0.009)) % 9 + 9) % 9;
        L.extra = ph < 2 ? 0.8 : 0;
      }
    });
    // setas: correm em direção à rampa; mais rápido quando a bola entrou no portão
    const rampHot = this.ramp.entrySide && (this.time.now - this.ramp.entryAt < 3000);
    const nc = this.chevrons.length;
    this.chevrons.forEach((L, i) => {
      const ph = ((nc - 1 - i) + t * (rampHot ? 0.03 : 0.008)) % (nc + 2);
      L.extra = Math.abs(ph - nc / 2) < 0.8 ? 0.8 : 0;
    });
    // quadro do multiplicador
    this.grid.forEach((L, i) => {
      L.on = i < this.mult - 1;
      if (i === this.mult - 1) L.extra = 0.15 + 0.15 * Math.sin(t / 220);
      if (this.party > 0) L.extra += ((Math.floor(t / 120) + i) % 2) * 0.5;
    });
    // triângulos
    this.rollLamps.forEach((L, i) => {
      L.on = this.rollLit[i];
      if (!L.on) L.extra = 0.12 + 0.12 * Math.sin(t / 300 + i);
    });
    // decorativas respiram
    this.extraLamps.forEach((L, i) => { L.extra = 0.2 + 0.18 * Math.sin(t / 700 + i * 2); });
    // medidor da mola
    this.meter.forEach((L, i) => {
      if (this.plunger.charging) L.on = i < Math.round(this.plunger.charge * this.meter.length);
      else { L.on = false; if (lanePhase) L.extra = ((Math.floor(t / 110) % 10) === i) ? 0.7 : 0; }
    });
    // bumpers: halo respirando + clarão na batida, engrenagem girando
    this.bumpers.forEach(B => {
      B.flash = Math.max(0, B.flash - dt / 260);
      B.halo.setAlpha((0.22 + 0.08 * Math.sin(t / 420 + B.phase) + B.flash * 0.8) * this.lights.gi);
      B.cap.setAlpha(B.flash * 0.9 * this.lights.gi);
      B.spinBoost = Math.max(0, (B.spinBoost || 0) - dt * 0.00002);
      B.spr.rotation += B.spin * dt * (0.00025 + B.flash * 0.004 + (B.spinBoost || 0));
    });
    // brilho das palhetas acionadas
    this.flippers.forEach(f => {
      const target = f.pressed ? 0.55 : 0;
      f.glow.setAlpha(f.glow.alpha + (target - f.glow.alpha) * Math.min(1, dt / 60));
    });
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

    // botão de pausa (celular)
    const pb = this.add.circle(W - 50, 40, 28, 0x4a250e).setStrokeStyle(3, 0xc9973f).setDepth(21)
      .setInteractive({ useHandCursor: true });
    this.add.text(W - 50, 40, 'II', { fontFamily: UI.FONT_NUM, fontSize: '24px', color: '#ffe7b8' }).setOrigin(0.5).setDepth(22);
    pb.on('pointerup', () => this.togglePause());

    // bolas restantes + dificuldade (no avental de baixo)
    this.livesIcons = [];
    for (let i = 0; i < UAI.CONFIG.LIVES; i++) {
      this.livesIcons.push(this.add.image(46 + i * 40, this.H - 34, 'ball').setDisplaySize(30, 30).setDepth(21));
    }
    this.add.text(this.W - 24, this.H - 34, this.diff.label, {
      fontFamily: UI.FONT_TITLE, fontSize: '24px', color: '#ffd27a', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(1, 0.5).setDepth(21);

    // faixa de mensagens
    this.bannerTxt = this.add.text(this.W / 2, 600, '', {
      fontFamily: UI.FONT_TITLE, fontSize: '58px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 9, align: 'center'
    }).setOrigin(0.5).setDepth(30).setAlpha(0).setShadow(0, 0, '#ff8a20', 24, false, true);
    this.bannerSub = this.add.text(this.W / 2, 660, '', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#ffe7b8', stroke: '#2a1406', strokeThickness: 5
    }).setOrigin(0.5).setDepth(30).setAlpha(0);

    // painel do editor
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
        case 'ArrowLeft': case 'KeyA': this.setFlipper('L', true); break;
        case 'ArrowRight': case 'KeyD': this.setFlipper('R', true); break;
        case 'ArrowDown': case 'Space': case 'KeyS': this.startCharge('key'); break;
        case 'KeyP': case 'Escape': this.togglePause(); break;
        case 'KeyG': this.debugOn = !this.debugOn; if (!this.debugOn) this.debugGfx.clear(); break;
        case 'KeyE': this.toggleEditor(); break;
        default: if (this.editorOn) this.editorKey(ev);
      }
    });
    kb.on('keyup', ev => {
      switch (ev.code) {
        case 'ArrowLeft': case 'KeyA': this.setFlipper('L', false); break;
        case 'ArrowRight': case 'KeyD': this.setFlipper('R', false); break;
        case 'ArrowDown': case 'Space': case 'KeyS': if (this.plunger.mode === 'key') this.fire(); break;
      }
    });

    this.input.on('pointerdown', (p, over) => {
      if (this.editorOn || this.paused) return;
      if (over && over.length) return;              // tocou num botão
      const x = p.worldX, y = p.worldY;
      // canto inferior direito com a bola no corredor = mola (arrastar p/ cima)
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
    if (!f || f.pressed === on) return;
    f.pressed = on;
    if (on && !this.paused) {
      UAI.Sfx.flipper();
      // troca de pista dos triângulos (como no pinball de verdade)
      if (side === 'L') this.rollLit.push(this.rollLit.shift());
      else this.rollLit.unshift(this.rollLit.pop());
    }
  }

  startCharge(mode) {
    if (this.paused || this.editorOn || this.ballState !== 'lane') return;
    this.plunger.charging = true; this.plunger.mode = mode; this.plunger.charge = 0;
    this.plunger.startT = performance.now();
  }

  /** Solta a mola: dá velocidade vertical à bola, proporcional à carga */
  fire() {
    const pl = this.plunger;
    const charge = pl.charge;
    pl.charging = false; pl.mode = null; pl.pointerId = null; pl.charge = 0;
    if (this.ballState !== 'lane') return;
    const p = this.ball.position, [bx, by] = this.layout.ballStart;
    if (Math.abs(p.x - bx) > 30 || p.y < by - 60) return;   // bola precisa estar na base do corredor
    const P = UAI.PHYSICS.plunger;
    const power = (P.min + (P.max - P.min) * charge) * this.diff.plunger;
    this.Body.setVelocity(this.ball, { x: 0, y: -power });
    UAI.Sfx.launch(charge);
    this.lights.flashAll(this.meter, 0.9);
    this.lights.flashAll(this.rim, 0.4);
  }

  togglePause() {
    if (this.ballState === 'over') return;
    this.paused = !this.paused;
    if (this.paused) {
      this.flippers.forEach(f => (f.pressed = false));
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
      this.acc = 0;
    }
  }

  /* =========================================================
     COLISÕES E PONTUAÇÃO
     ========================================================= */
  onCollision(ev) {
    for (const pair of ev.pairs) {
      let a = pair.bodyA.parent || pair.bodyA, b = pair.bodyB.parent || pair.bodyB;
      const other = a === this.ball ? b : (b === this.ball ? a : null);
      if (!other) continue;
      const u = other.uai || {};
      switch (u.type) {
        case 'bumper': this.hitBumper(this.bumpers[u.i], u.i); break;
        case 'sling': this.hitSling(this.slings[u.i]); break;
        case 'ramp': this.onRampSensor(u.which); break;
        case 'rollover': this.onRollover(u.i); break;
        case 'wall': {
          const now = this.time.now;
          if (now - this.lastWallSound > 90 && this.Body.getSpeed(this.ball) > 8) { UAI.Sfx.wall(); this.lastWallSound = now; }
          break;
        }
      }
    }
  }

  hitBumper(B, i) {
    const now = this.time.now;
    if (!B || now - B.last < 70) return;
    if (B.sensor) {                      // roda: gira e pontua, sem chute
      if (now - B.last < 300) return;
      B.last = now; B.flash = 1;
      B.spinBoost = Math.min(0.04, this.Body.getSpeed(this.ball) * 0.0015);
      UAI.Sfx.bumper(5);
      this.addScore(UAI.CONFIG.POINTS.bumper, B.x, B.y - 20);
      return;
    }
    B.last = now;
    // vetor radial para fora: centro do bumper → bola
    const p = this.ball.position;
    let dx = p.x - B.x, dy = p.y - B.y;
    const d = Math.hypot(dx, dy) || 1;
    const kick = this.diff.bumperKick;
    this.pendingKick = { x: (dx / d) * kick, y: (dy / d) * kick };
    B.flash = 1;
    this.tweens.add({ targets: B.spr, scaleX: B.baseScale * 1.12, scaleY: B.baseScale * 1.12, duration: 60, yoyo: true });
    UAI.Sfx.bumper(i);
    this.addScore(UAI.CONFIG.POINTS.bumper, B.x, B.y - B.r - 14);
    this.lights.flashAll(this.rim, 0.25);
  }

  hitSling(S) {
    const now = this.time.now;
    if (!S || now - S.last < 120) return;
    const p = this.ball.position;
    const rx = p.x - S.a.x, ry = p.y - S.a.y;
    const dist = rx * S.n.x + ry * S.n.y;        // distância até a face de chute
    const along = rx * S.t.x + ry * S.t.y;       // posição ao longo da face
    if (dist < -4 || along < -8 || along > S.len + 8) return;   // bateu em outro lado do triângulo
    S.last = now;
    const v = this.Body.getVelocity(this.ball);
    const tang = (v.x * S.t.x + v.y * S.t.y) * 0.4;
    const k = UAI.PHYSICS.sling.kick;
    this.pendingKick = { x: S.n.x * k + S.t.x * tang, y: S.n.y * k + S.t.y * tang };
    this.lights.flashAll(S.lamps, 1);
    UAI.Sfx.sling();
    this.addScore(UAI.CONFIG.POINTS.sling, p.x, p.y - 30);
  }

  /** Rampa: portão da direita → topo → saída esquerda (ou o contrário) = +500 */
  onRampSensor(which) {
    const now = this.time.now, R = this.ramp;
    if (this.ballState !== 'play') return;      // lançamento da mola não conta
    // ACELERADOR do portão da direita: bola subindo ganha um empurrão para vencer a rampa
    if (which === 'right') {
      const v = this.Body.getVelocity(this.ball), sp = Math.hypot(v.x, v.y);
      if (v.y < -2 && sp > 0) {
        const boost = Math.max(sp, UAI.PHYSICS.rampBoost);
        const [dx, dy] = UAI.PHYSICS.rampBoostDir;      // empurra ao longo do canal da rampa
        const dl = Math.hypot(dx, dy) || 1;
        this.pendingKick = { x: (dx / dl) * boost, y: (dy / dl) * boost };
        this.lights.flashAll(this.chevrons, 1);
        UAI.Sfx.launch(0.5);
      }
    }
    if (which === 'apex') {
      if (R.entrySide && now - R.entryAt < 3500) R.apexAt = now;
      return;
    }
    if (R.apexAt && now - R.apexAt < 3000 && R.entrySide && R.entrySide !== which) {
      this.rampComplete();
      this.ramp = { entrySide: null, entryAt: 0, apexAt: 0 };
    } else {
      this.ramp = { entrySide: which, entryAt: now, apexAt: 0 };
    }
  }

  rampComplete() {
    const pos = this.layout.ramp.apex;
    this.addScore(UAI.CONFIG.POINTS.ramp, pos[0], pos[1] + 50);
    this.banner('RAMPA!', '+' + UAI.fmt(UAI.CONFIG.POINTS.ramp * this.mult), '#ffd27a');
    UAI.Sfx.ramp();
    this.party = 1200;
    this.lights.flashAll(this.chevrons, 1);
    this.cameras.main.flash(160, 255, 200, 120);
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

    // carga da mola pelo relógio real (não pelo tempo da física, que pode atrasar em aparelho lento)
    if (this.plunger.charging && this.plunger.mode === 'key') {
      this.plunger.charge = Math.min(1, (performance.now() - this.plunger.startT) / UAI.PHYSICS.plunger.chargeTime);
    }
    const dt = Math.min(delta, 50);
    const h = 1000 / 60 / UAI.CONFIG.SUBSTEPS;     // sub-passo fixo
    this.acc += dt;
    let n = 0;
    while (this.acc >= h && n < UAI.CONFIG.SUBSTEPS * 3) {
      this.physicsStep(h, dt);
      this.acc -= h; n++;
    }
    if (n >= UAI.CONFIG.SUBSTEPS * 3) this.acc = 0;

    this.syncVisuals(dt);
    this.checkBall(dt);
    this.updateLights(dt, time);
    if (this.debugOn) this.drawDebug();
  }

  physicsStep(h) {
    this.flippers.forEach(f => this.stepFlipper(f, h));
    this.matter.world.step(h);
    // chutes de bumper/estilingue aplicados DEPOIS da resolução da colisão
    if (this.pendingKick) { this.Body.setVelocity(this.ball, this.pendingKick); this.pendingKick = null; }
    // limite de velocidade (dificuldade)
    const sp = this.Body.getSpeed(this.ball), max = this.diff.maxSpeed;
    if (sp > max) this.Body.setSpeed(this.ball, max);
  }

  syncVisuals(dt) {
    const p = this.ball.position;
    this.ballSpr.setPosition(p.x, p.y).setRotation(this.ball.angle);
    this.ballLamp.setPosition(p.x, p.y);
    // rastro
    this.trailPts.unshift({ x: p.x, y: p.y });
    if (this.trailPts.length > 16) this.trailPts.length = 16;
    const sp = this.Body.getSpeed(this.ball);
    const k = Phaser.Math.Clamp((sp - 6) / 18, 0, 1);
    this.trail.forEach((img, i) => {
      const q = this.trailPts[i * 2 + 1];
      if (!q || this.ballState === 'drain') { img.setAlpha(0); return; }
      const s = 34 - i * 3;
      img.setPosition(q.x, q.y).setDisplaySize(s, s).setAlpha(k * 0.5 * (1 - i / this.trail.length));
    });
    // palhetas
    this.flippers.forEach(f => {
      f.sprite.setPosition(f.body.position.x, f.body.position.y).setRotation(f.body.angle + f.rotOffset);
    });
    // haste da mola
    const g = this.plungerGfx, [bx, by] = this.layout.ballStart;
    g.clear();
    const top = by + UAI.PHYSICS.ball.radius + 2 + this.plunger.charge * 22;
    g.fillStyle(0xc9973f, 1).fillRect(bx - 12, top, 24, 8);
    g.fillStyle(0x8a6a33, 1).fillRect(bx - 4, top + 8, 8, 30);
  }

  checkBall(dt) {
    if (this.ballState === 'drain' || this.ballState === 'over') return;
    const p = this.ball.position, C = UAI.CONFIG;
    const [bx] = this.layout.ballStart;
    // saiu do corredor → bola em jogo
    if (this.ballState === 'lane' && p.y < 300) this.ballState = 'play';
    // voltou para a base do corredor → pode relançar
    if (this.ballState === 'play' && Math.abs(p.x - bx) < 26 && p.y > this.layout.ballStart[1] - 40 && this.Body.getSpeed(this.ball) < 1) {
      this.ballState = 'lane';
    }
    // dreno
    if (p.y > C.DRAIN_Y || p.x < -40 || p.x > this.W + 40 || p.y < -60) { this.drain(); return; }
    // bola parada fora do corredor → "sacudida" automática
    if (this.ballState === 'play' && this.Body.getSpeed(this.ball) < 0.25) {
      this.stuckTime += dt;
      if (this.stuckTime > 3500) {
        this.stuckTime = 0;
        this.Body.setVelocity(this.ball, { x: Phaser.Math.Between(-4, 4), y: -9 });
        this.cameras.main.shake(180, 0.006);
        this.banner('SACUDIDA!');
      }
    } else this.stuckTime = 0;
  }

  drain() {
    this.ballState = 'drain';
    this.lives--;
    this.Body.setStatic(this.ball, true);
    this.Body.setPosition(this.ball, { x: -200, y: -200 });
    UAI.Sfx.drain();
    this.lights.giTarget = 0.08;                // luzes apagam como pinball de verdade
    this.ambient.setAlpha(0.5);
    if (this.drainLamp) this.drainLamp.flash = 1.3;
    this.cameras.main.shake(250, 0.008);
    this.flippers.forEach(f => (f.pressed = false));
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
     DEBUG: desenha as colisões em vermelho (tecla G ou ?debug=1)
     ========================================================= */
  drawDebug() {
    const g = this.debugGfx;
    g.clear();
    const draw = (body, color, width = 2) => {
      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
      parts.forEach(pt => {
        const v = pt.vertices;
        g.lineStyle(width, color, 0.95);
        g.beginPath(); g.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y);
        g.closePath(); g.strokePath();
      });
    };
    this.tableBodies.forEach(b => draw(b, b.isSensor ? 0xffe040 : 0xff2020));
    this.flippers.forEach(f => {
      draw(f.body, 0xff2020, 3);
      g.fillStyle(0x00ff66, 1).fillCircle(f.pivot.x, f.pivot.y, 4);
    });
    if (!this.ball.isStatic) draw(this.ball, 0x40ff40);
    if (this.editorOn) {
      g.lineStyle(1, 0xffffff, 0.8);
      this.layout.walls.forEach(w => g.strokePoints(w.pts.map(([x, y]) => ({ x, y }))));
    }
  }

  /* =========================================================
     EDITOR DE PONTOS (tecla E ou ?editor=1)
     Arraste as alças, solte para reconstruir as colisões.
     ========================================================= */
  toggleEditor() {
    this.editorOn = !this.editorOn;
    if (this.editorOn) {
      this.debugOn = true;
      this.flippers.forEach(f => (f.pressed = false));
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
    L.walls.forEach((w, wi) => w.pts.forEach((pt, pi) => mk(pt[0], pt[1], 0xff3030, (x, y) => { pt[0] = x; pt[1] = y; }, { kind: 'wall', wi, pi })));
    (L.blocks || []).forEach(b => b.pts.forEach(pt => mk(pt[0], pt[1], 0xff8800, (x, y) => { pt[0] = x; pt[1] = y; }, { kind: 'block' })));
    L.slings.forEach(s => s.pts.forEach(pt => mk(pt[0], pt[1], 0xff8800, (x, y) => { pt[0] = x; pt[1] = y; }, { kind: 'sling' })));
    L.bumpers.forEach((b, i) => mk(b.x, b.y, 0x30e0ff, (x, y) => { b.x = x; b.y = y; }, { kind: 'bumper', i }));
    ['left', 'right'].forEach(k => { const p = L.flippers[k]; mk(p[0], p[1], 0x30ff60, (x, y) => { p[0] = x; p[1] = y; }, { kind: 'flipper' }); });
    Object.values(L.ramp).forEach(p => mk(p[0], p[1], 0xffe040, (x, y) => { p[0] = x; p[1] = y; }, { kind: 'sensor' }));
    L.rollovers.forEach(p => mk(p[0], p[1], 0xffe040, (x, y) => { p[0] = x; p[1] = y; }, { kind: 'sensor' }));
    const LT = L.lights || {};
    ['chevrons', 'grid', 'extra'].forEach(k => (LT[k] || []).forEach(p => mk(p[0], p[1], 0xff40ff, (x, y) => { p[0] = x; p[1] = y; }, { kind: 'light' })));
    if (LT.drain) mk(LT.drain[0], LT.drain[1], 0xff40ff, (x, y) => { LT.drain[0] = x; LT.drain[1] = y; }, { kind: 'light' });
    mk(L.ballStart[0], L.ballStart[1], 0x4080ff, (x, y) => { L.ballStart[0] = x; L.ballStart[1] = y; }, { kind: 'start' });
  }

  destroyHandles() { (this.handles || []).forEach(h => h.destroy()); this.handles = []; this.selected = null; }

  select(h) {
    if (this.selected && this.selected.active) this.selected.setStrokeStyle(2, 0x000000);
    this.selected = h; h.setStrokeStyle(4, 0xffffff);
  }

  rebuild() {
    this.buildTable();
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
          b.r = Phaser.Math.Clamp(b.r + (ev.code === 'Equal' || ev.code === 'NumpadAdd' ? 2 : -2), 8, 120);
          this.rebuild();
        }
        break;
    }
  }
}
