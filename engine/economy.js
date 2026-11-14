/* ============================================================
   ЭКОНОМИКА
   ============================================================ */
function processMatchdayRevenue(team, isHome, opponentStrength) {
  if (!isHome) return;
  const f = team.finance;
  const marketingBonus = 1 + (team.infrastructure.marketing * 0.08) + (team.staff.marketing ? team.staff.marketing.level * 0.02 : 0);
  const priceFactor = clamp(1.3 - (f.ticketPrice / 1000) * 0.6, 0.5, 1.3);
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const rankBonus = rank <= 8 ? 0.20 : 0;
  let fillBonus = 0;
  if (f.matchdayFlags.fanzone) fillBonus += 0.05;
  if (f.matchdayFlags.show) fillBonus += 0.03;
  if (f.matchdayFlags.kidsTickets && opponentStrength < 1.10) fillBonus += 0.10;
  const fill = clamp(f.fanBase * priceFactor * (0.75 + rng() * 0.3) + (opponentStrength - 1.0) * 0.15 + rankBonus + fillBonus, 0.15, 0.98);
  const attendance = Math.round(f.arenaCapacity * fill);
  let ticketPrice = f.ticketPrice;
  if (f.vipLevel > 0) ticketPrice *= (1 + f.vipLevel * 0.05);
  const ticketIncome = attendance * ticketPrice / 1_000_000;
  let extrasMult = 1;
  if (f.merchLevel >= 2) extrasMult += 0.15;
  if (f.merchLevel >= 3) extrasMult += 0.15;
  if (f.merchLevel >= 4) extrasMult += 0.20;
  if (f.merchLevel >= 5) extrasMult += 0.25;
  const extras = (attendance * 300 / 1_000_000) * marketingBonus * extrasMult;
  f.income.tickets += ticketIncome; f.income.matchdayExtras += extras; f.balance += ticketIncome + extras;
  if (f.matchdayFlags.show) for (const p of team.roster) if (rng() < 0.3) p.morale = clamp(p.morale + 1, 20, 100);
}
function processOperations(team) {
  const f = team.finance;
  const adminBonus = 1 - (team.staff.administrator ? team.staff.administrator.level * 0.04 : 0);
  const perGame = f.seasonBudget * 0.32 / 58 * adminBonus;
  f.expenses.operations += perGame; f.balance -= perGame;
}
function processGovSupport(team) {
  const perGame = (team.govSupport || 0) * 3 / 58;
  team.finance.balance += perGame;
  team.finance.income.gov += perGame;
}
function paySalaries(team) {
  const playerSalary = team.roster.reduce((s, p) => s + (Number(p.contract?.salary) || 0), 0);
  const loanSalaryShare = (G.league?.teams || []).reduce((sum, club) => sum + (club.roster || []).filter(p => p.loan && p.loan.parentTeamId === team.id).reduce((part, p) => part + (Number(p.loan.parentSalary) || 0), 0), 0);
  const staffSalary = Object.values(team.staff).filter(x => x).reduce((s, x) => s + x.salary, 0);
  const totalPlayerSalary = playerSalary + loanSalaryShare;
  team.finance.expenses.salaries += totalPlayerSalary * (1 / 58);
  team.finance.expenses.staffSalaries += staffSalary * (1 / 58);
  team.finance.balance -= (totalPlayerSalary + staffSalary) * (1 / 58);
}
function processMerchRevenue(team) {
  if (!team.finance.merchLevel || team.finance.merchLevel < 5) return;
  const passive = Math.round(team.finance.fanBase * 1000) / 1000 * 1.0;
  team.finance.balance += passive;
  team.finance.income.merch = (team.finance.income.merch || 0) + passive;
}
function generateSponsorOffers(team) {
  if (team.finance.sponsorOffers) return team.finance.sponsorOffers;
  const budget = team.finance.seasonBudget;
  const diff = G.difficulty || DIFFICULTIES.normal;
  const flow = team.sponsorFlow || 3;
  const types = [
    { key: 'general',  name: 'Генеральный спонсор',  share: 0.32, always: flow >= 3 },
    { key: 'tech',     name: 'Технический партнёр',  share: 0.14, always: true },
    { key: 'regional', name: 'Региональный партнёр', share: 0.07, always: true },
    { key: 'local1',   name: 'Локальный партнёр #1', share: 0.035, always: flow >= 2 },
    { key: 'local2',   name: 'Локальный партнёр #2', share: 0.035, always: flow >= 5 },
  ];
  const offers = [];
  for (const t of types) {
    if (!t.always) continue;
    const variance = 0.9 + rng() * 0.2;
    const base = Math.round(budget * t.share * variance * diff.sponsorMult);
    offers.push({ key: t.key, name: t.name, base, paid: 0, bonusWin: 0.12, bonusTop8: 2.0, bonusPlayoff: 5.0, bonusChampion: 8.0 });
  }
  team.finance.sponsorOffers = offers;
  return offers;
}
function signSponsor(team, offer) {
  if (!team.sponsors) team.sponsors = [];
  if (team.sponsors.some(s => s.key === offer.key)) return false;
  const signed = { ...offer, paid: 0 };
  team.sponsors.push(signed);
  const progress = G.league.currentRound / G.league.schedule.length;
  const first = Math.round(offer.base * progress);
  if (first > 0) { team.finance.balance += first; team.finance.income.sponsors += first; signed.paid += first; }
  return true;
}
function signAllSponsors(team) { const offers = team.finance.sponsorOffers || []; for (const o of offers) signSponsor(team, o); }
function signSponsorByKey(key) { const team = G.league.teams.find(t => t.id === G.playerTeamId); if (!team) return; const offer = (team.finance.sponsorOffers || []).find(o => o.key === key); if (offer) signSponsor(team, offer); render(); }
function initAISponsors() {
  if (!G.league) return;
  for (const team of G.league.teams) {
    if (!team.finance.sponsorOffers) generateSponsorOffers(team);
    if (team.id === G.playerTeamId) continue;
    for (const o of team.finance.sponsorOffers || []) if (!team.sponsors.some(s => s.key === o.key)) signSponsor(team, o);
  }
}
function paySponsors(team) {
  if (!team.sponsors || !team.sponsors.length) return;
  const progress = G.league.currentRound / G.league.schedule.length;
  for (const s of team.sponsors) {
    const target = Math.round(s.base * progress);
    const due = target - (s.paid || 0);
    if (due > 0) { team.finance.balance += due; team.finance.income.sponsors += due; s.paid = target; }
  }
}
function processSponsorPayouts(team) {
  if (!team.sponsors || !team.sponsors.length) return;
  const delta = team.record.w - team.finance.lastSponsorWins;
  if (delta > 0) {
    let bonus = 0;
    for (const s of team.sponsors) bonus += delta * s.bonusWin;
    bonus = Math.round(bonus * 10) / 10;
    team.finance.balance += bonus; team.finance.income.sponsorBonuses += bonus;
    team.finance.lastSponsorWins = team.record.w;
  }
}
function payTVInstallment(team) {
  const rank = standingsSorted().findIndex(t => t.id === team.id) + 1;
  const pool = team.finance.seasonBudget * 0.12;
  const factor = 0.5 + 0.5 * (30 - rank) / 29;
  const tv = Math.round(pool * factor / 6);
  team.finance.balance += tv; team.finance.income.tv += tv;
}
function paySponsorEndBonuses(team, rank, playoffResult) {
  if (!team.sponsors || !team.sponsors.length) return;
  let total = 0;
  for (const s of team.sponsors) {
    if (playoffResult === 'champion') total += s.bonusChampion;
    else if (playoffResult) total += s.bonusPlayoff;
    if (rank <= 8) total += s.bonusTop8;
  }
  if (total > 0) { team.finance.balance += total; team.finance.income.sponsorBonuses += total; }
}
function processPrizes(team, rank, playoffResult) {
  let total = 0;
  if (rank === 1) total += team.finance.seasonBudget * 0.10;
  else if (rank <= 4) total += team.finance.seasonBudget * 0.06;
  else if (rank <= 8) total += team.finance.seasonBudget * 0.03;
  const pPrizes = { champion: 0.15, finalist: 0.08, semifinal: 0.05, quarterfinal: 0.03, round16: 0.015 };
  if (playoffResult) total += team.finance.seasonBudget * (pPrizes[playoffResult] || 0);
  total = Math.round(total);
  team.finance.balance += total; team.finance.income.prizes += total;
  return total;
}
function payContractBonuses(team) {
  let total = 0;
  for (const p of team.roster) {
    const s = ensureStats(p);
    if (p.position === 'G') total += Math.floor(s.gp / 10) * (p.contract.bonusGames || 0) + s.shutouts * 0.15;
    else total += s.goals * (p.contract.bonusGoal || 0) + s.assists * (p.contract.bonusAssist || 0) + Math.floor(s.gp / 10) * (p.contract.bonusGames || 0);
  }
  total = Math.round(total * 10) / 10;
  if (total > 0) { team.finance.expenses.bonuses += total; team.finance.balance -= total; }
  return total;
}
function payPlayerSeasonBonuses(team, awards, reachedPlayoff) {
  let total = 0;
  for (const p of team.roster) {
    if (reachedPlayoff) total += p.contract.bonusPlayoff || 0;
    if (awards.mvp && awards.mvp.name === p.name && awards.mvp.team === team.name) total += p.contract.bonusMvp || 0;
    if (awards.topScorer && awards.topScorer.name === p.name && awards.topScorer.team === team.name) total += p.contract.bonusTopScorer || 0;
  }
  total = Math.round(total * 10) / 10;
  if (total > 0) { team.finance.expenses.bonuses += total; team.finance.balance -= total; }
  return total;
}
