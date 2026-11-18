/* ============================================================
   UAI BALL – KIT DE MONTAGEM DE MESAS
   ------------------------------------------------------------
   Cada mesa é descrita por DADOS (como o Visual Pinball faz com
   seus elementos e o Space Cadet com o PINBALL.DAT). O mesmo dado
   alimenta a física e o desenho, então arte e colisão nunca
   ficam desalinhadas.

   chassis()  → contorno, corredor do lançador com portão, órbitas
                esquerda/direita, outlanes (onde a bola se perde),
                inlanes, estilingues e palhetas — o "esqueleto"
                de todo fliperama.
   Módulos    → bumpers, rampa aérea, buracos, buraco negro,
                alvos que caem, alvos fixos, spinner, pistas de cima.
   ============================================================ */
window.UAI = window.UAI || {};
UAI.TABLES = UAI.TABLES || [];

UAI.Kit = {
  RAIL: 8,          // meia-espessura dos trilhos de madeira (px)
  CX: 418,          // eixo de simetria da área de jogo

  mirror(x) { return 2 * this.CX - x; },

  /** pontos de um arco (centro, raio, ângulo inicial/final em graus) */
  arc(cx, cy, r, a0, a1, step = 10) {
    const out = [], n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      out.push([Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)]);
    }
    return out;
  },

  /** Esqueleto padrão. o = { outlaneKickback, flipperLen } */
  chassis(o = {}) {
    const K = this, t = K.RAIL;
    const outer = [[32, 1196], [32, 272], ...K.arc(220, 272, 188, 180, 270).slice(1), [672, 84], ...K.arc(672, 272, 188, 270, 360).slice(1), [860, 1160]];
    // trilho interno das órbitas, com uma ABERTURA no alto (x 340–496):
    // a bola lançada devagar cai ali, nas pistas de cima; forte, dá a volta
    const [g0, g1] = o.gap || [340, 496];
    const arcL = K.arc(220, 272, 118, 180, 270).slice(1), arcR = K.arc(616, 272, 118, 270, 360).slice(1);
    const innerL = g0 > 220 ? [[102, 470], [102, 272], ...arcL, [g0, 154]] : [[102, 470], [102, 272], ...arcL.filter(p => p[0] <= g0)];
    const innerR = [[g1, 154], ...(g1 < 616 ? [[616, 154]] : []), ...arcR, [734, 470]];
    const divL = [[98, 792], [98, 958], [128, 1002], [196, 1034], [248, 1052]];
    const divR = divL.map(([x, y]) => [K.mirror(x), y]).reverse();
    const L = {
      chassis: true,
      walls: [
        { id: 'externa', pts: outer, t, style: 'outer' },
        { id: 'separador', pts: [[804, 1160], [804, 300]], t, style: 'rail' },
        { id: 'fundoLancador', pts: [[804, 1160], [860, 1160]], t, style: 'rail' },
        { id: 'trilhoOrbitaE', pts: innerL, t, style: 'rail' },
        { id: 'trilhoOrbitaD', pts: innerR, t, style: 'rail' },
        { id: 'divisorEsq', pts: divL, t, style: 'rail' },
        { id: 'divisorDir', pts: divR, t, style: 'rail' }
      ],
      gates: [
        { pts: [[804, 300], [860, 266]], pass: [0, -1], t: 4 },     // topo do lançador
        // fundo das órbitas: portão inclinado abaixo do fim do trilho,
        // a bola que desce sai para a mesa (vão de ~40 px); só deixa subir
        { pts: [[32, 480], [100, 548]], pass: [0, -1], t: 4 },      // fundo da órbita esquerda
        { pts: [[804, 480], [736, 548]], pass: [0, -1], t: 4 }      // fundo da órbita direita
      ],
      posts: [[98, 792, 7], [K.mirror(98), 792, 7], [innerL[innerL.length - 1][0], innerL[innerL.length - 1][1], 7], [g1, 154, 7]],
      blocks: [],
      bumpers: [],
      slings: [
        { pts: [[150, 826], [150, 940], [236, 992]], kick: [0, 2] },
        { pts: [[K.mirror(150), 826], [K.mirror(150), 940], [K.mirror(236), 992]], kick: [0, 2] }
      ],
      flippers: [
        { x: 263, y: 1066, side: 'L', len: o.flipperLen || 150 },
        { x: K.mirror(263), y: 1066, side: 'R', len: o.flipperLen || 150 }
      ],
      ballStart: [832, 1136],
      plungerLane: { x0: 812, x1: 852, top: 300 },
      sensors: {
        orbL: [68, 420, 24], orbR: [768, 420, 24],
        exL: [64, 456, 22], exR: [772, 456, 22],         // saída das órbitas (guia a bola para a mesa)
        outL: [66, 900, 22], outR: [770, 900, 22],
        inL: [128, 905, 18], inR: [K.mirror(128), 905, 18]
      },
      shots: [
        { id: 'orbitaE', name: 'ÓRBITA', seq: ['orbL', 'orbR'], dirs: ['up', 'down'], points: 750, timeout: 3500 },
        { id: 'orbitaD', name: 'ÓRBITA', seq: ['orbR', 'orbL'], dirs: ['up', 'down'], points: 750, timeout: 3500 }
      ],
      outlanes: [
        { id: 'L', sensor: 'outL', points: 500, kickback: o.outlaneKickback === false ? null : { x: 66, y: 1060, speed: 2500, litAtStart: true } },
        { id: 'R', sensor: 'outR', points: 500, kickback: null }
      ],
      inlanes: [{ sensor: 'inL', points: 100 }, { sensor: 'inR', points: 100 }],
      holes: [], kickers: [], ramps: [], laneGroups: [], dropBanks: [], targetGroups: [], spinners: [],
      accels: [],
      // a bola que desce a órbita sai empurrada para dentro da mesa (e não cai na outlane)
      exits: [
        { sensor: 'exL', when: 'down', dir: [0.82, 0.57], minSpeed: 620, maxSpeed: 1000 },
        { sensor: 'exR', when: 'down', dir: [-0.82, 0.57], minSpeed: 620, maxSpeed: 1000 }
      ],
      lights: {
        shots: {},                      // lâmpadas-seta por tiro: id → [x,y,ang]
        grid: [[350, 900], [418, 880], [486, 900], [372, 945], [464, 945], [418, 925], [418, 970]],
        drain: [418, 1128]
      },
      drainY: 1190,
      decor: { icons: [], texts: [], inserts: [] }
    };
    L.lights.shots.orbitaE = [[70, 660, -90], [70, 700, -90]];
    L.lights.shots.orbitaD = [[766, 660, -90], [766, 700, -90]];
    return L;
  },

  /* ---------------- módulos ---------------- */
  bumper(L, x, y, r = 34) { L.bumpers.push({ x, y, r, vr: Math.round(r * 1.38) }); },

  /** triângulo de bumpers (o clássico "ninho" de pop bumpers) */
  bumperNest(L, cx, cy, spread = 78, r = 34) {
    this.bumper(L, cx, cy - spread * 0.6, r);
    this.bumper(L, cx - spread * 0.62, cy + spread * 0.42, r);
    this.bumper(L, cx + spread * 0.62, cy + spread * 0.42, r);
  },

  /** Rampa aérea: boca no tabuleiro + trilho de arame por cima até a saída.
      mouth: {x,y,dir:[dx,dy]} (dir = sentido em que a bola entra) */
  ramp(L, o) {
    const t = 6, w = o.width || 64, len = o.depth || 78;
    const [dx, dy] = o.mouth.dir, dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
    const nx = -uy, ny = ux, m = o.mouth;
    const a0 = [m.x + nx * w / 2, m.y + ny * w / 2], b0 = [m.x - nx * w / 2, m.y - ny * w / 2];
    const a1 = [a0[0] + ux * len, a0[1] + uy * len], b1 = [b0[0] + ux * len, b0[1] + uy * len];
    L.walls.push({ id: o.id + '_a', pts: [a0, a1].map(p => p.map(Math.round)), t, style: 'rail' });
    L.walls.push({ id: o.id + '_b', pts: [b0, b1].map(p => p.map(Math.round)), t, style: 'rail' });
    L.walls.push({ id: o.id + '_fundo', pts: [a1, b1].map(p => p.map(Math.round)), t: 4, style: 'flap', mat: 'rubber' });
    L.ramps.push({
      id: o.id, name: o.name || 'RAMPA', points: o.points || 1000,
      sensor: [Math.round(m.x + ux * len * 0.62), Math.round(m.y + uy * len * 0.62), 20],
      dir: [ux, uy], minSpeed: o.minSpeed || 650,
      path: [[Math.round(m.x + ux * len), Math.round(m.y + uy * len)], ...o.path],
      exitVel: o.exitVel || [0, 500], jackpot: !!o.jackpot, duration: o.duration || 1100, style: o.style || 'wire'
    });
    L.lights.shots[o.id] = [[Math.round(m.x - ux * 46), Math.round(m.y - uy * 46), Math.atan2(uy, ux) * 180 / Math.PI],
                            [Math.round(m.x - ux * 80), Math.round(m.y - uy * 80), Math.atan2(uy, ux) * 180 / Math.PI]];
  },

  /** buraco (saucer): prende, pontua e cospe. lock = conta para a multibola */
  saucer(L, id, x, y, eject = [90, 650], extra = {}) {
    L.holes.push(Object.assign({ id, type: 'saucer', x, y, r: 13, eject }, extra));
  },

  /** buraco negro: puxa a bola e manda pelo túnel até o kicker "to" */
  blackHole(L, id, x, y, to) { L.holes.push({ id, type: 'blackhole', x, y, r: 16, to }); },

  kicker(L, id, x, y, eject, touch = false) { L.kickers.push({ id, x, y, r: 16, eject, touch }); },

  /** banco de alvos que caem: n alvos ao longo de uma linha */
  dropBank(L, id, name, x0, y0, x1, y1, n = 3, award = 'points') {
    const targets = [];
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 0.82) / n;
      targets.push([Math.round(x0 + (x1 - x0) * a), Math.round(y0 + (y1 - y0) * a), Math.round(x0 + (x1 - x0) * b), Math.round(y0 + (y1 - y0) * b)]);
    }
    L.dropBanks.push({ id, name, targets, award });
  },

  /** grupo de alvos fixos com letras (ex.: G-O-L) */
  targetGroup(L, id, name, letters, positions, award = 'points') {
    L.targetGroups.push({ id, name, letters, targets: positions, award });
  },

  spinner(L, id, x, y, w = 50, angle = 0) { L.spinners.push({ id, x, y, w, angle }); },

  /** pistas de rolagem com guias (as "top lanes"): completar todas = bônus x */
  topLanes(L, id, letters, x0, y, gap = 62, award = 'bonusX') {
    const lanes = [];
    for (let i = 0; i < letters.length; i++) lanes.push([x0 + i * gap, y]);
    // guias entre as pistas
    for (let i = 0; i <= letters.length; i++) {
      const gx = x0 - gap / 2 + i * gap;
      L.walls.push({ id: id + '_g' + i, pts: [[gx, y - 26], [gx, y + 22]], t: 5, style: 'guide' });
      L.posts.push([gx, y - 26, 6]);
    }
    L.laneGroups.push({ id, name: letters.join('-'), letters, lanes, award, rotate: true });
  },

  /** pistas "soltas" (sem guias), ex.: triângulos de rolagem */
  rollovers(L, id, letters, lanes, award = 'points') {
    L.laneGroups.push({ id, name: letters.join('-'), letters, lanes, award, rotate: true });
  },

  upperFlipper(L, x, y, side, len = 96) { L.flippers.push({ x, y, side, len, upper: true }); },

  /** registra uma mesa */
  add(def) { UAI.TABLES.push(def); }
};
