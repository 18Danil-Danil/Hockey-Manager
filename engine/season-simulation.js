/* Управление симуляцией тура и сезона */
/* ============================================================
   СИМ ТУРА / СЕЗОНА
   ============================================================ */
function simRound(forceNoPrompt = false) {
  if (G.injuryPrompt) return;
  const round = G.league.schedule[G.league.currentRound] || [];
  const playerHasGameToday = !!G.playerTeamId && round.some(([homeId, awayId]) => homeId === G.playerTeamId || awayId === G.playerTeamId);
  if (!forceNoPrompt && !G.skipInjuryPrompt && playerHasGameToday) {
    const injured = checkInjuredStarters();
    if (injured.length > 0) {
      G.injuryPrompt = { injured: injured.map(p => p.id), choices: {} };
      render();
      return;
    }
  }
  if (forceNoPrompt && G.skipInjuryPrompt && playerHasGameToday) {
    const team = G.league.teams.find(t => t.id === G.playerTeamId);
    if (team) for (const p of team.roster) if (p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) p.injuryPolicy = 'period';
  }
  if (G.league.currentRound >= G.league.schedule.length) return;
  const roundNumber = G.league.currentRound + 1;
  const scheduleScale = G.league.schedule.length / 58;
  const scaledInterval = base => Math.max(1, Math.round(base * scheduleScale));
  const roundResults = [];
  G.lastRoundResults = null;
  round.forEach(([h, a]) => {
    const res = simGame(h, a, false);
    res.round = G.league.currentRound;
    applyResult(res);
    G.league.results.push(res);
    roundResults.push({ homeId: res.homeId, awayId: res.awayId, hg: res.hg, ag: res.ag, ot: !!res.ot });
  });
  generateLeagueMatchNews(roundResults);
  generatePlayerStories();
  simYouthRoundBoth(true, G.league.currentRound + 1);
  G.lastRoundNumber = roundNumber;
  G.lastRoundResults = roundResults;
  G.league.currentRound++;
  processLoanExtensionNegotiations();
  processLoanExpirations();
  G.league.teams.filter(team => team.id === G.playerTeamId).forEach(processLockerRoomMeetings);
  G.league.teams.filter(team => team.id === G.playerTeamId).forEach(processPlayerRelations);
  const activeTeamIds = new Set(round.flatMap(([homeId, awayId]) => [homeId, awayId]));
  G.league.teams.filter(t => activeTeamIds.has(t.id)).forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); checkScoutMission(t); });
  if (G.league.currentRound % scaledInterval(10) === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
  if (G.league.currentRound % scaledInterval(3) === 0) processWaivers();
  if (G.league.currentRound % scaledInterval(4) === 0) runAIActions();
  if (G.league.currentRound % scaledInterval(8) === 0) updateStaffPool();
  if (G.league.currentRound % scaledInterval(3) === 0 && rng() < 0.3) generateRandomEvent();
  if (G.league.currentRound % scaledInterval(3) === 0) generateBoardMessage();
  checkTradeDeadlineNews();
  if (G.league.currentRound === scaledInterval(15) && !G.league.retroMatch) triggerRetroMatch();
  if (G.league.currentRound === G.league.schedule.length) createPlayoffs();
  if (G.league.currentRound % scaledInterval(3) === 0) maybeStartPressConference();
  if (G.playerTeamId && activeTeamIds.has(G.playerTeamId)) {
    if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; render(); return; } }
    else { if (maybeFirePlayer()) { G.activeTab = 'career'; render(); return; } }
  }
  render();
}
function advanceToMyNextMatch() {
  const teamId = G.playerTeamId;
  if (!teamId || G.liveMatch) return;
  while (G.league.currentRound < G.league.schedule.length) {
    const round = G.league.schedule[G.league.currentRound] || [];
    const fixture = round.find(([homeId, awayId]) => homeId === teamId || awayId === teamId);
    if (fixture) {
      const injured = checkInjuredStarters();
      if (injured.length) {
        G.injuryPrompt = { injured: injured.map(player => player.id), choices: {} };
        render();
        return;
      }
      startMyLiveMatch();
      return;
    }
    const previousRound = G.league.currentRound;
    simRound(true);
    if (G.league.currentRound <= previousRound || G.playerTeamId !== teamId) return;
  }
  showToast('В регулярном чемпионате больше нет матчей для твоей команды', 'info');
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
  const scheduleScale = G.league.schedule.length / 58;
  const scaledInterval = base => Math.max(1, Math.round(base * scheduleScale));
  while (G.league.currentRound < G.league.schedule.length) {
    const round = G.league.schedule[G.league.currentRound];
    const roundResults = [];
    round.forEach(([h, a]) => {
      const res = simGame(h, a, false);
      res.round = G.league.currentRound;
      applyResult(res);
      G.league.results.push(res);
      roundResults.push({ homeId: res.homeId, awayId: res.awayId, hg: res.hg, ag: res.ag, ot: !!res.ot });
    });
    generateLeagueMatchNews(roundResults);
    generatePlayerStories();
    simYouthRoundBoth(true, G.league.currentRound + 1);
    G.league.currentRound++;
    processLoanExtensionNegotiations();
  processLoanExpirations();
    G.league.teams.filter(team => team.id === G.playerTeamId).forEach(processLockerRoomMeetings);
  G.league.teams.filter(team => team.id === G.playerTeamId).forEach(processPlayerRelations);
    const activeTeamIds = new Set(round.flatMap(([homeId, awayId]) => [homeId, awayId]));
    G.league.teams.filter(t => activeTeamIds.has(t.id)).forEach(t => { paySalaries(t); paySponsors(t); processMerchRevenue(t); checkScoutMission(t); });
    if (G.league.currentRound % scaledInterval(10) === 0) G.league.teams.forEach(t => { payTVInstallment(t); processSponsorPayouts(t); });
    if (G.league.currentRound % scaledInterval(3) === 0) processWaivers();
    if (G.league.currentRound % scaledInterval(4) === 0) runAIActions();
    if (G.league.currentRound % scaledInterval(8) === 0) updateStaffPool();
    if (G.league.currentRound % scaledInterval(3) === 0 && rng() < 0.3) generateRandomEvent();
    if (G.league.currentRound % scaledInterval(3) === 0) generateBoardMessage();
    checkTradeDeadlineNews();
    if (G.playerTeamId && activeTeamIds.has(G.playerTeamId)) {
      if (G.career.noFireMode) { if (maybeForcedFreeAgent()) { G.activeTab = 'career'; render(); return; } }
      else { if (maybeFirePlayer()) { G.activeTab = 'career'; render(); return; } }
    }
  }
  createPlayoffs();
  maybeStartPressConference();
  render();
}

