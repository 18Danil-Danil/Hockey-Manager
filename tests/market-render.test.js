const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');
const G = {
  marketFilter: 'all',
  marketSort: 'ovr-desc',
  marketLeague: 'free',
  playerTeamId: 1,
  league: {
    teams: [{ id: 1, staff: { scout: null } }],
    freeAgents: [
      { id: 1, name: 'Молодой', age: 21, ovr: 70, pot: 80, position: 'C', nationality: 'Россия', contract: { salary: 1.2 }, character: 'calm' },
      { id: 2, name: 'Опытный', age: 30, ovr: 82, pot: 82, position: 'D', nationality: 'Россия', contract: { salary: 2.1 }, character: 'calm' }
    ],
    internationalMarket: {
      clubs: [{
        id: 'test-club', name: 'Тест', city: 'Тест', country: 'Беларусь', leagueName: 'Тест-лига', region: 'belarus',
        roster: [
          { id: 3, name: 'Старший', age: 29, ovr: 77, pot: 77, position: 'C', nationality: 'Беларусь' },
          { id: 4, name: 'Младший', age: 20, ovr: 72, pot: 80, position: 'D', nationality: 'Беларусь' }
        ]
      }]
    }
  }
};
const context = {
  G,
  CHARACTERS: { calm: { cls: 'calm', label: 'Спокойный' } },
  getInternationalTransferQuote: () => ({ allowed: true, reason: '', salary: 1, price: 2 })
};
vm.runInNewContext(source, context);

const freeHtml = context.renderFreeAgentMarket();
assert.match(freeHtml, /Свободные агенты/);
assert.ok(freeHtml.indexOf('Опытный') < freeHtml.indexOf('Молодой'), 'free agents should render in OVR-desc order');

G.marketSort = 'age-asc';
const intlHtml = context.renderInternationalMarket('belarus');
assert.match(intlHtml, /Клубы Беларуси/);
assert.ok(intlHtml.indexOf('Младший') < intlHtml.indexOf('Старший'), 'international players should render in age-asc order');

G.marketSort = 'invalid-legacy-value';
assert.doesNotThrow(() => context.renderFreeAgentMarket(), 'free-agent market should fall back for unknown saved sort values');
assert.doesNotThrow(() => context.renderInternationalMarket('belarus'), 'international market should fall back for unknown saved sort values');

console.log('Market rendering and sorting checks passed.');
