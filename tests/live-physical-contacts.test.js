/*
 * LIVE physical-contact regression checks.
 * Run with: node tests/live-physical-contacts.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function getLiveContactRating(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE physical-contact helpers');

const helpersSource = source.slice(start, end);
let randomValues = [0, 0, 0, 0, 0, 0, 0];
let randomCalls = 0;
const rng = () => {
  randomCalls++;
  return randomValues.length ? randomValues.shift() : 1;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const events = [];
const penalties = [];
const G = { league: { teams: [
  { id: 'home', tactics: { physical: 40 } },
  { id: 'away', tactics: { physical: 100 } },
] } };
const api = new Function(
  'clamp', 'rng', 'G', 'ensureStats', 'ensurePlayoffStats',
  'livePushEvent', 'liveFmtTime', 'livePenalty', 'LIVE_TICK_SEC',
  'reconcileLiveManpower',
  `${helpersSource}; return { getLiveContactRating, resolveLivePhysicalContact };`
)(
  clamp, rng, G,
  player => (player.stats ||= {}),
  player => (player.playoffStats ||= {}),
  event => events.push(event),
  () => '12:30',
  (...args) => penalties.push(args),
  5,
  () => {}
);

const carrier = {
  id: 'carrier', name: 'Иван Нападающий', ovr: 45,
  attrs: { physical: 40, skating: 40, defense: 40, iq: 40 },
};
const hitter = {
  id: 'hitter', name: 'Пётр Защитник', ovr: 90,
  attrs: { physical: 95, skating: 90, defense: 90, iq: 20 },
};
const lm = {
  homeId: 'home', awayId: 'away', isPlayoff: false,
  period: 2, timeLeft: 750, totalSecPlayed: 450,
  gameplayPossession: { side: 'home', playerId: carrier.id },
  homeLineup: { skaters: [carrier] },
  awayLineup: { skaters: [hitter] },
  playerStamina: { home: { carrier: 85 }, away: { hitter: 95 } },
  positions: {
    home: [
      { role: 'goalie', onIce: true },
      { role: 'F', playerId: carrier.id, onIce: true, x: 100, y: 50, stamina: 85 },
    ],
    away: [
      { role: 'goalie', onIce: true },
      { role: 'D', playerId: hitter.id, onIce: true, x: 102, y: 50, stamina: 95 },
    ],
    puck: { x: 100, y: 50, carrierIndex: 1, looseFrames: 0 },
  },
};

assert.equal(api.resolveLivePhysicalContact(lm, 5), true,
  'a nearby opponent should be able to initiate a physical check');
assert.equal(hitter.stats.hits, 1, 'the hitter should receive a hit statistic');
assert.equal(carrier.stats.hitsReceived, 1, 'the carrier should receive a hit-against statistic');
assert.equal(lm.gameplayPossession.side, 'away',
  'a successful check that dislodges the puck should change gameplay possession');
assert.equal(lm.gameplayPossession.playerId, hitter.id);
assert.ok(lm.positions.home[1].fallFrames > 0, 'a clean hit should trigger a short fall animation');
assert.equal(lm.positions.puck.nextPossessionSide, 'away');
assert.equal(events.length, 1);
assert.equal(events[0].type, 'body_check');
assert.equal(events[0].cleanHit, true);
assert.equal(events[0].dislodged, true);
assert.equal(penalties.length, 1,
  'reckless high-intensity contact should be able to produce a penalty');
assert.equal(penalties[0][0], 'away');
assert.equal(penalties[0][2], hitter.id,
  'the penalty should be attributed to the player who made the illegal check');

const callsAfterHit = randomCalls;
assert.equal(api.resolveLivePhysicalContact(lm, 5), false,
  'contact cooldown should prevent immediate repeat checks');
assert.equal(randomCalls, callsAfterHit,
  'cooldown should stop before consuming gameplay RNG');

const farLm = {
  ...lm,
  physicalContactCooldown: 0,
  gameplayPossession: { side: 'home', playerId: carrier.id },
  positions: {
    ...lm.positions,
    away: [
      { role: 'goalie', onIce: true },
      { role: 'D', playerId: hitter.id, onIce: true, x: 180, y: 85 },
    ],
  },
};
randomValues = [0];
const callsBeforeFarCheck = randomCalls;
assert.equal(api.resolveLivePhysicalContact(farLm, 5), false,
  'a distant defender must not trigger a body check');
assert.equal(randomCalls, callsBeforeFarCheck,
  'distance rejection should not consume gameplay RNG');

assert.ok(api.getLiveContactRating(hitter, 95) > api.getLiveContactRating(carrier, 85),
  'physical attributes should influence contact strength');
assert.match(source, /p\.fallFrames--/,
  'the renderer should advance the short fall animation');
console.log('LIVE physical-contact checks passed.');
