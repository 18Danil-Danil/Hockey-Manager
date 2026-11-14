const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'locker-room.js'), 'utf8');
let nextId = 100;
const messages = [], news = [], toasts = [];
const player = (id, morale = 40) => ({
  id, name: 'Хоккеист ' + id, position: 'C', age: 25, morale, form: 45,
  fatigue: 35, character: 'leader', stats: { gp: 10, points: 8 }
});
const p1 = player(1, 40);
const p2 = player(2, 70);
const team = {
  id: 7, name: 'Тестовый клуб', roster: [p1, p2], bench: [],
  staff: { psychologist: { level: 2 } },
  finance: { balance: 10, expenses: { operations: 0 } }
};
const context = {
  G: { playerTeamId: 7, league: { teams: [team], currentRound: 0, season: '2026/27' } },
  nextId: () => nextId++,
  addInboxMessage: (...args) => { messages.push(args); },
  addNews: (...args) => { news.push(args); },
  showToast: (...args) => { toasts.push(args); },
  render: () => {},
  saveGame: () => Promise.resolve(true)
};
vm.createContext(context);
vm.runInContext(source, context);

let result = context.talkToPlayer(1, 'support');
assert.equal(result.success, true);
assert.equal(p1.morale, 47, 'support should improve low morale, including leader bonus');
assert.equal(context.talkToPlayer(1, 'praise').reason, 'cooldown', 'repeated personal talks must be limited');
assert.equal(messages.length, 1);

context.G.league.currentRound = 3;
result = context.schedulePlayerMeeting(1, 'praise', 1);
assert.equal(result.success, true);
assert.equal(result.meeting.scheduledRound, 4);
assert.equal(context.schedulePlayerMeeting(1, 'role', 1).success, false, 'only one pending meeting per player');
assert.equal(context.talkToPlayer(1, 'role').reason, 'meeting-scheduled', 'direct talks cannot bypass a scheduled meeting');

context.G.league.currentRound = 4;
const completed = context.processLockerRoomMeetings(team);
assert.equal(completed.length, 1);
assert.equal(completed[0].status, 'completed');
assert.equal(p1.morale, 52, 'praise should improve morale for a player in good form');
assert.equal(team.lockerRoom.meetingHistory.length, 1);
assert.equal(team.lockerRoom.meetings.length, 0);
assert.ok(messages.some(message => message[2] === 'Личная встреча состоялась'));

result = context.holdLockerRoomEvent('meeting');
assert.equal(result.success, true);
assert.equal(p1.morale, 54);
assert.equal(p2.morale, 72);
assert.equal(context.holdLockerRoomEvent('dinner').success, false, 'team activities must share a cooldown');
assert.equal(team.finance.balance, 10, 'free team meeting must not cost money');

context.G.league.currentRound = 10;
result = context.holdLockerRoomEvent('dinner');
assert.equal(result.success, true);
assert.equal(team.finance.balance, 8.5);
assert.equal(team.finance.expenses.operations, 1.5);
assert.equal(p1.fatigue, 33);
assert.equal(team.lockerRoom.eventHistory.length, 2);

context.G.league.currentRound = 20;
team.staff.psychologist = null;
assert.match(context.holdLockerRoomEvent('psychologist').message, /психолог/);
assert.equal(context.holdLockerRoomEvent('psychologist').success, false, 'psychologist event requires a psychologist');

console.log('Locker room talks, meetings and team events checks passed.');
