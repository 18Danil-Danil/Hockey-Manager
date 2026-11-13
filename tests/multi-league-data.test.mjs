import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = vm.createContext({ window });
for (const path of [
  'data/international-leagues.js',
  'data/league-registry.js',
  'data/international-player-stats.js'
]) {
  const source = fs.readFileSync(path, 'utf8');
  new vm.Script(source, { filename: path }).runInContext(context);
}

const leagues = window.INTERNATIONAL_LEAGUES;
const registry = window.HOCKEY_LEAGUE_REGISTRY;
const stats = window.INTERNATIONAL_PLAYER_STATS_DATA;
assert.ok(Array.isArray(leagues), 'international leagues must be an array');
assert.ok(Array.isArray(stats.players), 'international player data must be an array');
assert.equal(registry.schemaVersion, 1);
assert.equal(stats.players.length, 202, 'all current international records must be loaded');
assert.equal(stats.players.filter(item => item.league === 'kazakhstan').length, 77);
assert.equal(stats.players.filter(item => item.league === 'belarus').length, 92);
assert.equal(stats.players.filter(item => item.league === 'khl').length, 33);
assert.equal(new Set(stats.players.map(item => item.key)).size, stats.players.length, 'all player keys must be unique');

const leagueIds = leagues.map(item => item.id);
assert.equal(new Set(leagueIds).size, leagueIds.length, 'league ids must be unique');
const khl = leagues.find(item => item.id === 'khl');
assert.ok(khl, 'KHL must be present in international leagues');
assert.equal(khl.clubs.length, 22, 'KHL should include all 22 current clubs');

const khlPlayers = stats.players.filter(item => item.league === 'khl');
assert.equal(khlPlayers.length, 33, 'KHL should contain the verified player snapshot');
assert.equal(new Set(khlPlayers.map(item => item.key)).size, khlPlayers.length, 'KHL player keys must be unique');
const khlClubIds = new Set(khl.clubs.map(item => item.id));
for (const player of khlPlayers) {
  assert.ok(khlClubIds.has(player.club), player.name + ' must point to a known KHL club');
  assert.ok(player.name && player.gp > 0 && player.statsSource, 'KHL records need a name, games and source');
  assert.ok(['C','D','G'].includes(player.position), 'KHL position must be normalized');
  if (player.position === 'G') {
    assert.ok(Number.isFinite(player.svPct) && Number.isFinite(player.gaa), 'goalies need SV% and GAA');
  } else {
    assert.ok(Number.isFinite(player.g) && Number.isFinite(player.a), 'skaters need goals and assists');
  }
}
for (const id of ['vhl','khl','belarus','kazakhstan','nhl','ahl','mhl','shl','liiga','del','czech-extraliga','swiss-nl','slovakia-extraliga','echl']) {
  assert.ok(registry.leagues.some(item => item.id === id), 'registry missing ' + id);
}
for (const id of ['vhl','khl','belarus','kazakhstan']) {
  assert.equal(registry.leagues.find(item => item.id === id).status, 'active', id + ' should be active');
}
const html = fs.readFileSync('index.html', 'utf8');
const registryPosition = html.indexOf('data/league-registry.js');
const statsPosition = html.indexOf('data/international-player-stats.js');
assert.ok(registryPosition >= 0 && statsPosition > registryPosition, 'league registry must load before player data');
const vhlImporter = fs.readFileSync('tools/vhl-player-stats-sync.mjs', 'utf8');
assert.ok(vhlImporter.includes('const historyTarget = Math.max(500, rosterPlayers.size);'),
  'VHL career history must cover all current roster players');

console.log('OK: ' + leagues.length + ' configured international leagues; ' +
  khl.clubs.length + ' KHL clubs; ' + khlPlayers.length + ' verified KHL player records; ' +
  stats.players.length + ' international player records total.');
