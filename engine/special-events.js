/* ============================================================
   RETRO MATCH
   ============================================================ */
function triggerRetroMatch() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return;
  team.finance.fanBase = clamp(team.finance.fanBase + 0.01, 0.15, 1.0);
  const bonus = 2 + Math.round(team.finance.fanBase * 3);
  team.finance.balance += bonus; team.finance.income.matchdayExtras += bonus;
  G.league.retroMatch = { season: G.league.season };
  addNews('event', `${team.name} провёл ретро-матч в форме 1990-х! +${bonus} млн ₽, фанбаза +1%`, 2);
  addInboxMessage('marketing', 'Маркетолог', `Ретро-матч — успех!`, `Матч в форме 1990-х вызвал ажиотаж. +${bonus} млн ₽, фанбаза +1%.`, []);
}

/* ============================================================
   МАТЧ ОТКРЫТИЯ
   ============================================================ */
function setupOpeningCup() {
  const sorted = standingsSorted();
  const regularChampionId = G.lastRegularChampionId;
  const cupHolderId = G.lastCupHolderId;
  let aId, bId;
  if (regularChampionId && cupHolderId && regularChampionId !== cupHolderId) { aId = regularChampionId; bId = cupHolderId; }
  else if (regularChampionId) { aId = regularChampionId; bId = (G.lastFinalistId && G.lastFinalistId !== regularChampionId) ? G.lastFinalistId : sorted[1].id; }
  else { aId = sorted[0].id; bId = sorted[1].id; }
  G.league.openingCup = { aId, bId, played: false, result: null, winnerId: null, season: G.league.season };
}
function autoPlayOpeningCup() {
  if (!G.league.openingCup || G.league.openingCup.played) return null;
  const oc = G.league.openingCup;
  const teamA = G.league.teams.find(t => t.id === oc.aId);
  const teamB = G.league.teams.find(t => t.id === oc.bId);
  if (!teamA || !teamB) { oc.played = true; return null; }
  const res = simGame(teamA.id, teamB.id, false);
  const winner = res.hg > res.ag ? teamA : teamB;
  const loser = res.hg > res.ag ? teamB : teamA;
  const hgA = res.hg, hgB = res.ag;
  oc.result = { hgA, hgB, ot: res.ot };
  oc.winnerId = winner.id;
  oc.played = true;
  winner.finance.balance += 5;
  winner.finance.income.prizes += 5;
  if (!winner.trophies) winner.trophies = { petrov: [], regular: [], opening: [] };
  if (!winner.trophies.opening) winner.trophies.opening = [];
  winner.trophies.opening.push(String(G.league.season));
  addNews('opening_cup', `${winner.name} выиграл Матч Открытия у ${loser.name} (${hgA}:${hgB}${res.ot ? ' ОТ' : ''})`, 3);
  const myTeamInvolved = (teamA.id === G.playerTeamId || teamB.id === G.playerTeamId);
  if (myTeamInvolved) {
    G.openingCupModal = { teamA: { name: teamA.name, id: teamA.id }, teamB: { name: teamB.name, id: teamB.id }, hgA, hgB, ot: res.ot, winner: { name: winner.name, id: winner.id }, isMyTeam: winner.id === G.playerTeamId };
    addInboxMessage('board', 'Совет директоров', winner.id === G.playerTeamId ? '🏆 Матч Открытия — победа!' : 'Матч Открытия — поражение', `${winner.name} победил ${loser.name} ${hgA}:${hgB}${res.ot ? ' ОТ' : ''}.`, []);
  }
  return { winner, loser, teamA, teamB, hgA, hgB, ot: res.ot };
}
