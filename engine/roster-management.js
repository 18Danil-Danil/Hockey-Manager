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

function updateLoanClubRelationship(parentTeamId, borrowerTeamId, delta) {
  const league = G.league;
  league.loanClubRelations = league.loanClubRelations || {};
  const ids = [Number(parentTeamId), Number(borrowerTeamId)].sort((a, b) => a - b);
  const key = ids.join(':');
  const current = Number(league.loanClubRelations[key] ?? 50);
  league.loanClubRelations[key] = Math.max(0, Math.min(100, current + Number(delta || 0)));
  return league.loanClubRelations[key];
}
function getLoanPartnershipRating(parentTeamId, borrowerTeamId) {
  const log = (G.league?.loanLog || []).filter(item =>
    Number(item.parentTeamId) === Number(parentTeamId) &&
    Number(item.borrowerTeamId) === Number(borrowerTeamId) &&
    item.returnedRound !== undefined
  );
  if (!log.length) return { score: 50, label: 'Нет истории', completed: 0, successful: 0, problematic: 0 };
  let score = 50, successful = 0, problematic = 0;
  for (const item of log) {
    const assessment = item.assessment || {};
    const guaranteeMet = assessment.guaranteeMet || assessment.guaranteeStatus === 'Гарантия выполнена';
    const breach = !!assessment.guaranteeAtRisk || assessment.status === 'Мало игрового времени' ||
      item.reason === 'recall' || item.reason === 'ai-recall';
    if (breach) { score -= 9; problematic++; }
    else if (guaranteeMet || assessment.status === 'Оправдывает ожидания') { score += 7; successful++; }
    else score += 1;
    if (item.reason === 'expired' && !breach) score += 2;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 75 ? 'Надёжный партнёр' : score >= 60 ? 'Хороший партнёр' :
    score >= 40 ? 'Нейтральная репутация' : score >= 25 ? 'Ненадёжный партнёр' : 'Плохая репутация';
  return { score, label, completed: log.length, successful, problematic };
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
    const report = loanPerformanceReport(player);
    if (report.guaranteeAtRisk && !player.loan.guaranteeBreach) {
      player.loan.guaranteeBreach = { round: G.league.currentRound, gamesPlayed: Number(player.loan.performance?.gp) || 0, guaranteedGames: report.guaranteedGames };
      player.morale = Math.max(15, (Number(player.morale) || 60) - 8);
      const parent = G.league.teams.find(item => Number(item.id) === Number(player.loan.parentTeamId));
      const relation = updateLoanClubRelationship(player.loan.parentTeamId, player.loan.borrowerTeamId, -12);
      const message = (parent?.name || player.loan.parentTeamName || 'Клуб-владелец') + ': клуб не выполняет обещание по игровому времени для ' + player.name + '. Гарантия — ' + report.guaranteedGames + ' матчей, сыграно — ' + (Number(player.loan.performance?.gp) || 0) + '. Мораль хоккеиста снизилась, отношения клубов ухудшились.';
      addInboxMessage('league', parent?.name || 'Клуб-владелец', 'Нарушение условий аренды', message, []);
      addNews('signing', player.loan.borrowerTeamName + ' не выполнил гарантию игрового времени для ' + player.name + '. Отношения клубов ухудшились.', 2);
    }
  }
}
function loanPerformanceSummary(player) {
  const p = player?.loan?.performance || {};
  return { gp: p.gp || 0, goals: p.goals || 0, assists: p.assists || 0, points: p.points || 0, wins: p.wins || 0, saves: p.saves || 0, shotsAgainst: p.shotsAgainst || 0, goalsAgainst: p.goalsAgainst || 0, shutouts: p.shutouts || 0 };
}

function loanRoleGuarantee(role, rounds) {
  const roleTargets = { top: 0.65, rotation: 0.35, reserve: 0.15 };
  const share = roleTargets[role] || roleTargets.rotation;
  return { share, minimumGames: Math.max(0, Math.ceil(Math.max(0, Number(rounds) || 0) * share)) };
}
function loanPerformanceReport(player, currentRound = G.league?.currentRound || 0) {
  const loan = player?.loan || {};
  const performance = loan.performance || {};
  const gp = Number(performance.gp) || 0;
  const elapsed = Math.max(0, Number(currentRound) - Number(loan.startRound || currentRound));
  const duration = Math.max(1, Number(loan.endRound || currentRound) - Number(loan.startRound || currentRound));
  const role = loan.role || 'rotation';
  const guarantee = loanRoleGuarantee(role, duration);
  const minimumGames = Number.isFinite(Number(loan.guaranteedGames)) ? Math.max(0, Number(loan.guaranteedGames)) : guarantee.minimumGames;
  const expectedByNow = Math.ceil(minimumGames * Math.min(1, elapsed / duration));
  const remainingRounds = Math.max(0, duration - elapsed);
  const guaranteedGamesRemaining = Math.max(0, minimumGames - gp);
  const guaranteeAtRisk = elapsed >= 2 && gp + remainingRounds < minimumGames;
  const guaranteeMet = gp >= minimumGames;
  const usage = elapsed > 0 ? gp / elapsed : 0;
  const goalie = player?.position === 'G';
  const targetUsage = guarantee.share;
  const pointsPerGame = gp > 0 ? (Number(performance.points) || 0) / gp : 0;
  const savePct = Number(performance.shotsAgainst) > 0
    ? (Number(performance.shotsAgainst) - (Number(performance.goalsAgainst) || 0)) / Number(performance.shotsAgainst)
    : null;
  const gaa = gp > 0 ? (Number(performance.goalsAgainst) || 0) / gp : null;
  let status = 'Пока рано оценивать';
  let recommendation = 'Продолжить наблюдение';
  if (guaranteeAtRisk) {
    status = 'Риск нарушения гарантии';
    recommendation = 'Обсудить игровое время или досрочный отзыв';
  } else if (elapsed >= 4 && usage < targetUsage * 0.55) {
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
    guaranteedGames: minimumGames,
    guaranteedGamesRemaining,
    expectedGamesByNow: expectedByNow,
    guaranteeMet,
    guaranteeAtRisk,
    guaranteeStatus: guaranteeMet ? 'Гарантия выполнена' : guaranteeAtRisk ? 'Гарантия под угрозой' : 'Гарантия выполняется',
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
  recordLoanNegotiationEvent({
    type: 'deal-completed', offerId: offer.id, playerId: player.id, playerName: player.name,
    clubId: borrower.id, clubName: borrower.name, rounds: terms.rounds,
    wageShare: terms.wageShare, fee: agreedFee, role: offer.role || 'rotation',
    message: 'Стороны согласовали аренду. Игрок отправлен в клуб.'
  });
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
function requestLoanEarlyReturn(playerId) {
  const userTeam = G.league?.teams.find(item => Number(item.id) === Number(G.playerTeamId));
  const player = G.league?.teams.flatMap(item => item.roster || []).find(item => Number(item.id) === Number(playerId) && item.loan);
  if (!userTeam || !player) { showToast('Игрок в аренде не найден', 'error'); return false; }
  const loan = player.loan;
  const isParent = Number(loan.parentTeamId) === Number(userTeam.id);
  const isBorrower = Number(loan.borrowerTeamId) === Number(userTeam.id);
  if (!isParent && !isBorrower) { showToast('Эта аренда не относится к твоему клубу', 'error'); return false; }
  if (loan.earlyReturnRequest?.status === 'pending') { showToast('Запрос на досрочный возврат уже рассматривается', 'info'); return false; }
  const other = G.league.teams.find(item => Number(item.id) === Number(isParent ? loan.borrowerTeamId : loan.parentTeamId));
  if (!other) return false;
  const report = loanPerformanceReport(player);
  const relation = Number(G.league.loanClubRelations?.[[Number(loan.parentTeamId), Number(loan.borrowerTeamId)].sort((a,b)=>a-b).join(':')] ?? 50);
  const breach = !!loan.guaranteeBreach || report.guaranteeAtRisk;
  const chance = Math.max(0.12, Math.min(0.92, (isParent ? 0.38 : 0.42) + (breach ? 0.38 : 0) + (relation - 50) * 0.004 + (report.status === 'Мало игрового времени' ? 0.12 : 0)));
  const accepted = rng() < chance;
  loan.earlyReturnRequest = { status: accepted ? 'accepted' : 'rejected', requestedRound: G.league.currentRound, responseRound: G.league.currentRound, initiatorTeamId: userTeam.id, reason: breach ? 'guarantee-breach' : 'club-request', message: accepted ? other.name + ' согласился досрочно прекратить аренду ' + player.name + '.' : other.name + ' отказался досрочно прекращать аренду ' + player.name + '.' };
  addInboxMessage('league', other.name, 'Запрос на досрочный возврат', loan.earlyReturnRequest.message, []);
  addNews('signing', loan.earlyReturnRequest.message, 1);
  if (accepted) {
    const returned = returnLoanPlayer(player.id, isParent ? 'recall' : 'early');
    if (!returned) return false;
    showToast('Досрочный возврат согласован', 'success');
  } else {
    showToast('Клуб отказался досрочно прекращать аренду', 'error');
    render(); saveGame({ immediate: true });
  }
  return accepted;
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
  const partnership = getLoanPartnershipRating(parent.id, borrower.id);
  const acceptance = Math.max(0.12, Math.min(0.92, (0.72 - depth * 0.09) * quality * (0.5 + (100 - parentShare) / 100) * roleFactor + (partnership.score - 50) * 0.002));
  if (rng() > acceptance) { G.pendingOutgoingLoan = null; showToast(borrower.name + ' отклонил предложение об аренде', 'error'); render(); return false; }
  parent.roster.splice(parent.roster.indexOf(player), 1);
  player.loanOriginalContract = player.contract ? { ...player.contract } : null;
  player.loan = { parentTeamId: parent.id, parentTeamName: parent.name, borrowerTeamId: borrower.id, borrowerTeamName: borrower.name, startRound: G.league.currentRound, endRound: G.league.currentRound + terms.rounds, wageShare: terms.wageShare, borrowerSalary: terms.borrowerSalary, parentSalary: terms.parentSalary, fee: 0, role, guaranteedGames: loanRoleGuarantee(role, terms.rounds).minimumGames, roleLabel: role === 'top' ? 'Ведущая роль' : role === 'rotation' ? 'Ротация' : 'Резерв' };
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
function recordLoanNegotiationEvent(event) {
  if (!G.league) return null;
  G.league.loanNegotiationHistory = Array.isArray(G.league.loanNegotiationHistory) ? G.league.loanNegotiationHistory : [];
  const entry = {
    id: nextId(), round: Number(G.league.currentRound) || 0,
    timestamp: Date.now(), ...event
  };
  G.league.loanNegotiationHistory.push(entry);
  if (G.league.loanNegotiationHistory.length > 120) G.league.loanNegotiationHistory.splice(0, G.league.loanNegotiationHistory.length - 120);
  return entry;
}
function generateAIIncomingLoanOffer() {
  const parent = G.league?.teams.find(team => Number(team.id) === Number(G.playerTeamId));
  if (!parent || (parent.roster || []).length <= 18) return false;
  G.league.aiLoanOffers = Array.isArray(G.league.aiLoanOffers) ? G.league.aiLoanOffers : [];
  const offers = G.league.aiLoanOffers;
  const offerCounts = new Map();
  for (const offer of offers) offerCounts.set(Number(offer.playerId), (offerCounts.get(Number(offer.playerId)) || 0) + 1);
  const candidates = (parent.roster || []).filter(player =>
    !player.loan && player.status !== 'tryout' && (player.transferListed || Number(player.age) <= 24) &&
    (offerCounts.get(Number(player.id)) || 0) < 3
  );
  if (!candidates.length) return false;
  const clubs = G.league.teams.filter(club => Number(club.id) !== Number(parent.id) &&
    (club.roster || []).length < 25 && (club.roster || []).length >= 18);
  if (!clubs.length) return false;
  const player = pick(candidates.slice().sort((a, b) =>
    Number(!!b.transferListed) - Number(!!a.transferListed) || Number(a.age) - Number(b.age)
  ).slice(0, Math.min(8, candidates.length)));
  const alreadyInterested = new Set(offers.filter(offer => Number(offer.playerId) === Number(player.id)).map(offer => Number(offer.fromTeamId)));
  const interested = clubs.filter(club =>
    !alreadyInterested.has(Number(club.id)) &&
    (club.roster || []).filter(item => item.position === player.position).length <= 3
  );
  if (!interested.length) return false;
  const ranked = interested.map(club => {
    const partnership = getLoanPartnershipRating(parent.id, club.id);
    const positionalDepth = (club.roster || []).filter(item => item.position === player.position).length;
    const need = Math.max(0, 4 - positionalDepth);
    const quality = Number(player.ovr) >= 75 ? 1 : Number(player.ovr) >= 65 ? 0.85 : 0.7;
    const interest = need * 8 + quality * 10 + (partnership.score - 50) * 0.25 + rng() * 8;
    return { club, partnership, interest };
  }).sort((a,b) => b.interest-a.interest);
  const availableSlots = Math.max(0, 3 - (offerCounts.get(Number(player.id)) || 0));
  const selected = ranked.slice(0, Math.min(availableSlots, ranked.length, 2 + (rng() < 0.35 ? 1 : 0)));
  if (!selected.length) return false;
  const groupId = nextId();
  let created = 0;
  for (const candidate of selected) {
    const borrower = candidate.club;
    const rounds = pick([3, 5, 5, 8]);
    const wageShare = pick([50, 60, 75, 100]);
    const terms = getLoanTerms(player, parent, borrower, rounds, wageShare);
    if (!terms.allowed || Number(borrower.finance?.balance || 0) < terms.fee) continue;
    const role = (borrower.roster || []).filter(item => item.position === player.position).length <= 1 ? 'top' : 'rotation';
    const offer = {
      id: nextId(), groupId, fromTeamId: borrower.id, playerId: player.id,
      rounds: terms.rounds, wageShare: terms.wageShare, fee: terms.fee,
      role, createdRound: G.league.currentRound, expiresRound: G.league.currentRound + 3,
      competitionCount: selected.length, partnershipScore: candidate.partnership.score
    };
    offers.push(offer);
    recordLoanNegotiationEvent({
      type: 'offer-created', offerId: offer.id, playerId: player.id, playerName: player.name,
      clubId: borrower.id, clubName: borrower.name, rounds: offer.rounds,
      wageShare: offer.wageShare, fee: offer.fee, role: offer.role,
      competitionCount: offer.competitionCount, message: 'Клуб направил первоначальное предложение.'
    });
    addInboxMessage('league', borrower.name, 'Предложение аренды',
      borrower.name + ' хочет взять ' + player.name + ' в аренду на ' + offer.rounds +
      ' туров. Клуб готов оплачивать ' + offer.wageShare + '% зарплаты и предложил ' +
      offer.fee.toFixed(1) + ' млн ₽. На игрока также претендуют другие клубы.', []);
    addNews('signing', borrower.name + ' направил запрос на аренду хоккеиста ' + player.name + ' из ' + parent.name + '.', 1);
    created++;
  }
  for (const offer of offers.filter(item => Number(item.playerId) === Number(player.id))) {
    offer.competitionCount = offers.filter(item => Number(item.playerId) === Number(player.id)).length;
  }
  return created > 0;
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
  G.league.aiLoanOffers = (G.league.aiLoanOffers || []).filter(item => Number(item.playerId) !== Number(offer.playerId));
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
  const offer = (G.league.aiLoanOffers || []).find(item => Number(item.id) === Number(offerId));
  if (offer) {
    const parent = G.league.teams.find(item => Number(item.id) === Number(G.playerTeamId));
    const player = parent?.roster.find(item => Number(item.id) === Number(offer.playerId));
    const club = G.league.teams.find(item => Number(item.id) === Number(offer.fromTeamId));
    recordLoanNegotiationEvent({
      type: 'offer-declined', offerId: offer.id, playerId: offer.playerId,
      playerName: player?.name || 'Хоккеист', clubId: offer.fromTeamId,
      clubName: club?.name || 'Клуб', rounds: offer.rounds, wageShare: offer.wageShare,
      fee: offer.fee, message: 'Наш клуб отклонил предложение.'
    });
  }
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
  recordLoanNegotiationEvent({
    type: 'counter-sent', offerId: offer.id, playerId: player.id, playerName: player.name,
    clubId: borrower.id, clubName: borrower.name, rounds, wageShare, fee,
    message: 'Наш клуб направил встречные условия.'
  });
  const cost = getLoanTerms(player, parent, borrower, rounds, wageShare);
  if (!cost.allowed) { showToast(cost.reason, 'error'); return false; }
  const askValue = Number(offer.fee) + Number(offer.wageShare) * 0.025 - Number(offer.rounds) * 0.06;
  const counterValue = fee + wageShare * 0.025 - rounds * 0.06;
  const partnership = getLoanPartnershipRating(parent.id, borrower.id);
  const competingOffers = (G.league.aiLoanOffers || []).filter(item => Number(item.playerId) === Number(offer.playerId) && Number(item.id) !== Number(offer.id));
  const competitionBonus = Math.min(0.16, competingOffers.length * 0.06);
  const acceptance = Math.max(0.08, Math.min(0.94, 0.68 - Math.max(0, counterValue - askValue) * 0.12 + (rounds <= offer.rounds ? 0.08 : 0) + (partnership.score - 50) * 0.0025 + competitionBonus));
  if (rng() > acceptance) {
    recordLoanNegotiationEvent({
      type: 'counter-rejected', offerId: offer.id, playerId: player.id, playerName: player.name,
      clubId: borrower.id, clubName: borrower.name, rounds, wageShare, fee,
      message: 'Клуб не согласился на встречные условия.'
    });
    G.league.aiLoanOffers = G.league.aiLoanOffers.filter(item => item.id !== offer.id);
    const rivalBids = G.league.aiLoanOffers.filter(item => Number(item.playerId) === Number(offer.playerId))
      .sort((a, b) => (Number(b.fee) + Number(b.wageShare) * 0.02) - (Number(a.fee) + Number(a.wageShare) * 0.02));
    const rivalBid = rivalBids[0];
    if (rivalBid) {
      const rivalClub = G.league.teams.find(item => Number(item.id) === Number(rivalBid.fromTeamId));
      if (rivalClub) {
        const currentFee = Number(rivalBid.fee) || 0;
        const affordableFee = Math.max(0, Number(rivalClub.finance?.balance) || 0);
        rivalBid.fee = Math.round(Math.min(affordableFee, currentFee + 0.3) * 10) / 10;
        const shares = [0, 25, 50, 60, 75, 100];
        const shareIndex = shares.indexOf(Number(rivalBid.wageShare));
        if (shareIndex >= 0 && shareIndex < shares.length - 1) {
          const nextShare = shares[shareIndex + 1];
          const revisedTerms = getLoanTerms(player, parent, rivalClub, Number(rivalBid.rounds), nextShare);
          if (revisedTerms.allowed) rivalBid.wageShare = nextShare;
        }
        rivalBid.expiresRound = Math.max(Number(rivalBid.expiresRound), Number(G.league.currentRound) + 1);
        addInboxMessage('league', rivalClub.name, 'Улучшенное предложение аренды',
          rivalClub.name + ' улучшил условия аренды хоккеиста ' + player.name +
          ': теперь предлагает ' + rivalBid.fee.toFixed(1) + ' млн ₽ и оплачивает ' + rivalBid.wageShare + '% зарплаты.', []);
        addNews('signing', rivalClub.name + ' улучшил предложение по аренде хоккеиста ' + player.name + '.', 1);
      }
    }
    G.pendingIncomingLoanCounter = null;
    showToast(rivalBid ? 'Один из клубов улучшил своё предложение' : borrower.name + ' отклонил встречные условия', 'error');
    render(); saveGame({ immediate: true }); return false;
  }
  recordLoanNegotiationEvent({
    type: 'counter-accepted', offerId: offer.id, playerId: player.id, playerName: player.name,
    clubId: borrower.id, clubName: borrower.name, rounds, wageShare, fee,
    message: 'Клуб принял встречные условия.'
  });
  const result = applyIncomingLoanOffer(offer, rounds, wageShare, fee);
  G.pendingIncomingLoanCounter = null;
  if (!result.success) { showToast(result.error, 'error'); render(); return false; }
  showToast(borrower.name + ' согласился на встречные условия', 'success');
  saveGame({ immediate: true }); render(); return true;
}
function processAIRequestedLoanRecalls() {
  const userTeam = G.league?.teams?.find(team => Number(team.id) === Number(G.playerTeamId));
  if (!userTeam || Number(G.league.currentRound) >= 40) return;
  for (const player of userTeam.roster || []) {
    const loan = player.loan;
    if (!loan || Number(loan.borrowerTeamId) !== Number(userTeam.id) ||
        Number(loan.parentTeamId) === Number(userTeam.id) ||
        loan.aiRecallRequest?.status === 'pending' ||
        Number(loan.aiRecallRequest?.lastRequestRound) === Number(G.league.currentRound)) continue;
    const parent = G.league.teams.find(team => Number(team.id) === Number(loan.parentTeamId));
    if (!parent) continue;
    const report = loanPerformanceReport(player);
    const key = [Number(parent.id), Number(userTeam.id)].sort((a,b) => a-b).join(':');
    const relation = Number(G.league.loanClubRelations?.[key] ?? 50);
    const history = (G.league.loanLog || []).filter(item =>
      Number(item.parentTeamId) === Number(parent.id) && Number(item.borrowerTeamId) === Number(userTeam.id));
    const priorBadLoans = history.filter(item => item.assessment?.guaranteeAtRisk ||
      item.assessment?.status === 'Мало игрового времени').length;
    const concern = !!loan.guaranteeBreach || report.guaranteeAtRisk ||
      report.status === 'Мало игрового времени' || report.status === 'Результативность ниже ожиданий';
    const partnership = getLoanPartnershipRating(parent.id, userTeam.id);
    const chance = Math.max(0.04, Math.min(0.82,
      0.025 + (concern ? 0.34 : 0) + (loan.guaranteeBreach ? 0.18 : 0) +
      (50 - relation) * 0.003 + Math.min(0.12, priorBadLoans * 0.04) +
      Math.max(-0.08, Math.min(0.12, (50 - partnership.score) * 0.003))));
    if (rng() >= chance) continue;
    loan.aiRecallRequest = {
      status: 'pending', requestedRound: G.league.currentRound,
      reason: loan.guaranteeBreach ? 'guarantee-breach' : concern ? 'performance' : 'club-plans',
      message: parent.name + ' просит досрочно вернуть ' + player.name +
        (concern ? ': клуб недоволен игровым временем или результативностью хоккеиста.' : ' из-за изменения планов команды.')
    };
    addInboxMessage('league', parent.name, 'Запрос клуба на возврат из аренды',
      loan.aiRecallRequest.message + ' Решение можно принять во вкладке «Аренда».', []);
    addNews('signing', parent.name + ' обратился с просьбой досрочно вернуть ' + player.name + ' из аренды.', 1);
  }
}
function respondToAIRecallRequest(playerId, accept) {
  const userTeam = G.league?.teams?.find(team => Number(team.id) === Number(G.playerTeamId));
  const player = userTeam?.roster.find(item => Number(item.id) === Number(playerId) && item.loan);
  const request = player?.loan?.aiRecallRequest;
  if (!player || !request || request.status !== 'pending') return false;
  const parent = G.league.teams.find(team => Number(team.id) === Number(player.loan.parentTeamId));
  if (!parent) return false;
  request.status = accept ? 'accepted' : 'rejected';
  request.responseRound = G.league.currentRound;
  const key = [Number(parent.id), Number(userTeam.id)].sort((a,b) => a-b).join(':');
  G.league.loanClubRelations = G.league.loanClubRelations || {};
  const relation = Number(G.league.loanClubRelations[key] ?? 50);
  G.league.loanClubRelations[key] = Math.max(0, Math.min(100, relation + (accept ? 2 : -3)));
  if (accept) {
    request.message = userTeam.name + ' согласился вернуть ' + player.name + ' досрочно по просьбе ' + parent.name + '.';
    addNews('signing', request.message, 1);
    const returned = returnLoanPlayer(player.id, 'ai-recall');
    if (!returned) return false;
    showToast('Игрок возвращён клубу-владельцу', 'success');
  } else {
    request.message = userTeam.name + ' отказался досрочно возвращать ' + player.name + ' клубу ' + parent.name + '.';
    addNews('signing', request.message, 1);
    addInboxMessage('league', parent.name, 'Ответ на запрос о возврате', request.message, []);
    showToast('Ты отказал клубу в досрочном возврате', 'info');
    render(); saveGame({ immediate: true });
  }
  return true;
}

function processAIIncomingLoanOffers() {
  if (!G.league?.teams || G.league.currentRound >= 40) return;
  const round = Number(G.league.currentRound) || 0;
  const parent = G.league.teams.find(team => Number(team.id) === Number(G.playerTeamId));
  G.league.aiLoanOffers = Array.isArray(G.league.aiLoanOffers) ? G.league.aiLoanOffers : [];
  const active = [];
  for (const offer of G.league.aiLoanOffers) {
    const borrower = G.league.teams.find(team => Number(team.id) === Number(offer.fromTeamId));
    const player = parent?.roster.find(item => Number(item.id) === Number(offer.playerId));
    if (!parent || !borrower || !player || player.loan) continue;
    if (Number(offer.expiresRound) < round) {
      recordLoanNegotiationEvent({
        type: 'offer-expired', offerId: offer.id, playerId: player.id, playerName: player.name,
        clubId: borrower.id, clubName: borrower.name, rounds: offer.rounds,
        wageShare: offer.wageShare, fee: offer.fee, message: 'Срок ответа истёк, клуб снял предложение.'
      });
      addInboxMessage('league', borrower.name, 'Предложение аренды истекло',
        borrower.name + ' отозвал предложение по аренде хоккеиста ' + player.name +
        ': срок ответа истёк. При необходимости клуб может обратиться повторно.', []);
      addNews('signing', borrower.name + ' снял предложение об аренде хоккеиста ' + player.name + ' после истечения срока.', 1);
      continue;
    }
    if (round > Number(offer.createdRound) && Number(offer.lastReviewedRound) !== round) {
      offer.lastReviewedRound = round;
      const rivals = G.league.aiLoanOffers.filter(item =>
        Number(item.playerId) === Number(offer.playerId) && Number(item.id) !== Number(offer.id));
      const rivalBest = rivals.reduce((best, item) =>
        Math.max(best, Number(item.fee || 0) + Number(item.wageShare || 0) * 0.02 + Number(item.rounds || 0) * 0.04), 0);
      const ownValue = Number(offer.fee || 0) + Number(offer.wageShare || 0) * 0.02 + Number(offer.rounds || 0) * 0.04;
      const gap = rivalBest - ownValue;
      const reviewChance = Math.max(0.12, Math.min(0.72, 0.2 + Math.max(0, gap) * 0.08 + rivals.length * 0.08));
      if (rivals.length && gap > 0.15 && rng() < reviewChance) {
        const feeRoom = Math.max(0, Number(borrower.finance?.balance) || 0);
        const improvedFee = Math.round(Math.min(feeRoom, Number(offer.fee || 0) + 0.3) * 10) / 10;
        const shares = [0, 25, 50, 60, 75, 100];
        const shareIndex = shares.indexOf(Number(offer.wageShare));
        let improvedShare = Number(offer.wageShare) || 0;
        if (shareIndex >= 0 && shareIndex < shares.length - 1) {
          const candidateShare = shares[shareIndex + 1];
          const terms = getLoanTerms(player, parent, borrower, Number(offer.rounds), candidateShare);
          if (terms.allowed) improvedShare = candidateShare;
        }
        const revisedTerms = getLoanTerms(player, parent, borrower, Number(offer.rounds), improvedShare);
        if ((improvedFee > Number(offer.fee || 0) || improvedShare > Number(offer.wageShare || 0)) &&
            revisedTerms.allowed && feeRoom >= improvedFee) {
          offer.fee = improvedFee;
          offer.wageShare = improvedShare;
          recordLoanNegotiationEvent({
            type: 'offer-improved', offerId: offer.id, playerId: player.id, playerName: player.name,
            clubId: borrower.id, clubName: borrower.name, rounds: offer.rounds,
            wageShare: improvedShare, fee: improvedFee, message: 'Клуб улучшил условия, реагируя на конкуренцию.'
          });
          offer.revisedRound = round;
          offer.revisionCount = (Number(offer.revisionCount) || 0) + 1;
          offer.expiresRound = Math.max(Number(offer.expiresRound) || 0, round + 2);
          addInboxMessage('league', borrower.name, 'Клуб улучшил предложение по аренде',
            borrower.name + ' пересмотрел условия аренды ' + player.name + ': теперь предлагает ' +
            offer.fee.toFixed(1) + ' млн ₽ и оплачивает ' + offer.wageShare +
            '% зарплаты. Предложение действует до ' + offer.expiresRound + '-го тура.', []);
          addNews('signing', borrower.name + ' улучшил предложение по аренде хоккеиста ' + player.name + '.', 1);
        }
      } else if (!rivals.length && round >= Number(offer.createdRound) + 2 &&
          rng() < 0.08 + (Number(offer.partnershipScore) < 35 ? 0.08 : 0)) {
        recordLoanNegotiationEvent({
          type: 'offer-withdrawn', offerId: offer.id, playerId: player.id, playerName: player.name,
          clubId: borrower.id, clubName: borrower.name, rounds: offer.rounds,
          wageShare: offer.wageShare, fee: offer.fee, message: 'Клуб потерял интерес и отозвал предложение.'
        });
        addInboxMessage('league', borrower.name, 'Клуб снял предложение об аренде',
          borrower.name + ' решил отказаться от переговоров по аренде хоккеиста ' + player.name + '.', []);
        addNews('signing', borrower.name + ' отозвал предложение по аренде хоккеиста ' + player.name + '.', 1);
        continue;
      }
    }
    active.push(offer);
  }
  G.league.aiLoanOffers = active;
  if (active.length >= 8 || rng() > 0.42) return;
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
function processPlayerContractRequests() {
  const team = G.league?.teams?.find(item => Number(item.id) === Number(G.playerTeamId));
  if (!team) return false;
  const round = Number(G.league.currentRound) || 0;
  for (const player of team.roster || []) {
    if (player.contractRequest && Number(player.contractRequest.expiresRound) < round) {
      player.contractRequest = null;
      player.morale = Math.max(20, (Number(player.morale) || 60) - 2);
    }
  }
  const pending = (team.roster || []).filter(player => player.contractRequest?.status === 'pending').length;
  if (pending >= 2 || round < 20 || round > 54 || rng() > 0.2) return false;
  const candidates = (team.roster || []).filter(player =>
    player.status === 'contract' && !player.loan && !player.contractRequest &&
    Number(player.contract?.years) <= 1 && Number(player.age) <= 34 &&
    Number(player.morale) >= 45 && !player.transferListed
  );
  if (!candidates.length) return false;
  const shortlist = candidates.slice().sort((a, b) =>
    (Number(b.morale) - Number(a.morale)) || (Number(b.ovr) - Number(a.ovr))
  ).slice(0, 6);
  const player = pick(shortlist);
  const demand = getPlayerContractDemand(player, team, 'renewal');
  player.contractRequest = {
    status: 'pending', createdRound: round, expiresRound: Math.min(57, round + 6),
    expectedSalary: demand.salary, requestedYears: demand.years
  };
  const message = player.name + ' хотел бы обсудить продление контракта. Ожидания: около ' +
    demand.salary.toFixed(1) + ' млн ₽ за сезон на ' + demand.years + ' лет.';
  if (typeof addInboxMessage === 'function') addInboxMessage('player', player.name, 'Запрос на продление контракта', message, []);
  if (typeof addNews === 'function') addNews('contract', player.name + ' обратился к руководству ' + team.name + ' с просьбой обсудить новый контракт.', 1);
  return true;
}

function runAITransfers() {
  const teams = G.league.teams.filter(team => team.id !== G.playerTeamId);
  const round = Number(G.league.currentRound) || 0;
  G.league.aiFreeAgentBids = Array.isArray(G.league.aiFreeAgentBids) ? G.league.aiFreeAgentBids : [];
  const bids = G.league.aiFreeAgentBids;

  // Сначала закрываем заявки прошлого тура: хоккеист выбирает наиболее выгодный вариант.
  const ready = bids.filter(bid => Number(bid.createdRound) < round);
  const grouped = new Map();
  for (const bid of ready) {
    if (!grouped.has(bid.playerId)) grouped.set(bid.playerId, []);
    grouped.get(bid.playerId).push(bid);
  }
  for (const [playerId, playerBids] of grouped) {
    const player = (G.league.freeAgents || []).find(item => item.id === playerId);
    if (!player) continue;
    const ranked = playerBids.map(bid => {
      const club = teams.find(item => item.id === bid.teamId);
      if (!club) return null;
      const result = evaluatePlayerContractOffer(player, club, bid.offer, 'signing', { round: 1 });
      return { bid, club, result };
    }).filter(item => item && item.result.decision !== 'reject')
      .sort((a, b) => (Number(b.result.score) || 0) - (Number(a.result.score) || 0));
    for (const entry of ranked) {
      let offer = entry.bid.offer;
      let result = entry.result;
      if (result.decision === 'counter') {
        const counter = result.counteroffer;
        const payroll = entry.club.roster.reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0);
        if (payroll + Number(counter.salary || 0) > Number(entry.club.finance?.salaryCap) || rng() > 0.82) continue;
        result = evaluatePlayerContractOffer(player, entry.club, counter, 'signing', { round: 2 });
        offer = counter;
      }
      if (result.decision !== 'accept') continue;
      const agreement = applyPlayerContractAgreement(entry.club, player, offer, 'signing', { round: 2 });
      if (!agreement.applied) continue;
      addNews('signing', entry.club.name + ' выиграл борьбу за свободного агента ' + player.name + ', предложив контракт на ' + agreement.salary.toFixed(1) + ' млн ₽.', 1);
      break;
    }
  }
  // Заявки старше одного тура больше не действуют.
  G.league.aiFreeAgentBids = bids.filter(bid => Number(bid.createdRound) >= round &&
    (G.league.freeAgents || []).some(player => player.id === bid.playerId));

  // Клубы одновременно подают заявки, поэтому один хоккеист может выбирать между несколькими предложениями.
  for (const team of teams) {
    if (rng() > 0.24 || team.roster.length >= 25) continue;
    const currentSalary = team.roster.reduce((sum, player) => sum + (Number(player.contract?.salary) || 0), 0);
    const salaryRoom = Number(team.finance?.salaryCap) - currentSalary;
    if (salaryRoom < 2) continue;
    const foreigners = team.roster.filter(player => player.nationality !== 'Россия').length;
    const existingForClub = G.league.aiFreeAgentBids.some(bid => bid.teamId === team.id && Number(bid.createdRound) === round);
    if (existingForClub) continue;
    const candidates = (G.league.freeAgents || []).map(player => ({
      player,
      demand: getPlayerContractDemand(player, team, 'signing')
    })).filter(item => item.demand.salary <= salaryRoom * 0.95 &&
      (item.player.nationality === 'Россия' || foreigners < 3) &&
      !G.league.aiFreeAgentBids.some(bid => bid.playerId === item.player.id && bid.teamId === team.id))
      .sort((a, b) => b.player.ovr - a.player.ovr);
    if (!candidates.length) continue;
    const shortlist = candidates.slice(0, Math.min(5, candidates.length));
    const targetEntry = pick(shortlist);
    const target = targetEntry.player;
    const demand = targetEntry.demand;
    const offer = {
      salary: Math.round(Math.min(salaryRoom * 0.95, demand.salary * (1.02 + rng() * 0.12)) * 10) / 10,
      years: Math.max(1, Math.min(5, demand.years))
    };
    const projectedPayroll = currentSalary + offer.salary;
    if (projectedPayroll > Number(team.finance.salaryCap)) continue;
    G.league.aiFreeAgentBids.push({
      playerId: target.id, playerName: target.name, teamId: team.id, teamName: team.name,
      offer, createdRound: round, expiresRound: round + 1
    });
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
  runAITransfers(); runAIContractExtensions(); processPlayerContractRequests();
  if (rng() < 0.35) generateAITradeOffer();
  if (rng() < 0.15) generateAITradeOffer();
  G.league.aiTradeOffers = G.league.aiTradeOffers.filter(o => o.expiresRound > G.league.currentRound);
  processAIIncomingLoanOffers();
  processAIRequestedLoanRecalls();
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

