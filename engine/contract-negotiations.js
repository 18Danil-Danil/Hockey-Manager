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
  const currentIndex = team.roster?.findIndex(item => item.id === player.id) ?? -1;
  if (isRenewal && currentIndex < 0) return { decision: 'reject', reason: 'player-not-in-club', message: 'Игрок уже не состоит в клубе' };
  if (!isRenewal && currentIndex < 0) {
    if ((team.roster || []).length >= 25) return { decision: 'reject', reason: 'roster-full', message: 'В составе уже 25 игроков' };
    const foreigners = (team.roster || []).filter(item => item.nationality !== 'Россия').length;
    if (player.nationality !== 'Россия' && foreigners >= 3) return { decision: 'reject', reason: 'foreign-limit', message: 'Лимит легионеров исчерпан' };
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
    player.contract = { ...(player.contract || {}), salary, years };
    player.status = 'contract';
    if (!team.roster.includes(player)) team.roster.push(player);
    if (typeof markYouthGraduateSigned === 'function') markYouthGraduateSigned(player, team, 'negotiated-contract');
  }
  player.morale = Math.min(100, (Number(player.morale) || 65) + 3);
  return { ...result, applied: true, salary, years: player.contract.years };
}
