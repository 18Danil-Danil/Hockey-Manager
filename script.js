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
