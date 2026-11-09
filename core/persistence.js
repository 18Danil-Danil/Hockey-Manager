/* ============================================================
   СОХРАНЕНИЕ (с seed — фикс #9)
   ============================================================ */
const SAVE_KEY = 'hockey_save_v2';

function saveGame() {
  if (!G.league) return false;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      league: G.league, playerTeamId: G.playerTeamId, activeTab: G.activeTab, screen: G.screen,
      standingsSort: G.standingsSort, idCounter: _idCounter,
      selectedDifficulty: G.selectedDifficulty, noFireMode: G.noFireMode, career: G.career,
      careerOffers: G.careerOffers, freeAgentOffers: G.freeAgentOffers,
      lastRegularChampionId: G.lastRegularChampionId, lastCupHolderId: G.lastCupHolderId, lastFinalistId: G.lastFinalistId,
      seed: getSeed(),  // ⚙️ ФИКС #9
    }));
    return true;
  } catch (e) {
    // Не скрываем ошибки хранилища: игрок должен знать, что прогресс не сохранён.
    if (typeof showToast === 'function' && document.visibilityState !== 'hidden') {
      showToast('Не удалось сохранить карьеру. Проверьте свободное место и настройки браузера.', 'error', 6000);
    }
    console.error('Ошибка сохранения карьеры:', e);
    return false;
  }
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
      if (t.govSupport === undefined) t.govSupport = meta ? meta.govSupport : 2;
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

// Мобильные браузеры могут выгружать вкладку при переключении приложений.
// Сохраняем карьеру при уходе со страницы, но не перезаписываем её
// промежуточной статистикой незавершённого LIVE-матча.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !G.liveMatch) saveGame();
});
window.addEventListener('pagehide', () => {
  if (!G.liveMatch) saveGame();
});
