const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let roll = 0;
const messages = [];
const context = {
  G: { playerTeamId: 1, league: { currentRound: 8, teams: [], loanLog: [], news: [] } },
  rng: () => roll,
  addNews: (...args) => messages.push(args),
  addInboxMessage: (...args) => messages.push(args),
  showToast: () => {},
  render: () => {},
  saveGame: () => {},
  syncLines: () => {},
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
vm.runInContext(source, context);

const player = {
  id: 10, name: 'Тестовый хоккеист', age: 23, position: 'F', ovr: 75,
  contract: { salary: 2 },
  loan: {
    parentTeamId: 2, parentTeamName: 'Клуб-владелец', borrowerTeamId: 1,
    startRound: 5, endRound: 10, wageShare: 50, performance: { gp: 3, goals: 1, assists: 1, points: 2 }
  }
};
const borrower = { id: 1, name: 'Наш клуб', roster: [player] };
const parent = { id: 2, name: 'Клуб-владелец', roster: [] };
context.G.league.teams = [borrower, parent];
context.G.league.loanLog = [{ playerId: 10, endRound: 10 }];

assert.equal(context.startLoanExtensionNegotiation(10, 5), true);
assert.equal(player.loan.extensionNegotiation.status, 'pending');
assert.equal(player.loan.extensionNegotiation.requestedRounds, 5);
assert.equal(context.startLoanExtensionNegotiation(10, 3), false, 'duplicate pending requests must be blocked');

context.G.league.currentRound = 9;
context.processLoanExtensionNegotiations();
assert.equal(player.loan.extensionNegotiation.status, 'accepted');
assert.equal(player.loan.endRound, 15, 'accepted extension must update the loan end round');
assert.equal(context.G.league.loanLog[0].endRound, 15, 'active loan history must be synchronized');

const counterPlayer = {
  id: 11, name: 'Игрок для встречного предложения', age: 24, position: 'D', ovr: 74,
  loan: { parentTeamId: 2, parentTeamName: 'Клуб-владелец', borrowerTeamId: 1, startRound: 5, endRound: 10, performance: { gp: 0, goals: 0, assists: 0, points: 0 } }
};
borrower.roster = [counterPlayer];
context.G.league.currentRound = 8;
roll = 0.4;
assert.equal(context.startLoanExtensionNegotiation(11, 3), true);
context.G.league.currentRound = 9;
context.processLoanExtensionNegotiations();
assert.equal(counterPlayer.loan.extensionNegotiation.status, 'counter');
assert.equal(counterPlayer.loan.endRound, 10, 'counteroffer must not extend the loan before acceptance');
assert.equal(context.respondToLoanExtension(11, true), true);
assert.equal(counterPlayer.loan.endRound, 11, 'accepting the counteroffer must apply its shorter duration');

const longLoan = { ...counterPlayer, id: 12, loan: { ...counterPlayer.loan, startRound: 0, endRound: 10, extensions: 0, extensionNegotiation: null } };
borrower.roster = [longLoan];
context.G.league.currentRound = 8;
assert.equal(context.startLoanExtensionNegotiation(12, 5), false, 'the extension limit must prevent exceeding ten total rounds');

console.log('Loan extension negotiation checks passed.');
