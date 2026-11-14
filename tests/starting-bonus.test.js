const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'ui/game-settings.js'), 'utf8');
const classes = new Set();
const document = { body: { dataset: {}, classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) } } };
const G = { league: { season: '2026/27', teams: [] }, playerTeamId: null, activeTab: 'overview', screen: 'title' };
let saved = 0;
const context = { G, document, saveGame: () => saved++, render: () => {}, confirm: () => true, newGame: () => { G.screen = 'select'; } };
vm.runInNewContext(source + '\nthis.api = { normalizeGameSettings, applyGameSettings, renderTitleScreen, renderSettings, updateGameSetting };', context);
const api = context.api;
const normalized = api.normalizeGameSettings({ accent: 'purple', compactNav: 1, reducedMotion: 0, confirmNewGame: false });
assert.strictEqual(normalized.accent, 'orange');
assert.strictEqual(normalized.compactNav, true);
assert.strictEqual(normalized.confirmNewGame, false);
G.settings = { accent: 'blue', compactNav: true, reducedMotion: true, confirmNewGame: false };
api.applyGameSettings();
assert.strictEqual(document.body.dataset.accent, 'blue');
assert(classes.has('compact-navigation'));
assert(classes.has('reduce-motion'));
const title = api.renderTitleScreen();
assert(title.includes('HOCKEY') && title.includes('Новая карьера') && title.includes('Настройки'));
const settings = api.renderSettings(true);
assert(settings.includes('Настройки игры') && settings.includes('Холодный синий') && settings.includes('Подтверждение новой карьеры'));
api.updateGameSetting('accent', 'red');
assert.strictEqual(G.settings.accent, 'red');
assert(saved > 0);
console.log('Game settings and title screen checks passed.');

const bonusContext = {
  G: { startingBonusMillions: 0, difficulty: { key: 'easy' }, career: {}, playerTeamId: null,
    league: { teams: [{ id: 7, finance: { balance: 20 } }] } },
  document: {
    getElementById: id => bonusElements[id] || null,
    querySelectorAll: selector => selector === '.team-card' ? [teamCard] : []
  }
};
const bonusElements = {
  'starting-bonus-range': { value: 0 },
  'starting-bonus-number': { value: 0 },
  'starting-bonus-value': { textContent: '' }
};
const teamCard = { dataset: { teamId: '7' }, onclick: null };
vm.createContext(bonusContext);
vm.runInContext(source + '\nthis.api = { renderTeamSelect, bindTeamSelect };', bonusContext);
const bonusApi = bonusContext.api;
const easyMarkup = bonusApi.renderTeamSelect();
assert(easyMarkup.includes('Стартовая финансовая надбавка'));
assert(easyMarkup.includes('max="500"'));
bonusContext.G.startingBonusMillions = 135;
bonusApi.bindTeamSelect();
teamCard.onclick();
assert.strictEqual(bonusContext.G.league.teams[0].finance.balance, 155, 'the chosen bonus must be added to the selected club balance');
assert.strictEqual(bonusContext.G.career.startingBonusMillions, 135);
assert.strictEqual(bonusContext.G.career.startingBonusApplied, true);
bonusContext.G.screen = 'select';
teamCard.onclick();
assert.strictEqual(bonusContext.G.league.teams[0].finance.balance, 155, 'the starting bonus must never be applied twice');
bonusContext.G.difficulty = { key: 'normal' };
bonusContext.G.career = {};
bonusContext.G.startingBonusMillions = 200;
bonusContext.G.screen = 'select';
bonusApi.bindTeamSelect();
teamCard.onclick();
assert.strictEqual(bonusContext.G.league.teams[0].finance.balance, 155, 'normal difficulty must not receive the bonus');
assert.strictEqual(bonusApi.renderTeamSelect().includes('Стартовая финансовая надбавка'), false, 'the control must be hidden outside easy difficulty');
console.log('Starting bonus checks passed.');
