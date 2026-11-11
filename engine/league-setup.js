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
    pairs.forEach((pair, index) => [pair[0].id, pair[1].id].forEach(zoneId => {
      if (previousSlots.has(zoneId)) score += Math.abs(previousSlots.get(zoneId) - slots[index]);
    }));
    if (score < bestScore) { bestScore = score; best = slots; }
  });
  return best;
}
function buildVhlSchedulePlan(teams) {
  const zones = getVhlTravelZonesForTeams(teams).sort((a, b) => a.id - b.id);
  if (!hasCompleteVhlTravelMap(teams)) throw new Error('Не удалось сопоставить все клубы ВХЛ с логистическими группами');
  const zoneRounds = makeZoneRoundRobin(zones);
  const internalRounds = new Map(zones.map(zone => [zone.id, makeClubRoundRobin(zone.clubs)]));
  const schedule = [], roundInfo = [], previousSlots = new Map(), dayOffsets = [0, 2, 3, 5];
  function addRound(games, info) { schedule.push(games); roundInfo.push(info); }
  function addLeg(reverse, legNumber) {
    const orderedZoneRounds = reverse ? zoneRounds.slice().reverse() : zoneRounds;
    orderedZoneRounds.forEach((pairs, zoneRoundIndex) => {
      const slots = assignZonePairSlots(pairs, previousSlots), buckets = new Map();
      pairs.forEach((pair, pairIndex) => {
        const slot = slots[pairIndex]; pair.forEach(zone => previousSlots.set(zone.id, slot));
        const lower = pair[0].id < pair[1].id ? pair[0] : pair[1], higher = pair[0].id < pair[1].id ? pair[1] : pair[0];
        const homeZone = reverse ? higher : lower, awayZone = reverse ? lower : higher;
        const homeClubs = homeZone.clubs, awayClubs = awayZone.clubs, size = Math.max(homeClubs.length, awayClubs.length);
        for (let day = 0; day < size; day++) {
          const offset = slot * 2 + dayOffsets[day];
          if (!buckets.has(offset)) buckets.set(offset, { games: [], zoneBlocks: [] });
          const bucket = buckets.get(offset);
          for (let i = 0; i < homeClubs.length; i++) {
            const j = (i + day) % size;
            if (j < awayClubs.length) bucket.games.push([homeClubs[i].id, awayClubs[j].id]);
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
      if ([1, 3, 5].includes(zoneRoundIndex)) {
        const derbyRoundIndex = (zoneRoundIndex - 1) / 2;
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
    const boundaries = Math.max(0, segments.length - 1), gaps = Array(boundaries).fill(1), baseStarts = [];
    let cursor = new Date(startDate);
    segments.forEach((segment, index) => {
      baseStarts[index] = new Date(cursor); cursor.setUTCDate(cursor.getUTCDate() + segment.span);
      if (index < boundaries) cursor.setUTCDate(cursor.getUTCDate() + 1);
    });
    const newYearTarget = new Date(Date.UTC(startYear, 11, 30));
    let newYearBoundary = 0, closest = Infinity;
    for (let i = 0; i < boundaries; i++) {
      const end = new Date(baseStarts[i]); end.setUTCDate(end.getUTCDate() + segments[i].span);
      const distance = Math.abs(end.getTime() - newYearTarget.getTime());
      if (distance < closest) { closest = distance; newYearBoundary = i; }
    }
    if (boundaries) gaps[newYearBoundary] = 6;
    const specialBoundary = segments.findIndex((segment, index) => index < boundaries && segment.items.some(item => item.specialRoute));
    if (specialBoundary >= 0 && specialBoundary !== newYearBoundary) gaps[specialBoundary] = 2;
    const longCandidates = [];
    for (let i = 0; i < boundaries; i++) if (i !== newYearBoundary && i !== specialBoundary) longCandidates.push(i);
    [0.42, 0.82].forEach(fraction => {
      const target = Math.floor(boundaries * fraction);
      const candidate = longCandidates.slice().sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      if (candidate != null) { gaps[candidate] = 7; longCandidates.splice(longCandidates.indexOf(candidate), 1); }
    });
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
