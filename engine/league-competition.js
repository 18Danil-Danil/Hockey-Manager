/* ============================================================
   ЛИДЕРЫ / ТАБЛИЦА / СИМ
   ============================================================ */
function leagueLeaders(league, mode = 'regular') {
  const skaters = [], goalies = [];
  for (const t of league.teams) for (const p of t.roster) {
    const s = mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
    if (mode === 'playoff' && s.gp === 0) continue;
    if (p.position === 'G') goalies.push(p); else skaters.push(p);
  }
  const getStat = (p) => mode === 'playoff' ? ensurePlayoffStats(p) : ensureStats(p);
  return {
    byGoals: skaters.slice().sort((a, b) => getStat(b).goals - getStat(a).goals).slice(0, 10),
    byAssists: skaters.slice().sort((a, b) => getStat(b).assists - getStat(a).assists).slice(0, 10),
    byPoints: skaters.slice().sort((a, b) => getStat(b).points - getStat(a).points).slice(0, 10),
    bySvPct: goalies.filter(p => getStat(p).gp >= (mode === 'playoff' ? 3 : 10) && getStat(p).shotsAgainst > 0)
      .sort((a, b) => (getStat(b).saves / getStat(b).shotsAgainst) - (getStat(a).saves / getStat(a).shotsAgainst)).slice(0, 10),
  };
}
function applyResult(res) {
  const h = G.league.teams.find(t => t.id === res.homeId), a = G.league.teams.find(t => t.id === res.awayId);
  h.record.gf += res.hg; h.record.ga += res.ag; a.record.gf += res.ag; a.record.ga += res.hg;
  if (res.hg > res.ag) { h.record.w++; if (res.ot) a.record.otl++; else a.record.l++; }
  else { a.record.w++; if (res.ot) h.record.otl++; else h.record.l++; }
  h.record.pts = h.record.w * 2 + h.record.otl; a.record.pts = a.record.w * 2 + a.record.otl;
  processMatchdayRevenue(h, true, a.strength); processOperations(h); processOperations(a);
  processGovSupport(h); processGovSupport(a);
  if (G.playerTeamId === h.id) updateReputation(h, res.hg > res.ag);
  if (G.playerTeamId === a.id) updateReputation(a, res.ag > res.hg);
}
function standingsSorted() {
  return G.league.teams.slice().sort((a, b) => {
    if (b.record.pts !== a.record.pts) return b.record.pts - a.record.pts;
    if (b.record.w !== a.record.w) return b.record.w - a.record.w;
    const dA = a.record.gf - a.record.ga, dB = b.record.gf - b.record.ga;
    if (dB !== dA) return dB - dA;
    return b.record.gf - a.record.gf;
  });
}
function standingsSortedByUI() {
  const { key, dir } = G.standingsSort; const mult = dir === 'asc' ? 1 : -1;
  const getVal = (t) => {
    const gp = t.record.w + t.record.l + t.record.otl;
    if (key === 'pts') return t.record.pts; if (key === 'gp') return gp;
    if (key === 'w') return t.record.w; if (key === 'l') return t.record.l;
    if (key === 'otl') return t.record.otl; if (key === 'gf') return t.record.gf;
    if (key === 'ga') return t.record.ga; if (key === 'diff') return t.record.gf - t.record.ga;
    return t.record.pts;
  };
  return G.league.teams.slice().sort((a, b) => {
    const diff = (getVal(a) - getVal(b)) * mult;
    if (diff !== 0) return diff;
    if (b.record.pts !== a.record.pts) return b.record.pts - a.record.pts;
    return (b.record.gf - b.record.ga) - (a.record.gf - a.record.ga);
  });
}
function checkInjuredStarters() {
  if (!G.playerTeamId) return [];
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  if (!team || !team.lines) return [];
  const injured = [];
  const seen = new Set();
  for (const key of ['f1','f2','f3','f4','d1','d2','d3']) {
    for (const id of team.lines[key].players) {
      if (seen.has(id)) continue;
      const p = team.roster.find(x => x.id === id);
      if (p && p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) { injured.push(p); seen.add(id); }
    }
  }
  for (const key of ['g1','g2']) {
    const id = team.lines[key];
    if (!id || seen.has(id)) continue;
    const p = team.roster.find(x => x.id === id);
    if (p && p.injury && p.injury.gamesLeft > 0 && !p.injuryPolicy) { injured.push(p); seen.add(id); }
  }
  return injured;
}
function setInjuryPolicy(playerId, policy) {
  if (!G.injuryPrompt) return;
  if (!G.injuryPrompt.choices) G.injuryPrompt.choices = {};
  G.injuryPrompt.choices[playerId] = policy;
  render();
}
function applyInjuryPolicies() {
  if (!G.injuryPrompt) { simRound(true); return; }
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const injured = G.injuryPrompt.injured.map(id => team.roster.find(p => p.id === id)).filter(Boolean);
  const choices = G.injuryPrompt.choices || {};
  const onceIds = [];
  for (const p of injured) {
    const policy = choices[p.id] || 'period';
    p.injuryPolicy = policy;
    if (policy === 'pain') p.playingThroughPain = true;
    if (policy === 'once') onceIds.push(p.id);
  }
  G.injuryPrompt = null;
  simRound(true);
  // ⚙️ ФИКС #5: политика 'once' — на один матч, сбрасываем после симуляции
  for (const id of onceIds) {
    const p = team.roster.find(x => x.id === id);
    if (p) p.injuryPolicy = null;
  }
}
