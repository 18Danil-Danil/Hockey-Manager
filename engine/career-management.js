/* ============================================================
   РЕПУТАЦИЯ / СОВЕТ ДИРЕКТОРОВ
   ============================================================ */
function updateReputation(team, won) {
  if (!G.career) G.career = { reputation: 50, history: [], noFireMode: false };
  let delta = won ? 0.5 : -0.5;
  if (G.career.noFireMode && delta < 0) delta *= 0.5;
  G.career.reputation = clamp(G.career.reputation + delta, 0, 100);
}
function generateBoardMessage() {
  if (!G.playerTeamId) return;
  if (G.league.currentRound === 0) return;
  if (G.league.currentRound % 10 !== 0) return;
  if (G.league.currentRound >= G.league.schedule.length) return;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const rank = standingsSorted().findIndex(t => t.id === G.playerTeamId) + 1;
  const diff = G.difficulty || DIFFICULTIES.normal;
  let mood = 'нейтрально';
  let delta = 0;
  if (rank <= diff.boardRequirement) { mood = 'хорошо'; delta = 3; }
  else if (rank <= diff.boardRequirement + 4) { mood = 'удовлетворительно'; delta = 0; }
  else { mood = 'плохо'; delta = -4; }
  G.career.reputation = clamp(G.career.reputation + delta, 0, 100);
  const reqText = rank <= diff.boardRequirement ? 'выше требуемого' : 'ниже требуемого';
  addInboxMessage('board', 'Совет директоров', `Оценка работы: ${mood}`,
    `Совет директоров оценивает текущее положение (${rank}-е место, ${reqText}). Репутация тренера: ${Math.round(G.career.reputation)}/100.`,
    []);
}
function maybeFirePlayer() {
  if (!G.playerTeamId) return false;
  if (G.career && G.career.noFireMode) return false;
  if (G.career.reputation >= 15) return false;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  addNews('firing', `${team.name} расторг контракт с главным тренером`, 3);
  G.firedFromTeamId = G.playerTeamId;
  G.playerTeamId = null;
  G.career.freeAgent = true;
  G.career.lastTeamName = team.name;
  return true;
}
function maybeForcedFreeAgent() {
  if (!G.playerTeamId) return false;
  if (!G.career || !G.career.noFireMode) return false;
  if (G.career.reputation >= 15) return false;
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  addNews('firing', `${team.name} и главный тренер расторгли контракт по обоюдному согласию`, 3);
  G.firedFromTeamId = G.playerTeamId;
  G.playerTeamId = null;
  G.career.freeAgent = true;
  G.career.lastTeamName = team.name;
  return true;
}

/* ============================================================
   RETIREMENT
   ============================================================ */
function processRetirements(team) {
  const retiring = [];
  for (const p of team.roster) {
    if (p.status === 'tryout') continue;
    let chance = 0;
    if (p.age >= 40) chance = 0.95;
    else if (p.age >= 38) chance = 0.75;
    else if (p.age >= 36) chance = 0.45;
    else if (p.age >= 34) chance = 0.20;
    else if (p.age >= 32 && p.ovr < 70) chance = 0.15;
    if (rng() < chance) retiring.push(p);
  }
  for (const p of retiring) {
    p.status = 'retired';
    addNews('retirement', `${p.name} (${p.position}, ${p.ovr} OVR, ${p.age} лет) завершил карьеру. Клуб: ${team.name}`, p.ovr >= 80 ? 3 : 2);
    if (team.id === G.playerTeamId) addInboxMessage('coach', 'Тренер', `${p.name} завершил карьеру`, `${p.name} (${p.position}, ${p.ovr}) в ${p.age} лет завершил карьеру.`, []);
  }
  team.roster = team.roster.filter(p => p.status !== 'retired');
  return retiring;
}
