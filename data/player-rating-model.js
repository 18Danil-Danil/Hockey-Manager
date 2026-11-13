/* ============================================================
   РЕЙТИНГИ И ПОТЕНЦИАЛ ПО СТАТИСТИКЕ ВХЛ
   Оценка приблизительная: статистические показатели переводятся
   в игровые атрибуты относительно игроков той же позиции.
   ============================================================ */
(function () {
  const DEFAULT_SEASON_WEIGHTS = [1, 0.76, 0.56];
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
  const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

  const LEAGUE_STRENGTH = {
    NHL: 1.65, KHL: 1.38, SHL: 1.30, LIIGA: 1.27, NL: 1.27,
    AHL: 1.25, KHL2: 1.16, DEL: 1.18, CZECH: 1.17, EXTRALIGA: 1.17, ECHL: 0.95, ALLSVENSKAN: 1.0, RHL: 0.8, RUSSIAN_FIRST: 0.8, MHLB: 0.78, BELARUS: 0.95, BELARUS2: 0.75,
    NCAA: 1.10, VHL: 1, MHL: 0.86, OHL: 0.94, WHL: 0.94, QMJHL: 0.94
  };
  const LEAGUE_ALIASES = {
    NHL: 'NHL', 'NATIONAL HOCKEY LEAGUE': 'NHL',
    KHL: 'KHL', 'КХЛ': 'KHL', 'КОНТИНЕНТАЛЬНАЯ ХОККЕЙНАЯ ЛИГА': 'KHL',
    AHL: 'AHL', 'AMERICAN HOCKEY LEAGUE': 'AHL',
    SHL: 'SHL', 'SWEDISH HOCKEY LEAGUE': 'SHL',
    LIIGA: 'LIIGA', 'SM LIIGA': 'LIIGA', 'FINNISH LIIGA': 'LIIGA',
    NL: 'NL', 'SWISS NL': 'NL', 'SWISS NATIONAL LEAGUE': 'NL', 'NATIONAL LEAGUE': 'NL',
    DEL: 'DEL', 'DEUTSCHE EISHOCKEY LIGA': 'DEL',
    CZECH: 'CZECH', 'CZECH EXTRALIGA': 'CZECH', 'ЧЕШСКАЯ ЭКСТРАЛИГА': 'CZECH',
    NCAA: 'NCAA', VHL: 'VHL', 'ВХЛ': 'VHL', MHL: 'MHL', 'МХЛ': 'MHL',
    OHL: 'OHL', WHL: 'WHL', QMJHL: 'QMJHL', ECHL: 'ECHL', ALLSVENSKAN: 'ALLSVENSKAN', 'HOCKEYALLSVENSKAN': 'ALLSVENSKAN', RHL: 'RHL', 'РОССИЙСКАЯ ХОККЕЙНАЯ ЛИГА': 'RHL', 'РХЛ': 'RHL', MHLB: 'MHLB', 'МХЛ-Б': 'MHLB', 'MHL B': 'MHLB', BELARUS: 'BELARUS', 'BELARUS EXTRALIGA': 'BELARUS', 'BELARUSIAN EXTRALIGA': 'BELARUS', BELARUS2: 'BELARUS2', 'BELARUS 2': 'BELARUS2', RUSSIAN_FIRST: 'RUSSIAN_FIRST', 'ПЕРВАЯ ЛИГА': 'RUSSIAN_FIRST'
  };
  function normalizeLeagueCode(value) {
    const name = String(value || '').trim().toUpperCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
    return LEAGUE_ALIASES[name] || name;
  }
  function seasonEndYear(season) {
    const match = /(?:^|\D)(\d{2})\/(\d{2})(?:$|\D)/.exec(String(season || ''));
    if (!match) return null;
    const start = 2000 + Number(match[1]);
    let end = 2000 + Number(match[2]);
    if (end < start) end += 100;
    return end;
  }
  function calculateLeagueHistoryBonus(history, currentYear = new Date().getFullYear()) {
    const grouped = new Map();
    for (const row of Array.isArray(history) ? history : []) {
      const league = normalizeLeagueCode(row?.league);
      const strength = LEAGUE_STRENGTH[league];
      const gp = Math.max(0, Number(row?.gp) || 0);
      if (!strength || strength <= 1 || !gp) continue;
      if (row?.scope === 'career' || row?.career === true) {
        // Суммируем регулярный чемпионат и плей-офф внутри одной лиги.
        // Этап остаётся частью ключа строки, чтобы не дублировать одну выборку,
        // но не создаёт отдельный бонус за тот же карьерный опыт.
        const key = 'career:' + league;
        const previous = grouped.get(key) || { league, gp: 0, strength, career: true, entries: new Map() };
        const entryKey = String(row.team || 'career-total') + ':' + String(row.stage || 'all');
        previous.entries.set(entryKey, Math.max(previous.entries.get(entryKey) || 0, gp));
        previous.gp = [...previous.entries.values()].reduce((sum, value) => sum + value, 0);
        grouped.set(key, previous);
        continue;
      }
      const endYear = seasonEndYear(row?.season);
      if (endYear === null || endYear > currentYear) continue;
      const key = String(row.season) + ':' + league;
      const previous = grouped.get(key) || { league, season: row.season, gp: 0, strength, endYear, entries: new Map() };
      const entryKey = String(row.team || 'all-teams') + ':' + String(row.stage || 'total');
      previous.entries.set(entryKey, Math.max(previous.entries.get(entryKey) || 0, gp));
      previous.gp = [...previous.entries.values()].reduce((sum, value) => sum + value, 0);
      grouped.set(key, previous);
    }
    let impact = 0;
    for (const row of grouped.values()) {
      if (row.career) {
        // Карьерный итог без разбивки по сезонам: не выдумываем давность.
        // Учитываем накопленный опыт с консервативным коэффициентом доверия.
        const experience = Math.min(1, row.gp / 120);
        impact += (row.strength - 1) * experience * 0.65;
      } else {
        const recency = Math.pow(0.88, Math.max(0, currentYear - row.endYear));
        const experience = Math.min(1, row.gp / 45);
        impact += (row.strength - 1) * experience * recency;
      }
    }
    return Math.round(clampValue(impact * 5.5, 0, 5) * 10) / 10;
  }

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

  function summarizePlayerStats(playerStats, seasonWeights) {
    const rows = (playerStats?.seasons || []).filter(row =>
      row && row.stage === 'regular' && seasonWeights[row.season] && Number(row.gp) > 0
    );
    const weightedRows = rows.map(row => ({
      ...row,
      weight: seasonWeights[row.season] * Math.min(1, Number(row.gp) / 20)
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
    const seasonWeights = Object.fromEntries((data?.seasons || []).map((season, index) => [
      season, DEFAULT_SEASON_WEIGHTS[index] || 0.4
    ]));
    const vhlPlayers = data?.players || {};
    const careerPlayers = window.VHL_PLAYER_LEAGUE_HISTORY?.players || {};
    const playerIds = new Set([...Object.keys(vhlPlayers), ...Object.keys(careerPlayers)]);
    const players = [...playerIds].map(id => {
      const value = vhlPlayers[id] || {};
      const career = careerPlayers[id] || {};
      const summary = value.position ? summarizePlayerStats(value, seasonWeights) : null;
      const leagueHistory = [
        ...(Array.isArray(value.leagueHistory) ? value.leagueHistory : []),
        ...(Array.isArray(career.seasons) ? career.seasons : []),
        ...(Array.isArray(career.career) ? career.career : [])
      ];
      return { id: String(id), position: value.position || career.position, summary, leagueHistory };
    }).filter(item => item.position && (item.summary || item.leagueHistory.length));
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
      const summary = item.summary || { gamesSample: 0, trend: 0 };
      const reliability = summary.gamesSample / (summary.gamesSample + 20);
      const rank = value => 0.5 + (value - 0.5) * reliability;
      let attrs;
      if (item.position === 'goaltender') {
        attrs = {
          reflexes: rank(blendPercentiles(id, [m.savePct, m.gaa], [0.82, 0.18])),
          positioning: rank(blendPercentiles(id, [m.gaa, m.shutouts], [0.78, 0.22])),
          glove: rank(blendPercentiles(id, [m.savePct, m.gaa], [0.78, 0.22])),
          stick: rank(blendPercentiles(id, [m.savePct, m.shutouts], [0.65, 0.35])),
          iq: rank(blendPercentiles(id, [m.gaa, m.wins, m.shutouts], [0.50, 0.20, 0.30]))
        };
      } else {
        attrs = {
          skating: rank(blendPercentiles(id, [m.toi, m.shifts], [0.65, 0.35])),
          shooting: rank(blendPercentiles(id, [m.goals, m.shots, m.shooting], [0.45, 0.35, 0.20])),
          passing: rank(blendPercentiles(id, [m.assists, m.points], [0.65, 0.35])),
          defense: rank(blendPercentiles(id, [m.blocks, m.plusMinus, m.hits, m.toi], [0.30, 0.25, 0.20, 0.25])),
          physical: rank(blendPercentiles(id, [m.hits, m.blocks, m.toi], [0.55, 0.25, 0.20])),
          iq: rank(blendPercentiles(id, [m.assists, m.plusMinus, m.toi, m.faceoffs], [0.25, 0.25, 0.30, 0.20]))
        };
      }
      index.set(id, { position: item.position, attrs, trend: summary.trend, gamesSample: summary.gamesSample, seasons: (data.players[id]?.seasons || []).map(row => row.season), leagueHistory: item.leagueHistory });
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
    const leagueBonus = calculateLeagueHistoryBonus(entry.leagueHistory);
    for (const key of keys) attrs[key] = clampValue(Math.round(fallbackTarget + (base[key] - 0.5) * 24 + leagueBonus), 45, 96);

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
      source: leagueBonus > 0 ? (entry.gamesSample > 0 ? 'vhl-statistics+league-history' : 'league-history') : 'vhl-statistics',
      leagueBonus,
      sampleGames: Math.round(entry.gamesSample),
      seasons: [...new Set(entry.seasons)]
    };
  }

  window.calculateLeagueHistoryBonus = calculateLeagueHistoryBonus;
  window.buildVhlRatingIndex = buildVhlRatingIndex;
  window.makeVhlRating = makeVhlRating;
})();
