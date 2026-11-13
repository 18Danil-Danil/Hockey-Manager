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
  new vm.Script(fs.readFileSync(path, 'utf8'), { filename: path }).runInContext(context);
}

const leagues = window.INTERNATIONAL_LEAGUES;
const registry = window.HOCKEY_LEAGUE_REGISTRY;
const stats = window.INTERNATIONAL_PLAYER_STATS_DATA;
assert.ok(Array.isArray(leagues), 'international leagues must be an array');
assert.ok(Array.isArray(stats.players), 'international player data must be an array');
assert.equal(registry.schemaVersion, 1);
assert.equal(stats.players.length, 357, 'all verified international player records must be loaded');
assert.equal(new Set(stats.players.map(item => item.key)).size, stats.players.length, 'player keys must be unique');

const expectedCounts = {
  kazakhstan: 83,
  belarus: 101,
  khl: 65,
  'finland-liiga': 22,
  'sweden-shl': 22,
  'czech-extraliga': 9,
  'germany-del': 11,
  'switzerland-nl': 22,
  'slovakia-extraliga': 22
};
for (const [leagueId, count] of Object.entries(expectedCounts)) {
  assert.equal(stats.players.filter(item => item.league === leagueId).length, count,
    leagueId + ' player count mismatch');
}
assert.equal(new Set(leagues.map(item => item.id)).size, leagues.length, 'league ids must be unique');
const leagueById = new Map(leagues.map(item => [item.id, item]));
for (const player of stats.players) {
  const league = leagueById.get(player.league);
  assert.ok(league, player.name + ' references an unknown league: ' + player.league);
  assert.ok(league.clubs.some(club => club.id === player.club),
    player.name + ' references an unknown club: ' + player.club);
  assert.ok(player.name && Number(player.gp) > 0, 'player needs a name and games played');
  if (player.position === 'G') {
    assert.ok(Number.isFinite(Number(player.svPct)) && Number.isFinite(Number(player.gaa)),
      player.name + ' needs goalie SV% and GAA');
  } else {
    assert.ok(Number.isFinite(Number(player.g)) && Number.isFinite(Number(player.a)),
      player.name + ' needs goals and assists');
  }
}

const khl = leagueById.get('khl');
assert.ok(khl, 'KHL must be present');
assert.equal(khl.clubs.length, 22, 'KHL should include all 22 current clubs');
const khlPlayers = stats.players.filter(item => item.league === 'khl');
assert.equal(khlPlayers.length, 65, 'KHL should contain 65 verified player records');
assert.equal(stats.players.filter(item => item.league === 'finland-liiga' && item.position === 'G').length, 10);
assert.equal(stats.players.filter(item => item.league === 'sweden-shl' && item.position === 'G').length, 10);
assert.equal(stats.players.filter(item => item.league === 'czech-extraliga' && item.position === 'G').length, 4);
assert.equal(stats.players.filter(item => item.league === 'germany-del' && item.position === 'G').length, 10);
assert.equal(stats.players.filter(item => item.league === 'switzerland-nl' && item.position === 'G').length, 10);
assert.equal(stats.players.filter(item => item.league === 'slovakia-extraliga' && item.position === 'G').length, 10);
for (const player of khlPlayers) {
  assert.ok(player.statsSource, player.name + ' needs a traceable source');
}

const activeIds = ['vhl','khl','belarus','kazakhstan','nhl','ahl','mhl','shl','liiga','del','czech-extraliga','swiss-nl','slovakia-extraliga','echl'];
for (const id of activeIds) {
  assert.ok(registry.leagues.some(item => item.id === id), 'registry missing ' + id);
}
for (const id of ['vhl','khl','belarus','kazakhstan','shl','liiga','del','czech-extraliga','swiss-nl','slovakia-extraliga']) {
  assert.equal(registry.leagues.find(item => item.id === id).status, 'active', id + ' should be active');
}

const html = fs.readFileSync('index.html', 'utf8');
const registryPosition = html.indexOf('data/league-registry.js');
const statsPosition = html.indexOf('data/international-player-stats.js');
assert.ok(registryPosition >= 0 && statsPosition > registryPosition, 'league registry must load before player data');
const vhlImporter = fs.readFileSync('tools/vhl-player-stats-sync.mjs', 'utf8');
assert.ok(vhlImporter.includes('const missingRosterHistory = [...rosterPlayers.keys()]'),
  'VHL importer must verify career-history coverage for every current roster player');

console.log('OK: ' + stats.players.length + ' real international player records across '
  new Set(stats.players.map(item => item.league)).size + ' leagues; KHL ' + khl.clubs.length +
  ' clubs / ' + khlPlayers.length + ' players; all club references valid.');
