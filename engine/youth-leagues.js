/* ============================================================
   МОЛОДЁЖНЫЕ ЛИГИ: модель, составы и симуляция
   МХЛ — Молодёжный чемпионат; РХЛ — Молодёжное первенство.
   Обе лиги используют общий возрастной диапазон.
   ============================================================ */
const YOUTH_RULES = {
  minAge: 15,
  maxAge: 20,
  promotionPlaces: 2,
  relegationPlaces: 2,
  rosterSize: 20,
  mhlOvrMin: 52,
  mhlOvrMax: 66,
  rhlOvrMin: 46,
  rhlOvrMax: 60,
};

function createYouthPlayer(position, leagueId, season = 1) {
  const isGoalie = position === 'G';
  const minOvr = leagueId === 'MHL' ? YOUTH_RULES.mhlOvrMin : YOUTH_RULES.rhlOvrMin;
  const maxOvr = leagueId === 'MHL' ? YOUTH_RULES.mhlOvrMax : YOUTH_RULES.rhlOvrMax;
  const player = genPlayer(position, randInt(minOvr, maxOvr), { status: 'youth' });
  player.age = randInt(YOUTH_RULES.minAge, YOUTH_RULES.maxAge);
  player.attrPot = generateAttrPot(player.attrs, player.age, isGoalie);
  player.pot = overallFromAttrs(player.attrPot, isGoalie);
  player.contract = contractFor(player.ovr, player.age);
  player.status = 'youth';
  player.stats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, wins: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 };
  player.youth = {
    joinedSeason: season,
    development: 'normal',
    graduated: false,
    signedBySeniorClubId: null,
  };
  return player;
}

function createYouthRoster(leagueId, season = 1) {
  const positions = ['G', 'G', 'G', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'C', 'C', 'C', 'LW', 'LW', 'LW', 'RW', 'RW', 'RW', 'C'];
  return positions.map(position => createYouthPlayer(position, leagueId, season));
}

function createYouthTeam(meta) {
  const organization = window.YOUTH_CLUBS.organizations.find(item => item.id === meta.org);
  return {
    id: meta.id,
    name: meta.name,
    leagueId: meta.league,
    organizationId: meta.org,
    organizationName: organization ? organization.name : meta.name,
    independent: organization ? organization.independent : true,
    seniorLinks: [...(meta.senior || [])],
    roster: createYouthRoster(meta.league),
    coach: null,
    budget: { source: organization && organization.independent ? 'independent' : 'club-system', balance: 0 },
    record: { gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 },
    stats: { goals: [], goalies: [] },
    history: [],
    standing: null,
  };
}

function createYouthCompetition(leagueId, teams, season = 1) {
  return {
    id: leagueId,
    name: leagueId === 'MHL' ? 'Молодёжный чемпионат' : 'Молодёжное первенство',
    season,
    teams,
    schedule: makeSchedule(teams),
    currentRound: 0,
    results: [],
    table: [],
    history: [],
    championId: null,
    topScorerId: null,
  };
}

function initYouthLeagues() {
  const registry = window.YOUTH_CLUBS.teams;
  const mhlTeams = registry.filter(meta => meta.league === 'MHL').map(createYouthTeam);
  const rhlTeams = registry.filter(meta => meta.league === 'RHL').map(createYouthTeam);
  return {
    season: 1,
    rules: { ...YOUTH_RULES },
    leagues: {
      MHL: createYouthCompetition('MHL', mhlTeams),
      RHL: createYouthCompetition('RHL', rhlTeams),
    },
    graduates: [],
    transferLog: [],
    promotionHistory: [],
    generatedAtSeason: 1,
  };
}

function normalizeYouthLeagues() {
  const youth = G.league && G.league.youth;
  if (!youth) {
    if (G.league) G.league.youth = initYouthLeagues();
    return;
  }
  youth.graduates = youth.graduates || [];
  youth.transferLog = youth.transferLog || [];
  youth.promotionHistory = youth.promotionHistory || [];
  G.league.freeAgents = G.league.freeAgents || [];
  // Миграция сохранений, созданных до появления общего рынка выпускников.
  youth.graduates = youth.graduates.map(item => {
    if (!item.player) return item;
    const player = item.player;
    player.status = 'ufa';
    player.contract = player.contract || contractFor(player.ovr, player.age);
    player.youthGraduated = {
      formerTeamId: item.formerTeamId,
      formerTeamName: item.formerTeamName,
      season: item.season,
    };
    if (!G.league.freeAgents.some(candidate => candidate.id === player.id)) G.league.freeAgents.push(player);
    return {
      playerId: player.id, name: player.name, position: player.position,
      age: player.age, ovr: player.ovr, formerTeamId: item.formerTeamId,
      formerTeamName: item.formerTeamName, season: item.season,
      status: item.status || 'available',
      signedByTeamId: null, signedByTeamName: null,
    };
  });
  for (const league of Object.values(youth.leagues || {})) {
    if (!Array.isArray(league.teams)) league.teams = [];
    if (!Array.isArray(league.schedule) || !league.schedule.length) league.schedule = makeSchedule(league.teams);
    league.results = league.results || [];
    league.history = league.history || [];
    league.currentRound = league.currentRound || 0;
    for (const team of league.teams) {
      team.record = team.record || { gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      team.history = team.history || [];
      team.roster = team.roster || [];
      for (const player of team.roster) {
        player.stats = player.stats || { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, wins: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 };
        player.youth = player.youth || { joinedSeason: 1, development: 'normal', graduated: false, signedBySeniorClubId: null };
        player.attrPot = player.attrPot || generateAttrPot(player.attrs, player.age, player.position === 'G');
        player.pot = player.pot || overallFromAttrs(player.attrPot, player.position === 'G');
        player.contract = player.contract || contractFor(player.ovr, player.age);
        player.status = 'youth';
      }
      while (team.roster.length < YOUTH_RULES.rosterSize) {
        team.roster.push(createYouthPlayer(pick(['C', 'LW', 'RW', 'D', 'G']), league.id, youth.season || 1));
      }
    }
  }
}

function youthTeamRating(team, role) {
  const players = team.roster.filter(p => role === 'goalie' ? p.position === 'G' : role === 'defense' ? p.position === 'D' : p.position !== 'D' && p.position !== 'G');
  if (!players.length) return 50;
  return players.reduce((sum, player) => sum + player.ovr, 0) / players.length;
}

function youthMatchLineup(team) {
  const goalies = team.roster.filter(p => p.position === 'G').sort((a, b) => b.ovr - a.ovr);
  const defense = team.roster.filter(p => p.position === 'D').sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  const forwards = team.roster.filter(p => !['G', 'D'].includes(p.position)).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  return { goalie: goalies[0] || null, skaters: [...defense, ...forwards] };
}

function youthScoreTeam(team, opponent) {
  const attack = youthTeamRating(team, 'forward') * 0.65 + youthTeamRating(team, 'defense') * 0.35;
  const opponentDefense = youthTeamRating(opponent, 'defense') * 0.65 + youthTeamRating(opponent, 'goalie') * 0.35;
  return clamp(2.7 + (attack - opponentDefense) * 0.075, 0.45, 6.5);
}

function recordYouthScorers(team, goalsFor, goalsAgainst) {
  const lineup = youthMatchLineup(team);
  for (const player of lineup.skaters) player.stats.gp++;
  if (lineup.goalie) {
    lineup.goalie.stats.gp++;
    const shotsAgainst = Math.max(goalsAgainst, Math.round(poisson(23)));
    lineup.goalie.stats.shotsAgainst += shotsAgainst;
    lineup.goalie.stats.goalsAgainst += goalsAgainst;
    lineup.goalie.stats.saves += Math.max(0, shotsAgainst - goalsAgainst);
    if (goalsAgainst === 0) lineup.goalie.stats.shutouts++;
  }
  for (let i = 0; i < goalsFor; i++) {
    if (!lineup.skaters.length) break;
    const scorer = pickWeighted(lineup.skaters, p => Math.max(1, p.ovr * (p.position === 'D' ? 0.55 : 1)));
    scorer.stats.goals++;
    scorer.stats.points++;
    scorer.stats.shots++;
    const available = lineup.skaters.filter(p => p.id !== scorer.id);
    const assists = rng() < 0.15 ? 0 : rng() < 0.4 ? 1 : 2;
    for (let n = 0; n < assists && available.length; n++) {
      const assister = pickWeighted(available, p => Math.max(1, p.ovr));
      assister.stats.assists++;
      assister.stats.points++;
      available.splice(available.indexOf(assister), 1);
    }
  }
}

function applyYouthRecord(team, goalsFor, goalsAgainst, overtime, won) {
  const r = team.record;
  r.gp++;
  r.gf += goalsFor;
  r.ga += goalsAgainst;
  if (won) {
    if (overtime) r.otw++;
    else r.w++;
    r.pts += 2;
  } else if (overtime) {
    r.otl++;
    r.pts++;
  } else r.l++;
}

function simulateYouthMatch(home, away, roundNumber) {
  let hg = poisson(youthScoreTeam(home, away));
  let ag = poisson(youthScoreTeam(away, home));
  let overtime = false;
  if (hg === ag) {
    overtime = true;
    const homePower = youthTeamRating(home, 'forward') + youthTeamRating(home, 'goalie');
    const awayPower = youthTeamRating(away, 'forward') + youthTeamRating(away, 'goalie');
    const homeWins = rng() < clamp(0.5 + (homePower - awayPower) * 0.006, 0.25, 0.75);
    if (homeWins) hg++;
    else ag++;
  }
  const homeWon = hg > ag;
  applyYouthRecord(home, hg, ag, overtime, homeWon);
  applyYouthRecord(away, ag, hg, overtime, !homeWon);
  recordYouthScorers(home, hg, ag);
  recordYouthScorers(away, ag, hg);
  return { round: roundNumber, homeId: home.id, awayId: away.id, hg, ag, overtime, winnerId: homeWon ? home.id : away.id };
}

function getYouthStandings(league) {
  if (!league) return [];
  return league.teams.slice().sort((a, b) =>
    b.record.pts - a.record.pts ||
    b.record.w - a.record.w ||
    (b.record.gf - b.record.ga) - (a.record.gf - a.record.ga) ||
    b.record.gf - a.record.gf ||
    a.name.localeCompare(b.name, 'ru')
  );
}

function simYouthRound(leagueId, silent = false) {
  const league = G.league?.youth?.leagues?.[leagueId];
  if (!league || league.currentRound >= league.schedule.length) return false;
  const round = league.schedule[league.currentRound];
  const roundNumber = league.currentRound + 1;
  const roundResults = [];
  for (const [homeId, awayId] of round) {
    const home = league.teams.find(t => t.id === homeId);
    const away = league.teams.find(t => t.id === awayId);
    if (!home || !away) continue;
    const result = simulateYouthMatch(home, away, roundNumber);
    league.results.push(result);
    roundResults.push(result);
  }
  league.currentRound++;
  league.table = getYouthStandings(league);
  if (!silent && typeof showToast === 'function') showToast(league.name + ': завершён тур ' + roundNumber, 'success');
  return roundResults;
}

function simYouthRoundBoth(silent = true, completedMainRounds = null) {
  const youth = G.league?.youth;
  if (!youth) return;
  const mainTotal = Math.max(1, G.league.schedule?.length || 1);
  const completed = Math.max(0, Math.min(mainTotal,
    completedMainRounds == null ? G.league.currentRound + 1 : completedMainRounds));
  for (const leagueId of ['MHL', 'RHL']) {
    const league = youth.leagues?.[leagueId];
    if (!league || !league.schedule?.length) continue;
    // Распределяем туры молодёжного календаря по всей длине основной регулярки.
    // Так все соревнования доходят до конца одновременно, даже если число туров различается.
    const targetRound = Math.min(league.schedule.length,
      Math.round(completed / mainTotal * league.schedule.length));
    while (league.currentRound < targetRound) simYouthRound(leagueId, true);
  }
}

function simulateYouthSeasonRemainder(league) {
  if (!league) return;
  while (league.currentRound < league.schedule.length) simYouthRound(league.id, true);
}

function youthTransferPrice(player, leagueId) {
  const leagueFactor = leagueId === 'MHL' ? 1.25 : 1;
  const potential = Math.max(0, (player.pot || player.ovr) - player.ovr);
  return Math.max(0.5, Math.round((player.ovr * 0.12 + potential * 0.08) * leagueFactor * 10) / 10);
}

function acquireYouthPlayer(team, youthTeamId, playerId) {
  const youth = G.league?.youth;
  if (!team || !youth) return { success: false, error: 'Команда или молодёжная лига не найдена' };
  if (team.roster.length >= 30) return { success: false, error: 'В основном составе нет места (максимум 30 игроков)' };
  const youthLeague = Object.values(youth.leagues || {}).find(league => league.teams.some(club => club.id === youthTeamId));
  const youthTeam = youthLeague?.teams.find(club => club.id === youthTeamId);
  const player = youthTeam?.roster.find(item => item.id === playerId);
  if (!player) return { success: false, error: 'Игрок уже недоступен или перешёл в другую команду' };
  if (team.roster.some(item => item.id === player.id)) return { success: false, error: 'Игрок уже в твоём составе' };
  const ownSystem = (youthTeam.seniorLinks || []).includes(team.id);
  const foreigners = team.roster.filter(item => item.nationality !== 'Россия').length;
  if (player.nationality !== 'Россия' && foreigners >= 3) return { success: false, error: 'Превысится лимит легионеров (3)' };
  const price = ownSystem ? 0 : youthTransferPrice(player, youthLeague.id);
  if (team.finance.balance < price) return { success: false, error: 'Недостаточно средств для трансфера' };
  if (price > 0) { team.finance.balance -= price; team.finance.expenses.transfers = (team.finance.expenses.transfers || 0) + price; }
  youthTeam.roster = youthTeam.roster.filter(item => item.id !== player.id);
  player.status = 'contract'; player.contract = contractFor(player.ovr, player.age);
  player.youth = player.youth || {}; player.youth.signedBySeniorClubId = team.id;
  player.youth.signedFromTeamId = youthTeam.id; player.youth.signedFromTeamName = youthTeam.name; player.youth.transferFee = price;
  player.stats = player.stats || { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, wins: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 };
  team.roster.push(player); team.lines = null; if (typeof syncLines === 'function') syncLines(team);
  youth.transferLog = youth.transferLog || [];
  youth.transferLog.push({ playerId: player.id, playerName: player.name, fromTeamId: youthTeam.id, fromTeamName: youthTeam.name, toTeamId: team.id, toTeamName: team.name, fee: price, season: youth.season || 1 });
  if (typeof addNews === 'function') addNews('signing', price > 0 ? team.name + ' приобрёл молодого игрока ' + player.name + ' из ' + youthTeam.name + ' за ' + price.toFixed(1) + ' млн ₽' : team.name + ' перевёл игрока ' + player.name + ' из своей молодёжной системы', 1);
  return { success: true, player, price, ownSystem };
}
function youthTopScorers(league, limit = 10) {
  if (!league) return [];
  return league.teams.flatMap(team => team.roster.map(player => ({ ...player, teamName: team.name })))
    .filter(player => player.stats && player.stats.gp > 0)
    .sort((a, b) => b.stats.points - a.stats.points || b.stats.goals - a.stats.goals)
    .slice(0, limit);
}

function advanceYouthPlayer(player, leagueId, season, team, youth) {
  player.age++;
  const attrs = player.position === 'G' ? GOALIE_ATTRS : SKATER_ATTRS;
  const gainCount = player.age <= 18 ? randInt(2, 4) : randInt(1, 3);
  for (let i = 0; i < gainCount; i++) {
    const eligible = attrs.filter(key => player.attrs[key] < player.attrPot[key]);
    if (!eligible.length) break;
    const key = pick(eligible);
    player.attrs[key]++;
  }
  player.ovr = overallFromAttrs(player.attrs, player.position === 'G');
  player.pot = overallFromAttrs(player.attrPot, player.position === 'G');
  if (player.age > YOUTH_RULES.maxAge) {
    player.youth.graduated = true;
    player.status = 'ufa';
    player.contract = contractFor(player.ovr, player.age);
    player.youthGraduated = { formerTeamId: team.id, formerTeamName: team.name, season };
    if (!Array.isArray(G.league.freeAgents)) G.league.freeAgents = [];
    if (!G.league.freeAgents.some(candidate => candidate.id === player.id)) G.league.freeAgents.push(player);
    youth.graduates.push({
      playerId: player.id, name: player.name, position: player.position,
      age: player.age, ovr: player.ovr, formerTeamId: team.id,
      formerTeamName: team.name, season, status: 'available',
      signedByTeamId: null, signedByTeamName: null,
    });
    return false;
  }
  player.stats = { gp: 0, goals: 0, assists: 0, points: 0, shots: 0, pim: 0, wins: 0, saves: 0, goalsAgainst: 0, shotsAgainst: 0, shutouts: 0 };
  player.contract = contractFor(player.ovr, player.age);
  return true;
}

function finishYouthSeason() {
  const youth = G.league?.youth;
  if (!youth) return;
  const mhl = youth.leagues.MHL;
  const rhl = youth.leagues.RHL;
  simulateYouthSeasonRemainder(mhl);
  simulateYouthSeasonRemainder(rhl);
  const mhlTable = getYouthStandings(mhl);
  const rhlTable = getYouthStandings(rhl);
  const finalPlaces = new Map([
    ...mhlTable.map((team, index) => [team.id, index + 1]),
    ...rhlTable.map((team, index) => [team.id, index + 1]),
  ]);
  const snapshot = (league, table) => ({
    season: league.season,
    championId: table[0]?.id || null,
    championName: table[0]?.name || '—',
    standings: table.map((team, index) => ({
      place: index + 1, teamId: team.id, name: team.name,
      gp: team.record.gp, w: team.record.w, otw: team.record.otw,
      otl: team.record.otl, l: team.record.l, pts: team.record.pts,
      gf: team.record.gf, ga: team.record.ga,
    })),
    topScorers: youthTopScorers(league, 10).map(p => ({
      playerId: p.id, name: p.name, teamName: p.teamName,
      gp: p.stats.gp, goals: p.stats.goals, assists: p.stats.assists, points: p.stats.points,
    })),
  });
  mhl.history.push(snapshot(mhl, mhlTable));
  rhl.history.push(snapshot(rhl, rhlTable));
  const relegated = mhlTable.slice(-YOUTH_RULES.relegationPlaces);
  const promoted = rhlTable.slice(0, YOUTH_RULES.promotionPlaces);
  const moved = [];
  for (const team of relegated) {
    mhl.teams = mhl.teams.filter(item => item.id !== team.id);
    team.leagueId = 'RHL';
    rhl.teams.push(team);
    moved.push({ teamId: team.id, teamName: team.name, from: 'MHL', to: 'RHL' });
  }
  for (const team of promoted) {
    rhl.teams = rhl.teams.filter(item => item.id !== team.id);
    team.leagueId = 'MHL';
    mhl.teams.push(team);
    moved.push({ teamId: team.id, teamName: team.name, from: 'RHL', to: 'MHL' });
  }
  youth.promotionHistory.push({ season: youth.season, moves: moved });
  youth.season++;
  for (const league of [mhl, rhl]) {
    league.season = youth.season;
    league.teams.forEach(team => {
      const retained = [];
      for (const player of team.roster) {
        if (advanceYouthPlayer(player, league.id, league.season, team, youth)) retained.push(player);
      }
      team.roster = retained;
      while (team.roster.length < YOUTH_RULES.rosterSize) {
        const pos = pick(['C', 'LW', 'RW', 'D', 'G']);
        team.roster.push(createYouthPlayer(pos, league.id, youth.season));
      }
      team.record = { gp: 0, w: 0, otw: 0, otl: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      team.stats = { goals: [], goalies: [] };
      team.history = team.history || [];
      team.history.push({ season: league.season - 1, place: finalPlaces.get(team.id) || null });
    });
    league.schedule = makeSchedule(league.teams);
    league.currentRound = 0;
    league.results = [];
    league.table = [];
    league.championId = null;
    league.topScorerId = null;
  }
  return moved;
}
