const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'international-transfers.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');

const player = {
  id: 501, name: 'Тестовый игрок', position: 'C', age: 24, ovr: 76, pot: 80,
  nationality: 'Беларусь', contract: { salary: 1.5, years: 2 }, status: 'contract'
};
const club = {
  id: 'test-club', name: 'Тестовый клуб', leagueName: 'Тест-лига',
  country: 'Беларусь', roster: [player], averageOvr: 72
};
const team = {
  id: 1, name: 'Клуб ВХЛ', roster: [], lines: [],
  finance: { balance: 20, salaryCap: 100 }
};
const G = {
  playerTeamId: 1,
  league: { season: '2026/27', teams: [team], internationalMarket: { version: 4, clubs: [club] } }
};
const toasts = [];
const news = [];
const context = {
  window: {},
  G,
  showToast: (...args) => toasts.push(args),
  getInternationalTransferQuote: () => ({ allowed: true, salary: 2, price: 3 }),
  isTradeDeadlinePassed: () => false,
  syncLines: () => {},
  addNews: (...args) => news.push(args),
  render: () => {},
  saveGame: () => {},
  Math, Number, String, Array, Map, Set, Object, JSON
};
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(context.buyInternationalPlayer(501), true);
assert.equal(team.roster.length, 1, 'purchased player should be added to the VHL roster');
assert.equal(team.roster[0].name, 'Тестовый игрок');
assert.equal(club.roster.length, 0, 'purchased player should be removed from the foreign club');
assert.equal(team.finance.balance, 16.9, 'transfer fee should be deducted');
assert.equal(team.finance.expenses.transfers, 3.1, 'transfer expense should be recorded');
assert.equal(G.league.internationalMarket.transferLog.length, 1, 'transfer log should be created even in older saves');
assert.ok(toasts.length, 'successful purchase should show a confirmation');

const marketStart = uiSource.indexOf('function renderInternationalMarket');
const marketEnd = uiSource.indexOf('function renderTrades', marketStart);
const marketSource = uiSource.slice(marketStart, marketEnd);
assert.match(marketSource, /type="button"[^>]*onclick="openInternationalClubNegotiation\(\$\{Number\(player\.id\)\}\)"/,
  'international market button should start club transfer negotiations with a numeric player id');

console.log('International player purchase checks passed.');
