/* SCHEDULE */
function orientScheduleRounds(pairings, teams, completedRounds = 0) {
  const state = new Map(teams.map(team => [team.id, { lastSide: null, streak: 0, home: 0, away: 0 }]));
  const record = (homeId, awayId) => {
    for (const [id, side] of [[homeId, 'home'], [awayId, 'away']]) {
      const entry = state.get(id); if (!entry) continue;
      if (entry.lastSide === side) entry.streak++; else { entry.lastSide = side; entry.streak = 1; }
      entry[side]++;
    }
  };
  return pairings.map((round, roundIndex) => {
    if (roundIndex < completedRounds) { round.forEach(([h, a]) => record(h, a)); return round.map(game => game.slice()); }
    return round.map(([aId, bId]) => {
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
        const key = String(aId) + ':' + String(bId) + ':' + String(roundIndex);
        let hash = 0; for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
        aIsHome = hash % 2 === 0;
      } else aIsHome = aHomeScore > bHomeScore;
      const homeId = aIsHome ? aId : bId, awayId = aIsHome ? bId : aId;
      record(homeId, awayId); return [homeId, awayId];
    });
  });
}
function getVhlTravelZonesForTeams(teams) {
  const config = window.VHL_TRAVEL_ZONES;
  if (!config || !Array.isArray(config.zones) || !Array.isArray(teams)) return [];
  return config.zones.map(zone => ({ ...zone, clubs: zone.teams.map(slug => teams.find(team => team.slug === slug)).filter(Boolean) })).filter(zone => zone.clubs.length);
}
function hasCompleteVhlTravelMap(teams) {
  if (!Array.isArray(teams) || teams.length !== 30) return false;
  const zones = getVhlTravelZonesForTeams(teams);
  return zones.length === 8 && zones.every(zone => zone.clubs.length === zone.teams.length) && zones.reduce((sum, zone) => sum + zone.clubs.length, 0) === teams.length;
}
function makeZoneRoundRobin(zones) {
  const rotation = zones.slice(), rounds = [];
  for (let r = 0; r < rotation.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < rotation.length / 2; i++) pairs.push([rotation[i], rotation[rotation.length - 1 - i]]);
    rounds.push(pairs); rotation.splice(1, 0, rotation.pop());
  }
  return rounds;
}
function getFirstLegHomeZone(pair) {
  const lower = pair[0].id < pair[1].id ? pair[0] : pair[1];
  const higher = pair[0].id < pair[1].id ? pair[1] : pair[0];
  return (higher.id - lower.id) <= 4 ? lower : higher;
}

function orderZoneRoundsForVenueBalance(zoneRounds, zones) {
  const permutations = [];
  function visit(prefix, remaining) {
    if (!remaining.length) { permutations.push(prefix); return; }
    remaining.forEach((value, index) => visit(prefix.concat(value), remaining.filter((_, i) => i !== index)));
  }
  visit([], zoneRounds.map((_, index) => index));
  let best = permutations[0], bestMaxRun = Infinity, bestPenalty = Infinity;
  permutations.forEach(order => {
    let maxRun = 0, penalty = 0;
    zones.forEach(zone => {
      let lastSide = null, runGames = 0;
      order.forEach(roundIndex => {
        const pair = zoneRounds[roundIndex].find(item => item[0].id === zone.id || item[1].id === zone.id);
        const other = pair[0].id === zone.id ? pair[1] : pair[0];
        const side = getFirstLegHomeZone(pair).id === zone.id ? 'H' : 'A';
        if (side === lastSide) runGames += other.clubs.length;
        else {
          if (runGames) { maxRun = Math.max(maxRun, runGames); penalty += runGames * runGames; }
          lastSide = side;
          runGames = other.clubs.length;
        }
      });
      maxRun = Math.max(maxRun, runGames);
      penalty += runGames * runGames;
    });
    if (maxRun < bestMaxRun || (maxRun === bestMaxRun && penalty < bestPenalty)) {
      bestMaxRun = maxRun; bestPenalty = penalty; best = order;
    }
  });
  return best.map(index => zoneRounds[index]);
}

function makeClubRoundRobin(clubs) {
  const rotation = clubs.slice(); if (rotation.length % 2) rotation.push(null);
  const rounds = [];
  for (let r = 0; r < rotation.length - 1; r++) {
    const games = [];
    for (let i = 0; i < rotation.length / 2; i++) {
      const a = rotation[i], b = rotation[rotation.length - 1 - i]; if (a && b) games.push([a, b]);
    }
    rounds.push(games); rotation.splice(1, 0, rotation.pop());
  }
  return rounds;
}
function assignZonePairSlots(pairs, previousSlots) {
  const permutations = [];
  function visit(prefix, remaining) {
    if (!remaining.length) { permutations.push(prefix); return; }
    remaining.forEach((slot, index) => visit(prefix.concat(slot), remaining.filter((_, i) => i !== index)));
  }
  visit([], [0, 1, 2, 3]);
  let best = permutations[0], bestScore = Infinity;
  permutations.forEach(slots => {
    let score = 0;
    pairs.forEach((pair, index) => {
      [pair[0].id, pair[1].id].forEach(zoneId => {
        if (previousSlots.has(zoneId)) score += Math.abs(previousSlots.get(zoneId) - slots[index]);
      });
      // Не ставим единственную пару зон 3×3 в последний слот: тогда у календаря терялся бы финальный игровой день серии.
      if (pair[0].clubs.length === 3 && pair[1].clubs.length === 3 && slots[index] >= 2) score += 100;
    });
    if (score < bestScore) { bestScore = score; best = slots; }
  });
  return best;
}
function buildVhlSchedulePlan(teams) {
  const zones = getVhlTravelZonesForTeams(teams).sort((a, b) => a.id - b.id);
  if (!hasCompleteVhlTravelMap(teams)) throw new Error('Не удалось сопоставить все клубы ВХЛ с логистическими группами');
  const zoneRounds = orderZoneRoundsForVenueBalance(makeZoneRoundRobin(zones), zones);
  const internalRounds = new Map(zones.map(zone => [zone.id, makeClubRoundRobin(zone.clubs)]));
  const schedule = [], roundInfo = [], previousSlots = new Map(), dayOffsets = [0, 2, 4, 6];
  function addRound(games, info) { schedule.push(games); roundInfo.push(info); }
  function addLeg(reverse, legNumber) {
    const orderedZoneRounds = reverse ? zoneRounds.slice().reverse() : zoneRounds;
    orderedZoneRounds.forEach((pairs, zoneRoundIndex) => {
      const slots = assignZonePairSlots(pairs, previousSlots), buckets = new Map();
      pairs.forEach((pair, pairIndex) => {
        const slot = slots[pairIndex]; pair.forEach(zone => previousSlots.set(zone.id, slot));
        const lower = pair[0].id < pair[1].id ? pair[0] : pair[1], higher = pair[0].id < pair[1].id ? pair[1] : pair[0];
        // Круговая ориентация пар зон распределяет домашние серии примерно поровну.
        const firstLegHomeZone = getFirstLegHomeZone(pair);
        const firstLegAwayZone = firstLegHomeZone.id === lower.id ? higher : lower;
        const homeZone = reverse ? firstLegAwayZone : firstLegHomeZone;
        const awayZone = reverse ? firstLegHomeZone : firstLegAwayZone;
        // Сопернические пары фиксируются в первой части сезона; во второй меняется только площадка.
        const sideA = lower.clubs, sideB = higher.clubs, size = Math.max(sideA.length, sideB.length);
        for (let day = 0; day < size; day++) {
          const offset = slot + dayOffsets[day];
          if (!buckets.has(offset)) buckets.set(offset, { games: [], zoneBlocks: [] });
          const bucket = buckets.get(offset);
          for (let i = 0; i < sideA.length; i++) {
            const j = (i + day) % size;
            if (j < sideB.length) {
              const fixture = homeZone.id === lower.id ? [sideA[i].id, sideB[j].id] : [sideB[j].id, sideA[i].id];
              bucket.games.push(fixture);
            }
          }
          bucket.zoneBlocks.push({
            zoneAId: pair[0].id, zoneBId: pair[1].id, zoneAName: pair[0].name, zoneBName: pair[1].name,
            homeZoneId: homeZone.id, homeZoneName: homeZone.name, awayZoneId: awayZone.id, awayZoneName: awayZone.name,
            dayIndex: day + 1, seriesDays: size,
          });
        }
      });
      const offsets = [...buckets.keys()].sort((a, b) => a - b), segmentId = 'leg-' + legNumber + '-zone-round-' + (zoneRoundIndex + 1);
      offsets.forEach(offset => {
        const bucket = buckets.get(offset);
        addRound(bucket.games, {
          phase: 'zone-trip', leg: legNumber, zoneRound: zoneRoundIndex + 1, segmentId, segmentOffset: offset,
          zoneBlocks: bucket.zoneBlocks, zoneIds: [...new Set(bucket.zoneBlocks.flatMap(block => [block.zoneAId, block.zoneBId]))],
        });
      });
      if ([0, 2, 5].includes(zoneRoundIndex)) {
        const derbyRoundIndex = [0, 2, 5].indexOf(zoneRoundIndex);
        [zones.slice(0, 4), zones.slice(4, 8)].forEach((zoneGroup, groupIndex) => {
          const games = []; let specialRoute = false;
          zoneGroup.forEach(zone => (internalRounds.get(zone.id)[derbyRoundIndex] || []).forEach(([a, b]) => {
            const aHome = (a.id + b.id + derbyRoundIndex) % 2 === 0;
            const game = aHome ? [a.id, b.id] : [b.id, a.id];
            games.push(reverse ? [game[1], game[0]] : game);
            const slugs = [a.slug, b.slug]; if (slugs.includes('norilsk') && slugs.includes('sokol')) specialRoute = true;
          }));
          addRound(games, {
            phase: 'local-derby', leg: legNumber, derbyRound: derbyRoundIndex + 1,
            segmentId: 'leg-' + legNumber + '-derby-' + (derbyRoundIndex + 1) + '-group-' + (groupIndex + 1),
            segmentOffset: 0, zoneIds: zoneGroup.map(zone => zone.id), zoneNames: zoneGroup.map(zone => zone.name),
            specialRoute: specialRoute ? 'norilsk-krasnoyarsk' : null,
          });
        });
      }
    });
  }
  addLeg(false, 1); addLeg(true, 2);
  return { schedule, roundInfo };
}
function makeSchedule(teams) {
  if (hasCompleteVhlTravelMap(teams)) return buildVhlSchedulePlan(teams).schedule;
  const arr = teams.slice(), n = arr.length, singleRounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < Math.floor(n / 2); i++) round.push([arr[i].id, arr[n - 1 - i].id]);
    singleRounds.push(round); arr.splice(1, 0, arr.pop());
  }
  return orientScheduleRounds([...singleRounds, ...singleRounds], teams, 0);
}
function makeScheduleMeta(season, roundCount, teams = null) {
  const match = String(season || '').match(/(\d{4})/), startYear = match ? Number(match[1]) : 2026;
  const startDate = new Date(Date.UTC(startYear, 8, 2)), zoneTeams = teams || window.VHL_TEAMS || [];
  if (roundCount === 152 && hasCompleteVhlTravelMap(zoneTeams)) {
    const info = buildVhlSchedulePlan(zoneTeams).roundInfo, segments = [];
    info.forEach((item, index) => {
      let segment = segments[segments.length - 1];
      if (!segment || segment.id !== item.segmentId) { segment = { id: item.segmentId, items: [], span: 0 }; segments.push(segment); }
      segment.items.push({ ...item, index }); segment.span = Math.max(segment.span, item.segmentOffset || 0);
    });
    const boundaries = Math.max(0, segments.length - 1), gaps = Array(boundaries).fill(2);
    let cursor = new Date(startDate);
    const specialBoundaries = [];
    segments.forEach((segment, index) => {
      if (index < boundaries && segment.items.some(item => item.specialRoute)) specialBoundaries.push(index);
    });
    specialBoundaries.forEach(index => { gaps[index] = 3; });
    const longCandidates = [], longBoundaries = [];
    for (let i = 0; i < boundaries; i++) if (!specialBoundaries.includes(i)) longCandidates.push(i);
    [0.35, 0.75].forEach(fraction => {
      const target = Math.floor(boundaries * fraction);
      const candidate = longCandidates.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      if (candidate != null) { gaps[candidate] = longBoundaries.length === 0 ? 8 : 7; longBoundaries.push(candidate); longCandidates.splice(longCandidates.indexOf(candidate), 1); }
    });
    const shortBoundaries = [];
    [0.18, 0.52, 0.9].forEach(fraction => {
      const target = Math.floor(boundaries * fraction);
      const candidate = longCandidates.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      if (candidate != null) { gaps[candidate] = 3; shortBoundaries.push(candidate); longCandidates.splice(longCandidates.indexOf(candidate), 1); }
    });
    // Новогодняя пауза подбирается после остальных логистических буферов,
    // чтобы ближайшая дата перед ней приходилась примерно на 30 декабря.
    const provisionalEnds = [];
    cursor = new Date(startDate);
    segments.forEach((segment, index) => {
      const end = new Date(cursor);
      end.setUTCDate(end.getUTCDate() + segment.span);
      provisionalEnds[index] = end;
      cursor = new Date(end);
      if (index < boundaries) cursor.setUTCDate(cursor.getUTCDate() + gaps[index]);
    });
    const newYearTarget = new Date(Date.UTC(startYear, 11, 30));
    let newYearBoundary = -1, closest = Infinity;
    for (let i = 0; i < boundaries; i++) {
      if (specialBoundaries.includes(i) || longBoundaries.includes(i) || shortBoundaries.includes(i)) continue;
      const distance = Math.abs(provisionalEnds[i].getTime() - newYearTarget.getTime());
      if (distance < closest) { closest = distance; newYearBoundary = i; }
    }
    if (newYearBoundary >= 0) gaps[newYearBoundary] = 7;
    const result = Array(roundCount); cursor = new Date(startDate);
    segments.forEach((segment, segmentIndex) => {
      segment.items.forEach(({ index, ...item }) => {
        const date = new Date(cursor); date.setUTCDate(date.getUTCDate() + (item.segmentOffset || 0));
        result[index] = {
          ...item, round: index, date: date.toISOString().slice(0, 10),
          travelNote: item.specialRoute === 'norilsk-krasnoyarsk' ? 'Дополнительный день на маршруте Норильск — Красноярск' : null,
        };
      });
      cursor.setUTCDate(cursor.getUTCDate() + segment.span);
      if (segmentIndex < boundaries) cursor.setUTCDate(cursor.getUTCDate() + gaps[segmentIndex]);
    });
    // Последняя игра перед новогодней паузой — 30 декабря; следующая дата — 5 января.
    if (newYearBoundary >= 0) {
      const lastRoundIndex = segments[newYearBoundary].items[segments[newYearBoundary].items.length - 1].index;
      result[lastRoundIndex].date = startYear + '-12-30';
    }
    return result;
  }
  const intervals = [3, 3, 3, 3, 4], meta = [], date = new Date(startDate);
  for (let round = 0; round < roundCount; round++) {
    meta.push({ round, date: date.toISOString().slice(0, 10), phase: 'legacy' });
    const previousMonth = date.getUTCMonth(); date.setUTCDate(date.getUTCDate() + intervals[round % intervals.length]);
    if (previousMonth === 11 && date.getUTCMonth() === 0 && date.getUTCDate() < 5) date.setUTCDate(5);
  }
  return meta;
}
function ensureScheduleCalendar(league) {
  if (!league || !Array.isArray(league.schedule)) return [];
  if (league.scheduleVersion !== 3) {
    const hasStarted = (league.currentRound || 0) > 0 || (league.results || []).length > 0;
    if (!hasStarted && hasCompleteVhlTravelMap(league.teams)) {
      league.schedule = makeSchedule(league.teams); league.scheduleVersion = 3;
      league.scheduleMeta = makeScheduleMeta(league.season, league.schedule.length, league.teams);
    } else {
      league.scheduleVersion = 2;
      if (!Array.isArray(league.scheduleMeta) || league.scheduleMeta.length !== league.schedule.length)
        league.scheduleMeta = makeScheduleMeta(league.season, league.schedule.length, league.teams);
    }
  }
  if (!Array.isArray(league.scheduleMeta) || league.scheduleMeta.length !== league.schedule.length)
    league.scheduleMeta = makeScheduleMeta(league.season, league.schedule.length, league.teams);
  return league.scheduleMeta;
}
function genLeague() {
  resetPlayerNameRegistry();
  const teams = VHL_TEAMS.map(meta => genTeam(meta)), season = '2026/27', schedule = makeSchedule(teams);
  const league = {
    season, teams, schedule, scheduleMeta: makeScheduleMeta(season, schedule.length, teams), scheduleVersion: 3,
    currentRound: 0, results: [], playoffs: null, history: [], transferLog: [], freeAgents: [], staffPool: [], waivers: [],
    aiTradeOffers: [], allTimeLeaders: { skaters: {} }, inbox: [], news: [], retiredPlayers: [],
    openingCup: null, retroMatch: null, tradeDeadlineNotified: false, youth: initYouthLeagues(),
  };
  teams.forEach(t => { t.staff.headCoach = { id: nextId(), role: 'headCoach', name: pick(FIRST) + ' ' + pick(LAST), level: 2, xp: 0, salary: 2.4, age: randInt(38, 58) }; });
  teams.forEach(t => { const cands = t.roster.filter(p => p.ovr >= 65 && p.age >= 22 && p.age <= 32); if (cands.length) pick(cands).onTradeBlock = true; });
  teams.forEach(t => assignSeasonGoals(t));
  return league;
}
