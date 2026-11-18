/* ============================================================
   MESA 1 – UAI BALL (arte original)
   Coordenadas medidas sobre a mesa.png (896×1200).
   Áreas pedidas:
   (1) lançador no canto inferior direito
   (2) corredor da esquerda = OUTLANE: pontua, mas a bola que desce
       por ali se perde (a não ser que o KICKBACK esteja aceso)
   (3) câmara de cima à esquerda = pistas U-A-I: pontos e reacendem
       o KICKBACK que salva a bola na saída (2)
   ============================================================ */
UAI.Kit.add({
  id: 'uaiball', order: 1,
  name: 'Uai Ball', subtitle: 'A mesa original',
  art: 'mesa',                 // usa a imagem assets/mesa.png
  mods: { gravity: 1.07, omega: 1.0, ballSave: 0.8 },
  stars: [40000, 120000, 250000],
  missions: [
    { type: 'shot', id: 'rampa', n: 2, text: 'Faça 2 rampas da ferradura' },
    { type: 'lanes', id: 'uai', n: 1, text: 'Acenda U-A-I (lá em cima): reacende o kickback' },
    { type: 'hole', id: 'planeta', n: 1, text: 'Caia no buraco negro' },
    { type: 'multiball', n: 1, text: 'Trave 3 bolas nas caveiras e faça MULTIBOLA' }
  ],
  rules: { lockHoles: ['caveira', 'caveira2', 'estrela'], locksNeeded: 3, multStep: 5000 },
  layout: {
    walls: [
      // (2) parede do gabinete à esquerda: agora o corredor esquerdo é a outlane
      { id: 'externa', pts: [[58, 1196], [58, 330], [64, 210], [90, 142], [150, 100], [240, 82], [380, 78], [500, 80], [548, 96], [572, 110], [660, 108], [735, 130], [790, 176], [825, 236], [838, 300], [838, 1106], [800, 1106], [800, 330]] },
      // divisor outlane/inlane (o "J" de madeira da esquerda)
      { id: 'divisorEsq', pts: [[276, 1019], [196, 1000], [140, 976], [112, 944], [104, 880], [104, 650]] },
      { id: 'bracoEsquerdo', pts: [[332, 494], [318, 420], [312, 340], [325, 278], [358, 224], [412, 172], [482, 134], [572, 110]] },
      { id: 'rampaInterna', pts: [[422, 452], [378, 396], [372, 322], [390, 264], [440, 218], [520, 186], [600, 172], [680, 182], [735, 222], [756, 290], [752, 365], [704, 400]] },
      { id: 'desvioDireito', pts: [[800, 470], [797, 520], [784, 552], [760, 566]] },
      { id: 'varetasRampa', pts: [[612, 470], [704, 398]] },
      { id: 'guiaDireita', pts: [[616, 1019], [700, 994], [742, 958], [748, 700], [736, 664], [700, 646]] },
      // (3) guias das pistas U-A-I no topo esquerdo
      { id: 'uai_g0', pts: [[166, 128], [166, 176]] },
      { id: 'uai_g1', pts: [[226, 120], [226, 172]] },
      { id: 'uai_g2', pts: [[286, 116], [286, 168]] },
      { id: 'uai_g3', pts: [[346, 116], [346, 164]] }
    ],
    gates: [{ pts: [[800, 330], [838, 300]], pass: [0, -1] }],
    posts: [[104, 650, 6], [166, 128, 5], [226, 120, 5], [286, 116, 5], [346, 116, 5]],
    blocks: [
      { pts: [[745, 432], [752, 522], [676, 508]] },
      { pts: [[100, 300], [148, 322], [258, 486], [226, 506], [100, 420]] }   // caixa da mola
    ],
    bumpers: [
      { x: 480, y: 320, r: 35, vr: 48 },
      { x: 637, y: 297, r: 42, vr: 62 },
      { x: 705, y: 608, r: 40, vr: 62 },
      { x: 317, y: 545, r: 16, vr: 22, kind: 'target' },
      { x: 575, y: 557, r: 17, vr: 24, kind: 'target' },
      { x: 546, y: 583, r: 14, vr: 20, kind: 'target' },
      { x: 444, y: 805, r: 60, vr: 92, kind: 'wheel' },
      { x: 444, y: 805, r: 26, kind: 'shock' }
    ],
    slings: [
      { pts: [[196, 792], [190, 896], [262, 932]], kick: [0, 2] },
      { pts: [[690, 792], [696, 898], [624, 934]], kick: [0, 2] }
    ],
    flippers: [{ x: 284, y: 1036, side: 'L', len: 150 }, { x: 608, y: 1036, side: 'R', len: 150 }],
    ballStart: [819, 1090],
    plungerLane: { x0: 800, x1: 838, top: 330 },
    sensors: {
      rampR: [778, 400, 22], apex: [600, 142, 24], rampL: [372, 470, 30],
      orbEntry: [296, 468, 34], orbTop: [300, 200, 70],
      outL: [80, 875, 20], inL: [150, 872, 18], inR: [722, 875, 18]
    },
    shots: [
      { id: 'rampa', name: 'RAMPA!', seq: ['rampR', 'apex', 'rampL'], dirs: ['up', null, 'down'], points: 1000, timeout: 4000, jackpot: true },
      { id: 'rampaRev', name: 'RAMPA REVERSA!', seq: ['rampL', 'apex', 'rampR'], dirs: ['up', null, 'down'], points: 1000, timeout: 4000, jackpot: true },
      { id: 'orbita', name: 'ÓRBITA!', seq: ['orbEntry', 'orbTop'], dirs: ['up', null], points: 500, timeout: 3000 }
    ],
    accels: [{ sensor: 'rampR', when: 'up', dir: [0.12, -1], speed: 2300, minX: 774 }],
    exits: [{ sensor: 'rampL', when: 'down', dir: [-0.72, 0.69], maxSpeed: 1100 }],
    holes: [
      { id: 'estrela', type: 'saucer', x: 473, y: 422, r: 13, eject: [100, 650] },
      { id: 'caveira', type: 'saucer', x: 518, y: 422, r: 13, eject: [90, 650] },
      { id: 'caveira2', type: 'saucer', x: 557, y: 405, r: 13, eject: [80, 650] },
      { id: 'planeta', type: 'blackhole', x: 523, y: 487, r: 16, to: 'mola' }
    ],
    kickers: [{ id: 'mola', x: 252, y: 522, r: 16, eject: [56, 2200], touch: true }],
    laneGroups: [
      { id: 'uai', name: 'U-A-I', letters: ['U', 'A', 'I'], lanes: [[196, 150], [256, 146], [316, 142]], award: 'kickback', rotate: true },
      { id: 'trio', name: 'TRIO MINEIRO', letters: ['T', 'R', 'I'], lanes: [[250, 560], [322, 600], [262, 640]], award: 'bonusX', rotate: true }
    ],
    outlanes: [{ id: 'L', sensor: 'outL', points: 500, kickback: { x: 80, y: 960, speed: 2400, litAtStart: true } }],
    inlanes: [{ sensor: 'inL', points: 100 }, { sensor: 'inR', points: 100 }],
    ramps: [], dropBanks: [], targetGroups: [], spinners: [],
    lights: {
      shots: { rampa: [[626, 650, -50], [610, 690, -50], [594, 730, -50]], orbita: [[290, 640, -100], [300, 600, -100]] },
      grid: [[381, 929], [443, 929], [505, 929], [381, 973], [443, 973], [505, 973], [443, 1018]],
      extra: [[185, 410], [525, 490], [585, 770]],
      drain: [443, 1095]
    },
    drainY: 1180
  }
});
