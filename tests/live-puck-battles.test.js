/*
 * LIVE puck-battle regression checks.
 * Run with: node tests/live-puck-battles.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');
const start = source.indexOf('function getLiveDuelRating(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE puck-battle helpers');
const helpers = source.slice(start, end);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makePlayer(id, attrs = {}) {
  return {
    id, name: id, position: 'F', ovr: 60,
    attrs: { skating: 50, shooting: 50, passing: 50, defense: 50, physical: 50, iq: 50, ...attrs },
    stats: null, playoffStats: null,
  };
}
const homeCarrier = makePlayer('home-carrier');
const awayChallenger = makePlayer('away-challenger');
const homeGoalie = { id: 'hg', position: 'G' };
const awayGoalie = { id: 'ag', position: 'G' };
const makeSlot = (player, index) => ({
  idx: index, playerId: player.id, playerName: player.name,
  onIce: true, stamina: 100, x: 50 + index * 5, y: 50,
});
const homeSlots = [{ role: 'goalie', playerId: homeGoalie.id, onIce: true },
  makeSlot(homeCarrier, 1)];
const awaySlots = [{ role: 'goalie', playerId: awayGoalie.id, onIce: true },
  makeSlot(awayChallenger, 1)];
const statsFor = player => {
  if (!player.stats) player.stats = {};
  return player.stats;
};
const events = [];
const lm = {
  homeId: 'home', awayId: 'away', period: 1, timeLeft: 900, totalSecPlayed: 300,
  isFinished: false, isBreak: false, isPlayoff: false,
  homeLineup: { skaters: [homeCarrier] }, awayLineup: { skaters: [awayChallenger] },
  positions: {
    home: homeSlots, away: awaySlots,
    puck: { x: 100, y: 50, possessionSide: 'home', carrierIndex: 1 },
  },
  gameplayPossession: { side: 'home', playerId: homeCarrier.id },
  playerStamina: { home: { [homeCarrier.id]: 100 }, away: { [awayChallenger.id]: 100 } },
  puckBattleStats: {
    home: { won: 0, lost: 0, takeaways: 0 },
    away: { won: 0, lost: 0, takeaways: 0 },
  },
};
const G = { league: { teams: [
  { id: 'home', tactics: { pressure: 50, forecheck: 50, physical: 50 } },
  { id: 'away', tactics: { pressure: 50, forecheck: 50, physical: 50 } },
] } };
let rolls = [0, 0, 0];
const rng = () => rolls.shift() ?? 0.99;
const helpersApi = new Function(
  'G', 'rng', 'clamp', 'ensureStats', 'ensurePlayoffStats', 'livePushEvent', 'liveFmtTime',
  helpers + '; return { getLiveDuelRating, resolveLivePuckBattle };'
)(G, rng, clamp, statsFor, statsFor,
  event => events.push(event), seconds => String(seconds));

assert.ok(helpersApi.resolveLivePuckBattle(lm), 'expected a puck battle to occur');
assert.equal(lm.gameplayPossession.side, 'away', 'defender should gain possession on a successful takeaway');
assert.equal(lm.gameplayPossession.playerId, awayChallenger.id);
assert.equal(lm.puckBattleStats.home.lost, 1);
assert.equal(lm.puckBattleStats.away.won, 1);
assert.equal(lm.puckBattleStats.away.takeaways, 1);
assert.equal(homeCarrier.stats.puckBattlesLost, 1);
assert.equal(awayChallenger.stats.puckBattlesWon, 1);
assert.equal(awayChallenger.stats.takeaways, 1);
assert.equal(events.length, 1);
assert.equal(events[0].type, 'puck_battle');
assert.equal(events[0].takeaway, true);
assert.equal(lm.positions.puck.nextPossessionSide, 'away',
  'visual puck should follow the gameplay winner, not roll a second winner');

const freshLm = {
  ...lm,
  gameplayPossession: { side: 'home', playerId: homeCarrier.id },
  puckBattleStats: {
    home: { won: 0, lost: 0, takeaways: 0 },
    away: { won: 0, lost: 0, takeaways: 0 },
  },
  positions: {
    home: homeSlots, away: awaySlots,
    puck: { x: 100, y: 50, possessionSide: 'home', carrierIndex: 1 },
  },
};
rolls = [0, 0, 0.99];
assert.ok(helpersApi.resolveLivePuckBattle(freshLm));
assert.equal(freshLm.gameplayPossession.side, 'home',
  'carrier should retain possession when the challenger loses the contest');
assert.equal(freshLm.puckBattleStats.home.won, 1);
assert.equal(freshLm.puckBattleStats.away.lost, 1);

const freshPlayer = makePlayer('fresh');
const tiredPlayer = makePlayer('tired');
const freshRating = helpersApi.getLiveDuelRating(freshPlayer, 'carrier', 100);
const tiredRating = helpersApi.getLiveDuelRating(tiredPlayer, 'carrier', 20);
assert.ok(freshRating > tiredRating, 'fatigue must reduce a player\'s duel effectiveness');

const strongDefender = makePlayer('strong', { physical: 99, defense: 99, iq: 90 });
const weakCarrier = makePlayer('weak', { physical: 40, defense: 40, iq: 40, passing: 40 });
assert.ok(
  helpersApi.getLiveDuelRating(strongDefender, 'defender', 100)
    > helpersApi.getLiveDuelRating(weakCarrier, 'carrier', 100),
  'defensive attributes should materially affect puck-battle strength'
);

console.log('LIVE puck-battle checks passed.');
