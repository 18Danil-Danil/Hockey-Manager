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

console.log('Contract negotiation and expiry checks passed.');
