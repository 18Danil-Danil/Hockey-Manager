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
