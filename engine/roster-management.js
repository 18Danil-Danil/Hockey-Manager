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
function getVHLTransferQuote(player, sellingTeam, buyingTeam) {
  if (!player || !sellingTeam || !buyingTeam) return { allowed: false, reason: 'Не удалось определить игрока или клуб', price: 0 };
  const ageFactor = Number(player.age) <= 23 ? 1.12 : Number(player.age) >= 31 ? 0.82 : 1;
  const potentialGap = Math.max(0, Number(player.pot || player.ovr) - Number(player.ovr || 0));
  const listedFactor = player.transferRequest ? 0.9 : 1;
  const price = Math.round(Math.max(0.5, ((Number(player.ovr || 60) - 55) * 0.16 + potentialGap * 0.055) * ageFactor * listedFactor) * 10) / 10;
  const currentSalary = (buyingTeam.roster || []).reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0);
  const salary = Number(player.contract?.salary) || 0.5;
  const foreigners = (buyingTeam.roster || []).filter(item => item.nationality !== 'Россия').length;
  let reason = '';
  if (sellingTeam.id === buyingTeam.id) reason = 'Нельзя купить игрока у собственного клуба';
  else if (!player.transferListed && !player.transferRequest) reason = 'Клуб не выставлял игрока на трансфер';
  else if (typeof isTradeDeadlinePassed === 'function' && isTradeDeadlinePassed()) reason = 'Трансферное окно закрыто после 40-го тура';
  else if ((buyingTeam.roster || []).length >= 25) reason = 'В составе уже 25 игроков';
  else if ((sellingTeam.roster || []).length <= 18) reason = 'У клуба-продавца недостаточно игроков для сделки';
  else if (player.nationality !== 'Россия' && foreigners >= 3) reason = 'Лимит легионеров (3) уже исчерпан';
  else if (currentSalary + salary > Number(buyingTeam.finance?.salaryCap ?? Infinity)) reason = 'Не хватает места под потолком зарплат';
  else if (Number(buyingTeam.finance?.balance || 0) < price) reason = 'Недостаточно средств для трансфера';
  return { allowed: !reason, reason, price, salary };
}
function evaluateVHLTransferOffer(player, sellingTeam, buyingTeam, offeredPrice, askingPrice, round = 1) {
  const offer = Number(offeredPrice);
  const asking = Number(askingPrice);
  if (!Number.isFinite(offer) || offer <= 0) return { decision: 'reject', message: 'Укажи положительную сумму' };
  if (!Number.isFinite(asking) || asking <= 0) return { decision: 'reject', message: 'Не удалось определить запрашиваемую сумму' };
  if (offer > Number(buyingTeam?.finance?.balance || 0)) return { decision: 'reject', message: 'У клуба не хватает денег на такое предложение' };
  const acceptance = round <= 1 ? 0.94 : 0.97;
  if (offer >= asking * acceptance) return { decision: 'accept', agreedPrice: Math.round(offer * 10) / 10, message: 'Клуб согласен на трансфер' };
  if (round >= 3 || offer < asking * 0.68) return { decision: 'reject', message: round >= 3 ? 'Клуб завершил переговоры после трёх раундов' : 'Предложение слишком далеко от ожиданий клуба' };
  const counterPrice = Math.round(Math.max(offer + 0.1, asking * (round === 1 ? 0.92 : 0.96)) * 10) / 10;
  return { decision: 'counter', counterPrice, message: 'Клуб выдвинул встречную цену' };
}
function startVHLTransferNegotiation(sellingTeamId, playerId) {
  const seller = G.league?.teams.find(item => Number(item.id) === Number(sellingTeamId));
  const buyer = G.league?.teams.find(item => item.id === G.playerTeamId);
  const player = seller?.roster.find(item => Number(item.id) === Number(playerId));
  const quote = getVHLTransferQuote(player, seller, buyer);
  if (!quote.allowed) { showToast(quote.reason, 'error'); return false; }
  G.pendingVHLTransferNegotiation = { sellingTeamId: seller.id, playerId: player.id, askingPrice: quote.price, round: 1, counterPrice: null };
  render();
  return true;
}
function submitVHLTransferOffer() {
  const state = G.pendingVHLTransferNegotiation;
  if (!state) return false;
  const seller = G.league.teams.find(item => Number(item.id) === Number(state.sellingTeamId));
  const buyer = G.league.teams.find(item => item.id === G.playerTeamId);
  const player = seller?.roster.find(item => Number(item.id) === Number(state.playerId));
  const quote = getVHLTransferQuote(player, seller, buyer);
  if (!quote.allowed) { showToast(quote.reason, 'error'); G.pendingVHLTransferNegotiation = null; render(); return false; }
  const field = document.getElementById('vhl-transfer-offer');
  const offer = Number(field?.value);
  const evaluation = evaluateVHLTransferOffer(player, seller, buyer, offer, state.counterPrice || state.askingPrice, state.round);
  if (evaluation.decision === 'accept') {
    G.pendingVHLTransferNegotiation = null;
    return buyVHLPlayer(seller.id, player.id, evaluation.agreedPrice);
  }
  if (evaluation.decision === 'counter') {
    state.counterPrice = evaluation.counterPrice;
    state.round += 1;
    showToast('Встречное предложение: ' + evaluation.counterPrice.toFixed(1) + ' млн ₽');
    render();
    return true;
  }
  showToast(evaluation.message, 'error');
  G.pendingVHLTransferNegotiation = null;
  render();
  return false;
}
function acceptVHLTransferCounter() {
  const state = G.pendingVHLTransferNegotiation;
  if (!state?.counterPrice) return false;
  const price = state.counterPrice;
  const seller = G.league.teams.find(item => Number(item.id) === Number(state.sellingTeamId));
  const player = seller?.roster.find(item => Number(item.id) === Number(state.playerId));
  G.pendingVHLTransferNegotiation = null;
  return buyVHLPlayer(state.sellingTeamId, state.playerId, price);
}
function cancelVHLTransferNegotiation() {
  G.pendingVHLTransferNegotiation = null;
  render();
}
function buyVHLPlayer(sellingTeamId, playerId, negotiatedPrice = null) {
  const buyingTeam = G.league?.teams.find(item => item.id === G.playerTeamId);
  const sellingTeam = G.league?.teams.find(item => Number(item.id) === Number(sellingTeamId));
  const player = sellingTeam?.roster.find(item => Number(item.id) === Number(playerId));
  if (!buyingTeam || !sellingTeam || !player) { showToast('Игрок или клуб не найден', 'error'); return false; }
  const quote = getVHLTransferQuote(player, sellingTeam, buyingTeam);
  if (!quote.allowed && (negotiatedPrice === null || quote.reason !== 'Недостаточно средств для трансфера')) { showToast(quote.reason, 'error'); return false; }
  const transferPrice = negotiatedPrice === null ? quote.price : Math.round(Number(negotiatedPrice) * 10) / 10;
  if (!Number.isFinite(transferPrice) || transferPrice <= 0 || Number(buyingTeam.finance?.balance || 0) < transferPrice) { showToast('Недостаточно средств для согласованной суммы', 'error'); return false; }
  const foreignCount = buyingTeam.roster.filter(item => item.nationality !== 'Россия').length;
  const payroll = buyingTeam.roster.reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0);
  if (isTradeDeadlinePassed() || buyingTeam.roster.length >= 25 || sellingTeam.roster.length <= 18 || (player.nationality !== 'Россия' && foreignCount >= 3) || payroll + quote.salary > Number(buyingTeam.finance?.salaryCap ?? Infinity) || (!player.transferListed && !player.transferRequest)) { showToast('Условия трансфера больше не выполняются', 'error'); return false; }
  const index = sellingTeam.roster.indexOf(player);
  if (index < 0) return false;
  sellingTeam.roster.splice(index, 1);
  buyingTeam.roster.push(player);
  player.originClub = sellingTeam.name;
  player.originLeague = 'ВХЛ';
  player.transferListed = false;
  player.transferRequest = false;
  player.status = 'contract';
  buyingTeam.finance.balance = Math.round((Number(buyingTeam.finance.balance) - transferPrice) * 10) / 10;
  sellingTeam.finance.balance = Math.round((Number(sellingTeam.finance?.balance || 0) + transferPrice) * 10) / 10;
  buyingTeam.finance.expenses = buyingTeam.finance.expenses || {};
  buyingTeam.finance.expenses.transfers = (Number(buyingTeam.finance.expenses.transfers) || 0) + transferPrice;
  sellingTeam.finance = sellingTeam.finance || {};
  sellingTeam.finance.income = sellingTeam.finance.income || {};
  sellingTeam.finance.income.transfers = (Number(sellingTeam.finance.income.transfers) || 0) + transferPrice;
  buyingTeam.lines = null;
  sellingTeam.lines = null;
  syncLines(buyingTeam);
  syncLines(sellingTeam);
  G.league.vhlTransferLog = Array.isArray(G.league.vhlTransferLog) ? G.league.vhlTransferLog : [];
  G.league.vhlTransferLog.push({
    season: G.league.season, round: G.league.currentRound,
    playerId: player.id, playerName: player.name,
    fromTeamId: sellingTeam.id, fromTeam: sellingTeam.name,
    toTeamId: buyingTeam.id, toTeam: buyingTeam.name, fee: transferPrice
  });
  addNews('signing', buyingTeam.name + ' приобрёл ' + player.name + ' у клуба ' + sellingTeam.name + ' за ' + transferPrice.toFixed(1) + ' млн ₽', 2);
  showToast(player.name + ' перешёл в ' + buyingTeam.name + ' за ' + transferPrice.toFixed(1) + ' млн ₽', 'success');
  render();
  saveGame({ immediate: true });
  return true;
}

function loanStatsSnapshot(player) {
  const snapshot = {};
  for (const source of [player.stats, player.playoffStats]) for (const key of ["gp","goals","assists","points","wins","losses","otl","saves","shotsAgainst","goalsAgainst","shutouts","shots","plusMinus","pim"]) snapshot[key] = (snapshot[key] || 0) + (Number(source?.[key]) || 0);
  return snapshot;
}
function initializeLoanPerformance(player) {
  player.loan.performance = { gp: 0, goals: 0, assists: 0, points: 0, wins: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 };
  player.loan.statsSnapshot = loanStatsSnapshot(player);
}
function updateLoanPerformance(team) {
  for (const player of (team?.roster || [])) {
    if (!player.loan || player.loan.borrowerTeamId !== team.id) continue;
    if (!player.loan.performance) initializeLoanPerformance(player);
    const current = loanStatsSnapshot(player), previous = player.loan.statsSnapshot || {};
    const performance = player.loan.performance;
    for (const key of Object.keys(performance)) {
      const delta = Math.max(0, (current[key] || 0) - (previous[key] || 0));
      performance[key] += delta;
    }
    player.loan.statsSnapshot = current;
  }
}
function loanPerformanceSummary(player) {
  const p = player?.loan?.performance || {};
  return { gp: p.gp || 0, goals: p.goals || 0, assists: p.assists || 0, points: p.points || 0, wins: p.wins || 0, saves: p.saves || 0, shotsAgainst: p.shotsAgainst || 0, goalsAgainst: p.goalsAgainst || 0, shutouts: p.shutouts || 0 };
}

function loanPerformanceReport(player, currentRound = G.league?.currentRound || 0) {
  const loan = player?.loan || {};
  const performance = loan.performance || {};
  const gp = Number(performance.gp) || 0;
  const elapsed = Math.max(0, Number(currentRound) - Number(loan.startRound || currentRound));
  const usage = elapsed > 0 ? gp / elapsed : 0;
  const goalie = player?.position === 'G';
  const role = loan.role || 'rotation';
  const roleTargets = { top: 0.65, rotation: 0.35, reserve: 0.15 };
  const targetUsage = roleTargets[role] || roleTargets.rotation;
  const pointsPerGame = gp > 0 ? (Number(performance.points) || 0) / gp : 0;
  const savePct = Number(performance.shotsAgainst) > 0
    ? (Number(performance.shotsAgainst) - (Number(performance.goalsAgainst) || 0)) / Number(performance.shotsAgainst)
    : null;
  const gaa = gp > 0 ? (Number(performance.goalsAgainst) || 0) / gp : null;
  let status = 'Пока рано оценивать';
  let recommendation = 'Продолжить наблюдение';
  if (elapsed >= 4 && usage < targetUsage * 0.55) {
    status = 'Мало игрового времени';
    recommendation = 'Рассмотреть отзыв';
  } else if (elapsed >= 3 && gp >= 3) {
    const performanceLow = goalie
      ? savePct !== null && (savePct < 0.87 || (gaa !== null && gaa > 4.2))
      : pointsPerGame < ({ top: 0.65, rotation: 0.35, reserve: 0.15 }[role] || 0.35) * 0.55;
    const performanceGood = goalie
      ? savePct !== null && savePct >= 0.91 && gaa !== null && gaa <= 3.2
      : pointsPerGame >= ({ top: 0.65, rotation: 0.35, reserve: 0.15 }[role] || 0.35);
    if (performanceLow && elapsed >= 6) {
      status = 'Результативность ниже ожиданий';
      recommendation = 'Обсудить отзыв';
    } else if (performanceGood && usage >= targetUsage * 0.8) {
      status = 'Оправдывает ожидания';
      recommendation = Number(loan.endRound || 0) - Number(currentRound) <= 2
        ? 'Рассмотреть продление'
        : 'Оставить до конца аренды';
    } else {
      status = usage >= targetUsage * 0.7 ? 'Получает игровое время' : 'Нужна дополнительная оценка';
      recommendation = 'Продолжить наблюдение';
    }
  }
  return {
    elapsedRounds: elapsed,
    usageRate: Math.round(usage * 100),
    pointsPerGame: Math.round(pointsPerGame * 100) / 100,
    savePct: savePct === null ? null : Math.round(savePct * 1000) / 10,
    gaa: gaa === null ? null : Math.round(gaa * 100) / 100,
    status,
    recommendation
  };
}

function getLoanTerms(player, parentTeam, borrowerTeam, rounds = 5, wageShare = 50) {
  const salary = Number(player?.contract?.salary) || 0.5;
  const fee = Math.round(Math.max(0.1, (Number(player?.ovr || 60) - 50) * 0.025) * 10) / 10;
  const share = Math.max(0, Math.min(100, Number(wageShare) || 0));
  const duration = Math.max(1, Math.min(10, Math.round(Number(rounds) || 5)));
  const borrowerSalary = Math.round(salary * share) / 100;
  const parentSalary = Math.round(salary * (100 - share)) / 100;
  const payroll = (borrowerTeam?.roster || []).reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0);
  const foreigners = (borrowerTeam?.roster || []).filter(item => item.nationality !== 'Россия').length;
  let reason = '';
  if (!player || !parentTeam || !borrowerTeam) reason = 'Не удалось определить игрока или клуб';
  else if (parentTeam.id === borrowerTeam.id) reason = 'Нельзя арендовать собственного игрока';
  else if (player.loan) reason = 'Игрок уже находится в аренде';
  else if ((parentTeam.roster || []).length <= 18) reason = 'Клуб-владелец не может остаться с составом меньше 18 игроков';
  else if ((borrowerTeam.roster || []).length >= 25) reason = 'В составе уже 25 игроков';
  else if (player.nationality !== 'Россия' && foreigners >= 3) reason = 'Лимит легионеров (3) уже исчерпан';
  else if (payroll + borrowerSalary > Number(borrowerTeam.finance?.salaryCap ?? Infinity)) reason = 'Не хватает места под потолком зарплат';
  else if (Number(borrowerTeam.finance?.balance || 0) < fee) reason = 'Недостаточно средств для арендной платы';
  return { allowed: !reason, reason, fee, rounds: duration, wageShare: share, borrowerSalary, parentSalary };
}
function loanPlayerFromClub(parentTeamId, playerId, rounds = 5, wageShare = 50) {
  const borrower = G.league?.teams.find(item => item.id === G.playerTeamId);
  const parent = G.league?.teams.find(item => Number(item.id) === Number(parentTeamId));
  const player = parent?.roster.find(item => Number(item.id) === Number(playerId));
  const terms = getLoanTerms(player, parent, borrower, rounds, wageShare);
  if (!terms.allowed) { showToast(terms.reason, 'error'); return false; }
  if (rng() > (player.ovr >= 82 ? 0.72 : player.ovr >= 72 ? 0.84 : 0.93)) { showToast(parent.name + ' отклонил предложение об аренде', 'error'); return false; }
  parent.roster.splice(parent.roster.indexOf(player), 1);
  player.loanOriginalContract = player.contract ? { ...player.contract } : null;
  player.loan = { parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, startRound: G.league.currentRound, endRound: G.league.currentRound + terms.rounds, wageShare: terms.wageShare, borrowerSalary: terms.borrowerSalary, parentSalary: terms.parentSalary, fee: terms.fee };
  initializeLoanPerformance(player);
  player.contract = { ...(player.contract || {}), salary: terms.borrowerSalary };
  borrower.roster.push(player);
  borrower.finance.balance = Math.round((Number(borrower.finance.balance) - terms.fee) * 10) / 10;
  parent.finance.balance = Math.round((Number(parent.finance?.balance || 0) + terms.fee) * 10) / 10;
  borrower.finance.expenses = borrower.finance.expenses || {};
  borrower.finance.expenses.loans = (Number(borrower.finance.expenses.loans) || 0) + terms.fee;
  parent.finance.income = parent.finance.income || {};
  parent.finance.income.loans = (Number(parent.finance.income.loans) || 0) + terms.fee;
  G.league.loanLog = Array.isArray(G.league.loanLog) ? G.league.loanLog : [];
  G.league.loanLog.push({ playerId: player.id, playerName: player.name, parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, borrowerTeamName: borrower.name, startRound: G.league.currentRound, endRound: player.loan.endRound, fee: terms.fee, wageShare: terms.wageShare });
  borrower.lines = null; parent.lines = null; syncLines(borrower); syncLines(parent);
  addNews('signing', borrower.name + ' арендовал ' + player.name + ' у ' + parent.name + ' до ' + player.loan.endRound + '-го тура', 2);
  showToast(player.name + ' перешёл в аренду на ' + terms.rounds + ' туров', 'success');
  render(); saveGame({ immediate: true }); return true;
}
function returnLoanPlayer(playerId, reason = 'early') {
  const borrower = G.league?.teams.find(item => (item.roster || []).some(p => Number(p.id) === Number(playerId) && p.loan && (reason === 'recall' ? p.loan.parentTeamId === G.playerTeamId : p.loan.borrowerTeamId === G.playerTeamId)));
  const player = borrower?.roster.find(item => Number(item.id) === Number(playerId) && item.loan);
  if (!player) return false;
  const loan = player.loan;
  const performance = loanPerformanceSummary(player);
  const assessment = loanPerformanceReport(player);
  const loanDetails = { startRound: loan.startRound, endRound: loan.endRound, wageShare: loan.wageShare, fee: loan.fee || 0, role: loan.role || null, roleLabel: loan.roleLabel || null };
  const parent = G.league.teams.find(item => item.id === loan.parentTeamId);
  if (!parent) { showToast('Исходный клуб не найден', 'error'); return false; }
  borrower.roster.splice(borrower.roster.indexOf(player), 1);
  player.loan = null;
  if (player.loanOriginalContract) player.contract = player.loanOriginalContract;
  delete player.loanOriginalContract;
  parent.roster.push(player);
  borrower.lines = null; parent.lines = null; syncLines(borrower); syncLines(parent);
  G.league.loanLog = Array.isArray(G.league.loanLog) ? G.league.loanLog : [];
  G.league.loanLog.push({ playerId: player.id, playerName: player.name, parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, borrowerTeamName: borrower.name, returnedRound: G.league.currentRound, reason, performance, assessment, position: player.position, ...loanDetails });
  addNews('signing', player.name + ' вернулся из аренды в ' + parent.name, 2);
  showToast(player.name + ' возвращён из аренды', 'success');
  render(); saveGame({ immediate: true }); return true;
}
function startOutgoingLoanNegotiation(playerId) {
  const team = G.league?.teams.find(item => item.id === G.playerTeamId);
  const player = team?.roster.find(item => Number(item.id) === Number(playerId) && !item.loan);
  if (!player) { showToast('Игрок недоступен для аренды', 'error'); return false; }
  G.pendingOutgoingLoan = { playerId: player.id };
  G.activeTab = 'loans'; G.navGroupOpen = 'transfers'; render(); return true;
}
function submitOutgoingLoanOffer() {
  const parent = G.league?.teams.find(item => item.id === G.playerTeamId);
  const player = parent?.roster.find(item => Number(item.id) === Number(G.pendingOutgoingLoan?.playerId));
  const borrowerId = Number(document.getElementById('loan-target-club')?.value);
  const rounds = Number(document.getElementById('loan-duration')?.value || 5);
  const parentShare = Number(document.getElementById('loan-wage-share')?.value ?? 50);
  const role = document.getElementById('loan-role')?.value || 'rotation';
  const borrower = G.league?.teams.find(item => item.id === borrowerId && item.id !== parent?.id);
  if (!player || !parent || !borrower) { showToast('Выбери клуб и хоккеиста для аренды', 'error'); return false; }
  const terms = getLoanTerms(player, parent, borrower, rounds, 100 - parentShare);
  if (!terms.allowed) { showToast(terms.reason, 'error'); return false; }
  const depth = borrower.roster.filter(p => p.position === player.position).length;
  const quality = player.ovr >= 82 ? 1.15 : player.ovr >= 72 ? 1 : 0.85;
  const roleFactor = role === 'top' ? 0.9 : role === 'rotation' ? 1 : 1.08;
  const acceptance = Math.max(0.12, Math.min(0.92, (0.72 - depth * 0.09) * quality * (0.5 + (100 - parentShare) / 100) * roleFactor));
  if (rng() > acceptance) { G.pendingOutgoingLoan = null; showToast(borrower.name + ' отклонил предложение об аренде', 'error'); render(); return false; }
  parent.roster.splice(parent.roster.indexOf(player), 1);
  player.loanOriginalContract = player.contract ? { ...player.contract } : null;
  player.loan = { parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, borrowerTeamName: borrower.name, startRound: G.league.currentRound, endRound: G.league.currentRound + terms.rounds, wageShare: terms.wageShare, borrowerSalary: terms.borrowerSalary, parentSalary: terms.parentSalary, fee: 0, role, roleLabel: role === 'top' ? 'Ведущая роль' : role === 'rotation' ? 'Ротация' : 'Резерв' };
  initializeLoanPerformance(player);
  player.contract = { ...(player.contract || {}), salary: terms.borrowerSalary };
  borrower.roster.push(player);
  borrower.lines = null; parent.lines = null; syncLines(borrower); syncLines(parent);
  G.league.loanLog = Array.isArray(G.league.loanLog) ? G.league.loanLog : [];
  G.league.loanLog.push({ playerId: player.id, playerName: player.name, parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, borrowerTeamName: borrower.name, startRound: G.league.currentRound, endRound: player.loan.endRound, wageShare: player.loan.wageShare, role, fee: 0 });
  G.pendingOutgoingLoan = null;
  addNews('signing', parent.name + ' отправил ' + player.name + ' в аренду в ' + borrower.name + ' до ' + player.loan.endRound + '-го тура', 2);
  showToast(borrower.name + ' согласился арендовать ' + player.name, 'success');
  render(); saveGame({ immediate: true }); return true;
}
function processLoanExpirations() {
  if (!G.league?.teams) return;
  const due = [];
  for (const team of G.league.teams) for (const player of (team.roster || [])) if (player.loan && player.loan.borrowerTeamId === team.id && G.league.currentRound >= player.loan.endRound) due.push({ team, player });
  for (const item of due) {
    const loan = item.player.loan;
    const performance = loanPerformanceSummary(item.player);
    const assessment = loanPerformanceReport(item.player);
    const loanDetails = { startRound: loan.startRound, endRound: loan.endRound, wageShare: loan.wageShare, fee: loan.fee || 0, role: loan.role || null, roleLabel: loan.roleLabel || null };
    const parent = G.league.teams.find(team => team.id === loan.parentTeamId);
    if (!parent) continue;
    item.team.roster.splice(item.team.roster.indexOf(item.player), 1);
    item.player.loan = null;
    if (item.player.loanOriginalContract) item.player.contract = item.player.loanOriginalContract;
    delete item.player.loanOriginalContract;
    parent.roster.push(item.player);
    item.team.lines = null; parent.lines = null; syncLines(item.team); syncLines(parent);
    G.league.loanLog = Array.isArray(G.league.loanLog) ? G.league.loanLog : [];
    G.league.loanLog.push({ playerId: item.player.id, playerName: item.player.name, parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: item.team.id, borrowerTeamName: item.team.name, returnedRound: G.league.currentRound, reason: 'expired', performance, assessment, position: item.player.position, ...loanDetails });
    addNews('signing', item.player.name + ' завершил аренду и вернулся в ' + parent.name, 2);
  }
}

/* ============================================================
   ПЕРЕГОВОРЫ О ПРОДЛЕНИИ АРЕНДЫ
   ============================================================ */
function startLoanExtensionNegotiation(playerId, extraRounds = 5) {
  const team = G.league?.teams.find(item => item.id === G.playerTeamId);
  const player = G.league?.teams.flatMap(item => item.roster || []).find(item => Number(item.id) === Number(playerId) && item.loan);
  if (!team || !player) { showToast('Игрок в аренде не найден', 'error'); return false; }
  const loan = player.loan;
  const isBorrower = Number(loan.borrowerTeamId) === Number(team.id);
  const isParent = Number(loan.parentTeamId) === Number(team.id);
  if (!isBorrower && !isParent) { showToast('Эта аренда не относится к твоему клубу', 'error'); return false; }
  if (loan.extensionNegotiation && loan.extensionNegotiation.status === 'pending') {
    showToast('Переговоры по этой аренде уже идут', 'info'); return false;
  }
  const remaining = Math.max(0, Number(loan.endRound) - Number(G.league.currentRound));
  const availableExtension = Math.max(0, 10 - Math.max(0, Number(loan.endRound) - Number(loan.startRound)) - (Number(loan.extendedRounds) || 0));
  const extension = Math.min(availableExtension, Math.max(1, Math.round(Number(extraRounds) || 5)));
  if (remaining > 3) { showToast('Продление можно обсуждать ближе к окончанию аренды', 'info'); return false; }
  if (extension <= 0) { showToast('Максимальный срок этой аренды уже исчерпан', 'info'); return false; }
  loan.extensionNegotiation = {
    status: 'pending', requestedRounds: extension, requestedRound: G.league.currentRound,
    responseRound: G.league.currentRound + 1, initiatorTeamId: team.id,
    counterRounds: null, direction: isBorrower ? 'borrower' : 'parent'
  };
  const other = G.league.teams.find(item => Number(item.id) === Number(isBorrower ? loan.parentTeamId : loan.borrowerTeamId));
  addNews('signing', team.name + ' запросил продление аренды игрока ' + player.name + ' у клуба ' + (other?.name || 'соперника') + '.', 1);
  showToast('Запрос на продление отправлен. Ответ поступит после следующего тура.', 'success');
  render(); saveGame({ immediate: true }); return true;
}
function processLoanExtensionNegotiations() {
  for (const team of G.league.teams || []) for (const player of team.roster || []) {
    const loan = player.loan, negotiation = loan?.extensionNegotiation;
    if (!negotiation || negotiation.status !== 'pending' || G.league.currentRound < negotiation.responseRound) continue;
    const borrower = G.league.teams.find(item => Number(item.id) === Number(loan.borrowerTeamId));
    const parent = G.league.teams.find(item => Number(item.id) === Number(loan.parentTeamId));
    if (!borrower || !parent || G.league.currentRound >= loan.endRound) {
      negotiation.status = 'rejected';
      negotiation.message = 'Срок аренды уже истёк или один из клубов недоступен.';
      continue;
    }
    const report = loanPerformanceReport(player);
    const isBorrowerRequest = negotiation.direction === 'borrower';
    const decisionClub = isBorrowerRequest ? parent : borrower;
    const depth = (decisionClub.roster || []).filter(item => item.position === player.position && item.id !== player.id).length;
    const goodPerformance = report.status === 'Оправдывает ожидания' || report.status === 'Получает игровое время';
    const chance = Math.max(0.12, Math.min(0.88, 0.48 + (goodPerformance ? 0.18 : 0) + (isBorrowerRequest ? 0 : depth * 0.07) - (player.age >= 30 ? 0.08 : 0)));
    const roll = rng();
    if (roll < chance * 0.62) {
      loan.endRound += negotiation.requestedRounds;
      negotiation.status = 'accepted';
      negotiation.message = decisionClub.name + ' согласился продлить аренду на ' + negotiation.requestedRounds + ' туров.';
      loan.extensions = (Number(loan.extensions) || 0) + 1;
      loan.extendedRounds = (Number(loan.extendedRounds) || 0) + negotiation.requestedRounds;
      loan.extensionHistory = Array.isArray(loan.extensionHistory) ? loan.extensionHistory : [];
      loan.extensionHistory.push({ round: G.league.currentRound, rounds: negotiation.requestedRounds, result: 'accepted' });
      const log = (G.league.loanLog || []).slice().reverse().find(item => Number(item.playerId) === Number(player.id) && item.returnedRound === undefined);
      if (log) log.endRound = loan.endRound;
      addNews('signing', player.name + ': аренда продлена до ' + loan.endRound + '-го тура.', 2);
    } else if (roll < chance) {
      negotiation.status = 'counter';
      negotiation.counterRounds = Math.max(1, negotiation.requestedRounds - 2);
      negotiation.message = decisionClub.name + ' готов продлить аренду, но предлагает срок ' + negotiation.counterRounds + ' тур(а).';
    } else {
      negotiation.status = 'rejected';
      negotiation.message = decisionClub.name + ' отказался продлевать аренду ' + player.name + '.';
    }
    addInboxMessage('league', decisionClub.name, 'Ответ по продлению аренды', negotiation.message, []);
  }
}
function respondToLoanExtension(playerId, accept) {
  const player = G.league?.teams.flatMap(item => item.roster || []).find(item => Number(item.id) === Number(playerId) && item.loan);
  const negotiation = player?.loan?.extensionNegotiation;
  if (!negotiation || negotiation.status !== 'counter') return false;
  if (accept) {
    player.loan.endRound += negotiation.counterRounds;
    player.loan.extensions = (Number(player.loan.extensions) || 0) + 1;
    player.loan.extendedRounds = (Number(player.loan.extendedRounds) || 0) + negotiation.counterRounds;
    player.loan.extensionHistory = Array.isArray(player.loan.extensionHistory) ? player.loan.extensionHistory : [];
    player.loan.extensionHistory.push({ round: G.league.currentRound, rounds: negotiation.counterRounds, result: 'counter-accepted' });
    const log = (G.league.loanLog || []).slice().reverse().find(item => Number(item.playerId) === Number(player.id) && item.returnedRound === undefined);
    if (log) log.endRound = player.loan.endRound;
    addNews('signing', player.name + ': встречное предложение по продлению аренды принято. Новый срок — до ' + player.loan.endRound + '-го тура.', 2);
    showToast('Продление аренды согласовано', 'success');
  } else {
    player.loan.extensionHistory = Array.isArray(player.loan.extensionHistory) ? player.loan.extensionHistory : [];
    player.loan.extensionHistory.push({ round: G.league.currentRound, rounds: negotiation.counterRounds, result: 'counter-rejected' });
    showToast('Встречное предложение отклонено', 'info');
  }
  negotiation.status = accept ? 'accepted' : 'rejected';
  negotiation.message = accept ? 'Встречное предложение принято.' : 'Встречное предложение отклонено.';
  render(); saveGame({ immediate: true }); return true;
}

function prepareTradeForPlayer(teamId, playerId) {
  G.tradeTargetTeamId = Number(teamId);
  G.marketTargetPlayerId = Number(playerId);
  G.activeTab = 'trades';
  G.navGroupOpen = 'transfers';
  render();
}
function setTradeTeam(teamId) { G.tradeTargetTeamId = Number(teamId); render(); }

/* ============================================================
   ВХОДЯЩИЕ ПРЕДЛОЖЕНИЯ ОБ АРЕНДЕ ОТ КЛУБОВ
   ============================================================ */
function generateAIIncomingLoanOffer() {
  const parent = G.league?.teams.find(team => Number(team.id) === Number(G.playerTeamId));
  if (!parent || (parent.roster || []).length <= 18) return false;
  G.league.aiLoanOffers = Array.isArray(G.league.aiLoanOffers) ? G.league.aiLoanOffers : [];
  const pendingIds = new Set(G.league.aiLoanOffers.map(offer => Number(offer.playerId)));
  const candidates = (parent.roster || []).filter(player =>
    !player.loan && player.status !== 'tryout' && !pendingIds.has(Number(player.id)) &&
    (player.transferListed || Number(player.age) <= 24)
  );
  if (!candidates.length) return false;
  const clubs = G.league.teams.filter(club => Number(club.id) !== Number(parent.id) &&
    (club.roster || []).length < 25 && (club.roster || []).length >= 18);
  if (!clubs.length) return false;
  const player = pick(candidates.slice().sort((a, b) => Number(!!b.transferListed) - Number(!!a.transferListed) || Number(a.age) - Number(b.age)).slice(0, Math.min(8, candidates.length)));
  const interested = clubs.filter(club => (club.roster || []).filter(item => item.position === player.position).length <= 3);
  if (!interested.length) return false;
  const borrower = pick(interested);
  const rounds = pick([3, 5, 5, 8]);
  const wageShare = pick([50, 60, 75, 100]);
  const terms = getLoanTerms(player, parent, borrower, rounds, wageShare);
  if (!terms.allowed) return false;
  const offer = {
    id: nextId(), fromTeamId: borrower.id, playerId: player.id,
    rounds: terms.rounds, wageShare: terms.wageShare, fee: terms.fee,
    role: (borrower.roster || []).filter(item => item.position === player.position).length <= 1 ? 'top' : 'rotation',
    createdRound: G.league.currentRound, expiresRound: G.league.currentRound + 3
  };
  G.league.aiLoanOffers.push(offer);
  addInboxMessage('league', borrower.name, 'Предложение аренды',
    borrower.name + ' хочет взять ' + player.name + ' в аренду на ' + offer.rounds + ' туров. Клуб готов оплачивать ' + offer.wageShare + '% зарплаты и предложил ' + offer.fee.toFixed(1) + ' млн ₽.',
    [{ label: 'Открыть аренды', action: 'open_loans', payload: {} }]);
  addNews('signing', borrower.name + ' направил запрос на аренду хоккеиста ' + player.name + ' из ' + parent.name + '.', 1);
  return true;
}
function applyIncomingLoanOffer(offer, rounds, wageShare, fee) {
  const parent = G.league?.teams.find(team => Number(team.id) === Number(G.playerTeamId));
  const borrower = G.league?.teams.find(team => Number(team.id) === Number(offer.fromTeamId));
  const player = parent?.roster.find(item => Number(item.id) === Number(offer.playerId));
  if (!parent || !borrower || !player || player.loan) return { success: false, error: 'Игрок или клуб больше недоступен' };
  if (G.league.currentRound > Number(offer.expiresRound)) return { success: false, error: 'Срок предложения истёк' };
  const terms = getLoanTerms(player, parent, borrower, rounds, wageShare);
  const agreedFee = Math.round(Math.max(0, Number(fee) || 0) * 10) / 10;
  if (!terms.allowed) return { success: false, error: terms.reason };
  if (Number(borrower.finance?.balance || 0) < agreedFee) return { success: false, error: 'У клуба недостаточно средств для арендной платы' };
  parent.roster.splice(parent.roster.indexOf(player), 1);
  player.loanOriginalContract = player.contract ? { ...player.contract } : null;
  player.loan = {
    parentTeamId: parent.id, parentTeamName: parent.name,
    borrowerTeamId: borrower.id, borrowerTeamName: borrower.name,
    startRound: G.league.currentRound, endRound: G.league.currentRound + terms.rounds,
    wageShare: terms.wageShare, borrowerSalary: terms.borrowerSalary,
    parentSalary: terms.parentSalary, fee: agreedFee,
    role: offer.role || 'rotation', roleLabel: offer.role === 'top' ? 'Ведущая роль' : 'Ротация'
  };
  initializeLoanPerformance(player);
  player.contract = { ...(player.contract || {}), salary: terms.borrowerSalary };
  borrower.roster.push(player);
  borrower.finance.balance = Math.round((Number(borrower.finance.balance) - agreedFee) * 10) / 10;
  parent.finance.balance = Math.round((Number(parent.finance?.balance || 0) + agreedFee) * 10) / 10;
  borrower.finance.expenses = borrower.finance.expenses || {};
  borrower.finance.expenses.loans = (Number(borrower.finance.expenses.loans) || 0) + agreedFee;
  parent.finance.income = parent.finance.income || {};
  parent.finance.income.loans = (Number(parent.finance.income.loans) || 0) + agreedFee;
  G.league.loanLog = Array.isArray(G.league.loanLog) ? G.league.loanLog : [];
  G.league.loanLog.push({
    playerId: player.id, playerName: player.name, parentTeamId: parent.id, parentTeamName: parent.name,
    borrowerTeamId: borrower.id, borrowerTeamName: borrower.name,
    startRound: G.league.currentRound, endRound: player.loan.endRound,
    fee: agreedFee, wageShare: terms.wageShare, role: player.loan.role
  });
  parent.lines = null; borrower.lines = null; syncLines(parent); syncLines(borrower);
  G.league.aiLoanOffers = (G.league.aiLoanOffers || []).filter(item => item.id !== offer.id);
  addNews('signing', borrower.name + ' арендовал ' + player.name + ' у ' + parent.name + ' до ' + player.loan.endRound + '-го тура.', 2);
  return { success: true, player, terms };
}
function acceptAIIncomingLoanOffer(offerId) {
  const offer = (G.league?.aiLoanOffers || []).find(item => Number(item.id) === Number(offerId));
  if (!offer) return false;
  const result = applyIncomingLoanOffer(offer, offer.rounds, offer.wageShare, offer.fee);
  if (!result.success) { showToast(result.error, 'error'); return false; }
  showToast(result.player.name + ' отправлен в аренду', 'success');
  saveGame({ immediate: true }); render(); return true;
}
function declineAIIncomingLoanOffer(offerId) {
  G.league.aiLoanOffers = (G.league.aiLoanOffers || []).filter(item => Number(item.id) !== Number(offerId));
  render(); saveGame({ immediate: true }); return true;
}
function startIncomingLoanCounter(offerId) {
  const offer = (G.league?.aiLoanOffers || []).find(item => Number(item.id) === Number(offerId));
  if (!offer) return false;
  G.pendingIncomingLoanCounter = { offerId: offer.id };
  render(); return true;
}
function submitIncomingLoanCounter() {
  const state = G.pendingIncomingLoanCounter;
  const offer = (G.league?.aiLoanOffers || []).find(item => Number(item.id) === Number(state?.offerId));
  if (!offer) { G.pendingIncomingLoanCounter = null; render(); return false; }
  const rounds = Number(document.getElementById('incoming-loan-rounds')?.value || offer.rounds);
  const wageShare = Number(document.getElementById('incoming-loan-share')?.value || offer.wageShare);
  const fee = Number(document.getElementById('incoming-loan-fee')?.value || offer.fee);
  const borrower = G.league.teams.find(item => Number(item.id) === Number(offer.fromTeamId));
  const parent = G.league.teams.find(item => Number(item.id) === Number(G.playerTeamId));
  const player = parent?.roster.find(item => Number(item.id) === Number(offer.playerId));
  if (!borrower || !player || ![3,5,8,10].includes(rounds) || ![0,25,50,60,75,100].includes(wageShare) || !Number.isFinite(fee) || fee < 0) {
    showToast('Проверь условия встречного предложения', 'error'); return false;
  }
  const cost = getLoanTerms(player, parent, borrower, rounds, wageShare);
  if (!cost.allowed) { showToast(cost.reason, 'error'); return false; }
  const askValue = Number(offer.fee) + Number(offer.wageShare) * 0.025 - Number(offer.rounds) * 0.06;
  const counterValue = fee + wageShare * 0.025 - rounds * 0.06;
  const acceptance = Math.max(0.08, Math.min(0.92, 0.68 - Math.max(0, counterValue - askValue) * 0.12 + (rounds <= offer.rounds ? 0.08 : 0)));
  if (rng() > acceptance) {
    G.league.aiLoanOffers = G.league.aiLoanOffers.filter(item => item.id !== offer.id);
    G.pendingIncomingLoanCounter = null;
    showToast(borrower.name + ' отклонил встречные условия', 'error');
    render(); saveGame({ immediate: true }); return false;
  }
  const result = applyIncomingLoanOffer(offer, rounds, wageShare, fee);
  G.pendingIncomingLoanCounter = null;
  if (!result.success) { showToast(result.error, 'error'); render(); return false; }
  showToast(borrower.name + ' согласился на встречные условия', 'success');
  saveGame({ immediate: true }); render(); return true;
}
function processAIIncomingLoanOffers() {
  if (!G.league?.teams || G.league.currentRound >= 40) return;
  G.league.aiLoanOffers = (G.league.aiLoanOffers || []).filter(offer => Number(offer.expiresRound) >= Number(G.league.currentRound));
  if (G.league.aiLoanOffers.length >= 3 || rng() > 0.38) return;
  generateAIIncomingLoanOffer();
}

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

