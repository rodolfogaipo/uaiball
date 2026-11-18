/* ============================================================
   UAI BALL – MOTOR DE FÍSICA DE PINBALL (próprio, sem Matter.js)
   ------------------------------------------------------------
   Baseado em como os simuladores de verdade fazem:
   • Visual Pinball X (github.com/vpinball/vpinball, src/physics):
       - física a 1000 passos por segundo (1 ms por passo)
       - elasticidade da borracha cai com a força do impacto
         e = e0 / (1 + falloff · |v| / 1 m/s)
       - a palheta é um corpo que GIRA: a velocidade da superfície no
         ponto de contato (ω × r) é que dá a tacada; ponta bate mais
         forte que a base
       - bumper e estilingue só "chutam" acima de um limiar de impacto
   • Space Cadet Pinball (github.com/k4zmu2a/SpaceCadetPinball):
       - palheta = cápsula (círculo na base + círculo na ponta)
       - buracos com "campo de gravidade" que puxa a bola (FieldEffect)
   Unidades: pixels e segundos. A bola tem 28 px (≈ 27 mm reais),
   então 1 m ≈ 1040 px.
   ============================================================ */
window.UAI = window.UAI || {};

UAI.PinballWorld = class PinballWorld {
  constructor(cfg) {
    this.cfg = Object.assign({
      gravity: 1300,      // px/s² ao longo da mesa (mesa inclinada ~6,5°)
      step: 1 / 1000,     // 1 ms por passo, igual ao Visual Pinball X
      maxSpeed: 4800,     // px/s – trava de segurança
      rollDrag: 0.06,     // resistência ao rolamento (1/s)
      mps: 1040,          // px por 1 m/s (usado no falloff da elasticidade)
      cell: 48            // tamanho da célula da grade de busca
    }, cfg || {});
    this.ball = { x: 0, y: 0, vx: 0, vy: 0, r: 14, frozen: true, spin: 0 };
    this.flippers = [];
    this.onHit = null;      // (collider, impactSpeed) => void
    this.onSensor = null;   // (sensor) => void  (quando a bola entra)
    this.time = 0;
    this.acc = 0;
    this.clear();
  }

  clear() {
    this.colliders = [];
    this.sensors = [];
    this.fields = [];
    this.grid = new Map();
  }

  /* ---------------- construção ---------------- */
  mat(m) {
    return Object.assign({ e: 0.4, fo: 0, mu: 0.0, kick: 0, thr: 0, face: null, cool: 0.12, pass: null }, m || {});
  }

  _insert(c) {
    const r = this.ball.r + 2, s = this.cfg.cell;
    const x0 = Math.floor((c.minX - r) / s), x1 = Math.floor((c.maxX + r) / s);
    const y0 = Math.floor((c.minY - r) / s), y1 = Math.floor((c.maxY + r) / s);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const k = gx * 100000 + gy;
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(c);
    }
    this.colliders.push(c);
    return c;
  }

  /** Segmento de reta (parede, face de estilingue, trilho) */
  addSegment(ax, ay, bx, by, mat, tag) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    return this._insert({
      type: 'seg', ax, ay, bx, by, dx, dy, len2: len * len,
      nx: -dy / len, ny: dx / len, // normal (um dos lados)
      minX: Math.min(ax, bx), maxX: Math.max(ax, bx), minY: Math.min(ay, by), maxY: Math.max(ay, by),
      m: this.mat(mat), tag: tag || 'wall', last: -1
    });
  }

  /** Círculo sólido (poste, bumper, ponta de trilho) */
  addCircle(x, y, r, mat, tag) {
    return this._insert({
      type: 'circ', x, y, r,
      minX: x - r, maxX: x + r, minY: y - r, maxY: y + r,
      m: this.mat(mat), tag: tag || 'post', last: -1
    });
  }

  /** Linha poligonal (com postes nas juntas para a bola não enganchar) */
  addPolyline(pts, mat, tag, closed) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1 + (closed ? 1 : 0); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push(this.addSegment(a[0], a[1], b[0], b[1], mat, tag));
    }
    return out;
  }

  /** Sensor redondo: avisa quando a bola entra (não colide) */
  addSensor(x, y, r, tag, data) {
    const s = { x, y, r, tag, data, inside: false, enabled: true, continuous: false };
    this.sensors.push(s);
    return s;
  }

  /** Campo que puxa a bola para o centro (buraco negro / buracos) */
  addField(x, y, r, pull) {
    const f = { x, y, r, pull, enabled: true };
    this.fields.push(f);
    return f;
  }

  /** Palheta: cápsula afunilada que gira em torno do pivô.
      side: +1 = esquerda (ponta para a direita), -1 = direita */
  addFlipper(o) {
    const f = Object.assign({
      px: 0, py: 0, side: 1, len: 160, rb: 16, rt: 9,
      rest: 30 * Math.PI / 180,   // ângulo em repouso (local, + = ponta para baixo)
      up: -28 * Math.PI / 180,    // ângulo acionada
      omegaMax: 20,               // rad/s – velocidade máxima de subida
      accUp: 2600,                // rad/s² – bobina (chega no máximo em ~8 ms)
      omegaDown: 13, accDown: 900,// retorno pela mola
      e: 0.8, fo: 0.43, mu: 0.2,  // borracha (valores padrão do Visual Pinball X)
      pressed: false
    }, o);
    f.theta = f.rest; f.omega = 0;
    this.flippers.push(f);
    return f;
  }

  /** ângulo da palheta no mundo (tela) */
  flipperAngle(f) { return f.side > 0 ? f.theta : Math.PI - f.theta; }

  /* ---------------- simulação ---------------- */
  /** Avança dt segundos em passos fixos de 1 ms. Retorna nº de passos. */
  update(dt) {
    this.acc += Math.min(dt, 0.05);
    const h = this.cfg.step;
    let n = 0;
    while (this.acc >= h) {
      this.stepOnce(h);
      this.acc -= h;
      n++;
    }
    return n;
  }

  stepOnce(h) {
    this.time += h;
    for (const f of this.flippers) this._moveFlipper(f, h);
    const b = this.ball;
    if (b.frozen) return;

    // gravidade + campos de atração (buracos)
    b.vy += this.cfg.gravity * h;
    for (const F of this.fields) {
      if (!F.enabled) continue;
      const dx = F.x - b.x, dy = F.y - b.y, d = Math.hypot(dx, dy);
      if (d < F.r && d > 0.5) {
        const k = F.pull * (1 - d / F.r) * h / d;
        b.vx += dx * k; b.vy += dy * k;
      }
    }
    // resistência ao rolamento
    const drag = 1 - this.cfg.rollDrag * h;
    b.vx *= drag; b.vy *= drag;

    b.x += b.vx * h;
    b.y += b.vy * h;

    // colisões (2 iterações resolvem quinas e cantos)
    const s = this.cfg.cell;
    const list = this.grid.get(Math.floor(b.x / s) * 100000 + Math.floor(b.y / s));
    for (let it = 0; it < 2; it++) {
      if (list) for (let i = 0; i < list.length; i++) this._collide(list[i]);
      for (const f of this.flippers) this._collideFlipper(f);
    }

    // trava de velocidade
    const sp = Math.hypot(b.vx, b.vy), max = this.cfg.maxSpeed;
    if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
    b.spin = sp;

    // sensores
    for (const S of this.sensors) {
      if (!S.enabled) continue;
      const inside = (b.x - S.x) ** 2 + (b.y - S.y) ** 2 < S.r * S.r;
      // continuous: avisa a cada passo enquanto a bola estiver dentro (buracos)
      if (inside && (!S.inside || S.continuous) && this.onSensor) { S.inside = true; this.onSensor(S); }
      else S.inside = inside;
      if (b.frozen) return; // um sensor (buraco) pode ter capturado a bola
    }
  }

  _elastic(e, fo, vn) {
    return fo > 0 ? e / (1 + fo * Math.abs(vn) / this.cfg.mps) : e;
  }

  /** Bola contra parede/poste/bumper */
  _collide(c) {
    const b = this.ball;
    let qx, qy, rad;
    if (c.type === 'seg') {
      let t = ((b.x - c.ax) * c.dx + (b.y - c.ay) * c.dy) / c.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      qx = c.ax + c.dx * t; qy = c.ay + c.dy * t; rad = b.r;
    } else {
      qx = c.x; qy = c.y; rad = b.r + c.r;
    }
    let dx = b.x - qx, dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return;
    // portão de mão única: deixa passar quem vai no sentido "pass"
    if (c.m.pass && b.vx * c.m.pass[0] + b.vy * c.m.pass[1] > 0) return;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) { nx = c.nx || 0; ny = c.ny || -1; d = 0; }
    else { nx = dx / d; ny = dy / d; }
    // empurra para fora
    const pen = rad - d;
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const m = c.m;
    const e = this._elastic(m.e, m.fo, vn);
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    // atrito tangencial (limitado pelo cone de Coulomb)
    if (m.mu > 0) {
      const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
      const dv = Math.min(Math.abs(vt), m.mu * (1 + e) * -vn);
      b.vx -= Math.sign(vt) * dv * tx; b.vy -= Math.sign(vt) * dv * ty;
    }
    // chute ativo (bumper / estilingue): só acima do limiar e na face certa
    let kicked = false;
    if (m.kick > 0 && -vn >= m.thr && this.time - c.last > m.cool &&
        (!m.face || nx * m.face[0] + ny * m.face[1] > 0.5)) {
      const kx = m.face ? m.face[0] : nx, ky = m.face ? m.face[1] : ny;
      b.vx += kx * m.kick; b.vy += ky * m.kick;
      c.last = this.time;
      kicked = true;
    }
    if (this.onHit) this.onHit(c, -vn, kicked);
  }

  /* ---------------- palhetas ---------------- */
  _moveFlipper(f, h) {
    if (f.pressed) {
      f.omega = Math.max(f.omega - f.accUp * h, -f.omegaMax);
      f.theta += f.omega * h;
      if (f.theta <= f.up) { f.theta = f.up; f.omega = 0; }
    } else {
      f.omega = Math.min(f.omega + f.accDown * h, f.omegaDown);
      f.theta += f.omega * h;
      if (f.theta >= f.rest) { f.theta = f.rest; f.omega = 0; }
    }
  }

  _collideFlipper(f) {
    const b = this.ball;
    const a = this.flipperAngle(f), ux = Math.cos(a), uy = Math.sin(a);
    const rx = b.x - f.px, ry = b.y - f.py;
    // descarte rápido
    if (rx * rx + ry * ry > (f.len + f.rb + b.r) ** 2) return;
    let t = rx * ux + ry * uy;
    t = t < 0 ? 0 : t > f.len ? f.len : t;
    const rr = f.rb + (f.rt - f.rb) * (t / f.len);
    const qx = f.px + ux * t, qy = f.py + uy * t;
    let dx = b.x - qx, dy = b.y - qy;
    const lim = b.r + rr, d2 = dx * dx + dy * dy;
    if (d2 >= lim * lim) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d, ny = dy / d;
    b.x += nx * (lim - d); b.y += ny * (lim - d);
    // velocidade da superfície da palheta no ponto de contato: ω × r
    const w = f.side * f.omega;            // rad/s no sentido da tela
    const cx = b.x - nx * b.r - f.px, cy = b.y - ny * b.r - f.py;
    const vfx = -w * cy, vfy = w * cx;
    const relx = b.vx - vfx, rely = b.vy - vfy;
    const vn = relx * nx + rely * ny;
    if (vn >= 0) return;
    const e = this._elastic(f.e, f.fo, vn);
    // palheta empurrada pela bobina = massa "infinita" (como o VPX faz quando ela está segura pela bobina)
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (f.mu > 0) {
      const tx = -ny, ty = nx, vt = relx * tx + rely * ty;
      const dv = Math.min(Math.abs(vt), f.mu * (1 + e) * -vn) * 0.5;
      b.vx -= Math.sign(vt) * dv * tx; b.vy -= Math.sign(vt) * dv * ty;
    }
    if (this.onHit) this.onHit({ tag: 'flipper', flipper: f }, -vn, false);
  }

  /* ---------------- utilidades ---------------- */
  placeBall(x, y, vx = 0, vy = 0) {
    const b = this.ball;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.frozen = false;
    this.sensors.forEach(S => { S.inside = (x - S.x) ** 2 + (y - S.y) ** 2 < S.r * S.r; });
  }
  freeze(x, y) {
    const b = this.ball;
    b.frozen = true; b.vx = 0; b.vy = 0;
    if (x != null) { b.x = x; b.y = y; }
  }
  speed() { return Math.hypot(this.ball.vx, this.ball.vy); }
};
