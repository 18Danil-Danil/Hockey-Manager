/* Переговоры клубов о трансферной сумме за игрока международного рынка. */
function getClubTransferDemand(player, club) {
  const base = getInternationalTransferPrice(player, club);
  const depth = (club.roster || []).filter(item => item.position === player.position).length;
  let factor = player.transferListed ? 0.84 : 1.08;
  if (depth <= 2) factor += 0.16;
  else if (depth >= 5) factor -= 0.08;
  if ((player.contract?.years || 0) <= 1) factor -= 0.08;
  if (player.age >= 32) factor -= 0.06;
  return Math.max(0.5, Math.round(base * factor * 10) / 10);
}
function evaluateClubTransferOffer(player, club, team, offeredFee) {
  const fee = Math.round((Number(offeredFee) || 0) * 10) / 10;
  if (!player || !club || !team || fee < 0.5) return { decision: 'reject', reason: 'invalid', message: 'Некорректная сумма предложения' };
  const demand = getClubTransferDemand(player, club);
  if (fee > Number(team.finance?.balance || 0)) return { decision: 'reject', reason: 'budget', message: 'Недостаточно средств для такого предложения', demand };
  if (fee >= demand) return { decision: 'accept', reason: 'accepted', message: 'Клуб согласен на трансфер', demand, fee };
  if (fee >= demand * 0.78) return {
    decision: 'counter', reason: 'counteroffer', message: 'Клуб готов обсуждать трансфер, но просит больше',
    demand, counteroffer: { fee: demand }
  };
  return { decision: 'reject', reason: 'too-low', message: 'Клуб отклонил предложение', demand };
}
function openInternationalClubNegotiation(playerId) {
  const team = G.league?.teams?.find(item => item.id === G.playerTeamId);
  const found = typeof findInternationalPlayer === 'function' ? findInternationalPlayer(playerId) : null;
  if (!team || !found) { showToast('Игрок или клуб не найден', 'error'); return false; }
  const quote = getInternationalTransferQuote(found.player, found.club, team);
  if (!quote.allowed) { showToast(quote.reason, 'error'); return false; }
  const demand = getClubTransferDemand(found.player, found.club);
  G.clubTransferNegotiation = {
    playerId, clubId: found.club.id,
    offerFee: quote.price, demand,
    lastResult: null, attempts: 0
  };
  if (typeof render === 'function') render();
  return true;
}
function updateClubTransferOffer(value) {
  if (!G.clubTransferNegotiation) return;
  const fee = Number(value);
  if (Number.isFinite(fee)) G.clubTransferNegotiation.offerFee = Math.max(0.5, Math.round(fee * 10) / 10);
}
function submitClubTransferOffer() {
  const state = G.clubTransferNegotiation;
  if (!state) return false;
  const team = G.league?.teams?.find(item => item.id === G.playerTeamId);
  const found = typeof findInternationalPlayer === 'function' ? findInternationalPlayer(state.playerId) : null;
  if (!team || !found || found.club.id !== state.clubId) {
    state.lastResult = { decision: 'reject', message: 'Предложение больше не актуально' };
    render(); return false;
  }
  const quote = getInternationalTransferQuote(found.player, found.club, team);
  if (!quote.allowed) {
    state.lastResult = { decision: 'reject', message: quote.reason };
    render(); return false;
  }
  const result = evaluateClubTransferOffer(found.player, found.club, team, state.offerFee);
  state.lastResult = result;
  state.attempts++;
  if (result.decision === 'accept') {
    const fee = result.fee;
    G.clubTransferNegotiation = null;
    openPlayerContractNegotiation(found.player.id, 'international-signing', { transferFee: fee, clubId: found.club.id });
    return result;
  }
  if (typeof showToast === 'function') showToast(result.message, result.decision === 'reject' ? 'error' : 'info');
  if (typeof render === 'function') render();
  return result;
}
function acceptClubTransferCounterOffer() {
  const state = G.clubTransferNegotiation;
  if (!state?.lastResult || state.lastResult.decision !== 'counter') return false;
  state.offerFee = state.lastResult.counteroffer.fee;
  return submitClubTransferOffer();
}
function closeClubTransferNegotiation() {
  G.clubTransferNegotiation = null;
  if (typeof render === 'function') render();
}
