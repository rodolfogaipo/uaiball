/* ============================================================
   UAI BALL – CONFIGURAÇÕES
   Tudo que você vai querer ajustar está neste arquivo:
   - Firebase (ranking online)
   - Física (motor próprio: elasticidade, palhetas, mola, bumpers)
   - Dificuldades
   - Geometria da mesa (paredes, bumpers, palhetas, buracos, luzes)
   ============================================================ */
window.UAI = window.UAI || {};

UAI.CONFIG = {
  WIDTH: 896,          // largura do "mundo" (mesmo tamanho da mesa.png)
  HEIGHT: 1200,        // altura do "mundo"

  /* ---- RANKING ONLINE (Firebase Realtime Database) ----
     Cole aqui a URL do seu banco, por exemplo:
     "https://uai-ball-default-rtdb.firebaseio.com"
     Deixe "" para usar só o ranking local do aparelho. */
  FIREBASE_DB_URL: "",
  RANK_PATH: "uaiball/scores",

  LIVES: 3,
  MAX_MULT: 8,         // multiplicador máximo (x8 = 7 luzes do quadro acesas)
  DRAIN_Y: 1170,       // abaixo disso a bola é considerada perdida (dreno)
  BALL_SAVE: 6000,     // ms de "bola salva" no começo de cada bola (igual pinball de bar)

  POINTS: {
    bumper: 100,       // bumper (engrenagem)
    ramp: 1000,        // rampa da ferradura completa (entra na direita, sai na esquerda)
    orbit: 500,        // volta pela câmara da mola (lado esquerdo)
    sling: 10,         // estilingues triangulares
    rollover: 50,      // cada triângulo aceso
    rolloverSet: 1000, // acender os 3 triângulos
    saucer: 750,       // bola cai num buraco (estrela/caveira)
    saucerSet: 3000,   // os 3 buracos acesos = MINA DE OURO
    blackhole: 1500,   // buraco negro do planeta
    spring: 250,       // disparo da mola
    wheel: 25,         // roda central girando
    multStep: 5000     // a cada 5.000 pontos o multiplicador sobe
  }
};

/* ============================================================
   FÍSICA – motor próprio de pinball (js/physics.js)
   Valores de partida tirados do Visual Pinball X (vpinball/vpinball):
     palheta: elasticidade 0.8, falloff 0.43, atrito 0.6
     paredes: elasticidade ~0.3   |   física a 1000 passos/s
   Velocidades em px/s. A bola tem 28 px ≈ 27 mm → 1 m/s ≈ 1040 px/s.
   e  = elasticidade (0 = morta, 1 = quica tudo)
   fo = falloff: quanto a borracha "amortece" batidas fortes
   mu = atrito
   kick / thr = chute ativo (px/s) e impacto mínimo para disparar
   ============================================================ */
UAI.PHYSICS = {
  ball: { radius: 14 },
  rollDrag: 0.06,              // resistência ao rolamento
  maxSpeed: 4000,              // trava de segurança (px/s)

  wall:   { e: 0.30, fo: 0,    mu: 0 },     // trilhos de madeira
  rubber: { e: 0.75, fo: 0.25, mu: 0 },     // borrachas dos postes / lados do estilingue
  bumper: { e: 0.70, fo: 0.2,  kick: 950,  thr: 60,  cool: 0.10,
            spriteRatio: 0.72, perspective: 0.86 },
  shock:  { boost: 1.3, minAdd: 450, minSpeed: 900, cool: 300 },     // cubo da roda: acelera a bola que passa (x1.3)
  sling:  { e: 0.80, fo: 0.25, kick: 1050, thr: 110, cool: 0.15 },

  flipper: {
    length: 158,      // comprimento (px) – multiplicado pela escala da dificuldade
    baseRadius: 16,   // raio na base (rolamento)
    tipRadius: 9,     // raio na ponta
    restAngle: 30,    // ângulo em repouso (graus; + = ponta para baixo)
    upAngle: -28,     // ângulo acionada
    // bobina: acelera até omegaMax em poucos ms (como o "coil ramp up" do VPX)
    accUp: 2400,      // rad/s²
    omegaDown: 11,    // velocidade de retorno pela mola (rad/s)
    accDown: 800,
    e: 0.8, fo: 0.43, mu: 0.6
  },

  holes: {
    holdTime: 1000,     // ms presa no buraco antes de ser cuspida
    captureSpeed: 1500, // bola mais rápida que isso "pula" o buraco (igual na vida real)
    pull: 2000,         // força do campo do buraco negro (px/s²)
    pullRadius: 58
  },
  // trilho de saída da rampa (como o "habitrail" das mesas reais): a bola que desce
  // o braço esquerdo é entregue para o lado esquerdo → inlane → palheta esquerda
  rampExit: { dir: [-0.72, 0.69], maxSpeed: 1100 },
  rampBoost: 2300,          // acelerador no canal direito da ferradura (px/s)
  rampBoostDir: [0.12, -1], // direção do empurrão (para cima, encostando no trilho de fora)
  plunger: {
    min: 2350,          // um toque leve já leva a bola até o topo
    max: 3150,          // mola toda puxada
    chargeTime: 900,    // ms segurando a tecla para carregar 100%
    dragDistance: 220   // px arrastando o dedo para cima para carregar 100%
  }
};

/* ============================================================
   DIFICULDADES
   gravity em px/s² · omega = velocidade máxima da palheta (rad/s)
   ============================================================ */
UAI.DIFFICULTIES = {
  facil: {
    label: 'FÁCIL', desc: 'Mesa mais lenta, palhetas grandes, bola salva longa',
    gravity: 900, omega: 13, plunger: 1.0, flipperScale: 1.15, ballSave: 12000
  },
  medio: {
    label: 'MÉDIO', desc: 'Física padrão de pinball',
    gravity: 1100, omega: 14.5, plunger: 1.05, flipperScale: 1.0, ballSave: 6000
  },
  dificil: {
    label: 'DIFÍCIL', desc: 'Mesa rápida, palhetas curtas, sem bola salva',
    gravity: 1350, omega: 16, plunger: 1.12, flipperScale: 0.88, ballSave: 0
  }
};

/* ============================================================
   GEOMETRIA DA MESA – coordenadas em px sobre a mesa.png (896x1200)
   Para ajustar: no jogo aperte G (ver colisões) e E (editor),
   arraste os pontos e aperte C para copiar o JSON.
   Depois cole aqui no lugar deste objeto (e aumente "version").
   ============================================================ */
UAI.DEFAULT_TABLE = {
  version: 12,

  // Paredes = linhas poligonais [x, y]. "mat": wall (madeira) | rubber (borracha)
  walls: [
    // contorno: inlane esquerda → corredor esquerdo → topo da câmara da mola → arco da ferradura → corredor do lançador
    { id: 'externa', pts: [[276, 1019], [196, 1000], [140, 976], [112, 944], [104, 880], [104, 650], [94, 590], [86, 520], [84, 330], [90, 210], [112, 142], [160, 100], [240, 82], [380, 78], [500, 80], [548, 96], [572, 110], [660, 108], [735, 130], [790, 176], [825, 236], [838, 300], [838, 1106], [800, 1106], [800, 330]] },
    // trilho de fora do braço esquerdo da ferradura (separa a rampa da câmara da mola)
    { id: 'bracoEsquerdo', pts: [[332, 494], [318, 420], [312, 340], [325, 278], [358, 224], [412, 172], [482, 134], [572, 110]] },
    // trilho de dentro da ferradura
    { id: 'rampaInterna', pts: [[422, 452], [378, 396], [372, 322], [390, 264], [440, 218], [520, 186], [600, 172], [680, 182], [735, 222], [756, 290], [752, 365], [704, 400]] },
    // desviador do fim do canal direito: joga a bola para o meio da mesa
    { id: 'desvioDireito', pts: [[800, 470], [797, 520], [784, 552], [760, 566]] },
    // as duas varetas de madeira: lado esquerdo da entrada da rampa
    { id: 'varetasRampa', pts: [[612, 470], [704, 398]] },
    // guia curva da direita (J): parede de fora da inlane direita
    { id: 'guiaDireita', pts: [[616, 1019], [700, 994], [742, 958], [748, 700], [736, 664], [700, 646]] }
  ],

  // Portões de mão única: a bola passa no sentido "pass" e é barrada no contrário
  gates: [
    { pts: [[800, 330], [838, 300]], pass: [0, -1] }   // topo do corredor do lançador
  ],

  // Blocos sólidos: triângulo de madeira do portão da rampa e a caixa da mola
  blocks: [
    { pts: [[745, 432], [752, 522], [676, 508]] },
    { pts: [[84, 292], [148, 322], [258, 486], [226, 506], [84, 404]] }
  ],

  // Bumpers (engrenagens) sobre as marcações redondas da madeira.
  // r = raio físico · vr = raio do desenho · sensor: roda que gira · shock: cubo que dá choque · target: alvo que a bola atravessa
  bumpers: [
    { x: 480, y: 320, r: 35, vr: 48 },  // placa da estrela
    { x: 637, y: 297, r: 42, vr: 62 },  // círculo dentro da ferradura
    { x: 705, y: 608, r: 40, vr: 62 },  // círculo grande da direita
    { x: 317, y: 545, r: 16, vr: 22, target: true },  // moeda com estrela (alvo)
    { x: 575, y: 557, r: 17, vr: 24, target: true },  // sol de cima (alvo: a bola passa e pontua)
    { x: 546, y: 583, r: 14, vr: 20, target: true },  // sol de baixo (alvo)
    { x: 444, y: 805, r: 60, vr: 92, sensor: true },   // roda central
    { x: 444, y: 805, r: 26, hidden: true, shock: true } // cubo da roda: CHOQUE que acelera a bola
  ],

  // Estilingues triangulares. kick = índices dos 2 vértices da face que chuta a bola
  slings: [
    { pts: [[196, 792], [190, 896], [262, 932]], kick: [0, 2] },
    { pts: [[690, 792], [696, 898], [624, 934]], kick: [0, 2] }
  ],

  // Pivôs das palhetas (ponto de giro, no rolamento)
  flippers: { left: [284, 1036], right: [608, 1036] },

  // Sensores da rampa [x, y, raio]: acelerador no canal direito → topo → saída esquerda
  ramp: { right: [778, 400, 22], apex: [600, 142, 24], left: [372, 470, 30] },

  // Câmara da mola (lado esquerdo): entrar por baixo e chegar lá em cima = ÓRBITA
  orbit: { entry: [296, 468, 34], top: [300, 150, 90] },

  // Triângulos de rolagem (sensores com luz)
  rollovers: [[250, 560], [322, 600], [262, 640]],

  // Buracos: saucer = prende e cospe de volta · blackhole = suga e manda pelo túnel até a mola
  // eject = [direção em graus (0 = direita, 90 = para baixo), velocidade px/s]
  holes: [
    { id: 'estrela', type: 'saucer', x: 473, y: 422, r: 13, eject: [100, 650] },
    { id: 'caveira', type: 'saucer', x: 518, y: 422, r: 13, eject: [90, 650] },
    { id: 'caveira2', type: 'saucer', x: 557, y: 405, r: 13, eject: [80, 650] },
    { id: 'planeta', type: 'blackhole', x: 523, y: 487, r: 16 }
  ],

  // Pé da mola desenhada: saída do túnel e "chutador" se a bola encostar nele
  spring: { x: 252, y: 522, r: 16, eject: [56, 2200] },

  // Onde a bola nasce (no corredor de lançamento)
  ballStart: [819, 1090],

  // Luzes decorativas
  lights: {
    chevrons: [[626, 650], [620, 672], [612, 694], [604, 716], [562, 756]], // setas
    grid: [[381, 929], [443, 929], [505, 929], [381, 973], [443, 973], [505, 973], [443, 1018]], // multiplicador
    extra: [[185, 410], [525, 490], [585, 770]], // mola, planeta, foguete
    drain: [443, 1095]
  }
};
