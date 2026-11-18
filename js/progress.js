/* ============================================================
   UAI BALL – CARREIRA DO JOGADOR
   ------------------------------------------------------------
   Tudo fica salvo no aparelho (localStorage):
   • XP e NÍVEL com títulos mineiros (Visitante → Lenda de Minas)
   • por mesa: melhor pontuação, ESTRELAS (1 a 3) e partidas
   • DESBLOQUEIO: 1 estrela numa mesa libera a próxima
   • CONQUISTAS (medalhas)
   • DESAFIO DO DIA com sequência de dias seguidos
   ============================================================ */
window.UAI = window.UAI || {};

UAI.Progress = {
  TITLES: [
    'Visitante', 'Forasteiro', 'Caipira', 'Tropeiro', 'Matuto Esperto',
    'Mineirinho', 'Tropeiro de Ouro', 'Coronel do Fliperama', 'Rei do Pão de Queijo',
    'Mestre das Gerais', 'Lenda de Minas'
  ],

  ACHIEVEMENTS: [
    { id: 'primeira', icon: '🎱', name: 'Primeira bola', desc: 'Jogue sua primeira partida' },
    { id: 'p10k', icon: '🪙', name: 'Trocado', desc: 'Faça 10.000 pontos numa partida' },
    { id: 'p100k', icon: '💰', name: 'Cofre cheio', desc: 'Faça 100.000 pontos numa partida' },
    { id: 'p500k', icon: '🏦', name: 'Banco de Minas', desc: 'Faça 500.000 pontos numa partida' },
    { id: 'multibola', icon: '⚡', name: 'Multibola!', desc: 'Comece uma multibola' },
    { id: 'jackpot', icon: '🎰', name: 'Jackpot', desc: 'Pegue um jackpot na multibola' },
    { id: 'superjackpot', icon: '👑', name: 'Super jackpot', desc: 'Pegue um super jackpot' },
    { id: 'tacada', icon: '🎯', name: 'Tacada de mestre', desc: 'Acerte a tacada de mestre no lançador' },
    { id: 'combo5', icon: '🔥', name: 'Embalado', desc: 'Faça um combo de 5 tiros' },
    { id: 'missoes', icon: '📜', name: 'Missão dada...', desc: 'Cumpra as 4 missões de uma mesa' },
    { id: 'estrela3', icon: '⭐', name: 'Três estrelas', desc: 'Ganhe 3 estrelas numa mesa' },
    { id: 'metade', icon: '🗺️', name: 'Viajante', desc: 'Libere 6 mesas' },
    { id: 'todas', icon: '🏔️', name: 'Minas inteira', desc: 'Libere todas as mesas' },
    { id: 'lenda', icon: '🏆', name: 'Coleção completa', desc: '3 estrelas em todas as mesas' },
    { id: 'desafio', icon: '📅', name: 'Desafiado', desc: 'Vença um desafio do dia' },
    { id: 'semana', icon: '🗓️', name: 'Uma semana', desc: 'Jogue 7 dias seguidos' },
    { id: 'dificil', icon: '💀', name: 'Cabra macho', desc: 'Ganhe 1 estrela no DIFÍCIL' },
    { id: 'jogos50', icon: '🎖️', name: 'Freguês', desc: 'Jogue 50 partidas' }
  ],

  /* ---------- perfil ---------- */
  load() {
    const p = UAI.Store.get('profile', null) || {};
    return Object.assign({ xp: 0, games: 0, total: 0, tables: {}, ach: {}, daily: null, streak: { last: null, n: 0 } }, p);
  },
  save(p) { UAI.Store.set('profile', p); },
  get() { return this.load(); },

  /* nível n precisa de 400·n·(n+1)/2 XP no total (cada nível pede um pouco mais) */
  levelFromXp(xp) {
    let n = 1;
    while (xp >= this.xpFor(n + 1)) n++;
    return n;
  },
  xpFor(level) { return 400 * (level - 1) * level / 2; },
  title(level) { return this.TITLES[Math.min(this.TITLES.length - 1, Math.floor((level - 1) / 3))]; },
  levelInfo(xp) {
    const lv = this.levelFromXp(xp), a = this.xpFor(lv), b = this.xpFor(lv + 1);
    return { level: lv, title: this.title(lv), xp, into: xp - a, need: b - a, frac: (xp - a) / (b - a) };
  },

  /* ---------- mesas ---------- */
  tableStats(p, id) { return p.tables[id] || { best: 0, stars: 0, plays: 0, bestDiff: null, mastered: false }; },
  starsFor(def, score) { return (def.stars || []).filter(s => score >= s).length; },
  totalStars(p) { return Object.values(p.tables).reduce((s, t) => s + (t.stars || 0), 0); },

  /** mesa liberada? (a 1ª sempre; as outras pedem 1 estrela na anterior) */
  isUnlocked(p, def) {
    if (UAI.Store.get('unlockAll', false)) return true;
    const list = UAI.tablesSorted(), i = list.findIndex(t => t.id === def.id);
    if (i <= 0) return true;
    return (this.tableStats(p, list[i - 1].id).stars || 0) >= 1;
  },
  unlockedCount(p) { return UAI.tablesSorted().filter(d => this.isUnlocked(p, d)).length; },

  /* ---------- desafio do dia ---------- */
  today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
  daily(p) {
    p = p || this.load();
    const key = this.today();
    if (p.daily && p.daily.date === key) return p.daily;
    // sorteio fixo do dia entre as mesas liberadas
    let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const open = UAI.tablesSorted().filter(d => this.isUnlocked(p, d));
    const def = open[h % open.length];
    const base = (def.stars && def.stars[0]) || 20000;
    const target = Math.round(base * (1.1 + (h % 5) * 0.15) / 1000) * 1000;
    const kinds = ['score', 'score', 'missions'];
    const kind = kinds[(h >> 3) % kinds.length];
    const d = { date: key, table: def.id, kind, target, missions: 2, done: false };
    p.daily = d; this.save(p);
    return d;
  },
  dailyText(d) {
    const def = UAI.tableById(d.table);
    return d.kind === 'missions'
      ? 'Cumpra ' + d.missions + ' missões na mesa ' + def.name
      : 'Faça ' + UAI.fmt(d.target) + ' pontos na mesa ' + def.name;
  },

  /* ---------- fim de partida ----------
     g = { table, score, difficulty, stats, missionsDone, mastered, daily }
     Devolve tudo o que a tela de fim de jogo precisa mostrar. */
  finishGame(g) {
    const p = this.load(), def = UAI.tableById(g.table), diff = UAI.DIFFICULTIES[g.difficulty] || UAI.DIFFICULTIES.medio;
    const before = this.levelInfo(p.xp);
    const unlockedBefore = UAI.tablesSorted().filter(d => this.isUnlocked(p, d)).map(d => d.id);
    const T = this.tableStats(p, g.table);
    const stars = this.starsFor(def, g.score);
    const newStars = Math.max(0, stars - (T.stars || 0));
    const isRecord = g.score > (T.best || 0);
    T.plays = (T.plays || 0) + 1;
    if (isRecord) { T.best = g.score; T.bestDiff = g.difficulty; }
    T.stars = Math.max(T.stars || 0, stars);
    if (g.mastered) T.mastered = true;
    p.tables[g.table] = T;
    p.games++; p.total += g.score;

    // XP: pontos + missões + estrelas novas + desafio do dia
    const xpParts = [];
    const xpScore = Math.round(Math.min(3000, g.score / 60) * diff.xp);
    xpParts.push(['Pontos', xpScore]);
    if (g.missionsDone) xpParts.push(['Missões', g.missionsDone * 120]);
    if (newStars) xpParts.push(['Estrelas novas', newStars * 300]);
    if (isRecord && T.plays > 1) xpParts.push(['Recorde da mesa', 150]);

    // desafio do dia
    let dailyWon = false;
    const d = this.daily(p);
    if (!d.done && d.table === g.table &&
        ((d.kind === 'score' && g.score >= d.target) || (d.kind === 'missions' && g.missionsDone >= d.missions))) {
      d.done = true; dailyWon = true; p.daily = d;
      xpParts.push(['Desafio do dia', 1000]);
    }
    // dias seguidos jogando
    const today = this.today();
    if (p.streak.last !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yk = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      p.streak.n = p.streak.last === yk ? p.streak.n + 1 : 1;
      p.streak.last = today;
      if (p.streak.n > 1) xpParts.push(['Dias seguidos: ' + p.streak.n, Math.min(500, p.streak.n * 50)]);
    }
    const xp = xpParts.reduce((s, x) => s + x[1], 0);
    p.xp += xp;
    const after = this.levelInfo(p.xp);

    // mesas novas liberadas
    const unlocked = UAI.tablesSorted().filter(dd => this.isUnlocked(p, dd) && !unlockedBefore.includes(dd.id));

    // conquistas
    const S = g.stats || {}, got = [];
    const give = id => { if (!p.ach[id]) { p.ach[id] = Date.now(); got.push(this.ACHIEVEMENTS.find(a => a.id === id)); } };
    give('primeira');
    if (g.score >= 10000) give('p10k');
    if (g.score >= 100000) give('p100k');
    if (g.score >= 500000) give('p500k');
    if (S.multiballs) give('multibola');
    if (S.jackpots) give('jackpot');
    if (S.superJackpots) give('superjackpot');
    if (S.skillShots) give('tacada');
    if ((S.maxCombo || 0) >= 5) give('combo5');
    if (g.missionsDone >= (def.missions || []).length && def.missions.length) give('missoes');
    if (stars >= 3) give('estrela3');
    const nOpen = this.unlockedCount(p);
    if (nOpen >= 6) give('metade');
    if (nOpen >= UAI.TABLES.length) give('todas');
    if (UAI.TABLES.every(t => this.tableStats(p, t.id).stars >= 3)) give('lenda');
    if (dailyWon) give('desafio');
    if (p.streak.n >= 7) give('semana');
    if (stars >= 1 && g.difficulty === 'dificil') give('dificil');
    if (p.games >= 50) give('jogos50');

    this.save(p);
    return {
      def, stars, newStars, isRecord, best: T.best, xp, xpParts, before, after,
      levelUp: after.level > before.level, unlocked, achievements: got.filter(Boolean), dailyWon, daily: d,
      next: this.nextTable(def)
    };
  },

  nextTable(def) {
    const list = UAI.tablesSorted(), i = list.findIndex(t => t.id === def.id);
    return list[i + 1] || null;
  }
};
