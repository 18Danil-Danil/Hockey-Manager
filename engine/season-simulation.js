/* Управление симуляцией тура и сезона */
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
  const roundNumber = G.league.currentRound + 1;
  const round = G.league.schedule[G.league.currentRound];
  const roundResults = [];
  G.lastRoundResults = null;
  round.forEach(([h, a]) => {
    const res = simGame(h, a, false);
    res.round = G.league.currentRound;
    applyResult(res);
    G.league.results.push(res);
    roundResults.push({ homeId: res.homeId, awayId: res.awayId, hg: res.hg, ag: res.ag, ot: !!res.ot });
  });
  simYouthRoundBoth(true);
  G.lastRoundNumber = roundNumber;
  G.lastRoundResults = roundResults;
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
  G.lastRoundResults = null;
  G.lastRoundNumber = null;
  const injured = checkInjuredStarters();
  if (injured.length > 0) {
    G.injuryPrompt = { injured: injured.map(p => p.id), choices: {} };
    render();
    return;
  }
  while (G.league.currentRound < G.league.schedule.length) {
    const round = G.league.schedule[G.league.currentRound];
    round.forEach(([h, a]) => { const res = simGame(h, a, false); res.round = G.league.currentRound; applyResult(res); G.league.results.push(res); });
    simYouthRoundBoth(true);
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

