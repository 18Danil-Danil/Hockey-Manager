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
