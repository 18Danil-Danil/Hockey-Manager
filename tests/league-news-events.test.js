const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/random-events.js'), 'utf8');
const team = (id, name) => ({
  id, name,
  roster: [
    { id: id * 10 + 1, name: name + ' Игрок 1', age: 20, morale: 60, form: 60, fatigue: 20 },
    { id: id * 10 + 2, name: name + ' Игрок 2', age: 25, morale: 60, form: 60, fatigue: 30 },
  ],
  staff: {},
  finance: { balance: 20, fanBase: 0.5, expenses: { operations: 0 }, income: { sponsorBonuses: 0 } },
});

let randomValue = 0.1;
const news = [];
const inbox = [];
const G = { playerTeamId: 1, league: { season: '2026/27', currentRound: 4, teams: [team(1, 'Рязань'), team(2, 'Химик')] } };
const context = {
  G,
  clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
  rng: () => randomValue,
  pick: items => items[0],
  pickWeighted: items => items[0],
  addNews: (type, text, importance) => news.push({ type, text, importance }),
  addInboxMessage: (...args) => inbox.push(args),
};
vm.runInNewContext(source + '\nthis.api = { RANDOM_EVENTS, generateRandomEvent, generateLeagueMatchNews };', context);
const { RANDOM_EVENTS, generateRandomEvent, generateLeagueMatchNews } = context.api;

assert(RANDOM_EVENTS.length >= 17, 'В пуле должно быть не менее 17 событий клуба');
const playerTeam = G.league.teams[0];
const meeting = RANDOM_EVENTS.find(event => event.key === 'team_meeting');
const beforeMorale = playerTeam.roster[0].morale;
meeting.apply(playerTeam);
assert.strictEqual(playerTeam.roster[0].morale, beforeMorale + 2);

const community = RANDOM_EVENTS.find(event => event.key === 'community_day');
const beforeBalance = playerTeam.finance.balance;
const beforeFanBase = playerTeam.finance.fanBase;
community.apply(playerTeam);
assert.strictEqual(playerTeam.finance.balance, beforeBalance - 1.5);
assert(playerTeam.finance.fanBase > beforeFanBase);

const recovery = RANDOM_EVENTS.find(event => event.key === 'recovery_day');
playerTeam.roster[0].fatigue = 25;
recovery.apply(playerTeam);
assert.strictEqual(playerTeam.roster[0].fatigue, 19);

generateRandomEvent();
assert(news[0].text.includes('Рязань') && !news[0].text.includes('fans'), 'Заголовок клубной новости должен быть понятным');
assert.strictEqual(inbox.length, 1);

news.length = 0;
inbox.length = 0;
randomValue = 0.9;
generateRandomEvent();
assert(news[0].text.includes('Химик') && !news[0].text.includes('fans'), 'AI-событие должно публиковаться понятным заголовком');
assert.strictEqual(inbox.length, 0);

news.length = 0;
generateLeagueMatchNews([
  { homeId: 1, awayId: 2, hg: 0, ag: 3, ot: false },
  { homeId: 1, awayId: 2, hg: 5, ag: 6, ot: true },
  { homeId: 1, awayId: 2, hg: 1, ag: 6, ot: false },
]);
assert.strictEqual(news.length, 2, 'Не более двух заметок за игровой день');
assert.strictEqual(news[0].type, 'shutout');
assert.strictEqual(news[1].type, 'high_scoring');
news.length = 0;
generateLeagueMatchNews([{ homeId: 1, awayId: 2, hg: 4, ag: 3, ot: true }]);
assert.strictEqual(news[0].type, 'overtime');

console.log('League news and club events checks passed.');
