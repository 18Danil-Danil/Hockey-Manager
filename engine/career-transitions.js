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
    season: G.league.history?.[G.league.history.length - 1]?.season || normalizeSeasonLabel(G.league.season),
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
