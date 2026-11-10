/*
 * Player name pool and uniqueness regression checks.
 * Run with: node tests/player-name-generation.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerDataSource = fs.readFileSync(path.join(__dirname, '..', 'data/player-data.js'), 'utf8');
const poolsSource = fs.readFileSync(path.join(__dirname, '..', 'data/player-name-pools.js'), 'utf8');
const generationSource = fs.readFileSync(path.join(__dirname, '..', 'data/player-generation.js'), 'utf8');
new Function(playerDataSource);
new Function(poolsSource);
new Function(generationSource);

const windowStub = {};
new Function('window', playerDataSource)(windowStub);
new Function('window', poolsSource)(windowStub);

const randInt = min => min;
const pick = values => values[0];
const api = new Function(
  'window', 'FIRST', 'LAST', 'randInt', 'pick',
  generationSource + '; return { normalizePlayerNameKey, resetPlayerNameRegistry, hydratePlayerNameRegistry, generatePlayerName };'
)(windowStub, windowStub.PLAYER_DATA.FIRST, windowStub.PLAYER_DATA.LAST, randInt, pick);

const pools = windowStub.PLAYER_DATA.NAME_POOLS;
assert.equal(Object.keys(pools).length, 20, 'all 20 nationality pools should remain available');
for (const [nationality, pool] of Object.entries(pools)) {
  assert.ok(pool.first.length >= 20, `${nationality}: too few first names`);
  assert.ok(pool.last.length >= 20, `${nationality}: too few surnames`);
  assert.equal(new Set(pool.first).size, pool.first.length, `${nationality}: duplicate first names`);
  assert.equal(new Set(pool.last).size, pool.last.length, `${nationality}: duplicate surnames`);
}
const latinEntries = Object.entries(pools).flatMap(([nationality, pool]) =>
  [...pool.first, ...pool.last].filter(name => /[A-Za-z]/.test(name)).map(name => nationality + ': ' + name)
);
assert.deepEqual(latinEntries, [], 'name pools must use consistent Cyrillic spelling');

api.resetPlayerNameRegistry();
const russianNames = Array.from({ length: 1000 }, () => api.generatePlayerName('Россия'));
assert.equal(new Set(russianNames.map(api.normalizePlayerNameKey)).size, 1000,
  'newly generated Russian full names must be unique');

const save = {
  teams: [{ roster: [
    { name: 'Александр Иванов', position: 'C', nationality: 'Россия', attrs: {} },
    { name: 'Пётр Петров', position: 'D', nationality: 'Россия', attrs: {} },
  ] }],
  freeAgents: [{ name: 'Джек Смит', position: 'LW', nationality: 'Канада', attrs: {} }],
  youth: { leagues: { MHL: { teams: [{ roster: [
    { name: 'Александр Иванов', position: 'G', nationality: 'Россия', attrs: {} },
  ] }] } } },
};
const originalNames = [
  save.teams[0].roster[0].name,
  save.teams[0].roster[1].name,
  save.freeAgents[0].name,
  save.youth.leagues.MHL.teams[0].roster[0].name,
];
const reservedCount = api.hydratePlayerNameRegistry(save);
assert.equal(reservedCount, 3, 'existing duplicate names should occupy one registry entry');
assert.deepEqual([
  save.teams[0].roster[0].name,
  save.teams[0].roster[1].name,
  save.freeAgents[0].name,
  save.youth.leagues.MHL.teams[0].roster[0].name,
], originalNames, 'hydration must not rename existing saved players');
const nextName = api.generatePlayerName('Россия');
assert.ok(!originalNames.includes(nextName), 'new player name must not collide with a saved player');

console.log('Player name pool and uniqueness checks passed.');
