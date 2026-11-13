/*
 * Season-to-season VHL schedule variation and save compatibility.
 * Run with: node tests/vhl-schedule-variation.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/vhl-travel-zones.js'), 'utf8'), context);
vm.runInNewContext(
  fs.readFileSync(path.join(root, 'engine/league-setup.js'), 'utf8') +
    '\nthis.scheduleApi = { makeSchedule, makeScheduleMeta, ensureScheduleCalendar };',
  context
);

const teams = context.window.VHL_TRAVEL_ZONES.zones
  .flatMap(zone => zone.teams)
  .map((slug, index) => ({ id: index + 1, slug }));
const { makeSchedule, makeScheduleMeta, ensureScheduleCalendar } = context.scheduleApi;

function validateSeasonSchedule(season) {
  const schedule = makeSchedule(teams, season);
  const meta = makeScheduleMeta(season, schedule.length, teams);
  assert.equal(schedule.length, 152, season + ': должно быть 152 игровых дня');
  assert.equal(schedule.flat().length, 870, season + ': должно быть 870 матчей');
  assert.equal(meta.length, schedule.length, season + ': метаданные должны совпадать с календарём');

  const gamesByTeam = new Map(teams.map(team => [team.id, 0]));
  const homeByTeam = new Map(teams.map(team => [team.id, 0]));
  const awayByTeam = new Map(teams.map(team => [team.id, 0]));
  const pairMeetings = new Map();

  schedule.forEach((round, roundIndex) => {
    const playing = new Set();
    round.forEach(([homeId, awayId]) => {
      assert(!playing.has(homeId), season + ': команда играет дважды в игровом дне ' + roundIndex);
      assert(!playing.has(awayId), season + ': команда играет дважды в игровом дне ' + roundIndex);
      playing.add(homeId);
      playing.add(awayId);
      gamesByTeam.set(homeId, gamesByTeam.get(homeId) + 1);
      gamesByTeam.set(awayId, gamesByTeam.get(awayId) + 1);
      homeByTeam.set(homeId, homeByTeam.get(homeId) + 1);
      awayByTeam.set(awayId, awayByTeam.get(awayId) + 1);
      const key = [homeId, awayId].sort((a, b) => a - b).join(':');
      const meetings = pairMeetings.get(key) || { total: 0, home: new Set() };
      meetings.total++;
      meetings.home.add(homeId);
      pairMeetings.set(key, meetings);
    });
  });

  for (const team of teams) {
    assert.equal(gamesByTeam.get(team.id), 58, season + ': каждая команда должна сыграть 58 матчей');
    assert.equal(homeByTeam.get(team.id), 29, season + ': должно быть 29 домашних матчей');
    assert.equal(awayByTeam.get(team.id), 29, season + ': должно быть 29 выездных матчей');
  }
  assert.equal(pairMeetings.size, 435, season + ': каждая пара клубов должна встретиться');
  for (const [key, meetings] of pairMeetings) {
    assert.equal(meetings.total, 2, season + ': пара ' + key + ' должна сыграть дважды');
    assert.equal(meetings.home.size, 2, season + ': каждая встреча должна пройти на своей площадке');
  }
  return { schedule, meta };
}

const first = validateSeasonSchedule('2026/27');
const second = validateSeasonSchedule('2027/28');
const third = validateSeasonSchedule('2028/29');
const firstAgain = validateSeasonSchedule('2026/27');
assert.equal(JSON.stringify(first.schedule), JSON.stringify(firstAgain.schedule), 'один сезон должен всегда давать одинаковый календарь');
assert.equal(JSON.stringify(first.meta), JSON.stringify(firstAgain.meta), 'метаданные сезона должны быть воспроизводимы');
assert.notEqual(JSON.stringify(first.schedule), JSON.stringify(second.schedule), 'между соседними сезонами порядок серий должен меняться');
assert.notEqual(JSON.stringify(second.schedule), JSON.stringify(third.schedule), 'вариативность должна сохраняться в следующих сезонах');

// Обновление версии не должно перестраивать уже начавшийся сезон.
const startedSchedule = JSON.stringify(first.schedule);
const startedLeague = {
  teams, season: '2026/27', schedule: first.schedule, scheduleMeta: first.meta,
  scheduleVersion: 3, currentRound: 12, results: [{}],
};
ensureScheduleCalendar(startedLeague);
assert.equal(startedLeague.scheduleVersion, 4);
assert.equal(JSON.stringify(startedLeague.schedule), startedSchedule, 'расписание начавшегося сезона нельзя менять');

// Не начавшееся старое сохранение безопасно получает календарь новой версии.
const unstartedLeague = {
  teams, season: '2026/27', schedule: second.schedule, scheduleMeta: second.meta,
  scheduleVersion: 3, currentRound: 0, results: [],
};
ensureScheduleCalendar(unstartedLeague);
assert.equal(unstartedLeague.scheduleVersion, 4);
assert.equal(JSON.stringify(unstartedLeague.schedule), startedSchedule, 'до первого матча календарь обновляется для текущего сезона');

console.log('VHL schedule variation and compatibility checks passed.');
