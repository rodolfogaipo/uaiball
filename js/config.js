/* ============================================================
   UAI BALL – CONFIGURAÇÕES
   Tudo que você vai querer ajustar está neste arquivo:
   - Firebase (ranking online)
   - Física (elasticidade, atrito, força das palhetas...)
   - Dificuldades
   - Geometria da mesa (paredes, bumpers, palhetas, luzes)
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
  SUBSTEPS: 4,         // sub-passos de física por quadro (evita a bola atravessar paredes)
  DRAIN_Y: 1165,       // abaixo disso a bola é considerada perdida (dreno)

  POINTS: {
    bumper: 100,       // bumper (engrenagem)
    ramp: 500,         // completar a rampa superior (entra pelo portão da direita e sai pela esquerda)
    sling: 10,         // estilingues triangulares
    rollover: 50,      // cada triângulo aceso
    rolloverSet: 1000, // acender os 3 triângulos
    multStep: 5000     // a cada 5.000 pontos o multiplicador sobe
  }
};

/* ============================================================
   FÍSICA (Matter.js, que já vem dentro do Phaser)
   - restitution: elasticidade (0 = não quica, 1 = quica perfeito, >1 = ganha energia)
   - friction:    atrito de contato (0 = liso)
   - frictionAir: "resistência do ar" (freia a bola aos poucos)
   - Velocidades em pixels por quadro (60 fps)
   ============================================================ */
UAI.PHYSICS = {
  ball: {
    radius: 14,         // raio da bola em px
    restitution: 0.32,  // quique da bola
    friction: 0.002,    // atrito da bola contra paredes/palhetas
    frictionAir: 0.0005,
    density: 0.004      // massa = densidade x área
  },
  wall: {
    thickness: 12,      // espessura das paredes invisíveis
    restitution: 0.45,  // madeira devolve um pouco da energia
    friction: 0.0
  },
  bumper: {
    restitution: 1.05,
    spriteRatio: 0.72   // raio físico / raio do desenho (o anel de latão fica de fora da colisão)
  },
  sling: {
    restitution: 0.6,
    kick: 12            // velocidade do chute do estilingue
  },
  flipper: {
    length: 160,        // comprimento da palheta (px) – multiplicado pela escala da dificuldade
    thickness: 28,      // espessura física da palheta
    restAngle: 30,      // ângulo em repouso (graus; positivo = ponta para baixo)
    upAngle: -28,       // ângulo acionada (graus) → limites rígidos de -28° a +30°
    upSpeed: 0.30,      // velocidade de subida (radianos por quadro)
    downSpeed: 0.26,    // velocidade de retorno (rebote rápido)
    restitution: 0.45
  },
  rampBoost: 24,        // velocidade mínima dada pelo acelerador do portão da rampa
  rampBoostDir: [0.04, -1],   // direção do empurrão (para cima, subindo o canal da direita)
  plunger: {
    min: 13,            // velocidade mínima do lançamento
    max: 33,            // velocidade máxima (mola toda puxada)
    chargeTime: 1000,   // ms segurando a tecla para carregar 100%
    dragDistance: 240   // px arrastando o dedo para cima para carregar 100%
  }
};

/* ============================================================
   DIFICULDADES
   ============================================================ */
UAI.DIFFICULTIES = {
  facil: {
    label: 'FÁCIL', desc: 'Gravidade leve, palhetas grandes, mola forte',
    gravity: 0.78, plunger: 1.12, flipperScale: 1.2, maxSpeed: 27, bumperKick: 10.5
  },
  medio: {
    label: 'MÉDIO', desc: 'Física padrão de pinball',
    gravity: 1.0, plunger: 1.0, flipperScale: 1.0, maxSpeed: 32, bumperKick: 12.5
  },
  dificil: {
    label: 'DIFÍCIL', desc: 'Gravidade pesada, palhetas curtas, bola rápida',
    gravity: 1.28, plunger: 0.92, flipperScale: 0.8, maxSpeed: 38, bumperKick: 14.5
  }
};

/* ============================================================
   GEOMETRIA DA MESA – coordenadas em px sobre a mesa.png (896x1200)
   Mapeada sobre as guias de madeira da imagem.
   Para ajustar: no jogo aperte G (ver colisões) e E (editor),
   arraste os pontos e aperte C para copiar o JSON.
   Depois cole aqui no lugar deste objeto (e aumente "version").
   ============================================================ */
UAI.DEFAULT_TABLE = {
  version: 5,

  // Paredes = linhas poligonais [x, y]
  walls: [
    // contorno: guia esquerda → braço esquerdo da ferradura → arco do topo → lado direito → corredor de lançamento
    { id: 'externa', pts: [[268, 1030], [182, 990], [152, 958], [140, 900], [140, 760], [148, 650], [170, 570], [205, 508], [268, 498], [332, 494], [318, 420], [312, 340], [325, 278], [358, 224], [412, 170], [482, 132], [560, 113], [660, 111], [735, 132], [790, 188], [822, 265], [836, 340], [838, 1104], [792, 1104], [792, 520], [752, 522]] },
    // trilho interno da rampa (ferradura)
    { id: 'rampaInterna', pts: [[422, 452], [378, 396], [372, 322], [390, 264], [440, 218], [520, 186], [600, 172], [680, 182], [735, 222], [756, 290], [752, 365], [704, 400]] },
    // guia curva do lado direito (leva até a palheta direita)
    { id: 'guiaDireita', pts: [[612, 1036], [700, 998], [740, 962], [742, 742], [728, 700], [680, 668], [640, 658]] },
    { id: 'tampaDireita', pts: [[728, 700], [792, 700]] }
  ],

  // Blocos sólidos (polígonos sem chute) – triângulo de madeira ao lado do portão da rampa
  blocks: [
    { pts: [[745, 432], [752, 522], [676, 508]] }
  ],

  // Bumpers (engrenagens): centro e raio físico. sensor: true = roda que gira sem rebater
  bumpers: [
    { x: 482, y: 322, r: 30 },  // estrela
    { x: 642, y: 300, r: 34 },  // círculo dentro da ferradura
    { x: 705, y: 595, r: 28 },  // círculo da direita
    { x: 315, y: 545, r: 16 },  // moeda estrela da esquerda
    { x: 560, y: 568, r: 18 },  // sol
    { x: 445, y: 792, r: 62, sensor: true }   // roda central: a bola passa por cima, ela gira e pontua
  ],

  // Estilingues triangulares. kick = índices dos 2 vértices da face que chuta a bola
  slings: [
    { pts: [[196, 790], [186, 896], [264, 930]], kick: [0, 2] },
    { pts: [[690, 790], [696, 898], [616, 932]], kick: [0, 2] }
  ],

  // Pivôs das palhetas (ponto de giro, no rolamento)
  flippers: { left: [284, 1036], right: [608, 1036] },

  // Sensores da rampa [x, y, raio]: acelerador no canal da direita → topo → saída esquerda
  ramp: { right: [780, 396, 22], apex: [600, 142, 16], left: [372, 466, 22] },

  // Triângulos de rolagem (sensores com luz)
  rollovers: [[250, 560], [322, 588], [326, 628]],

  // Onde a bola nasce (no corredor de lançamento)
  ballStart: [815, 1088],

  // Luzes decorativas
  lights: {
    chevrons: [[626, 650], [620, 672], [612, 694], [604, 716], [562, 756]], // setas
    grid: [[381, 929], [443, 929], [505, 929], [381, 973], [443, 973], [505, 973], [443, 1018]], // multiplicador
    extra: [[185, 410], [525, 490], [585, 770]], // mola, planeta, foguete
    drain: [443, 1095]
  }
};
