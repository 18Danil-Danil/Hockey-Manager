const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/render.js'), 'utf8');
const start = source.indexOf('function renderLines() {');
const marker = '\n}\n\n/* ============================================================';
const end = source.indexOf(marker, start);
assert(start >= 0 && end > start, 'Не найдена функция renderLines');
const functionSource = source.slice(start, end + 2);

const players = [];
for (let i = 0; i < 12; i++) players.push({ id: i + 1, name: 'Нападающий ' + (i + 1), position: ['LW', 'C', 'RW'][i % 3], ovr: 90 - i * 2 });
for (let i = 0; i < 6; i++) players.push({ id: 20 + i, name: 'Защитник ' + (i + 1), position: 'D', ovr: 85 - i });
for (let i = 0; i < 2; i++) players.push({ id: 30 + i, name: 'Вратарь ' + (i + 1), position: 'G', ovr: 88 - i });

const team = {
  id: 'test',
  name: 'Тестовый клуб',
  roster: players,
  bench: [],
  lines: {
    f1: { players: [1, 2, 3], chemistry: 75, style: 'balanced', role: 'top6' },
    f2: { players: [4, 5, 6], chemistry: 60, style: 'balanced', role: 'top6' },
    f3: { players: [7, 8, 9], chemistry: 50, style: 'balanced', role: 'checking' },
    f4: { players: [10, 11, 12], chemistry: 45, style: 'balanced', role: 'youth' },
    d1: { players: [20, 21], chemistry: 70, style: 'balanced', role: 'top6' },
    d2: { players: [22, 23], chemistry: 55, style: 'balanced', role: 'checking' },
    d3: { players: [24, 25], chemistry: 50, style: 'balanced', role: 'energy' },
    g1: 30,
    g2: 31,
  },
};
const sandbox = {
  G: { league: { teams: [team] }, playerTeamId: 'test' },
  initLines() {},
  syncLines() {},
  lineMods() { return { atk: 0.1, def: 0.05 }; },
  getInitials(name) { return name.split(' ').map(part => part[0]).join('').slice(0, 3); },
  LINE_STYLES: {
    balanced: { label: 'Сбалансированное' },
    aggressive: { label: 'Атакующее' },
    defensive: { label: 'Оборонительное' },
  },
  LINE_ROLES: {
    top6: { label: 'Топ-6' },
    checking: { label: 'Чек-лайн' },
    energy: { label: 'Энерджайзер' },
    youth: { label: 'Молодёжное' },
  },
};
vm.runInNewContext(functionSource + '\nglobalThis.renderLines = renderLines;', sandbox);
const html = sandbox.renderLines();

assert.strictEqual((html.match(/class="lineup-line-card/g) || []).length, 7, 'Должно быть 7 карточек полевых сочетаний');
assert.strictEqual((html.match(/class="lineup-player-select"/g) || []).length, 20, 'Должно быть 20 селекторов выбора хоккеистов');
assert.strictEqual((html.match(/class="lineup-goalie-card"/g) || []).length, 2, 'Должно быть 2 карточки вратарей');
assert(html.includes('Первое звено') && html.includes('Четвёртое звено'));
assert(html.includes('Первая пара') && html.includes('Третья пара'));
assert(html.includes('ХИМИЯ') && html.includes('СТИЛЬ ИГРЫ') && html.includes('РОЛЬ ЗВЕНА'));
assert(html.includes('setLineSlot') && html.includes('setLineRole') && html.includes('setLineStyle'));
assert((html.match(/lineup-player-rating-track/g) || []).length === 20, 'У каждого игрового места должна быть шкала рейтинга');
assert(html.includes('rating-elite') && html.includes('rating-strong') && html.includes('rating-regular'), 'Рейтинг должен получать визуальный уровень');
assert((html.match(/lineup-player-change/g) || []).length === 20, 'У каждого места должен быть подписанный контрол замены');
assert(html.includes('pos-C') && html.includes('pos-D') && html.includes('pos-G'), 'Аватары должны различаться по позиции');
console.log('Lineup render test passed: 7 lines/pairs, 2 goalies, 20 player selectors');
