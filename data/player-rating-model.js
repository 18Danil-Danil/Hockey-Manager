/* ============================================================
   РЕЙТИНГИ И ПОТЕНЦИАЛ ПО СТАТИСТИКЕ ВХЛ
   Оценка приблизительная: статистические показатели переводятся
   в игровые атрибуты относительно игроков той же позиции.
   ============================================================ */
(function () {
  const SEASON_WEIGHTS = { '25/26': 1, '24/25': 0.76, '23/24': 0.56 };
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const numberOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function averageWeighted(items, key) {
    let total = 0, weight = 0;
    for (const item of items) {
      const value = numberOrNull(item[key]);
      if (value === null) continue;
      total += value * item.weight;
      weight += item.weight;
    }
    return weight ? total / weight : null;
  }

  function summarizePlayerStats(playerStats) {
    const rows = (playerStats?.seasons || []).filter(row =>
      row && row.stage === 'regular' && SEASON_WEIGHTS[row.season] && Number(row.gp) > 0
    );
    const weightedRows = rows.map(row => ({
      ...row,
      weight: SEASON_WEIGHTS[row.season] * Math.min(1, Number(row.gp) / 20)
    })).filter(row => row.weight > 0);
    if (!weightedRows.length) return null;

    const goalie = playerStats.position === 'goaltender';
    const rates = {};
    if (goalie) {
      rates.savePct = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: row.savePct ?? (Number(row.shotsAgainst) > 0
          ? (Number(row.saves) / Number(row.shotsAgainst)) * 100 : null)
      })), 'value');
      rates.gaa = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: row.gaa ?? (Number(row.minutes) > 0
          ? Number(row.goalsAgainst) * 60 / Number(row.minutes) : null)
      })), 'value');
      rates.winsPct = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: Number(row.gp) > 0
          ? Number(row.wins || 0) / Number(row.gp) : null
      })), 'value');
      rates.shutoutsPerGame = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: Number(row.gp) > 0
          ? Number(row.shutouts || 0) / Number(row.gp) : null
      })), 'value');
      rates.shotsAgainstPerGame = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: Number(row.gp) > 0
          ? Number(row.shotsAgainst || 0) / Number(row.gp) : null
      })), 'value');
      rates.minutesPerGame = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: Number(row.gp) > 0
          ? Number(row.minutes || 0) / Number(row.gp) : null
      })), 'value');
    } else {
      const perGame = (field) => averageWeighted(weightedRows.map(row => ({
        weight: row.weight,
        value: Number(row.gp) > 0 && Number.isFinite(Number(row[field]))
          ? Number(row[field]) / Number(row.gp) : null
      })), 'value');
      rates.goalsPerGame = perGame('goals');
      rates.assistsPerGame = perGame('assists');
      rates.pointsPerGame = perGame('points');
      rates.shotsPerGame = perGame('shots');
      rates.plusMinusPerGame = perGame('plusMinus');
      rates.hitsPerGame = perGame('hits');
      rates.blocksPerGame = perGame('blocks');
      rates.pimPerGame = perGame('pim');
      rates.ppGoalsPerGame = perGame('ppGoals');
      rates.toiPerGame = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: numberOrNull(row.toiPerGame)
      })), 'value');
      rates.shiftsPerGame = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: numberOrNull(row.shiftsPerGame)
      })), 'value');
      rates.shootingPct = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: numberOrNull(row.shootingPct)
      })), 'value');
      rates.faceoffPct = averageWeighted(weightedRows.map(row => ({
        weight: row.weight, value: numberOrNull(row.faceoffPct)
      })), 'value');
    }

    const ordered = [...weightedRows].sort((a, b) =>
      String(b.season).localeCompare(String(a.season), 'en', { numeric: true })
    );
    const productivity = row => goalie
      ? (numberOrNull(row.savePct) ?? 0) - (numberOrNull(row.gaa) ?? 0) * 3
      : (Number(row.gp) > 0 ? (Number(row.points) || 0) / Number(row.gp) : 0);
    let trend = 0;
    if (ordered.length >= 2) trend = productivity(ordered[0]) - productivity(ordered[1]);

    return { ...rates, gamesSample: weightedRows.reduce((sum, row) => sum + Number(row.gp || 0), 0), trend };
  }

  function percentileMap(summaries, position, metric, inverse = false) {
    const values = summaries
      .filter(item => item.position === position && Number.isFinite(item.summary?.[metric]))
      .map(item => ({ id: item.id, value: item.summary[metric] }));
    values.sort((a, b) => a.value - b.value);
    const map = new Map();
    for (let i = 0; i < values.length;) {
      let end = i + 1;
      while (end < values.length && values[end].value === values[i].value) end++;
      const percentile = values.length <= 1 ? 0.5 : ((i + end - 1) / 2) / (values.length - 1);
      for (let j = i; j < end; j++) map.set(values[j].id, inverse ? 1 - percentile : percentile);
      i = end;
    }
    return map;
  }

  function blendPercentiles(id, maps, weights) {
    let total = 0, weight = 0;
    for (let i = 0; i < maps.length; i++) {
      const value = maps[i]?.get(id);
      if (value === undefined) continue;
      total += value * weights[i];
      weight += weights[i];
    }
    return weight ? total / weight : 0.5;
  }

  function buildVhlRatingIndex(data) {
    const players = Object.entries(data?.players || {}).map(([id, value]) => ({
      id: String(id), position: value.position,
      summary: summarizePlayerStats(value)
    })).filter(item => item.summary);
    const makeSkaterMetrics = position => ({
      goals: percentileMap(players, position, 'goalsPerGame'),
      assists: percentileMap(players, position, 'assistsPerGame'),
      points: percentileMap(players, position, 'pointsPerGame'),
      shots: percentileMap(players, position, 'shotsPerGame'),
      shooting: percentileMap(players, position, 'shootingPct'),
      plusMinus: percentileMap(players, position, 'plusMinusPerGame'),
      hits: percentileMap(players, position, 'hitsPerGame'),
      blocks: percentileMap(players, position, 'blocksPerGame'),
      toi: percentileMap(players, position, 'toiPerGame'),
      shifts: percentileMap(players, position, 'shiftsPerGame'),
      faceoffs: percentileMap(players, position, 'faceoffPct')
    });
    const metrics = {
      forward: makeSkaterMetrics('forward'),
      defense: makeSkaterMetrics('defense'),
      goalie: {
        savePct: percentileMap(players, 'goaltender', 'savePct'),
        gaa: percentileMap(players, 'goaltender', 'gaa', true),
        wins: percentileMap(players, 'goaltender', 'winsPct'),
        shutouts: percentileMap(players, 'goaltender', 'shutoutsPerGame'),
        workload: percentileMap(players, 'goaltender', 'shotsAgainstPerGame')
      }
    };
    const index = new Map();
    for (const item of players) {
      const id = item.id, m = metrics[item.position === 'goaltender' ? 'goalie' : item.position];
      let attrs;
      if (item.position === 'goaltender') {
        attrs = {
          reflexes: blendPercentiles(id, [m.savePct, m.workload], [0.78, 0.22]),
          positioning: blendPercentiles(id, [m.gaa, m.shutouts], [0.78, 0.22]),
          glove: blendPercentiles(id, [m.savePct, m.gaa], [0.75, 0.25]),
          stick: blendPercentiles(id, [m.wins, m.shutouts, m.savePct], [0.45, 0.25, 0.30]),
          iq: blendPercentiles(id, [m.gaa, m.wins, m.savePct], [0.45, 0.25, 0.30])
        };
      } else {
        attrs = {
          skating: blendPercentiles(id, [m.toi, m.shifts], [0.65, 0.35]),
          shooting: blendPercentiles(id, [m.goals, m.shots, m.shooting], [0.45, 0.35, 0.20]),
          passing: blendPercentiles(id, [m.assists, m.points], [0.65, 0.35]),
          defense: blendPercentiles(id, [m.blocks, m.plusMinus, m.hits, m.toi], [0.30, 0.25, 0.20, 0.25]),
          physical: blendPercentiles(id, [m.hits, m.blocks, m.toi], [0.55, 0.25, 0.20]),
          iq: blendPercentiles(id, [m.assists, m.plusMinus, m.toi, m.faceoffs], [0.25, 0.25, 0.30, 0.20])
        };
      }
      index.set(id, { position: item.position, attrs, trend: item.summary.trend, gamesSample: item.summary.gamesSample, seasons: (data.players[id].seasons || []).map(row => row.season) });
    }
    return index;
  }

  let cachedData = null;
  let cachedIndex = null;
  function getVhlRatingIndex() {
    const data = window.VHL_PLAYER_STATS_DATA;
    if (!data || !data.players) return new Map();
    if (cachedData !== data) {
      cachedData = data;
      cachedIndex = buildVhlRatingIndex(data);
    }
    return cachedIndex;
  }

  function makeVhlRating(playerId, teamMeta, age) {
    const entry = getVhlRatingIndex().get(String(playerId));
    if (!entry) return null;
    const base = entry.attrs;
    const attrs = {};
    const keys = Object.keys(base);
    const ratingKey = entry.position === 'goaltender' ? 'gk' : entry.position === 'defense' ? 'def' : 'att';
    const teamTarget = Number(teamMeta?.ratings?.[ratingKey]);
    const fallbackTarget = Number.isFinite(teamTarget) ? teamTarget : 70;
    for (const key of keys) attrs[key] = clampValue(Math.round(fallbackTarget + (base[key] - 0.5) * 24), 45, 96);

    const list = entry.attrs.reflexes !== undefined ? GOALIE_ATTRS : SKATER_ATTRS;
    const ageBonus = age <= 18 ? 16 : age <= 20 ? 13 : age <= 22 ? 10 : age <= 24 ? 7 : age <= 26 ? 4 : age <= 28 ? 2 : 0;
    const trendBonus = entry.trend > 0.18 ? 3 : entry.trend > 0.07 ? 2 : entry.trend > 0.02 ? 1 : 0;
    const potentialBonus = ageBonus + trendBonus;
    const attrPot = {};
    for (const key of list) attrPot[key] = clampValue(attrs[key] + potentialBonus, 40, 99);
    return {
      attrs,
      attrPot,
      ovr: overallFromAttrs(attrs, entry.attrs.reflexes !== undefined),
      pot: overallFromAttrs(attrPot, entry.attrs.reflexes !== undefined),
      source: 'vhl-statistics',
      sampleGames: Math.round(entry.gamesSample),
      seasons: [...new Set(entry.seasons)]
    };
  }

  window.buildVhlRatingIndex = buildVhlRatingIndex;
  window.makeVhlRating = makeVhlRating;
})();
