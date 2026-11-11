/* ============================================================
   ГЛОБАЛЬНОЕ СОСТОЯНИЕ
   ============================================================ */
const G = {
  league: null, playerTeamId: null, activeTab: 'overview', screen: 'title',
  settings: { accent: 'orange', compactNav: false, reducedMotion: false, confirmNewGame: true },
  navGroupOpen: null,
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
  lastRoundResults: null,
  lastRoundNumber: null,
  liveMatch: null,
  youthPlayerModal: null,
};
