const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'ui/render.js'), 'utf8');
const team = { id: 7, name: 'Тестовый клуб', city: 'Город', region: 'Регион', talent: 70, prestige: 50, trend: 'stable', finance: { balance: 20, seasonBudget: 100, arenaCapacity: 5000 } };
const G = {
  selectedDifficulty: 'easy',
  startingBonusMillions: 135,
  noFireMode: false,
  career: {},
  league: { teams: [team] },
  activeTab: 'overview',
  screen: 'select'
};
const DIFFICULTIES = {
  easy: { key: 'easy', startReputation: 60 },
  normal: { key: 'normal', startReputation: 50 }
};
const card = { dataset: { teamId: '7' }, onclick: null };
const context = {
  G, DIFFICULTIES,
  clubLogoWithFallback: () => '',
  applyDifficultySalaryCaps: () => {},
  initAISponsors: () => {},
  render: () => {},
  document: { querySelectorAll: selector => selector === '.team-card' ? [card] : [] }
};
vm.createContext(context);
vm.runInContext(source + '\nthis.api = { renderTeamSelect, bindTeamSelect };', context);
const api = context.api;

const easyMarkup = api.renderTeamSelect();
assert(easyMarkup.includes('Стартовая финансовая надбавка'));
assert(easyMarkup.includes('max="500"'));
assert(easyMarkup.includes('value="135"'));

api.bindTeamSelect();
card.onclick();
assert.strictEqual(team.finance.balance, 155, 'the selected bonus must be added to the selected club balance');
assert.strictEqual(G.career.startingBonusMillions, 135);
assert.strictEqual(G.career.startingBonusApplied, true);

G.screen = 'select';
card.onclick();
assert.strictEqual(team.finance.balance, 155, 'the starting bonus must never be applied twice');

G.selectedDifficulty = 'normal';
G.startingBonusMillions = 200;
G.career = {};
G.screen = 'select';
assert.strictEqual(api.renderTeamSelect().includes('Стартовая финансовая надбавка'), false, 'the control must be hidden outside easy difficulty');
api.bindTeamSelect();
card.onclick();
assert.strictEqual(team.finance.balance, 155, 'normal difficulty must not receive the bonus');

console.log('Starting bonus checks passed.');
