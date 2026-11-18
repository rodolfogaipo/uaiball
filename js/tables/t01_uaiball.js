/* ============================================================
   MESA 1 – UAI BALL (reconstruída a partir da arte original)
   ------------------------------------------------------------
   A imagem antiga era um desenho em 3D: os trilhos de madeira não
   batiam com a física e a bola passava "por cima" deles. Agora a
   mesa é desenhada pelo próprio jogo a partir destes dados, então
   TUDO o que aparece na mesa é de verdade (colide, pontua, funciona).
   Mantidos da arte original: a rampa FERRADURA de madeira, os bumpers
   de engrenagem, os buracos da estrela e das caveiras, o buraco negro
   com túnel até a MOLA, a roda central com choque, os estilingues,
   o quadro de luzes e as gravuras de Minas.
   Áreas pedidas:
   (1) lançador no canto de baixo à direita (corredor com a mola)
   (2) corredor da esquerda = OUTLANE: pontua, mas a bola se perde
       (a não ser que o KICKBACK esteja aceso)
   (3) alto à esquerda = pistas U-A-I: a bola lançada fraca cai ali;
       completar U-A-I reacende o KICKBACK da área (2)
   ============================================================ */
(function () {
  const K = UAI.Kit;
  const L = K.chassis({ gap: [236, 372] });

  // (3) pistas U-A-I logo abaixo da abertura do trilho de cima
  K.topLanes(L, 'uai', ['U', 'A', 'I'], 250, 212, 56, 'kickback');

  // a FERRADURA: rampa de madeira que entra pela direita, faz a curva
  // lá no alto e desce pelo braço esquerdo até a palheta esquerda
  K.ramp(L, {
    id: 'ferradura', name: 'FERRADURA!', style: 'wood',
    mouth: { x: 606, y: 640, dir: [-0.04, -1] },
    path: [[620, 440], [650, 300], [598, 200], [510, 178], [430, 206], [384, 280], [352, 380], [316, 470]],
    exitVel: [-160, 420], points: 1500, jackpot: true, duration: 1300
  });

  // bumpers de engrenagem dentro da ferradura
  K.bumper(L, 472, 298, 34);
  K.bumper(L, 562, 312, 34);
  K.bumper(L, 516, 392, 30);

  // buracos da estrela e das caveiras (travas da multibola)
  K.saucer(L, 'estrela', 432, 470, [95, 650], { label: 'ESTRELA' });
  K.saucer(L, 'caveira', 494, 482, [90, 650], { label: 'CAVEIRA' });
  K.saucer(L, 'caveira2', 556, 470, [85, 650], { label: 'CAVEIRA' });

  // buraco negro (planeta) → túnel → MOLA na caixa da esquerda
  K.blackHole(L, 'planeta', 418, 566, 'mola');
  K.kicker(L, 'mola', 182, 470, [-50, 2200], true);

  // TRIO MINEIRO (triângulos de rolagem) e alvos do lado direito
  K.rollovers(L, 'trio', ['T', 'R', 'I'], [[176, 600], [222, 640], [176, 680]], 'bonusX');
  L.bumpers.push({ x: 690, y: 610, r: 16, vr: 22, kind: 'target' }, { x: 680, y: 690, r: 16, vr: 22, kind: 'target' });

  // roda central com o cubo de choque
  L.bumpers.push({ x: 418, y: 772, r: 60, vr: 92, kind: 'wheel' }, { x: 418, y: 772, r: 26, kind: 'shock' });

  L.decor = {
    icons: [['spring', 150, 380, 64, -0.55], ['church', 236, 330, 56], ['cart', 250, 756, 50], ['rocket', 590, 752, 50],
            ['coffee', 690, 520, 34], ['paoqueijo', 290, 560, 36], ['gear', 300, 200, 26]],
    texts: [
      { text: 'UAI BALL', x: 418, y: 660, size: 62, title: true },
      { text: 'RESGATE DE MINEIROS', x: 250, y: 800, size: 12 },
      { text: 'AVANÇO TECNOLÓGICO', x: 590, y: 800, size: 12 },
      { text: 'mola', x: 182, y: 506, size: 14 }
    ]
  };

  K.add({
    id: 'uaiball', order: 1,
    name: 'Uai Ball', subtitle: 'A mesa original',
    theme: { wood: ['#7a4a22', '#c8904e'], frame: ['#24120a', '#4e2c12'], railWood: ['#7a4620', '#c48444'], inlay: ['#ffd89a', '#d08a3c'], insert: '#ffb347', metal: '#d9a441' },
    mods: { gravity: 1.0, omega: 1.0 },
    stars: [25000, 70000, 150000],
    missions: [
      { type: 'shot', id: 'ferradura', n: 2, text: 'Suba 2 vezes a FERRADURA' },
      { type: 'lanes', id: 'uai', n: 1, text: 'Acenda U-A-I (lá em cima): reacende o kickback' },
      { type: 'hole', id: 'planeta', n: 1, text: 'Caia no buraco negro (vai pelo túnel até a mola)' },
      { type: 'multiball', n: 1, text: 'Trave 3 bolas na estrela e nas caveiras: MULTIBOLA' }
    ],
    rules: { lockHoles: ['estrela', 'caveira', 'caveira2'], locksNeeded: 3, multStep: 5000 },
    layout: L
  });
})();
