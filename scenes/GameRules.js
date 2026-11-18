/* ============================================================
   GameRules – as REGRAS do fliperama (vale para todas as mesas)
   ------------------------------------------------------------
   Regras clássicas, como nas máquinas Williams/Bally dos anos 80-90
   (ex.: PIN·BOT, Space Cadet):
   • tacada de mestre no lançador (soltar na luz verde)
   • tiros (rampas, órbitas) com COMBO se emendar um no outro
   • pistas de rolagem: troca com as palhetas, completar = prêmio
   • alvos que caem / alvos fixos com letras
   • buracos, TRAVAS de bola → MULTIBOLA com JACKPOT
   • kickback na outlane, bola salva, bola extra, TILT
   • bônus de fim de bola × multiplicador de bônus
   • MISSÕES em sequência (cumprir todas = MESA DOMINADA)
   ============================================================ */

Object.assign(GameScene.prototype, {

  /* ---------------- eventos do motor ---------------- */
  onHit(c, imp, kicked, b) {
    if (!b || (b.data.state !== 'play' && b.data.state !== 'lane')) return;
    switch (c.tag) {
      case 'bumper': if (kicked) this.hitBumper(this.bumpers[c.data], c.data, b); break;
      case 'sling': if (kicked) this.hitSling(this.slings[c.data], c, b); break;
      case 'drop': if (imp > 90) this.dropHit(c.data, b); break;
      case 'target': if (imp > 80) this.targetHit(c.data, b); break;
      case 'flipper': b.data.slingChain = 0; break;
      case 'ball': if (imp > 250) UAI.Sfx.wall(); break;
      default: {
        if (imp > 350 && this.now - (this.lastWallSound || 0) > 90) { UAI.Sfx.wall(); this.lastWallSound = this.now; }
      }
    }
  },

  onSensor(S, b) {
    if (b.data.state !== 'play') return;
    switch (S.tag) {
      case 'named': this.onNamed(S.data, b); break;
      case 'hole': this.captureHole(this.holes[S.data], b); break;
      case 'kicker': this.touchKicker(this.kickers[S.data], b); break;
      case 'lane': this.laneRoll(S.data, b); break;
      case 'spinner': this.spin(S.data, b); break;
      case 'rampMouth': this.tryRamp(this.ramps[S.data], b); break;
      case 'wheel': this.hitWheel(this.bumpers[S.data], b); break;
      case 'shock': this.shockBoost(this.bumpers[S.data], S.data, b); break;
      case 'btarget': {
        const B = this.bumpers[S.data];
        if (B && this.now - B.last > 200) { B.last = this.now; this.hitBumper(B, S.data, b); }
        break;
      }
    }
  },

  dirOk(dir, b) { return !dir || (dir === 'up' ? b.vy < -100 : dir === 'down' ? b.vy > 100 : true); },

  /* ---------------- sensores com nome ---------------- */
  onNamed(name, b) {
    const L = this.layout;
    (L.accels || []).forEach(A => {
      if (A.sensor !== name || !this.dirOk(A.when, b)) return;
      const [dx, dy] = A.dir, dl = Math.hypot(dx, dy) || 1, sp = Math.max(this.world.speed(b), A.speed);
      if (A.minX != null) b.x = Math.max(b.x, A.minX);
      b.vx = dx / dl * sp; b.vy = dy / dl * sp;
      UAI.Sfx.launch(0.5);
      Object.values(this.shotLamps).forEach(ls => this.lights.flashAll(ls, 0.8));
    });
    (L.exits || []).forEach(E => {
      if (E.sensor !== name || !this.dirOk(E.when, b)) return;
      const sp = Math.max(E.minSpeed || 0, Math.min(this.world.speed(b), E.maxSpeed)), dl = Math.hypot(E.dir[0], E.dir[1]);
      b.vx = E.dir[0] / dl * sp; b.vy = E.dir[1] / dl * sp;
    });
    (L.outlanes || []).forEach(O => { if (O.sensor === name && b.vy > 0) this.outlane(O, b); });
    (L.inlanes || []).forEach(I => { if (I.sensor === name && b.vy > 0) this.addScore(UAI.CONFIG.POINTS.inlane, b.x, b.y - 30); });

    // tiros por sequência de sensores
    (L.shots || []).forEach(sh => {
      const st = b.data.shots[sh.id] || (b.data.shots[sh.id] = { i: 0, t: -1e9 });
      if (st.i > 0 && this.now - st.t > (sh.timeout || 3000)) st.i = 0;
      const ok = k => sh.seq[k] === name && this.dirOk(sh.dirs && sh.dirs[k], b);
      if (ok(st.i)) {
        st.i++; st.t = this.now;
        if (st.i >= sh.seq.length) { st.i = 0; this.shotMade(sh, b); }
      } else if (st.i > 0 && ok(0)) { st.i = 1; st.t = this.now; }
    });
  },

  shotById(id) {
    return (this.layout.shots || []).find(s => s.id === id) || this.ramps.find(r => r.id === id) || null;
  },

  shotMade(sh, b) {
    const P = UAI.CONFIG.POINTS;
    this.stats.shots++;
    this.combo = this.now - this.lastShotAt < 5000 ? this.combo + 1 : 1;
    this.lastShotAt = this.now;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    const pts = sh.points || 1000;
    this.addScore(pts, b.x, b.y - 40);
    let sub = '+' + UAI.fmt(pts * this.mult);
    if (this.combo >= 2) {
      this.addScore(P.combo * (this.combo - 1));
      sub = 'COMBO x' + this.combo + '!';
    }
    if (this.shotLamps[sh.id]) this.lights.flashAll(this.shotLamps[sh.id], 1.2);
    UAI.Sfx.ramp();
    this.party = Math.max(this.party, 1000);
    this.banner(sh.name || 'TIRO!', sub, '#ffd27a');
    this.missionProgress('shot', sh.id);
    if (this.multiball && sh.jackpot) this.jackpot(b);
  },

  skillShot(b) {
    const v = UAI.CONFIG.POINTS.skillShot * this.ballNo;
    this.stats.skillShots++;
    this.addScore(v, b.x - 60, b.y + 40, true);
    this.banner('TACADA DE MESTRE!', '+' + UAI.fmt(v), '#6dff7a');
    UAI.Sfx.record();
    this.party = 1500;
    this.cameras.main.flash(160, 120, 255, 140);
  },

  /* ---------------- rampas aéreas (trilho de arame) ---------------- */
  tryRamp(R, b) {
    if (!R) return;
    const v = b.vx * R.dir[0] + b.vy * R.dir[1];
    if (v < R.minSpeed) return;              // fraca: bate na aba e volta
    if (!R.cum) {
      R.cum = [0];
      for (let i = 1; i < R.pts.length; i++) R.cum.push(R.cum[i - 1] + Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]));
    }
    b.data.state = 'ramp';
    this.world.freeze(b);
    b.data.ramp = { R, s: 0 };
    b.data.spr.setDepth(9);
    this.tweens.add({ targets: b.data.spr, displayWidth: b.data.size * 1.18, displayHeight: b.data.size * 1.18, duration: 250 });
    UAI.Sfx.launch(0.6);
    if (this.shotLamps[R.id]) this.lights.flashAll(this.shotLamps[R.id], 1);
  },

  stepRamp(b, dt) {
    const rd = b.data.ramp, R = rd.R;
    rd.s = Math.min(1, rd.s + dt / R.duration);
    const total = R.cum[R.cum.length - 1], dist = rd.s * total;
    let i = 1; while (i < R.cum.length - 1 && R.cum[i] < dist) i++;
    const k = (dist - R.cum[i - 1]) / Math.max(1e-6, R.cum[i] - R.cum[i - 1]);
    const p = R.pts[i - 1], q = R.pts[i];
    b.x = p[0] + (q[0] - p[0]) * k; b.y = p[1] + (q[1] - p[1]) * k;
    if (rd.s >= 1) {
      const end = R.pts[R.pts.length - 1];
      b.data.ramp = null;
      this.world.placeBall(b, end[0], end[1], R.exitVel[0], R.exitVel[1]);
      b.data.state = 'play';
      this.resetBallLook(b);
      this.stats.ramps++;
      this.shotMade(R, b);
    }
  },

  /* ---------------- buracos, buraco negro, túnel, kicker ---------------- */
  captureHole(H, b) {
    if (!H || b.data.state !== 'play' || this.now < H.cooldown || H.busy) return;
    const black = H.type === 'blackhole', HP = UAI.PHYSICS.holes, P = UAI.CONFIG.POINTS;
    if (this.world.speed(b) > HP.captureSpeed * (black ? 1.4 : 1)) return;   // rápida demais: passa por cima
    H.busy = true;
    b.data.state = 'hole';
    this.world.freeze(b, H.x, H.y);
    const spr = b.data.spr;
    this.tweens.add({ targets: spr, displayWidth: b.data.size * (black ? 0.15 : 0.6), displayHeight: b.data.size * (black ? 0.15 : 0.6),
      alpha: black ? 0 : 0.7, angle: black ? 720 : 180, duration: black ? 700 : 260, ease: 'Cubic.in' });
    this.lights.flash(H.lamp, 1.2);
    this.party = Math.max(this.party, black ? 1400 : 500);
    this.stats.holes++;
    if (black) {
      UAI.Sfx.blackhole();
      this.cameras.main.shake(500, 0.004);
      this.addScore(P.blackhole, H.x, H.y - 40);
      this.banner('BURACO NEGRO!', 'Lá vai ela pelo túnel...', '#d8b0ff');
      this.missionProgress('hole', H.id);
      if (this.multiball) this.jackpot(b);
      this.after(1000, () => this.startTunnel(H, b));
      return;
    }
    UAI.Sfx.saucer();
    this.addScore(H.points || P.saucer, H.x, H.y - 30);
    let hold = HP.holdTime;
    if (H.isLock) {
      if (this.multiball) this.jackpot(b);
      else if (!this.lockNeedsLit || this.lockLit > 0) {
        if (this.lockNeedsLit) this.lockLit--;
        this.locks++;
        this.addScore(P.saucerLock);
        if (this.locks >= this.rules.locksNeeded) { this.startMultiball(); hold = 1900; }
        else this.banner('BOLA TRAVADA', this.locks + ' de ' + this.rules.locksNeeded + ' para a MULTIBOLA', '#7dff9a');
      } else {
        const src = this.lockSourceName();
        this.banner(H.label || 'BURACO!', 'Trava apagada' + (src ? ': complete ' + src : ''), '#ffb040');
      }
    } else this.banner(H.label || 'BURACO!', '+' + UAI.fmt((H.points || P.saucer) * this.mult), '#ffd27a', 900);
    this.missionProgress('hole', H.id);
    this.after(hold, () => this.ejectFrom(b, H.x, H.y, H.eject, H));
  },

  lockSourceName() {
    const g = [...this.laneGroups, ...this.dropBanks, ...this.targetGroups].find(x => x.award === 'lockLit');
    return g ? g.name : '';
  },

  /** solta a bola de um ponto: eject = [graus, velocidade] (0° = direita, 90° = para baixo) */
  ejectFrom(b, x, y, eject, H) {
    if (b.data.state !== 'hole' || !this.balls.includes(b)) return;
    const [deg, speed] = eject || [90, 650];
    const a = Phaser.Math.DegToRad(deg + Phaser.Math.Between(-8, 8));
    this.world.placeBall(b, x + Math.cos(a) * 4, y + Math.sin(a) * 4, Math.cos(a) * speed, Math.sin(a) * speed);
    this.resetBallLook(b);
    const s0 = b.data.spr.scaleX;
    b.data.spr.setScale(s0 * 1.4);
    this.tweens.add({ targets: b.data.spr, scale: s0, duration: 200, ease: 'Back.out' });
    if (H) { H.cooldown = this.now + 1200; H.busy = false; }
    b.data.trailPts = [];
    b.data.state = 'play';
    UAI.Sfx.eject();
  },

  startTunnel(H, b) {
    const K = this.kickers.find(k => k.id === H.to);
    if (!K) { this.ejectFrom(b, H.x, H.y, [90, 700], H); return; }
    const spark = [
      this.add.image(H.x, H.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc090ff).setDisplaySize(70, 70).setDepth(9),
      this.add.image(H.x, H.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setDisplaySize(26, 26).setDepth(9)
    ];
    b.data.spr.setVisible(false);
    b.data.tunnel = { H, K, t: 0, dur: 900, spark, cx: (H.x + K.x) / 2 - 40, cy: Math.max(H.y, K.y) + 120 };
    UAI.Sfx.tunnel();
  },

  stepTunnel(b, dt) {
    const T = b.data.tunnel;
    T.t = Math.min(1, T.t + dt / T.dur);
    const u = T.t < 0.5 ? 2 * T.t * T.t : 1 - Math.pow(-2 * T.t + 2, 2) / 2;
    const x = (1 - u) * (1 - u) * T.H.x + 2 * (1 - u) * u * T.cx + u * u * T.K.x;
    const y = (1 - u) * (1 - u) * T.H.y + 2 * (1 - u) * u * T.cy + u * u * T.K.y;
    T.spark.forEach(s => s.setPosition(x, y));
    this.lights.list.forEach(L => { if (Math.abs(L.x - x) < 90 && Math.abs(L.y - y) < 90) this.lights.flash(L, 0.7); });
    if (T.t >= 1) {
      T.spark.forEach(s => s.destroy());
      b.data.tunnel = null;
      T.H.busy = false; T.H.cooldown = this.now + 1500;
      this.fireKicker(T.K, b, true);
    }
  },

  fireKicker(K, b, fromTunnel) {
    b.data.state = 'hole';
    this.world.freeze(b, K.x, K.y);
    this.resetBallLook(b);
    K.cooldown = this.now + 1500;
    this.lights.flash(K.lamp, 1.3);
    this.after(fromTunnel ? 150 : 300, () => {
      if (!this.balls.includes(b)) return;
      this.ejectFrom(b, K.x, K.y, K.eject, null);
      K.cooldown = this.now + 1500;
      this.addScore(UAI.CONFIG.POINTS.kicker, K.x + 30, K.y - 30);
      UAI.Sfx.launch(1);
      this.cameras.main.shake(160, 0.006);
      this.lights.flashAll(this.rim, 0.6);
    });
  },

  touchKicker(K, b) {
    if (!K || this.now < K.cooldown) return;
    this.fireKicker(K, b, false);
  },

  /* ---------------- bumpers, roda, choque, estilingues ---------------- */
  hitBumper(B, i, b) {
    if (!B) return;
    if (b) b.data.slingChain = 0;
    if (B.kind === 'shock') this.shockFx(B);
    B.flash = 1;
    if (B.holder) this.tweens.add({ targets: B.holder, scaleX: 1.12, scaleY: B.persp * 1.12, duration: 60, yoyo: true });
    UAI.Sfx.bumper(i);
    this.addScore(UAI.CONFIG.POINTS.bumper, B.x, B.y - B.r - 14);
    this.lights.flashAll(this.rim, 0.25);
  },

  shockFx(B) {
    UAI.Sfx.shock();
    this.cameras.main.shake(120, 0.005);
    (this.sparks || []).forEach(L => this.lights.flash(L, 1.2));
    const wheel = this.bumpers.find(o => o.kind === 'wheel');
    if (wheel) { wheel.flash = 1; wheel.spinBoost = 0.03; }
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2, r1 = 18, r2 = 46 + Math.random() * 30;
      const g = this.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      g.lineStyle(3, 0x9fe8ff, 1);
      g.beginPath(); g.moveTo(B.x + Math.cos(a) * r1, B.y + Math.sin(a) * r1);
      g.lineTo(B.x + Math.cos(a + 0.3) * (r1 + r2) / 2, B.y + Math.sin(a + 0.3) * (r1 + r2) / 2);
      g.lineTo(B.x + Math.cos(a) * r2, B.y + Math.sin(a) * r2); g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }
  },

  /** cubo da roda: choque elétrico que ACELERA a bola na direção em que ela vai */
  shockBoost(B, i, b) {
    const SP = UAI.PHYSICS.shock;
    if (!B || this.now - B.last < SP.cool) return;
    B.last = this.now;
    const sp = this.world.speed(b);
    if (sp < 200) { b.vx += Phaser.Math.Between(-300, 300); b.vy = -SP.minSpeed; }
    else {
      const ns = Math.min(UAI.PHYSICS.maxSpeed, Math.max(sp * SP.boost, sp + SP.minAdd, SP.minSpeed));
      b.vx *= ns / sp; b.vy *= ns / sp;
    }
    this.hitBumper(B, i, b);
  },

  hitWheel(B, b) {
    if (!B || this.now - B.last < 250) return;
    B.last = this.now; B.flash = 0.7;
    B.spinBoost = Math.min(0.04, this.world.speed(b) * 0.00002);
    this.addScore(UAI.CONFIG.POINTS.wheel, B.x, B.y - 30);
  },

  hitSling(S, c, b) {
    if (!S) return;
    const d = b.data;
    // anti pingue-pongue: estilingue atrás de estilingue perde força
    d.slingChain = (this.now - (d.lastSlingAt || -1e9) < 1500) ? (d.slingChain || 0) + 1 : 1;
    d.lastSlingAt = this.now;
    if (d.slingChain >= 3) { const k = c.m.kick * 0.65; b.vx -= c.m.face[0] * k; b.vy -= c.m.face[1] * k; }
    this.lights.flashAll(S.lamps, 1);
    UAI.Sfx.sling();
    this.addScore(UAI.CONFIG.POINTS.sling, b.x, b.y - 30);
  },

  /* ---------------- pistas de rolagem ---------------- */
  laneRoll({ g, i }, b) {
    const G = this.laneGroups[g], P = UAI.CONFIG.POINTS;
    if (!G) return;
    this.lights.flash(G.lamps[i], 1);
    if (G.lit[i]) { this.addScore(P.rollover / 5); return; }
    G.lit[i] = true;
    this.addScore(P.rollover, G.lanes[i][0], G.lanes[i][1] - 30);
    UAI.Sfx.rollover();
    if (G.lit.every(Boolean)) {
      this.stats.lanes++;
      this.addScore(P.laneSet);
      this.groupAward(G.award, G.name);
      this.missionProgress('lanes', G.id);
      this.party = Math.max(this.party, 900);
      this.lights.flashAll(G.lamps, 1.2);
      this.after(700, () => { G.lit = G.lit.map(() => false); });
    }
  },

  /** apertar a palheta troca as luzes das pistas (lane change) */
  rotateLanes(side) {
    this.laneGroups.forEach(G => {
      if (!G.rotate || G.lit.every(Boolean)) return;
      if (side === 'L') G.lit.push(G.lit.shift()); else G.lit.unshift(G.lit.pop());
    });
  },

  /** prêmio de um grupo completo (pistas, alvos) */
  groupAward(award, name) {
    const C = UAI.CONFIG;
    switch (award) {
      case 'bonusX':
        if (this.bonusX < C.MAX_BONUSX) { this.bonusX++; this.banner(name + '!', 'BÔNUS ' + this.bonusX + 'x', '#9fe8ff'); }
        else { this.addScore(5000); this.banner(name + '!', 'Bônus no máximo: +5.000', '#9fe8ff'); }
        UAI.Sfx.bonus();
        break;
      case 'kickback': {
        const outs = (this.layout.outlanes || []).filter(O => O.kickback);
        if (outs.length) { outs.forEach(O => (this.kickbackLit[O.id] = true)); this.banner(name + '!', 'KICKBACK ACESO na saída esquerda', '#7dff9a'); }
        else { this.addScore(5000); this.banner(name + '!', '+5.000', '#9fe8ff'); }
        UAI.Sfx.bonus();
        break;
      }
      case 'extraball': this.extraBall(name); break;
      case 'lockLit': {
        this.lockLit++;
        const h = this.holes.find(x => x.isLock);
        this.banner(name + '!', 'TRAVA ACESA! Mire no ' + ((h && h.label) || 'buraco'), '#7dff9a');
        UAI.Sfx.bonus();
        break;
      }
      default: this.banner(name + '!', '', '#ffd27a'); UAI.Sfx.bonus();
    }
    this.updateHUD();
  },

  extraBall(name) {
    if (this.extraBallsGiven < 2) {
      this.extraBallsGiven++; this.lives++; this.stats.extraBalls++;
      this.banner('BOLA EXTRA!', name + ' completo', '#7dff9a', 1800);
      UAI.Sfx.record();
      this.party = 2000;
    } else {
      this.addScore(25000, null, null, true);
      this.banner(name + '!', 'Bola extra esgotada: +25.000', '#9fe8ff');
    }
    this.updateHUD();
  },

  /* ---------------- alvos que caem e alvos fixos ---------------- */
  dropHit({ g, i }, b) {
    const B = this.dropBanks[g], P = UAI.CONFIG.POINTS;
    if (!B) return;
    const T = B.targets[i];
    if (T.down) return;
    T.down = true; T.c.off = true;
    this.stats.drops++;
    this.lights.flash(T.lamp, 1.2);
    UAI.Sfx.sling();
    this.addScore(P.drop, b.x, b.y - 30);
    if (B.targets.every(t => t.down)) {
      this.addScore(P.dropBank);
      this.groupAward(B.award, B.name);
      this.missionProgress('drops', B.id);
      B.resetAt = this.now + 1500;
    }
    this.redrawDyn();
  },

  resetDropBank(B) {
    const r = UAI.PHYSICS.ball.radius + 6;
    const blocked = B.targets.some(T => this.balls.some(b => {
      const [x0, y0, x1, y1] = T.pts, dx = x1 - x0, dy = y1 - y0;
      let t = ((b.x - x0) * dx + (b.y - y0) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t));
      return Math.hypot(b.x - x0 - dx * t, b.y - y0 - dy * t) < r + 5;
    }));
    if (blocked) { B.resetAt = this.now + 300; return; }
    B.resetAt = 0;
    B.targets.forEach(T => { T.down = false; T.c.off = false; });
    this.redrawDyn();
  },

  targetHit({ g, i }, b) {
    const G = this.targetGroups[g], P = UAI.CONFIG.POINTS;
    if (!G) return;
    const T = G.targets[i];
    if (this.now - T.last < 150) return;
    T.last = this.now;
    this.lights.flash(T.lamp, 1);
    UAI.Sfx.rollover();
    this.addScore(P.target, b.x, b.y - 30);
    if (T.lit) return;
    T.lit = true;
    if (G.targets.every(t => t.lit)) {
      this.addScore(P.targetSet);
      this.groupAward(G.award, G.name);
      this.missionProgress('targets', G.id);
      this.after(800, () => { G.targets.forEach(t => (t.lit = false)); this.redrawDyn(); });
    }
    this.redrawDyn();
  },

  spin(i, b) {
    const S = this.spinners[i];
    if (!S || this.now - S.last < 150) return;
    S.last = this.now;
    const n = Phaser.Math.Clamp(Math.round(this.world.speed(b) / 220), 1, 20);
    S.rate = n * 1.5;
    this.lights.flash(S.lamp, 1);
    this.addScore(UAI.CONFIG.POINTS.spin * n, S.x, S.y - 30);
    for (let k = 0; k < Math.min(n, 6); k++) UAI.Sfx.tone(1400 + k * 40, 0.03, 'square', 0.03, null, k * 0.05);
    this.missionProgress('spinner', S.id, n);
  },

  /* ---------------- saídas laterais ---------------- */
  outlane(O, b) {
    if (b.data.outAt && this.now - b.data.outAt < 1500) return;
    b.data.outAt = this.now;
    const K = O.kickback;
    if (K && this.kickbackLit[O.id] && !this.tilted) {
      this.kickbackLit[O.id] = false;
      b.data.state = 'hole';
      this.world.freeze(b, K.x, K.y);
      const src = [...this.laneGroups, ...this.dropBanks, ...this.targetGroups].find(x => x.award === 'kickback');
      this.banner('KICKBACK!', src ? 'Acenda de novo: ' + src.name : 'Agora não tem mais...', '#7dff9a');
      this.after(350, () => {
        if (b.data.state !== 'hole' || !this.balls.includes(b)) return;
        this.world.placeBall(b, K.x, K.y, 0, -K.speed);
        b.data.state = 'play';
        UAI.Sfx.launch(1);
        this.cameras.main.shake(160, 0.008);
      });
      return;
    }
    this.addScore(O.points || UAI.CONFIG.POINTS.outlane, b.x + 40, b.y - 30);
    if (this.now >= this.saveUntil) this.banner('OUTLANE!', 'Ih, lá se vai...', '#ff9a6a', 900);
  },

  /* ---------------- multibola e jackpot ---------------- */
  startMultiball() {
    this.multiball = true;
    this.locks = 0;
    this.jackpotsThisMB = 0;
    this.stats.multiballs++;
    this.banner('MULTIBOLA!', 'Acerte as rampas e os buracos: JACKPOT!', '#ffe066', 2200);
    UAI.Sfx.mult();
    this.party = 3500;
    this.cameras.main.flash(300, 255, 220, 120);
    this.autoQueue += Math.max(0, 3 - this.activeBalls().length - this.autoQueue);
    this.nextAutoAt = this.now + 600;
    this.saveUntil = this.now + 12000;
    this.missionProgress('multiball');
    this.updateHUD();
  },

  endMultiball() {
    if (!this.multiball) return;
    this.multiball = false;
    this.banner('FIM DA MULTIBOLA', 'Jackpots: ' + this.jackpotsThisMB, '#ffd27a');
    this.updateHUD();
  },

  jackpot(b) {
    const v = this.jackpotValue, P = UAI.CONFIG.POINTS;
    this.stats.jackpots++;
    this.jackpotsThisMB++;
    this.addScore(v, b.x, b.y - 60, true);
    this.after(250, () => this.banner('JACKPOT!', '+' + UAI.fmt(v), '#ffe066', 1200));
    UAI.Sfx.record();
    this.cameras.main.flash(200, 255, 230, 140);
    this.jackpotValue += 5000;
    if (this.jackpotsThisMB % 3 === 0) {
      this.after(1300, () => {
        this.stats.superJackpots++;
        this.addScore(P.superJackpot, null, null, true);
        this.banner('SUPER JACKPOT!', '+' + UAI.fmt(P.superJackpot), '#fff0a0', 1800);
        UAI.Sfx.mult();
        this.party = 3000;
      });
    }
    this.updateHUD();
  },

  /* ---------------- missões ---------------- */
  mission() { const ms = this.def.missions || []; return ms[this.missionIdx] || null; },

  missionProgress(type, id, n = 1) {
    if (this.tilted || this.over) return;
    const m = this.mission();
    if (!m || m.type !== type || (m.id && m.id !== id)) return;
    this.missionProg += n;
    const need = m.n * this.missionRound;
    if (this.missionProg < need) { this.updateHUD(); return; }
    const P = UAI.CONFIG.POINTS;
    this.missionsDone++;
    this.after(1200, () => {
      this.addScore(P.mission * this.missionRound, null, null, true);
      this.banner('MISSÃO CUMPRIDA!', m.text + '\n+' + UAI.fmt(P.mission * this.missionRound), '#9fe8ff', 1600);
      UAI.Sfx.record();
      this.party = Math.max(this.party, 2000);
    });
    this.missionIdx++; this.missionProg = 0;
    if (this.missionIdx >= (this.def.missions || []).length) {
      this.missionIdx = 0; this.missionRound++; this.mastered = true;
      this.after(3200, () => {
        this.addScore(P.superJackpot, null, null, true);
        this.banner('MESA DOMINADA!', 'Todas as missões! Agora elas valem o dobro', '#ffe066', 2200);
        UAI.Sfx.mult();
        this.party = 3500;
      });
    }
    this.updateHUD();
  },

  /* ---------------- pontos ---------------- */
  addScore(base, x, y, noMult) {
    if (this.tilted || base <= 0) return;
    const pts = Math.round(noMult ? base : base * this.mult);
    this.score += pts;
    this.ballScore = (this.ballScore || 0) + pts;
    if (!noMult) this.bonus += Math.round(base * 0.15);
    if (x != null) this.popup(x, y, '+' + UAI.fmt(pts));
    // multiplicador da bola: cada degrau pede mais pontos que o anterior (zera a cada bola)
    const step = this.rules.multStep, C = UAI.CONFIG;
    let m = 1;
    while (m < C.MAX_MULT && this.ballScore >= step * m * (m + 1) / 2) m++;   // vale para a bola atual
    if (m > this.mult) {
      this.mult = m;
      this.banner('MULTIPLICADOR x' + m, 'Uai, que trem bão!', '#fff0c8');
      UAI.Sfx.mult();
      this.party = Math.max(this.party, 1800);
      this.cameras.main.flash(220, 255, 210, 140);
      this.tweens.add({ targets: this.multTxt, scale: 1.6, duration: 160, yoyo: true });
    }
    this.updateHUD();
  }
});
