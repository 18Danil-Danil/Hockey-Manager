/* ============================================================
   HOCKEY GAME — ВХЛ (Live Edition)
   ------------------------------------------------------------
   Исправленные баги:
     • Карьера: место/очки сохраняются ДО обнуления record
     • Tryout: счётчик матчей списывается только если игрок играл
     • runAITransfers: соблюдает лимит легионеров (3)
   Новое:
     • LIVE-матч: 2D-трансляция (canvas), динамические тактики
       на перерывах, штрафы реально влияют на xG, 2-мин. PP
       заканчивается при голе, 5-мин. мажор — играется полностью.
   Патч 2:
     • ОТ — sudden death (гол в ОТ = конец), ОТ вничью = финиш
     • exitLiveMatchEarly — корректный расчёт остатка времени
     • Реабилитация доступна из модалки игрока
     • Политика травм 'once' сбрасывается после матча
     • Удалены дубли liveChangeTactic / renderLiveMatchScreen
     • saveGame/loadGame сохраняют RNG seed
     • Удалены мёртвые ветки executeInboxAction (extend_contract, rehab)
     • Live-интервал чистится на перерыве/паузе (экономия CPU)
   ============================================================ */

/* ============================================================
   RNG / ОБЩИЕ МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
   ============================================================ */
const { setSeed, getSeed, rng, randInt, pick, gauss, clamp, poisson, pickWeighted, timeToSec, randomTime } = window.GAME_RNG;

/* ============================================================
   КОНСТАНТЫ: СЛОЖНОСТЬ / ХАРАКТЕРЫ
   ============================================================ */
const { DIFFICULTIES, CHARACTERS, CHARACTER_WEIGHTS } = window.GAME_CONFIG;

/* ============================================================
   КОМАНДЫ ВХЛ — 30 клубов
   ============================================================ */
const VHL_TEAMS = window.VHL_TEAMS;

function getTeamById(id) { return G.league.teams.find(t => t.id === id); }
function getTeamBySlug(slug) { return G.league.teams.find(t => t.slug === slug); }

/* ============================================================
   ИМЕНА / ИГРОК
   ============================================================ */
const { FIRST, LAST, SKATER_ATTRS, GOALIE_ATTRS, ATTR_LABELS, NATS } = window.PLAYER_DATA;
let _idCounter = 1;
function nextId() { return _idCounter++; }
function ensurePlayoffStats(p) {
  if (!p.playoffStats) {
    if (p.position === 'G') p.playoffStats = { gp: 0, wins: 0, losses: 0, otl: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 };
    else p.playoffStats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, plusMinus: 0, pim: 0 };
  }
  return p.playoffStats;
}

/* ============================================================
   РЕПУТАЦИЯ / СОВЕТ ДИРЕКТОРОВ
   ============================================================ */
function updateReputation(team, won) {
  if (!G.career) G.career = { reputation: 50, history: [], noFireMode: false };
  let delta = won ? 0.5 : -0.5;
  if (G.career.noFireMode && delta < 0) delta *= 0.5;
  G.career.reputation = clamp(G.career.reputation + delta, 0, 100);
}
function generateBoardMessage() {
  if (!G.playerTeamId) return;
  if (G.league.currentRound === 0) return;
  if (G.league.currentRound % 10 !== 0) return;
  if (G.league.currentRound >= G.league.schedule.length) return;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const rank = standingsSorted().findIndex(t => t.id === G.playerTeamId) + 1;
  const diff = G.difficulty || DIFFICULTIES.normal;
  let mood = 'нейтрально';
  let delta = 0;
  if (rank <= diff.boardRequirement) { mood = 'хорошо'; delta = 3; }
  else if (rank <= diff.boardRequirement + 4) { mood = 'удовлетворительно'; delta = 0; }
  else { mood = 'плохо'; delta = -4; }
  G.career.reputation = clamp(G.career.reputation + delta, 0, 100);
  const reqText = rank <= diff.boardRequirement ? 'выше требуемого' : 'ниже требуемого';
  addInboxMessage('board', 'Совет директоров', `Оценка работы: ${mood}`,
    `Совет директоров оценивает текущее положение (${rank}-е место, ${reqText}). Репутация тренера: ${Math.round(G.career.reputation)}/100.`,
    []);
}
function maybeFirePlayer() {
  if (!G.playerTeamId) return false;
  if (G.career && G.career.noFireMode) return false;
  if (G.career.reputation >= 15) return false;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  addNews('firing', `${team.name} расторг контракт с главным тренером`, 3);
  G.firedFromTeamId = G.playerTeamId;
  G.playerTeamId = null;
  G.career.freeAgent = true;
  G.career.lastTeamName = team.name;
  return true;
}
function maybeForcedFreeAgent() {
  if (!G.playerTeamId) return false;
  if (!G.career || !G.career.noFireMode) return false;
  if (G.career.reputation >= 15) return false;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  addNews('firing', `${team.name} и главный тренер расторгли контракт по обоюдному согласию`, 3);
  G.firedFromTeamId = G.playerTeamId;
  G.playerTeamId = null;
  G.career.freeAgent = true;
  G.career.lastTeamName = team.name;
  return true;
}

/* ============================================================
   RETIREMENT
   ============================================================ */
function processRetirements(team) {
  const retiring = [];
  for (const p of team.roster) {
    if (p.status === 'tryout') continue;
    let chance = 0;
    if (p.age >= 40) chance = 0.95;
    else if (p.age >= 38) chance = 0.75;
    else if (p.age >= 36) chance = 0.45;
    else if (p.age >= 34) chance = 0.20;
    else if (p.age >= 32 && p.ovr < 70) chance = 0.15;
    if (rng() < chance) retiring.push(p);
  }
  for (const p of retiring) {
    p.status = 'retired';
    addNews('retirement', `${p.name} (${p.position}, ${p.ovr} OVR, ${p.age} лет) завершил карьеру. Клуб: ${team.name}`, p.ovr >= 80 ? 3 : 2);
    if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `${p.name} завершил карьеру`, `${p.name} (${p.position}, ${p.ovr}) в ${p.age} лет завершил карьеру.`, []);
  }
  team.roster = team.roster.filter(p => p.status !== 'retired');
  return retiring;
}


/* ============================================================
   ГЕНЕРАЦИЯ КОМАНДЫ (из VHL_TEAMS)
   ============================================================ */
function genTeam(meta) {
  const roster = [];
  const talent = meta.talent;
  const att = meta.ratings.att;
  const def = meta.ratings.def;
  const gk  = meta.ratings.gk;

  const fTemplate = [att + 4, att + 2, att, att - 2, att - 4, att - 6, att - 8, att - 10, att - 12, att - 14, att - 16, att - 18, att - 20];
  const fPositions = ['C','C','C','LW','LW','LW','RW','RW','RW','C','LW','RW','C'];
  fTemplate.forEach((baseOvr, i) => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer(fPositions[i], ovr));
  });
  const dTemplate = [def + 2, def, def - 2, def - 4, def - 6, def - 8, def - 10];
  dTemplate.forEach(baseOvr => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer('D', ovr));
  });
  [gk, gk - 6].forEach(baseOvr => {
    const ovr = clamp(Math.round(baseOvr + gauss(0, 2)), 52, 99);
    roster.push(genPlayer('G', ovr));
  });
  roster.sort((a, b) => b.ovr - a.ovr);

  const budget = meta.budget / 1_000_000;
  const baseFanBase = clamp(meta.fanBase / 5, 0.2, 1.0);
  const diff = G.difficulty || DIFFICULTIES.normal;
  const salaryCapPct = diff.salaryCapPct;

  const team = {
    id: meta.id, slug: meta.slug, name: meta.name, shortName: meta.shortName,
    city: meta.city, region: meta.region,
    strength: 1.00 + (talent - 64) / 14 * 0.40,
    talent: meta.talent, prestige: meta.prestige, trend: meta.trend,
    ratings: { ...meta.ratings },
    history: meta.history.map(h => ({ ...h })),
    trophies: {
      petrov: [...meta.trophies.petrov],
      regular: [...meta.trophies.regular],
      opening: [...meta.trophies.opening],
    },
    rivals: [...meta.rivals],
    logo: meta.logo,
    sponsorFlow: meta.sponsorFlow, govSupport: meta.govSupport,
    hockeyLove: meta.hockeyLove, youthFactor: meta.youthFactor,
    baseMarket: meta.baseMarket, gmType: meta.gmType,
    coachStyle: meta.coachStyle, staffSkill: meta.staffSkill,
    roster,
    record: { w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 },
    finance: {
      seasonBudget: budget,
      balance: Math.round(budget * 0.20 * diff.startBalancePct),
      salaryCap: Math.round(budget * salaryCapPct),
      arenaCapacity: meta.arenaCapacity,
      ticketPrice: 500,
      fanBase: baseFanBase, baseFanBase,
      merchLevel: 1, vipLevel: 0,
      matchdayFlags: { fanzone: false, show: false, kidsTickets: false },
      income: { tickets: 0, matchdayExtras: 0, sponsors: 0, sponsorBonuses: 0, tv: 0, prizes: 0, transfers: 0, merch: 0, gov: 0 },
      expenses: { salaries: 0, staffSalaries: 0, operations: 0, transfers: 0, bonuses: 0 },
      lastSponsorWins: 0, sponsorOffers: null,
    },
    arenaLevel: 1,
    tactics: { forecheck: 50, pressure: 50, style: 50, physical: 50, risk: 50 },
    sponsors: [],
    staff: { headCoach: null, assistantCoach: null, youthCoach: null, physicalCoach: null, doctor: null, psychologist: null, marketing: null, administrator: null, scout: null },
    infrastructure: { training: 1, medical: 1, youthAcademy: 1, marketing: 1 },
    lines: null, bench: [], waiversUsed: 0,
    streak: { type: null, count: 0 },
    lastRehabRound: -10,
    scoutMission: null,
  };
  initAcademy(team);
  return team;
}

/* ============================================================
   ЗВЕНЬЯ / ХИМИЯ / СТИЛИ / РОЛИ
   ============================================================ */
const LINE_STYLES = {
  balanced:   { label: 'Сбалансированное', atk: 0, def: 0 },
  aggressive: { label: 'Атакующее', atk: 0.08, def: -0.05 },
  defensive:  { label: 'Оборонительное', atk: -0.05, def: 0.08 },
};
const LINE_ROLES = {
  top6:     { label: 'Топ-6',       atk: 0.10, def: -0.05, fatigue: 1.3, develop: 0 },
  checking: { label: 'Чек-лайн',     atk: -0.05, def: 0.15, fatigue: 1.0, develop: 0 },
  energy:   { label: 'Энерджайзер',  atk: 0.00, def: 0.00, fatigue: 0.8, develop: 0 },
  youth:    { label: 'Молодёжное',   atk: -0.10, def: -0.05, fatigue: 0.6, develop: 0.3 },
};
function initLines(team) {
  const benchSet = new Set(team.bench || []);
  const fwd = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const def = team.roster.filter(p => p.position === 'D' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const gk = team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  team.lines = {
    f1: { players: fwd.slice(0,3).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    f2: { players: fwd.slice(3,6).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    f3: { players: fwd.slice(6,9).map(p => p.id), chemistry: 50, style: 'balanced', role: 'checking' },
    f4: { players: fwd.slice(9,12).map(p => p.id), chemistry: 50, style: 'balanced', role: 'youth' },
    d1: { players: def.slice(0,2).map(p => p.id), chemistry: 50, style: 'balanced', role: 'top6' },
    d2: { players: def.slice(2,4).map(p => p.id), chemistry: 50, style: 'balanced', role: 'checking' },
    d3: { players: def.slice(4,6).map(p => p.id), chemistry: 50, style: 'balanced', role: 'energy' },
    g1: gk[0]?.id || null, g2: gk[1]?.id || null,
  };
}
function syncLines(team) {
  if (!team.lines) { initLines(team); return; }
  const benchSet = new Set(team.bench || []);
  const ids = new Set(team.roster.map(p => p.id));
  const assigned = new Set();
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    team.lines[key].players = team.lines[key].players.filter(id => {
      if (!ids.has(id) || assigned.has(id) || benchSet.has(id)) return false;
      assigned.add(id); return true;
    });
    if (!team.lines[key].role) team.lines[key].role = 'energy';
    if (!team.lines[key].style) team.lines[key].style = 'balanced';
  }
  if (team.lines.g1 && (!ids.has(team.lines.g1) || assigned.has(team.lines.g1) || benchSet.has(team.lines.g1))) team.lines.g1 = null; else if (team.lines.g1) assigned.add(team.lines.g1);
  if (team.lines.g2 && (!ids.has(team.lines.g2) || assigned.has(team.lines.g2) || benchSet.has(team.lines.g2))) team.lines.g2 = null; else if (team.lines.g2) assigned.add(team.lines.g2);
  const freeFwd = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const freeDef = team.roster.filter(p => p.position === 'D' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  const freeGk = team.roster.filter(p => p.position === 'G' && !assigned.has(p.id) && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr);
  for (const key of ['f1','f2','f3','f4']) while (team.lines[key].players.length < 3 && freeFwd.length) { const p = freeFwd.shift(); team.lines[key].players.push(p.id); assigned.add(p.id); }
  for (const key of ['d1','d2','d3']) while (team.lines[key].players.length < 2 && freeDef.length) { const p = freeDef.shift(); team.lines[key].players.push(p.id); assigned.add(p.id); }
  if (!team.lines.g1 && freeGk.length) team.lines.g1 = freeGk.shift().id;
  if (!team.lines.g2 && freeGk.length) team.lines.g2 = freeGk.shift().id;
}
function lineMods(line) {
  const chemBonus = (line.chemistry - 50) / 500;
  const style = LINE_STYLES[line.style] || LINE_STYLES.balanced;
  const role = LINE_ROLES[line.role] || LINE_ROLES.energy;
  return { atk: chemBonus + style.atk + role.atk, def: chemBonus + style.def + role.def };
}
function teamLineMods(team) {
  if (!team.lines) initLines(team);
  const f1 = lineMods(team.lines.f1), f2 = lineMods(team.lines.f2), f3 = lineMods(team.lines.f3), f4 = lineMods(team.lines.f4);
  const fAtk = f1.atk * 0.3 + f2.atk * 0.3 + f3.atk * 0.22 + f4.atk * 0.18;
  const fDef = f1.def * 0.3 + f2.def * 0.3 + f3.def * 0.22 + f4.def * 0.18;
  const d1 = lineMods(team.lines.d1), d2 = lineMods(team.lines.d2), d3 = lineMods(team.lines.d3);
  const dAtk = d1.atk * 0.4 + d2.atk * 0.4 + d3.atk * 0.2;
  const dDef = d1.def * 0.4 + d2.def * 0.4 + d3.def * 0.2;
  return { atk: fAtk * 0.6 + dAtk * 0.4, def: fDef * 0.5 + dDef * 0.5 };
}
function updateLineChemistry(team, won, playedLineup) {
  if (!team.lines) return;
  const playedIds = new Set(playedLineup.skaters.map(p => p.id));
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const line = team.lines[key];
    if (line.players.length === 0 || !line.players.every(id => playedIds.has(id))) continue;
    line.chemistry = clamp(line.chemistry + (won ? 1.2 : -0.6), 0, 100);
  }
}
function getYouthLineBonus(team, playerId) {
  if (!team.lines) return 0;
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const line = team.lines[key];
    if (line.role === 'youth' && line.players.includes(playerId)) return LINE_ROLES.youth.develop;
  }
  return 0;
}
function getMentor(team, youngId) {
  const young = team.roster.find(p => p.id === youngId);
  if (!young || young.age > 23 || !team.lines) return null;
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    if (team.lines[key].players.includes(youngId)) {
      for (const otherId of team.lines[key].players) {
        if (otherId === youngId) continue;
        const other = team.roster.find(p => p.id === otherId);
        if (other && other.age >= 30 && other.ovr >= 78) return other;
      }
    }
  }
  return null;
}
function findPlayerLine(team, id) {
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    const idx = team.lines[key].players.indexOf(id);
    if (idx !== -1) return { lineKey: key, slotIdx: idx };
  }
  if (id === team.lines.g1) return { lineKey: 'g', slotIdx: 0 };
  if (id === team.lines.g2) return { lineKey: 'g', slotIdx: 1 };
  return null;
}
function setLineSlot(lineKey, slotIdx, playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.lines) return;
  if (lineKey === 'g') {
    const oldId = slotIdx === 0 ? team.lines.g1 : team.lines.g2;
    if (oldId === playerId) { render(); return; }
    const other = findPlayerLine(team, playerId);
    if (other && other.lineKey === 'g') {
      if (slotIdx === 0) { team.lines.g1 = playerId; team.lines.g2 = oldId; }
      else { team.lines.g2 = playerId; team.lines.g1 = oldId; }
    } else if (other) { render(); return; }
    else { if (slotIdx === 0) team.lines.g1 = playerId; else team.lines.g2 = playerId; }
    render(); return;
  }
  const line = team.lines[lineKey];
  const oldId = line.players[slotIdx];
  if (oldId === playerId) { render(); return; }
  const other = findPlayerLine(team, playerId);
  if (other && other.lineKey !== 'g') team.lines[other.lineKey].players[other.slotIdx] = oldId;
  line.players[slotIdx] = playerId; render();
}
function setLineStyle(lineKey, style) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (team && team.lines && team.lines[lineKey]) { team.lines[lineKey].style = style; render(); } }
function setLineRole(lineKey, role) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (team && team.lines && team.lines[lineKey]) { team.lines[lineKey].role = role; render(); } }
function resetLinesToOvr() { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return; team.lines = null; initLines(team); render(); }
function ensureAllLines() { if (!G.league) return; for (const t of G.league.teams) { if (!t.lines) initLines(t); else syncLines(t); if (!t.bench) t.bench = []; if (!t.streak) t.streak = { type: null, count: 0 }; } }
function sendToBench(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return;
  if (!team.bench) team.bench = [];
  if (team.bench.includes(playerId)) return;
  team.bench.push(playerId);
  team.lines = null; initLines(team); render();
}
function removeFromBench(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.bench) return;
  team.bench = team.bench.filter(id => id !== playerId);
  team.lines = null; initLines(team); render();
}

/* ============================================================
   РАСПИСАНИЕ / ЛИГА
   ============================================================ */
function makeSchedule(teams) {
  const arr = teams.slice(); const n = arr.length; const singleRounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; round.push(r % 2 === 0 ? [a.id, b.id] : [b.id, a.id]); }
    singleRounds.push(round); arr.splice(1, 0, arr.pop());
  }
  const doubleRounds = singleRounds.map(r => r.map(g => [g[1], g[0]]));
  return [...singleRounds, ...doubleRounds];
}
function genLeague() {
  const teams = VHL_TEAMS.map(meta => genTeam(meta));
  const league = {
    season: 1, teams, schedule: makeSchedule(teams), currentRound: 0, results: [],
    playoffs: null, history: [], transferLog: [], freeAgents: [], staffPool: [], waivers: [],
    aiTradeOffers: [], allTimeLeaders: { skaters: {} }, inbox: [], news: [],
    retiredPlayers: [], openingCup: null, retroMatch: null,
    tradeDeadlineNotified: false,
  };
  teams.forEach(t => { t.staff.headCoach = { id: nextId(), role: 'headCoach', name: pick(FIRST) + ' ' + pick(LAST), level: 2, xp: 0, salary: 2.4, age: randInt(38, 58) }; });
  teams.forEach(t => { const cands = t.roster.filter(p => p.ovr >= 65 && p.age >= 22 && p.age <= 32); if (cands.length) pick(cands).onTradeBlock = true; });
  teams.forEach(t => assignSeasonGoals(t));
  return league;
}

/* ============================================================
   РЕЙТИНГИ / СОСТАВ / ТАКТИКА
   ============================================================ */
function teamAttackRating(t) {
  const fs = t.roster.filter(p => p.position !== 'D' && p.position !== 'G' && getEffectiveOvr(p) > 0).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)).slice(0, 9);
  if (!fs.length) return 50;
  return fs.reduce((s, p) => s + getEffectiveOvr(p), 0) / fs.length;
}
function teamDefenseRating(t) {
  const ds = t.roster.filter(p => p.position === 'D' && getEffectiveOvr(p) > 0).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)).slice(0, 6);
  const g = t.roster.filter(p => p.position === 'G' && getEffectiveOvr(p) > 0).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a))[0];
  const dAvg = ds.length ? ds.reduce((s, p) => s + getEffectiveOvr(p), 0) / ds.length : 50;
  const gVal = g ? getEffectiveOvr(g) * 0.7 + g.form * 0.3 : 60;
  return dAvg * 0.7 + gVal * 0.3;
}
function shouldRestGoalie(starter, backup) {
  if (!backup) return false;
  if (starter.lastGameBad) return true;
  if ((starter.goalieStreak || 0) >= 5) return true;
  if ((backup.goalieStreak || 0) >= 1 && !backup.lastGameBad) return true;
  return false;
}
function getLineup(team) {
  syncLines(team);
  const benchSet = new Set(team.bench || []);
  const healthy = (p) => p && ((!p.injury || p.injury.gamesLeft <= 0) || p.playingThroughPain) && !benchSet.has(p.id);
  const forwards = [], defense = [];
  for (const key of ['f1','f2','f3','f4']) for (const id of team.lines[key].players) {
    const p = team.roster.find(x => x.id === id);
    if (p && p.position !== 'D' && p.position !== 'G' && healthy(p) && !forwards.includes(p)) forwards.push(p);
  }
  for (const key of ['d1','d2','d3']) for (const id of team.lines[key].players) {
    const p = team.roster.find(x => x.id === id);
    if (p && p.position === 'D' && healthy(p) && !defense.includes(p)) defense.push(p);
  }
  const g1 = team.roster.find(x => x.id === team.lines.g1);
  const g2 = team.roster.find(x => x.id === team.lines.g2);
  let goalie = null;
  if (healthy(g1) && !shouldRestGoalie(g1, g2)) goalie = g1;
  else if (healthy(g2)) goalie = g2;
  else if (healthy(g1)) goalie = g1;
  else goalie = team.roster.filter(x => x.position === 'G' && healthy(x)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a))[0];
  if (forwards.length < 12) { const extras = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && healthy(p) && !forwards.includes(p)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)); forwards.push(...extras.slice(0, 12 - forwards.length)); }
  if (defense.length < 6) { const extras = team.roster.filter(p => p.position === 'D' && healthy(p) && !defense.includes(p)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)); defense.push(...extras.slice(0, 6 - defense.length)); }
  return { forwards, defense, goalie, skaters: [...forwards, ...defense] };
}
function tacticMods(t, team) {
  const f = (t.forecheck - 50) / 50, p = (t.pressure - 50) / 50, s = (t.style - 50) / 50, ph = (t.physical - 50) / 50;
  const coachBonus = (team?.staff?.headCoach?.level || 0) * 0.01;
  return { atkMod: f * 0.12 + s * 0.08 + coachBonus, defMod: p * 0.10 - f * 0.06 + coachBonus, penRisk: Math.max(0, f * 0.5 + ph * 0.6) };
}

/* ============================================================
   ПРОГНОЗ БОЛЕЛЬЩИКОВ
   ============================================================ */
function fanExpectation(team, opponent, isHome) {
  const myT = team.talent || 70;
  const oppT = opponent.talent || 70;
  const diff = myT - oppT + (isHome ? 2 : -2);
  if (diff > 5) return { key: 'win', label: 'победу', moraleWin: 1, moraleLose: -2 };
  if (diff > 1) return { key: 'win-tight', label: 'победу', moraleWin: 1, moraleLose: -1 };
  if (diff < -5) return { key: 'lose', label: 'поражение', moraleWin: 2, moraleLose: -1 };
  if (diff < -1) return { key: 'lose-tight', label: 'поражение', moraleWin: 1, moraleLose: -1 };
  return { key: 'draw', label: 'равную игру', moraleWin: 1, moraleLose: -1 };
}
function applyFanExpectation(team, expected, won, isHome) {
  const f = team.finance;
  let fb = 0, moraleDelta = 0;
  const expectedWin = expected.key === 'win' || expected.key === 'win-tight';
  const expectedLose = expected.key === 'lose' || expected.key === 'lose-tight';
  if (won) {
    if (expectedWin) { fb = 0.5; moraleDelta = expected.moraleWin; }
    else if (expectedLose) { fb = 1.5; moraleDelta = expected.moraleWin; addNews('upset', `${team.name} преподнёс сенсацию, обыграв фаворита`, 2); }
    else { fb = 1; moraleDelta = 1; }
  } else {
    if (expectedWin) { fb = -1.5; moraleDelta = expected.moraleLose; addNews('disappointment', `${team.name} не оправдал ожиданий болельщиков`, 2); }
    else if (expectedLose) { fb = -0.3; moraleDelta = expected.moraleLose; }
    else { fb = -0.5; moraleDelta = -1; }
  }
  f.fanBase = clamp(f.fanBase + fb * 0.01, 0.15, 1.0);
  for (const p of team.roster) p.morale = clamp(p.morale + moraleDelta, 20, 100);
}

/* ============================================================
   ЦЕЛИ ИГРОКОВ
   ============================================================ */
function assignSeasonGoals(team) {
  for (const p of team.roster) {
    if (p.age > 34 || p.ovr < 65) { p.seasonGoal = null; continue; }
    const options = [];
    if (p.position !== 'G') {
      if (p.ovr >= 78) options.push({ type: 'top6', description: 'Играть в топ-6' });
      if (p.ovr >= 72) options.push({ type: 'points', value: Math.round(p.ovr * 0.55), description: `Набрать ${Math.round(p.ovr * 0.55)} очков` });
      options.push({ type: 'playoff', description: 'Выйти в плей-офф' });
      if (p.age <= 24 && p.ovr < 78) options.push({ type: 'notBottom6', description: 'Закрепиться выше 4-го звена' });
    } else {
      options.push({ type: 'playoff', description: 'Выйти в плей-офф' });
      if (p.ovr >= 75) options.push({ type: 'wins', value: Math.round(p.ovr * 0.4), description: `Одержать ${Math.round(p.ovr * 0.4)} побед` });
    }
    if (!options.length) { p.seasonGoal = null; continue; }
    p.seasonGoal = { ...pick(options), achieved: null };
  }
}
function checkSeasonGoals(team, playoffReached) {
  for (const p of team.roster) {
    if (!p.seasonGoal) continue;
    const g = p.seasonGoal; const s = ensureStats(p);
    let achieved = false;
    if (g.type === 'points') achieved = (s.points || 0) >= g.value;
    else if (g.type === 'wins') achieved = (s.wins || 0) >= g.value;
    else if (g.type === 'playoff') achieved = playoffReached;
    else if (g.type === 'top6') { if (team.lines) { const line = findPlayerLine(team, p.id); achieved = line && (line.lineKey === 'f1' || line.lineKey === 'f2'); } }
    else if (g.type === 'notBottom6') { if (team.lines) { const line = findPlayerLine(team, p.id); achieved = line && line.lineKey !== 'f4'; } }
    p.seasonGoal.achieved = achieved;
    if (achieved) p.morale = Math.min(100, p.morale + 3);
    else { p.morale = Math.max(20, p.morale - 5); if (team.id === G.playerTeamId) addInboxMessage('player', p.name, `Цель сезона не выполнена`, `«${g.description}» — не удалось. Мораль снижена.`, []); }
  }
}

/* ============================================================
   РЕАБИЛИТАЦИЯ / ИНДИВИДУАЛЬНЫЕ ТРЕНИРОВКИ
   ============================================================ */
function rehabPlayer(playerId, gamesToSkip) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  if (!p.injury || p.injury.gamesLeft <= 0) return { success: false, error: 'Игрок здоров' };
  const lastRound = team.lastRehabRound || -10;
  if (G.league.currentRound - lastRound < 5) return { success: false, error: 'Раз в 5 туров' };
  const maxSkip = Math.min(gamesToSkip, 5, p.injury.gamesLeft);
  if (maxSkip <= 0) return { success: false, error: 'Нечего ускорять' };
  const cost = maxSkip * 1;
  if (team.finance.balance < cost) return { success: false, error: 'Мало денег' };
  team.finance.balance -= cost; team.finance.expenses.bonuses += cost;
  p.injury.gamesLeft -= maxSkip;
  if (p.injury.gamesLeft <= 0) { p.injury = null; p.playingThroughPain = false; }
  team.lastRehabRound = G.league.currentRound;
  return { success: true, cost, gamesSkipped: maxSkip };
}
function individualTraining(playerId, attr) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  const lastRound = p.lastIndTraining || -10;
  if (G.league.currentRound - lastRound < 5) return { success: false, error: 'Раз в 5 туров' };
  if (team.finance.balance < 0.5) return { success: false, error: 'Нужно 0.5 млн ₽' };
  const attrs = p.position === 'G' ? GOALIE_ATTRS : SKATER_ATTRS;
  if (!attrs.includes(attr)) return { success: false, error: 'Неверный атрибут' };
  if (p.attrs[attr] >= p.attrPot[attr]) return { success: false, error: 'Атрибут уже на потенциале' };
  team.finance.balance -= 0.5; team.finance.expenses.operations += 0.5;
  p.attrs[attr]++;
  p.ovr = overallFromAttrs(p.attrs, p.position === 'G');
  p.lastIndTraining = G.league.currentRound;
  return { success: true, attr };
}

/* ============================================================
   РАЗРЫВ КОНТРАКТА
   ============================================================ */
function releasePlayer(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  if (p.status === 'tryout') return { success: false, error: 'Просмотровый контракт нельзя разорвать' };
  const remainingSalary = p.contract.salary * Math.max(0, p.contract.years);
  const cost = Math.round(remainingSalary * 0.5 * 10) / 10;
  if (team.finance.balance < cost) return { success: false, error: `Нужно ${cost} млн ₽` };
  team.finance.balance -= cost;
  team.finance.expenses.bonuses += cost;
  p.status = 'ufa';
  p.contract = contractFor(p.ovr, p.age);
  team.roster = team.roster.filter(x => x.id !== p.id);
  G.league.freeAgents.push(p);
  addNews('release', `${team.name} разорвал контракт с ${p.name} (${p.ovr} OVR). Компенсация: ${cost} млн ₽`, p.ovr >= 78 ? 2 : 1);
  team.lines = null; initLines(team);
  return { success: true, cost, player: p };
}

/* ============================================================
   ТРЕНИРОВКИ / РАЗВИТИЕ / КАРЬЕРА
   ============================================================ */
const DEV_FOCUSES = {
  attack:      { label: 'Атака', attrs: ['shooting', 'passing'] },
  defense:     { label: 'Защита', attrs: ['defense', 'iq'] },
  physical:    { label: 'Физика', attrs: ['physical', 'skating'] },
  reflexes:    { label: 'Реакция', attrs: ['reflexes'], goalie: true },
  positioning: { label: 'Позиция', attrs: ['positioning', 'stick'], goalie: true },
};
function setDevelopmentFocus(player, key) { player.developmentFocus = key; }
function developPlayer(p, team) {
  const isG = p.position === 'G'; p.fatigue = 0; p.injury = null; p.playingThroughPain = false;
  if (p.age <= 27) {
    const growth = p.age <= 21 ? 3 : p.age <= 24 ? 2 : 1;
    const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
    const focus = p.developmentFocus ? DEV_FOCUSES[p.developmentFocus] : null;
    for (let i = 0; i < growth; i++) {
      const cands = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (!cands.length) break;
      let pool = cands;
      if (focus) { const fc = cands.filter(a => focus.attrs.includes(a)); if (fc.length && rng() < 0.7) pool = fc; }
      p.attrs[pick(pool)]++;
    }
    const mentor = getMentor(team, p.id);
    const mentorBonus = mentor ? 0.30 : 0;
    if (mentor) p.mentorName = mentor.name; else p.mentorName = null;
    const youthBonus = getYouthLineBonus(team, p.id);
    const extraChance = ((team?.infrastructure?.youthAcademy || 0) * 0.08) + ((team?.staff?.youthCoach?.level || 0) * 0.05) + ((team?.infrastructure?.training || 0) * 0.03) + youthBonus + mentorBonus;
    if (rng() < extraChance) { const elig = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (elig.length) p.attrs[pick(elig)]++; }
  } else if (p.age >= 32) {
    const decline = isG ? ['reflexes', 'stick'] : ['skating', 'physical']; const a = pick(decline);
    p.attrs[a] = Math.max(40, p.attrs[a] - 1);
  }
  p.ovr = overallFromAttrs(p.attrs, isG); p.pot = overallFromAttrs(p.attrPot, isG);
  p.age++; p.contract.years--;
  if (p.contract.years <= 0) p.status = p.age < 28 ? 'rfa' : 'ufa';
}
function developPlayers(teams) { teams.forEach(t => t.roster.forEach(p => developPlayer(p, t))); }


/* ============================================================
   ЛИДЕРЫ / ТАБЛИЦА / СИМ
   ============================================================ */
function leagueLeaders(league, mode = 'regular') {
  const skaters = [], goalies = [];
  for (const t of league.teams) for (const p of t.roster) {
    const s = mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
    if (mode === 'playoff' && s.gp === 0) continue;
    if (p.position === 'G') goalies.push(p); else skaters.push(p);
  }
  const getStat = (p) => mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
  return {
    byGoals: skaters.slice().sort((a, b) => getStat(b).goals - getStat(a).goals).slice(0, 10),
    byAssists: skaters.slice().sort((a, b) => getStat(b).assists - getStat(a).assists).slice(0, 10),
    byPoints: skaters.slice().sort((a, b) => getStat(b).points - getStat(a).points).slice(0, 10),
    bySvPct: goalies.filter(p => getStat(p).gp >= (mode === 'playoff' ? 3 : 10) && getStat(p).shotsAgainst > 0)
      .sort((a, b) => (getStat(b).saves / getStat(b).shotsAgainst) - (getStat(a).saves / getStat(a).shotsAgainst)).slice(0, 10),
  };
}
function applyResult(res) {
  const h = G.league.teams.find(t => t.id === res.homeId), a = G.league.teams.find(t => t.id === res.awayId);
  h.record.gf += res.hg; h.record.ga += res.ag; a.record.gf += res.ag; a.record.ga += res.hg;
  if (res.hg > res.ag) { h.record.w++; if (res.ot) a.record.otl++; else a.record.l++; }
  else { a.record.w++; if (res.ot) h.record.otl++; else h.record.l++; }
  h.record.pts = h.record.w * 2 + h.record.otl; a.record.pts = a.record.w * 2 + a.record.otl;
  processMatchdayRevenue(h, true, a.strength); processOperations(h); processOperations(a);
  processGovSupport(h); processGovSupport(a);
  if (G.playerTeamId === h.id) updateReputation(h, res.hg > res.ag);
  if (G.playerTeamId === a.id) updateReputation(a, res.ag > res.hg);
}
function standingsSorted() {
  return G.league.teams.slice().sort((a, b) => {
    if (b.record.pts !== a.record.pts) return b.record.pts - a.record.pts;
    if (b.record.w !== a.record.w) return b.record.w - a.record.w;
    const dA = a.record.gf - a.record.ga, dB = b.record.gf - b.record.ga;
    if (dB !== dA) return dB - dA;
    return b.record.gf - a.record.gf;
  });
}
function standingsSortedByUI() {
  const { key, dir } = G.standingsSort; const mult = dir === 'asc' ? 1 : -1;
  const getVal = (t) => {
    const gp = t.record.w + t.record.l + t.record.otl;
    if (key === 'pts') return t.record.pts; if (key === 'gp') return gp;
    if (key === 'w') return t.record.w; if (key === 'l') return t.record.l;
    if (key === 'otl') return t.record.otl; if (key === 'gf') return t.record.gf;
    if (key === 'ga') return t.record.ga; if (key === 'diff') return t.record.gf - t.record.ga;
    return t.record.pts;
  };
  return G.league.teams.slice().sort((a, b) => {
    const diff = (getVal(a) - getVal(b)) * mult;
    if (diff !== 0) return diff;
    if (b.record.pts !== a.record.pts) return b.record.pts - a.record.pts;
    return (b.record.gf - b.record.ga) - (a.record.gf - a.record.ga);
  });
}
function checkInjuredStarters() {
  if (!G.playerTeamId) return [];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.lines) return [];
  const injured = [];
  const seen = new Set();
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    for (const id of team.lines[key].players) {
      if (seen.has(id)) continue;
      const p = team.roster.find(x => x.id === id);
      if (p && p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) { injured.push(p); seen.add(id); }
    }
  }
  for (const key of ['g1','g2']) {
    const id = team.lines[key];
    if (!id || seen.has(id)) continue;
    const p = team.roster.find(x => x.id === id);
    if (p && p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) { injured.push(p); seen.add(id); }
  }
  return injured;
}
function setInjuryPolicy(playerId, policy) {
  if (!G.injuryPrompt) return;
  if (!G.injuryPrompt.choices) G.injuryPrompt.choices = {};
  G.injuryPrompt.choices[playerId] = policy;
  render();
}
function applyInjuryPolicies() {
  if (!G.injuryPrompt) { simRound(true); return; }
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.injuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  const choices = G.injuryPrompt.choices || {};
  const onceIds = [];
  for (const p of injured) {
    const policy = choices[p.id] || 'period';
    p.injuryPolicy = policy;
    if (policy === 'pain') p.playingThroughPain = true;
    if (policy === 'once') onceIds.push(p.id);
  }
  G.injuryPrompt = null;
  simRound(true);
  // ⚙️ ФИКС #5: политика 'once' — на один матч, сбрасываем после симуляции
  for (const id of onceIds) {
    const p = team.roster.find(x => x.id === id);
    if (p) p.injuryPolicy = null;
  }
}

/* ============================================================
   RETRO MATCH
   ============================================================ */
function triggerRetroMatch() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return;
  team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0);
  const bonus = 2 + Math.round(team.finance.fanBase * 3);
  team.finance.balance += bonus; team.finance.income.matchdayExtras += bonus;
  G.league.retroMatch = { season: G.league.season };
  addNews('event', `${team.name} провёл ретро-матч в форме 1990-х! +${bonus} млн ₽, фанбаза +1%`, 2);
  addInboxMessage('marketing', 'Маркетолог', `Ретро-матч — успех!`, `Матч в форме 1990-х вызвал ажиотаж. +${bonus} млн ₽, фанбаза +1%.`, []);
}

/* ============================================================
   МАТЧ ОТКРЫТИЯ
   ============================================================ */
function setupOpeningCup() {
  const sorted = standingsSorted();
  const regularChampionId = G.lastRegularChampionId;
  const cupHolderId = G.lastCupHolderId;
  let aId, bId;
  if (regularChampionId && cupHolderId && regularChampionId !== cupHolderId) { aId = regularChampionId; bId = cupHolderId; }
  else if (regularChampionId) { aId = regularChampionId; bId = (G.lastFinalistId && G.lastFinalistId !== regularChampionId) ? G.lastFinalistId : sorted[1].id; }
  else { aId = sorted[0].id; bId = sorted[1].id; }
  G.league.openingCup = { aId, bId, played: false, result: null, winnerId: null, season: G.league.season };
}
function autoPlayOpeningCup() {
  if (!G.league.openingCup || G.league.openingCup.played) return null;
  const oc = G.league.openingCup;
  const teamA = G.league.teams.find(t => t.id === oc.aId);
  const teamB = G.league.teams.find(t => t.id === oc.bId);
  if (!teamA || !teamB) { oc.played = true; return null; }
  const res = simGame(teamA.id, teamB.id, false);
  const winner = res.hg > res.ag ? teamA : teamB;
  const loser = res.hg > res.ag ? teamB : teamA;
  const hgA = res.hg, hgB = res.ag;
  oc.result = { hgA, hgB, ot: res.ot };
  oc.winnerId = winner.id;
  oc.played = true;
  winner.finance.balance += 5;
  winner.finance.income.prizes += 5;
  if (!winner.trophies) winner.trophies = { petrov: [], regular: [], opening: [] };
  if (!winner.trophies.opening) winner.trophies.opening = [];
  winner.trophies.opening.push(String(G.league.season));
  addNews('opening_cup', `${winner.name} выиграл Матч Открытия у ${loser.name} (${hgA}:${hgB}${res.ot ? ' ОТ' : ''})`, 3);
  const myTeamInvolved = (teamA.id === G.playerTeamId || teamB.id === G.playerTeamId);
  if (myTeamInvolved) {
    G.openingCupModal = { teamA: { name: teamA.name, id: teamA.id }, teamB: { name: teamB.name, id: teamB.id }, hgA, hgB, ot: res.ot, winner: { name: winner.name, id: winner.id }, isMyTeam: winner.id === G.playerTeamId };
    addInboxMessage('board', 'Совет директоров', winner.id === G.playerTeamId ? '🏆 Матч Открытия — победа!' : 'Матч Открытия — поражение', `${winner.name} победил ${loser.name} ${hgA}:${hgB}${res.ot ? ' ОТ' : ''}.`, []);
  }
  return { winner, loser, teamA, teamB, hgA, hgB, ot: res.ot };
}

/* ============================================================
   ТРАНСФЕРЫ / ИСТОРИЯ / END SEASON
   ============================================================ */
function movePlayerToTeam(player, fromTeam, toTeam) { const idx = fromTeam.roster.indexOf(player); if (idx === -1) return false; fromTeam.roster.splice(idx, 1); toTeam.roster.push(player); return true; }
function runVHLTransferWindow() {
  const teams = G.league.teams; const sorted = standingsSorted(); const transfers = [];
  for (const team of teams) for (const player of [...team.roster]) {
    if (player.ovr < 75 || player.age >= 29) continue; if (rng() > 0.12) continue;
    const myRank = sorted.findIndex(t => t.id === team.id); const candidates = sorted.slice(0, Math.max(myRank, 1)).filter(t => t.id !== team.id); if (!candidates.length) continue;
    const targetTeam = pick(candidates); const samePos = targetTeam.roster.filter(p => p.position === player.position); if (!samePos.length) continue;
    const avgOvr = samePos.reduce((s, p) => s + p.ovr, 0) / samePos.length;
    if (player.ovr > avgOvr + 3) { movePlayerToTeam(player, team, targetTeam); transfers.push({ player: player.name, pos: player.position, ovr: player.ovr, from: team.name, to: targetTeam.name }); }
  }
  G.league.transferLog.push({ season: G.league.season, transfers }); return transfers;
}
function snapshotSeason(awards, regularChampion) {
  const p = G.league.playoffs; const sorted = standingsSorted(); const leaders = leagueLeaders(G.league);
  const findTeamName = (player) => { const t = G.league.teams.find(x => x.roster.includes(player)); return t ? t.name : '—'; };
  const snapLeaders = (arr) => arr.map(pl => ({ name: pl.name, team: findTeamName(pl), gp: pl.stats.gp, goals: pl.stats.goals || 0, assists: pl.stats.assists || 0, points: pl.stats.points || 0, wins: pl.stats.wins || 0, saves: pl.stats.saves || 0, shotsAgainst: pl.stats.shotsAgainst || 0, goalsAgainst: pl.stats.goalsAgainst || 0, shutouts: pl.stats.shutouts || 0 }));
  G.league.history.push({
    season: G.league.season, championId: p ? p.championId : null,
    championName: p && p.championId ? G.league.teams.find(x => x.id === p.championId).name : '—',
    regularChampionId: regularChampion ? regularChampion.id : null,
    regularChampionName: regularChampion ? regularChampion.name : '—',
    openingCupWinnerId: G.league.openingCup?.winnerId || null,
    openingCupWinnerName: G.league.openingCup?.winnerId ? G.league.teams.find(x => x.id === G.league.openingCup.winnerId)?.name : null,
    standings: sorted.map(t => ({ name: t.name, w: t.record.w, l: t.record.l, otl: t.record.otl, pts: t.record.pts, gf: t.record.gf, ga: t.record.ga })),
    leaders: { goals: snapLeaders(leaders.byGoals), assists: snapLeaders(leaders.byAssists), points: snapLeaders(leaders.byPoints), svPct: snapLeaders(leaders.bySvPct) },
    playoffRounds: p ? p.rounds.map(r => ({ name: r.name, series: r.series.map(s => ({
      aName: s.aId ? G.league.teams.find(t => t.id === s.aId)?.name || null : null,
      bName: s.bId ? G.league.teams.find(t => t.id === s.bId)?.name || null : null,
      aWins: s.aWins, bWins: s.bWins,
      winnerName: s.winnerId ? G.league.teams.find(t => t.id === s.winnerId)?.name || null : null,
      games: s.games.map(g => { const aIsHome = g.homeId === s.aId; return { aG: aIsHome ? g.hg : g.ag, bG: aIsHome ? g.ag : g.hg, ot: g.ot }; }),
    })) })) : [],
    awards: awards || null,
  });
}
function allTimeTeamRecords(history) {
  const totals = {};
  for (const h of history) for (const t of h.standings) {
    if (!totals[t.name]) totals[t.name] = { seasons: 0, w: 0, l: 0, otl: 0, pts: 0, cups: 0, regular: 0 };
    const r = totals[t.name]; r.seasons++; r.w += t.w; r.l += t.l; r.otl += t.otl; r.pts += t.pts;
    if (t.name === h.championName) r.cups++;
    if (t.name === h.regularChampionName) r.regular++;
  }
  return Object.entries(totals).map(([name, r]) => ({ name, ...r })).sort((a, b) => b.pts - a.pts);
}
function getPlayoffResult(team, playoffs) {
  if (!playoffs) return null;
  if (playoffs.championId === team.id) return 'champion';
  for (let i = playoffs.rounds.length - 1; i >= 0; i--) for (const s of playoffs.rounds[i].series)
    if (s.aId === team.id || s.bId === team.id) return i === 3 ? 'finalist' : i === 2 ? 'semifinal' : i === 1 ? 'quarterfinal' : 'round16';
  return null;
}
function endSeason() {
  const sorted = standingsSorted(); const p = G.league.playoffs;
  const regularChampion = sorted[0];
  const awards = computeAwards();
  G.lastRegularChampionId = regularChampion.id;
  G.lastCupHolderId = p?.championId || null;
  if (p) { const finalSeries = p.rounds[3]?.series[0]; if (finalSeries) G.lastFinalistId = finalSeries.aId === p.championId ? finalSeries.bId : finalSeries.aId; }

  // ⚙️ ФИКС КАРЬЕРЫ: фиксируем данные игрока ДО обнуления record
  const myTeamForCareer = G.playerTeamId ? G.league.teams.find(t => t.id === G.playerTeamId) : null;
  const myRankFinal = myTeamForCareer ? sorted.findIndex(t => t.id === myTeamForCareer.id) + 1 : null;
  const myPtsFinal = myTeamForCareer ? myTeamForCareer.record.pts : null;
  const myPlayoffResult = myTeamForCareer ? getPlayoffResult(myTeamForCareer, p) : null;

  G.league.teams.forEach(t => {
    const rank = sorted.findIndex(x => x.id === t.id) + 1;
    const pResult = getPlayoffResult(t, p);
    processPrizes(t, rank, pResult);
    paySponsorEndBonuses(t, rank, pResult);
    payContractBonuses(t);
    payPlayerSeasonBonuses(t, awards, !!pResult);
    checkSeasonGoals(t, !!pResult);
    updateCareerStats(t);
    updateAllTimeLeaders(t);
    developStaff(t);
    if (t.finance.baseFanBase !== undefined) t.finance.fanBase = clamp(t.finance.baseFanBase + (t.finance.fanBase - t.finance.baseFanBase) * 0.3, 0.15, 1.0);
    t.streak = { type: null, count: 0 };
  });
  checkSeasonSurprises();
  snapshotSeason(awards, regularChampion);
  runVHLTransferWindow();
  for (const t of G.league.teams) {
    const retired = processRetirements(t);
    for (const rp of retired) {
      if (!G.league.retiredPlayers) G.league.retiredPlayers = [];
      G.league.retiredPlayers.push({ name: rp.name, position: rp.position, age: rp.age, ovr: rp.ovr, season: G.league.season, teamName: t.name });
    }
  }
  developPlayers(G.league.teams);
  G.league.teams.forEach(t => progressAcademy(t));
  G.league.teams.forEach(t => {
    t.roster = t.roster.filter(pl => {
      if (pl.contract.years <= 0) { if (rng() < 0.8) { pl.contract = contractFor(pl.ovr, pl.age); pl.status = 'contract'; return true; } G.league.freeAgents.push(pl); pl.status = 'ufa'; return false; }
      return true;
    });
    while (t.roster.length < 22) t.roster.push(genPlayer(pick(['C','LW','RW','D','G']), randInt(58, 74)));
    t.lines = null; t.bench = []; t.waiversUsed = 0; t.lastRehabRound = -10;
    t.roster.forEach(pl => { ensurePlayoffStats(pl); });
  });
  G.league.staffPool = generateStaffCandidates(12);
  G.league.waivers = []; G.league.aiTradeOffers = [];
  G.league.season++; G.league.currentRound = 0; G.league.results = []; G.league.playoffs = null;
  G.league.tradeDeadlineNotified = false;
  G.league.teams.forEach(t => {
    t.record = { w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 }; t.sponsors = [];
    t.finance.income = { tickets: 0, matchdayExtras: 0, sponsors: 0, sponsorBonuses: 0, tv: 0, prizes: 0, transfers: 0, merch: 0, gov: 0 };
    t.finance.expenses = { salaries: 0, staffSalaries: 0, operations: 0, transfers: 0, bonuses: 0 };
    t.finance.lastSponsorWins = 0; t.finance.sponsorOffers = null;
    t.scoutMission = null;
  });
  resetAllStats(G.league); G.league.schedule = makeSchedule(G.league.teams);
  ensureAllLines();
  G.league.teams.forEach(t => assignSeasonGoals(t));
  initAISponsors();
  while (G.league.freeAgents.length < 25) G.league.freeAgents.push(genPlayer(pick(['C','LW','RW','D','G']), randInt(60, 80), { status: 'ufa' }));
  setupOpeningCup();
  autoPlayOpeningCup();
  generateCareerOffers(myRankFinal, myPtsFinal, myPlayoffResult);
  G.activeTab = 'career'; render();
}

/* ============================================================
   СМЕНА КОМАНДЫ (CAREER OFFERS)
   ============================================================ */
function generateCareerOffers(finalRank, finalPts, playoffResult) {
  if (!G.playerTeamId) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const sorted = standingsSorted();
  const rep = G.career?.reputation || 50;
  const offers = [];
  offers.push({ teamId: myTeam.id, type: 'stay', label: `Остаться в ${myTeam.name}`, salaryCap: myTeam.finance.salaryCap });
  if (rep >= 55) {
    const stronger = sorted.filter(t => t.strength > myTeam.strength && t.id !== myTeam.id).slice(0, 3);
    for (const t of stronger) if (rng() < 0.5) offers.push({ teamId: t.id, type: 'move', label: `${t.name} (${t.strength.toFixed(2)})`, salaryCap: t.finance.salaryCap });
  }
  if (finalRank > 12) {
    const weaker = sorted.filter(t => t.strength < myTeam.strength && t.id !== myTeam.id).slice(0, 2);
    for (const t of weaker) if (rng() < 0.4) offers.push({ teamId: t.id, type: 'move', label: `${t.name} (${t.strength.toFixed(2)})`, salaryCap: t.finance.salaryCap });
  }
  G.careerOffers = offers;
  if (!G.career) G.career = { reputation: 50, history: [], noFireMode: false };
  if (!G.career.history) G.career.history = [];
  G.career.history.push({
    season: G.league.season - 1,
    teamName: myTeam.name,
    rank: finalRank,
    pts: finalPts,
    playoffResult: playoffResult || null,
  });
}
function acceptCareerOffer(teamId) {
  const newTeam = G.league.teams.find(t => t.id === teamId);
  if (!newTeam) return;
  const oldTeamId = G.playerTeamId;
  G.playerTeamId = teamId;
  G.careerOffers = null;
  if (oldTeamId !== teamId) {
    G.career.lastTeamName = G.league.teams.find(t => t.id === oldTeamId)?.name;
    addNews('career', `Новый главный тренер ${newTeam.name}`, 3);
  }
  newTeam.lines = null; initLines(newTeam);
  G.activeTab = 'standings';
  render();
}
function stayAtCurrentTeam() { G.careerOffers = null; G.activeTab = 'standings'; render(); }

/* ============================================================
   ПЕРЕХОД В СВОБОДНЫЕ АГЕНТЫ
   ============================================================ */
function becomeFreeAgent() {
  if (G.playerTeamId) {
    const t = G.league.teams.find(t => t.id === G.playerTeamId);
    if (t) G.career.lastTeamName = t.name;
  }
  G.playerTeamId = null; G.career.freeAgent = true; G.freeAgentOffers = null; G.activeTab = 'career'; render();
}
function generateFreeAgentOffers() {
  const sorted = standingsSorted();
  const bottom = sorted.slice(12, 30).filter(t => t.id !== G.playerTeamId);
  const shuffled = bottom.slice().sort(() => rng() - 0.5).slice(0, 4);
  const offers = shuffled.map(t => ({ teamId: t.id, teamName: t.name, strength: t.strength }));
  offers.push({ teamId: null, type: 'stay_free', label: 'Остаться свободным агентом ещё на сезон' });
  G.freeAgentOffers = offers;
}
function simRoundFreeAgent() {
  if (G.league.currentRound >= G.league.schedule.length) { render(); return; }
  const round = G.league.schedule[G.league.currentRound];
  round.forEach(([h, a]) => { const res = simGame(h, a, false); res.round = G.league.currentRound; applyResult(res); G.league.results.push(res); });
  G.league.currentRound++;
  G.league.teams.forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); });
  if (G.league.currentRound % 10 === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
  if (G.league.currentRound % 3 === 0) processWaivers();
  if (G.league.currentRound % 4 === 0) runAIActions();
  if (G.league.currentRound % 8 === 0) updateStaffPool();
  if (G.league.currentRound % 3 === 0 && rng() < 0.3) generateRandomEvent();
  G.league.teams.forEach(t => checkScoutMission(t));
  checkTradeDeadlineNews();
  if (G.league.currentRound === G.league.schedule.length) createPlayoffs();
  render();
}
function simSeasonFreeAgent() {
  while (G.league.currentRound < G.league.schedule.length) {
    const round = G.league.schedule[G.league.currentRound];
    round.forEach(([h, a]) => { const res = simGame(h, a, false); res.round = G.league.currentRound; applyResult(res); G.league.results.push(res); });
    G.league.currentRound++;
    G.league.teams.forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); });
    if (G.league.currentRound % 10 === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
    if (G.league.currentRound % 3 === 0) processWaivers();
    if (G.league.currentRound % 4 === 0) runAIActions();
    if (G.league.currentRound % 8 === 0) updateStaffPool();
    if (G.league.currentRound % 3 === 0 && rng() < 0.3) generateRandomEvent();
    G.league.teams.forEach(t => checkScoutMission(t));
    checkTradeDeadlineNews();
  }
  createPlayoffs();
  render();
}

/* ============================================================
   ТАКТИЧЕСКИЕ СЛАЙДЕРЫ (общее определение)
   ============================================================ */
const SLIDER_DEFS = [
  { key: 'forecheck', label: 'Форчек', left: 'Пассивный', right: 'Агрессивный' },
  { key: 'pressure', label: 'Давление', left: 'Ловушка', right: 'Прессинг' },
  { key: 'style', label: 'Стиль атаки', left: 'Позиционный', right: 'Вертикальный' },
  { key: 'physical', label: 'Жёсткость', left: 'Мягкая', right: 'Жёсткая' },
  { key: 'risk', label: 'Риск', left: 'Спокойно', right: 'Ва-банк' },
];

function liveChangeTactic(key, val) {
  if (!G.liveMatch) return;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  team.tactics[key] = Number(val);
  const inputs = document.querySelectorAll('.live-tactic-row input[type=range]');
  for (const input of inputs) {
    if (input.getAttribute('oninput')?.includes(`'${key}'`)) {
      const valEl = input.parentElement.querySelector('.lt-val');
      if (valEl) valEl.textContent = val;
      break;
    }
  }
}

function renderLiveMatchScreen() {
  const lm = G.liveMatch;
  if (!lm) return '';
  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);

  const speedBtns = [1, 2, 4].map(s => `<button class="btn small ${lm.speed === s ? 'active' : ''}" onclick="setLiveSpeed(${s})">${s}×</button>`).join('');
  const pauseBtn = lm.paused && !lm.isBreak && !lm.isFinished
    ? `<button class="btn small" onclick="toggleLivePause()">▶ Продолжить</button>`
    : (!lm.isFinished && !lm.isBreak) ? `<button class="btn small secondary" onclick="toggleLivePause()">⏸ Пауза</button>` : '';

  let controlBlock = '';
  if (lm.isFinished) {
    controlBlock = `<button class="btn" onclick="closeLiveMatchModal()">✅ Готово — к таблице</button>`;
  } else if (lm.isBreak) {
    controlBlock = `<button class="btn" onclick="liveResumeFromBreak()">▶ Продолжить период</button>`;
  } else {
    controlBlock = `
      ${pauseBtn}
      ${speedBtns}
      <button class="btn small secondary" onclick="exitLiveMatchEarly()">⏭ До конца матча</button>
    `;
  }

  const canEditTactics = myTeam && (lm.isBreak || lm.paused) && !lm.isFinished;
  const tacticSliders = canEditTactics ? `
    <div class="live-break-overlay">
      <div class="live-break-card">
        <h2>${lm.isBreak ? '⏸ Перерыв — корректировка тактики' : '⏸ Пауза — корректировка тактики'}</h2>
        <div class="subtitle">Изменения влияют на xG следующих периодов</div>
        <h3>Тактика</h3>
        ${SLIDER_DEFS.map(s => `
          <div class="live-tactic-row">
            <label>${s.label}</label>
            <input type="range" min="0" max="100" value="${myTeam.tactics[s.key]}" oninput="liveChangeTactic('${s.key}', this.value)">
            <span class="lt-val">${myTeam.tactics[s.key]}</span>
          </div>
        `).join('')}
        <div style="margin-top:16px;text-align:right">
          ${lm.isBreak
            ? `<button class="btn" onclick="liveResumeFromBreak()">▶ Продолжить период</button>`
            : `<button class="btn" onclick="toggleLivePause()">▶ Продолжить</button>`}
        </div>
      </div>
    </div>
  ` : '';

  const endedHint = lm.isFinished
    ? `<div class="regular-champion" style="margin-top:8px">Матч завершён: ${home.shortName || home.name} ${lm.hg} : ${lm.ag} ${away.shortName || away.name}${lm.ot ? ' (ОТ)' : ''}</div>`
    : '';

  const logoHome = home.logo ? `<img src="${home.logo}" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:6px">` : '';
  const logoAway = away.logo ? `<img src="${away.logo}" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:6px">` : '';

  return `<div class="live-screen">
    <div class="live-topbar">
      <button class="btn small secondary" onclick="if(confirm('Выйти из матча? Остаток будет досимитирован.')) exitLiveMatchEarly()">✕ Выйти</button>
      <div class="live-scoreboard">
        <div class="live-teams">
          <span class="home-name">${logoHome}${home.shortName || home.name}</span>
          <span class="live-score-box"><span id="live-score-home">${lm.hg}</span> : <span id="live-score-away">${lm.ag}</span></span>
          <span class="away-name">${logoAway}${away.shortName || away.name}</span>
        </div>
        <div class="live-period-info" id="live-period-info">${lm.period === 4 ? 'Овертайм' : 'Период ' + lm.period}</div>
        <div class="live-clock" id="live-clock">${liveFmtTime(Math.max(0, Math.ceil(lm.timeLeft)))}</div>
      </div>
      <div style="min-width:120px"></div>
    </div>

    <div id="live-pp-banner" class="live-pp-banner" style="display:none"></div>

    <div class="live-canvas-wrap">
      <canvas id="live-canvas" class="live-canvas"></canvas>
    </div>

    <div class="live-controls">
      ${controlBlock}
    </div>

    <h2>Ход матча</h2>
    <div class="live-feed" id="live-feed"></div>

    ${endedHint}
    ${tacticSliders}
  </div>`;
}

function setLiveSpeed(s) {
  if (!G.liveMatch) return;
  G.liveMatch.speed = s;
  render();
}
function toggleLivePause() {
  if (!G.liveMatch) return;
  G.liveMatch.paused = !G.liveMatch.paused;
  // ⚙️ ФИКС #14: если встали на паузу — гасим интервал, чтобы не жечь CPU
  if (G.liveMatch.paused && G.liveMatch.intervalId) {
    clearInterval(G.liveMatch.intervalId);
    G.liveMatch.intervalId = null;
  }
  // На возобновление — перезапускаем интервал, если матч не завершён и не перерыв
  if (!G.liveMatch.paused && !G.liveMatch.isFinished && !G.liveMatch.isBreak && !G.liveMatch.intervalId) {
    G.liveMatch.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  }
  render();
}

/* ============================================================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
   ============================================================ */
const G = {
  league: null, playerTeamId: null, activeTab: 'standings', screen: 'select',
  selectedGamePbp: null, marketFilter: 'all', rosterSort: 'ovr', marketSort: 'ovr',
  tradeTarget: null, popupPlayerId: null, viewTeamId: null, tradeTargetTeamId: null,
  standingsSort: { key: 'pts', dir: 'desc' },
  inboxFilter: 'all',
  pressConference: null,
  playoffInjuryPrompt: null,
  statsMode: 'regular',
  difficulty: null,
  selectedDifficulty: 'normal',
  noFireMode: false,
  career: null,
  careerOffers: null,
  freeAgentOffers: null,
  firedFromTeamId: null,
  injuryPrompt: null,
  skipInjuryPrompt: false,
  openingCupModal: null,
  liveMatch: null,
};

/* ============================================================
   ГЛАВНЫЙ RENDER
   ============================================================ */
function render() {
  const root = document.getElementById('app');
  if (!G.league) return;

  if (G.screen === 'select') {
    stopLiveAnimation();
    if (G.liveMatch && G.liveMatch.intervalId) { clearInterval(G.liveMatch.intervalId); G.liveMatch.intervalId = null; }
    G.liveMatch = null;
    root.innerHTML = renderTeamSelect();
    bindTeamSelect();
    saveGame();
    return;
  }

  if (G.liveMatch) {
    root.innerHTML = renderLiveMatchScreen();
    drawLiveCanvas();
    updateLiveClock();
    startLiveAnimation();
    return;
  }

  stopLiveAnimation();

  if (!G.playerTeamId) {
    root.innerHTML = renderFreeAgentScreen() + renderModal() + renderTeamModal() + renderInjuryPromptModal() + renderOpeningCupModal();
    return;
  }

  const content =
    G.activeTab === 'standings' ? renderStandings() :
    G.activeTab === 'games' ? renderGames() :
    G.activeTab === 'calendar' ? renderCalendar() :
    G.activeTab === 'roster' ? renderRoster() :
    G.activeTab === 'lines' ? renderLines() :
    G.activeTab === 'stats' ? renderStats() :
    G.activeTab === 'market' ? renderMarket() :
    G.activeTab === 'trades' ? renderTrades() :
    G.activeTab === 'waivers' ? renderWaivers() :
    G.activeTab === 'inbox' ? renderInbox() :
    G.activeTab === 'news' ? renderNews() :
    G.activeTab === 'tactics' ? renderTactics() :
    G.activeTab === 'training' ? renderTraining() :
    G.activeTab === 'staff' ? renderStaff() :
    G.activeTab === 'infrastructure' ? renderInfrastructure() :
    G.activeTab === 'academy' ? renderAcademy() :
    G.activeTab === 'finance' ? renderFinance() :
    G.activeTab === 'career' ? renderCareer() :
    G.activeTab === 'playoffs' ? renderPlayoffs() :
    G.activeTab === 'history' ? renderHistory() :
    renderRoster();

  root.innerHTML = renderHeader() + renderTabs() + content + renderModal() + renderTeamModal() + renderPressConferenceModal() + renderPlayoffInjuryModal() + renderInjuryPromptModal() + renderOpeningCupModal();
  document.querySelectorAll('.tab').forEach(el => { el.onclick = () => { G.activeTab = el.dataset.tab; render(); }; });
  saveGame();
}

/* ============================================================
   СОХРАНЕНИЕ (с seed — фикс #9)
   ============================================================ */
const SAVE_KEY = 'hockey_save_v2';

function saveGame() {
  if (!G.league) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      league: G.league, playerTeamId: G.playerTeamId, activeTab: G.activeTab, screen: G.screen,
      standingsSort: G.standingsSort, idCounter: _idCounter,
      selectedDifficulty: G.selectedDifficulty, noFireMode: G.noFireMode, career: G.career,
      careerOffers: G.careerOffers, freeAgentOffers: G.freeAgentOffers,
      lastRegularChampionId: G.lastRegularChampionId, lastCupHolderId: G.lastCupHolderId, lastFinalistId: G.lastFinalistId,
      seed: getSeed(),  // ⚙️ ФИКС #9
    }));
  } catch (e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
    const data = JSON.parse(raw); if (!data || !data.league) return false;
    G.league = data.league; G.playerTeamId = data.playerTeamId || null;
    G.activeTab = data.activeTab || 'standings'; G.screen = data.screen || 'select';
    G.standingsSort = data.standingsSort || { key: 'pts', dir: 'desc' };
    _idCounter = data.idCounter || 1;
    // ⚙️ ФИКС #9: восстанавливаем RNG seed
    setSeed(data.seed || 20241111);
    G.selectedDifficulty = data.selectedDifficulty || 'normal';
    G.noFireMode = data.noFireMode || false;
    G.career = data.career || { reputation: 50, history: [] };
    G.careerOffers = data.careerOffers || null;
    G.freeAgentOffers = data.freeAgentOffers || null;
    G.lastRegularChampionId = data.lastRegularChampionId;
    G.lastCupHolderId = data.lastCupHolderId;
    G.lastFinalistId = data.lastFinalistId;
    G.difficulty = DIFFICULTIES[G.selectedDifficulty] || DIFFICULTIES.normal;
    G.league.aiTradeOffers = G.league.aiTradeOffers || [];
    G.league.allTimeLeaders = G.league.allTimeLeaders || { skaters: {} };
    G.league.inbox = G.league.inbox || [];
    G.league.news = G.league.news || [];
    G.league.retiredPlayers = G.league.retiredPlayers || [];
    G.league.openingCup = G.league.openingCup || null;
    G.league.retroMatch = G.league.retroMatch || null;
    G.liveMatch = null;
    G.league.teams.forEach(t => {
      if (!t.ratings) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.ratings = meta ? { ...meta.ratings } : { att: 70, def: 70, gk: 70, st: 70 }; }
      if (t.talent === undefined) t.talent = 70;
      if (t.prestige === undefined) t.prestige = 50;
      if (!t.trend) t.trend = 'stable';
      if (!t.trophies) t.trophies = { petrov: [], regular: [], opening: [] };
      if (!t.history) t.history = [];
      if (!t.rivals) t.rivals = [];
      if (!t.logo) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.logo = meta ? meta.logo : ''; }
      if (t.sponsorFlow === undefined) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.sponsorFlow = meta ? meta.sponsorFlow : 3; }
      if (t.govSupport === undefined) { const meta = VHL_TEAMS.find(m => m.id === t.id); t.govSupport = meta ? meta.govSupport : 2; }
      t.waiversUsed = t.waiversUsed || 0;
      t.bench = t.bench || [];
      if (!Array.isArray(t.sponsors)) t.sponsors = [];
      if (!t.lines) t.lines = null;
      if (!t.streak) t.streak = { type: null, count: 0 };
      if (t.lastRehabRound === undefined) t.lastRehabRound = -10;
      if (t.finance.fanBase === undefined) t.finance.fanBase = 0.5;
      if (t.finance.baseFanBase === undefined) t.finance.baseFanBase = t.finance.fanBase;
      if (!t.finance.expenses.transfers) t.finance.expenses.transfers = 0;
      if (!t.finance.merchLevel) t.finance.merchLevel = 1;
      if (t.finance.vipLevel === undefined) t.finance.vipLevel = 0;
      if (!t.finance.matchdayFlags) t.finance.matchdayFlags = { fanzone: false, show: false, kidsTickets: false };
      if (!t.finance.income.merch) t.finance.income.merch = 0;
      if (!t.finance.income.gov) t.finance.income.gov = 0;
      if (!t.scoutMission) t.scoutMission = null;
      if (!t.staff.psychologist) t.staff.psychologist = null;
      t.roster.forEach(p => {
        ensureStats(p); ensurePlayoffStats(p);
        if (!p.careerStats) p.careerStats = { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 };
        if (!p.seasonHistory) p.seasonHistory = [];
        if (p.seasonGoal === undefined) p.seasonGoal = null;
        if (p.injury === undefined) p.injury = null; if (p.fatigue === undefined) p.fatigue = 0;
        if (p.injuryPolicy === undefined) p.injuryPolicy = null;
        if (p.goalieStreak === undefined) p.goalieStreak = 0;
        if (p.lastGameBad === undefined) p.lastGameBad = false;
        if (p.playingThroughPain === undefined) p.playingThroughPain = false;
        if (p.mentorName === undefined) p.mentorName = null;
        if (p.isStarAcademy === undefined) p.isStarAcademy = false;
        if (p.lastIndTraining === undefined) p.lastIndTraining = -10;
        if (!p.character) p.character = 'calm';
        if (!p.contract.bonusPlayoff) p.contract.bonusPlayoff = 0;
        if (!p.contract.bonusMvp) p.contract.bonusMvp = 0;
        if (!p.contract.bonusTopScorer) p.contract.bonusTopScorer = 0;
      });
    });
    G.league.freeAgents.forEach(p => { ensureStats(p); if (!p.careerStats) p.careerStats = { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 }; if (!p.character) p.character = 'calm'; });
    return true;
  } catch (e) { return false; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('hockey_save_v1'); } catch (e) {} }

/* ============================================================
   СТАРТ / НОВАЯ ИГРА
   ============================================================ */
function newGame() {
  clearSave();
  _idCounter = 1; setSeed(Date.now() % 1000000);
  G.difficulty = DIFFICULTIES[G.selectedDifficulty || 'normal'];
  G.career = { reputation: G.difficulty.startReputation, history: [], noFireMode: G.noFireMode || false };
  G.league = genLeague(); resetAllStats(G.league);
  G.league.freeAgents = generateFreeAgents(30); G.league.staffPool = generateStaffCandidates(12);
  ensureAllLines();
  G.playerTeamId = null; G.activeTab = 'standings'; G.screen = 'select';
  G.selectedGamePbp = null; G.popupPlayerId = null; G.viewTeamId = null; G.tradeTargetTeamId = null;
  G.standingsSort = { key: 'pts', dir: 'desc' };
  G.pressConference = null; G.playoffInjuryPrompt = null; G.statsMode = 'regular';
  G.careerOffers = null; G.freeAgentOffers = null;
  G.injuryPrompt = null; G.skipInjuryPrompt = false; G.openingCupModal = null;
  G.liveMatch = null;
  render();
}
function start() {
  if (loadGame()) { ensureAllLines(); initAISponsors(); render(); return; }
  setSeed(20241111);
  G.difficulty = DIFFICULTIES.normal;
  G.career = { reputation: 50, history: [], noFireMode: false };
  G.league = genLeague(); resetAllStats(G.league);
  G.league.freeAgents = generateFreeAgents(30); G.league.staffPool = generateStaffCandidates(12);
  ensureAllLines();
  G.playerTeamId = null; G.activeTab = 'standings'; G.screen = 'select';
  G.selectedGamePbp = null; G.popupPlayerId = null; G.viewTeamId = null; G.tradeTargetTeamId = null;
  G.standingsSort = { key: 'pts', dir: 'desc' };
  G.pressConference = null; G.playoffInjuryPrompt = null; G.statsMode = 'regular';
  G.careerOffers = null; G.freeAgentOffers = null;
  G.injuryPrompt = null; G.skipInjuryPrompt = false; G.openingCupModal = null;
  G.liveMatch = null;
  render();
}
start();
