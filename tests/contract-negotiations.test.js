const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const negotiationSource = fs.readFileSync(path.join(__dirname, '..', 'engine', 'contract-negotiations.js'), 'utf8');
const context = { G: { league: { freeAgents: [], season: '2026/27', internationalMarket: { clubs: [], transferLog: [] } } }, markYouthGraduateSigned: (player, team, method) => { player.signingMethod = method; } };
vm.createContext(context);
vm.runInContext(negotiationSource, context);

const player = { id: 1, name: 'Тестовый', age: 25, ovr: 80, morale: 80, nationality: 'Россия', contract: { salary: 5, years: 1 } };
const team = { id: 1, roster: [player], finance: { salaryCap: 20, balance: 100 } };
context.G.league.freeAgents = [ ];
const demand = context.getPlayerContractDemand(player, team, 'renewal');
assert.ok(demand.salary >= 5, 'renewal demand must not fall far below current salary');
assert.ok(demand.years >= 1 && demand.years <= 5);

const accepted = context.evaluatePlayerContractOffer(player, team, { salary: demand.salary, years: demand.years }, 'renewal');
assert.equal(accepted.decision, 'accept');
const applied = context.applyPlayerContractAgreement(team, player, { salary: demand.salary, years: demand.years }, 'renewal');
assert.equal(applied.applied, true);
assert.equal(player.contract.years, 1 + demand.years);
assert.equal(player.contract.salary, demand.salary);

const freeAgent = { id: 2, name: 'Свободный', age: 22, ovr: 74, morale: 70, nationality: 'Россия', contract: { salary: 2, years: 0 }, status: 'ufa' };
context.G.league.freeAgents = [freeAgent];
const signingDemand = context.getPlayerContractDemand(freeAgent, team, 'signing');
const signing = context.applyPlayerContractAgreement(team, freeAgent, { salary: signingDemand.salary, years: signingDemand.years }, 'signing');
assert.equal(signing.decision, 'accept');
assert.ok(team.roster.includes(freeAgent));
assert.equal(freeAgent.status, 'contract');
assert.equal(freeAgent.signingMethod, 'negotiated-contract');

const counter = context.evaluatePlayerContractOffer(player, team, { salary: demand.salary * 0.95, years: 1 }, 'renewal');
assert.ok(['counter', 'reject'].includes(counter.decision), 'a below-demand offer should not be accepted automatically');

const capTeam = { id: 2, roster: [], finance: { salaryCap: 1 } };
const capResult = context.evaluatePlayerContractOffer(freeAgent, capTeam, { salary: 2, years: 2 }, 'signing');
assert.equal(capResult.reason, 'salary-cap');

const foreignTeam = { id: 3, roster: [
  { nationality: 'Беларусь' }, { nationality: 'Казахстан' }, { nationality: 'США' }
], finance: { salaryCap: 50 } };
const foreignResult = context.evaluatePlayerContractOffer({ ...freeAgent, nationality: 'Швеция' }, foreignTeam, { salary: 2, years: 2 }, 'signing');
assert.equal(foreignResult.reason, 'foreign-limit');

const internationalPlayer = { id: 30, name: 'Игрок из Европы', age: 24, ovr: 72, morale: 80, nationality: 'Россия', contract: { salary: 1, years: 2 }, status: 'contract' };
const sourceClub = { id: 'source', name: 'Европейский клуб', leagueName: 'Европейская лига', country: 'Швейцария', roster: [internationalPlayer], averageOvr: 72 };
context.G.league.internationalMarket.clubs = [sourceClub];
context.G.contractNegotiation = { transferFee: 3, clubId: 'source' };
context.findInternationalPlayer = id => {
  const club = context.G.league.internationalMarket.clubs.find(item => item.roster.some(candidate => candidate.id === id));
  return club ? { player: club.roster.find(candidate => candidate.id === id), club } : null;
};
const internationalDemand = context.getPlayerContractDemand(internationalPlayer, team, 'international-signing');
const internationalAgreement = context.applyPlayerContractAgreement(team, internationalPlayer, { salary: internationalDemand.salary, years: internationalDemand.years }, 'international-signing');
assert.equal(internationalAgreement.applied, true);
assert.ok(team.roster.includes(internationalPlayer));
assert.equal(sourceClub.roster.length, 0);
assert.equal(team.finance.balance, 97);
assert.equal(context.G.league.internationalMarket.transferLog[0].fee, 3);

const seasonEndSource = fs.readFileSync(path.join(__dirname, '..', 'engine', 'season-end.js'), 'utf8');
const expiryContext = {
  G: { league: { freeAgents: [] } },
  contractFor: () => ({ salary: 1, years: 3 }),
  markYouthGraduateAvailable: player => { player.youthAvailable = true; }
};
vm.createContext(expiryContext);
vm.runInContext(seasonEndSource, expiryContext);
const active = { id: 10, status: 'contract', contract: { salary: 1, years: 2 } };
const expires = { id: 11, status: 'contract', contract: { salary: 1, years: 1 }, youthGraduated: true };
const tryout = { id: 12, status: 'tryout', contract: { salary: 0.5, years: 0 } };
const roster = { roster: [active, expires, tryout] };
const released = expiryContext.processTeamContractExpirations(roster);
assert.deepEqual(Array.from(released, item => item.id), [11]);
assert.equal(active.contract.years, 1);
assert.equal(expires.status, 'ufa');
assert.equal(expires.youthAvailable, true);
assert.deepEqual(Array.from(roster.roster, item => item.id), [10, 12]);
assert.equal(expiryContext.G.league.freeAgents[0], expires);
assert.equal(tryout.status, 'tryout', 'tryout agreements must not expire through standard contract processing');


/* Player personality preferences, role fit and multi-round negotiations. */
const leader = { id: 101, name: 'Лидер', age: 27, ovr: 82, morale: 85, character: 'leader', contract: { salary: 6, years: 1 } };
const egoist = { id: 102, name: 'Эгоист', age: 27, ovr: 82, morale: 85, character: 'egoist', contract: { salary: 6, years: 1 } };
const leaderPrefs = context.getPlayerContractPreferences(leader);
const egoistPrefs = context.getPlayerContractPreferences(egoist);
assert.ok(leaderPrefs.loyalty > egoistPrefs.loyalty, 'leaders should value loyalty more than egoists');
assert.ok(egoistPrefs.money > leaderPrefs.money, 'egoists should value salary more than leaders');
assert.equal(context.getPlayerContractPreferences(leader), leaderPrefs, 'preferences should persist instead of rerolling');

const negotiatingTeam = { id: 77, name: 'Переговорный клуб', roster: [leader, egoist], bench: [egoist.id], record: { w: 10, l: 15, otl: 3, pts: 23 }, finance: { salaryCap: 100, balance: 100 } };
const leaderDemand = context.getPlayerContractDemand(leader, negotiatingTeam, 'renewal');
const egoistDemand = context.getPlayerContractDemand(egoist, negotiatingTeam, 'renewal');
assert.ok(leaderDemand.fit.role > egoistDemand.fit.role, 'starter role fit should exceed bench role fit');
context.G.league.teams = [negotiatingTeam];
context.G.playerTeamId = negotiatingTeam.id;
context.render = () => {};
context.saveGame = () => {};
context.addNews = () => {};
context.openPlayerContractNegotiation(leader.id, 'renewal');
let negotiationState = context.G.contractNegotiation;
assert.equal(negotiationState.maxRounds, 3);
negotiationState.offer = { salary: Math.round(leaderDemand.salary * 0.9 * 10) / 10, years: leaderDemand.years };
let negotiationResult = context.submitPlayerContractNegotiation();
assert.equal(negotiationResult.decision, 'counter', 'a near-demand offer should trigger a counteroffer');
assert.equal(negotiationState.round, 1);
negotiationState.offer = { salary: leaderDemand.salary, years: leaderDemand.years };
negotiationResult = context.submitPlayerContractNegotiation();
assert.equal(negotiationResult.decision, 'accept', 'a revised fair offer should be accepted');
assert.equal(negotiationState.completed, true);
assert.equal(leader.contract.years, 1 + leaderDemand.years, 'accepted renewal should update contract length');

const stubborn = { id: 103, name: 'Неприступный', age: 28, ovr: 80, morale: 35, character: 'egoist', contract: { salary: 5, years: 1 } };
negotiatingTeam.roster.push(stubborn);
context.openPlayerContractNegotiation(stubborn.id, 'renewal');
negotiationState = context.G.contractNegotiation;
negotiationState.offer = { salary: 0.5, years: 1 };
for (let round = 0; round < 3; round++) {
  negotiationResult = context.submitPlayerContractNegotiation();
}
assert.equal(negotiationState.round, 3);
assert.equal(negotiationState.closed, true, 'player should end talks after three unacceptable offers');
assert.equal(context.submitPlayerContractNegotiation(), false, 'closed negotiations must not accept a fourth offer');

const rosterManagementSource = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
assert.match(rosterManagementSource, /getPlayerContractDemand\(p, team, 'renewal'\)/, 'AI renewals must use the same player demand model');
assert.match(rosterManagementSource, /evaluatePlayerContractOffer\(p, team, offer, 'renewal'\)/, 'AI renewals must evaluate player preferences');


/* Contract add-ons: signing and performance bonuses. */
const bonusFreeAgent = { id: 44, name: 'Бонусный игрок', age: 24, ovr: 76, morale: 75, nationality: 'Россия', contract: { salary: 2, years: 0 }, status: 'ufa' };
context.G.league.freeAgents = [bonusFreeAgent];
const bonusDemand = context.getPlayerContractDemand(bonusFreeAgent, team, 'signing');
const bonusOffer = {
  salary: bonusDemand.salary, years: bonusDemand.years,
  signingBonus: 2.5, bonusGoal: 0.2, bonusAssist: 0.1,
  bonusGames: 0.3, bonusPlayoff: 1.5, bonusMvp: 4, bonusTopScorer: 2
};
const bonusEvaluation = context.evaluatePlayerContractOffer(bonusFreeAgent, team, bonusOffer, 'signing');
assert.equal(bonusEvaluation.decision, 'accept', 'reasonable bonus package should improve a fair offer');
const balanceBeforeSigningBonus = team.finance.balance;
const bonusAgreement = context.applyPlayerContractAgreement(team, bonusFreeAgent, bonusOffer, 'signing');
assert.equal(bonusAgreement.applied, true);
assert.equal(team.finance.balance, balanceBeforeSigningBonus - 2.5, 'signing bonus must be paid immediately');
assert.equal(bonusFreeAgent.contract.bonusGoal, 0.2);
assert.equal(bonusFreeAgent.contract.bonusAssist, 0.1);
assert.equal(bonusFreeAgent.contract.bonusGames, 0.3);
assert.equal(bonusFreeAgent.contract.bonusPlayoff, 1.5);
assert.equal(bonusFreeAgent.contract.bonusMvp, 4);
assert.equal(bonusFreeAgent.contract.bonusTopScorer, 2);
assert.equal(team.finance.expenses.signingBonuses, 2.5);

const renewalBonusPlayer = { id: 45, name: 'Продлеваемый', age: 27, ovr: 78, morale: 75, nationality: 'Россия', contract: { salary: 3, years: 1 } };
const renewalBonusTeam = { id: 45, roster: [renewalBonusPlayer], finance: { salaryCap: 50, balance: 50 } };
const renewalDemand = context.getPlayerContractDemand(renewalBonusPlayer, renewalBonusTeam, 'renewal');
const renewalOffer = { salary: renewalDemand.salary, years: renewalDemand.years, signingBonus: 10, bonusGoal: 0.15 };
const renewalAgreement = context.applyPlayerContractAgreement(renewalBonusTeam, renewalBonusPlayer, renewalOffer, 'renewal');
assert.equal(renewalAgreement.applied, true);
assert.equal(renewalBonusTeam.finance.balance, 50, 'renewal must not pay a signing bonus');
assert.equal(renewalBonusPlayer.contract.signingBonus, 0);
assert.equal(renewalBonusPlayer.contract.bonusGoal, 0.15);

const unaffordableBonusTeam = { id: 46, roster: [], finance: { salaryCap: 50, balance: 1 } };
const unaffordable = context.evaluatePlayerContractOffer(bonusFreeAgent, unaffordableBonusTeam, {
  salary: bonusDemand.salary, years: bonusDemand.years, signingBonus: 2
}, 'signing');
assert.equal(unaffordable.reason, 'signing-bonus', 'unaffordable signing bonuses must be rejected');

console.log('Contract negotiation and expiry checks passed.');
