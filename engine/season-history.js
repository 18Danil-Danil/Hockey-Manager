/* ============================================================
   ИСТОРИЯ КАРЬЕРЫ / ЛИДЕРЫ / НАГРАДЫ / ИТОГИ СЕЗОНА
   ============================================================ */
function seasonLabelFromNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value || '2026/27');
  const startYear = 2025 + Math.max(1, Math.floor(number));
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}
function normalizeSeasonLabel(value) {
  if (typeof value === 'number' || /^\d+$/.test(String(value || ''))) return seasonLabelFromNumber(value);
  return String(value || '2026/27');
}
function nextSeasonLabel(value) {
  const label = normalizeSeasonLabel(value);
  const match = label.match(/^(\d{4})\/(\d{2})$/);
  if (!match) return '2027/28';
  const startYear = Number(match[1]) + 1;
  return `${startYear}/${String(startYear + 1).slice(-2)}`;
}

function updateCareerStats(team) {
  for (const p of team.roster) {
    const s=ensureStats(p), po=ensurePlayoffStats(p);
    p.careerStats=p.careerStats||{seasons:0,gp:0,goals:0,assists:0,points:0,wins:0,shutouts:0,saves:0,shotsAgainst:0,goalsAgainst:0,playoffGp:0,playoffGoals:0,playoffAssists:0,playoffPoints:0,playoffWins:0};
    const c=p.careerStats;
    c.seasons++;c.gp+=s.gp||0;c.goals+=s.goals||0;c.assists+=s.assists||0;c.points+=s.points||0;
    c.wins+=s.wins||0;c.shutouts+=s.shutouts||0;c.saves=(c.saves||0)+(s.saves||0);c.shotsAgainst=(c.shotsAgainst||0)+(s.shotsAgainst||0);c.goalsAgainst=(c.goalsAgainst||0)+(s.goalsAgainst||0);
    c.playoffGp=(c.playoffGp||0)+(po.gp||0);c.playoffGoals=(c.playoffGoals||0)+(po.goals||0);c.playoffAssists=(c.playoffAssists||0)+(po.assists||0);c.playoffPoints=(c.playoffPoints||0)+(po.points||0);c.playoffWins=(c.playoffWins||0)+(po.wins||0);
    if(!p.seasonHistory)p.seasonHistory=[];
    if(p.seasonHistory.some(row=>String(row.season)===String(G.league.season)&&row.teamName===team.name))continue;
    p.seasonHistory.push({
      season:G.league.season,teamName:team.name,teamId:team.id,position:p.position,age:p.age,
      gp:s.gp||0,goals:s.goals||0,assists:s.assists||0,points:s.points||0,wins:s.wins||0,losses:s.losses||0,otl:s.otl||0,
      saves:s.saves||0,shotsAgainst:s.shotsAgainst||0,goalsAgainst:s.goalsAgainst||0,shutouts:s.shutouts||0,
      playoffStats:{gp:po.gp||0,goals:po.goals||0,assists:po.assists||0,points:po.points||0,wins:po.wins||0,saves:po.saves||0,shotsAgainst:po.shotsAgainst||0,goalsAgainst:po.goalsAgainst||0},
      ovr:p.ovr,pot:p.pot,salary:p.contract?.salary||0,
    });
  }
}
function updateAllTimeLeaders(team) {
  if (!G.league.allTimeLeaders) G.league.allTimeLeaders = { skaters: {} };
  const db = G.league.allTimeLeaders.skaters;
  for (const p of team.roster) {
    const s = ensureStats(p); if (s.gp === 0) continue;
    const key = p.name + '#' + p.id;
    if (!db[key]) db[key] = { id: p.id, name: p.name, isG: p.position === 'G', seasons: 0, gp: 0, goals: 0, assists: 0, points: 0, wins: 0, shutouts: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0 };
    const e = db[key];
    e.seasons++; e.gp += s.gp; e.goals += (s.goals || 0); e.assists += (s.assists || 0); e.points += (s.points || 0);
    e.wins += (s.wins || 0); e.shutouts += (s.shutouts || 0); e.saves += (s.saves || 0); e.shotsAgainst += (s.shotsAgainst || 0); e.goalsAgainst += (s.goalsAgainst || 0);
  }
}

/* ============================================================
   НАГРАДЫ
   ============================================================ */
function computeAwards() {
  const allSkaters = [], allGoalies = [];
  for (const t of G.league.teams) for (const p of t.roster) {
    ensureStats(p);
    if (p.position === 'G') allGoalies.push({ p, team: t }); else allSkaters.push({ p, team: t });
  }
  const best = (arr, fn) => arr.length ? arr.slice().sort((a, b) => fn(b) - fn(a))[0] : null;
  const topScorer = best(allSkaters, x => x.p.stats.goals);
  const topAssister = best(allSkaters, x => x.p.stats.assists);
  const topPointMan = best(allSkaters, x => x.p.stats.points);
  const defs = allSkaters.filter(x => x.p.position === 'D');
  const topDefenseman = best(defs, x => x.p.stats.points + x.p.stats.plusMinus * 0.5);
  const goaliesQual = allGoalies.filter(x => x.p.stats.gp >= 20 && x.p.stats.shotsAgainst > 0);
  const topGoalie = best(goaliesQual, x => x.p.stats.saves / x.p.stats.shotsAgainst);
  const rookies = allSkaters.filter(x => x.p.age <= 22 && x.p.stats.gp >= 20);
  const rookieOfYear = best(rookies, x => x.p.stats.points);
  const mvpCands = allSkaters.filter(x => x.p.stats.points >= 20);
  const mvp = best(mvpCands, x => x.p.stats.points + x.p.stats.plusMinus * 0.3);
  const fmtSk = (x) => x ? { name: x.p.name, team: x.team.name, position: x.p.position, gp: x.p.stats.gp, goals: x.p.stats.goals, assists: x.p.stats.assists, points: x.p.stats.points } : null;
  const fmtGk = (x) => x ? { name: x.p.name, team: x.team.name, gp: x.p.stats.gp, wins: x.p.stats.wins, svPct: x.p.stats.shotsAgainst > 0 ? x.p.stats.saves / x.p.stats.shotsAgainst : 0, gaa: x.p.stats.gp > 0 ? x.p.stats.goalsAgainst / x.p.stats.gp : 0, shutouts: x.p.stats.shutouts } : null;
  return { mvp: fmtSk(mvp), topScorer: fmtSk(topScorer), topAssister: fmtSk(topAssister), topPointMan: fmtSk(topPointMan), topDefenseman: fmtSk(topDefenseman), topGoalie: fmtGk(topGoalie), rookieOfYear: fmtSk(rookieOfYear) };
}

/* ============================================================
   СЕНСАЦИЯ / ПРОВАЛ СЕЗОНА
   ============================================================ */
function calculateExpectedPlace(team) {
  if (!team.history || team.history.length === 0) return 16;
  const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
  let sum = 0, totalW = 0;
  const hist = team.history.slice(0, 5);
  for (let i = 0; i < hist.length; i++) {
    const w = weights[i] || 0.05;
    sum += hist[i].place * w;
    totalW += w;
  }
  return totalW > 0 ? sum / totalW : 16;
}
function checkSeasonSurprises() {
  const sorted = standingsSorted();
  const surprises = [];
  for (const team of G.league.teams) {
    const actualPlace = sorted.findIndex(t => t.id === team.id) + 1;
    const expected = calculateExpectedPlace(team);
    const delta = expected - actualPlace;
    if (delta >= 8) {
      surprises.push({ team, type: 'upset', delta, expected, actualPlace });
      if (team.id === G.playerTeamId && G.career) G.career.reputation = clamp(G.career.reputation + 5, 0, 100);
      addNews('season_upset', `${team.name}: сенсация сезона! ${actualPlace}-е место при ожидании ${Math.round(expected)}-го`, 3);
    } else if (delta <= -8) {
      surprises.push({ team, type: 'flop', delta, expected, actualPlace });
      if (team.id === G.playerTeamId && G.career) G.career.reputation = clamp(G.career.reputation - 5, 0, 100);
      addNews('season_flop', `${team.name}: провал сезона. ${actualPlace}-е место при ожидании ${Math.round(expected)}-го`, 3);
    }
  }
  G.league.lastSurprises = surprises;
  return surprises;
}
