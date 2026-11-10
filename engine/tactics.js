/* ============================================================
   РЕЙТИНГИ / СОСТАВ / ТАКТИКА
   ============================================================ */
// Рейтинги строятся по фактическому составу на матч, а не по всему ростеру.
// Если lineup не передан, получаем его теми же правилами, что использует симуляция.
function teamAttackRating(t, lineup = getLineup(t)) {
  const available = Array.isArray(lineup?.forwards)
    ? lineup.forwards
    : (Array.isArray(lineup?.skaters) ? lineup.skaters.filter(p => p.position !== 'D' && p.position !== 'G') : []);
  const fs = available
    .map(p => ({ player: p, rating: Number(getEffectiveOvr(p)) }))
    .filter(x => Number.isFinite(x.rating) && x.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 9);
  if (!fs.length) return 50;
  return fs.reduce((sum, x) => sum + x.rating, 0) / fs.length;
}
function teamDefenseRating(t, lineup = getLineup(t)) {
  const available = Array.isArray(lineup?.defense)
    ? lineup.defense
    : (Array.isArray(lineup?.skaters) ? lineup.skaters.filter(p => p.position === 'D') : []);
  const ds = available
    .map(p => Number(getEffectiveOvr(p)))
    .filter(rating => Number.isFinite(rating) && rating > 0)
    .sort((a, b) => b - a)
    .slice(0, 6);
  const dAvg = ds.length ? ds.reduce((sum, rating) => sum + rating, 0) / ds.length : 50;
  const goalie = lineup?.goalie || null;
  const goalieOvr = goalie ? Number(getEffectiveOvr(goalie)) : NaN;
  const goalieForm = goalie && Number.isFinite(Number(goalie.form)) ? Number(goalie.form) : 50;
  const gVal = Number.isFinite(goalieOvr) && goalieOvr > 0
    ? goalieOvr * 0.7 + goalieForm * 0.3
    : 60;
  return dAvg * 0.7 + gVal * 0.3;
}
function shouldRestGoalie(starter, backup) {
  if (!backup) return false;
  if (starter.lastGameBad) return true;
  if ((starter.goalieStreak || 0) >= 5) return true;
  if ((backup.goalieStreak || 0) >= 1 && !backup.lastGameBad) return true;
  return false;
}
function getLineup(team) {
  syncLines(team);
  const benchSet = new Set(team.bench || []);
  const healthy = (p) => p && ((!p.injury || p.injury.gamesLeft <= 0) || p.playingThroughPain) && !benchSet.has(p.id);
  const forwards = [], defense = [];
  for (const key of ['f1','f2','f3','f4']) for (const id of team.lines[key].players) {
    const p = team.roster.find(x => x.id === id);
    if (p && p.position !== 'D' && p.position !== 'G' && healthy(p) && !forwards.includes(p)) forwards.push(p);
  }
  for (const key of ['d1','d2','d3']) for (const id of team.lines[key].players) {
    const p = team.roster.find(x => x.id === id);
    if (p && p.position === 'D' && healthy(p) && !defense.includes(p)) defense.push(p);
  }
  const g1 = team.roster.find(x => x.id === team.lines.g1);
  const g2 = team.roster.find(x => x.id === team.lines.g2);
  let goalie = null;
  if (healthy(g1) && !shouldRestGoalie(g1, g2)) goalie = g1;
  else if (healthy(g2)) goalie = g2;
  else if (healthy(g1)) goalie = g1;
  else goalie = team.roster.filter(x => x.position === 'G' && healthy(x)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a))[0];
  if (forwards.length < 12) { const extras = team.roster.filter(p => p.position !== 'D' && p.position !== 'G' && healthy(p) && !forwards.includes(p)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)); forwards.push(...extras.slice(0, 12 - forwards.length)); }
  if (defense.length < 6) { const extras = team.roster.filter(p => p.position === 'D' && healthy(p) && !defense.includes(p)).sort((a,b) => getEffectiveOvr(b) - getEffectiveOvr(a)); defense.push(...extras.slice(0, 6 - defense.length)); }
  return { forwards, defense, goalie, skaters: [...forwards, ...defense] };
}
function tacticMods(t, team) {
  const f = (t.forecheck - 50) / 50, p = (t.pressure - 50) / 50, s = (t.style - 50) / 50, ph = (t.physical - 50) / 50;
  const coachBonus = (team?.staff?.headCoach?.level || 0) * 0.01;
  return { atkMod: f * 0.12 + s * 0.08 + coachBonus, defMod: p * 0.10 - f * 0.06 + coachBonus, penRisk: Math.max(0, f * 0.5 + ph * 0.6) };
}
