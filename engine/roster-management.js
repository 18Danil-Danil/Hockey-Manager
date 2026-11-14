/* Управление составом, рынком, обменами и клубными действиями */
/* ============================================================
   РЫНОК / ОБМЕНЫ / ДРАФТ ОТКАЗОВ
   ============================================================ */
function generateFreeAgents(count = 30) { const agents = []; for (let i = 0; i < count; i++) agents.push(genPlayer(pick(['C','LW','RW','D','G']), randInt(60, 82), { status: 'ufa' })); return agents; }
function markYouthGraduateSigned(player, team, method = 'contract') {
  if (!player || !player.youthGraduated || !G.league.youth) return;
  const record = (G.league.youth.graduates || []).find(item => item.playerId === player.id);
  if (!record) return;
  record.status = 'signed';
  record.signedByTeamId = team.id;
  record.signedByTeamName = team.name;
  record.signingMethod = method;
}
function markYouthGraduateAvailable(player) {
  if (!player || !player.youthGraduated || !G.league.youth) return;
  const record = (G.league.youth.graduates || []).find(item => item.playerId === player.id);
  if (!record) return;
  record.status = 'available';
  record.signedByTeamId = null;
  record.signedByTeamName = null;
  record.signingMethod = null;
}
function signFreeAgent(team, player) {
  const idx = G.league.freeAgents.indexOf(player); if (idx === -1) return false;
  if (team.finance.balance < 0) return false;
  const foreigners = team.roster.filter(p => p.nationality !== 'Россия').length;
  if (player.nationality !== 'Россия' && foreigners >= 3) return false;
  G.league.freeAgents.splice(idx, 1); player.status = 'contract'; team.roster.push(player);
  markYouthGraduateSigned(player, team, 'contract');
  if (player.ovr >= 78) addNews('signing', `${team.name} подписал ${player.name} (${player.position}, ${player.ovr})`, 2);
  return true;
}
function offerTryout(team, player) {
  const idx = G.league.freeAgents.indexOf(player); if (idx === -1) return false;
  G.league.freeAgents.splice(idx, 1); player.status = 'tryout'; player.tryoutGames = 10;
  player.contract = { salary: 0.5, years: 0, bonusGoal: 0, bonusGames: 0, bonusPlayoff: 0, bonusMvp: 0, bonusTopScorer: 0 };
  team.roster.push(player);
  markYouthGraduateSigned(player, team, 'tryout');
  return true;
}
function hireStaff(candId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const idx = G.league.staffPool.findIndex(c => c.id === candId); if (idx === -1) return;
  const cand = G.league.staffPool[idx];
  if (team.staff[cand.role]) G.league.staffPool.push(team.staff[cand.role]);
  team.staff[cand.role] = cand; G.league.staffPool.splice(idx, 1);
}
function fireStaff(role) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff[role]) return; G.league.staffPool.push(team.staff[role]); team.staff[role] = null; }
function upgradeInfra(key) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const def = INFRA[key]; const lvl = team.infrastructure[key]; if (lvl >= def.maxLevel) return;
  const cost = def.upgradeCost(lvl); if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.infrastructure[key]++;
}
function upgradeArena(team) {
  if (team.arenaLevel >= 5) return; const cost = arenaUpgradeCost(team.arenaLevel);
  if (team.finance.balance < cost) return; team.finance.balance -= cost; team.arenaLevel++;
  team.finance.arenaCapacity = Math.round(team.finance.arenaCapacity * 1.3);
}
function upgradeMerch(team) {
  if (team.finance.merchLevel >= 5) return;
  const costs = { 1: 5, 2: 12, 3: 25, 4: 50 };
  const cost = costs[team.finance.merchLevel];
  if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.finance.merchLevel++;
}
function upgradeVip(team) {
  if (team.finance.vipLevel >= 3) return;
  const costs = { 0: 10, 1: 25, 2: 50 };
  const cost = costs[team.finance.vipLevel];
  if (team.finance.balance < cost) return;
  team.finance.balance -= cost; team.finance.vipLevel++;
}
function toggleMatchdayFlag(team, flag) {
  const costs = { fanzone: 2, show: 5, kidsTickets: 1 };
  if (!team.finance.matchdayFlags[flag]) {
    if (team.finance.balance < costs[flag]) return;
    team.finance.balance -= costs[flag]; team.finance.expenses.operations += costs[flag];
    team.finance.matchdayFlags[flag] = true;
  } else {
    team.finance.matchdayFlags[flag] = false;
  }
}
function suggestTactics() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff.assistantCoach) return;
  const lvl = team.staff.assistantCoach.level; const noise = Math.max(3, 20 - lvl * 3);
  const myAtk = teamAttackRating(team), myDef = teamDefenseRating(team);
  const avgAtk = G.league.teams.reduce((s, t) => s + teamAttackRating(t), 0) / G.league.teams.length;
  const avgDef = G.league.teams.reduce((s, t) => s + teamDefenseRating(t), 0) / G.league.teams.length;
  const atkDiff = myAtk - avgDef, defDiff = myDef - avgAtk;
  const t = team.tactics;
  t.pressure = clamp(50 + Math.round(-defDiff * 2) + randInt(-noise, noise), 0, 100);
  t.forecheck = clamp(50 + Math.round(atkDiff * 2) + randInt(-noise, noise), 0, 100);
  t.style = clamp(50 + Math.round(atkDiff - defDiff) + randInt(-noise, noise), 0, 100);
  t.physical = clamp(50 + randInt(-noise, noise), 0, 100);
  t.risk = clamp(50 + randInt(-noise, noise), 0, 100);
}
function suggestTraining() {
  const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team.staff.assistantCoach) return;
  for (const p of team.roster) {
    if (p.age > 27) continue;
    if (p.position === 'G') p.developmentFocus = p.attrs.reflexes < p.attrs.positioning ? 'reflexes' : 'positioning';
    else {
      const atk = (p.attrs.shooting + p.attrs.passing) / 2, def = (p.attrs.defense + p.attrs.iq) / 2, phy = (p.attrs.physical + p.attrs.skating) / 2;
      const min = Math.min(atk, def, phy);
      p.developmentFocus = min === atk ? 'attack' : min === def ? 'defense' : 'physical';
    }
  }
}
function putOnWaivers(playerId) {
  const team = G.league.teams.find(t => t.id === G.playerTeamId);
  const p = team.roster.find(x => x.id === playerId); if (!p || p.status === 'tryout') return;
  if ((team.waiversUsed || 0) >= 3) { showToast('Лимит: 3 игрока за сезон'); return; }
  team.waiversUsed = (team.waiversUsed || 0) + 1;
  G.league.waivers.push({ player: p, fromTeamId: team.id, expiresRound: G.league.currentRound + 2 });
  team.roster = team.roster.filter(x => x.id !== playerId); p.status = 'waivers';
  team.lines = null; initLines(team);
}
function processWaivers() {
  if (!G.league.waivers.length) return;
  const sorted = standingsSorted(); const remaining = [];
  for (const w of G.league.waivers) {
    if (G.league.currentRound >= w.expiresRound) { w.player.status = 'ufa'; G.league.freeAgents.push(w.player); continue; }
    let claimed = false;
    for (const team of sorted) {
      if (team.id === w.fromTeamId) continue;
      if (team.finance.balance < w.player.contract.salary * 2) continue;
      if (team.roster.length >= 30) continue;
      if (rng() < 0.08) { team.roster.push(w.player); w.player.status = 'contract'; claimed = true; break; }
    }
    if (!claimed) remaining.push(w);
  }
  G.league.waivers = remaining;
}
function tradeValue(p) {
  const potBonus = p.pot > p.ovr ? (p.pot - p.ovr) * 0.5 : 0;
  const ageFactor = p.age <= 24 ? 1.2 : p.age >= 31 ? 0.7 : 1.0;
  return Math.round((p.ovr * 2 + potBonus) * ageFactor);
}
function tradePositionTarget(position) {
  return position === 'G' ? 2 : position === 'D' ? 8 : 4;
}
function getTeamTradePlayerValue(team, player) {
  const base = tradeValue(player);
  const count = (team.roster || []).filter(item => item.position === player.position && item.id !== player.id).length;
  const target = tradePositionTarget(player.position);
  const needFactor = Math.max(0.82, Math.min(1.2, 1 + ((target - count) / Math.max(1, target)) * 0.18));
  const contractFactor = player.contract?.years <= 1 ? 0.96 : 1;
  return Math.round(base * needFactor * contractFactor);
}
function evaluateTradeProposal(myTeam, theirTeam, myOut, theirOut, myCash = 0, theirCash = 0) {
  if (!myTeam || !theirTeam || !Array.isArray(myOut) || !Array.isArray(theirOut)) return { decision: 'reject', reason: 'invalid', message: 'Не удалось проверить состав сделки' };
  if (!myOut.length && !myCash || !theirOut.length && !theirCash) return { decision: 'reject', reason: 'empty', message: 'В обеих частях сделки должны быть игроки или деньги' };
  if (myCash < 0 || theirCash < 0) return { decision: 'reject', reason: 'cash', message: 'Сумма не может быть отрицательной' };
  if (myCash > Number(myTeam.finance?.balance || 0) || theirCash > Number(theirTeam.finance?.balance || 0)) return { decision: 'reject', reason: 'budget', message: 'Одному из клубов не хватает средств' };
  const myIds = myOut.map(p => p.id), theirIds = theirOut.map(p => p.id);
  const myRosterAfter = myTeam.roster.filter(p => !myIds.includes(p.id)).concat(theirOut);
  const theirRosterAfter = theirTeam.roster.filter(p => !theirIds.includes(p.id)).concat(myOut);
  if (myRosterAfter.length > 25 || theirRosterAfter.length > 25) return { decision: 'reject', reason: 'roster-full', message: 'После обмена в одном из клубов будет больше 25 игроков' };
  const foreigners = roster => roster.filter(p => p.nationality !== 'Россия').length;
  if (foreigners(myRosterAfter) > 3 || foreigners(theirRosterAfter) > 3) return { decision: 'reject', reason: 'foreign-limit', message: 'После обмена будет превышен лимит легионеров' };
  const payroll = roster => roster.reduce((sum, p) => sum + (Number(p.contract?.salary) || 0), 0);
  if (payroll(myRosterAfter) > Number(myTeam.finance?.salaryCap || Infinity) || payroll(theirRosterAfter) > Number(theirTeam.finance?.salaryCap || Infinity)) {
    return { decision: 'reject', reason: 'salary-cap', message: 'После обмена один из клубов превысит потолок зарплат' };
  }
  const aiReceives = myOut.reduce((sum, p) => sum + getTeamTradePlayerValue(theirTeam, p), 0) + myCash * 5;
  const aiGives = theirOut.reduce((sum, p) => sum + getTeamTradePlayerValue(theirTeam, p), 0) + theirCash * 5;
  const ratio = aiGives > 0 ? aiReceives / aiGives : Infinity;
  if (ratio >= 0.9) return { decision: 'accept', reason: 'fair-value', message: 'Клуб считает предложение приемлемым', ratio, aiReceives, aiGives };
  if (ratio >= 0.7) {
    const extraCash = Math.ceil(Math.max(0, aiGives * 0.9 - aiReceives) / 5 * 10) / 10;
    return { decision: 'counter', reason: 'counteroffer', message: 'Клуб готов продолжить переговоры, но просит доплату', ratio, aiReceives, aiGives, extraCash, counterMyCash: Math.round((myCash + extraCash) * 10) / 10 };
  }
  return { decision: 'reject', reason: 'value-gap', message: 'Клуб не заинтересован: разница в ценности игроков слишком велика', ratio, aiReceives, aiGives };
}
function executeMultiTrade(myIds, theirIds, aiTeamId, myCash = 0, theirCash = 0) {
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const theirTeam = G.league.teams.find(t => t.id === aiTeamId);
  if (!myTeam || !theirTeam) return { success: false, error: 'Команда не найдена' };
  if (theirTeam.id === myTeam.id) return { success: false, error: 'Нельзя обменять с самим собой' };
  const myOut = myTeam.roster.filter(p => myIds.includes(p.id));
  const theirOut = theirTeam.roster.filter(p => theirIds.includes(p.id));
  if (myOut.length !== myIds.length || theirOut.length !== theirIds.length) return { success: false, error: 'Игрок не найден' };
  const evaluation = evaluateTradeProposal(myTeam, theirTeam, myOut, theirOut, myCash, theirCash);
  if (evaluation.decision !== 'accept') return { success: false, error: evaluation.message, evaluation };
  const myForeignKeep = myTeam.roster.filter(p => p.nationality !== 'Россия' && !myIds.includes(p.id)).length;
  const theirForeignKeep = theirTeam.roster.filter(p => p.nationality !== 'Россия' && !theirIds.includes(p.id)).length;
  const myIncoming = theirOut.filter(p => p.nationality !== 'Россия').length;
  const theirIncoming = myOut.filter(p => p.nationality !== 'Россия').length;
  if (myForeignKeep + myIncoming > 3) return { success: false, error: 'У тебя превысится лимит легионеров' };
  if (theirForeignKeep + theirIncoming > 3) return { success: false, error: 'У соперника превысится лимит легионеров' };
  [...myOut, ...theirOut].forEach(player => { player.transferRequest = false; player.transferListed = false; });
  myTeam.roster = myTeam.roster.filter(p => !myIds.includes(p.id)).concat(theirOut);
  theirTeam.roster = theirTeam.roster.filter(p => !theirIds.includes(p.id)).concat(myOut);
  myTeam.finance.balance -= myCash; myTeam.finance.balance += theirCash;
  theirTeam.finance.balance -= theirCash; theirTeam.finance.balance += myCash;
  myTeam.finance.expenses.transfers += myCash; theirTeam.finance.expenses.transfers += theirCash;
  myTeam.lines = null; theirTeam.lines = null;
  syncLines(myTeam); syncLines(theirTeam);
  const involved = [...myOut, ...theirOut].filter(p => p.ovr >= 78);
  for (const p of involved) addNews('trade', `${p.name} (${p.ovr}) сменил клуб в результате обмена`, 2);
  return { success: true };
}
function proposeMultiTrade() {
  if (isTradeDeadlinePassed()) { showToast('Трансферный дедлайн закрыт'); return; }
  G.pendingTradeCounter = null;
  const myIds = Array.from(document.querySelectorAll('.trade-my-pick:checked')).map(el => Number(el.value));
  const theirIds = Array.from(document.querySelectorAll('.trade-their-pick:checked')).map(el => Number(el.value));
  const aiTeamId = G.tradeTargetTeamId;
  const myCash = Number(document.getElementById('my-cash')?.value || 0);
  const theirCash = Number(document.getElementById('their-cash')?.value || 0);
  if (!myIds.length && !myCash) { showToast('Выбери хотя бы одного игрока или деньги'); return; }
  if (!theirIds.length && !theirCash) { showToast('Выбери хотя бы одного игрока соперника или деньги'); return; }
  if (!aiTeamId) { showToast('Выбери команду соперника'); return; }
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const theirTeam = G.league.teams.find(t => t.id === aiTeamId);
  const myOut = myTeam?.roster.filter(p => myIds.includes(p.id)) || [];
  const theirOut = theirTeam?.roster.filter(p => theirIds.includes(p.id)) || [];
  const evaluation = evaluateTradeProposal(myTeam, theirTeam, myOut, theirOut, myCash, theirCash);
  if (evaluation.decision === 'counter') {
    G.pendingTradeCounter = { myIds, theirIds, aiTeamId, myCash, theirCash, counterMyCash: evaluation.counterMyCash, message: evaluation.message };
    showToast('Клуб выдвинул встречные условия');
    render();
    return;
  }
  if (evaluation.decision === 'reject') { showToast('Обмен отклонён: ' + evaluation.message); return; }
  const r = executeMultiTrade(myIds, theirIds, aiTeamId, myCash, theirCash);
  if (r.success) { showToast('Обмен состоялся!'); render(); } else showToast('Обмен отклонён: ' + (r.error || ''));
}
function acceptTradeCounterOffer() {
  const offer = G.pendingTradeCounter;
  if (!offer) return false;
  const result = executeMultiTrade(offer.myIds, offer.theirIds, offer.aiTeamId, offer.counterMyCash, offer.theirCash);
  if (!result.success) { showToast('Не удалось принять условия: ' + result.error); return false; }
  G.pendingTradeCounter = null;
  showToast('Обмен состоялся на встречных условиях!');
  render();
  return true;
}
function declineTradeCounterOffer() {
  G.pendingTradeCounter = null;
  render();
}
function prepareTradeForPlayer(teamId, playerId) {
  G.tradeTargetTeamId = Number(teamId);
  G.marketTargetPlayerId = Number(playerId);
  G.activeTab = 'trades';
  G.navGroupOpen = 'transfers';
  render();
}
function setTradeTeam(teamId) { G.tradeTargetTeamId = Number(teamId); render(); }
function generateAITradeOffer() {
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId); if (!myTeam) return;
  const aiTeams = G.league.teams.filter(t => t.id !== G.playerTeamId); if (!aiTeams.length) return;
  const aiTeam = pick(aiTeams); if (aiTeam.roster.length < 18) return;
  const myTargets = myTeam.roster.filter(p => p.transferRequest || (p.ovr >= 70 && p.age <= 30)).sort((a, b) => Number(!!b.transferRequest) - Number(!!a.transferRequest) || tradeValue(b) - tradeValue(a));
  if (!myTargets.length) return;
  const target = rng() < 0.5 ? myTargets[0] : pick(myTargets.slice(0, Math.min(5, myTargets.length)));
  const targetValue = tradeValue(target);
  const aiAssets = aiTeam.roster.filter(p => tradeValue(p) <= targetValue * 1.15).sort((a, b) => tradeValue(b) - tradeValue(a));
  if (!aiAssets.length) return;
  const offerPlayers = []; let remaining = targetValue * (0.9 + rng() * 0.2);
  for (const p of aiAssets) { if (remaining <= 0 || offerPlayers.length >= 2) break; if (tradeValue(p) <= remaining + 30) { offerPlayers.push(p); remaining -= tradeValue(p); } }
  if (!offerPlayers.length) return;
  const myForeignAfter = myTeam.roster.filter(p => p.nationality !== 'Россия' && p.id !== target.id).length + offerPlayers.filter(p => p.nationality !== 'Россия').length;
  const aiForeignAfter = aiTeam.roster.filter(p => p.nationality !== 'Россия' && !offerPlayers.some(op => op.id === p.id)).length + (target.nationality !== 'Россия' ? 1 : 0);
  if (myForeignAfter > 3 || aiForeignAfter > 3) return;
  const offer = { id: nextId(), fromTeamId: aiTeam.id, theyOffer: offerPlayers.map(p => p.id), theyWant: [target.id], expiresRound: G.league.currentRound + 3 };
  G.league.aiTradeOffers.push(offer);
  addInboxMessage('league', aiTeam.name, `Предложение обмена`,
    `${aiTeam.name} предлагает обмен: отдаёт ${offerPlayers.map(p => p.name + ' (' + p.ovr + ')').join(', ')} за ${target.name}.`,
    [{ label: '✅ Принять', action: 'trade_accept', payload: { offerId: offer.id } }, { label: '❌ Отклонить', action: 'trade_decline', payload: { offerId: offer.id } }]);
}
function acceptAITradeOffer(offerId) {
  const offer = G.league.aiTradeOffers.find(o => o.id === offerId); if (!offer) return;
  const myTeam = G.league.teams.find(t => t.id === G.playerTeamId);
  const aiTeam = G.league.teams.find(t => t.id === offer.fromTeamId);
  if (!myTeam || !aiTeam) { G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  if (!offer.theyWant.every(id => myTeam.roster.some(p => p.id === id))) { showToast('Игрок не в твоей команде'); G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  if (!offer.theyOffer.every(id => aiTeam.roster.some(p => p.id === id))) { showToast('Игрок не в команде соперника'); G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); return; }
  const myOut = myTeam.roster.filter(p => offer.theyWant.includes(p.id));
  const theirOut = aiTeam.roster.filter(p => offer.theyOffer.includes(p.id));
  const evaluation = evaluateTradeProposal(myTeam, aiTeam, myOut, theirOut, 0, 0);
  if (evaluation.decision === 'counter') {
    G.pendingTradeCounter = { myIds: offer.theyWant.slice(), theirIds: offer.theyOffer.slice(), aiTeamId: aiTeam.id, myCash: 0, theirCash: 0, counterMyCash: evaluation.counterMyCash, message: evaluation.message };
    G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId);
    render();
    return;
  }
  if (evaluation.decision !== 'accept') {
    showToast('Обмен не проходит проверку: ' + evaluation.message, 'error');
    G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId);
    render();
    return;
  }
  [...myOut, ...theirOut].forEach(player => { player.transferRequest = false; player.transferListed = false; });
  myTeam.roster = myTeam.roster.filter(p => !offer.theyWant.includes(p.id)).concat(theirOut);
  aiTeam.roster = aiTeam.roster.filter(p => !offer.theyOffer.includes(p.id)).concat(myOut);
  myTeam.lines = null; aiTeam.lines = null;
  syncLines(myTeam); syncLines(aiTeam);
  G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId);
  showToast('Обмен принят!'); render();
}
function declineAITradeOffer(offerId) { G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.id !== offerId); render(); }
function runAITransfers() {
  const teams = G.league.teams.filter(t => t.id !== G.playerTeamId);
  const freeAgents = G.league.freeAgents; if (!freeAgents.length) return;
  for (const team of teams) {
    if (rng() > 0.2) continue;
    if (team.roster.length >= 25) continue;
    const currentSalary = team.roster.reduce((s, p) => s + p.contract.salary, 0);
    const salaryRoom = team.finance.salaryCap - currentSalary;
    if (salaryRoom < 2) continue;
    const candidates = freeAgents.filter(p => p.contract.salary <= salaryRoom * 0.7).sort((a, b) => b.ovr - a.ovr);
    if (!candidates.length) continue;
    const target = candidates[0];
    // ⚙️ ФИКС: лимит легионеров у ИИ тоже соблюдается
    const foreigners = team.roster.filter(p => p.nationality !== 'Россия').length;
    if (target.nationality !== 'Россия' && foreigners >= 3) continue;
    const idx = freeAgents.indexOf(target);
    if (idx !== -1) { freeAgents.splice(idx, 1); target.status = 'contract'; team.roster.push(target); markYouthGraduateSigned(target, team, 'contract'); }
  }
}
function runAIContractExtensions() {
  for (const team of G.league.teams) {
    if (team.id === G.playerTeamId) continue;
    for (const p of team.roster) {
      if (!p.contract || p.status === 'tryout' || Number(p.contract.years) > 1) continue;
      if (G.league.currentRound - (Number(p.lastContractNegotiationRound) || -10) < 5) continue;
      if (rng() > 0.22) continue;
      p.lastContractNegotiationRound = G.league.currentRound;
      const demand = getPlayerContractDemand(p, team, 'renewal');
      const salary = Math.max(Number(p.contract.salary) || 0.5, Math.round(demand.salary * (0.94 + rng() * 0.12) * 10) / 10);
      const years = Math.max(1, Math.min(5, demand.years + (rng() < 0.25 ? -1 : rng() > 0.82 ? 1 : 0)));
      const offer = { salary, years };
      let result = evaluatePlayerContractOffer(p, team, offer, 'renewal');
      if (result.decision === 'counter') {
        const counter = result.counteroffer;
        const counterCost = team.roster.reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0)
          - (Number(p.contract.salary) || 0) + counter.salary;
        if (counterCost <= Number(team.finance.salaryCap) && rng() < (0.55 + (getPlayerContractPreferences(p).loyalty * 0.35))) {
          result = applyPlayerContractAgreement(team, p, counter, 'renewal');
        }
      } else if (result.decision === 'accept') {
        result = applyPlayerContractAgreement(team, p, offer, 'renewal');
      }
      if (result.applied && p.ovr >= 80) {
        addNews('contract', team.name + ' договорился о новом контракте с ' + p.name, 1);
      }
    }
  }
}
function refreshAITransferLists() {
  for (const team of G.league.teams) {
    if (team.id === G.playerTeamId) continue;
    const byPosition = {};
    for (const player of team.roster || []) (byPosition[player.position] ||= []).push(player);
    for (const [position, players] of Object.entries(byPosition)) {
      const target = tradePositionTarget(position);
      if (players.length <= target) continue;
      const sorted = players.slice().sort((a, b) => (a.ovr || 0) - (b.ovr || 0));
      const surplus = players.length - target;
      for (const player of sorted.slice(0, Math.min(2, surplus))) {
        const peers = players.filter(item => item.id !== player.id);
        const average = peers.length ? peers.reduce((sum, item) => sum + (Number(item.ovr) || 0), 0) / peers.length : player.ovr;
        const isVeteran = Number(player.age) >= 28;
        const isDepthPlayer = Number(player.ovr) <= average - 2 || (team.bench || []).includes(player.id);
        if (isVeteran && isDepthPlayer && !player.transferRequest) player.transferListed = true;
      }
    }
  }
}
function runAIActions() {
  refreshAITransferLists();
  runAITransfers(); runAIContractExtensions();
  if (rng() < 0.35) generateAITradeOffer();
  if (rng() < 0.15) generateAITradeOffer();
  G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.expiresRound > G.league.currentRound);
}

/* ============================================================
   ДЕДЛАЙН ОБМЕНОВ
   ============================================================ */
function isTradeDeadlinePassed() {
  if (!G.league) return false;
  if (G.league.currentRound < 40) return false;
  return true;
}
function checkTradeDeadlineNews() {
  if (G.league.tradeDeadlineNotified) return;
  if (G.league.currentRound === 40) {
    G.league.tradeDeadlineNotified = true;
    addNews('trade_deadline', 'Трансферный дедлайн закрыт. Обмены до конца сезона невозможны.', 3);
    if (G.playerTeamId) addInboxMessage('league', 'Лига', 'Трансферный дедлайн', 'Обмены между клубами закрыты до конца сезона. Подписания свободных агентов и продления контрактов остаются доступными.', []);
  }
}

