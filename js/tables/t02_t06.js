/* ============================================================
   MESAS 2 a 6 (desenhadas pelo jogo, no estilo madeira pirogravada)
   Área livre de cima: x 110–726, y 165–790 (dentro do trilho da órbita)
   ============================================================ */
(function () {
  const K = UAI.Kit;

  /* ---------- 2. COZINHA DA VÓ – pão de queijo e café ---------- */
  {
    const L = K.chassis();
    K.bumperNest(L, 418, 330, 86, 34);
    K.topLanes(L, 'cafe', ['C', 'A', 'F', 'É'], 325, 214, 62, 'bonusX');
    K.ramp(L, { id: 'forno', name: 'FORNÃO!', mouth: { x: 236, y: 640, dir: [0.12, -1] },
      path: [[226, 330], [330, 200], [560, 196], [690, 330], [710, 600], [708, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.saucer(L, 'chaleira', 612, 470, [125, 700], { label: 'CHALEIRA', lock: true });
    K.targetGroup(L, 'pao', 'P-Ã-O', ['P', 'Ã', 'O'], [[[640, 560], [646, 596]], [[648, 612], [654, 648]], [[656, 664], [662, 700]]], 'extraball');
    L.decor = {
      icons: [['coffee', 418, 560, 90], ['paoqueijo', 300, 700, 70], ['paoqueijo', 540, 700, 70], ['house', 240, 470, 60], ['sun', 600, 240, 50], ['cow', 418, 870, 60]],
      texts: [{ text: 'COZINHA DA VÓ', x: 418, y: 650, size: 52, title: true }, { text: 'café passado na hora', x: 418, y: 690, size: 18 }]
    };
    K.add({
      id: 'cozinha', order: 2, name: 'Cozinha da Vó', subtitle: 'Pão de queijo e café',
      theme: { wood: ['#9a6a3a', '#e2b27a'], frame: ['#3a1e0c', '#6a3a18'], railWood: ['#8b5a2b', '#d9a066'], inlay: ['#fff1cf', '#e0a860'], insert: '#ffb347', metal: '#d9a441' },
      mods: { gravity: 0.92, omega: 1.0, ballSave: 1.4 },
      stars: [20000, 55000, 120000],
      missions: [
        { type: 'shot', id: 'forno', n: 2, text: 'Coloque 2 fornadas na rampa do FORNO' },
        { type: 'lanes', id: 'cafe', n: 1, text: 'Acenda C-A-F-É' },
        { type: 'targets', id: 'pao', n: 1, text: 'Acerte P-Ã-O' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas na CHALEIRA: MULTIBOLA' }
      ],
      rules: { lockHoles: ['chaleira'], locksNeeded: 3, multStep: 6000 },
      layout: L
    });
  }

  /* ---------- 3. MARIA FUMAÇA – o trem de Minas ---------- */
  {
    const L = K.chassis();
    K.spinner(L, 'apito', 68, 380, 50, 0);
    K.dropBank(L, 'trem', 'T-R-E-M', 520, 600, 660, 520, 4, 'lockLit');
    K.ramp(L, { id: 'trilho', name: 'TRILHO!', mouth: { x: 620, y: 460, dir: [-0.1, -1] },
      path: [[612, 260], [520, 190], [300, 196], [170, 320], [126, 600], [128, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.bumper(L, 300, 320, 34); K.bumper(L, 400, 260, 32); K.bumper(L, 330, 430, 30);
    K.saucer(L, 'estacao', 232, 520, [-40, 800], { label: 'ESTAÇÃO', lock: true });
    L.decor = {
      icons: [['train', 418, 640, 120], ['mountain', 540, 320, 70], ['church', 230, 680, 55], ['cart', 610, 700, 55], ['lantern', 150, 470, 40]],
      texts: [{ text: 'MARIA FUMAÇA', x: 418, y: 760, size: 50, title: true }, { text: 'piuí-piuí', x: 560, y: 440, size: 18 }]
    };
    K.add({
      id: 'mariafumaca', order: 3, name: 'Maria Fumaça', subtitle: 'O trem das Gerais',
      theme: { wood: ['#4a2a14', '#8d5a30'], frame: ['#1e100a', '#3c2010'], railWood: ['#3b2210', '#7a4a24'], inlay: ['#ffe2a8', '#c98a40'], insert: '#ff9a40', metal: '#a9aeb3' },
      mods: { gravity: 0.97, omega: 1.0 },
      stars: [30000, 80000, 160000],
      missions: [
        { type: 'spinner', id: 'apito', n: 30, text: 'Gire o APITO 30 vezes (órbita esquerda)' },
        { type: 'drops', id: 'trem', n: 1, text: 'Derrube T-R-E-M' },
        { type: 'shot', id: 'trilho', n: 2, text: 'Faça 2 rampas do TRILHO' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas na ESTAÇÃO: MULTIBOLA' }
      ],
      rules: { lockHoles: ['estacao'], locksNeeded: 3, multStep: 6000 },
      layout: L
    });
  }

  /* ---------- 4. OURO PRETO – a mina de ouro ---------- */
  {
    const L = K.chassis();
    K.bumperNest(L, 418, 290, 84, 32);
    K.ramp(L, { id: 'igreja', name: 'IGREJA!', mouth: { x: 236, y: 640, dir: [0.14, -1] },
      path: [[220, 360], [330, 214], [520, 210], [680, 330], [708, 600], [708, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.ramp(L, { id: 'ladeira', name: 'LADEIRA!', mouth: { x: 600, y: 640, dir: [-0.14, -1] },
      path: [[616, 380], [520, 250], [330, 250], [170, 360], [126, 600], [128, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.blackHole(L, 'mina', 418, 480, 'vagonete');
    K.kicker(L, 'vagonete', 300, 690, [-62, 2100]);
    K.saucer(L, 'pepita1', 268, 410, [70, 700], { label: 'OURO', lock: true });
    K.saucer(L, 'pepita2', 568, 410, [110, 700], { label: 'OURO', lock: true });
    L.decor = {
      icons: [['church', 300, 560, 70], ['church', 536, 560, 70], ['pickaxe', 418, 600, 60], ['helmet', 418, 400, 46], ['cart', 540, 720, 55], ['diamond', 220, 760, 40]],
      texts: [{ text: 'OURO PRETO', x: 418, y: 690, size: 56, title: true }, { text: 'Vila Rica · 1711', x: 418, y: 730, size: 18 }]
    };
    K.add({
      id: 'ouropreto', order: 4, name: 'Ouro Preto', subtitle: 'A mina de ouro',
      theme: { wood: ['#5a3112', '#a5682e'], frame: ['#24110a', '#4a2210'], railWood: ['#6a3a16', '#b5783a'], inlay: ['#fff2b0', '#e0b040'], insert: '#ffd040', metal: '#e8c04a' },
      mods: { gravity: 1.0, omega: 1.0 },
      stars: [30000, 80000, 170000],
      missions: [
        { type: 'shot', id: 'igreja', n: 1, text: 'Suba a rampa da IGREJA' },
        { type: 'shot', id: 'ladeira', n: 1, text: 'Suba a rampa da LADEIRA' },
        { type: 'hole', id: 'mina', n: 2, text: 'Desça 2 vezes na MINA (buraco negro)' },
        { type: 'multiball', n: 1, text: 'Trave 3 pepitas de OURO: MULTIBOLA' }
      ],
      rules: { lockHoles: ['pepita1', 'pepita2'], locksNeeded: 3, multStep: 7000 },
      layout: L
    });
  }

  /* ---------- 5. SERRA DA CANASTRA – queijo e cachoeira ---------- */
  {
    const L = K.chassis();
    K.ramp(L, { id: 'cachoeira', name: 'CACHOEIRA!', mouth: { x: 418, y: 560, dir: [0, -1] },
      path: [[418, 300], [470, 200], [620, 220], [700, 380], [708, 620], [708, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    K.dropBank(L, 'queijo', 'Q-U-E-I-J-O', 140, 590, 140, 770, 5, 'extraball');
    K.spinner(L, 'riacho', 596, 420, 52, 0.5);
    K.bumper(L, 300, 300, 34); K.bumper(L, 536, 300, 34);
    K.saucer(L, 'curral', 300, 440, [60, 700], { label: 'CURRAL', lock: true });
    K.upperFlipper(L, 684, 600, 'R', 92);
    L.decor = {
      icons: [['cheese', 300, 620, 70], ['waterfall', 418, 420, 70], ['cow', 540, 640, 70], ['mountain', 418, 250, 60], ['sun', 220, 240, 40]],
      texts: [{ text: 'CANASTRA', x: 418, y: 740, size: 58, title: true }, { text: 'nascente do São Francisco', x: 418, y: 780, size: 16 }]
    };
    K.add({
      id: 'canastra', order: 5, name: 'Serra da Canastra', subtitle: 'Queijo e cachoeira',
      theme: { wood: ['#7a5530', '#c9a06a'], frame: ['#2e1a0c', '#5a3818'], railWood: ['#6a4422', '#b48450'], inlay: ['#f4fbff', '#a8d8f0'], insert: '#7fd4ff', metal: '#c8b890' },
      mods: { gravity: 1.03, omega: 1.0 },
      stars: [32000, 85000, 180000],
      missions: [
        { type: 'shot', id: 'cachoeira', n: 2, text: 'Desça 2 vezes a CACHOEIRA' },
        { type: 'drops', id: 'queijo', n: 1, text: 'Derrube o QUEIJO inteiro' },
        { type: 'spinner', id: 'riacho', n: 40, text: 'Gire o RIACHO 40 vezes' },
        { type: 'multiball', n: 1, text: 'Trave 3 bolas no CURRAL: MULTIBOLA' }
      ],
      rules: { lockHoles: ['curral'], locksNeeded: 3, multStep: 7000 },
      layout: L
    });
  }

  /* ---------- 6. MINEIRÃO – futebol ---------- */
  {
    const L = K.chassis();
    K.saucer(L, 'gol', 418, 236, [90, 750], { label: 'GOL!', lock: true, points: 2500 });
    L.walls.push({ id: 'trave', pts: [[372, 214], [372, 262]], t: 5, style: 'guide' }, { id: 'trave2', pts: [[464, 214], [464, 262]], t: 5, style: 'guide' });
    L.posts.push([372, 262, 6], [464, 262, 6]);
    K.bumper(L, 330, 360, 30); K.bumper(L, 506, 360, 30); K.bumper(L, 418, 430, 28); K.bumper(L, 260, 470, 26);
    K.targetGroup(L, 'golaco', 'G-O-L', ['G', 'O', 'L'], [[[640, 560], [646, 596]], [[648, 612], [654, 648]], [[656, 664], [662, 700]]], 'lockLit');
    K.ramp(L, { id: 'ola', name: 'OLA!', mouth: { x: 236, y: 640, dir: [0.12, -1] },
      path: [[220, 330], [330, 196], [560, 196], [690, 330], [710, 600], [708, 800]], exitVel: [0, 450], points: 1500, jackpot: true });
    L.decor = {
      icons: [['goal', 418, 300, 70], ['ball', 418, 560, 70], ['star', 300, 640, 40], ['star', 536, 640, 40], ['flags', 418, 180, 60]],
      texts: [{ text: 'MINEIRÃO', x: 418, y: 690, size: 60, title: true }, { text: 'é gol, uai!', x: 418, y: 730, size: 18 }]
    };
    K.add({
      id: 'mineirao', order: 6, name: 'Mineirão', subtitle: 'Futebol de Minas',
      theme: { wood: ['#3d2a1a', '#7a5a3a'], frame: ['#140c06', '#2e1c10'], railWood: ['#4a3420', '#8a6a46'], inlay: ['#f0fff0', '#8ad08a'], insert: '#60e070', metal: '#d9d9d9' },
      mods: { gravity: 1.05, omega: 1.0 },
      stars: [35000, 90000, 190000],
      missions: [
        { type: 'hole', id: 'gol', n: 2, text: 'Faça 2 GOLS (buraco do meio)' },
        { type: 'targets', id: 'golaco', n: 1, text: 'Acerte G-O-L' },
        { type: 'shot', id: 'ola', n: 2, text: 'Faça 2 OLAS na rampa' },
        { type: 'multiball', n: 1, text: 'Faça 3 gols: MULTIBOLA' }
      ],
      rules: { lockHoles: ['gol'], locksNeeded: 3, multStep: 7000 },
      layout: L
    });
  }
})();
