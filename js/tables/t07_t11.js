/* ============================================================
   MESAS 7 a 11 – as mais difíceis
   ============================================================ */
(function () {
  const K = UAI.Kit;

  /* ---------- 7. ARRAIÁ – festa junina ---------- */
  {
    const L = K.chassis();
    K.bumperNest(L, 418, 330, 92, 32);
    K.topLanes(L, 'festa', ['F', 'E', 'S', 'T', 'A'], 306, 214, 56, 'bonusX');
    K.ramp(L, { id: 'balao', name: 'BALÃO!', mouth: { x: 600, y: 640, dir: [-0.12, -1] },
      path: [[620, 330], [520, 200], [310, 200], [180, 330], [126, 600], [128, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.blackHole(L, 'poco', 236, 500, 'quadrilha');
    K.kicker(L, 'quadrilha', 560, 640, [-120, 1900]);
    K.saucer(L, 'barraca', 600, 460, [120, 700], { label: 'BARRACA', lock: true });
    K.upperFlipper(L, 152, 600, 'L', 90);
    L.decor = {
      icons: [['bonfire', 418, 600, 80], ['balloon', 560, 300, 60], ['flags', 418, 180, 70], ['viola', 300, 690, 60], ['lantern', 540, 720, 46]],
      texts: [{ text: 'ARRAIÁ', x: 418, y: 720, size: 64, title: true }, { text: 'olha a cobra! é mentira!', x: 418, y: 765, size: 16 }]
    };
    K.add({
      id: 'arraia', order: 7, name: 'Arraiá', subtitle: 'Festa junina',
      theme: { wood: ['#6e2f12', '#c0622a'], frame: ['#2a0e06', '#541c0c'], railWood: ['#7a3414', '#c8703a'], inlay: ['#fff0b0', '#ff9a40'], insert: '#ff7a2a', metal: '#e0b050' },
      mods: { gravity: 1.08, omega: 1.0, ballSave: 0.8 },
      stars: [25000, 70000, 150000],
      missions: [
        { type: 'lanes', id: 'festa', n: 1, text: 'Acenda F-E-S-T-A' },
        { type: 'shot', id: 'balao', n: 2, text: 'Solte 2 BALÕES na rampa' },
        { type: 'hole', id: 'poco', n: 1, text: 'Caia no POÇO (buraco negro)' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas na BARRACA: MULTIBOLA' }
      ],
      rules: { lockHoles: ['barraca'], locksNeeded: 3, multStep: 8000 },
      layout: L
    });
  }

  /* ---------- 8. DIAMANTINA – diamantes e serenata ---------- */
  {
    const L = K.chassis({ flipperLen: 142 });
    K.dropBank(L, 'dia', 'D-I-A', 196, 470, 286, 400, 3, 'lockLit');
    K.dropBank(L, 'mante', 'M-A-N-T-E', 552, 400, 660, 480, 4, 'extraball');
    K.blackHole(L, 'garimpo', 418, 300, 'bateia');
    K.kicker(L, 'bateia', 418, 640, [-90, 2200]);
    K.saucer(L, 'pedra1', 250, 270, [60, 700], { label: 'PEDRA', lock: true });
    K.saucer(L, 'pedra2', 586, 270, [120, 700], { label: 'PEDRA', lock: true });
    K.ramp(L, { id: 'serenata', name: 'SERENATA!', mouth: { x: 236, y: 650, dir: [0.12, -1] },
      path: [[226, 380], [330, 230], [520, 230], [690, 360], [710, 620], [708, 800]], exitVel: [0, 450], points: 1800, jackpot: true });
    K.bumper(L, 418, 470, 30);
    L.decor = {
      icons: [['diamond', 418, 560, 80], ['church', 300, 380, 50], ['viola', 540, 600, 60], ['moon', 600, 220, 40], ['star', 240, 210, 30]],
      texts: [{ text: 'DIAMANTINA', x: 418, y: 720, size: 54, title: true }, { text: 'terra de JK e da serenata', x: 418, y: 760, size: 16 }]
    };
    K.add({
      id: 'diamantina', order: 8, name: 'Diamantina', subtitle: 'Diamantes e serenata',
      theme: { wood: ['#2e1c14', '#6a4a3a'], frame: ['#120a06', '#2a1810'], railWood: ['#3a2418', '#7a5a46'], inlay: ['#f0fbff', '#9ad8ff'], insert: '#9ff0ff', metal: '#d8dde2' },
      mods: { gravity: 1.1, omega: 1.0, ballSave: 0.7 },
      stars: [40000, 105000, 220000],
      missions: [
        { type: 'drops', id: 'dia', n: 1, text: 'Derrube D-I-A' },
        { type: 'drops', id: 'mante', n: 1, text: 'Derrube M-A-N-T-E' },
        { type: 'hole', id: 'garimpo', n: 2, text: 'Garimpe 2 vezes (buraco negro)' },
        { type: 'multiball', n: 1, text: 'Trave 3 PEDRAS: MULTIBOLA' }
      ],
      rules: { lockHoles: ['pedra1', 'pedra2'], locksNeeded: 3, multStep: 8000 },
      layout: L
    });
  }

  /* ---------- 9. CAPITÓLIO – cânions e lago (sem kickback) ---------- */
  {
    const L = K.chassis({ outlaneKickback: false });
    K.bumperNest(L, 418, 280, 84, 32);
    K.spinner(L, 'cascata', 68, 380, 50, 0);
    K.spinner(L, 'vento', 768, 380, 50, 0);
    K.ramp(L, { id: 'canion', name: 'CÂNION!', mouth: { x: 236, y: 650, dir: [0.14, -1] },
      path: [[216, 380], [320, 220], [540, 216], [690, 340], [710, 620], [708, 800]], exitVel: [0, 450], points: 1800, jackpot: true });
    K.ramp(L, { id: 'lancha', name: 'LANCHA!', mouth: { x: 600, y: 650, dir: [-0.14, -1] },
      path: [[620, 380], [516, 230], [320, 236], [170, 360], [126, 620], [128, 800]], exitVel: [0, 450], points: 1800, jackpot: true });
    K.saucer(L, 'mirante', 418, 470, [90, 700], { label: 'MIRANTE', lock: true });
    L.decor = {
      icons: [['waves', 418, 600, 90], ['mountain', 300, 420, 60], ['mountain', 536, 420, 60], ['waterfall', 418, 380, 50], ['tree', 250, 700, 50], ['sun', 600, 700, 40]],
      texts: [{ text: 'CAPITÓLIO', x: 418, y: 690, size: 56, title: true }, { text: 'mar de Minas', x: 418, y: 730, size: 18 }]
    };
    K.add({
      id: 'capitolio', order: 9, name: 'Capitólio', subtitle: 'Cânions e lago · sem kickback',
      theme: { wood: ['#5a3a22', '#a07a52'], frame: ['#1c1008', '#3a2414'], railWood: ['#5a3a20', '#9a7048'], inlay: ['#e0f8ff', '#60b0e0'], insert: '#40c8ff', metal: '#c8c0a8' },
      mods: { gravity: 1.12, omega: 1.02, ballSave: 0.6 },
      stars: [30000, 80000, 170000],
      missions: [
        { type: 'shot', id: 'canion', n: 1, text: 'Atravesse o CÂNION' },
        { type: 'shot', id: 'lancha', n: 1, text: 'Pegue a LANCHA' },
        { type: 'spinner', id: 'cascata', n: 40, text: 'Gire a CASCATA 40 vezes' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas no MIRANTE: MULTIBOLA' }
      ],
      rules: { lockHoles: ['mirante'], locksNeeded: 3, multStep: 8000 },
      layout: L
    });
  }

  /* ---------- 10. INHOTIM – arte e jardim ---------- */
  {
    const L = K.chassis({ flipperLen: 144 });
    K.targetGroup(L, 'arte', 'A-R-T-E', ['A', 'R', 'T', 'E'],
      [[[262, 300], [290, 276]], [[334, 252], [368, 240]], [[468, 240], [502, 252]], [[546, 276], [574, 300]]], 'extraball');
    K.blackHole(L, 'galeria', 418, 330, 'jardim_k');
    K.kicker(L, 'jardim_k', 200, 560, [-50, 2100]);
    K.dropBank(L, 'cor', 'C-O-R', 520, 540, 610, 480, 3, 'lockLit');
    K.spinner(L, 'giro', 418, 470, 52, 0);
    K.ramp(L, { id: 'jardim', name: 'JARDIM!', mouth: { x: 600, y: 650, dir: [-0.12, -1] },
      path: [[620, 400], [520, 230], [320, 230], [170, 360], [126, 620], [128, 800]], exitVel: [0, 450], points: 1800, jackpot: true });
    K.saucer(L, 'obra', 280, 450, [70, 700], { label: 'OBRA', lock: true });
    K.bumper(L, 330, 560, 28);
    L.decor = {
      icons: [['sculpture', 418, 620, 80], ['tree', 250, 680, 60], ['tree', 586, 690, 50], ['planet', 418, 190, 40], ['sun', 600, 380, 36]],
      texts: [{ text: 'INHOTIM', x: 418, y: 740, size: 62, title: true }, { text: 'arte a céu aberto', x: 418, y: 780, size: 16 }]
    };
    K.add({
      id: 'inhotim', order: 10, name: 'Inhotim', subtitle: 'Arte e jardim',
      theme: { wood: ['#3a3020', '#8a7650'], frame: ['#141008', '#2e2414'], railWood: ['#4a3c24', '#9a8456'], inlay: ['#ffffff', '#ffb0e0'], insert: '#ff60c0', metal: '#c8c8c8' },
      mods: { gravity: 1.15, omega: 1.03, ballSave: 0.5 },
      stars: [32000, 85000, 180000],
      missions: [
        { type: 'targets', id: 'arte', n: 1, text: 'Acerte A-R-T-E' },
        { type: 'drops', id: 'cor', n: 1, text: 'Derrube C-O-R' },
        { type: 'hole', id: 'galeria', n: 1, text: 'Entre na GALERIA (buraco negro)' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas na OBRA: MULTIBOLA' }
      ],
      rules: { lockHoles: ['obra'], locksNeeded: 3, multStep: 9000 },
      layout: L
    });
  }

  /* ---------- 11. AVANÇO TECNOLÓGICO – espaço (a mais difícil) ---------- */
  {
    const L = K.chassis({ outlaneKickback: false, flipperLen: 136 });
    K.bumperNest(L, 418, 250, 76, 28);
    K.blackHole(L, 'buracoA', 286, 360, 'portalB');
    K.blackHole(L, 'buracoB', 550, 360, 'portalA');
    K.kicker(L, 'portalA', 322, 700, [-72, 2200]);
    K.kicker(L, 'portalB', 514, 700, [-108, 2200]);
    K.dropBank(L, 'astro', 'A-S-T-R-O', 330, 520, 506, 520, 5, 'extraball');
    K.spinner(L, 'cometa', 68, 380, 50, 0);
    K.spinner(L, 'satelite', 768, 380, 50, 0);
    K.ramp(L, { id: 'lancamento', name: 'LANÇAMENTO!', mouth: { x: 236, y: 660, dir: [0.12, -1] },
      path: [[216, 420], [320, 214], [540, 210], [690, 340], [710, 640], [708, 800]], exitVel: [0, 450], points: 2000, jackpot: true });
    K.ramp(L, { id: 'orbital', name: 'ORBITAL!', mouth: { x: 600, y: 660, dir: [-0.12, -1] },
      path: [[620, 420], [516, 230], [320, 236], [170, 360], [126, 640], [128, 800]], exitVel: [0, 450], points: 2000, jackpot: true });
    K.saucer(L, 'estacaoEspacial', 418, 420, [90, 700], { label: 'ESTAÇÃO', lock: true });
    L.decor = {
      icons: [['rocket', 418, 584, 70], ['planet', 280, 470, 50], ['moon', 560, 470, 40], ['star', 220, 220, 26], ['star', 616, 220, 26], ['gear', 418, 330, 40]],
      texts: [{ text: 'AVANÇO TECNOLÓGICO', x: 418, y: 655, size: 50, title: true }]
    };
    K.add({
      id: 'avanco', order: 11, name: 'Avanço Tecnológico', subtitle: 'A mais difícil · sem kickback',
      theme: { wood: ['#1e1410', '#4a3426'], frame: ['#0a0604', '#1e140c'], railWood: ['#2a1c14', '#5a4232'], inlay: ['#e8ecff', '#8a9aff'], insert: '#7a8aff', metal: '#b8c4ff', wire: '#d8e0ff' },
      mods: { gravity: 1.22, omega: 1.05, ballSave: 0.4 },
      stars: [50000, 125000, 260000],
      missions: [
        { type: 'drops', id: 'astro', n: 1, text: 'Derrube A-S-T-R-O' },
        { type: 'hole', id: 'buracoA', n: 1, text: 'Atravesse o BURACO NEGRO da esquerda' },
        { type: 'shot', id: 'lancamento', n: 1, text: 'Faça o LANÇAMENTO (rampa esquerda)' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas na ESTAÇÃO: MULTIBOLA' }
      ],
      rules: { lockHoles: ['estacaoEspacial'], locksNeeded: 3, multStep: 10000 },
      layout: L
    });
  }
})();
