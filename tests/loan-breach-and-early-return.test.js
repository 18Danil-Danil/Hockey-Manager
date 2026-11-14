const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let roll = 0;
const inbox = [];
const news = [];
const context = {
  G: { playerTeamId: 1, league: { currentRound: 9, teams: [], loanLog: [], news: [] } },
  rng: () => roll,
  addNews: (...args) => news.push(args),
  addInboxMessage: (...args) => inbox.push(args),
  showToast: () => {},
  render: () => {},
  saveGame: () => {},
  syncLines: () => {},
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
vm.runInContext(source, context);

const player = {
  id: 50, name: 'Арендованный игрок', position: 'F', morale: 70,
  contract: { salary: 1.5 }, stats: { gp: 2 }, playoffStats: {},
  loanOriginalContract: { salary: 2 },
  loan: {
    parentTeamId: 1, parentTeamName: 'Наш клуб',
    borrowerTeamId: 2, borrowerTeamName: 'Клуб-партнёр',
    startRound: 1, endRound: 11, role: 'top', guaranteedGames: 7,
    performance: { gp: 2, goals: 0, assists: 0, points: 0, wins: 0, saves: 0, shotsAgainst: 0, goalsAgainst: 0, shutouts: 0 },
    statsSnapshot: { gp: 2 }
  }
};
const parent = { id: 1, name: 'Наш клуб', roster: [], finance: { balance: 10 } };
const borrower = { id: 2, name: 'Клуб-партнёр', roster: [player], finance: { balance: 10 } };
context.G.league.teams = [parent, borrower];

context.updateLoanPerformance(borrower);
assert.equal(player.loan.guaranteeBreach.gamesPlayed, 2, 'breach should be recorded once when the guarantee becomes impossible');
assert.equal(player.morale, 62, 'player morale should fall after the club breaks its playing-time promise');
assert.equal(context.G.league.loanClubRelations['1:2'], 38, 'club relationship should worsen after a breach');
assert.ok(inbox.some(item => String(item[2]).includes('Нарушение условий аренды')));
assert.ok(news.length > 0);

assert.equal(context.requestLoanEarlyReturn(player.id), true, 'parent club should be able to request an early return after a breach');
assert.ok(parent.roster.some(item => item.id === player.id), 'accepted request should return the player to the parent club');
assert.equal(player.loan, null);
assert.equal(context.G.league.loanLog.at(-1).reason, 'recall');

const second = {
  id: 51, name: 'Игрок без нарушения', morale: 65, position: 'D',
  contract: { salary: 1 }, stats: {}, playoffStats: {},
  loan: { parentTeamId: 1, parentTeamName: 'Наш клуб', borrowerTeamId: 2, borrowerTeamName: 'Клуб-партнёр', startRound: 8, endRound: 13, role: 'reserve', guaranteedGames: 1, performance: { gp: 0 }, statsSnapshot: {} }
};
borrower.roster = [second];
roll = 0.99;
assert.equal(context.requestLoanEarlyReturn(second.id), false, 'the other club may reject an early-return request');
assert.equal(second.loan.earlyReturnRequest.status, 'rejected');
assert.ok(borrower.roster.some(item => item.id === second.id), 'rejected request must leave the loan active');


const aiOwnedPlayer = {
  id: 52, name: 'Игрок клуба ИИ', morale: 60, position: 'F',
  contract: { salary: 1.2 }, stats: {}, playoffStats: {},
  loan: {
    parentTeamId: 2, parentTeamName: 'Клуб-партнёр',
    borrowerTeamId: 1, borrowerTeamName: 'Наш клуб',
    startRound: 5, endRound: 15, role: 'top', guaranteedGames: 7,
    guaranteeBreach: { round: 8, gamesPlayed: 1, guaranteedGames: 7 },
    performance: { gp: 1, goals: 0, assists: 0, points: 0 },
    statsSnapshot: {}
  }
};
parent.roster = [aiOwnedPlayer];
borrower.roster = [];
roll = 0;
context.G.league.currentRound = 9;
assert.equal(context.processAIRequestedLoanRecalls(), undefined);
assert.equal(aiOwnedPlayer.loan.aiRecallRequest.status, 'pending', 'AI parent club should request a return after a guarantee breach');
assert.ok(inbox.some(item => String(item[2]).includes('Запрос клуба на возврат')));
assert.equal(context.respondToAIRecallRequest(aiOwnedPlayer.id, true), true, 'user should be able to accept the AI club recall request');
assert.ok(borrower.roster.some(item => item.id === aiOwnedPlayer.id), 'accepted AI recall should return the player to the parent club');
assert.equal(aiOwnedPlayer.loan, null);
assert.equal(context.G.league.loanLog.at(-1).reason, 'ai-recall');

const aiOwnedPlayer2 = {
  id: 53, name: 'Второй игрок клуба ИИ', morale: 60, position: 'D',
  contract: { salary: 1 }, stats: {}, playoffStats: {},
  loan: {
    parentTeamId: 2, parentTeamName: 'Клуб-партнёр',
    borrowerTeamId: 1, borrowerTeamName: 'Наш клуб',
    startRound: 5, endRound: 15, role: 'rotation', guaranteedGames: 5,
    guaranteeBreach: { round: 8, gamesPlayed: 1, guaranteedGames: 5 },
    performance: { gp: 1, goals: 0, assists: 0, points: 0 },
    statsSnapshot: {}
  }
};
parent.roster = [aiOwnedPlayer2];
borrower.roster = [];
aiOwnedPlayer2.loan.aiRecallRequest = { status: 'pending', requestedRound: 9 };
assert.equal(context.respondToAIRecallRequest(aiOwnedPlayer2.id, false), true, 'user should be able to reject an AI recall request');
assert.ok(parent.roster.some(item => item.id === aiOwnedPlayer2.id), 'rejected AI recall should keep the loan active');
assert.equal(aiOwnedPlayer2.loan.aiRecallRequest.status, 'rejected');

console.log('Loan breach and early-return checks passed.');
