/* ============================================================
   ПРОГНОЗ БОЛЕЛЬЩИКОВ
   ============================================================ */
function fanExpectation(team, opponent, isHome) {
  const myT = team.talent || 70;
  const oppT = opponent.talent || 70;
  const diff = myT - oppT + (isHome ? 2 : -2);
  if (diff > 5) return { key: 'win', label: 'победу', moraleWin: 1, moraleLose: -2 };
  if (diff > 1) return { key: 'win-tight', label: 'победу', moraleWin: 1, moraleLose: -1 };
  if (diff < -5) return { key: 'lose', label: 'поражение', moraleWin: 2, moraleLose: -1 };
  if (diff < -1) return { key: 'lose-tight', label: 'поражение', moraleWin: 1, moraleLose: -1 };
  return { key: 'draw', label: 'равную игру', moraleWin: 1, moraleLose: -1 };
}
function applyFanExpectation(team, expected, won, isHome) {
  const f = team.finance;
  let fb = 0, moraleDelta = 0;
  const expectedWin = expected.key === 'win' || expected.key === 'win-tight';
  const expectedLose = expected.key === 'lose' || expected.key === 'lose-tight';
  if (won) {
    if (expectedWin) { fb = 0.5; moraleDelta = expected.moraleWin; }
    else if (expectedLose) { fb = 1.5; moraleDelta = expected.moraleWin; addNews('upset', `${team.name} преподнёс сенсацию, обыграв фаворита`, 2); }
    else { fb = 1; moraleDelta = 1; }
  } else {
    if (expectedWin) { fb = -1.5; moraleDelta = expected.moraleLose; addNews('disappointment', `${team.name} не оправдал ожиданий болельщиков`, 2); }
    else if (expectedLose) { fb = -0.3; moraleDelta = expected.moraleLose; }
    else { fb = -0.5; moraleDelta = -1; }
  }
  f.fanBase = clamp(f.fanBase + fb * 0.01, 0.15, 1.0);
  for (const p of team.roster) p.morale = clamp(p.morale + moraleDelta, 20, 100);
}


/* ============================================================
   ЦЕЛИ ИГРОКОВ
   ============================================================ */
function assignSeasonGoals(team) {
  for (const p of team.roster) {
    if (p.age > 34 || p.ovr < 65) { p.seasonGoal = null; continue; }
    const options = [];
    if (p.position !== 'G') {
      if (p.ovr >= 78) options.push({ type: 'top6', description: 'Играть в топ-6' });
      if (p.ovr >= 72) options.push({ type: 'points', value: Math.round(p.ovr * 0.55), description: `Набрать ${Math.round(p.ovr * 0.55)} очков` });
      options.push({ type: 'playoff', description: 'Выйти в плей-офф' });
      if (p.age <= 24 && p.ovr < 78) options.push({ type: 'notBottom6', description: 'Закрепиться выше 4-го звена' });
    } else {
      options.push({ type: 'playoff', description: 'Выйти в плей-офф' });
      if (p.ovr >= 75) options.push({ type: 'wins', value: Math.round(p.ovr * 0.4), description: `Одержать ${Math.round(p.ovr * 0.4)} побед` });
    }
    if (!options.length) { p.seasonGoal = null; continue; }
    p.seasonGoal = { ...pick(options), achieved: null };
  }
}
function checkSeasonGoals(team, playoffReached) {
  for (const p of team.roster) {
    if (!p.seasonGoal) continue;
    const g = p.seasonGoal; const s = ensureStats(p);
    let achieved = false;
    if (g.type === 'points') achieved = (s.points || 0) >= g.value;
    else if (g.type === 'wins') achieved = (s.wins || 0) >= g.value;
    else if (g.type === 'playoff') achieved = playoffReached;
    else if (g.type === 'top6') { if (team.lines) { const line = findPlayerLine(team, p.id); achieved = line && (line.lineKey === 'f1' || line.lineKey === 'f2'); } }
    else if (g.type === 'notBottom6') { if (team.lines) { const line = findPlayerLine(team, p.id); achieved = line && line.lineKey !== 'f4'; } }
    p.seasonGoal.achieved = achieved;
    if (achieved) p.morale = Math.min(100, p.morale + 3);
    else { p.morale = Math.max(20, p.morale - 5); if (team.id === G.playerTeamId) addInboxMessage('player', p.name, `Цель сезона не выполнена`, `«${g.description}» — не удалось. Мораль снижена.`, []); }
  }
}
