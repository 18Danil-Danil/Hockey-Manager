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
    season: '2026/27', teams, schedule: makeSchedule(teams), currentRound: 0, results: [],
    playoffs: null, history: [], transferLog: [], freeAgents: [], staffPool: [], waivers: [],
    aiTradeOffers: [], allTimeLeaders: { skaters: {} }, inbox: [], news: [],
    retiredPlayers: [], openingCup: null, retroMatch: null,
    tradeDeadlineNotified: false,
    youth: initYouthLeagues(),
  };
  teams.forEach(t => { t.staff.headCoach = { id: nextId(), role: 'headCoach', name: pick(FIRST) + ' ' + pick(LAST), level: 2, xp: 0, salary: 2.4, age: randInt(38, 58) }; });
  teams.forEach(t => { const cands = t.roster.filter(p => p.ovr >= 65 && p.age >= 22 && p.age <= 32); if (cands.length) pick(cands).onTradeBlock = true; });
  teams.forEach(t => assignSeasonGoals(t));
  return league;
}