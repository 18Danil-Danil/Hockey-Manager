const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = { console, Date, Map, Set, Math, Number, String, Array, Object };
context.window = context;
vm.createContext(context);
for (const file of ['data/teams.js', 'data/vhl-travel-zones.js', 'engine/league-setup.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
const teams = context.VHL_TEAMS;
assert.equal(context.VHL_TRAVEL_ZONES.zones.length, 8);
assert.equal(context.VHL_TRAVEL_ZONES.zones.reduce((sum, zone) => sum + zone.teams.length, 0), 30);
assert.equal(new Set(context.VHL_TRAVEL_ZONES.zones.flatMap(zone => zone.teams)).size, 30);
assert.equal(context.hasCompleteVhlTravelMap(teams), true);

const schedule = context.makeSchedule(teams);
assert.equal(schedule.length, 152, 'calendar contains 152 active game dates');
const meta = context.makeScheduleMeta('2026/27', schedule.length, teams);
assert.equal(meta.length, schedule.length);
assert.equal(meta[0].date, '2026-09-02');
assert.equal(meta.at(-1).date, '2027-03-18');
assert.ok(meta.some(item => item.date === '2026-12-30'));
assert.ok(meta.some(item => item.date === '2027-01-05'));
assert.ok(!meta.some(item => item.date >= '2026-12-31' && item.date <= '2027-01-04'), 'no games during the New Year shutdown');

const teamStats = new Map(teams.map(team => [team.id, { home: 0, away: 0, games: 0 }]));
const pairings = new Map();
let totalGames = 0, minGamesPerDate = Infinity, maxGamesPerDate = 0;
schedule.forEach(round => {
  const participants = new Set();
  minGamesPerDate = Math.min(minGamesPerDate, round.length);
  maxGamesPerDate = Math.max(maxGamesPerDate, round.length);
  round.forEach(([homeId, awayId]) => {
    assert.ok(!participants.has(homeId) && !participants.has(awayId), 'club cannot play twice on one date');
    participants.add(homeId); participants.add(awayId);
    teamStats.get(homeId).home++; teamStats.get(homeId).games++;
    teamStats.get(awayId).away++; teamStats.get(awayId).games++;
    const key = [homeId, awayId].sort((a, b) => a - b).join('|');
    if (!pairings.has(key)) pairings.set(key, []);
    pairings.get(key).push([homeId, awayId]); totalGames++;
  });
});
assert.equal(totalGames, 870);
assert.equal(pairings.size, 435);
for (const games of pairings.values()) {
  assert.equal(games.length, 2);
  assert.equal(games[0][0], games[1][1]);
  assert.equal(games[0][1], games[1][0]);
}
for (const stat of teamStats.values()) {
  assert.equal(stat.games, 58);
  assert.equal(stat.home, 29);
  assert.equal(stat.away, 29);
}
assert.ok(minGamesPerDate >= 3 && maxGamesPerDate <= 8);
assert.ok(meta.some(item => item.travelNote && item.travelNote.includes('Норильск — Красноярск')));
assert.ok(meta.some(item => item.phase === 'local-derby'));
assert.ok(meta.some(item => item.zoneBlocks?.length));
console.log('Zone calendar passed: ' + schedule.length + ' dates, ' + totalGames + ' matches, ' + minGamesPerDate + '-' + maxGamesPerDate + ' games/date.');

const youth = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, slug: 'youth-' + index }));
assert.equal(context.makeSchedule(youth).length, 14);
console.log('Youth schedule fallback passed.');

const oldSchedule = context.orientScheduleRounds(Array.from({ length: 58 }, () => []), teams, 0);
const unstarted = { season: '2026/27', teams, schedule: oldSchedule, scheduleVersion: 2, currentRound: 0, results: [] };
context.ensureScheduleCalendar(unstarted);
assert.equal(unstarted.scheduleVersion, 3);
assert.equal(unstarted.schedule.length, 152);
const startedSchedule = oldSchedule.map(round => round.slice());
const started = { season: '2026/27', teams, schedule: startedSchedule, scheduleVersion: 2, currentRound: 4, results: [{ round: 0 }] };
context.ensureScheduleCalendar(started);
assert.equal(started.scheduleVersion, 2);
assert.equal(started.schedule.length, 58);
console.log('Save migration compatibility passed.');
