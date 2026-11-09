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
