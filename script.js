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
   RNG
   ============================================================ */
let _seed = 20241111;
function setSeed(s) { _seed = Math.max(1, Math.floor(s)); }
function rng() { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; }
function randInt(a, b) { return Math.floor(rng() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function gauss(m, sd) { const u = 1 - rng(), v = rng(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function poisson(lambda) { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; }
function pickWeighted(items, weightFn) { let total = 0; for (const it of items) total += weightFn(it); if (total <= 0) return pick(items); let r = rng() * total; for (const it of items) { r -= weightFn(it); if (r <= 0) return it; } return items[items.length - 1]; }
function timeToSec(t) { const [m, s] = t.split(':').map(Number); return m * 60 + s; }
function randomTime() { return `${randInt(1, 19)}:${String(randInt(0, 59)).padStart(2, '0')}`; }

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
function overallFromAttrs(attrs, isG) {
  if (isG) return Math.round(attrs.reflexes*0.3 + attrs.positioning*0.3 + attrs.glove*0.15 + attrs.stick*0.15 + attrs.iq*0.1);
  return Math.round(attrs.skating*0.15 + attrs.shooting*0.20 + attrs.passing*0.20 + attrs.defense*0.20 + attrs.physical*0.10 + attrs.iq*0.15);
}
function contractFor(ovr, age) {
  let base = Math.pow(Math.max(0, ovr - 60) / 30, 2) * 22;
  if (age <= 23) base *= 0.55; else if (age >= 30) base *= 0.9;
  const salary = Math.max(0.5, Math.round(base * 10) / 10);
  return {
    salary, years: randInt(1, 5),
    bonusGoal: Math.round((0.02 + Math.max(0, ovr - 60) * 0.002) * 100) / 100,
    bonusGames: Math.round((0.08 + Math.max(0, ovr - 60) * 0.008) * 10) / 10,
    bonusPlayoff: Math.round((0.3 + Math.max(0, ovr - 60) * 0.03) * 10) / 10,
    bonusMvp: Math.round((0.8 + Math.max(0, ovr - 60) * 0.05) * 10) / 10,
    bonusTopScorer: Math.round((0.4 + Math.max(0, ovr - 60) * 0.03) * 10) / 10,
  };
}
function pickAge(targetOvr) {
  if (targetOvr >= 88) return randInt(23, 32);
  if (targetOvr >= 80) return randInt(21, 34);
  if (targetOvr >= 72) return randInt(20, 35);
  return randInt(19, 35);
}
function generateAttrPot(attrs, age, isG) {
  const list = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const bonus = age <= 21 ? randInt(8, 18) : age <= 23 ? randInt(3, 10) : age <= 26 ? randInt(0, 4) : 0;
  const pot = {};
  for (const a of list) pot[a] = clamp(attrs[a] + bonus + randInt(-2, 4), 40, 99);
  return pot;
}
function pickCharacter() { return pickWeighted(Object.keys(CHARACTER_WEIGHTS), k => CHARACTER_WEIGHTS[k]); }
function genPlayer(position, targetOvr, opts = {}) {
  const isG = position === 'G';
  const age = pickAge(targetOvr);
  const attrs = {};
  const pool = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  for (const a of pool) attrs[a] = clamp(Math.round(gauss(targetOvr, 4)), 40, 99);
  const ovr = overallFromAttrs(attrs, isG);
  const attrPot = generateAttrPot(attrs, age, isG);
  const nat = opts.nationality || (rng() < 0.85 ? 'Россия' : pick(NATS.slice(5)));
  return {
    id: nextId(), name: pick(FIRST) + ' ' + pick(LAST), position, age, attrs, attrPot, nationality: nat,
    ovr, pot: overallFromAttrs(attrPot, isG),
    morale: randInt(65, 90), form: randInt(55, 85),
    character: opts.character || pickCharacter(),
    contract: opts.contract || contractFor(ovr, age),
    stats: null, playoffStats: null,
    careerStats: { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 },
    seasonHistory: [],
    seasonGoal: null,
    status: opts.status || 'contract',
    tryoutGames: opts.tryoutGames || 0,
    developmentFocus: null, onTradeBlock: false,
    injury: null, fatigue: 0,
    injuryPolicy: null,
    goalieStreak: 0, lastGameBad: false,
    playingThroughPain: false,
    mentorName: null,
    isStarAcademy: false,
    lastIndTraining: -10,
  };
}
function ensurePlayoffStats(p) {
  if (!p.playoffStats) {
    if (p.position === 'G') p.playoffStats = { gp: 0, wins: 0, losses: 0, otl: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 };
    else p.playoffStats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, plusMinus: 0, pim: 0 };
  }
  return p.playoffStats;
}

/* ============================================================
   СТАТИСТИКА / ЗДОРОВЬЕ
   ============================================================ */
function ensureStats(p) {
  if (!p.stats) {
    if (p.position === 'G') p.stats = { gp: 0, wins: 0, losses: 0, otl: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 };
    else p.stats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, plusMinus: 0, pim: 0 };
  }
  return p.stats;
}
function resetAllStats(league) {
  league.teams.forEach(t => t.roster.forEach(p => { p.stats = null; p.playoffStats = null; ensureStats(p); ensurePlayoffStats(p); }));
}
function getEffectiveOvr(p) {
  if (p.injury && p.injury.gamesLeft > 0) {
    if (!p.playingThroughPain) return 0;
    let ovr = p.ovr;
    if (p.fatigue > 50) ovr -= Math.round((p.fatigue - 50) * 0.10);
    if (p.form >= 80) ovr += 2; else if (p.form < 50) ovr -= 2;
    if (p.morale < 40) ovr -= 2;
    return Math.max(20, Math.round(ovr * 0.85));
  }
  let ovr = p.ovr;
  if (p.fatigue > 50) ovr -= Math.round((p.fatigue - 50) * 0.10);
  if (p.form >= 80) ovr += 2; else if (p.form < 50) ovr -= 2;
  if (p.morale < 40) ovr -= 2;
  return Math.max(20, ovr);
}
function advanceInjuries(team) {
  for (const p of team.roster) if (p.injury && p.injury.gamesLeft > 0) { p.injury.gamesLeft--; if (p.injury.gamesLeft <= 0) { p.injury = null; p.playingThroughPain = false; p.injuryPolicy = null; } }
}
function checkInjuries(team, lineup) {
  for (const p of team.roster) {
    if (p.injury && p.injury.gamesLeft > 0) {
      if (p.playingThroughPain && rng() < 0.15) {
        p.injury.gamesLeft += randInt(3, 5);
        p.playingThroughPain = false;
        if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `Травма ${p.name} усугубилась`, `${p.name} играл через боль и усугубил повреждение. Пропустит ещё ${p.injury.gamesLeft} игр.`, []);
      }
      continue;
    }
    if (!lineup.skaters.includes(p) && lineup.goalie !== p) continue;
    const base = 0.018;
    const fatigueMod = p.fatigue > 70 ? 1.6 : p.fatigue > 50 ? 1.2 : 1.0;
    const medicalMod = 1 - (team.infrastructure.medical * 0.05) - ((team.staff.doctor?.level || 0) * 0.03);
    if (rng() < base * fatigueMod * Math.max(0.2, medicalMod)) {
      const severity = rng() < 0.7 ? 'minor' : 'major';
      const baseDur = severity === 'minor' ? randInt(1, 5) : randInt(8, 25);
      p.injury = { gamesLeft: Math.max(1, Math.round(baseDur * Math.max(0.4, medicalMod))), severity };
      p.injuryPolicy = null;
      if (p.ovr >= 78) addNews('injury', `${p.name} (${team.name}) получил ${severity === 'major' ? 'серьёзную' : 'лёгкую'} травму — ${p.injury.gamesLeft} игр`, 2);
      if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `${p.name} получил травму`, `Травма: ${severity === 'major' ? 'серьёзная' : 'лёгкая'}, пропустит ${p.injury.gamesLeft} игр.`, []);
    }
  }
}
function updateFatigue(team, lineup) {
  const physMod = 1 - ((team.staff.physicalCoach?.level || 0) * 0.05) - (team.infrastructure.training * 0.02);
  const benchSet = new Set(team.bench || []);
  for (const p of team.roster) {
    if (benchSet.has(p.id)) { p.fatigue = Math.max(0, p.fatigue - 8); continue; }
    const played = lineup.skaters.includes(p) || lineup.goalie === p;
    if (played) {
      let base = p.position === 'G' ? 3 : 4;
      if (p.character === 'worker') base *= 1.2;
      if (p.position !== 'G' && team.lines) {
        for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
          if (team.lines[key].players.includes(p.id)) {
            const role = LINE_ROLES[team.lines[key].role] || LINE_ROLES.energy;
            base *= role.fatigue;
            break;
          }
        }
      }
      p.fatigue = Math.min(100, p.fatigue + Math.max(1, Math.round(base * physMod)));
    }
    p.fatigue = Math.max(0, p.fatigue - 4);
  }
}
function updateFormMorale(team, lineup, won) {
  const leaders = team.roster.filter(p => p.character === 'leader');
  const hasEgoists = team.roster.filter(p => p.character === 'egoist').length;
  for (const p of team.roster) {
    const played = lineup.skaters.includes(p) || lineup.goalie === p;
    p.form += (70 - p.form) * 0.08;
    if (p.character === 'worker' && played) p.form += 2;
    if (p.character !== 'calm') {
      if (played) {
        p.form += won ? randInt(2, 6) : -randInt(2, 6);
        p.morale += won ? randInt(1, 3) : -randInt(1, 3);
      } else p.morale -= 1;
    } else {
      if (played) p.form += won ? randInt(1, 3) : -randInt(1, 3);
    }
    if (won && leaders.length) p.morale += leaders.length;
    if (!won && leaders.length) p.morale -= leaders.length;
    if (p.character === 'egoist' && !won) p.morale -= 2;
    if (hasEgoists >= 2 && rng() < 0.05) {
      const egoists = team.roster.filter(x => x.character === 'egoist');
      for (const e of egoists) e.morale -= 2;
    }
    p.form = clamp(Math.round(p.form), 30, 99);
    p.morale = clamp(Math.round(p.morale), 20, 100);
  }
}

/* ============================================================
   FANBASE / СЕРИИ / НОВОСТИ / ПОЧТА
   ============================================================ */
function updateFanbase(team, won) {
  if (!team.streak) team.streak = { type: null, count: 0 };
  let delta = won ? 0.02 : -0.02;
  if (team.finance.merchLevel && team.finance.merchLevel >= 3 && won) delta += 0.01;
  if (team.streak.type === 'w' && won) team.streak.count++;
  else if (team.streak.type === 'l' && !won) team.streak.count++;
  else { team.streak.type = won ? 'w' : 'l'; team.streak.count = 1; }
  if (team.streak.type === 'w' && team.streak.count === 5) { delta += 0.10; addNews('streak', `${team.name} одержал 5 побед подряд`, 3); }
  else if (team.streak.type === 'l' && team.streak.count === 5) { delta -= 0.10; addNews('streak', `${team.name} терпит 5 поражений подряд`, 3); }
  team.finance.fanBase = clamp(team.finance.fanBase + delta, 0.15, 1.0);
}
function addNews(type, text, importance = 1) {
  if (!G.league.news) G.league.news = [];
  G.league.news.push({ id: nextId(), type, text, importance, season: G.league.season, round: G.league.currentRound });
  if (G.league.news.length > 200) G.league.news = G.league.news.slice(-200);
}
function addInboxMessage(type, from, subject, body, actions = []) {
  if (!G.league.inbox) G.league.inbox = [];
  const msg = { id: nextId(), type, from, subject, body, actions: actions.map(a => ({ ...a })), read: false, season: G.league.season, round: G.league.currentRound };
  G.league.inbox.push(msg);
  if (G.league.inbox.length > 100) {
    const unread = G.league.inbox.filter(m => !m.read);
    const readOld = G.league.inbox.filter(m => m.read).slice(0, Math.max(0, 100 - unread.length - 1));
    G.league.inbox = [...readOld, ...unread, msg].slice(-100);
  }
  return msg;
}
function markInboxRead(id) { const m = G.league.inbox.find(x => x.id === id); if (m) m.read = true; }
function markAllInboxRead() { (G.league.inbox || []).forEach(m => m.read = true); render(); }
function unreadInboxCount() { return (G.league.inbox || []).filter(m => !m.read).length; }
function executeInboxAction(msgId, actionIdx) {
  const msg = (G.league.inbox || []).find(m => m.id === msgId);
  if (!msg) return;
  const action = msg.actions[actionIdx];
  if (!action) { msg.read = true; render(); return; }
  const a = action.action, p = action.payload || {};
  if (a === 'trade_accept') acceptAITradeOffer(p.offerId);
  else if (a === 'trade_decline') declineAITradeOffer(p.offerId);
  // #12: ветки extend_contract и rehab удалены — они не генерируются ни одной функцией.
  // Их роль выполняют кнопки в renderModal() (продление контракта и реабилитация).
  msg.read = true;
  msg.actions = [];
  render();
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
   ШТАБ / ИНФРА / АКАДЕМИЯ
   ============================================================ */
const STAFF_ROLES = {
  headCoach:      { label: 'Главный тренер', baseSalary: 3.0, icon: '👔', desc: 'Бонус к атаке и защите (+1% за уровень)' },
  assistantCoach: { label: 'Ассистент', baseSalary: 1.5, icon: '📋', desc: 'Открывает «Советы» в тактике и тренировках' },
  youthCoach:     { label: 'Тренер молодёжи', baseSalary: 1.2, icon: '🎓', desc: 'Ускоряет рост молодых игроков' },
  physicalCoach:  { label: 'Тренер по физподготовке', baseSalary: 1.0, icon: '💪', desc: 'Снижает усталость после матчей' },
  doctor:         { label: 'Врач команды', baseSalary: 1.2, icon: '🩺', desc: 'Снижает риск и длительность травм' },
  psychologist:   { label: 'Психолог', baseSalary: 1.0, icon: '🧠', desc: 'Снижает конфликты на 30%, +1 к морали каждый тур' },
  marketing:      { label: 'Маркетолог', baseSalary: 1.0, icon: '📈', desc: 'Повышает доход от матч-дей' },
  administrator:  { label: 'Администратор', baseSalary: 0.8, icon: '🗂️', desc: 'Снижает операционные расходы' },
  scout:          { label: 'Скаут', baseSalary: 1.0, icon: '🔍', desc: 'Показывает потенциал и данные соперников' },
};
function genStaffCandidate() {
  const roles = Object.keys(STAFF_ROLES);
  const role = pick(roles);
  const level = randInt(1, 5);
  const base = STAFF_ROLES[role].baseSalary;
  return { id: nextId(), role, name: pick(FIRST) + ' ' + pick(LAST), level, xp: 0, salary: Math.round(base * (0.5 + level * 0.3) * 10) / 10, age: randInt(30, 65) };
}
function generateStaffCandidates(count = 12) { const list = []; for (let i = 0; i < count; i++) list.push(genStaffCandidate()); return list; }
function updateStaffPool() {
  if (!G.league.staffPool) G.league.staffPool = [];
  for (let i = 0; i < randInt(1, 2); i++) G.league.staffPool.push(genStaffCandidate());
  if (G.league.staffPool.length > 15) G.league.staffPool = G.league.staffPool.slice(-15);
}
const INFRA = {
  training:     { label: 'Тренировочная база', desc: 'Ускоряет развитие игроков', maxLevel: 5, upgradeCost: l => 20 + l * 30, effect: l => `+${l * 5}% к скорости развития` },
  medical:      { label: 'Медицинский центр', desc: 'Снижает риск травм', maxLevel: 5, upgradeCost: l => 25 + l * 25, effect: l => `-${l * 5}% к риску травм` },
  youthAcademy: { label: 'Детская академия', desc: 'Улучшает качество молодёжи', maxLevel: 5, upgradeCost: l => 30 + l * 35, effect: l => `+${l * 2} к базовому OVR выпускников` },
  marketing:    { label: 'Маркетинг', desc: 'Повышает доход от матч-дей', maxLevel: 5, upgradeCost: l => 15 + l * 20, effect: l => `+${l * 8}% к доходу от матч-дей` },
};
function arenaUpgradeCost(level) { return 100 + level * 150; }
function genAcademyPlayer(group, academyLevel, forceStar = false) {
  const age = group === 'U16' ? randInt(15, 16) : group === 'U17' ? randInt(16, 17) : randInt(17, 18);
  const pos = pick(['C','LW','RW','D','G']);
  const baseOvr = clamp(46 + academyLevel * 2 + randInt(-4, 4), 42, 65);
  const p = genPlayer(pos, baseOvr); p.age = age;
  const isG = pos === 'G';
  const isStar = forceStar || rng() < 0.05;
  const bonus = 12 + academyLevel * 2 + randInt(-3, 8) + (isStar ? 20 : 0);
  p.attrPot = {};
  const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  for (const a of attrs) p.attrPot[a] = clamp(p.attrs[a] + bonus + randInt(-3, 5), 50, 99);
  p.pot = overallFromAttrs(p.attrPot, isG); p.ovr = overallFromAttrs(p.attrs, isG);
  p.isStarAcademy = isStar;
  return p;
}
function academyPrognosis(p) {
  if (p.isStarAcademy) return { label: '⭐ Звезда', cls: 'star' };
  if (p.pot >= 82) return { label: 'Топ-6', cls: 'top6' };
  if (p.pot >= 72) return { label: 'Чек-лайн', cls: 'checking' };
  return { label: 'Энерджайзер', cls: 'energy' };
}
function initAcademy(team) {
  team.academy = { U16: [], U17: [], U18: [] };
  const lvl = team.infrastructure.youthAcademy;
  for (const g of ['U16','U17','U18']) for (let i = 0; i < randInt(6, 8); i++) team.academy[g].push(genAcademyPlayer(g, lvl));
}
function searchForTalent() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  if (team.finance.balance < 5) { alert('Нужно 5 млн ₽'); return; }
  team.finance.balance -= 5; team.finance.expenses.operations += 5;
  const lvl = team.infrastructure.youthAcademy;
  const isStar = rng() < 0.10;
  const p = genAcademyPlayer('U18', lvl + 1, isStar);
  p.age = randInt(16, 18);
  team.academy.U18.push(p);
  addNews('academy', `${team.name} нашёл талант: ${p.name} (${p.position}, OVR ${p.ovr}${isStar ? ', ⭐ звезда' : ''})`, isStar ? 3 : 1);
  addInboxMessage('scout', 'Скаут', `Найден талант: ${p.name}`, `Позиция: ${p.position}, возраст: ${p.age}, OVR: ${p.ovr}, потенциал: ${p.pot}${isStar ? ' ⭐' : ''}. Находится в U18.`, []);
  render();
}
function sendScoutMission() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team) return;
  if (team.scoutMission && team.scoutMission.active) { alert('Скаут уже в миссии'); return; }
  if (team.finance.balance < 2) { alert('Нужно 2 млн ₽'); return; }
  team.finance.balance -= 2; team.finance.expenses.operations += 2;
  team.scoutMission = { active: true, endsRound: G.league.currentRound + 5, reported: false };
  addInboxMessage('scout', 'Скаут', 'Скаут отправлен', 'Скаут отправился в поездку. Отчёт через 5 туров.', []);
  render();
}
function checkScoutMission(team) {
  if (!team.scoutMission || !team.scoutMission.active) return;
  if (G.league.currentRound < team.scoutMission.endsRound) return;
  if (team.scoutMission.reported) return;
  team.scoutMission.reported = true;
  team.scoutMission.active = false;
  const count = randInt(2, 4);
  const found = [];
  for (let i = 0; i < count; i++) found.push(genAcademyPlayer('U17', team.infrastructure.youthAcademy, rng() < 0.15));
  team.scoutMission.results = found;
  addInboxMessage('scout', 'Скаут', `Отчёт скаута: ${count} игрока`, `Найдены ${count} перспективных игрока. Посмотрите в академии.`, []);
}
function addScoutedPlayerToAcademy(team, scoutedId) {
  const scouted = (team.scoutMission?.results || []).find(p => p.id === scoutedId);
  if (!scouted) return;
  team.academy.U17.push(scouted);
  team.scoutMission.results = team.scoutMission.results.filter(p => p.id !== scoutedId);
  addInboxMessage('scout', 'Скаут', `Игрок добавлен в академию`, `${scouted.name} (${scouted.position}) принят в U17.`, []);
  render();
}
function growAcademyPlayer(p) {
  p.age++;
  const isG = p.position === 'G';
  const attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const gain = p.age <= 17 ? randInt(2, 4) : randInt(1, 3);
  for (let i = 0; i < gain; i++) { const elig = attrs.filter(a => p.attrs[a] < p.attrPot[a]); if (!elig.length) break; p.attrs[pick(elig)]++; }
  p.ovr = overallFromAttrs(p.attrs, isG);
  return p;
}
function progressAcademy(team) {
  const promoted = [];
  for (const p of team.academy.U18) {
    growAcademyPlayer(p);
    if (p.ovr >= 60 && p.age >= 18) { p.status = 'contract'; p.contract = contractFor(p.ovr, p.age); promoted.push(p); }
  }
  team.academy.U18 = team.academy.U17.map(growAcademyPlayer);
  team.academy.U17 = team.academy.U16.map(growAcademyPlayer);
  team.academy.U16 = [];
  const lvl = team.infrastructure.youthAcademy;
  for (let i = 0; i < randInt(6, 8); i++) team.academy.U16.push(genAcademyPlayer('U16', lvl));
  for (const p of promoted) {
    team.roster.push(p);
    if (p.ovr >= 65) addNews('academy', `${p.name} (${p.position}, ${p.ovr}) выпустился из академии ${team.name}`, 1);
  }
}
function developStaff(team) {
  for (const role of Object.keys(team.staff)) {
    const emp = team.staff[role];
    if (!emp) continue;
    emp.xp = (emp.xp || 0) + 10;
    const xpNeeded = emp.level * 20;
    if (emp.level < 5 && emp.xp >= xpNeeded) { emp.xp -= xpNeeded; emp.level++; emp.salary = Math.round(STAFF_ROLES[role].baseSalary * (0.5 + emp.level * 0.3) * 10) / 10; }
  }
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
   СЛУЧАЙНЫЕ СОБЫТИЯ
   ============================================================ */
const RANDOM_EVENTS = [
  { key: 'fans', weight: 2, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.02, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale + 2, 20, 100); return { title: 'Встреча с болельщиками', body: 'Фанбаза +2%, мораль +2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.02, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale + 2, 20, 100); } },
  { key: 'scandal', weight: 1, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase - 0.03, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale - 2, 20, 100); return { title: 'Медиа-скандал', body: 'Фанбаза -3%, мораль -2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase - 0.03, 0.15, 1.0); for (const p of team.roster) p.morale = clamp(p.morale - 2, 20, 100); } },
  { key: 'charity', weight: 1, apply: (team) => { if (team.finance.balance < 2) return null; team.finance.balance -= 2; team.finance.expenses.operations += 2; team.finance.fanBase = clamp(team.finance.fanBase + 0.03, 0.15, 1.0); return { title: 'Благотворительность', body: '-2 млн ₽, фанбаза +3%.' }; }, applyAI: (team) => { if (team.finance.balance < 2) return; team.finance.balance -= 2; team.finance.fanBase = clamp(team.finance.fanBase + 0.03, 0.15, 1.0); } },
  { key: 'training_camp', weight: 2, apply: (team) => { for (const p of team.roster) p.form = clamp(p.form + 5, 30, 99); return { title: 'Тренировочный сбор', body: 'Форма +5.' }; }, applyAI: (team) => { for (const p of team.roster) p.form = clamp(p.form + 5, 30, 99); } },
  { key: 'conflict', weight: 1, apply: (team) => { const hasPsy = !!team.staff.psychologist; if (hasPsy && rng() < 0.7) return { title: 'Конфликт погашен психологом', body: 'Психолог сгладил конфликт.' }; const targets = team.roster.slice().sort(() => rng() - 0.5).slice(0, 2); for (const p of targets) p.morale = clamp(p.morale - 3, 20, 100); return { title: 'Конфликт в раздевалке', body: `${targets.map(p => p.name).join(', ')}. Мораль -3.` }; }, applyAI: (team) => { const hasPsy = !!team.staff.psychologist; if (hasPsy && rng() < 0.7) return; const targets = team.roster.slice().sort(() => rng() - 0.5).slice(0, 2); for (const p of targets) p.morale = clamp(p.morale - 3, 20, 100); } },
  { key: 'personal_joy', weight: 1, apply: (team) => { if (!team.roster.length) return null; const p = pick(team.roster); p.morale = clamp(p.morale + 3, 20, 100); return { title: 'Радостное событие', body: `У ${p.name} радостное событие. Мораль +3.` }; }, applyAI: (team) => { if (!team.roster.length) return; const p = pick(team.roster); p.morale = clamp(p.morale + 3, 20, 100); } },
  { key: 'family_problem', weight: 1, apply: (team) => { if (!team.roster.length) return null; const p = pick(team.roster); p.morale = clamp(p.morale - 3, 20, 100); return { title: 'Семейные проблемы', body: `У ${p.name} семейные проблемы. Мораль -3.` }; }, applyAI: (team) => { if (!team.roster.length) return; const p = pick(team.roster); p.morale = clamp(p.morale - 3, 20, 100); } },
  { key: 'sponsor_bonus', weight: 1, apply: (team) => { if (team.finance.balance <= 0) return null; team.finance.balance += 2; team.finance.income.sponsorBonuses += 2; return { title: 'Спонсорский бонус', body: '+2 млн ₽.' }; }, applyAI: (team) => { if (team.finance.balance <= 0) return; team.finance.balance += 2; } },
  { key: 'open_training', weight: 2, apply: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0); for (const p of team.roster) p.form = clamp(p.form + 2, 30, 99); return { title: 'Открытая тренировка', body: 'Фанбаза +1%, форма +2.' }; }, applyAI: (team) => { team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0); for (const p of team.roster) p.form = clamp(p.form + 2, 30, 99); } },
];
function generateRandomEvent() {
  if (!G.league) return;
  const evt = pickWeighted(RANDOM_EVENTS, e => e.weight); if (!evt) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  if (myTeam && rng() < 0.5) {
    const result = evt.apply(myTeam);
    if (result) { addInboxMessage('coach', 'Тренер', `📰 ${result.title}`, result.body, []); addNews('event', `${myTeam.name}: ${result.title}`, 1); }
  } else {
    const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId); if (!aiTeams.length) return;
    const aiTeam = pick(aiTeams); evt.applyAI(aiTeam);
    addNews('event', `${aiTeam.name}: событие (${evt.key})`, 1);
  }
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
   СИМУЛЯЦИЯ МАТЧА (быстрая, без LIVE)
   ============================================================ */
function scorerWeight(p) { const base = p.position === 'D' ? 0.35 : 1.0; const egoBonus = p.character === 'egoist' ? 1.05 : 1.0; return base * egoBonus * (p.attrs.shooting * 0.7 + p.attrs.skating * 0.3) * (0.5 + p.form / 100); }
function assistWeight(p) { return (p.attrs.passing * 0.7 + p.attrs.iq * 0.3) * (0.5 + p.form / 100); }
function shotWeight(p) { return p.attrs.shooting * (0.5 + p.form / 100); }
function simulateGoalEvent(scoringLineup, concedingLineup, period, isPlayoff) {
  const scorer = pickWeighted(scoringLineup.skaters, scorerWeight);
  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  const numAssists = rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assistPool = scoringLineup.skaters.filter(p => p.id !== scorer.id); const assisters = [];
  for (let i = 0; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }
  const onIceScoring = new Set([scorer.id, ...assisters.map(a => a.id)]);
  while (onIceScoring.size < 5 && onIceScoring.size < scoringLineup.skaters.length) onIceScoring.add(pickWeighted(scoringLineup.skaters, x => x.ovr).id);
  const onIceConceding = new Set();
  while (onIceConceding.size < 5 && onIceConceding.size < concedingLineup.skaters.length) onIceConceding.add(pickWeighted(concedingLineup.skaters, x => x.ovr).id);
  for (const p of scoringLineup.skaters) if (onIceScoring.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus++;
  for (const p of concedingLineup.skaters) if (onIceConceding.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus--;
  const assistNames = assisters.map(a => a.name).join(', ');
  return { type: 'goal', player: scorer, pbp: { period: period || randInt(1, 3), time: randomTime(), type: 'goal', text: `ГОЛ! ${scorer.name} (${scorer.position})${assisters.length ? ` — ассист: ${assistNames}` : ''}.` } };
}
function updateGoalieStatus(team, playedGoalie, ga, shotsAgainst) {
  for (const p of team.roster) {
    if (p.position !== 'G') continue;
    if (playedGoalie && p.id === playedGoalie.id) {
      p.goalieStreak = (p.goalieStreak || 0) + 1;
      const sv = shotsAgainst > 0 ? (shotsAgainst - ga) / shotsAgainst : 1;
      p.lastGameBad = ga >= 4 || sv < 0.85;
    } else { p.goalieStreak = 0; p.lastGameBad = false; }
  }
}

/* Быстрый расчёт xG на матч (не для LIVE). Упрощённые штрафы per-period. */
function computeXG(home, away, hTM, aTM) {
  const hAtt = teamAttackRating(home), aAtt = teamAttackRating(away);
  const hDef = teamDefenseRating(home), aDef = teamDefenseRating(away);
  const hLineMods = teamLineMods(home), aLineMods = teamLineMods(away);
  let xgH = clamp(2.8 + (hAtt - aDef) * 0.08 + 0.3, 0.4, 7.5);
  let xgA = clamp(2.8 + (aAtt - hDef) * 0.08, 0.4, 7.5);
  const homeAdvantage = home.finance.fanBase > 0.80 ? 1.05 : home.finance.fanBase < 0.30 ? 0.95 : 1.0;
  xgH = clamp(xgH * homeAdvantage * (1 + hTM.atkMod - aTM.defMod + hLineMods.atk - aLineMods.def), 0.4, 7.5);
  xgA = clamp(xgA * (1 + aTM.atkMod - hTM.defMod + aLineMods.atk - hLineMods.def), 0.4, 7.5);
  return { xgH, xgA, hAtt, aAtt, hDef, aDef };
}

function simGame(homeId, awayId, isPlayoff = false) {
  const home = G.league.teams.find(t => t.id === homeId), away = G.league.teams.find(t => t.id === awayId);
  advanceInjuries(home); advanceInjuries(away);
  const homeLineup = getLineup(home), awayLineup = getLineup(away);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);
  let hg = poisson(xgH), ag = poisson(xgA), ot = false, otWinner = null;
  if (hg === ag) { ot = true; if (rng() < clamp(0.5 + (teamAttackRating(home) + teamDefenseRating(home) - teamAttackRating(away) - teamDefenseRating(away)) * 0.005, 0.3, 0.7)) { hg++; otWinner = 'h'; } else { ag++; otWinner = 'a'; } }
  const hShots = Math.max(hg, Math.round(poisson(24))), aShots = Math.max(ag, Math.round(poisson(22)));
  const allEvents = [];
  for (let i = 0; i < hg; i++) { const isOt = otWinner === 'h' && i === hg - 1; allEvents.push(simulateGoalEvent(homeLineup, awayLineup, isOt ? 4 : null, isPlayoff).pbp); }
  for (let i = 0; i < ag; i++) { const isOt = otWinner === 'a' && i === ag - 1; allEvents.push(simulateGoalEvent(awayLineup, homeLineup, isOt ? 4 : null, isPlayoff).pbp); }
  for (let i = 0; i < hShots - hg; i++) { const p = pickWeighted(homeLineup.skaters, shotWeight); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++; allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'shot', text: `${p.name} (${p.position}) бросает — сейв.` }); }
  for (let i = 0; i < aShots - ag; i++) { const p = pickWeighted(awayLineup.skaters, shotWeight); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++; allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'shot', text: `${p.name} (${p.position}) бросает — сейв.` }); }
  const basePens = randInt(3, 5), hPenExtra = Math.round(hTM.penRisk * 2), aPenExtra = Math.round(aTM.penRisk * 2);
  for (let i = 0; i < basePens + hPenExtra + aPenExtra; i++) {
    const isHome = rng() < 0.5; const lineup = isHome ? homeLineup : awayLineup;
    const p = pick(lineup.skaters); (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).pim += 2;
    allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'penalty', text: `2 мин: ${p.name} (${p.position}) — ${pick(['задержка','подножка','грубость','толчок','удар соперника'])}.` });
  }
  for (let i = 0; i < 2; i++) allEvents.push({ period: randInt(1, 3), time: randomTime(), type: 'faceoff', text: 'Вбрасывание.' });
  allEvents.sort((a, b) => a.period !== b.period ? a.period - b.period : timeToSec(a.time) - timeToSec(b.time));
  const pbp = []; const maxPeriod = ot ? 4 : 3; let cur = 0;
  for (const ev of allEvents) { while (cur < ev.period) { cur++; pbp.push({ period: cur, time: '—', type: 'period', text: cur === 4 ? 'Овертайм' : `Период ${cur}` }); } pbp.push(ev); }
  while (cur < maxPeriod) { cur++; pbp.push({ period: cur, time: '—', type: 'period', text: cur === 4 ? 'Овертайм' : `Период ${cur}` }); }
  if (awayLineup.goalie) { const s = isPlayoff ? ensurePlayoffStats(awayLineup.goalie) : ensureStats(awayLineup.goalie); s.gp++; s.shotsAgainst += hShots; s.goalsAgainst += hg; s.saves += hShots - hg; if (hg === 0) s.shutouts++; if (hg < ag) s.wins++; else if (hg > ag) { if (ot) s.otl++; else s.losses++; } }
  if (homeLineup.goalie) { const s = isPlayoff ? ensurePlayoffStats(homeLineup.goalie) : ensureStats(homeLineup.goalie); s.gp++; s.shotsAgainst += aShots; s.goalsAgainst += ag; s.saves += aShots - ag; if (ag === 0) s.shutouts++; if (ag < hg) s.wins++; else if (ag > hg) { if (ot) s.otl++; else s.losses++; } }
  if (homeLineup.goalie) updateGoalieStatus(home, homeLineup.goalie, ag, aShots);
  if (awayLineup.goalie) updateGoalieStatus(away, awayLineup.goalie, hg, hShots);
  for (const p of homeLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  for (const p of awayLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  checkInjuries(home, homeLineup); checkInjuries(away, awayLineup);
  updateFatigue(home, homeLineup); updateFatigue(away, awayLineup);
  updateFormMorale(home, homeLineup, hg > ag); updateFormMorale(away, awayLineup, ag > hg);
  updateLineChemistry(home, hg > ag, homeLineup); updateLineChemistry(away, ag > hg, awayLineup);
  if (!isPlayoff) {
    updateFanbase(home, hg > ag); updateFanbase(away, ag > hg);
    const homeExpected = fanExpectation(home, away, true);
    const awayExpected = fanExpectation(away, home, false);
    applyFanExpectation(home, homeExpected, hg > ag, true);
    applyFanExpectation(away, awayExpected, ag > hg, false);
  }
  // ⚙️ ФИКС TRYOUT: сохраняем кто реально играл, чтобы processTryouts не списал просмотрщикам, сидящим на скамейке
  home._lastPlayedIds = [...homeLineup.skaters, homeLineup.goalie].filter(Boolean).map(p => p.id);
  away._lastPlayedIds = [...awayLineup.skaters, awayLineup.goalie].filter(Boolean).map(p => p.id);
  processTryouts(home); processTryouts(away);
  for (const team of [home, away]) if (team.staff.psychologist) for (const p of team.roster) p.morale = clamp(p.morale + 1, 20, 100);
  return { homeId, awayId, hg, ag, ot, pbp };
}
function processTryouts(team) {
  const tryouts = team.roster.filter(p => p.status === 'tryout');
  const playedIds = new Set(team._lastPlayedIds || []);
  for (const p of tryouts) {
    // ⚙️ ФИКС: списываем игру только если игрок реально выходил на лёд
    if (!playedIds.has(p.id)) continue;
    p.tryoutGames--;
    if (p.tryoutGames <= 0) {
      if (p.ovr >= 68 && rng() < 0.6) { p.status = 'contract'; p.contract = contractFor(p.ovr, p.age); }
      else { const idx = team.roster.indexOf(p); if (idx !== -1) team.roster.splice(idx, 1); }
    }
  }
}

/* ============================================================
   ЭКОНОМИКА
   ============================================================ */
function processMatchdayRevenue(team, isHome, opponentStrength) {
  if (!isHome) return;
  const f = team.finance;
  const marketingBonus = 1 + (team.infrastructure.marketing * 0.08) + (team.staff.marketing ? team.staff.marketing.level * 0.02 : 0);
  const priceFactor = clamp(1.3 - (f.ticketPrice / 1000) * 0.6, 0.5, 1.3);
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const rankBonus = rank <= 8 ? 0.20 : 0;
  let fillBonus = 0;
  if (f.matchdayFlags.fanzone) fillBonus += 0.05;
  if (f.matchdayFlags.show) fillBonus += 0.03;
  if (f.matchdayFlags.kidsTickets && opponentStrength < 1.10) fillBonus += 0.10;
  const fill = clamp(f.fanBase * priceFactor * (0.75 + rng() * 0.3) + (opponentStrength - 1.0) * 0.15 + rankBonus + fillBonus, 0.15, 0.98);
  const attendance = Math.round(f.arenaCapacity * fill);
  let ticketPrice = f.ticketPrice;
  if (f.vipLevel > 0) ticketPrice *= (1 + f.vipLevel * 0.05);
  const ticketIncome = attendance * ticketPrice / 1_000_000;
  let extrasMult = 1;
  if (f.merchLevel >= 2) extrasMult += 0.15;
  if (f.merchLevel >= 3) extrasMult += 0.15;
  if (f.merchLevel >= 4) extrasMult += 0.20;
  if (f.merchLevel >= 5) extrasMult += 0.25;
  const extras = (attendance * 300 / 1_000_000) * marketingBonus * extrasMult;
  f.income.tickets += ticketIncome; f.income.matchdayExtras += extras; f.balance += ticketIncome + extras;
  if (f.matchdayFlags.show) for (const p of team.roster) if (rng() < 0.3) p.morale = clamp(p.morale + 1, 20, 100);
}
function processOperations(team) {
  const f = team.finance;
  const adminBonus = 1 - (team.staff.administrator ? team.staff.administrator.level * 0.04 : 0);
  const perGame = f.seasonBudget * 0.32 / 58 * adminBonus;
  f.expenses.operations += perGame; f.balance -= perGame;
}
function processGovSupport(team) {
  const perGame = (team.govSupport || 0) * 3 / 58;
  team.finance.balance += perGame;
  team.finance.income.gov += perGame;
}
function paySalaries(team) {
  const playerSalary = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const staffSalary = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  team.finance.expenses.salaries += playerSalary * (1 / 58);
  team.finance.expenses.staffSalaries += staffSalary * (1 / 58);
  team.finance.balance -= (playerSalary + staffSalary) * (1 / 58);
}
function processMerchRevenue(team) {
  if (!team.finance.merchLevel || team.finance.merchLevel < 5) return;
  const passive = Math.round(team.finance.fanBase * 1000) / 1000 * 1.0;
  team.finance.balance += passive;
  team.finance.income.merch = (team.finance.income.merch || 0) + passive;
}
function generateSponsorOffers(team) {
  if (team.finance.sponsorOffers) return team.finance.sponsorOffers;
  const budget = team.finance.seasonBudget;
  const diff = G.difficulty || DIFFICULTIES.normal;
  const flow = team.sponsorFlow || 3;
  const types = [
    { key: 'general',  name: 'Генеральный спонсор',  share: 0.32, always: flow >= 3 },
    { key: 'tech',     name: 'Технический партнёр',  share: 0.14, always: true },
    { key: 'regional', name: 'Региональный партнёр', share: 0.07, always: true },
    { key: 'local1',   name: 'Локальный партнёр #1', share: 0.035, always: flow >= 2 },
    { key: 'local2',   name: 'Локальный партнёр #2', share: 0.035, always: flow >= 5 },
  ];
  const offers = [];
  for (const t of types) {
    if (!t.always) continue;
    const variance = 0.9 + rng() * 0.2;
    const base = Math.round(budget * t.share * variance * diff.sponsorMult);
    offers.push({ key: t.key, name: t.name, base, paid: 0, bonusWin: 0.12, bonusTop8: 2.0, bonusPlayoff: 5.0, bonusChampion: 8.0 });
  }
  team.finance.sponsorOffers = offers;
  return offers;
}
function signSponsor(team, offer) {
  if (!team.sponsors) team.sponsors = [];
  if (team.sponsors.some(s => s.key === offer.key)) return false;
  const signed = { ...offer, paid: 0 };
  team.sponsors.push(signed);
  const progress = G.league.currentRound / G.league.schedule.length;
  const first = Math.round(offer.base * progress);
  if (first > 0) { team.finance.balance += first; team.finance.income.sponsors += first; signed.paid += first; }
  return true;
}
function signAllSponsors(team) { const offers = team.finance.sponsorOffers || []; for (const o of offers) signSponsor(team, o); }
function signSponsorByKey(key) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return; const offer = (team.finance.sponsorOffers || []).find(o => o.key === key); if (offer) signSponsor(team, offer); render(); }
function initAISponsors() {
  if (!G.league) return;
  for (const team of G.league.teams) {
    if (!team.finance.sponsorOffers) generateSponsorOffers(team);
    if (team.id === G.playerTeamId) continue;
    for (const o of team.finance.sponsorOffers || []) if (!team.sponsors.some(s => s.key === o.key)) signSponsor(team, o);
  }
}
function paySponsors(team) {
  if (!team.sponsors || !team.sponsors.length) return;
  const progress = G.league.currentRound / G.league.schedule.length;
  for (const s of team.sponsors) {
    const target = Math.round(s.base * progress);
    const due = target - (s.paid || 0);
    if (due > 0) { team.finance.balance += due; team.finance.income.sponsors += due; s.paid = target; }
  }
}
function processSponsorPayouts(team) {
  if (!team.sponsors || !team.sponsors.length) return;
  const delta = team.record.w - team.finance.lastSponsorWins;
  if (delta > 0) {
    let bonus = 0;
    for (const s of team.sponsors) bonus += delta * s.bonusWin;
    bonus = Math.round(bonus * 10) / 10;
    team.finance.balance += bonus; team.finance.income.sponsorBonuses += bonus;
    team.finance.lastSponsorWins = team.record.w;
  }
}
function payTVInstallment(team) {
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const pool = team.finance.seasonBudget * 0.12;
  const factor = 0.5 + 0.5 * (30 - rank) / 29;
  const tv = Math.round(pool * factor / 6);
  team.finance.balance += tv; team.finance.income.tv += tv;
}
function paySponsorEndBonuses(team, rank, playoffResult) {
  if (!team.sponsors || !team.sponsors.length) return;
  let total = 0;
  for (const s of team.sponsors) {
    if (playoffResult === 'champion') total += s.bonusChampion;
    else if (playoffResult) total += s.bonusPlayoff;
    if (rank <= 8) total += s.bonusTop8;
  }
  if (total > 0) { team.finance.balance += total; team.finance.income.sponsorBonuses += total; }
}
function processPrizes(team, rank, playoffResult) {
  let total = 0;
  if (rank === 1) total += team.finance.seasonBudget * 0.10;
  else if (rank <= 4) total += team.finance.seasonBudget * 0.06;
  else if (rank <= 8) total += team.finance.seasonBudget * 0.03;
  const pPrizes = { champion: 0.15, finalist: 0.08, semifinal: 0.05, quarterfinal: 0.03, round16: 0.015 };
  if (playoffResult) total += team.finance.seasonBudget * (pPrizes[playoffResult] || 0);
  total = Math.round(total);
  team.finance.balance += total; team.finance.income.prizes += total;
  return total;
}
function payContractBonuses(team) {
  let total = 0;
  for (const p of team.roster) {
    const s = ensureStats(p);
    if (p.position === 'G') total += Math.floor(s.gp / 10) * (p.contract.bonusGames || 0) + s.shutouts * 0.15;
    else total += s.goals * (p.contract.bonusGoal || 0) + Math.floor(s.gp / 10) * (p.contract.bonusGames || 0);
  }
  total = Math.round(total * 10) / 10;
  if (total > 0) { team.finance.expenses.bonuses += total; team.finance.balance -= total; }
  return total;
}
function payPlayerSeasonBonuses(team, awards, reachedPlayoff) {
  let total = 0;
  for (const p of team.roster) {
    if (reachedPlayoff) total += p.contract.bonusPlayoff || 0;
    if (awards.mvp && awards.mvp.name === p.name && awards.mvp.team === team.name) total += p.contract.bonusMvp || 0;
    if (awards.topScorer && awards.topScorer.name === p.name && awards.topScorer.team === team.name) total += p.contract.bonusTopScorer || 0;
  }
  total = Math.round(total * 10) / 10;
  if (total > 0) { team.finance.expenses.bonuses += total; team.finance.balance -= total; }
  return total;
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
   РЫНОК / ОБМЕНЫ / ДРАФТ ОТКАЗОВ
   ============================================================ */
function generateFreeAgents(count = 30) { const agents = []; for (let i = 0; i < count; i++) agents.push(genPlayer(pick(['C','LW','RW','D','G']), randInt(60, 82), { status: 'ufa' })); return agents; }
function signFreeAgent(team, player) {
  const idx = G.league.freeAgents.indexOf(player); if (idx === -1) return false;
  if (team.finance.balance < 0) return false;
  const foreigners = team.roster.filter(p => p.nationality !== 'Россия').length;
  if (player.nationality !== 'Россия' && foreigners >= 3) return false;
  G.league.freeAgents.splice(idx, 1); player.status = 'contract'; team.roster.push(player);
  if (player.ovr >= 78) addNews('signing', `${team.name} подписал ${player.name} (${player.position}, ${player.ovr})`, 2);
  return true;
}
function offerTryout(team, player) {
  const idx = G.league.freeAgents.indexOf(player); if (idx === -1) return false;
  G.league.freeAgents.splice(idx, 1); player.status = 'tryout'; player.tryoutGames = 10;
  player.contract = { salary: 0.5, years: 0, bonusGoal: 0, bonusGames: 0, bonusPlayoff: 0, bonusMvp: 0, bonusTopScorer: 0 };
  team.roster.push(player); return true;
}
function hireStaff(candId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const idx = G.league.staffPool.findIndex(c => c.id === candId); if (idx === -1) return;
  const cand = G.league.staffPool[idx];
  if (team.staff[cand.role]) G.league.staffPool.push(team.staff[cand.role]);
  team.staff[cand.role] = cand; G.league.staffPool.splice(idx, 1);
}
function fireStaff(role) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff[role]) return; G.league.staffPool.push(team.staff[role]); team.staff[role] = null; }
function upgradeInfra(key) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const def = INFRA[key]; const lvl = team.infrastructure[key]; if (lvl >= def.maxLevel) return;
  const cost = def.upgradeCost(lvl); if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.infrastructure[key]++;
}
function upgradeArena(team) {
  if (team.arenaLevel >= 5) return; const cost = arenaUpgradeCost(team.arenaLevel);
  if (team.finance.balance < cost) return; team.finance.balance -= cost; team.arenaLevel++;
  team.finance.arenaCapacity = Math.round(team.finance.arenaCapacity * 1.3);
}
function upgradeMerch(team) {
  if (team.finance.merchLevel >= 5) return;
  const costs = { 1: 5, 2: 12, 3: 25, 4: 50 };
  const cost = costs[team.finance.merchLevel];
  if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.finance.merchLevel++;
}
function upgradeVip(team) {
  if (team.finance.vipLevel >= 3) return;
  const costs = { 0: 10, 1: 25, 2: 50 };
  const cost = costs[team.finance.vipLevel];
  if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.finance.vipLevel++;
}
function toggleMatchdayFlag(team, flag) {
  const costs = { fanzone: 2, show: 5, kidsTickets: 1 };
  if (!team.finance.matchdayFlags[flag]) {
    if (team.finance.balance < costs[flag]) return;
    team.finance.balance -= costs[flag]; team.finance.expenses.operations += costs[flag];
    team.finance.matchdayFlags[flag] = true;
  } else {
    team.finance.matchdayFlags[flag] = false;
  }
}
function suggestTactics() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff.assistantCoach) return;
  const lvl = team.staff.assistantCoach.level; const noise = Math.max(3, 20 - lvl * 3);
  const myAtk = teamAttackRating(team), myDef = teamDefenseRating(team);
  const avgAtk = G.league.teams.reduce((s, t) => s + teamAttackRating(t), 0) / G.league.teams.length;
  const avgDef = G.league.teams.reduce((s, t) => s + teamDefenseRating(t), 0) / G.league.teams.length;
  const atkDiff = myAtk - avgDef, defDiff = myDef - avgAtk;
  const t = team.tactics;
  t.pressure = clamp(50 + Math.round(-defDiff * 2) + randInt(-noise, noise), 0, 100);
  t.forecheck = clamp(50 + Math.round(atkDiff * 2) + randInt(-noise, noise), 0, 100);
  t.style = clamp(50 + Math.round(atkDiff - defDiff) + randInt(-noise, noise), 0, 100);
  t.physical = clamp(50 + randInt(-noise, noise), 0, 100);
  t.risk = clamp(50 + randInt(-noise, noise), 0, 100);
}
function suggestTraining() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff.assistantCoach) return;
  for (const p of team.roster) {
    if (p.age > 27) continue;
    if (p.position === 'G') p.developmentFocus = p.attrs.reflexes < p.attrs.positioning ? 'reflexes' : 'positioning';
    else {
      const atk = (p.attrs.shooting + p.attrs.passing) / 2, def = (p.attrs.defense + p.attrs.iq) / 2, phy = (p.attrs.physical + p.attrs.skating) / 2;
      const min = Math.min(atk, def, phy);
      p.developmentFocus = min === atk ? 'attack' : min === def ? 'defense' : 'physical';
    }
  }
}
function putOnWaivers(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId); if (!p || p.status === 'tryout') return;
  if ((team.waiversUsed || 0) >= 3) { alert('Лимит: 3 игрока за сезон'); return; }
  team.waiversUsed = (team.waiversUsed || 0) + 1;
  G.league.waivers.push({ player: p, fromTeamId: team.id, expiresRound: G.league.currentRound + 2 });
  team.roster = team.roster.filter(x => x.id !== playerId); p.status = 'waivers';
  team.lines = null; initLines(team);
}
function processWaivers() {
  if (!G.league.waivers.length) return;
  const sorted = standingsSorted(); const remaining = [];
  for (const w of G.league.waivers) {
    if (G.league.currentRound >= w.expiresRound) { w.player.status = 'ufa'; G.league.freeAgents.push(w.player); continue; }
    let claimed = false;
    for (const team of sorted) {
      if (team.id === w.fromTeamId) continue;
      if (team.finance.balance < w.player.contract.salary * 2) continue;
      if (team.roster.length >= 30) continue;
      if (rng() < 0.08) { team.roster.push(w.player); w.player.status = 'contract'; claimed = true; break; }
    }
    if (!claimed) remaining.push(w);
  }
  G.league.waivers = remaining;
}
function tradeValue(p) {
  const potBonus = p.pot > p.ovr ? (p.pot - p.ovr) * 0.5 : 0;
  const ageFactor = p.age <= 24 ? 1.2 : p.age >= 31 ? 0.7 : 1.0;
  return Math.round((p.ovr * 2 + potBonus) * ageFactor);
}
function executeMultiTrade(myIds, theirIds, aiTeamId, myCash = 0, theirCash = 0) {
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const theirTeam = G.league.teams.find(t => t.id === aiTeamId);
  if (!myTeam || !theirTeam) return { success: false, error: 'Команда не найдена' };
  if (theirTeam.id === myTeam.id) return { success: false, error: 'Нельзя обменять с самим собой' };
  const myOut = myTeam.roster.filter(p => myIds.includes(p.id));
  const theirOut = theirTeam.roster.filter(p => theirIds.includes(p.id));
  if (myOut.length !== myIds.length || theirOut.length !== theirIds.length) return { success: false, error: 'Игрок не найден' };
  if (myCash < 0 || theirCash < 0) return { success: false, error: 'Отрицательная сумма' };
  if (myCash > myTeam.finance.balance) return { success: false, error: 'Недостаточно баланса' };
  if (theirCash > theirTeam.finance.balance) return { success: false, error: 'У соперника недостаточно баланса' };
  const myTotal = myOut.reduce((s, p) => s + tradeValue(p), 0) + myCash * 5;
  const theirTotal = theirOut.reduce((s, p) => s + tradeValue(p), 0) + theirCash * 5;
  if (myTotal < theirTotal * 0.8) return { success: false, error: `Неравноценно: твоя ${myTotal} < ${Math.round(theirTotal * 0.8)}` };
  const myForeignKeep = myTeam.roster.filter(p => p.nationality !== 'Россия' && !myIds.includes(p.id)).length;
  const theirForeignKeep = theirTeam.roster.filter(p => p.nationality !== 'Россия' && !theirIds.includes(p.id)).length;
  const myIncoming = theirOut.filter(p => p.nationality !== 'Россия').length;
  const theirIncoming = myOut.filter(p => p.nationality !== 'Россия').length;
  if (myForeignKeep + myIncoming > 3) return { success: false, error: 'У тебя превысится лимит легионеров' };
  if (theirForeignKeep + theirIncoming > 3) return { success: false, error: 'У соперника превысится лимит легионеров' };
  myTeam.roster = myTeam.roster.filter(p => !myIds.includes(p.id)).concat(theirOut);
  theirTeam.roster = theirTeam.roster.filter(p => !theirIds.includes(p.id)).concat(myOut);
  myTeam.finance.balance -= myCash; myTeam.finance.balance += theirCash;
  theirTeam.finance.balance -= theirCash; theirTeam.finance.balance += myCash;
  myTeam.finance.expenses.transfers += myCash; theirTeam.finance.expenses.transfers += theirCash;
  myTeam.lines = null; theirTeam.lines = null;
  syncLines(myTeam); syncLines(theirTeam);
  const involved = [...myOut, ...theirOut].filter(p => p.ovr >= 78);
  for (const p of involved) addNews('trade', `${p.name} (${p.ovr}) сменил клуб в результате обмена`, 2);
  return { success: true };
}
function proposeMultiTrade() {
  if (isTradeDeadlinePassed()) { alert('Трансферный дедлайн закрыт'); return; }
  const myIds = Array.from(document.querySelectorAll('.trade-my-pick:checked')).map(el => Number(el.value));
  const theirIds = Array.from(document.querySelectorAll('.trade-their-pick:checked')).map(el => Number(el.value));
  const aiTeamId = G.tradeTargetTeamId;
  const myCash = Number(document.getElementById('my-cash')?.value || 0);
  const theirCash = Number(document.getElementById('their-cash')?.value || 0);
  if (!myIds.length && !myCash) { alert('Выбери хотя бы одного игрока или деньги'); return; }
  if (!theirIds.length && !theirCash) { alert('Выбери хотя бы одного игрока соперника или деньги'); return; }
  if (!aiTeamId) { alert('Выбери команду соперника'); return; }
  const r = executeMultiTrade(myIds, theirIds, aiTeamId, myCash, theirCash);
  if (r.success) { alert('Обмен состоялся!'); render(); } else alert('Обмен отклонён: ' + (r.error || ''));
}
function setTradeTeam(teamId) { G.tradeTargetTeamId = Number(teamId); render(); }
function generateAITradeOffer() {
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId); if (!myTeam) return;
  const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId); if (!aiTeams.length) return;
  const aiTeam = pick(aiTeams); if (aiTeam.roster.length < 18) return;
  const myTargets = myTeam.roster.filter(p => p.ovr >= 70 && p.age <= 30).sort((a, b) => tradeValue(b) - tradeValue(a));
  if (!myTargets.length) return;
  const target = rng() < 0.5 ? myTargets[0] : pick(myTargets.slice(0, Math.min(5, myTargets.length)));
  const targetValue = tradeValue(target);
  const aiAssets = aiTeam.roster.filter(p => tradeValue(p) <= targetValue * 1.15).sort((a, b) => tradeValue(b) - tradeValue(a));
  if (!aiAssets.length) return;
  const offerPlayers = []; let remaining = targetValue * (0.9 + rng() * 0.2);
  for (const p of aiAssets) { if (remaining <= 0 || offerPlayers.length >= 2) break; if (tradeValue(p) <= remaining + 30) { offerPlayers.push(p); remaining -= tradeValue(p); } }
  if (!offerPlayers.length) return;
  const myForeignAfter = myTeam.roster.filter(p => p.nationality !== 'Россия' && p.id !== target.id).length + offerPlayers.filter(p => p.nationality !== 'Россия').length;
  const aiForeignAfter = aiTeam.roster.filter(p => p.nationality !== 'Россия' && !offerPlayers.some(op => op.id === p.id)).length + (target.nationality !== 'Россия' ? 1 : 0);
  if (myForeignAfter > 3 || aiForeignAfter > 3) return;
  const offer = { id: nextId(), fromTeamId: aiTeam.id, theyOffer: offerPlayers.map(p => p.id), theyWant: [target.id], expiresRound: G.league.currentRound + 3 };
  G.league.aiTradeOffers.push(offer);
  addInboxMessage('league', aiTeam.name, `Предложение обмена`,
    `${aiTeam.name} предлагает обмен: отдаёт ${offerPlayers.map(p => p.name + ' (' + p.ovr + ')').join(', ')} за ${target.name}.`,
    [{ label: '✅ Принять', action: 'trade_accept', payload: { offerId: offer.id } }, { label: '❌ Отклонить', action: 'trade_decline', payload: { offerId: offer.id } }]);
}
function acceptAITradeOffer(offerId) {
  const offer = G.league.aiTradeOffers.find(o => o.id === offerId); if (!offer) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const aiTeam = G.league.teams.find(t => t.id === offer.fromTeamId);
  if (!myTeam || !aiTeam) { G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  if (!offer.theyWant.every(id => myTeam.roster.some(p => p.id === id))) { alert('Игрок не в твоей команде'); G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  if (!offer.theyOffer.every(id => aiTeam.roster.some(p => p.id === id))) { alert('Игрок не в команде соперника'); G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  const myOut = myTeam.roster.filter(p => offer.theyWant.includes(p.id));
  const theirOut = aiTeam.roster.filter(p => offer.theyOffer.includes(p.id));
  myTeam.roster = myTeam.roster.filter(p => !offer.theyWant.includes(p.id)).concat(theirOut);
  aiTeam.roster = aiTeam.roster.filter(p => !offer.theyOffer.includes(p.id)).concat(myOut);
  myTeam.lines = null; aiTeam.lines = null;
  syncLines(myTeam); syncLines(aiTeam);
  G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId);
  alert('Обмен принят!'); render();
}
function declineAITradeOffer(offerId) { G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); }
function runAITransfers() {
  const teams = G.league.teams.filter(t => t.id !== G.playerTeamId);
  const freeAgents = G.league.freeAgents; if (!freeAgents.length) return;
  for (const team of teams) {
    if (rng() > 0.2) continue;
    if (team.roster.length >= 25) continue;
    const currentSalary = team.roster.reduce((s, p) => s + p.contract.salary, 0);
    const salaryRoom = team.finance.salaryCap - currentSalary;
    if (salaryRoom < 2) continue;
    const candidates = freeAgents.filter(p => p.contract.salary <= salaryRoom * 0.7).sort((a, b) => b.ovr - a.ovr);
    if (!candidates.length) continue;
    const target = candidates[0];
    // ⚙️ ФИКС: лимит легионеров у ИИ тоже соблюдается
    const foreigners = team.roster.filter(p => p.nationality !== 'Россия').length;
    if (target.nationality !== 'Россия' && foreigners >= 3) continue;
    const idx = freeAgents.indexOf(target);
    if (idx !== -1) { freeAgents.splice(idx, 1); target.status = 'contract'; team.roster.push(target); }
  }
}
function runAIContractExtensions() {
  for (const team of G.league.teams) {
    if (team.id === G.playerTeamId) continue;
    for (const p of team.roster) {
      if (p.contract.years > 1) continue;
      if (rng() > 0.4) continue;
      const marketSalary = contractFor(p.ovr, p.age).salary;
      const newSalary = Math.max(p.contract.salary, Math.round(marketSalary * 1.05 * 10) / 10);
      const currentSalary = team.roster.reduce((s, x) => s + x.contract.salary, 0);
      const salaryRoom = team.finance.salaryCap - currentSalary + p.contract.salary;
      if (newSalary > salaryRoom) continue;
      p.contract.salary = newSalary; p.contract.years += randInt(1, 3);
    }
  }
}
function runAIActions() {
  runAITransfers(); runAIContractExtensions();
  if (rng() < 0.35) generateAITradeOffer();
  if (rng() < 0.15) generateAITradeOffer();
  G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.expiresRound > G.league.currentRound);
}

/* ============================================================
   ДЕДЛАЙН ОБМЕНОВ
   ============================================================ */
function isTradeDeadlinePassed() {
  if (!G.league) return false;
  if (G.league.currentRound < 40) return false;
  return true;
}
function checkTradeDeadlineNews() {
  if (G.league.tradeDeadlineNotified) return;
  if (G.league.currentRound === 40) {
    G.league.tradeDeadlineNotified = true;
    addNews('trade_deadline', 'Трансферный дедлайн закрыт. Обмены до конца сезона невозможны.', 3);
    if (G.playerTeamId) addInboxMessage('league', 'Лига', 'Трансферный дедлайн', 'Обмены между клубами закрыты до конца сезона. Подписания свободных агентов и продления контрактов остаются доступными.', []);
  }
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
function updateCareerStats(team) {
  for (const p of team.roster) {
    const s = ensureStats(p);
    p.careerStats = p.careerStats || { seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0 };
    p.careerStats.seasons++; p.careerStats.gp += s.gp;
    p.careerStats.goals += (s.goals || 0); p.careerStats.assists += (s.assists || 0);
    p.careerStats.points += (s.points || 0); p.careerStats.wins += (s.wins || 0); p.careerStats.shutouts += (s.shutouts || 0);
    if (!p.seasonHistory) p.seasonHistory = [];
    p.seasonHistory.push({
      season: G.league.season, teamName: team.name,
      gp: s.gp, goals: s.goals || 0, assists: s.assists || 0, points: s.points || 0,
      wins: s.wins || 0, shutouts: s.shutouts || 0,
      ovr: p.ovr, salary: p.contract.salary,
    });
  }
}
function updateAllTimeLeaders(team) {
  if (!G.league.allTimeLeaders) G.league.allTimeLeaders = { skaters: {} };
  const db = G.league.allTimeLeaders.skaters;
  for (const p of team.roster) {
    const s = ensureStats(p); if (s.gp === 0) continue;
    const key = p.name + '#' + p.id;
    if (!db[key]) db[key] = { id: p.id, name: p.name, isG: p.position === 'G', seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0 };
    const e = db[key];
    e.seasons++; e.gp += s.gp; e.goals += (s.goals || 0); e.assists += (s.assists || 0); e.points += (s.points || 0);
    e.wins += (s.wins || 0); e.shutouts += (s.shutouts || 0); e.saves += (s.saves || 0); e.shotsAgainst += (s.shotsAgainst || 0); e.goalsAgainst += (s.goalsAgainst || 0);
  }
}

/* ============================================================
   НАГРАДЫ
   ============================================================ */
function computeAwards() {
  const allSkaters = [], allGoalies = [];
  for (const t of G.league.teams) for (const p of t.roster) {
    ensureStats(p);
    if (p.position === 'G') allGoalies.push({ p, team: t }); else allSkaters.push({ p, team: t });
  }
  const best = (arr, fn) => arr.length ? arr.slice().sort((a, b) => fn(b) - fn(a))[0] : null;
  const topScorer = best(allSkaters, x => x.p.stats.goals);
  const topAssister = best(allSkaters, x => x.p.stats.assists);
  const topPointMan = best(allSkaters, x => x.p.stats.points);
  const defs = allSkaters.filter(x => x.p.position === 'D');
  const topDefenseman = best(defs, x => x.p.stats.points + x.p.stats.plusMinus * 0.5);
  const goaliesQual = allGoalies.filter(x => x.p.stats.gp >= 20 && x.p.stats.shotsAgainst > 0);
  const topGoalie = best(goaliesQual, x => x.p.stats.saves / x.p.stats.shotsAgainst);
  const rookies = allSkaters.filter(x => x.p.age <= 22 && x.p.stats.gp >= 20);
  const rookieOfYear = best(rookies, x => x.p.stats.points);
  const mvpCands = allSkaters.filter(x => x.p.stats.points >= 20);
  const mvp = best(mvpCands, x => x.p.stats.points + x.p.stats.plusMinus * 0.3);
  const fmtSk = (x) => x ? { name: x.p.name, team: x.team.name, position: x.p.position, gp: x.p.stats.gp, goals: x.p.stats.goals, assists: x.p.stats.assists, points: x.p.stats.points } : null;
  const fmtGk = (x) => x ? { name: x.p.name, team: x.team.name, gp: x.p.stats.gp, wins: x.p.stats.wins, svPct: x.p.stats.shotsAgainst > 0 ? x.p.stats.saves / x.p.stats.shotsAgainst : 0, gaa: x.p.stats.gp > 0 ? x.p.stats.goalsAgainst / x.p.stats.gp : 0, shutouts: x.p.stats.shutouts } : null;
  return { mvp: fmtSk(mvp), topScorer: fmtSk(topScorer), topAssister: fmtSk(topAssister), topPointMan: fmtSk(topPointMan), topDefenseman: fmtSk(topDefenseman), topGoalie: fmtGk(topGoalie), rookieOfYear: fmtSk(rookieOfYear) };
}

/* ============================================================
   СЕНСАЦИЯ / ПРОВАЛ СЕЗОНА
   ============================================================ */
function calculateExpectedPlace(team) {
  if (!team.history || team.history.length === 0) return 16;
  const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
  let sum = 0, totalW = 0;
  const hist = team.history.slice(0, 5);
  for (let i = 0; i < hist.length; i++) {
    const w = weights[i] || 0.05;
    sum += hist[i].place * w;
    totalW += w;
  }
  return totalW > 0 ? sum / totalW : 16;
}
function checkSeasonSurprises() {
  const sorted = standingsSorted();
  const surprises = [];
  for (const team of G.league.teams) {
    const actualPlace = sorted.findIndex(t => t.id === team.id) + 1;
    const expected = calculateExpectedPlace(team);
    const delta = expected - actualPlace;
    if (delta >= 8) {
      surprises.push({ team, type: 'upset', delta, expected, actualPlace });
      if (team.id === G.playerTeamId && G.career) G.career.reputation = clamp(G.career.reputation + 5, 0, 100);
      addNews('season_upset', `${team.name}: сенсация сезона! ${actualPlace}-е место при ожидании ${Math.round(expected)}-го`, 3);
    } else if (delta <= -8) {
      surprises.push({ team, type: 'flop', delta, expected, actualPlace });
      if (team.id === G.playerTeamId && G.career) G.career.reputation = clamp(G.career.reputation - 5, 0, 100);
      addNews('season_flop', `${team.name}: провал сезона. ${actualPlace}-е место при ожидании ${Math.round(expected)}-го`, 3);
    }
  }
  G.league.lastSurprises = surprises;
  return surprises;
}

/* ============================================================
   ПРЕСС-КОНФЕРЕНЦИЯ
   ============================================================ */
function generatePressConference() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const questions = [];
  if (team.streak && team.streak.type === 'l' && team.streak.count >= 2) {
    questions.push({ q: `Команда проигрывает ${team.streak.count} матчей подряд. Как объясните?`,
      answers: [{ label: 'Работаем дальше, не ищем оправданий', morale: 2, fanbase: 0 }, { label: 'Соперники были сильнее', morale: 0, fanbase: -0.01 }, { label: 'Судьи и обстоятельства не в нашу пользу', morale: -2, fanbase: -0.03 }] });
  } else if (team.streak && team.streak.type === 'w' && team.streak.count >= 3) {
    questions.push({ q: `${team.streak.count} побед подряд — в чём секрет?`,
      answers: [{ label: 'Каждый вносит вклад, работаем на максимум', morale: 3, fanbase: 0.02 }, { label: 'Пока рано делать выводы', morale: 0, fanbase: 0 }, { label: 'Соперники попались слабые', morale: -2, fanbase: -0.03 }] });
  } else {
    questions.push({ q: 'Как оцените форму команды?',
      answers: [{ label: 'Идём правильным курсом', morale: 2, fanbase: 0.01 }, { label: 'Есть над чем работать', morale: 0, fanbase: 0 }, { label: 'Разочарован результатом', morale: -1, fanbase: -0.01 }] });
  }
  const stars = team.roster.filter(p => p.ovr >= 78).sort((a, b) => b.ovr - a.ovr).slice(0, 1);
  if (stars.length) {
    questions.push({ q: `Что скажете об игре ${stars[0].name}?`,
      answers: [{ label: 'Полностью доверяю', morale: 2, fanbase: 0.01 }, { label: 'Может больше', morale: 0, fanbase: 0 }, { label: 'Жду большего', morale: -2, fanbase: 0 }] });
  } else {
    questions.push({ q: 'Кто из игроков вас удивил?',
      answers: [{ label: 'Молодёжь прогрессирует', morale: 2, fanbase: 0.01 }, { label: 'Все играют как умеют', morale: 0, fanbase: 0 }, { label: 'Пока никто', morale: -2, fanbase: 0 }] });
  }
  questions.push({ q: 'Где видите команду по итогам сезона?',
    answers: [{ label: 'Боремся за плей-офф', morale: 2, fanbase: 0.01 }, { label: 'Работаем от матча к матчу', morale: 0, fanbase: 0 }, { label: 'Целимся в Кубок Петрова', morale: 3, fanbase: 0.02 }] });
  return { questions, current: 0 };
}
function answerPressQuestion(qIdx, aIdx) {
  const pc = G.pressConference; if (!pc) return;
  const q = pc.questions[qIdx]; const a = q.answers[aIdx];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  for (const p of team.roster) p.morale = clamp(p.morale + a.morale, 20, 100);
  team.finance.fanBase = clamp(team.finance.fanBase + a.fanbase, 0.15, 1.0);
  pc.current++;
  if (pc.current >= pc.questions.length) { G.pressConference = null; render(); } else render();
}
function maybeStartPressConference() {
  if (!G.playerTeamId) return;
  if (G.league.currentRound === 0) return;
  if (G.league.currentRound % 10 !== 0) return;
  if (G.league.currentRound >= G.league.schedule.length) return;
  G.pressConference = generatePressConference();
}

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
   СИМ ТУРА / СЕЗОНА
   ============================================================ */
function simRound(forceNoPrompt = false) {
  if (G.injuryPrompt) return;
  if (!forceNoPrompt && !G.skipInjuryPrompt) {
    const injured = checkInjuredStarters();
    if (injured.length > 0) {
      G.injuryPrompt = { injured: injured.map(p => p.id), choices: {} };
      render();
      return;
    }
  }
  if (forceNoPrompt && G.skipInjuryPrompt) {
    const team = G.league.teams.find(t => t.id === G.playerTeamId);
    if (team) for (const p of team.roster) if (p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) p.injuryPolicy = 'period';
  }
  if (G.league.currentRound >= G.league.schedule.length) return;
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
  generateBoardMessage();
  checkTradeDeadlineNews();
  if (G.league.currentRound === 15 && !G.league.retroMatch) triggerRetroMatch();
  if (G.league.currentRound === G.league.schedule.length) createPlayoffs();
  maybeStartPressConference();
  if (G.playerTeamId) {
    if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; render(); return; } }
    else { if (maybeFirePlayer()) { G.activeTab = 'career'; render(); return; } }
  }
  render();
}
function simSeason() {
  if (G.injuryPrompt) return;
  const injured = checkInjuredStarters();
  if (injured.length > 0) {
    G.injuryPrompt = { injured: injured.map(p => p.id), choices: {} };
    render();
    return;
  }
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
    generateBoardMessage();
    checkTradeDeadlineNews();
    if (G.playerTeamId) {
      if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; render(); return; } }
      else { if (maybeFirePlayer()) { G.activeTab = 'career'; render(); return; } }
    }
  }
  createPlayoffs();
  maybeStartPressConference();
  render();
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
   ПЛЕЙ-ОФФ
   ============================================================ */
function emptySeries() { return { aId: null, bId: null, aWins: 0, bWins: 0, games: [], winnerId: null, injuryPromptShown: false }; }
function pairSeries(a, b) { return { aId: a.id, bId: b.id, aWins: 0, bWins: 0, games: [], winnerId: null, injuryPromptShown: false }; }
function createPlayoffs() {
  const sorted = standingsSorted(); const top16 = sorted.slice(0, 16);
  const pairings = [[0,15],[7,8],[3,12],[4,11],[1,14],[6,9],[2,13],[5,10]];
  const qf = pairings.map(([i, j]) => pairSeries(top16[i], top16[j]));
  G.league.playoffs = { active: true, currentRoundIdx: 0, rounds: [
    { name: '1/8 финала', series: qf },
    { name: '1/4 финала', series: [emptySeries(), emptySeries(), emptySeries(), emptySeries()] },
    { name: '1/2 финала', series: [emptySeries(), emptySeries()] },
    { name: '🏆 Финал', series: [emptySeries()] }
  ], championId: null };
}
function simOnePlayoffGame(series) {
  if (series.winnerId || !series.aId || !series.bId) return;
  if (series.aWins >= 4 || series.bWins >= 4) { series.winnerId = series.aWins > series.bWins ? series.aId : series.bId; return; }
  const gameNum = series.aWins + series.bWins + 1;
  const aHome = [1, 2, 5, 7].includes(gameNum);
  const homeId = aHome ? series.aId : series.bId, awayId = aHome ? series.bId : series.aId;
  const res = simGame(homeId, awayId, true); series.games.push(res);
  const homeTeam = G.league.teams.find(t => t.id === res.homeId);
  const awayTeam = G.league.teams.find(t => t.id === res.awayId);
  if (homeTeam) processMatchdayRevenue(homeTeam, true, awayTeam ? awayTeam.strength : 1.0);
  const homeWon = res.hg > res.ag;
  if (homeId === series.aId) { if (homeWon) series.aWins++; else series.bWins++; } else { if (homeWon) series.bWins++; else series.aWins++; }
  if (series.aWins >= 4 || series.bWins >= 4) {
    series.winnerId = series.aWins > series.bWins ? series.aId : series.bId;
    const teamsIn = [G.league.teams.find(x => x.id === series.aId), G.league.teams.find(x => x.id === series.bId)];
    for (const t of teamsIn) if (t) t.roster.forEach(p => p.playingThroughPain = false);
  }
}
function simSeries(series) { if (series.winnerId || !series.aId || !series.bId) return; let guard = 0; while (series.aWins < 4 && series.bWins < 4 && guard < 10) { simOnePlayoffGame(series); guard++; } }
function advancePlayoffRound() {
  const p = G.league.playoffs; const round = p.rounds[p.currentRoundIdx];
  if (!round.series.every(s => s.winnerId)) return;
  if (p.currentRoundIdx === 0) {
    const [s1, s2, s3, s4, s5, s6, s7, s8] = round.series; const qf = p.rounds[1].series;
    qf[0].aId = s1.winnerId; qf[0].bId = s2.winnerId; qf[1].aId = s3.winnerId; qf[1].bId = s4.winnerId;
    qf[2].aId = s5.winnerId; qf[2].bId = s6.winnerId; qf[3].aId = s7.winnerId; qf[3].bId = s8.winnerId;
  } else if (p.currentRoundIdx === 1) {
    const [s1, s2, s3, s4] = round.series; const sf = p.rounds[2].series;
    sf[0].aId = s1.winnerId; sf[0].bId = s2.winnerId; sf[1].aId = s3.winnerId; sf[1].bId = s4.winnerId;
  } else if (p.currentRoundIdx === 2) {
    const [s1, s2] = round.series; const f = p.rounds[3].series[0];
    f.aId = s1.winnerId; f.bId = s2.winnerId;
  } else if (p.currentRoundIdx === 3) { p.championId = round.series[0].winnerId; return; }
  p.currentRoundIdx++;
}
function checkPlayoffInjuryPrompt() {
  if (!G.playerTeamId || !G.league.playoffs) return false;
  const p = G.league.playoffs;
  const round = p.rounds[p.currentRoundIdx]; if (!round) return false;
  const mySeries = round.series.find(s => (s.aId === G.playerTeamId || s.bId === G.playerTeamId) && !s.injuryPromptShown && !s.winnerId);
  if (!mySeries) return false;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = team.roster.filter(pl => pl.injury && pl.injury.gamesLeft > 0 && pl.status === 'contract');
  if (!injured.length) { mySeries.injuryPromptShown = true; return false; }
  G.playoffInjuryPrompt = { injured: injured.map(pl => pl.id), seriesRef: mySeries };
  mySeries.injuryPromptShown = true;
  return true;
}
function resolvePlayoffInjury(choice) {
  const prompt = G.playoffInjuryPrompt; if (!prompt) return;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  for (const id of prompt.injured) { const p = team.roster.find(x => x.id === id); if (!p) continue; p.playingThroughPain = !!choice[id]; }
  G.playoffInjuryPrompt = null;
  render();
}
function simMyPlayoffMatch() {
  if (G.playoffInjuryPrompt) return;
  if (checkPlayoffInjuryPrompt()) { render(); return; }
  const p = G.league.playoffs; if (!p) return;
  const round = p.rounds[p.currentRoundIdx];
  const mySeries = round.series.find(s => (s.aId === G.playerTeamId || s.bId === G.playerTeamId) && !s.winnerId);
  if (mySeries) simOnePlayoffGame(mySeries);
  render();
}
function simPlayoffRound() {
  if (G.playoffInjuryPrompt) return;
  if (checkPlayoffInjuryPrompt()) { render(); return; }
  const p = G.league.playoffs; const round = p.rounds[p.currentRoundIdx];
  round.series.forEach(s => simSeries(s));
  if (round.series.every(s => s.winnerId)) advancePlayoffRound();
  render();
}
function simPlayoffsAll() {
  if (G.playoffInjuryPrompt) return;
  if (checkPlayoffInjuryPrompt()) { render(); return; }
  const p = G.league.playoffs;
  let guard = 0;
  while (!p.championId && guard < 100) {
    const round = p.rounds[p.currentRoundIdx];
    round.series.forEach(s => simSeries(s));
    if (round.series.every(s => s.winnerId)) advancePlayoffRound();
    else break;
    guard++;
  }
  render();
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
   LIVE MATCH — состояние, движок, штрафы, PP
   ------------------------------------------------------------
   Логика:
   • Период = 1200 игровых секунд, тик = 5 игровых секунд
   • Скорость умножает, сколько игровых секунд проходит за 100мс реального
   • На каждом тике считаем prob(гол) из xG и PP-модификатора
   • На каждом тике независимо считаем prob(штраф)
   • 2 мин PP: если забивают — PP заканчивается
   • 5 мин мажор: играется до конца, даже если забили (но PP-модификатор снимается)
   • На перерыве можно менять тактику → xG пересчитывается для оставшихся периодов
   • ОТ — sudden death: гол в ОТ немедленно завершает матч
   ============================================================ */

const LIVE_PERIOD_SEC = 1200;   // 20 минут = 1200 сек
const LIVE_TICK_SEC = 5;         // 5 игровых секунд за тик
const LIVE_TICK_MS = 80;         // 80 мс реального времени на тик при 1x
const LIVE_PP_BOOST = 2.6;       // xG атакующей в PP × 2.6
const LIVE_PK_NERF  = 0.55;      // xG обороняющейся в PK × 0.55
const LIVE_PENALTY_RATE = 0.0065; // вероятность штрафа на тик на команду (~5.6 штрафов/матч)

function isMyGameInRound() {
  if (!G.playerTeamId) return null;
  if (G.league.currentRound >= G.league.schedule.length) return null;
  const round = G.league.schedule[G.league.currentRound];
  return round.find(([h, a]) => h === G.playerTeamId || a === G.playerTeamId) || null;
}

function startMyLiveMatch() {
  const myGame = isMyGameInRound();
  if (!myGame) { alert('В этом туре у твоей команды нет матча'); return; }
  if (G.liveMatch) return;
  startLiveMatch(myGame[0], myGame[1], false);
}

function startLiveMatch(homeId, awayId, isPlayoff) {
  const home = G.league.teams.find(t => t.id === homeId);
  const away = G.league.teams.find(t => t.id === awayId);
  if (!home || !away) return;
  advanceInjuries(home); advanceInjuries(away);
  const homeLineup = getLineup(home), awayLineup = getLineup(away);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);

  const positions = { home: [], away: [], puck: { x: 100, y: 50, vx: 0, vy: 0 } };
  const formHome = buildFormation('home');
  const formAway = buildFormation('away');
  positions.home = formHome;
  positions.away = formAway;

  G.liveMatch = {
    homeId, awayId, isPlayoff: !!isPlayoff,
    hg: 0, ag: 0,
    period: 1,
    timeLeft: LIVE_PERIOD_SEC,
    totalSecPlayed: 0,
    paused: false,
    speed: 1,
    events: [],
    pbp: [],
    penalties: { home: [], away: [] },
    shots: { home: 0, away: 0 },
    xgTotal: { home: xgH, away: xgA },
    xgCurrent: { home: xgH, away: xgA },
    homeLineup, awayLineup, hTM, aTM,
    scorers: {},
    assisters: {},
    goalieStats: {
      home: { shots: 0, goals: 0 },
      away: { shots: 0, goals: 0 },
    },
    positions,
    isBreak: false,
    isFinished: false,
    ot: false,
    periodStarts: [0],
    lastGoalSide: null,
    goalFlashUntil: 0,
    intervalId: null,
  };

  livePushEvent({ type: 'period', text: `Период 1`, time: '20:00', period: 1 });
  G.liveMatch.pbp.push({ period: 1, time: '—', type: 'period', text: 'Период 1' });

  G.liveMatch.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  render();
}

function buildFormation(side) {
  const x = (a) => side === 'home' ? a : 200 - a;
  const slots = [
    { x: x(35),  y: 50, role: 'goalie' },
    { x: x(70),  y: 30, role: 'D' },
    { x: x(70),  y: 70, role: 'D' },
    { x: x(130), y: 25, role: 'F' },
    { x: x(140), y: 50, role: 'C' },
    { x: x(130), y: 75, role: 'F' },
  ];
  return slots.map((s, i) => ({ ...s, idx: i, baseX: s.x, baseY: s.y, x: s.x, y: s.y, vx: 0, vy: 0 }));
}

function livePushEvent(ev) {
  if (!G.liveMatch) return;
  G.liveMatch.events.unshift(ev);
  if (G.liveMatch.events.length > 80) G.liveMatch.events.pop();
  if (ev.type !== 'period' && ev.type !== 'shot') {
    G.liveMatch.pbp.push({ period: ev.period, time: ev.time, type: ev.type, text: ev.text });
  } else if (ev.type === 'shot' || ev.type === 'goal') {
    G.liveMatch.pbp.push({ period: ev.period, time: ev.time, type: ev.type, text: ev.text });
  }
}

function liveFmtTime(secLeft) {
  const m = Math.floor(secLeft / 60);
  const s = secLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function liveGetActivePenalties(side) {
  if (!G.liveMatch) return [];
  const t = G.liveMatch.totalSecPlayed;
  return G.liveMatch.penalties[side].filter(p => p.endsAt > t);
}

function liveIsPP(side) {
  const opp = side === 'home' ? 'away' : 'home';
  return liveGetActivePenalties(opp).length > 0;
}

function liveTick() {
  const lm = G.liveMatch;
  if (!lm || lm.paused || lm.isBreak || lm.isFinished) return;
  const tickSec = LIVE_TICK_SEC * lm.speed;
  let remaining = tickSec;
  while (remaining > 0 && !lm.isFinished && !lm.isBreak) {
    const step = Math.min(LIVE_TICK_SEC, remaining);
    remaining -= step;
    liveAdvance(step);
    if (lm.isFinished || lm.isBreak) break;
  }
  if (typeof drawLiveCanvas === 'function') drawLiveCanvas();
  if (typeof updateLiveClock === 'function') updateLiveClock();
}

function liveAdvance(stepSec) {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const tBefore = lm.totalSecPlayed;
  const tNow = tBefore + stepSec;
  for (const side of ['home', 'away']) {
    lm.penalties[side] = lm.penalties[side].filter(p => p.endsAt > tNow);
  }

  const homePP = liveIsPP('home');
  const awayPP = liveIsPP('away');

  const hXg = lm.xgCurrent.home;
  const aXg = lm.xgCurrent.away;

  let hMod = 1, aMod = 1;
  if (homePP) { hMod *= LIVE_PP_BOOST; aMod *= LIVE_PK_NERF; }
  if (awayPP) { aMod *= LIVE_PP_BOOST; hMod *= LIVE_PK_NERF; }

  const pH = hXg * hMod * (stepSec / 3600);
  const pA = aXg * aMod * (stepSec / 3600);

  const rGoal = rng();
  if (rGoal < pH) { liveGoal('home'); if (lm.isFinished) return; }
  else if (rGoal < pH + pA) { liveGoal('away'); if (lm.isFinished) return; }
  else {
    const rPen = rng();
    if (rPen < LIVE_PENALTY_RATE * 2) {
      livePenalty('home');
    } else if (rPen < LIVE_PENALTY_RATE * 4) {
      livePenalty('away');
    } else {
      const rShot = rng();
      if (rShot < 0.6) {
        lm.shots.home++;
        lm.goalieStats.away.shots++;
        const p = pickWeighted(lm.homeLineup.skaters, shotWeight);
        const isPlayoff = lm.isPlayoff;
        (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).shots++;
        livePushEvent({ type: 'shot', text: `${p.name} (${p.position}) бросает — ${pick(['сейв','сейв','сейв','мимо','штанга'])}.`, time: liveFmtTime(lm.timeLeft), period: lm.period });
      }
    }
  }

  lm.timeLeft -= stepSec;
  lm.totalSecPlayed = tNow;
  if (lm.timeLeft <= 0) {
    liveEndPeriod();
  }
}

function liveGoal(side) {
  const lm = G.liveMatch;
  if (!lm) return;
  const scoringLineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
  const concedingLineup = side === 'home' ? lm.awayLineup : lm.homeLineup;
  const isPlayoff = lm.isPlayoff;
  const scorer = pickWeighted(scoringLineup.skaters, scorerWeight);

  const sStat = isPlayoff ? ensurePlayoffStats(scorer) : ensureStats(scorer);
  sStat.goals++; sStat.shots++; sStat.points++;
  if (!isPlayoff && (sStat.points === 50 || sStat.points === 100 || sStat.points === 150 || sStat.points === 200)) {
    addNews('milestone', `${scorer.name} набрал ${sStat.points}-е очко в сезоне`, 3);
  }

  const numAssists = rng() < 0.12 ? 0 : rng() < 0.35 ? 1 : 2;
  const assistPool = scoringLineup.skaters.filter(p => p.id !== scorer.id);
  const assisters = [];
  for (let i = 0; i < numAssists && assistPool.length > 0; i++) {
    const a = pickWeighted(assistPool, assistWeight);
    assisters.push(a);
    const aStat = isPlayoff ? ensurePlayoffStats(a) : ensureStats(a);
    aStat.assists++; aStat.points++;
    assistPool.splice(assistPool.indexOf(a), 1);
  }

  if (side === 'home') lm.hg++; else lm.ag++;
  lm.goalieStats[side === 'home' ? 'away' : 'home'].goals++;
  lm.shots[side]++;
  lm.goalieStats[side === 'home' ? 'away' : 'home'].shots++;
  lm.lastGoalSide = side;
  lm.goalFlashUntil = Date.now() + 1200;

  if (liveIsPP(side)) {
    const oppSide = side === 'home' ? 'away' : 'home';
    for (const p of lm.penalties[oppSide]) {
      if (p.endsAt > lm.totalSecPlayed && p.type === '2' && !p.scoredDuringPP) {
        p.endsAt = lm.totalSecPlayed;
      } else if (p.type === '5') {
        p.scoredDuringPP = true;
      }
    }
    lm.penalties[oppSide] = lm.penalties[oppSide].filter(p => p.endsAt > lm.totalSecPlayed);
  }

  const onIceScoring = new Set([scorer.id, ...assisters.map(a => a.id)]);
  while (onIceScoring.size < 5 && onIceScoring.size < scoringLineup.skaters.length) onIceScoring.add(pickWeighted(scoringLineup.skaters, x => x.ovr).id);
  for (const p of scoringLineup.skaters) if (onIceScoring.has(p.id)) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus++;
  for (const p of concedingLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).plusMinus--;

  lm.scorers[scorer.id] = (lm.scorers[scorer.id] || 0) + 1;
  for (const a of assisters) lm.assisters[a.id] = (lm.assisters[a.id] || 0) + 1;

  const assistNames = assisters.map(a => a.name).join(', ');
  const sideName = side === 'home' ? G.league.teams.find(t => t.id === lm.homeId).name : G.league.teams.find(t => t.id === lm.awayId).name;
  const txt = `ГОЛ! ${scorer.name} (${scorer.position})${assisters.length ? ` — ассист: ${assistNames}` : ''} [${sideName}]`;
  livePushEvent({ type: 'goal', text: txt, time: liveFmtTime(lm.timeLeft), period: lm.period });

  const goalX = side === 'home' ? 195 : 5;
  lm.positions.puck.x = goalX;
  lm.positions.puck.y = 50;

  // ⚙️ ФИКС #2: sudden death в ОТ — гол немедленно завершает матч
  if (lm.period === 4) {
    lm.isFinished = true;
    if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
    finishLiveMatch();
    return;
  }
}

function livePenalty(side) {
  const lm = G.liveMatch;
  const lineup = side === 'home' ? lm.homeLineup : lm.awayLineup;
  if (!lineup.skaters.length) return;
  const p = pick(lineup.skaters);
  const isMajor = rng() < 0.12;
  const duration = isMajor ? 300 : 120;
  const type = isMajor ? '5' : '2';
  const isPlayoff = lm.isPlayoff;
  (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).pim += isMajor ? 5 : 2;
  lm.penalties[side].push({
    playerId: p.id, playerName: p.name,
    endsAt: lm.totalSecPlayed + duration,
    type,
    scoredDuringPP: false,
  });
  const reason = isMajor ? pick(['удар в голову','драка','атака вратаря']) : pick(['задержка','подножка','грубость','толчок','удар соперника']);
  const sideName = side === 'home' ? G.league.teams.find(t => t.id === lm.homeId).name : G.league.teams.find(t => t.id === lm.awayId).name;
  livePushEvent({
    type: 'penalty',
    text: `${isMajor ? '5 мин (мажор)' : '2 мин'}: ${p.name} (${p.position}) [${sideName}] — ${reason}.`,
    time: liveFmtTime(lm.timeLeft), period: lm.period,
  });
}

function liveEndPeriod() {
  const lm = G.liveMatch;
  if (!lm || lm.isFinished) return;
  const isLast = lm.period >= 3;
  const tied = lm.hg === lm.ag;
  if (isLast && !tied) {
    lm.isFinished = true;
    finishLiveMatch();
    return;
  }
  if (isLast && tied) {
    // ⚙️ ФИКС #2: если ОТ уже сыгран и снова ничья — финиш (в реальности буллиты)
    if (lm.period === 4) {
      lm.isFinished = true;
      finishLiveMatch();
      return;
    }
    lm.period = 4;
    lm.timeLeft = 300;
    lm.ot = true;
    livePushEvent({ type: 'period', text: 'Овертайм', time: '05:00', period: 4 });
    lm.pbp.push({ period: 4, time: '—', type: 'period', text: 'Овертайм' });
    lm.periodStarts.push(lm.totalSecPlayed);
    return;
  }
  lm.isBreak = true;
  lm.paused = true;
  // ⚙️ ФИКС #14: чистим интервал на перерыве (не жечь CPU)
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
}

function liveResumeFromBreak() {
  const lm = G.liveMatch;
  if (!lm) return;
  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const hTM = tacticMods(home.tactics, home), aTM = tacticMods(away.tactics, away);
  const { xgH, xgA } = computeXG(home, away, hTM, aTM);
  lm.xgCurrent.home = xgH;
  lm.xgCurrent.away = xgA;
  lm.hTM = hTM; lm.aTM = aTM;
  lm.period++;
  lm.timeLeft = lm.period === 4 ? 300 : LIVE_PERIOD_SEC;
  lm.periodStarts.push(lm.totalSecPlayed);
  lm.isBreak = false;
  lm.paused = false;
  // ⚙️ ФИКС #14: перезапускаем интервал
  if (!lm.intervalId && !lm.isFinished) {
    lm.intervalId = setInterval(liveTick, LIVE_TICK_MS);
  }
  livePushEvent({ type: 'period', text: lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`, time: lm.period === 4 ? '05:00' : '20:00', period: lm.period });
  lm.pbp.push({ period: lm.period, time: '—', type: 'period', text: lm.period === 4 ? 'Овертайм' : `Период ${lm.period}` });
  render();
}

function finishLiveMatch() {
  const lm = G.liveMatch;
  if (!lm) return;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }
  lm.isFinished = true;

  const res = {
    homeId: lm.homeId, awayId: lm.awayId,
    hg: lm.hg, ag: lm.ag, ot: lm.ot,
    pbp: lm.pbp.slice(),
    round: G.league.currentRound,
  };

  const home = G.league.teams.find(t => t.id === lm.homeId);
  const away = G.league.teams.find(t => t.id === lm.awayId);
  const isPlayoff = lm.isPlayoff;
  if (lm.awayLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.awayLineup.goalie) : ensureStats(lm.awayLineup.goalie);
    s.gp++; s.shotsAgainst += lm.shots.home; s.goalsAgainst += lm.hg; s.saves += Math.max(0, lm.shots.home - lm.hg);
    if (lm.hg === 0) s.shutouts++;
    if (lm.hg < lm.ag) s.wins++; else if (lm.hg > lm.ag) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) {
    const s = isPlayoff ? ensurePlayoffStats(lm.homeLineup.goalie) : ensureStats(lm.homeLineup.goalie);
    s.gp++; s.shotsAgainst += lm.shots.away; s.goalsAgainst += lm.ag; s.saves += Math.max(0, lm.shots.away - lm.ag);
    if (lm.ag === 0) s.shutouts++;
    if (lm.ag < lm.hg) s.wins++; else if (lm.ag > lm.hg) { if (lm.ot) s.otl++; else s.losses++; }
  }
  if (lm.homeLineup.goalie) updateGoalieStatus(home, lm.homeLineup.goalie, lm.ag, lm.shots.away);
  if (lm.awayLineup.goalie) updateGoalieStatus(away, lm.awayLineup.goalie, lm.hg, lm.shots.home);
  for (const p of lm.homeLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;
  for (const p of lm.awayLineup.skaters) (isPlayoff ? ensurePlayoffStats(p) : ensureStats(p)).gp++;

  checkInjuries(home, lm.homeLineup); checkInjuries(away, lm.awayLineup);
  updateFatigue(home, lm.homeLineup); updateFatigue(away, lm.awayLineup);
  updateFormMorale(home, lm.homeLineup, lm.hg > lm.ag); updateFormMorale(away, lm.awayLineup, lm.ag > lm.hg);
  updateLineChemistry(home, lm.hg > lm.ag, lm.homeLineup); updateLineChemistry(away, lm.ag > lm.hg, lm.awayLineup);

  if (!isPlayoff) {
    updateFanbase(home, lm.hg > lm.ag); updateFanbase(away, lm.ag > lm.hg);
    const homeExpected = fanExpectation(home, away, true);
    const awayExpected = fanExpectation(away, home, false);
    applyFanExpectation(home, homeExpected, lm.hg > lm.ag, true);
    applyFanExpectation(away, awayExpected, lm.ag > lm.hg, false);
  }

  home._lastPlayedIds = [...lm.homeLineup.skaters, lm.homeLineup.goalie].filter(Boolean).map(p => p.id);
  away._lastPlayedIds = [...lm.awayLineup.skaters, lm.awayLineup.goalie].filter(Boolean).map(p => p.id);
  processTryouts(home); processTryouts(away);
  for (const team of [home, away]) if (team.staff.psychologist) for (const p of team.roster) p.morale = clamp(p.morale + 1, 20, 100);

  applyResult(res);
  G.league.results.push(res);

  if (!isPlayoff) {
    const round = G.league.schedule[G.league.currentRound];
    const others = round.filter(([h, a]) => !(h === lm.homeId && a === lm.awayId) && !(h === lm.awayId && a === lm.homeId));
    others.forEach(([h, a]) => {
      if (h === G.playerTeamId || a === G.playerTeamId) return;
      const r = simGame(h, a, false); r.round = G.league.currentRound; applyResult(r); G.league.results.push(r);
    });
    G.league.currentRound++;
    G.league.teams.forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); });
    if (G.league.currentRound % 10 === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
    if (G.league.currentRound % 3 === 0) processWaivers();
    if (G.league.currentRound % 4 === 0) runAIActions();
    if (G.league.currentRound % 8 === 0) updateStaffPool();
    if (G.league.currentRound % 3 === 0 && rng() < 0.3) generateRandomEvent();
    G.league.teams.forEach(t => checkScoutMission(t));
    generateBoardMessage();
    checkTradeDeadlineNews();
    if (G.league.currentRound === 15 && !G.league.retroMatch) triggerRetroMatch();
    if (G.league.currentRound === G.league.schedule.length) createPlayoffs();
    maybeStartPressConference();
    if (G.playerTeamId) {
      if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; G.liveMatch = null; render(); return; } }
      else { if (maybeFirePlayer()) { G.activeTab = 'career'; G.liveMatch = null; render(); return; } }
    }
  }

  render();
}

function exitLiveMatchEarly() {
  const lm = G.liveMatch;
  if (!lm) return;
  if (lm.intervalId) { clearInterval(lm.intervalId); lm.intervalId = null; }

  // ⚙️ ФИКС #3: корректный расчёт остатка времени
  // — если в ОТ: только остаток текущего ОТ
  // — если в регуляке: остаток текущего периода + все оставшиеся периоды
  const remInCurrent = Math.max(0, lm.timeLeft);
  const periodNow = lm.period;
  let totalRemSec;
  if (periodNow === 4) {
    totalRemSec = remInCurrent;
  } else {
    totalRemSec = remInCurrent + (3 - periodNow) * LIVE_PERIOD_SEC;
  }

  const hXg = lm.xgCurrent.home, aXg = lm.xgCurrent.away;
  const addH = poisson(hXg * totalRemSec / 3600);
  const addA = poisson(aXg * totalRemSec / 3600);
  lm.hg += addH; lm.ag += addA;
  // добавляем броски пропорционально голам, чтобы не сломать SV% совсем уж грубо
  lm.shots.home += addH;
  lm.shots.away += addA;

  // Если после регуляки всё ещё ничья — ОТ (или буллиты, если ОТ не помог)
  if (lm.hg === lm.ag && periodNow < 4) {
    lm.ot = true;
    const otH = poisson(hXg * (300 / 3600));
    const otA = poisson(aXg * (300 / 3600));
    lm.hg += otH; lm.ag += otA;
    lm.shots.home += otH;
    lm.shots.away += otA;
    if (lm.hg === lm.ag) {
      if (rng() < 0.5) lm.hg++; else lm.ag++;
    }
  }

  finishLiveMatch();
}

function closeLiveMatchModal() {
  if (!G.liveMatch) return;
  if (G.liveMatch.intervalId) { clearInterval(G.liveMatch.intervalId); G.liveMatch.intervalId = null; }
  G.liveMatch = null;
  render();
}

/* ============================================================
   LIVE — CANVAS RENDER + UI SCREEN
   ============================================================ */
let _liveCanvasEl = null;
let _liveRafId = null;

function drawLiveCanvas() {
  const lm = G.liveMatch;
  if (!lm) return;
  let canvas = document.getElementById('live-canvas');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (wrap && wrap.clientWidth > 0) {
    const targetW = wrap.clientWidth - 24;
    const targetH = Math.round(targetW * 0.5);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  if (!W || !H) return;

  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);

  const vx = (x) => (x / 200) * W;
  const vy = (y) => (y / 100) * H;

  ctx.fillStyle = '#e8eef8';
  ctx.fillRect(vx(3), vy(3), vx(197) - vx(3), vy(97) - vy(3));

  ctx.strokeStyle = '#b8c4d8';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(vx(100), vy(3)); ctx.lineTo(vx(100), vy(97)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(vx(60), vy(3)); ctx.lineTo(vx(60), vy(97)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(vx(140), vy(3)); ctx.lineTo(vx(140), vy(97)); ctx.stroke();
  ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
  const faceCircles = [
    { x: 30, y: 30 }, { x: 30, y: 70 }, { x: 70, y: 30 }, { x: 70, y: 70 },
    { x: 130, y: 30 }, { x: 130, y: 70 }, { x: 170, y: 30 }, { x: 170, y: 70 },
  ];
  for (const c of faceCircles) {
    ctx.beginPath();
    ctx.arc(vx(c.x), vy(c.y), Math.min(vx(8) - vx(0), vy(16) - vy(0)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(vx(100), vy(50), Math.min(vx(10) - vx(0), vy(20) - vy(0)), 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = '#ef4444';
  ctx.fillRect(vx(2), vy(42), vx(6) - vx(2), vy(58) - vy(42));
  ctx.fillRect(vx(194), vy(42), vx(198) - vx(194), vy(58) - vy(42));
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5;
  ctx.strokeRect(vx(3), vy(3), vx(197) - vx(3), vy(97) - vy(3));

  ctx.fillStyle = 'rgba(15,17,23,0.15)';
  ctx.font = `bold ${Math.max(10, Math.round(W / 60))}px -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  const homeTeam = G.league.teams.find(t => t.id === lm.homeId);
  const awayTeam = G.league.teams.find(t => t.id === lm.awayId);
  if (homeTeam) ctx.fillText(homeTeam.shortName || homeTeam.name, vx(8), vy(12));
  ctx.textAlign = 'right';
  if (awayTeam) ctx.fillText(awayTeam.shortName || awayTeam.name, vx(192), vy(12));

  const drawPlayer = (p, side) => {
    const x = vx(p.x), y = vy(p.y);
    const r = Math.max(5, Math.round(W / 100));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (p.role === 'goalie') {
      ctx.fillStyle = side === 'home' ? '#ff6b35' : '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = '#0f1117';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = side === 'home' ? '#ff6b35' : '#60a5fa';
      ctx.fill();
      ctx.strokeStyle = '#0f1117';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  };

  for (const p of lm.positions.home) drawPlayer(p, 'home');
  for (const p of lm.positions.away) drawPlayer(p, 'away');

  const puckX = vx(lm.positions.puck.x);
  const puckY = vy(lm.positions.puck.y);
  ctx.beginPath();
  ctx.arc(puckX, puckY, Math.max(3, Math.round(W / 160)), 0, Math.PI * 2);
  ctx.fillStyle = '#0f1117';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (lm.goalFlashUntil > Date.now()) {
    const alpha = clamp((lm.goalFlashUntil - Date.now()) / 1200, 0, 1);
    ctx.fillStyle = `rgba(74,222,128,${alpha * 0.35})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = 'rgba(15,17,23,0.4)';
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.max(10, Math.round(W / 70))}px -apple-system, sans-serif`;
  ctx.fillText(`Период ${lm.period}`, vx(100), vy(95));
}

function updateLiveClock() {
  const lm = G.liveMatch;
  if (!lm) return;
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = liveFmtTime(Math.max(0, Math.ceil(lm.timeLeft)));
  const periodEl = document.getElementById('live-period-info');
  if (periodEl) {
    let txt = lm.period === 4 ? 'Овертайм' : `Период ${lm.period}`;
    if (lm.isBreak) txt += ' — перерыв';
    if (lm.isFinished) txt += ' — матч завершён';
    periodEl.textContent = txt;
  }
  const homeScoreEl = document.getElementById('live-score-home');
  const awayScoreEl = document.getElementById('live-score-away');
  if (homeScoreEl) homeScoreEl.textContent = lm.hg;
  if (awayScoreEl) awayScoreEl.textContent = lm.ag;

  const ppEl = document.getElementById('live-pp-banner');
  if (ppEl) {
    const hp = liveGetActivePenalties('home');
    const ap = liveGetActivePenalties('away');
    const parts = [];
    if (hp.length) parts.push(`${awayTeamNameShort()} в большинстве (${hp.map(p => p.type + ' мин').join(', ')})`);
    if (ap.length) parts.push(`${homeTeamNameShort()} в большинстве (${ap.map(p => p.type + ' мин').join(', ')})`);
    if (parts.length) { ppEl.textContent = '⚠ ' + parts.join(' · '); ppEl.style.display = 'block'; }
    else ppEl.style.display = 'none';
  }

  const feedEl = document.getElementById('live-feed');
  if (feedEl) {
    const html = lm.events.slice(0, 30).map(ev => {
      const cls = ev.type === 'goal' ? 'goal' : ev.type === 'penalty' ? 'penalty' : ev.type === 'period' ? 'period' : 'shot';
      return `<div class="live-feed-item ${cls}"><span class="lfi-time">[${ev.time || '—'}]</span>${ev.text}</div>`;
    }).join('');
    if (feedEl.dataset.sig !== String(lm.events.length) + '|' + (lm.events[0]?.text || '')) {
      feedEl.innerHTML = html;
      feedEl.dataset.sig = String(lm.events.length) + '|' + (lm.events[0]?.text || '');
    }
  }
}

function homeTeamNameShort() {
  if (!G.liveMatch) return '';
  const t = G.league.teams.find(x => x.id === G.liveMatch.homeId);
  return t ? (t.shortName || t.name) : '';
}
function awayTeamNameShort() {
  if (!G.liveMatch) return '';
  const t = G.league.teams.find(x => x.id === G.liveMatch.awayId);
  return t ? (t.shortName || t.name) : '';
}

function liveUpdatePositions() {
  const lm = G.liveMatch;
  if (!lm) return;
  const puck = lm.positions.puck;
  const drift = (p) => {
    p.vx += (rng() - 0.5) * 0.3;
    p.vy += (rng() - 0.5) * 0.3;
    p.vx += (p.baseX - p.x) * 0.02;
    p.vy += (p.baseY - p.y) * 0.02;
    const dx = puck.x - p.x, dy = puck.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 40 && p.role !== 'goalie') {
      p.vx += dx * 0.02;
      p.vy += dy * 0.02;
    }
    p.vx = clamp(p.vx, -1.2, 1.2);
    p.vy = clamp(p.vy, -1.2, 1.2);
    p.x += p.vx;
    p.y += p.vy;
    p.x = clamp(p.x, 5, 195);
    p.y = clamp(p.y, 5, 95);
  };
  lm.positions.home.forEach(drift);
  lm.positions.away.forEach(drift);
  puck.x += (100 - puck.x) * 0.01;
  puck.y += (50 - puck.y) * 0.01;
}

function liveAnimationLoop() {
  if (!G.liveMatch) { _liveRafId = null; return; }
  const lm = G.liveMatch;
  if (!lm.paused && !lm.isBreak && !lm.isFinished) {
    liveUpdatePositions();
    drawLiveCanvas();
  }
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function startLiveAnimation() {
  if (_liveRafId) return;
  _liveRafId = requestAnimationFrame(liveAnimationLoop);
}
function stopLiveAnimation() {
  if (_liveRafId) { cancelAnimationFrame(_liveRafId); _liveRafId = null; }
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
   UI — ВЫБОР КЛУБА / ХЕДЕР / ТАБЫ
   ============================================================ */
function getInitials(name) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase(); }
function getTeamRatings(team) { return team.ratings || { att: 70, def: 70, gk: 70, st: 70 }; }
function logoHeader(team) {
  const initials = getInitials(team.name);
  if (team.logo) return `<img src="${team.logo}" class="team-logo-header" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="team-logo-fallback-small" style="display:none">${initials}</span>`;
  return `<span class="team-logo-fallback-small">${initials}</span>`;
}
function logoTiny(team) {
  const initials = getInitials(team.name);
  if (team.logo) return `<img src="${team.logo}" class="team-logo-tiny" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span class="team-logo-fallback-tiny" style="display:none">${initials}</span>`;
  return `<span class="team-logo-fallback-tiny">${initials}</span>`;
}

function renderTeamSelect() {
  const selDiff = G.selectedDifficulty || 'normal';
  const diffCards = Object.entries(DIFFICULTIES).map(([key, d]) => `
    <div class="difficulty-card ${selDiff === key ? 'selected' : ''}" onclick="G.selectedDifficulty='${key}'; render();">
      <div class="d-title">${d.label}</div>
      <div class="d-desc">${d.desc}</div>
    </div>
  `).join('');
  const teams = G.league.teams.slice().sort((a, b) => b.talent - a.talent);
  const cards = teams.map(t => {
    const trendDef = { up: '↗', down: '↘', stable: '→', newcomer: '🆕' };
    const logoImg = t.logo
      ? `<img src="${t.logo}" style="width:36px;height:36px;object-fit:contain;vertical-align:middle;margin-right:8px" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"><span style="display:none;width:36px;height:36px;background:linear-gradient(135deg,#ff6b35,#fbbf24);color:#0f1117;border-radius:6px;align-items:center;justify-content:center;font-weight:900;font-size:12px;vertical-align:middle;margin-right:8px">${getInitials(t.name)}</span>`
      : `<span style="display:inline-flex;width:36px;height:36px;background:linear-gradient(135deg,#ff6b35,#fbbf24);color:#0f1117;border-radius:6px;align-items:center;justify-content:center;font-weight:900;font-size:12px;vertical-align:middle;margin-right:8px">${getInitials(t.name)}</span>`;
    return `<div class="team-card" data-team-id="${t.id}">
      <div class="t-name">${logoImg}${t.name}</div>
      <div class="t-city">${t.city} · ${t.region} ${trendDef[t.trend] || ''}</div>
      <div class="t-budget">
        Talent: <b style="color:#4ade80">${t.talent.toFixed(1)}</b> · Prestige: <b style="color:#fbbf24">${t.prestige}</b><br>
        Бюджет: ${t.finance.seasonBudget} млн ₽<br>
        Арена: ${t.finance.arenaCapacity.toLocaleString()}
      </div>
    </div>`;
  }).join('');
  return `<div class="topbar"><div><h1>🏒 ВХЛ — Выбор клуба</h1><div class="subtitle">Сначала выбери сложность, потом клуб</div></div></div>
    <h2>Уровень сложности</h2>
    <div class="difficulty-grid">${diffCards}</div>
    <label class="no-fire-checkbox"><input type="checkbox" ${G.noFireMode ? 'checked' : ''} onchange="G.noFireMode=this.checked; render();"> 🚫 Режим «без увольнения» (совет не может уволить)</label>
    <h2>Клуб</h2>
    <div class="team-grid">${cards}</div>`;
}
function bindTeamSelect() {
  document.querySelectorAll('.team-card').forEach(el => {
    el.onclick = () => {
      G.difficulty = DIFFICULTIES[G.selectedDifficulty || 'normal'];
      G.career = G.career || {};
      G.career.noFireMode = G.noFireMode || false;
      G.career.reputation = G.difficulty.startReputation;
      G.career.history = G.career.history || [];
      G.playerTeamId = Number(el.dataset.teamId);
      G.league.teams.forEach(t => {
        t.finance.salaryCap = Math.round(t.finance.seasonBudget * G.difficulty.salaryCapPct);
      });
      G.injuryPrompt = null;
      G.skipInjuryPrompt = false;
      G.openingCupModal = null;
      G.tradeTargetTeamId = null;
      G.screen = 'game';
      initAISponsors();
      render();
    };
  });
}

function renderHeader() {
  if (!G.playerTeamId) {
    const rep = G.career?.reputation ?? 50;
    return `<div class="topbar"><div><h1>💼 Свободный агент</h1><div class="subtitle">Репутация: <b>${Math.round(rep)}/100</b>${G.career?.lastTeamName ? ` · Последний клуб: ${G.career.lastTeamName}` : ''}</div></div><div><button class="btn danger" onclick="if(confirm('Начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
  }
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const playerSal = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const staffSal = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  const r = team.record; const myRank = standingsSorted().findIndex(t => t.id === G.playerTeamId) + 1;
  const bal = team.finance.balance;
  const injured = team.roster.filter(p => p.injury && p.injury.gamesLeft > 0).length;
  const offers = (G.league.aiTradeOffers || []).length;
  const unread = unreadInboxCount();
  const rep = G.career?.reputation ?? 50;
  const diffLabel = G.difficulty?.label || '🟡 Средний';
  const streakTxt = team.streak && team.streak.count >= 2 ? ` · ${team.streak.type === 'w' ? '🔥' : '❄️'} ${team.streak.count}` : '';
  const noFireTxt = G.career?.noFireMode ? ' · 🚫' : '';
  return `<div class="topbar"><div><h1 style="display:flex;align-items:center">${logoHeader(team)}${team.name}</h1><div class="subtitle">Сезон ${G.league.season} · ${diffLabel}${noFireTxt} · ${r.w}-${r.l}-${r.otl} · ${r.pts} очк. · #${myRank} · ЗП: ${Math.round(playerSal + staffSal)}/${team.finance.salaryCap} · Баланс: <b style="color:${bal >= 0 ? '#4ade80' : '#ef4444'}">${Math.round(bal)} млн ₽</b> · Реп: ${Math.round(rep)}/100${injured ? ` · 🚑 ${injured}` : ''}${offers ? ` · 💼 ${offers}` : ''}${unread ? ` · ✉ ${unread}` : ''}${streakTxt}</div></div><div><button class="btn secondary" onclick="if(confirm('Сбросить и начать заново?')) newGame()">🔄 Новая игра</button></div></div>`;
}
function renderTabs() {
  const unread = unreadInboxCount();
  const tabs = [
    { key: 'standings', label: 'Таблица' }, { key: 'games', label: 'Матчи' }, { key: 'calendar', label: 'Календарь' },
    { key: 'roster', label: 'Состав' }, { key: 'lines', label: 'Звенья' }, { key: 'stats', label: 'Статистика' },
    { key: 'market', label: 'Рынок' }, { key: 'trades', label: 'Обмены' }, { key: 'waivers', label: 'Драфт отказов' },
    { key: 'inbox', label: `📬 Почта${unread ? ` <span class="inbox-badge">${unread}</span>` : ''}` },
    { key: 'news', label: '📰 Новости' },
    { key: 'tactics', label: 'Тактика' }, { key: 'training', label: 'Тренировки' }, { key: 'staff', label: 'Штаб' },
    { key: 'infrastructure', label: 'Инфраструктура' }, { key: 'academy', label: 'Академия' },
    { key: 'finance', label: 'Финансы' }, { key: 'career', label: '💼 Карьера' },
    { key: 'playoffs', label: 'Плей-офф' }, { key: 'history', label: 'История' },
  ];
  return `<div id="tabs">${tabs.map(t => `<button class="tab ${G.activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}</div>`;
}

/* ============================================================
   ТАБЛИЦА / МАТЧИ / КАЛЕНДАРЬ
   ============================================================ */
function renderStandings() {
  const sorted = standingsSortedByUI(); const done = G.league.currentRound >= G.league.schedule.length;
  const progress = (G.league.currentRound / G.league.schedule.length) * 100;
  let controls;
  if (done) {
    const p = G.league.playoffs;
    const regularChampion = standingsSorted()[0];
    const rc = `<div class="regular-champion">🥇 Кубок Чемпиона России: ${regularChampion.name}</div>`;
    if (p && p.championId) { const champ = G.league.teams.find(t => t.id === p.championId); controls = rc + `<div class="champion">🏆 Кубок Петрова: ${champ.name}</div><button class="btn" onclick="endSeason()">▶ Новый сезон</button>`; }
    else controls = rc + `<div class="subtitle">Регулярка завершена.</div>`;
  } else {
    const myGame = isMyGameInRound();
    const liveBtn = myGame
      ? `<button class="btn" onclick="startMyLiveMatch()">▶ Live-матч</button>`
      : '';
    controls = `<div class="progress-bar"><div style="width:${progress}%"></div></div><div class="subtitle">Тур ${G.league.currentRound + 1} из ${G.league.schedule.length}${myGame ? ' · твой матч в этом туре' : ''}</div>${liveBtn}<button class="btn secondary" onclick="simRound()">Симулировать тур</button><button class="btn secondary" onclick="simSeason()">Симулировать сезон</button>`;
  }
  const sh = (key, label) => {
    const isActive = G.standingsSort.key === key;
    const arrow = isActive ? (G.standingsSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th onclick="event.stopPropagation(); G.standingsSort={key:'${key}',dir:G.standingsSort.key==='${key}'&&G.standingsSort.dir==='desc'?'asc':'desc'};render();" style="cursor:pointer;${isActive ? 'color:#ff6b35' : ''}">${label}${arrow}</th>`;
  };
  const rows = sorted.map((t, i) => {
    const isMe = t.id === G.playerTeamId; const gp = t.record.w + t.record.l + t.record.otl; const diff = t.record.gf - t.record.ga;
    return `<tr style="cursor:pointer;${isMe ? 'background:rgba(255,107,53,0.1)' : ''}" onclick="G.viewTeamId=${t.id};render();"><td style="color:#7a8299">${i + 1}</td><td style="font-weight:${isMe ? 700 : 400};color:${isMe ? '#ff6b35' : 'inherit'}">${logoTiny(t)}${t.name}</td><td>${gp}</td><td>${t.record.w}</td><td>${t.record.l}</td><td>${t.record.otl}</td><td style="font-weight:700">${t.record.pts}</td><td>${t.record.gf}</td><td>${t.record.ga}</td><td style="color:${diff > 0 ? '#4ade80' : diff < 0 ? '#ef4444' : '#7a8299'}">${diff > 0 ? '+' : ''}${diff}</td></tr>`;
  }).join('');
  return `${controls}<h2>Турнирная таблица</h2><table><thead><tr>${sh('gp','#')}${sh('pts','Команда')}${sh('gp','И')}${sh('w','В')}${sh('l','П')}${sh('otl','ПО')}${sh('pts','О')}${sh('gf','ЗШ')}${sh('ga','ЗП')}${sh('diff','Р')}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderGames() {
  if (G.selectedGamePbp) {
    const game = G.selectedGamePbp; const home = G.league.teams.find(t => t.id === game.homeId); const away = G.league.teams.find(t => t.id === game.awayId);
    let html = `<button class="btn secondary" onclick="G.selectedGamePbp=null; render();">← Назад</button>`;
    html += `<h2>${away.name} ${game.ag} : ${game.hg} ${home.name} ${game.ot ? '(ОТ)' : ''}</h2><div class="pbp-container">`;
    for (const ev of game.pbp || []) { if (ev.type === 'period') { html += `<div class="pbp-period">${ev.text}</div>`; continue; } const cls = ev.type === 'goal' ? 'pbp-goal' : ev.type === 'penalty' ? 'pbp-penalty' : ev.type === 'shot' ? 'pbp-shot' : 'pbp-faceoff'; html += `<div class="${cls}">[${ev.time}] ${ev.text}</div>`; }
    html += `</div>`; return html;
  }
  if (G.league.results.length === 0) return `<div class="subtitle">Матчей ещё не было.</div>`;
  const byRound = {}; G.league.results.forEach(r => (byRound[r.round] = byRound[r.round] || []).push(r));
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => b - a); let html = '';
  rounds.forEach(r => {
    html += `<h2>Тур ${r + 1}</h2>`;
    byRound[r].forEach(res => {
      const home = G.league.teams.find(t => t.id === res.homeId); const away = G.league.teams.find(t => t.id === res.awayId);
      const isMe = res.homeId === G.playerTeamId || res.awayId === G.playerTeamId; const globalIdx = G.league.results.indexOf(res);
      html += `<div class="game-row ${isMe ? 'player-game' : ''}" onclick="G.selectedGamePbp=G.league.results[${globalIdx}]; render();"><span class="away">${away.name}</span><span class="score">${res.ag} : ${res.hg}${res.ot ? '<span class="ot-tag">ОТ</span>' : ''}</span><span>${home.name}</span></div>`;
    });
  });
  return html;
}

function renderCalendar() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const schedule = G.league.schedule;
  const myGames = [];
  schedule.forEach((round, idx) => {
    const game = round.find(([h, a]) => h === team.id || a === team.id); if (!game) return;
    const isHome = game[0] === team.id;
    const opp = G.league.teams.find(t => t.id === (isHome ? game[1] : game[0]));
    const result = G.league.results.find(r => r.round === idx && (r.homeId === team.id || r.awayId === team.id));
    myGames.push({ round: idx + 1, opp, isHome, result, isCurrent: idx === G.league.currentRound });
  });
  const blocks = []; for (let i = 0; i < myGames.length; i += 8) blocks.push(myGames.slice(i, i + 8));
  const monthNames = ['Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь', 'Январь', 'Февраль', 'Март', 'Апрель'];
  let html = `<h2>Календарь сезона ${G.league.season}</h2>`;
  blocks.forEach((block, bIdx) => {
    html += `<div class="season-card"><div class="head"><span class="season-num">${monthNames[bIdx] || 'Месяц ' + (bIdx + 1)}</span><span class="tag">Туры ${block[0].round}–${block[block.length - 1].round}</span></div>`;
    block.forEach(g => {
      const homeAway = g.isHome ? '🏠' : '✈️';
      const resultStr = g.result ? `${g.isHome ? g.result.hg : g.result.ag} : ${g.isHome ? g.result.ag : g.result.hg}${g.result.ot ? ' ОТ' : ''}` : '';
      let color = 'color:#7a8299';
      if (g.result) { const won = g.isHome ? g.result.hg > g.result.ag : g.result.ag > g.result.hg; color = won ? 'color:#4ade80' : 'color:#ef4444'; }
      const bg = g.isCurrent ? 'background:rgba(255,107,53,0.12)' : '';
      html += `<div class="game-row" style="${bg}"><span style="flex:0 0 60px;color:#7a8299">Тур ${g.round}</span><span style="flex:0 0 40px">${homeAway}</span><span style="flex:1">${g.opp.name}</span><span class="score" style="${color};flex:0 0 auto">${resultStr || '—'}</span></div>`;
    });
    html += `</div>`;
  });
  return html;
}

/* ============================================================
   СОСТАВ / ЗВЕНЬЯ
   ============================================================ */
function renderRoster() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const benchSet = new Set(team.bench || []);
  let skaters = team.roster.filter(p => p.position !== 'G' && !benchSet.has(p.id));
  let goalies = team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id));
  const benched = team.roster.filter(p => benchSet.has(p.id));
  const sort = G.rosterSort;
  const sortPlayers = (arr) => arr.slice().sort((a, b) => {
    const sa = ensureStats(a), sb = ensureStats(b);
    if (sort === 'ovr') return b.ovr - a.ovr; if (sort === 'age') return a.age - b.age;
    if (sort === 'points') return (sb.points || 0) - (sa.points || 0);
    if (sort === 'salary') return b.contract.salary - a.contract.salary;
    if (sort === 'health') { const ha = (a.injury && a.injury.gamesLeft > 0) ? 100 + a.injury.gamesLeft : a.fatigue; const hb = (b.injury && b.injury.gamesLeft > 0) ? 100 + b.injury.gamesLeft : b.fatigue; return hb - ha; }
    return 0;
  });
  skaters = sortPlayers(skaters); goalies = sortPlayers(goalies);
  const sortSelect = `<select onchange="G.rosterSort=this.value; render();" style="background:#1a1e2a;color:#e6e8ee;border:1px solid #2a3042;padding:6px 10px;border-radius:4px;margin-bottom:12px"><option value="ovr"${sort === 'ovr' ? ' selected' : ''}>По OVR</option><option value="age"${sort === 'age' ? ' selected' : ''}>По возрасту</option><option value="points"${sort === 'points' ? ' selected' : ''}>По очкам</option><option value="salary"${sort === 'salary' ? ' selected' : ''}>По зарплате</option><option value="health"${sort === 'health' ? ' selected' : ''}>По состоянию</option></select>`;
  const nameCell = (p) => {
    let badge = '';
    if (p.injury && p.injury.gamesLeft > 0) badge = p.playingThroughPain ? `<span style="color:#ef4444;font-size:11px"> 🩹${p.injury.gamesLeft}</span>` : `<span style="color:#ef4444;font-size:11px"> 🚑${p.injury.gamesLeft}</span>`;
    else if (p.fatigue > 80) badge = `<span> 🥵</span>`; else if (p.fatigue < 20) badge = `<span> ⚡</span>`;
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    return `<a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a>${badge} <span class="char-badge ${char.cls}">${char.label}</span> ${p.nationality !== 'Россия' ? '🌍' : ''}`;
  };
  const actionBtns = (p) => `<button class="btn small secondary" onclick="sendToBench(${p.id}); render();">🪑</button><button class="btn small danger" onclick="putOnWaivers(${p.id}); render();" title="Отказы (${team.waiversUsed || 0}/3)">📤</button>`;
  const skaterRows = skaters.map(p => {
    ensureStats(p); const group = p.position === 'D' ? 'D' : 'F'; const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo';
    const potTag = p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : ''; const s = p.stats;
    return `<tr><td><span class="pos ${group}">${p.position}</span></td><td>${nameCell(p)}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.goals}</td><td class="stat-cell">${s.assists}</td><td class="stat-cell" style="font-weight:700;color:#ff6b35">${s.points}</td><td>${actionBtns(p)}</td></tr>`;
  }).join('');
  const goalieRows = goalies.map(p => {
    ensureStats(p); const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo';
    const potTag = p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : ''; const s = p.stats;
    const svPct = s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—';
    const gaa = s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—';
    return `<tr><td><span class="pos G">G</span></td><td>${nameCell(p)}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.wins}</td><td class="stat-cell" style="font-weight:700">${svPct}</td><td class="stat-cell">${gaa}</td><td>${actionBtns(p)}</td></tr>`;
  }).join('');
  const benchHtml = benched.length ? `<div class="bench-section"><div class="bench-title">🪑 На скамейке (${benched.length})</div>${benched.map(p => `<div class="bench-row"><span>${nameCell(p)} <span class="tag">${p.position} · ${p.ovr}</span></span><button class="btn small" onclick="removeFromBench(${p.id}); render();">⬆️ Вернуть</button></div>`).join('')}</div>` : '';
  return `${sortSelect}<div class="subtitle">Драфт отказов: ${team.waiversUsed || 0}/3 за сезон</div>${benchHtml}<h2>Нападающие и защитники (${skaters.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>Г</th><th>А</th><th>О</th><th></th></tr></thead><tbody>${skaterRows}</tbody></table><h2>Вратари (${goalies.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>В</th><th>SV%</th><th>КН</th><th></th></tr></thead><tbody>${goalieRows}</tbody></table>`;
}

function renderLines() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team.lines) initLines(team);
  syncLines(team);
  const benchSet = new Set(team.bench || []);
  const poolFor = (isDef) => team.roster.filter(p => !benchSet.has(p.id) && (isDef ? p.position === 'D' : (p.position !== 'D' && p.position !== 'G'))).sort((a,b) => b.ovr - a.ovr);
  const block = (key, size, isDef) => {
    const line = team.lines[key]; const mods = lineMods(line);
    const chemColor = line.chemistry >= 70 ? '#4ade80' : line.chemistry >= 40 ? '#fbbf24' : '#ef4444';
    const pool = poolFor(isDef); const slots = [];
    for (let i = 0; i < size; i++) {
      const curId = line.players[i];
      const opts = pool.map(p => `<option value="${p.id}" ${p.id === curId ? 'selected' : ''}>${p.name} (${p.ovr})</option>`).join('');
      slots.push(`<select onchange="setLineSlot('${key}', ${i}, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;min-width:170px">${opts}</select>`);
    }
    const styleOpts = Object.entries(LINE_STYLES).map(([k,v]) => `<option value="${k}" ${line.style === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const roleOpts = Object.entries(LINE_ROLES).map(([k,v]) => `<option value="${k}" ${line.role === k ? 'selected' : ''}>${v.label}</option>`).join('');
    return `<div class="line-card"><div class="line-title"><b>${key.toUpperCase()}</b><span class="line-chem" style="color:${chemColor}">Химия ${Math.round(line.chemistry)}/100</span></div><div class="line-slots">${slots.join('')}</div><div class="line-footer"><span class="lbl">Роль:</span><select onchange="setLineRole('${key}', this.value)" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:3px 8px;border-radius:3px;font-size:11px">${roleOpts}</select><span class="lbl">Стиль:</span><select onchange="setLineStyle('${key}', this.value)" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:3px 8px;border-radius:3px;font-size:11px">${styleOpts}</select><span class="mods">Атака: ${mods.atk >= 0 ? '+' : ''}${Math.round(mods.atk*100)}% · Защита: ${mods.def >= 0 ? '+' : ''}${Math.round(mods.def*100)}%</span></div></div>`;
  };
  const gkOpts = (selId) => team.roster.filter(p => p.position === 'G' && !benchSet.has(p.id)).sort((a,b) => b.ovr - a.ovr).map(p => `<option value="${p.id}" ${p.id === selId ? 'selected' : ''}>${p.name} (${p.ovr})</option>`).join('');
  let html = `<h2>Звенья и пары</h2><div style="margin-bottom:12px"><button class="btn small" onclick="resetLinesToOvr()">🔄 Автосостав</button></div><h2>Форварды</h2>`;
  for (const key of ['f1','f2','f3','f4']) html += block(key, 3, false);
  html += `<h2>Защитники</h2>`;
  for (const key of ['d1','d2','d3']) html += block(key, 2, true);
  html += `<h2>Вратари</h2><div class="line-card"><div class="line-slots"><div><span class="lbl">Стартовый:</span><br><select onchange="setLineSlot('g', 0, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;margin-top:4px">${gkOpts(team.lines.g1)}</select></div><div><span class="lbl">Запасной:</span><br><select onchange="setLineSlot('g', 1, Number(this.value))" style="background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px 8px;border-radius:3px;font-size:12px;margin-top:4px">${gkOpts(team.lines.g2)}</select></div></div></div>`;
  return html;
}

/* ============================================================
   СТАТИСТИКА / ФИНАНСЫ
   ============================================================ */
function renderStats() {
  const mode = G.statsMode || 'regular';
  const leaders = leagueLeaders(G.league, mode);
  const findTeam = (p) => G.league.teams.find(t => t.roster.includes(p));
  const getStat = (p) => mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
  const toggle = `<div class="stat-toggle"><button class="${mode === 'regular' ? 'active' : ''}" onclick="G.statsMode='regular'; render();">Регулярка</button><button class="${mode === 'playoff' ? 'active' : ''}" onclick="G.statsMode='playoff'; render();">Плей-офф</button></div>`;
  const skaterTable = (title, players) => `<h2>${title}</h2><table><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>Г</th><th>А</th><th>О</th></tr></thead><tbody>${players.map((p, i) => { const t = findTeam(p); const st = getStat(p); return `<tr><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td>${t ? t.name : '—'}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.goals}</td><td class="stat-cell">${st.assists}</td><td class="stat-cell" style="font-weight:700;color:#ff6b35">${st.points}</td></tr>`; }).join('')}</tbody></table>`;
  const goalieTable = `<h2>🧤 Вратари</h2><table><thead><tr><th>#</th><th>Игрок</th><th>Команда</th><th>И</th><th>В</th><th>SV%</th><th>КН</th><th>Сух</th></tr></thead><tbody>${leaders.bySvPct.map((p, i) => { const t = findTeam(p); const st = getStat(p); const sv = st.shotsAgainst > 0 ? (st.saves / st.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'; const gaa = st.gp > 0 ? (st.goalsAgainst / st.gp).toFixed(2) : '—'; return `<tr><td style="color:#7a8299">${i + 1}</td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a></td><td>${t ? t.name : '—'}</td><td class="stat-cell">${st.gp}</td><td class="stat-cell">${st.wins}</td><td class="stat-cell" style="font-weight:700">${sv}</td><td class="stat-cell">${gaa}</td><td class="stat-cell">${st.shutouts}</td></tr>`; }).join('')}</tbody></table>`;
  return `${toggle}${skaterTable('🎯 Снайперы', leaders.byGoals)}${skaterTable('🎁 Ассистенты', leaders.byAssists)}${skaterTable('⭐ Бомбардиры', leaders.byPoints)}${goalieTable}`;
}

function renderFinance() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const f = team.finance;
  if (!f.sponsorOffers) generateSponsorOffers(team);
  const signedKeys = new Set((team.sponsors || []).map(s => s.key));
  const allOffers = f.sponsorOffers || [];
  const pendingOffers = allOffers.filter(o => !signedKeys.has(o.key));
  const playerSal = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const staffSal = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  const cards = `<div class="finance-card"><div class="fc-title">Баланс</div><div class="fc-value ${f.balance >= 0 ? 'pos' : 'neg'}">${Math.round(f.balance)} млн ₽</div><div class="fc-sub">Бюджет: ${f.seasonBudget} млн ₽</div></div><div class="finance-card"><div class="fc-title">ЗП игроков</div><div class="fc-value">${Math.round(playerSal)}</div><div class="fc-sub">Потолок: ${f.salaryCap} млн ₽</div></div><div class="finance-card"><div class="fc-title">ЗП штаба</div><div class="fc-value">${staffSal.toFixed(1)}</div></div><div class="finance-card"><div class="fc-title">Арена</div><div class="fc-value">${f.arenaCapacity.toLocaleString()}</div><div class="fc-sub">Фанбаза: ${(f.fanBase * 100).toFixed(0)}%</div></div>`;
  const inRows = [['Билеты', f.income.tickets], ['Мерч/еда', f.income.matchdayExtras], ['Мерч (пассив)', f.income.merch || 0], ['Спонсоры', f.income.sponsors], ['Бонусы спонсоров', f.income.sponsorBonuses], ['ТВ', f.income.tv], ['Призовые', f.income.prizes], ['Гос. поддержка', f.income.gov || 0]].map(([n, v]) => `<tr><td>${n}</td><td class="stat-cell" style="text-align:right">${v.toFixed(1)}</td></tr>`).join('');
  const exRows = [['ЗП игроков', f.expenses.salaries], ['ЗП штаба', f.expenses.staffSalaries], ['Бонусы', f.expenses.bonuses || 0], ['Операции', f.expenses.operations]].map(([n, v]) => `<tr><td>${n}</td><td class="stat-cell" style="text-align:right">${v.toFixed(1)}</td></tr>`).join('');
  let sponsorsHtml = '';
  if (team.sponsors && team.sponsors.length) sponsorsHtml = team.sponsors.map(s => { const progress = G.league.currentRound / G.league.schedule.length; const paid = Math.round(s.base * progress); return `<div class="finance-card"><div class="fc-title">${s.name}</div><div class="fc-value" style="font-size:16px">${s.base} млн ₽</div><div class="fc-sub">Выплачено: ${paid} / ${s.base}</div></div>`; }).join('');
  else sponsorsHtml = `<div class="finance-card"><div class="fc-title">Спонсоры</div><div class="fc-value neg">Не подписаны</div></div>`;
  let offersHtml = '';
  if (pendingOffers.length) offersHtml = `<h2>Спонсорские предложения (${pendingOffers.length})</h2><div style="margin-bottom:8px"><button class="btn" onclick="signAllSponsors(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">📝 Подписать все</button></div><div style="display:flex;gap:12px;flex-wrap:wrap">${pendingOffers.map(o => `<div class="finance-card" style="flex:1;min-width:220px"><div class="fc-title">${o.name}</div><div class="fc-value" style="font-size:18px">${o.base} млн ₽</div><button class="btn small" style="margin-top:8px" onclick="signSponsorByKey('${o.key}')">Подписать</button></div>`).join('')}</div>`;
  return `<div class="finance-grid">${cards}</div><h2>Доходы и расходы</h2><div class="finance-grid"><div class="finance-card"><div class="fc-title">Доходы</div><table>${inRows}</table></div><div class="finance-card"><div class="fc-title">Расходы</div><table>${exRows}</table></div></div><h2>Цена билета</h2><div class="finance-card"><div class="slider-row"><label>${f.ticketPrice} ₽</label><input type="range" min="100" max="1500" step="50" value="${f.ticketPrice}" oninput="setTicketPrice(this.value)" /><span class="slider-value">${f.ticketPrice}</span></div></div><h2>Спонсоры (${(team.sponsors || []).length})</h2><div class="finance-grid">${sponsorsHtml}</div>${offersHtml}`;
}
function setTicketPrice(v) { const team = G.league.teams.find(t => t.id === G.playerTeamId); team.finance.ticketPrice = Number(v); render(); }

function renderMarket() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const hasScout = !!team.staff.scout;
  const filtered = (G.league.freeAgents || []).filter(p => { if (G.marketFilter === 'all') return true; if (G.marketFilter === 'F') return p.position !== 'D' && p.position !== 'G'; if (G.marketFilter === 'D') return p.position === 'D'; if (G.marketFilter === 'G') return p.position === 'G'; return true; });
  const sorted = filtered.slice().sort((a, b) => b.ovr - a.ovr);
  const rows = sorted.map(p => {
    const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'; const foreign = p.nationality !== 'Россия';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const potTag = hasScout && p.pot > p.ovr ? `<span class="pot">▲${p.pot - p.ovr}</span>` : '';
    return `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a> <span class="char-badge ${char.cls}">${char.label}</span> ${foreign ? '🌍' : ''}</td><td>${p.age}</td><td class="ovr ${cls}">${p.ovr}${potTag}</td><td class="salary">${p.contract.salary.toFixed(1)}M</td><td><button class="btn small" onclick="signFreeAgent(G.league.teams.find(t=>t.id===G.playerTeamId), G.league.freeAgents.find(x=>x.id===${p.id})); render();">Подписать</button><button class="btn small secondary" onclick="offerTryout(G.league.teams.find(t=>t.id===G.playerTeamId), G.league.freeAgents.find(x=>x.id===${p.id})); render();">Просмотр</button></td></tr>`;
  }).join('');
  return `<div class="market-filters"><button class="${G.marketFilter === 'all' ? 'active' : ''}" onclick="G.marketFilter='all'; render();">Все</button><button class="${G.marketFilter === 'F' ? 'active' : ''}" onclick="G.marketFilter='F'; render();">Форварды</button><button class="${G.marketFilter === 'D' ? 'active' : ''}" onclick="G.marketFilter='D'; render();">Защитники</button><button class="${G.marketFilter === 'G' ? 'active' : ''}" onclick="G.marketFilter='G'; render();">Вратари</button></div><h2>Свободные агенты (${sorted.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>ЗП</th><th>Действия</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTrades() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const offers = G.league.aiTradeOffers || [];
  const deadline = isTradeDeadlinePassed();
  let html = `<h2>Обмены</h2>`;
  if (deadline) html += `<div class="trade-deadline-banner">🚫 Трансферный дедлайн закрыт. Обмены недоступны до конца сезона.</div>`;
  if (offers.length) {
    html += `<h2>💼 Предложения (${offers.length})</h2>`;
    for (const o of offers) {
      const from = G.league.teams.find(t => t.id === o.fromTeamId);
      const theirOffer = o.theyOffer.map(id => from?.roster.find(p => p.id === id)).filter(Boolean);
      const want = o.theyWant.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
      const disabled = deadline ? 'disabled style="opacity:0.4;cursor:not-allowed"' : '';
      html += `<div class="trade-offer-card"><div class="to-head"><span class="to-team">💼 ${from ? from.name : '—'}</span></div><div class="to-players"><div><b style="color:#4ade80">Отдают:</b> ${theirOffer.map(p => `${p.name} (${p.ovr})`).join(', ') || '—'}</div><div><b style="color:#fbbf24">Хотят:</b> ${want.map(p => `${p.name} (${p.ovr})`).join(', ') || '—'}</div></div><div class="to-actions"><button class="btn small" ${disabled} onclick="acceptAITradeOffer(${o.id})">✅ Принять</button><button class="btn small secondary" onclick="declineAITradeOffer(${o.id})">❌ Отклонить</button></div></div>`;
    }
  }
  if (deadline) return html;
  const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId).sort((a, b) => a.name.localeCompare(b.name));
  if (!G.tradeTargetTeamId && aiTeams.length) G.tradeTargetTeamId = aiTeams[0].id;
  const theirTeam = G.league.teams.find(t => t.id === G.tradeTargetTeamId);
  const myPlayers = team.roster.filter(p => p.ovr >= 55).sort((a, b) => b.ovr - a.ovr);
  const theirPlayers = theirTeam ? theirTeam.roster.slice().sort((a, b) => b.ovr - a.ovr) : [];
  html += `<h2>Свой обмен</h2><div class="finance-card"><div class="fc-title">Соперник</div><select onchange="setTradeTeam(this.value)" style="width:100%;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:8px;border-radius:4px">${aiTeams.map(t => `<option value="${t.id}" ${t.id === G.tradeTargetTeamId ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>`;
  html += `<div class="trade-multi"><div class="trade-col"><h4>Мои игроки</h4>${myPlayers.map(p => `<label class="trade-check-row"><input type="checkbox" class="trade-my-pick" value="${p.id}"><span>${p.name} (${p.ovr}) — ${tradeValue(p)}</span></label>`).join('')}<div style="margin-top:8px"><label style="font-size:12px">+ Деньги (млн): </label><input id="my-cash" type="number" min="0" value="0" style="width:80px;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px;border-radius:3px"></div></div><div class="trade-col"><h4>Игроки соперника</h4>${theirPlayers.map(p => `<label class="trade-check-row"><input type="checkbox" class="trade-their-pick" value="${p.id}"><span>${p.name} (${p.ovr}) — ${tradeValue(p)}</span></label>`).join('')}<div style="margin-top:8px"><label style="font-size:12px">+ Деньги (млн): </label><input id="their-cash" type="number" min="0" value="0" style="width:80px;background:#0f1117;color:#e6e8ee;border:1px solid #2a3042;padding:4px;border-radius:3px"></div></div></div>`;
  html += `<button class="btn" onclick="proposeMultiTrade()" style="margin-top:12px">🔄 Предложить обмен</button>`;
  return html;
}

function renderWaivers() {
  const list = G.league.waivers || [];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  let html = `<h2>Драфт отказов (${team.waiversUsed || 0}/3)</h2>`;
  if (!list.length) return html + `<div class="subtitle">Список пуст.</div>`;
  html += `<table><thead><tr><th>Игрок</th><th>Откуда</th><th>OVR</th><th>Истекает</th></tr></thead><tbody>`;
  for (const w of list) { const from = G.league.teams.find(t => t.id === w.fromTeamId); html += `<tr><td>${w.player.name}</td><td>${from ? from.name : '—'}</td><td>${w.player.ovr}</td><td>Тур ${w.expiresRound + 1}</td></tr>`; }
  return html + `</tbody></table>`;
}

/* ============================================================
   ТАКТИКА / ТРЕНИРОВКИ / ШТАБ
   ============================================================ */
function setTactic(key, value) { const team = G.league.teams.find(t => t.id === G.playerTeamId); team.tactics[key] = Number(value); render(); }
function renderTactics() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const t = team.tactics; const mods = tacticMods(t, team);
  const rows = SLIDER_DEFS.map(s => `<div class="slider-row"><label>${s.label}</label><input type="range" min="0" max="100" value="${t[s.key]}" oninput="setTactic('${s.key}', this.value)" /><span class="slider-value">${t[s.key]}</span></div><div class="subtitle" style="margin:-4px 0 8px 172px;font-size:11px">${s.left} ↔ ${s.right}</div>`).join('');
  const assistantBtn = team.staff.assistantCoach
    ? `<button class="btn" onclick="suggestTactics(); render();" style="margin-top:12px">📋 Совет ассистента (ур. ${team.staff.assistantCoach.level})</button>`
    : `<div class="subtitle" style="margin-top:12px">💡 Найми ассистента во вкладке «Штаб».</div>`;
  return `<h2>Тактическая схема</h2><div class="finance-card">${rows}<div class="fc-sub">Атака: ${mods.atkMod >= 0 ? '+' : ''}${Math.round(mods.atkMod*100)}% · Защита: ${mods.defMod >= 0 ? '+' : ''}${Math.round(mods.defMod*100)}%</div></div>${assistantBtn}`;
}
function renderTraining() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const players = team.roster.filter(p => p.age <= 27).sort((a, b) => b.pot - a.pot).slice(0, 14);
  const rows = players.map(p => {
    const cls = p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'; const isG = p.position === 'G';
    const focuses = Object.entries(DEV_FOCUSES).filter(([, f]) => isG ? f.goalie : !f.goalie);
    const btns = focuses.map(([key, f]) => `<button class="${p.developmentFocus === key ? 'active' : ''}" onclick="setDevelopmentFocus(G.league.teams.find(t=>t.id===G.playerTeamId).roster.find(x=>x.id===${p.id}), '${key}'); render();">${f.label}</button>`).join('');
    const mentor = getMentor(team, p.id);
    const mentorTag = mentor ? ` <span class="tag">🎓 ${mentor.name}</span>` : '';
    return `<div class="dev-row"><div class="dr-info"><div class="dr-name"><a href="#" onclick="event.preventDefault(); G.popupPlayerId=${p.id}; render();" style="color:inherit;text-decoration:none;border-bottom:1px dotted #7a8299">${p.name}</a> <span class="ovr ${cls}">${p.ovr}</span>${mentorTag}</div><div class="dr-meta">${p.position} · ${p.age} лет · Потенциал: ${p.pot}</div></div><div class="dr-focus">${btns}</div></div>`;
  }).join('');
  const assistantBtn = team.staff.assistantCoach
    ? `<button class="btn" onclick="suggestTraining(); render();" style="margin-bottom:12px">📋 Распределить фокусы (ассистент ур. ${team.staff.assistantCoach.level})</button>`
    : `<div class="subtitle" style="margin-bottom:12px">💡 Найми ассистента для автораспределения.</div>`;
  return `<h2>Тренировочный лагерь</h2>${assistantBtn}<div class="dev-list">${rows || '<div class="subtitle">Нет подходящих игроков.</div>'}</div>`;
}
function renderStaff() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const totalStaffSalary = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  let html = `<h2>Штаб</h2><div class="finance-card"><div class="fc-title">Зарплата штаба</div><div class="fc-value">${totalStaffSalary.toFixed(1)} млн ₽</div></div><h2>Текущий состав</h2><table><thead><tr><th>Роль</th><th>Сотрудник</th><th>Уровень</th><th>XP</th><th>Действие</th></tr></thead><tbody>`;
  for (const [role, def] of Object.entries(STAFF_ROLES)) {
    const emp = team.staff[role];
    html += `<tr><td>${def.icon} <b>${def.label}</b><div class="tag">${def.desc}</div></td>`;
    if (emp) { const xpNeeded = emp.level * 20; html += `<td>${emp.name}</td><td>${'★'.repeat(emp.level)}</td><td>${emp.xp || 0}/${emp.level < 5 ? xpNeeded : '—'}</td><td><button class="btn small danger" onclick="fireStaff('${role}'); render();">Уволить</button></td>`; }
    else html += `<td colspan="4" style="color:#7a8299">Вакансия</td>`;
    html += `</tr>`;
  }
  html += `</tbody></table><h2>Кандидаты (${G.league.staffPool.length})</h2>`;
  if (!G.league.staffPool.length) html += `<div class="subtitle">Кандидатов нет.</div>`;
  else { html += `<table><thead><tr><th>Роль</th><th>Имя</th><th>Возраст</th><th>Уровень</th><th>Действие</th></tr></thead><tbody>`; for (const cand of G.league.staffPool) { const def = STAFF_ROLES[cand.role]; html += `<tr><td>${def.icon} ${def.label}</td><td>${cand.name}</td><td>${cand.age}</td><td>${'★'.repeat(cand.level)}</td><td><button class="btn small" onclick="hireStaff(${cand.id}); render();">Нанять</button></td></tr>`; } html += `</tbody></table>`; }
  return html;
}

/* ============================================================
   ИНФРАСТРУКТУРА / АКАДЕМИЯ
   ============================================================ */
function renderInfrastructure() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); const f = team.finance;
  let html = `<h2>Арена</h2><div class="finance-card"><div class="fc-title">Вместимость</div><div class="fc-value">${f.arenaCapacity.toLocaleString()}</div><div class="fc-sub">Ур. ${team.arenaLevel}/5</div>`;
  if (team.arenaLevel < 5) { const cost = arenaUpgradeCost(team.arenaLevel); html += `<button class="btn small" style="margin-top:8px" onclick="upgradeArena(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Расширить за ${cost} млн</button>`; }
  html += `</div><h2>Инфраструктура</h2><div class="finance-grid">`;
  for (const [key, def] of Object.entries(INFRA)) {
    const lvl = team.infrastructure[key]; const cost = def.upgradeCost(lvl);
    html += `<div class="finance-card"><div class="fc-title">${def.label}</div><div class="fc-value">Ур. ${lvl}</div><div class="fc-sub">${def.effect(lvl)}</div>`;
    if (lvl < def.maxLevel) html += `<button class="btn small" style="margin-top:8px" onclick="upgradeInfra('${key}'); render();">Улучшить за ${cost} млн</button>`;
    html += `</div>`;
  }
  html += `</div>`;
  const merchCosts = { 1: 5, 2: 12, 3: 25, 4: 50 };
  const merchDesc = ['База', '+15% к мерчу', '+30%, +1 фанбаза за победу', '+50%', '+75%, +1 млн/тур'];
  html += `<h2>Мерч (уровень ${f.merchLevel || 1}/5)</h2><div class="infrastructure-card"><div class="ic-title">Логотип и мерч</div><div class="ic-desc">${merchDesc[(f.merchLevel || 1) - 1]}</div>`;
  if ((f.merchLevel || 1) < 5) { const cost = merchCosts[f.merchLevel || 1]; html += `<button class="btn small" onclick="upgradeMerch(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Улучшить за ${cost} млн</button>`; }
  html += `</div>`;
  const vipCosts = { 0: 10, 1: 25, 2: 50 };
  html += `<h2>ВИП-ложи (уровень ${f.vipLevel || 0}/3)</h2><div class="infrastructure-card"><div class="ic-title">ВИП-ложи</div><div class="ic-desc">${f.vipLevel === 0 ? 'Нет' : `+${f.vipLevel * 15}% к цене билета`}</div>`;
  if ((f.vipLevel || 0) < 3) { const cost = vipCosts[f.vipLevel || 0]; html += `<button class="btn small" onclick="upgradeVip(G.league.teams.find(t=>t.id===G.playerTeamId)); render();">Улучшить за ${cost} млн</button>`; }
  html += `</div>`;
  html += `<h2>Матч-дэй активности</h2><div class="finance-grid">`;
  const flagDefs = [{ key: 'fanzone', label: 'Фан-зона', cost: 2, desc: '+5% к заполняемости' }, { key: 'show', label: 'Шоу перед матчем', cost: 5, desc: '+3% к заполняемости, +мораль' }, { key: 'kidsTickets', label: 'Детские билеты', cost: 1, desc: '+10% к заполняемости против аутсайдеров' }];
  for (const flag of flagDefs) {
    const active = f.matchdayFlags?.[flag.key];
    html += `<div class="finance-card"><div class="fc-title">${flag.label}</div><div class="fc-sub">${flag.desc}</div><div style="margin-top:8px"><button class="btn small ${active ? 'danger' : ''}" onclick="toggleMatchdayFlag(G.league.teams.find(t=>t.id===G.playerTeamId), '${flag.key}'); render();">${active ? 'Отключить' : `Включить (${flag.cost} млн)`}</button></div></div>`;
  }
  html += `</div>`;
  return html;
}
function renderAcademy() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  let html = `<h2>Академия (ур. ${team.infrastructure.youthAcademy})</h2>`;
  html += `<div style="margin-bottom:12px"><button class="btn" onclick="searchForTalent()">🔍 Искать талант (5 млн ₽)</button>`;
  if (team.scoutMission?.active) html += `<button class="btn secondary" disabled>Миссия до тура ${team.scoutMission.endsRound + 1}</button>`;
  else html += `<button class="btn secondary" onclick="sendScoutMission()">📤 Миссия скаута (2 млн)</button>`;
  html += `</div>`;
  if (team.scoutMission?.results?.length) {
    html += `<h2>📤 Результаты миссии</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>Потенциал</th><th>Действие</th></tr></thead><tbody>`;
    for (const p of team.scoutMission.results) html += `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}</td><td>${p.age}</td><td>${p.ovr}</td><td><span class="pot">▲${p.pot - p.ovr}</span></td><td><button class="btn small" onclick="addScoutedPlayerToAcademy(G.league.teams.find(t=>t.id===G.playerTeamId), ${p.id});">В академию</button></td></tr>`;
    html += `</tbody></table>`;
  }
  for (const group of ['U18', 'U17', 'U16']) {
    const players = (team.academy[group] || []).slice().sort((a, b) => b.pot - a.pot);
    html += `<h2>${group} (${players.length})</h2>`;
    if (!players.length) { html += `<div class="subtitle">Нет игроков.</div>`; continue; }
    html += `<table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>Потенциал</th><th>Прогноз</th></tr></thead><tbody>`;
    for (const p of players) { const prog = academyPrognosis(p); html += `<tr><td><span class="pos ${p.position === 'G' ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}</td><td>${p.age}</td><td class="ovr ${p.ovr >= 65 ? 'mid' : 'lo'}">${p.ovr}</td><td><span class="pot">▲${p.pot - p.ovr}</span></td><td><span class="academy-role-badge ${prog.cls}">${prog.label}</span></td></tr>`; }
    html += `</tbody></table>`;
  }
  return html;
}

/* ============================================================
   ПОЧТА / НОВОСТИ
   ============================================================ */
function renderInbox() {
  const msgs = (G.league.inbox || []).slice().reverse();
  const filter = G.inboxFilter || 'all';
  const filtered = filter === 'all' ? msgs : msgs.filter(m => m.type === filter);
  const unread = unreadInboxCount();
  const types = [{ key: 'all', label: 'Все' }, { key: 'player', label: '👤 Игроки' }, { key: 'coach', label: '🎓 Тренер' }, { key: 'league', label: '🏒 Лига' }, { key: 'sponsor', label: '💰 Спонсор' }, { key: 'scout', label: '🔍 Скаут' }, { key: 'board', label: '🏛 Совет' }];
  let html = `<h2>📬 Почта ${unread ? `<span class="inbox-badge">${unread}</span>` : ''}</h2>`;
  html += `<div class="inbox-filter">${types.map(t => `<button class="${filter === t.key ? 'active' : ''}" onclick="G.inboxFilter='${t.key}'; render();">${t.label}</button>`).join('')}<button onclick="markAllInboxRead()">Прочитать всё</button></div>`;
  if (!filtered.length) return html + `<div class="subtitle">Сообщений нет.</div>`;
  for (const m of filtered) {
    html += `<div class="inbox-msg ${m.read ? '' : 'unread'}"><div class="msg-head"><span class="msg-from">${m.from}</span><span>Сезон ${m.season} · Тур ${m.round + 1}</span></div><div class="msg-subject">${m.subject}</div><div class="msg-body">${m.body}</div><div class="msg-actions">${(m.actions || []).map((a, i) => `<button class="primary" onclick="executeInboxAction(${m.id}, ${i})">${a.label}</button>`).join('')}${!m.read ? `<button onclick="markInboxRead(${m.id}); render();">Прочитано</button>` : ''}</div></div>`;
  }
  return html;
}
function renderNews() {
  const list = (G.league.news || []).slice().reverse();
  let html = `<h2>📰 Хроника (${list.length})</h2>`;
  if (!list.length) return html + `<div class="subtitle">Новостей нет.</div>`;
  const icons = { injury: '🚑', signing: '✍️', trade: '🔄', milestone: '⭐', streak: '🔥', retirement: '👋', academy: '🎓', event: '📰', release: '📤', career: '💼', firing: '🚫', opening_cup: '⚡', trade_deadline: '🚫', season_upset: '🎉', season_flop: '📉', upset: '🎉', disappointment: '📉' };
  html += `<div class="news-list">${list.map(n => `<div class="news-item imp-${n.importance || 1}"><div class="news-round">С${n.season} Т${n.round + 1}</div><div class="news-icon">${icons[n.type] || '📌'}</div><div class="news-text">${n.text}</div></div>`).join('')}</div>`;
  return html;
}

/* ============================================================
   КАРЬЕРА / СВОБОДНЫЙ АГЕНТ
   ============================================================ */
function renderCareer() {
  if (!G.playerTeamId) return renderFreeAgentScreen();
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const rep = G.career?.reputation ?? 50;
  const repColor = rep >= 70 ? '#4ade80' : rep >= 40 ? '#fbbf24' : '#ef4444';
  let html = `<h2>💼 Карьера</h2>`;
  html += `<div class="finance-grid"><div class="finance-card"><div class="fc-title">Репутация</div><div class="fc-value" style="color:${repColor}">${Math.round(rep)}/100</div><div class="reputation-bar"><div style="width:${rep}%;background:${repColor}"></div></div></div><div class="finance-card"><div class="fc-title">Сложность</div><div class="fc-value" style="font-size:16px">${G.difficulty?.label || '—'}</div><div class="fc-sub">${G.career?.noFireMode ? '🚫 Без увольнения' : 'Стандартный режим'}</div></div></div>`;
  html += `<h2>История карьеры</h2>`;
  const hist = G.career?.history || [];
  if (!hist.length) html += `<div class="subtitle">Пока пусто — заверши сезон.</div>`;
  else {
    html += `<table><thead><tr><th>Сезон</th><th>Клуб</th><th>Место</th><th>Очки</th></tr></thead><tbody>`;
    hist.forEach(h => { html += `<tr><td>${h.season}</td><td>${h.teamName}</td><td>${h.rank}</td><td>${h.pts}</td></tr>`; });
    html += `</tbody></table>`;
  }
  if (G.careerOffers && G.careerOffers.length) {
    html += `<h2>📨 Предложения на следующий сезон</h2>`;
    for (const o of G.careerOffers) {
      html += `<div class="offer-card"><div class="offer-info"><div class="offer-title">${o.label}</div><div class="offer-sub">${o.type === 'stay' ? 'Текущий клуб' : 'Новый вызов'}</div></div><button class="btn" onclick="acceptCareerOffer(${o.teamId})">Принять</button></div>`;
    }
    html += `<div style="margin-top:16px"><button class="btn secondary" onclick="stayAtCurrentTeam()">Остаться, не менять</button></div>`;
  } else {
    html += `<div style="margin-top:16px"><button class="btn danger" onclick="if(confirm('Уйти в свободные агенты? Потеряешь текущий клуб.')) becomeFreeAgent()">🚪 Уйти в свободные агенты</button></div>`;
  }
  return html;
}
function renderFreeAgentScreen() {
  const rep = G.career?.reputation ?? 50;
  if (G.league.currentRound >= G.league.schedule.length) {
    if (!G.freeAgentOffers) generateFreeAgentOffers();
    return `<div class="fa-screen"><h1>💼 Свободный агент</h1><div class="fa-hint">Сезон завершён. Репутация: <b>${Math.round(rep)}/100</b>. Вот клубы, которые ищут тренера:</div>
      ${(G.freeAgentOffers || []).map(o => {
        if (o.type === 'stay_free') return `<div class="offer-card"><div class="offer-info"><div class="offer-title">Остаться свободным агентом</div><div class="offer-sub">Ещё один сезон в ожидании</div></div><button class="btn secondary" onclick="G.freeAgentOffers=null; render();">Выбрать</button></div>`;
        return `<div class="offer-card"><div class="offer-info"><div class="offer-title">${o.teamName}</div><div class="offer-sub">Сила: ${o.strength.toFixed(2)}</div></div><button class="btn" onclick="acceptCareerOffer(${o.teamId})">Возглавить</button></div>`;
      }).join('')}
      <div style="margin-top:24px"><button class="btn danger" onclick="if(confirm('Сбросить и начать заново?')) newGame()">🔄 Новая игра</button></div>
    </div>`;
  }
  const sorted = standingsSortedByUI();
  const progress = (G.league.currentRound / G.league.schedule.length) * 100;
  return `<div class="fa-screen"><h1>💼 Свободный агент</h1><div class="fa-hint">Репутация: <b>${Math.round(rep)}/100</b>. Ты вне клуба. Следи за лигой или перемотай сезон.</div>
    <div class="progress-bar" style="max-width:600px;margin:12px auto"><div style="width:${progress}%"></div></div>
    <div style="margin:16px 0"><button class="btn" onclick="simRoundFreeAgent()">▶ Тур</button><button class="btn secondary" onclick="simSeasonFreeAgent()">⏭ Весь сезон</button></div>
  </div>
  <h2>Таблица</h2><table><thead><tr><th>#</th><th>Команда</th><th>И</th><th>О</th></tr></thead><tbody>${sorted.slice(0, 10).map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.record.w + t.record.l + t.record.otl}</td><td>${t.record.pts}</td></tr>`).join('')}</tbody></table>
  <div style="margin-top:24px"><button class="btn danger" onclick="if(confirm('Сбросить?')) newGame()">🔄 Новая игра</button></div>`;
}

/* ============================================================
   ПЛЕЙ-ОФФ
   ============================================================ */
function renderSeries(series, roundIdx) {
  if (!series.aId || !series.bId) return `<div class="series"><span style="color:#7a8299">Ожидает...</span></div>`;
  const a = G.league.teams.find(t => t.id === series.aId); const b = G.league.teams.find(t => t.id === series.bId);
  const isMe = series.aId === G.playerTeamId || series.bId === G.playerTeamId;
  const aWon = series.winnerId === series.aId, bWon = series.winnerId === series.bId;
  const gameStr = series.games.map(g => { const aIsHome = g.homeId === series.aId; return `${aIsHome ? g.hg : g.ag}-${aIsHome ? g.ag : g.hg}${g.ot ? 'ОТ' : ''}`; }).join(', ');
  const currentGame = series.aWins + series.bWins + 1;
  const matchIndicator = !series.winnerId && isMe ? `<div class="match-indicator">Матч ${currentGame} из 7</div>` : '';
  let actions = '';
  if (!series.winnerId && isMe && roundIdx === G.league.playoffs.currentRoundIdx) {
    actions = `<div class="series-actions"><button class="btn small" onclick="simMyPlayoffMatch()">▶ Следующий матч</button><button class="btn small secondary" onclick="simPlayoffRound()">⏩ Вся серия</button></div>`;
  }
  return `<div class="series ${isMe ? 'player-series' : ''} ${series.winnerId ? 'won' : ''}"><div style="flex:1"><div class="team" style="color:${aWon ? '#4ade80' : '#e6e8ee'}">${a.name}${aWon ? '<span class="winner-mark">✓</span>' : ''}</div><div class="games-list">${gameStr || '—'}</div>${matchIndicator}</div><div class="score">${series.aWins} : ${series.bWins}</div><div style="flex:1;text-align:right" class="team"><div style="color:${bWon ? '#4ade80' : '#e6e8ee'}">${b.name}${bWon ? '<span class="winner-mark">✓</span>' : ''}</div></div></div>${actions}`;
}
function renderPlayoffs() {
  const p = G.league.playoffs;
  if (!p) { const done = G.league.currentRound >= G.league.schedule.length; if (!done) return `<div class="subtitle">Плей-офф начнётся после регулярки.</div>`; return `<div class="subtitle">Ошибка: плей-офф не создан.</div>`; }
  const done = !!p.championId;
  const regularChampion = standingsSorted()[0];
  const rc = `<div class="regular-champion">🥇 Кубок Чемпиона России: ${regularChampion.name}</div>`;
  const controls = done ? rc + `<div class="champion">🏆 Кубок Петрова: ${G.league.teams.find(t => t.id === p.championId).name}!</div><button class="btn" onclick="endSeason()">▶ Новый сезон</button>` : rc + `<button class="btn" onclick="simPlayoffRound()">⏩ Симулировать раунд</button><button class="btn secondary" onclick="simPlayoffsAll()">⏭ Весь плей-офф</button>`;
  let html = controls;
  p.rounds.forEach((round, idx) => {
    const isPast = idx < p.currentRoundIdx, isCurrent = idx === p.currentRoundIdx;
    html += `<div class="playoff-round" style="${isPast ? 'opacity:0.75' : ''}"><h3>${round.name}${isCurrent && !done ? ' · текущий' : ''}</h3>${round.series.map(s => renderSeries(s, idx)).join('')}</div>`;
  });
  return html;
}

/* ============================================================
   ИСТОРИЯ
   ============================================================ */
function renderAwards(awards) {
  if (!awards) return '<div class="subtitle">Награды не определены.</div>';
  const card = (title, a) => a ? `<div class="finance-card"><div class="fc-title">${title}</div><div class="fc-value" style="font-size:16px">${a.name}</div><div class="fc-sub">${a.team}${a.position ? ' · ' + a.position : ''}</div></div>` : '';
  return `<div class="finance-grid">${card('🏆 MVP', awards.mvp)}${card('🎯 Снайпер', awards.topScorer)}${card('🎁 Ассистент', awards.topAssister)}${card('⭐ Бомбардир', awards.topPointMan)}${card('🛡️ Защитник', awards.topDefenseman)}${card('🧤 Вратарь', awards.topGoalie)}${card('🌟 Новичок', awards.rookieOfYear)}</div>`;
}
function renderAllTimeLeaders() {
  if (!G.league.allTimeLeaders || !G.league.allTimeLeaders.skaters) return '';
  const entries = Object.values(G.league.allTimeLeaders.skaters);
  if (!entries.length) return '';
  const skaters = entries.filter(e => !e.isG); const goalies = entries.filter(e => e.isG);
  const table = (title, arr, headers, vals) => arr.length ? `<h2>${title}</h2><table><thead><tr><th>#</th><th>Игрок</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map((e, i) => `<tr><td style="color:#7a8299">${i + 1}</td><td>${e.name}</td>${vals(e).map(v => `<td class="stat-cell">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<h2>🏆 За всю историю</h2>` +
    table('🎯 Снайперы', skaters.slice().sort((a, b) => b.goals - a.goals).slice(0, 10), ['Сезонов', 'И', 'Г'], e => [e.seasons, e.gp, e.goals]) +
    table('⭐ Бомбардиры', skaters.slice().sort((a, b) => b.points - a.points).slice(0, 10), ['И', 'Г', 'А', 'О'], e => [e.gp, e.goals, e.assists, e.points]) +
    table('🧤 Вратари', goalies.slice().sort((a, b) => b.wins - a.wins).slice(0, 10), ['И', 'В', 'Сух'], e => [e.gp, e.wins, e.shutouts]);
}
function renderHistory() {
  const hist = G.league.history;
  if (hist.length === 0) return `<div class="subtitle">История пуста.</div>`;
  const allTime = allTimeTeamRecords(hist);
  let html = `<h2>🏆 Сводная таблица</h2><table><thead><tr><th>#</th><th>Команда</th><th>Сезонов</th><th>В</th><th>П</th><th>Очки</th><th>🥇</th><th>🏆</th></tr></thead><tbody>${allTime.map((r, i) => `<tr><td style="color:#7a8299">${i + 1}</td><td>${r.name}</td><td>${r.seasons}</td><td>${r.w}</td><td>${r.l}</td><td style="font-weight:700">${r.pts}</td><td>${r.regular > 0 ? '🥇'.repeat(Math.min(r.regular, 3)) : '—'}</td><td>${r.cups > 0 ? '🏆'.repeat(Math.min(r.cups, 5)) : '—'}</td></tr>`).join('')}</tbody></table>`;
  html += renderAllTimeLeaders();
  hist.slice().reverse().forEach(h => {
    html += `<div class="season-card"><div class="head"><span class="season-num">Сезон ${h.season}</span><span class="champ">🥇 ${h.regularChampionName} · 🏆 ${h.championName}${h.openingCupWinnerName ? ` · ⚡ ${h.openingCupWinnerName}` : ''}</span></div>`;
    html += `<details><summary>Награды</summary>${renderAwards(h.awards)}</details>`;
    html += `<details><summary>Таблица</summary><table><thead><tr><th>#</th><th>Команда</th><th>В</th><th>П</th><th>О</th></tr></thead><tbody>${h.standings.map((t, i) => `<tr><td>${i + 1}</td><td>${t.name}</td><td>${t.w}</td><td>${t.l}</td><td>${t.pts}</td></tr>`).join('')}</tbody></table></details>`;
    html += `</div>`;
  });
  return html;
}

/* ============================================================
   МОДАЛКА ИГРОКА (с кнопкой реабилитации — фиксы #4/#13)
   ============================================================ */
function renderModal() {
  if (!G.popupPlayerId) return '';
  let foundPlayer = null, foundTeam = null;
  for (const t of G.league.teams) { const p = t.roster.find(x => x.id === G.popupPlayerId); if (p) { foundPlayer = p; foundTeam = t; break; } }
  if (!foundPlayer) foundPlayer = (G.league.freeAgents || []).find(x => x.id === G.popupPlayerId);
  if (!foundPlayer) { G.popupPlayerId = null; return ''; }
  const p = foundPlayer, isG = p.position === 'G', attrs = isG ? GOALIE_ATTRS : SKATER_ATTRS;
  const s = ensureStats(p); const ps = ensurePlayoffStats(p);
  const onBench = foundTeam && (foundTeam.bench || []).includes(p.id);
  const isMyTeam = foundTeam && foundTeam.id === G.playerTeamId;
  const mentor = isMyTeam ? getMentor(foundTeam, p.id) : null;
  const char = CHARACTERS[p.character] || CHARACTERS.calm;
  const healthBadges = [];
  if (onBench) healthBadges.push(`<span class="status-badge bench">🪑 Скамейка</span>`);
  if (p.injury && p.injury.gamesLeft > 0) {
    if (p.playingThroughPain) healthBadges.push(`<span class="status-badge pain">🩹 Боль (${p.injury.gamesLeft})</span>`);
    else healthBadges.push(`<span class="status-badge injured">🚑 Травма (${p.injury.gamesLeft})</span>`);
  } else if (p.fatigue > 80) healthBadges.push(`<span class="status-badge tired">😴 ${p.fatigue}/100</span>`);
  else if (p.fatigue < 20) healthBadges.push(`<span class="status-badge fresh">⚡ ${p.fatigue}/100</span>`);
  const attrRows = attrs.map(a => `<div class="attr-row"><span>${ATTR_LABELS[a]}</span><span>${p.attrs[a]} <span style="color:#7a8299;font-size:11px">/ ${p.attrPot[a]}</span></span></div>`).join('');
  const goalHtml = p.seasonGoal ? `<div class="attr-row"><span>🎯 ${p.seasonGoal.description}</span><span style="color:${p.seasonGoal.achieved === true ? '#4ade80' : p.seasonGoal.achieved === false ? '#ef4444' : '#fbbf24'}">${p.seasonGoal.achieved === true ? '✓' : p.seasonGoal.achieved === false ? '✗' : '⏳'}</span></div>` : '';
  const statsReg = isG ? `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${s.gp}</span></div><div class="attr-row"><span>Победы</span><span>${s.wins}</span></div><div class="attr-row"><span>SV%</span><span>${s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'}</span></div><div class="attr-row"><span>КН</span><span>${s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—'}</span></div></div>` : `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${s.gp}</span></div><div class="attr-row"><span>Голы</span><span>${s.goals}</span></div><div class="attr-row"><span>Передачи</span><span>${s.assists}</span></div><div class="attr-row"><span>Очки</span><span>${s.points}</span></div></div>`;
  const statsPo = isG ? `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${ps.gp}</span></div><div class="attr-row"><span>Победы</span><span>${ps.wins}</span></div><div class="attr-row"><span>SV%</span><span>${ps.shotsAgainst > 0 ? (ps.saves / ps.shotsAgainst).toFixed(3).replace(/^0/, '') : '—'}</span></div></div>` : `<div class="attr-grid"><div class="attr-row"><span>Игры</span><span>${ps.gp}</span></div><div class="attr-row"><span>Голы</span><span>${ps.goals}</span></div><div class="attr-row"><span>Очки</span><span>${ps.points}</span></div></div>`;
  const canExtend = isMyTeam && p.contract.years <= 1 && p.status === 'contract';
  const canRelease = isMyTeam && p.status === 'contract';
  const remainingSalary = p.contract.salary * Math.max(0, p.contract.years);
  const releaseCost = Math.round(remainingSalary * 0.5 * 10) / 10;
  const canIndTraining = isMyTeam && (G.league.currentRound - (p.lastIndTraining || -10)) >= 5;
  const attrButtons = canIndTraining ? attrs.filter(a => p.attrs[a] < p.attrPot[a]).map(a => `<button class="btn small secondary" onclick="handleIndTraining(${p.id}, '${a}')">${ATTR_LABELS[a]}</button>`).join('') : '';
  // ⚙️ ФИКС #4/#13: кнопка реабилитации для травмированного игрока моей команды
  const canRehab = isMyTeam && p.injury && p.injury.gamesLeft > 0
    && (G.league.currentRound - (foundTeam.lastRehabRound || -10)) >= 5;
  const rehabCost = Math.min(3, p.injury ? p.injury.gamesLeft : 0) * 1;
  return `<div class="modal-overlay" onclick="if(event.target===this){G.popupPlayerId=null; render();}">
    <div class="modal">
      <button class="close-btn" onclick="G.popupPlayerId=null; render();">✕</button>
      <h1 style="font-size:22px;margin-bottom:4px">${p.name} <span class="char-badge ${char.cls}">${char.label}</span></h1>
      <div class="subtitle">${p.position} · ${p.age} лет · ${p.nationality} · ${foundTeam ? foundTeam.name : 'Свободный агент'}</div>
      <div style="margin:12px 0">${healthBadges.join(' ')}</div>
      ${mentor ? `<div style="font-size:12px;color:#4ade80">🎓 Наставник: ${mentor.name}</div>` : ''}
      <div class="tag" style="margin:6px 0">${char.desc}</div>
      <h2>Атрибуты</h2><div class="attr-grid">${attrRows}</div>
      ${canIndTraining && attrButtons ? `<div style="margin-top:8px;background:#0f1117;padding:8px;border-radius:5px"><div class="tag" style="margin-bottom:6px">💪 Индивидуальная тренировка (0.5 млн ₽, раз в 5 туров)</div>${attrButtons}</div>` : ''}
      <h2>Форма и мораль</h2><div class="attr-grid"><div class="attr-row"><span>OVR</span><span>${p.ovr} (эфф. ${getEffectiveOvr(p)})</span></div><div class="attr-row"><span>Форма</span><span>${p.form}</span></div><div class="attr-row"><span>Мораль</span><span>${p.morale}</span></div></div>
      ${goalHtml ? `<h2>Цель</h2>${goalHtml}` : ''}
      <h2>Сезон (регулярка)</h2>${statsReg}
      <h2>Сезон (плей-офф)</h2>${statsPo}
      <h2>Контракт</h2><div class="attr-grid"><div class="attr-row"><span>Зарплата</span><span>${p.contract.salary.toFixed(1)} млн</span></div><div class="attr-row"><span>Лет</span><span>${p.contract.years}</span></div></div>
      ${canExtend ? `<div style="margin-top:12px"><button class="btn" onclick="handleExtend(${p.id}, 1)">Продлить на 1</button><button class="btn" onclick="handleExtend(${p.id}, 2)">Продлить на 2</button></div>` : ''}
      ${canRehab ? `<div style="margin-top:12px"><button class="btn" onclick="handleRehab(${p.id}, 3)">🏥 Реабилитация (3 игры, ${rehabCost} млн)</button></div>` : ''}
      ${canRelease ? `<div style="margin-top:12px"><button class="btn danger" onclick="handleRelease(${p.id})">🗑 Разорвать контракт (${releaseCost} млн)</button></div>` : ''}
    </div>
  </div>`;
}
function handleExtend(playerId, years) { const r = extendContract(playerId, years); if (r.success) alert(`Продлено! ЗП: ${r.salary} млн на ${years} лет`); else if (r.reason === 'contract too long') alert('Контракт длинный'); else alert(`Отказ. Запрос: ${r.salary} млн`); render(); }
function handleRehab(playerId, games) { const r = rehabPlayer(playerId, games); if (r.success) alert(`Реабилитация: ${r.gamesSkipped} игр. Стоимость: ${r.cost} млн`); else alert('Ошибка: ' + r.error); render(); }
function handleIndTraining(playerId, attr) { const r = individualTraining(playerId, attr); if (r.success) alert(`+1 к ${ATTR_LABELS[r.attr]}`); else alert('Ошибка: ' + r.error); render(); }
function handleRelease(playerId) { if (!confirm('Точно разорвать контракт? Компенсация 50% остатка зарплаты.')) return; const r = releasePlayer(playerId); if (r.success) alert(`Расторгнуто. Компенсация: ${r.cost} млн`); else alert('Ошибка: ' + r.error); G.popupPlayerId = null; render(); }
function extendContract(playerId, years) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, reason: 'not found' };
  if (p.contract.years > 1) return { success: false, reason: 'contract too long' };
  const marketSalary = contractFor(p.ovr, p.age).salary;
  const offeredSalary = Math.max(p.contract.salary, marketSalary);
  const moraleFactor = (p.morale - 40) / 100;
  const ageFactor = p.age > 33 ? -0.2 : 0.1;
  if (rng() < clamp(0.5 + moraleFactor * 0.5 + ageFactor, 0.05, 0.95)) {
    p.contract.years += years; p.contract.salary = Math.round(offeredSalary * 10) / 10;
    p.morale = Math.min(100, p.morale + 3);
    return { success: true, salary: p.contract.salary, years };
  }
  p.morale = Math.max(20, p.morale - 5);
  return { success: false, salary: offeredSalary };
}

/* ============================================================
   МОДАЛКА КОМАНДЫ
   ============================================================ */
function renderTeamModal() {
  if (!G.viewTeamId) return '';
  const team = G.league.teams.find(t => t.id === G.viewTeamId);
  if (!team) { G.viewTeamId = null; return ''; }
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const hasScout = myTeam && !!myTeam.staff.scout;
  const canSeeExtra = hasScout || team.id === G.playerTeamId;
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const totalSalary = team.roster.reduce((s, p) => s + p.contract.salary, 0);
  const r = getTeamRatings(team);
  const trendDef = { up: { icon: '↗', label: 'Растёт', color: '#4ade80' }, down: { icon: '↘', label: 'Падает', color: '#ef4444' }, stable: { icon: '→', label: 'Стабильно', color: '#9aa3b8' }, newcomer: { icon: '🆕', label: 'Новичок лиги', color: '#60a5fa' } };
  const trend = trendDef[team.trend] || trendDef.stable;
  const initials = getInitials(team.name);
  const logoHtml = team.logo
    ? `<img src="${team.logo}" class="team-logo-big" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="team-logo-fallback" style="display:none">${initials}</div>`
    : `<div class="team-logo-fallback">${initials}</div>`;
  const historyRows = (team.history && team.history.length)
    ? team.history.map(h => `<tr><td>${h.season}</td><td style="font-weight:700">${h.place}</td><td>${h.pts}</td><td>${h.playoff === 'champion' ? '🏆 чемпион' : h.playoff === 'finalist' ? 'финалист' : h.playoff === 'semifinal' ? '1/2' : h.playoff === 'quarterfinal' ? '1/4' : h.playoff === 'round16' ? '1/8' : '—'}</td></tr>`).join('')
    : `<tr><td colspan="4" style="color:#7a8299">История клуба начинается с текущего сезона</td></tr>`;
  const trophyRow = (label, arr) => arr && arr.length ? `<div class="attr-row"><span>${label}</span><span style="color:#fbbf24">${arr.join(', ')}</span></div>` : `<div class="attr-row"><span>${label}</span><span style="color:#7a8299">—</span></div>`;
  const trophiesHtml = `<div class="attr-grid">${trophyRow('🏆 Кубок Петрова', team.trophies.petrov)}${trophyRow('🥇 Регулярка', team.trophies.regular)}${trophyRow('⚡ Матч Открытия', team.trophies.opening)}</div>`;
  let topPlayersHtml = `<div class="subtitle" style="font-size:12px">Нет данных</div>`;
  if (G.league.allTimeLeaders && G.league.allTimeLeaders.skaters) {
    const all = Object.values(G.league.allTimeLeaders.skaters);
    const top = all.filter(p => !p.isG).sort((a, b) => b.points - a.points).slice(0, 5);
    if (top.length) topPlayersHtml = `<table><thead><tr><th>#</th><th>Игрок</th><th>И</th><th>О</th></tr></thead><tbody>${top.map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td class="stat-cell">${e.gp}</td><td class="stat-cell" style="color:#ff6b35;font-weight:700">${e.points}</td></tr>`).join('')}</tbody></table>`;
  }
  const rivalsHtml = team.rivals && team.rivals.length ? team.rivals.map(name => `<span class="status-badge" style="margin-right:6px;margin-bottom:4px">${name}</span>`).join('') : `<span class="tag">Исторических соперников нет</span>`;
  const talentHtml = `<div class="attr-grid"><div class="attr-row"><span>Talent (состав)</span><span style="color:#4ade80;font-weight:700">${(team.talent || 70).toFixed(1)}</span></div><div class="attr-row"><span>Prestige (репутация)</span><span style="color:#fbbf24;font-weight:700">${team.prestige || 50}</span></div><div class="attr-row"><span>ATT</span><span>${r.att}</span></div><div class="attr-row"><span>DEF</span><span>${r.def}</span></div><div class="attr-row"><span>GK</span><span>${r.gk}</span></div><div class="attr-row"><span>ST</span><span>${r.st}</span></div></div>`;
  const financeHtml = canSeeExtra ? `<h2>Финансы</h2><div class="attr-grid"><div class="attr-row"><span>Бюджет</span><span>${team.finance.seasonBudget} млн ₽</span></div><div class="attr-row"><span>ЗП игроков</span><span>${Math.round(totalSalary)} млн ₽</span></div><div class="attr-row"><span>Потолок</span><span>${team.finance.salaryCap} млн ₽</span></div><div class="attr-row"><span>Арена</span><span>${team.finance.arenaCapacity.toLocaleString()}</span></div><div class="attr-row"><span>Фанбаза</span><span>${(team.finance.fanBase * 100).toFixed(0)}%</span></div><div class="attr-row"><span>Ур. арены</span><span>${team.arenaLevel}/5</span></div></div>` : `<div class="subtitle" style="margin-top:12px">💡 Найми скаута, чтобы видеть финансы соперника</div>`;
  const playerRow = (p) => {
    const s = ensureStats(p); const isG = p.position === 'G';
    const sv = s.shotsAgainst > 0 ? (s.saves / s.shotsAgainst).toFixed(3).replace(/^0/, '') : '—';
    const gaa = s.gp > 0 ? (s.goalsAgainst / s.gp).toFixed(2) : '—';
    const char = CHARACTERS[p.character] || CHARACTERS.calm;
    const statsCells = isG ? `<td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.wins}</td><td class="stat-cell">${sv}</td><td class="stat-cell">${gaa}</td>` : `<td class="stat-cell">${s.gp}</td><td class="stat-cell">${s.goals}</td><td class="stat-cell">${s.assists}</td><td class="stat-cell">${s.points}</td>`;
    const health = (p.injury && p.injury.gamesLeft > 0) ? ' 🚑' : '';
    return `<tr><td><span class="pos ${isG ? 'G' : p.position === 'D' ? 'D' : 'F'}">${p.position}</span></td><td>${p.name}${health} <span class="char-badge ${char.cls}">${char.label}</span></td><td>${p.age}</td><td class="ovr ${p.ovr >= 85 ? 'hi' : p.ovr >= 75 ? 'mid' : 'lo'}">${p.ovr}</td>${statsCells}</tr>`;
  };
  const skaters = team.roster.filter(p => p.position !== 'G').sort((a,b) => b.ovr - a.ovr);
  const goalies = team.roster.filter(p => p.position === 'G').sort((a,b) => b.ovr - a.ovr);
  const rosterHtml = canSeeExtra ? `<h2>Состав (${skaters.length} + ${goalies.length})</h2><table><thead><tr><th>Поз</th><th>Имя</th><th>Возраст</th><th>OVR</th><th>И</th><th>Г/В</th><th>А/SV%</th><th>О/КН</th></tr></thead><tbody>${skaters.slice(0, 12).map(playerRow).join('')}${goalies.map(playerRow).join('')}</tbody></table>` : '';
  return `<div class="modal-overlay" onclick="if(event.target===this){G.viewTeamId=null; render();}">
    <div class="modal">
      <button class="close-btn" onclick="G.viewTeamId=null; render();">✕</button>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">
        ${logoHtml}
        <div style="flex:1">
          <h1 style="font-size:24px;margin-bottom:4px">${team.name}</h1>
          <div class="subtitle" style="margin-bottom:8px">${team.city} · ${team.region} · #${rank} в таблице</div>
          <span class="trend-badge" style="background:${trend.color}22;color:${trend.color}">${trend.icon} ${trend.label}</span>
        </div>
      </div>
      <h2>Сила</h2>${talentHtml}
      ${financeHtml}
      <h2>История (5 сезонов)</h2>
      <table><thead><tr><th>Сезон</th><th>Место</th><th>Очки</th><th>Плей-офф</th></tr></thead><tbody>${historyRows}</tbody></table>
      <h2>Трофеи</h2>${trophiesHtml}
      <h2>Лучшие игроки (всего)</h2>${topPlayersHtml}
      <h2>Исторические соперники</h2><div>${rivalsHtml}</div>
      ${rosterHtml}
    </div>
  </div>`;
}

/* ============================================================
   МОДАЛКИ: ПРЕСС / ТРАВМЫ / МАТЧ ОТКРЫТИЯ
   ============================================================ */
function renderPressConferenceModal() {
  if (!G.pressConference) return '';
  const pc = G.pressConference; const q = pc.questions[pc.current];
  if (!q) { G.pressConference = null; return ''; }
  return `<div class="modal-overlay"><div class="modal"><h1 style="font-size:20px">📰 Пресс-конференция</h1><div class="subtitle">Вопрос ${pc.current + 1} из ${pc.questions.length}</div><div class="press-question"><div class="pq-text">${q.q}</div>${q.answers.map((a, i) => `<button class="press-answer" onclick="answerPressQuestion(${pc.current}, ${i})">${a.label}</button>`).join('')}</div></div></div>`;
}
function renderPlayoffInjuryModal() {
  if (!G.playoffInjuryPrompt) return '';
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.playoffInjuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  return `<div class="modal-overlay"><div class="modal"><h1 style="font-size:20px">🚑 Травмы перед серией</h1><div style="display:flex;flex-direction:column;gap:10px">${injured.map(p => `<div class="press-question"><div class="pq-text">${p.name} (${p.position}, ${p.ovr}) — ${p.injury.gamesLeft} игр</div><button class="press-answer" onclick="playoffInjuryChoice(${p.id}, true)">🩹 Играть через боль</button><button class="press-answer" onclick="playoffInjuryChoice(${p.id}, false)">🛌 Отдохнуть</button></div>`).join('')}</div><div style="margin-top:14px"><button class="btn" onclick="confirmPlayoffInjury()">Готово</button></div></div></div>`;
}
function playoffInjuryChoice(playerId, playThrough) {
  if (!G.playoffInjuryPrompt) return;
  if (!G.playoffInjuryPrompt.choices) G.playoffInjuryPrompt.choices = {};
  G.playoffInjuryPrompt.choices[playerId] = playThrough; render();
}
function confirmPlayoffInjury() {
  if (!G.playoffInjuryPrompt) return;
  resolvePlayoffInjury(G.playoffInjuryPrompt.choices || {});
}
function renderInjuryPromptModal() {
  if (!G.injuryPrompt) return '';
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.injuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  const choices = G.injuryPrompt.choices || {};
  return `<div class="modal-overlay">
    <div class="modal">
      <h1 style="font-size:20px;margin-bottom:8px">🚑 Травмированные в составе</h1>
      <div class="subtitle">Выберите действие для каждого. Политика запомнится для этого игрока.</div>
      ${injured.map(p => {
        const c = choices[p.id];
        return `<div class="press-question">
          <div class="pq-text">${p.name} (${p.position}, ${p.ovr}) — травма ${p.injury.gamesLeft} игр</div>
          <button class="press-answer ${c === 'once' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'once')">🔁 Заменить только на этот матч</button>
          <button class="press-answer ${c === 'period' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'period')">📅 Заменить до конца травмы</button>
          <button class="press-answer ${c === 'pain' ? 'active-policy' : ''}" onclick="setInjuryPolicy(${p.id}, 'pain')">🩹 Через боль (−15% OVR, риск)</button>
        </div>`;
      }).join('')}
      <div style="margin-top:14px">
        <label class="no-fire-checkbox"><input type="checkbox" ${G.skipInjuryPrompt ? 'checked' : ''} onchange="G.skipInjuryPrompt=this.checked;"> Больше не спрашивать (по умолчанию «до конца травмы»)</label>
      </div>
      <div style="margin-top:14px"><button class="btn" onclick="applyInjuryPolicies()">Готово</button></div>
    </div>
  </div>`;
}
function renderOpeningCupModal() {
  if (!G.openingCupModal) return '';
  const m = G.openingCupModal;
  const highlight = m.isMyTeam ? `<div style="color:#4ade80;font-weight:700;margin-top:8px">🏆 Вы выиграли Матч Открытия! +5 млн ₽</div>` : `<div style="color:#ef4444;font-weight:700;margin-top:8px">Поражение в Матче Открытия</div>`;
  return `<div class="modal-overlay" onclick="if(event.target===this){G.openingCupModal=null; render();}">
    <div class="modal">
      <h1 style="font-size:22px;margin-bottom:12px">⚡ Матч Открытия</h1>
      <div class="champion" style="font-size:18px;padding:16px">${m.teamA.name} ${m.hgA}:${m.hgB} ${m.teamB.name}${m.ot ? ' (ОТ)' : ''}</div>
      <div style="text-align:center;color:#c0c7d8;margin-top:12px">Победитель: <b style="color:#4ade80">${m.winner.name}</b></div>
      ${highlight}
      <div style="margin-top:20px;text-align:center"><button class="btn" onclick="G.openingCupModal=null; render();">Продолжить</button></div>
    </div>
  </div>`;
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
      seed: _seed,  // ⚙️ ФИКС #9
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
    _seed = data.seed || 20241111;
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
