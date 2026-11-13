/* ============================================================
   РЕАБИЛИТАЦИЯ / ИНДИВИДУАЛЬНЫЕ ТРЕНИРОВКИ
   ============================================================ */
function rehabPlayer(playerId, gamesToSkip) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  if (!p.injury || p.injury.gamesLeft <= 0) return { success: false, error: 'Игрок здоров' };
  const lastRound = team.lastRehabRound || -10;
  if (G.league.currentRound - lastRound < 5) return { success: false, error: 'Раз в 5 туров' };
  const maxSkip = Math.min(gamesToSkip, 5, p.injury.gamesLeft);
  if (maxSkip <= 0) return { success: false, error: 'Нечего ускорять' };
  const cost = maxSkip * 1;
  if (team.finance.balance < cost) return { success: false, error: 'Мало денег' };
  team.finance.balance -= cost; team.finance.expenses.bonuses += cost;
  p.injury.gamesLeft -= maxSkip;
  if (p.injury.gamesLeft <= 0) { p.injury = null; p.playingThroughPain = false; }
  team.lastRehabRound = G.league.currentRound;
  return { success: true, cost, gamesSkipped: maxSkip };
}
function individualTraining(playerId, attr) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  const lastRound = p.lastIndTraining || -10;
  if (G.league.currentRound - lastRound < 5) return { success: false, error: 'Раз в 5 туров' };
  if (team.finance.balance < 0.5) return { success: false, error: 'Нужно 0.5 млн ₽' };
  const attrs = p.position === 'G' ? GOALIE_ATTRS : SKATER_ATTRS;
  if (!attrs.includes(attr)) return { success: false, error: 'Неверный атрибут' };
  if (p.attrs[attr] >= p.attrPot[attr]) return { success: false, error: 'Атрибут уже на потенциале' };
  team.finance.balance -= 0.5; team.finance.expenses.operations += 0.5;
  p.attrs[attr]++;
  p.ovr = overallFromAttrs(p.attrs, p.position === 'G');
  p.lastIndTraining = G.league.currentRound;
  return { success: true, attr };
}

/* ============================================================
   РАЗРЫВ КОНТРАКТА
   ============================================================ */
function releasePlayer(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId);
  if (!p) return { success: false, error: 'Игрок не найден' };
  if (p.status === 'tryout') return { success: false, error: 'Просмотровый контракт нельзя разорвать' };
  const remainingSalary = p.contract.salary * Math.max(0, p.contract.years);
  const cost = Math.round(remainingSalary * 0.5 * 10) / 10;
  if (team.finance.balance < cost) return { success: false, error: `Нужно ${cost} млн ₽` };
  team.finance.balance -= cost;
  team.finance.expenses.bonuses += cost;
  p.status = 'ufa';
  p.contract = contractFor(p.ovr, p.age);
  team.roster = team.roster.filter(x => x.id !== p.id);
  G.league.freeAgents.push(p);
  markYouthGraduateAvailable(p);
  addNews('release', `${team.name} разорвал контракт с ${p.name} (${p.ovr} OVR). Компенсация: ${cost} млн ₽`, p.ovr >= 78 ? 2 : 1);
  team.lines = null; initLines(team);
  return { success: true, cost, player: p };
}
