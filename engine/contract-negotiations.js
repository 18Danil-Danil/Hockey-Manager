/* Переговоры по контрактам: ожидания игроков и оценка предложений. */
function getPlayerContractDemand(player, team, mode = 'renewal') {
  if (!player || !team) return { salary: 0.5, years: 1 };
  const age = Math.max(16, Number(player.age) || 25);
  const ovr = Math.max(40, Number(player.ovr) || 60);
  let marketSalary = Math.pow(Math.max(0, ovr - 60) / 30, 2) * 22;
  if (age <= 23) marketSalary *= 0.55;
  else if (age >= 30) marketSalary *= 0.9;
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const peers = roster.filter(item => item.id !== player.id);
  const averageOvr = peers.length ? peers.reduce((sum, item) => sum + (Number(item.ovr) || 0), 0) / peers.length : ovr;
  const roleFactor = ovr >= averageOvr + 5 ? 1.08 : ovr <= averageOvr - 8 ? 0.94 : 1;
  const morale = Math.max(20, Math.min(100, Number(player.morale) || 65));
  const moraleFactor = 0.94 + ((morale - 50) / 50) * 0.08;
  const loyaltyFactor = mode === 'renewal' ? 0.97 : 1.02;
  const currentSalary = Math.max(0, Number(player.contract?.salary) || 0);
  const salary = Math.max(0.5, Math.round(Math.max(marketSalary * roleFactor * moraleFactor * loyaltyFactor, currentSalary * 0.92) * 10) / 10);
  const years = age <= 23 ? 3 : age <= 29 ? 3 : age <= 33 ? 2 : 1;
  return { salary, years, marketSalary: Math.round(marketSalary * 10) / 10, roleFactor, moraleFactor };
}

function evaluatePlayerContractOffer(player, team, offer, mode = 'renewal') {
  if (!player || !team || !offer) return { decision: 'reject', reason: 'invalid', message: 'Некорректное предложение' };
  const salary = Math.round((Number(offer.salary) || 0) * 10) / 10;
  const years = Math.floor(Number(offer.years) || 0);
  if (salary < 0.5 || years < 1 || years > 5) return { decision: 'reject', reason: 'terms', message: 'Срок должен быть от 1 до 5 лет, зарплата — не ниже 0,5 млн ₽' };
  const isRenewal = mode === 'renewal';
  const isInternationalSigning = mode === 'international-signing';
  const currentIndex = team.roster?.findIndex(item => item.id === player.id) ?? -1;
  if (isRenewal && currentIndex < 0) return { decision: 'reject', reason: 'player-not-in-club', message: 'Игрок уже не состоит в клубе' };
  if (!isRenewal && currentIndex < 0) {
    if ((team.roster || []).length >= 25) return { decision: 'reject', reason: 'roster-full', message: 'В составе уже 25 игроков' };
    const foreigners = (team.roster || []).filter(item => item.nationality !== 'Россия').length;
    if (player.nationality !== 'Россия' && foreigners >= 3) return { decision: 'reject', reason: 'foreign-limit', message: 'Лимит легионеров исчерпан' };
  }
  if (isInternationalSigning) {
    if (typeof isTradeDeadlinePassed === 'function' && isTradeDeadlinePassed()) return { decision: 'reject', reason: 'deadline', message: 'Трансферное окно закрыто' };
    const fee = Number(G.contractNegotiation?.transferFee) || 0;
    if (fee > Number(team.finance?.balance || 0)) return { decision: 'reject', reason: 'transfer-fee', message: 'Недостаточно средств для трансфера' };
  }
  const demand = getPlayerContractDemand(player, team, mode);
  const currentPayroll = (team.roster || []).reduce((sum, item) => sum + (Number(item.contract?.salary) || 0), 0);
  const salaryRoom = Number(team.finance?.salaryCap);
  if (Number.isFinite(salaryRoom) && currentPayroll - (isRenewal ? Number(player.contract?.salary) || 0 : 0) + salary > salaryRoom) {
    return { decision: 'reject', reason: 'salary-cap', message: 'Предложение не помещается под потолок зарплат', demand };
  }
  const salaryFit = salary / Math.max(0.5, demand.salary);
  const termFit = years / Math.max(1, demand.years);
  const score = salaryFit * 0.78 + Math.min(1.2, termFit) * 0.22;
  if (salaryFit >= 1 && termFit >= 0.85) {
    return { decision: 'accept', reason: 'accepted', message: 'Игрок готов принять предложение', demand, offer: { salary, years }, score };
  }
  if (score >= 0.88) {
    const counterSalary = Math.max(salary, demand.salary);
    const counterYears = Math.max(years, demand.years);
    return {
      decision: 'counter', reason: 'counteroffer', message: 'Игрок выдвигает встречные условия',
      demand, counteroffer: { salary: Math.round(counterSalary * 10) / 10, years: Math.min(5, counterYears) }, score
    };
  }
  return { decision: 'reject', reason: 'too-low', message: 'Игрок отклоняет предложение', demand, score };
}

function applyPlayerContractAgreement(team, player, offer, mode = 'renewal') {
  const result = evaluatePlayerContractOffer(player, team, offer, mode);
  if (result.decision !== 'accept') return result;
  const salary = Math.round(Number(offer.salary) * 10) / 10;
  const years = Math.floor(Number(offer.years));
  if (mode === 'renewal') {
    player.contract.salary = salary;
    player.contract.years = Math.min(5, Math.max(0, Number(player.contract.years) || 0) + years);
  } else {
    if (!Array.isArray(team.roster)) team.roster = [];
    if (mode === 'international-signing') {
      const found = typeof findInternationalPlayer === 'function' ? findInternationalPlayer(player.id) : null;
      if (!found) return { decision: 'reject', reason: 'player-unavailable', message: 'Игрок больше не доступен в клубе' };
      const fee = Number(G.contractNegotiation?.transferFee) || 0;
      if (fee > Number(team.finance?.balance || 0)) return { decision: 'reject', reason: 'transfer-fee', message: 'Недостаточно средств для трансфера' };
      const sourceClub = found.club;
      sourceClub.roster = sourceClub.roster.filter(item => item.id !== player.id);
      sourceClub.averageOvr = sourceClub.roster.reduce((sum, item) => sum + item.ovr, 0) / Math.max(1, sourceClub.roster.length);
      player.originClub = sourceClub.name;
      player.originLeague = sourceClub.leagueName;
      player.originCountry = sourceClub.country;
      player.internationalClubId = null;
      team.finance.balance = Math.round((team.finance.balance - fee) * 10) / 10;
      team.finance.expenses = team.finance.expenses || {};
      team.finance.expenses.transfers = (team.finance.expenses.transfers || 0) + fee;
      G.league.internationalMarket.transferLog = Array.isArray(G.league.internationalMarket.transferLog) ? G.league.internationalMarket.transferLog : [];
      G.league.internationalMarket.transferLog.push({ season: G.league.season, playerId: player.id, playerName: player.name, fromClub: sourceClub.name, toClub: team.name, fee });
    } else if (Array.isArray(G.league?.freeAgents)) {
      G.league.freeAgents = G.league.freeAgents.filter(item => item.id !== player.id);
    }
    player.contract = { ...(player.contract || {}), salary, years };
    player.status = 'contract';
    if (!team.roster.includes(player)) team.roster.push(player);
    if (typeof markYouthGraduateSigned === 'function') markYouthGraduateSigned(player, team, mode === 'international-signing' ? 'international-transfer' : 'negotiated-contract');
  }
  player.morale = Math.min(100, (Number(player.morale) || 65) + 3);
  return { ...result, applied: true, salary, years: player.contract.years };
}

function findNegotiationPlayer(playerId, mode) {
  const team = G.league?.teams?.find(item => item.id === G.playerTeamId);
  if (!team) return { team: null, player: null, club: null };
  if (mode === 'renewal') return { team, player: team.roster.find(item => item.id === playerId) || null, club: null };
  if (mode === 'international-signing') {
    const found = typeof findInternationalPlayer === 'function' ? findInternationalPlayer(playerId) : null;
    return { team, player: found?.player || null, club: found?.club || null };
  }
  return { team, player: (G.league.freeAgents || []).find(item => item.id === playerId) || null, club: null };
}
function openPlayerContractNegotiation(playerId, mode = 'renewal', context = {}) {
  const found = findNegotiationPlayer(playerId, mode);
  if (!found.team || !found.player) { if (typeof showToast === 'function') showToast('Игрок больше недоступен'); return false; }
  const demand = getPlayerContractDemand(found.player, found.team, mode);
  const maxYears = mode === 'renewal' ? Math.max(1, 5 - Math.max(0, Number(found.player.contract?.years) || 0)) : 5;
  G.contractNegotiation = {
    playerId, mode,
    offer: { salary: demand.salary, years: Math.min(maxYears, demand.years) },
    transferFee: Number(context.transferFee) || 0, clubId: context.clubId || null,
    lastResult: null, completed: false
  };
  G.popupPlayerId = playerId;
  if (typeof render === 'function') render();
  return true;
}
function updatePlayerContractOffer(field, value) {
  if (!G.contractNegotiation || !['salary', 'years'].includes(field)) return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return;
  G.contractNegotiation.offer[field] = field === 'salary'
    ? Math.max(0.5, Math.round(numeric * 10) / 10)
    : Math.max(1, Math.min(5, Math.floor(numeric)));
}
function submitPlayerContractNegotiation() {
  const state = G.contractNegotiation;
  if (!state || state.completed) return false;
  const found = findNegotiationPlayer(state.playerId, state.mode);
  if (!found.team || !found.player) { state.lastResult = { decision: 'reject', message: 'Игрок больше недоступен' }; render(); return false; }
  const result = evaluatePlayerContractOffer(found.player, found.team, state.offer, state.mode);
  state.lastResult = result;
  if (result.decision === 'accept') {
    const applied = applyPlayerContractAgreement(found.team, found.player, state.offer, state.mode);
    state.lastResult = applied;
    state.completed = !!applied.applied;
    if (state.completed) {
      if (state.mode === 'renewal') addNews('contract', found.team.name + ' продлил контракт с ' + found.player.name, 1);
      else addNews('signing', found.team.name + ' подписал ' + found.player.name + ' после переговоров', 2);
      if (typeof syncLines === 'function') syncLines(found.team);
      if (typeof showToast === 'function') showToast('Соглашение достигнуто: ' + found.player.name, 'success');
      if (typeof saveGame === 'function') saveGame({ immediate: true });
    }
  } else if (typeof showToast === 'function') {
    showToast(result.message || 'Предложение не принято', result.decision === 'reject' ? 'error' : 'info');
  }
  if (typeof render === 'function') render();
  return result;
}
function acceptPlayerCounterOffer() {
  const state = G.contractNegotiation;
  if (!state || state.completed || state.lastResult?.decision !== 'counter' || !state.lastResult.counteroffer) return false;
  const found = findNegotiationPlayer(state.playerId, state.mode);
  if (!found.team || !found.player) return false;
  const offer = state.lastResult.counteroffer;
  const result = applyPlayerContractAgreement(found.team, found.player, offer, state.mode);
  state.lastResult = result;
  state.completed = !!result.applied;
  if (state.completed) {
    if (state.mode === 'renewal') addNews('contract', found.team.name + ' продлил контракт с ' + found.player.name, 1);
    else addNews('signing', found.team.name + ' подписал ' + found.player.name + ' после переговоров', 2);
    if (typeof syncLines === 'function') syncLines(found.team);
    if (typeof showToast === 'function') showToast('Встречные условия приняты', 'success');
    if (typeof saveGame === 'function') saveGame({ immediate: true });
  }
  if (typeof render === 'function') render();
  return result;
}
function closePlayerContractNegotiation() {
  G.contractNegotiation = null;
  if (typeof render === 'function') render();
}
