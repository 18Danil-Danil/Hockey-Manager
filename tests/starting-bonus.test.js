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
  standingsSorted: () => [team],
  ensureScheduleCalendar: () => [{ date: '2026-10-01' }],
  ensureStats: () => ({ points: 0 }),
  logoHeader: () => '',
  document: { querySelectorAll: selector => selector === '.team-card' ? [card] : [] }
};
vm.createContext(context);
vm.runInContext(source + '\nthis.api = { renderTeamSelect, bindTeamSelect, renderOverview, unreadInboxCount };', context);
const api = context.api;
assert.strictEqual(api.unreadInboxCount(), 0, 'unread inbox helper should work without a test stub');

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

// Регрессия: после выбора клуба стартовый экран должен отрисовать обзор.
// Ранее renderOverview обращался к negotiationHistory из локальной области renderLoans,
// из-за чего выбор клуба завершался ReferenceError и игра оставалась на экране выбора.
team.record = { w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0 };
team.roster = [{ id: 1, name: 'Тестовый игрок', position: 'C', ovr: 60 }];
team.streak = { type: null, count: 0 };
G.playerTeamId = 7;
G.league.season = '2026/27';
G.league.schedule = [[[7, 8]]];
G.league.currentRound = 0;
G.league.results = [];
G.league.loanNegotiationHistory = [];
const overview = api.renderOverview();
assert(overview.includes('Добро пожаловать в штаб, Тестовый клуб'));
assert(overview.includes('История переговоров (0)'));
G.league.inbox = [
  { id: 1, type: 'league', from: 'Лига', subject: 'Календарь обновлён', body: 'Опубликовано расписание ближайших матчей.', season: '2026/27', round: 0, read: true },
  { id: 2, type: 'league', from: 'Клуб-соперник', subject: 'Предложение о трансфере', body: 'Предлагаем приобрести вашего хоккеиста.', season: '2026/27', round: 1, read: false }
];
assert.strictEqual(api.unreadInboxCount(), 1, 'unread inbox helper should count unread messages');
const overviewWithMail = api.renderOverview();
assert(overviewWithMail.includes('dashboard-mail-panel'), 'overview should contain a dedicated mail panel');
assert(overviewWithMail.includes('Предложение о трансфере'), 'overview should preview recent messages');
assert(overviewWithMail.includes('1 новых'), 'overview should show the unread message count');
assert(overviewWithMail.includes('dashboard-mail-unread-dot'), 'unread messages should be visually distinguished');
assert(overviewWithMail.includes("G.activeTab='inbox'"), 'mail panel should link to the full inbox');

console.log('Starting bonus and overview mail checks passed.');
