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
   Suporta várias bolas ao mesmo tempo (MULTIBOLA), com colisão
   bola-contra-bola, e alvos que caem (colisor liga/desliga).
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
      cell: 48,           // tamanho da célula da grade de busca
      ballRadius: 14,
      ballE: 0.9          // elasticidade bola contra bola
    }, cfg || {});
    this.balls = [];
    this.flippers = [];
    this.onHit = null;      // (collider, impactSpeed, kicked, ball) => void
    this.onSensor = null;   // (sensor, ball) => void  (quando a bola entra)
    this.time = 0;
    this.acc = 0;
    this._nextId = 1;
    this.clear();
  }

  clear() {
    this.colliders = [];
    this.sensors = [];
    this.fields = [];
    this.grid = new Map();
    this.balls.forEach(b => b.inside.clear());
  }

  /* ---------------- bolas ---------------- */
  addBall(x, y, vx = 0, vy = 0) {
    const b = { id: this._nextId++, x, y, vx, vy, r: this.cfg.ballRadius, frozen: false, inside: new Set(), data: {} };
    this.balls.push(b);
    this._refreshInside(b);
    return b;
  }
  removeBall(b) {
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }
  placeBall(b, x, y, vx = 0, vy = 0) {
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.frozen = false;
    this._refreshInside(b);
  }
  freeze(b, x, y) {
    b.frozen = true; b.vx = 0; b.vy = 0;
    if (x != null) { b.x = x; b.y = y; }
  }
  speed(b) { return Math.hypot(b.vx, b.vy); }
  _refreshInside(b) {
    b.inside.clear();
    this.sensors.forEach(S => { if ((b.x - S.x) ** 2 + (b.y - S.y) ** 2 < S.r * S.r) b.inside.add(S); });
  }

  /* ---------------- construção ---------------- */
  mat(m) {
    return Object.assign({ e: 0.4, fo: 0, mu: 0.0, kick: 0, thr: 0, face: null, cool: 0.12, pass: null }, m || {});
  }

  _insert(c) {
    const r = this.cfg.ballRadius + 2, s = this.cfg.cell;
    const x0 = Math.floor((c.minX - r) / s), x1 = Math.floor((c.maxX + r) / s);
    const y0 = Math.floor((c.minY - r) / s), y1 = Math.floor((c.maxY + r) / s);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const k = gx * 100000 + gy;
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(c);
    }
    c.off = false;          // off = true → colisor desligado (alvo que caiu)
    this.colliders.push(c);
    return c;
  }

  /** Segmento de reta (parede, face de estilingue, trilho, alvo) */
  addSegment(ax, ay, bx, by, mat, tag, t = 0) {
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    return this._insert({
      type: 'seg', ax, ay, bx, by, dx, dy, len2: len * len, t,
      nx: -dy / len, ny: dx / len,
      minX: Math.min(ax, bx) - t, maxX: Math.max(ax, bx) + t, minY: Math.min(ay, by) - t, maxY: Math.max(ay, by) + t,
      m: this.mat(mat), tag: tag || 'wall', last: -1
    });
  }

  /** Círculo sólido (poste, bumper) */
  addCircle(x, y, r, mat, tag) {
    return this._insert({
      type: 'circ', x, y, r,
      minX: x - r, maxX: x + r, minY: y - r, maxY: y + r,
      m: this.mat(mat), tag: tag || 'post', last: -1
    });
  }

  addPolyline(pts, mat, tag, closed, t = 0) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1 + (closed ? 1 : 0); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      out.push(this.addSegment(a[0], a[1], b[0], b[1], mat, tag, t));
    }
    return out;
  }

  /** Sensor redondo: avisa quando a bola entra (não colide) */
  addSensor(x, y, r, tag, data) {
    const s = { x, y, r, tag, data, enabled: true, continuous: false };
    this.sensors.push(s);
    return s;
  }

  /** Campo que puxa a bola para o centro (buraco negro / ímã) */
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
      rest: 30 * Math.PI / 180, up: -28 * Math.PI / 180,
      omegaMax: 20, accUp: 2600, omegaDown: 13, accDown: 900,
      e: 0.8, fo: 0.43, mu: 0.2,
      pressed: false
    }, o);
    f.theta = f.rest; f.omega = 0;
    this.flippers.push(f);
    return f;
  }

  flipperAngle(f) { return f.side > 0 ? f.theta : Math.PI - f.theta; }

  /* ---------------- simulação ---------------- */
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
    const balls = this.balls;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (!b.frozen) this._stepBall(b, h);
    }
    // bola contra bola
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j];
      if (a.frozen || b.frozen) continue;
      this._ballBall(a, b);
    }
    // sensores (depois de tudo, para cada bola)
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.frozen) continue;
      for (const S of this.sensors) {
        if (!S.enabled) continue;
        const inside = (b.x - S.x) ** 2 + (b.y - S.y) ** 2 < S.r * S.r;
        const was = b.inside.has(S);
        if (inside) {
          if (!was) b.inside.add(S);
          if ((!was || S.continuous) && this.onSensor) this.onSensor(S, b);
        } else if (was) b.inside.delete(S);
        if (b.frozen) break; // capturada por um buraco
      }
    }
  }

  _stepBall(b, h) {
    b.vy += this.cfg.gravity * h;
    for (const F of this.fields) {
      if (!F.enabled) continue;
      const dx = F.x - b.x, dy = F.y - b.y, d = Math.hypot(dx, dy);
      if (d < F.r && d > 0.5) {
        const k = F.pull * (1 - d / F.r) * h / d;
        b.vx += dx * k; b.vy += dy * k;
      }
    }
    const drag = 1 - this.cfg.rollDrag * h;
    b.vx *= drag; b.vy *= drag;
    b.x += b.vx * h;
    b.y += b.vy * h;

    const s = this.cfg.cell;
    const list = this.grid.get(Math.floor(b.x / s) * 100000 + Math.floor(b.y / s));
    for (let it = 0; it < 2; it++) {
      if (list) for (let i = 0; i < list.length; i++) if (!list[i].off) this._collide(list[i], b);
      for (const f of this.flippers) this._collideFlipper(f, b);
    }
    const sp = Math.hypot(b.vx, b.vy), max = this.cfg.maxSpeed;
    if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
  }

  _ballBall(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 1e-6) return;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (rr - d) / 2;
    a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn >= 0) return;
    const j = -(1 + this.cfg.ballE) * vn / 2;   // massas iguais
    a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
    if (this.onHit) this.onHit({ tag: 'ball' }, -vn, false, a);
  }

  _elastic(e, fo, vn) {
    return fo > 0 ? e / (1 + fo * Math.abs(vn) / this.cfg.mps) : e;
  }

  _collide(c, b) {
    let qx, qy, rad;
    if (c.type === 'seg') {
      let t = ((b.x - c.ax) * c.dx + (b.y - c.ay) * c.dy) / c.len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      qx = c.ax + c.dx * t; qy = c.ay + c.dy * t; rad = b.r + c.t;
    } else {
      qx = c.x; qy = c.y; rad = b.r + c.r;
    }
    const dx = b.x - qx, dy = b.y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad) return;
    if (c.m.pass && b.vx * c.m.pass[0] + b.vy * c.m.pass[1] > 0) return;  // portão de mão única
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-6) { nx = c.nx || 0; ny = c.ny || -1; d = 0; }
    else { nx = dx / d; ny = dy / d; }
    const pen = rad - d;
    b.x += nx * pen; b.y += ny * pen;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const m = c.m;
    const e = this._elastic(m.e, m.fo, vn);
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (m.mu > 0) {
      const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
      const dv = Math.min(Math.abs(vt), m.mu * (1 + e) * -vn);
      b.vx -= Math.sign(vt) * dv * tx; b.vy -= Math.sign(vt) * dv * ty;
    }
    let kicked = false;
    if (m.kick > 0 && -vn >= m.thr && this.time - c.last > m.cool &&
        (!m.face || nx * m.face[0] + ny * m.face[1] > 0.5)) {
      const kx = m.face ? m.face[0] : nx, ky = m.face ? m.face[1] : ny;
      b.vx += kx * m.kick; b.vy += ky * m.kick;
      c.last = this.time;
      kicked = true;
    }
    if (this.onHit) this.onHit(c, -vn, kicked, b);
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

  _collideFlipper(f, b) {
    const a = this.flipperAngle(f), ux = Math.cos(a), uy = Math.sin(a);
    const rx = b.x - f.px, ry = b.y - f.py;
    if (rx * rx + ry * ry > (f.len + f.rb + b.r) ** 2) return;
    let t = rx * ux + ry * uy;
    t = t < 0 ? 0 : t > f.len ? f.len : t;
    const rr = f.rb + (f.rt - f.rb) * (t / f.len);
    const qx = f.px + ux * t, qy = f.py + uy * t;
    const dx = b.x - qx, dy = b.y - qy;
    const lim = b.r + rr, d2 = dx * dx + dy * dy;
    if (d2 >= lim * lim) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d, ny = dy / d;
    b.x += nx * (lim - d); b.y += ny * (lim - d);
    const w = f.side * f.omega;
    const cx = b.x - nx * b.r - f.px, cy = b.y - ny * b.r - f.py;
    const vfx = -w * cy, vfy = w * cx;
    const relx = b.vx - vfx, rely = b.vy - vfy;
    const vn = relx * nx + rely * ny;
    if (vn >= 0) return;
    const e = this._elastic(f.e, f.fo, vn);
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    if (f.mu > 0) {
      const tx = -ny, ty = nx, vt = relx * tx + rely * ty;
      const dv = Math.min(Math.abs(vt), f.mu * (1 + e) * -vn) * 0.5;
      b.vx -= Math.sign(vt) * dv * tx; b.vy -= Math.sign(vt) * dv * ty;
    }
    if (this.onHit) this.onHit({ tag: 'flipper', flipper: f }, -vn, false, b);
  }
};
