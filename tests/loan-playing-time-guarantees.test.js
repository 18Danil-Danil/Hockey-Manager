const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = {
  G: { league: { currentRound: 9, teams: [], loanLog: [], news: [] } },
  rng: () => 0,
  addNews: () => {},
  addInboxMessage: () => {},
  showToast: () => {},
  render: () => {},
  saveGame: () => {},
  syncLines: () => {},
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
vm.runInContext(source, context);

assert.deepEqual(JSON.parse(JSON.stringify(context.loanRoleGuarantee('top', 10))), { share: 0.65, minimumGames: 7 });
assert.equal(context.loanRoleGuarantee('rotation', 10).minimumGames, 4);
assert.equal(context.loanRoleGuarantee('reserve', 10).minimumGames, 2);

const atRisk = {
  position: 'F',
  loan: {
    startRound: 1, endRound: 11, role: 'top', guaranteedGames: 7,
    performance: { gp: 3, goals: 1, assists: 0, points: 1 }
  }
};
const riskReport = context.loanPerformanceReport(atRisk, 9);
assert.equal(riskReport.guaranteeAtRisk, true, 'a club must be warned when the remaining rounds cannot meet the promised games');
assert.equal(riskReport.status, 'Риск нарушения гарантии');
assert.equal(riskReport.guaranteedGamesRemaining, 4);

const fulfilled = {
  position: 'F',
  loan: {
    startRound: 1, endRound: 11, role: 'rotation', guaranteedGames: 4,
    performance: { gp: 4, goals: 1, assists: 1, points: 2 }
  }
};
const fulfilledReport = context.loanPerformanceReport(fulfilled, 9);
assert.equal(fulfilledReport.guaranteeMet, true);
assert.equal(fulfilledReport.guaranteeStatus, 'Гарантия выполнена');

console.log('Loan playing-time guarantee checks passed.');
