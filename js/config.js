/* ============================================================
   UAI BALL – CONFIGURAÇÕES GERAIS
   As mesas ficam em js/tables/ (uma descrição por mesa).
   Aqui: Firebase, física comum, dificuldades e pontuação base.
   ============================================================ */
window.UAI = window.UAI || {};

UAI.CONFIG = {
  WIDTH: 896,
  HEIGHT: 1200,

  /* ---- RANKING ONLINE (Firebase Realtime Database) ----
     Cole a URL do seu banco, ex.: "https://uai-ball-default-rtdb.firebaseio.com"
     Vazio = ranking só no aparelho. Cada mesa tem seu próprio ranking. */
  FIREBASE_DB_URL: "",
  RANK_PATH: "uaiball/scores",

  LIVES: 3,
  MAX_MULT: 8,         // multiplicador máximo da mesa
  MAX_BONUSX: 5,       // multiplicador máximo do bônus de fim de bola

  POINTS: {
    bumper: 100, sling: 10, rollover: 50, laneSet: 2000, inlane: 100, outlane: 500,
    saucer: 750, saucerLock: 1500, blackhole: 1500, kicker: 250, wheel: 25,
    drop: 250, dropBank: 3000, target: 300, targetSet: 3000,
    spin: 40, skillShot: 5000, combo: 1000, mission: 10000,
    jackpot: 15000, superJackpot: 50000, extraBall: 0
  }
};

/* ============================================================
   FÍSICA – motor próprio (js/physics.js)
   Valores de partida do Visual Pinball X (vpinball/vpinball):
     palheta: elasticidade 0.8, falloff 0.43, atrito 0.6 · paredes ~0.3
   Velocidades em px/s. Bola de 28 px ≈ 27 mm → 1 m/s ≈ 1040 px/s.
   ============================================================ */
UAI.PHYSICS = {
  ball: { radius: 14 },
  rollDrag: 0.06,
  maxSpeed: 4000,

  wall:   { e: 0.30, fo: 0,    mu: 0 },
  rubber: { e: 0.75, fo: 0.25, mu: 0 },
  bumper: { e: 0.70, fo: 0.2,  kick: 950,  thr: 60,  cool: 0.10, spriteRatio: 0.72, perspective: 0.86 },
  shock:  { boost: 1.3, minAdd: 450, minSpeed: 900, cool: 300 },
  sling:  { e: 0.80, fo: 0.25, kick: 1050, thr: 110, cool: 0.15 },
  drop:   { e: 0.35, fo: 0,    mu: 0 },

  flipper: {
    baseRadius: 16, tipRadius: 9,
    restAngle: 30, upAngle: -28,
    accUp: 2400, omegaDown: 11, accDown: 800,
    e: 0.8, fo: 0.43, mu: 0.6
  },

  holes: { holdTime: 1000, captureSpeed: 1500, pull: 2000, pullRadius: 58 },
  plunger: { min: 2350, max: 3150, chargeTime: 900, dragDistance: 220 }
};

/* ============================================================
   DIFICULDADES (multiplicam os ajustes de cada mesa)
   ============================================================ */
UAI.DIFFICULTIES = {
  facil:   { label: 'FÁCIL',   desc: 'Mesa mais lenta e bola salva longa', gravity: 900,  omega: 13,   plunger: 1.0,  flipperScale: 1.12, ballSave: 12000, xp: 0.8 },
  medio:   { label: 'MÉDIO',   desc: 'Física padrão de pinball',            gravity: 1100, omega: 14.5, plunger: 1.05, flipperScale: 1.0,  ballSave: 6000,  xp: 1.0 },
  dificil: { label: 'DIFÍCIL', desc: 'Mesa rápida, sem bola salva',         gravity: 1350, omega: 16,   plunger: 1.12, flipperScale: 0.9,  ballSave: 0,     xp: 1.4 }
};
