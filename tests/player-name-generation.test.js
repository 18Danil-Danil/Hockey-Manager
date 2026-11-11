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
  generationSource + '; return { normalizePlayerNameKey, resetPlayerNameRegistry, hydratePlayerNameRegistry, generatePlayerName, getPlayerNamePartWeight };'
)(windowStub, windowStub.PLAYER_DATA.FIRST, windowStub.PLAYER_DATA.LAST, randInt, pick);

const pools = windowStub.PLAYER_DATA.NAME_POOLS;
assert.equal(Object.keys(pools).length, 20, 'all 20 nationality pools should remain available');
const russianSurnames = pools['Россия'].last;
const normalizedSurnameKey = value => value.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
assert.equal(russianSurnames.length, 700, 'Russian surname pool should contain exactly 700 entries');
assert.equal(pools['Россия'].first.length, 196, 'Russian first-name pool should contain 196 unique entries');
assert.equal(new Set(russianSurnames.map(normalizedSurnameKey)).size, 700,
  'Russian surnames must be unique after ё/е normalization');
for (const [nationality, pool] of Object.entries(pools)) {
  assert.ok(pool.first.length >= 20, `${nationality}: too few first names`);
  assert.ok(pool.last.length >= 20, `${nationality}: too few surnames`);
  assert.equal(new Set(pool.first.map(normalizedSurnameKey)).size, pool.first.length, `${nationality}: duplicate first names after normalization`);
  assert.equal(new Set(pool.last.map(normalizedSurnameKey)).size, pool.last.length, `${nationality}: duplicate surnames after normalization`);
}
const latinEntries = Object.entries(pools).flatMap(([nationality, pool]) =>
  [...pool.first, ...pool.last].filter(name => /[A-Za-z]/.test(name)).map(name => nationality + ': ' + name)
);
assert.deepEqual(latinEntries, [], 'name pools must use consistent Cyrillic spelling');

const frequency = windowStub.PLAYER_NAME_FREQUENCY;
assert.ok(frequency && Object.keys(frequency).length === 20, 'frequency profiles should cover all 20 nationalities');
for (const [nationality, profile] of Object.entries(frequency)) {
  for (const kind of ['first', 'last']) {
    const poolValues = pools[nationality][kind];
    for (const item of [...(profile[kind]?.common || []), ...(profile[kind]?.rare || [])]) {
      assert.ok(poolValues.some(value => normalizedSurnameKey(value) === normalizedSurnameKey(item)),
        `${nationality}: frequency profile contains a name absent from its pool: ${item}`);
    }
  }
}
assert.ok(api.getPlayerNamePartWeight('Россия', 'first', 'Александр') >
  api.getPlayerNamePartWeight('Россия', 'first', 'Антип'),
  'common Russian first names should outweigh rare archaic names');
assert.equal(api.getPlayerNamePartWeight('Россия', 'first', 'Кузьма'), 1,
  'Kuzma should be classified as a very rare first name');
assert.equal(api.getPlayerNamePartWeight('Россия', 'first', 'Варфоломей'), 1,
  'Varfolomey should be classified as a very rare first name');
assert.equal(api.getPlayerNamePartWeight('Россия', 'first', 'Александр'), 500,
  'common first names should have a strong selection weight');
assert.equal(api.getPlayerNamePartWeight('Россия', 'first', 'Аким'), 25,
  'unclassified first names should have a restrained ordinary weight');
assert.ok(api.getPlayerNamePartWeight('Россия', 'last', 'Иванов') >
  api.getPlayerNamePartWeight('Россия', 'last', 'Ястребов'),
  'common Russian surnames should outweigh ordinary surnames');

let seed = 20261110;
const seededRandInt = (min, max = min) => {
  seed = (seed * 48271) % 2147483647;
  return min + (seed % (max - min + 1));
};
const weightedApi = new Function(
  'window', 'FIRST', 'LAST', 'randInt', 'pick',
  generationSource + '; return { resetPlayerNameRegistry, generatePlayerName };'
)(windowStub, windowStub.PLAYER_DATA.FIRST, windowStub.PLAYER_DATA.LAST, seededRandInt, pick);
weightedApi.resetPlayerNameRegistry();
const sample = Array.from({ length: 3000 }, () => weightedApi.generatePlayerName('Россия'));
const sampleFirstNames = sample.map(name => name.split(' ')[0]);
const rareRussian = new Set(frequency['Россия'].first.rare.map(normalizedSurnameKey));
const commonRussian = new Set(frequency['Россия'].first.common.map(normalizedSurnameKey));
const rareRate = sampleFirstNames.filter(name => rareRussian.has(normalizedSurnameKey(name))).length / sample.length;
const commonRate = sampleFirstNames.filter(name => commonRussian.has(normalizedSurnameKey(name))).length / sample.length;
assert.ok(rareRate < 0.015, `very rare archaic names should stay below 1.5% (observed ${rareRate})`);
assert.ok(commonRate > 0.70, `common names should dominate the generated pool (observed ${commonRate})`);
assert.ok(commonRate > rareRate * 20, `common names should vastly outnumber very rare names (common ${commonRate}, rare ${rareRate})`);

api.resetPlayerNameRegistry();
const russianNames = Array.from({ length: 1900 }, () => api.generatePlayerName('Россия'));
assert.equal(new Set(russianNames.map(api.normalizePlayerNameKey)).size, 1900,
  'newly generated Russian full names must be unique');

const save = {
  teams: [{ roster: [
    { name: 'Александр Иванов', position: 'C', nationality: 'Россия', attrs: {} },
    { name: 'Пётр Петров', position: 'D', nationality: 'Россия', attrs: {} },
  ] }],
  freeAgents: [{ name: 'Джек Смит', position: 'LW', nationality: 'Канада', attrs: {} }],
  youth: { leagues: { MHL: { teams: [{ roster: [
    { name: 'Александр Иванов', position: 'G', nationality: 'Россия' },
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
