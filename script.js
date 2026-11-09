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
