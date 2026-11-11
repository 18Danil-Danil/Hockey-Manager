const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = { Date, Map, Math, Number, String, Array, Object };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'engine/league-setup.js'), 'utf8'), context);

function legacySchedule(teams) {
  const arr = teams.slice();
  const single = [];
  for (let r = 0; r < teams.length - 1; r++) {
    const round = [];
    for (let i = 0; i < Math.floor(teams.length / 2); i++) {
      const a = arr[i], b = arr[teams.length - 1 - i];
      round.push(r % 2 === 0 ? [a.id, b.id] : [b.id, a.id]);
    }
    single.push(round);
    arr.splice(1, 0, arr.pop());
  }
  return [...single, ...single.map(round => round.map(([home, away]) => [away, home]))];
}

function auditSchedule(teams, schedule) {
  const teamStats = new Map(teams.map(team => [team.id, { home: 0, away: 0, sequence: [] }]));
  const pairings = new Map();
  schedule.forEach((round, roundIndex) => {
    const participants = new Set();
    round.forEach(([homeId, awayId]) => {
      assert.ok(!participants.has(homeId) && !participants.has(awayId), 'a club cannot play twice on one game day');
      participants.add(homeId);
      participants.add(awayId);
      const key = [String(homeId), String(awayId)].sort().join('|');
      pairings.set(key, (pairings.get(key) || 0) + 1);
      teamStats.get(homeId).home++;
      teamStats.get(homeId).sequence.push('H');
      teamStats.get(awayId).away++;
      teamStats.get(awayId).sequence.push('A');
    });
    if (teams.length % 2 === 0) assert.equal(participants.size, teams.length, 'all clubs play each scheduled game day');
  });

  let maxVenueStreak = 0;
  let maxHomeAwayDifference = 0;
  for (const stat of teamStats.values()) {
    assert.equal(stat.sequence.length, schedule.length, 'each club plays once per round');
    maxHomeAwayDifference = Math.max(maxHomeAwayDifference, Math.abs(stat.home - stat.away));
    let last = '';
    let streak = 0;
    for (const side of stat.sequence) {
      streak = side === last ? streak + 1 : 1;
      last = side;
      maxVenueStreak = Math.max(maxVenueStreak, streak);
    }
  }
  assert.equal(pairings.size, teams.length * (teams.length - 1) / 2, 'every opponent pair appears');
  for (const count of pairings.values()) assert.equal(count, 2, 'each opponent pair meets home and away');
  assert.ok(maxHomeAwayDifference <= 2, 'home/away balance differs by no more than two games');
  assert.ok(maxVenueStreak <= 4, 'home or away series never exceed four consecutive games');
  return { maxVenueStreak, maxHomeAwayDifference };
}

for (const count of [30, 34, 26]) {
  const teams = Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
  const schedule = context.makeSchedule(teams);
  assert.equal(schedule.length, 2 * (count - 1));
  const audit = auditSchedule(teams, schedule);
  const meta = context.makeScheduleMeta('2027/28', schedule.length);
  assert.equal(meta.length, schedule.length);
  assert.equal(meta[0].date, '2027-09-05');
  for (let i = 1; i < meta.length; i++) {
    const gap = (Date.parse(meta[i].date + 'T00:00:00Z') - Date.parse(meta[i - 1].date + 'T00:00:00Z')) / 86400000;
    assert.ok(gap >= 3 && gap <= 9, 'rest days are scheduled between game days');
  }
  assert.ok(meta.some(item => item.date.startsWith('2028-01-')), 'calendar crosses into the next year');
  console.log(`${count}-club schedule passed: ${schedule.length} rounds, max venue streak ${audit.maxVenueStreak}, home/away difference ${audit.maxHomeAwayDifference}, final date ${meta.at(-1).date}`);
}

// Existing careers: preserve played rounds and opponent pairings; only future venues may change.
const teams = Array.from({ length: 30 }, (_, index) => ({ id: index + 1 }));
const oldSchedule = legacySchedule(teams);
const completedRounds = 6;
const migrated = context.orientScheduleRounds(oldSchedule, teams, completedRounds);
for (let i = 0; i < completedRounds; i++) assert.deepEqual(migrated[i], oldSchedule[i], 'played fixtures remain untouched');
for (let i = completedRounds; i < oldSchedule.length; i++) {
  const before = oldSchedule[i].map(([h, a]) => [String(h), String(a)].sort().join('|')).sort();
  const after = migrated[i].map(([h, a]) => [String(h), String(a)].sort().join('|')).sort();
  assert.deepEqual(after, before, 'future opponents remain unchanged');
}
const legacyLeague = { season: '2026/27', teams, schedule: oldSchedule, currentRound: completedRounds };
const meta = context.ensureScheduleCalendar(legacyLeague);
assert.equal(legacyLeague.scheduleVersion, 2);
assert.equal(meta.length, oldSchedule.length);
assert.equal(legacyLeague.scheduleMeta[0].date, '2026-09-05');
assert.deepEqual(legacyLeague.schedule.slice(0, completedRounds), oldSchedule.slice(0, completedRounds));
console.log('Legacy career calendar migration passed.');
