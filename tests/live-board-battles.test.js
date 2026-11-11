/*
 * LIVE board-battle regression checks.
 * Run with: node tests/live-board-battles.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function getLiveDuelRating(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE board-battle helpers');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [0, 0];
const rng = () => rolls.shift() ?? 0.99;
const makePlayer = (id, attrs = {}) => ({
  id, name: id, ovr: 60,
  attrs: { physical: 50, defense: 50, skating: 50, passing: 50, iq: 50, ...attrs },
});
const carrier = makePlayer('carrier', { physical: 45, defense: 45 });
const nearestDefender = makePlayer('nearest-defender', { physical: 95, defense: 90 });
const distantDefender = makePlayer('distant-defender', { physical: 50, defense: 50 });
const events = [];
const statsFor = player => (player.stats ||= {});
const G = { league: { teams: [
  { id: 'home', tactics: { pressure: 50, forecheck: 50, physical: 50 } },
  { id: 'away', tactics: { pressure: 50, forecheck: 50, physical: 90 } },
] } };
const api = new Function(
  'G', 'rng', 'clamp', 'ensureStats', 'ensurePlayoffStats', 'livePushEvent', 'liveFmtTime',
  source.slice(start, end) + '; return { getLiveDuelRating, resolveLivePuckBattle };'
)(G, rng, clamp, statsFor, statsFor, event => events.push(event), () => '08:00');

const lm = {
  homeId: 'home', awayId: 'away', period: 2, timeLeft: 480, totalSecPlayed: 720,
  isFinished: false, isBreak: false, isPlayoff: false,
  homeLineup: { skaters: [carrier] },
  awayLineup: { skaters: [nearestDefender, distantDefender] },
  positions: {
    home: [
      { role: 'goalie', playerId: 'home-goalie', onIce: true },
      { role: 'F', playerId: carrier.id, onIce: true, x: 80, y: 12 },
    ],
    away: [
      { role: 'goalie', playerId: 'away-goalie', onIce: true },
      { role: 'D', playerId: nearestDefender.id, onIce: true, x: 82, y: 13 },
      { role: 'D', playerId: distantDefender.id, onIce: true, x: 125, y: 55 },
    ],
    puck: { x: 80, y: 12, possessionSide: 'home', carrierIndex: 1 },
  },
  gameplayPossession: { side: 'home', playerId: carrier.id },
  playerStamina: { home: { carrier: 90 }, away: { [nearestDefender.id]: 95, [distantDefender.id]: 95 } },
  puckBattleStats: {
    home: { won: 0, lost: 0, takeaways: 0 },
    away: { won: 0, lost: 0, takeaways: 0 },
  },
};
assert.equal(api.resolveLivePuckBattle(lm), true, 'a board battle should be resolved');
assert.equal(lm.gameplayPossession.side, 'away');
assert.equal(lm.gameplayPossession.playerId, nearestDefender.id,
  'the closest opponent should be selected for a board battle');
assert.equal(nearestDefender.stats.boardBattlesWon, 1);
assert.equal(carrier.stats.boardBattlesLost, 1);
assert.equal(nearestDefender.stats.takeaways, 1);
assert.equal(events[0].type, 'board_battle');
assert.equal(events[0].boardBattle, true);
assert.match(events[0].text, /у борта/);
assert.equal(lm.positions.puck.nextPossessionSide, 'away');
console.log('LIVE board-battle checks passed.');
