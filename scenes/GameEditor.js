/* ============================================================
   GameEditor – depuração (tecla G) e editor de pontos (tecla E)
   G mostra as colisões em vermelho, sensores em amarelo.
   E deixa arrastar paredes, bumpers, buracos, sensores...
   A edição fica salva no aparelho, separada para cada mesa.
   ============================================================ */

Object.assign(GameScene.prototype, {

  drawDebug() {
    const g = this.debugGfx, W = this.world;
    g.clear();
    W.colliders.forEach(c => {
      if (c.off) return;
      const col = c.tag === 'gate' ? 0x30ff60 : c.tag === 'sling' ? 0xff8800 : (c.tag === 'bumper') ? 0x30e0ff : (c.tag === 'drop' || c.tag === 'target') ? 0xff40ff : 0xff2020;
      g.lineStyle(Math.max(2, (c.t || 0) * 2), col, 0.6);
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
    (this.ramps || []).forEach(R => { g.lineStyle(2, 0x60c0ff, 0.6); g.strokePoints(R.pts.map(([x, y]) => ({ x, y }))); });
    this.balls.forEach(b => { if (!b.frozen) { g.lineStyle(2, 0x40ff40, 1); g.strokeCircle(b.x, b.y, b.r); } });
    if (this.editorOn) {
      g.lineStyle(1, 0xffffff, 0.8);
      this.layout.walls.forEach(w => g.strokePoints(w.pts.map(([x, y]) => ({ x, y }))));
    }
  },

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
      UAI.Layout.save(this.def, this.layout);
      if (!this.def.art) {                     // mesa desenhada pelo jogo: redesenha com a edição
        this.tableKey = this.ensureArt();
        this.tableImg.setTexture(this.tableKey).setDisplaySize(this.W, this.H);
        if (this.rampImg && this.textures.exists(this.tableKey + '_ramps')) this.rampImg.setTexture(this.tableKey + '_ramps');
      }
      if (!this.debugOn) this.debugGfx.clear();
    }
  },

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
    const O = (arr, color, kind) => arr.forEach(o => mk(o.x, o.y, color, (x, y) => { o.x = x; o.y = y; }, { kind }));
    L.walls.forEach((w, wi) => w.pts.forEach((pt) => mk(pt[0], pt[1], 0xff3030, (x, y) => { pt[0] = x; pt[1] = y; }, { kind: 'wall', wi, pi: w.pts.indexOf(pt) })));
    (L.gates || []).forEach(g => P(g.pts, 0x30ff60, 'gate'));
    (L.blocks || []).forEach(b => P(b.pts, 0xff8800, 'block'));
    (L.slings || []).forEach(s => P(s.pts, 0xff8800, 'sling'));
    (L.posts || []).forEach(p => P([p], 0xff8800, 'post'));
    (L.bumpers || []).forEach((b, i) => mk(b.x, b.y, 0x30e0ff, (x, y) => { b.x = x; b.y = y; }, { kind: 'bumper', i }));
    O(L.flippers || [], 0x30ff60, 'flipper');
    P(Object.values(L.sensors || {}), 0xffe040, 'sensor');
    (L.laneGroups || []).forEach(G => P(G.lanes, 0xffe040, 'lane'));
    (L.dropBanks || []).forEach(B => B.targets.forEach(t => {
      mk(t[0], t[1], 0xff40ff, (x, y) => { t[0] = x; t[1] = y; }, { kind: 'drop' });
      mk(t[2], t[3], 0xff40ff, (x, y) => { t[2] = x; t[3] = y; }, { kind: 'drop' });
    }));
    (L.targetGroups || []).forEach(G => G.targets.forEach(t => P(t, 0xff40ff, 'target')));
    O(L.spinners || [], 0xffffff, 'spinner');
    (L.ramps || []).forEach(R => { P([R.sensor], 0xffe040, 'sensor'); P(R.path, 0x60c0ff, 'ramp'); });
    const LT = L.lights || {};
    ['grid', 'extra'].forEach(k => P(LT[k] || [], 0xff40ff, 'light'));
    Object.values(LT.shots || {}).forEach(arr => P(arr, 0xff40ff, 'light'));
    if (LT.drain) P([LT.drain], 0xff40ff, 'light');
    O(L.holes || [], 0xa060ff, 'hole');
    O(L.kickers || [], 0xa060ff, 'kicker');
    P([L.ballStart], 0x4080ff, 'start');
  },

  destroyHandles() { (this.handles || []).forEach(h => h.destroy()); this.handles = []; this.selected = null; },

  select(h) {
    if (this.selected && this.selected.active) this.selected.setStrokeStyle(2, 0x000000);
    this.selected = h; h.setStrokeStyle(4, 0xffffff);
  },

  rebuild() {
    const keep = this.balls.map(b => ({ b, x: b.x, y: b.y, frozen: b.frozen }));
    this.buildTable();
    keep.forEach(k => Object.assign(k.b, { x: k.x, y: k.y, frozen: k.frozen }));
    UAI.Layout.save(this.def, this.layout);
  },

  editorKey(ev) {
    const L = this.layout, m = this.selected && this.selected.meta;
    switch (ev.code) {
      case 'KeyC': {
        const json = JSON.stringify(L);
        console.log('layout da mesa ' + this.def.id + ' = ' + json + ';');
        const done = () => this.banner('JSON COPIADO', 'Cole no arquivo da mesa em js/tables/');
        if (navigator.clipboard) navigator.clipboard.writeText(json).then(done, () => window.prompt('Copie:', json));
        else window.prompt('Copie:', json);
        break;
      }
      case 'KeyR':
        if (window.confirm('Voltar esta mesa ao padrão?')) {
          this.layout = UAI.Layout.reset(this.def); this.buildTable(); this.buildHandles();
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
});
