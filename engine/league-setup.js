/* ============================================================
   РАСПИСАНИЕ / ЛИГА
   ============================================================ */
function makeSchedule(teams) {
  const arr = teams.slice();
  const n = arr.length;
  const singleRounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const a = arr[i], b = arr[n - 1 - i];
      round.push([a.id, b.id]);
    }
    singleRounds.push(round);
    arr.splice(1, 0, arr.pop());
  }

  // Домашние/выездные серии: стараемся формировать блоки по 3 матча,
  // допускаем 2–4 подряд и сохраняем баланс домашних/гостевых игр.
  const state = new Map(teams.map(team => [team.id, {
    lastSide: null, streak: 0, home: 0, away: 0,
  }]));
  const pairings = [...singleRounds, ...singleRounds];
  return pairings.map((round, roundIndex) => round.map(([aId, bId]) => {
    const a = state.get(aId), b = state.get(bId);
    const sideScore = (entry, side) => {
      let score = 0;
      if (entry.lastSide === side) score += entry.streak >= 3 ? -100 : 12 - entry.streak * 2;
      else if (entry.streak >= 3) score += 10;
      const balance = entry.home - entry.away;
      score += side === 'home' ? -balance * 3 : balance * 3;
      return score;
    };
    const aHomeScore = sideScore(a, 'home') + sideScore(b, 'away');
    const bHomeScore = sideScore(b, 'home') + sideScore(a, 'away');
    let aIsHome;
    if (aHomeScore === bHomeScore) {
      const key = `${aId}:${bId}:${roundIndex}`;
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
      aIsHome = hash % 2 === 0;
    } else aIsHome = aHomeScore > bHomeScore;

    const assignments = aIsHome
      ? [[aId, 'home'], [bId, 'away']]
      : [[bId, 'home'], [aId, 'away']];
    assignments.forEach(([id, side]) => {
      const entry = state.get(id);
      if (entry.lastSide === side) entry.streak++;
      else { entry.lastSide = side; entry.streak = 1; }
      entry[side]++;
    });
    return aIsHome ? [aId, bId] : [bId, aId];
  }));
}

function makeScheduleMeta(season, roundCount) {
  const match = String(season || '').match(/(\\d{4})/);
  const startYear = match ? Number(match[1]) : 2026;
  const date = new Date(Date.UTC(startYear, 8, 5));
  const intervals = [3, 3, 3, 3, 4];
  const meta = [];
  for (let round = 0; round < roundCount; round++) {
    meta.push({ round, date: date.toISOString().slice(0, 10) });
    const previousMonth = date.getUTCMonth();
    date.setUTCDate(date.getUTCDate() + intervals[round % intervals.length]);
    // Короткая пауза на Новый год: команды возвращаются к матчам после 4 января.
    if (previousMonth === 11 && date.getUTCMonth() === 0 && date.getUTCDate() < 5) {
      date.setUTCDate(5);
    }
  }
  return meta;
}

function ensureScheduleCalendar(league) {
  if (!league || !Array.isArray(league.schedule)) return [];
  if (!Array.isArray(league.scheduleMeta) || league.scheduleMeta.length !== league.schedule.length) {
    league.scheduleMeta = makeScheduleMeta(league.season, league.schedule.length);
  }
  return league.scheduleMeta;
}

function genLeague() {
  resetPlayerNameRegistry();
  const teams = VHL_TEAMS.map(meta => genTeam(meta));
  const season = '2026/27';
  const schedule = makeSchedule(teams);
  const league = {
    season, teams, schedule, scheduleMeta: makeScheduleMeta(season, schedule.length),
    currentRound: 0, results: [],
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
