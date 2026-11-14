const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/config.js'), 'utf8'), context);
const difficulties = context.window.GAME_CONFIG.DIFFICULTIES;
const apply = context.applyDifficultySalaryCaps;
const teams = [
  { id: 1, finance: { seasonBudget: 100, salaryCap: 50 } },
  { id: 2, finance: { seasonBudget: 80, salaryCap: 40 } },
  { id: 3, finance: { seasonBudget: 120, salaryCap: 60 } },
];
apply(teams, 2, difficulties.easy);
assert.deepStrictEqual(teams.map(team => team.finance.salaryCap), [50, 60, 60]);
apply(teams, 2, difficulties.normal);
assert.deepStrictEqual(teams.map(team => team.finance.salaryCap), [50, 40, 60]);
apply(teams, 2, difficulties.hardcore);
assert.deepStrictEqual(teams.map(team => team.finance.salaryCap), [45, 36, 54]);
console.log('Difficulty salary-cap checks passed.');
