/*
 * LIVE shot-block regression checks.
 * Run with: node tests/live-shot-blocks.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function resolveLiveShotBlock(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate shot-block resolver');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [0];
let calls = 0;
const rng = () => { calls++; return rolls.length ? rolls.shift() : 1; };
const api = new Function('clamp', 'rng',
  source.slice(start, end) + '; return { resolveLiveShotBlock };')(clamp, rng);

const blocker = {
  id: 'blocker', name: 'Защитник', ovr: 75,
  attrs: { blocking: 90, defense: 85, physical: 80 },
};
const shooter = { id: 'shooter', name: 'Нападающий', ovr: 70 };
const lm = {
  awayLineup: { skaters: [blocker] },
  playerStamina: { away: { blocker: 92 } },
  positions: {
    away: [
      { role: 'goalie', onIce: true, x: 190, y: 50 },
      { role: 'D', playerId: 'blocker', onIce: true, x: 145, y: 51, stamina: 92 },
    ],
  },
};
const result = api.resolveLiveShotBlock(lm, 'home', { x: 100, y: 50 }, 50);
assert.ok(result, 'a defender in the shot lane should be able to block the shot');
assert.equal(result.player.id, blocker.id);
assert.equal(result.side, 'away');
assert.ok(result.rating > 0);
assert.equal(calls, 1, 'only the eligible blocker should require one probability roll');

rolls = [0];
const farLm = {
  awayLineup: { skaters: [blocker] },
  positions: { away: [
    { role: 'goalie', onIce: true },
    { role: 'D', playerId: 'blocker', onIce: true, x: 145, y: 85 },
  ] },
};
const beforeFar = calls;
assert.equal(api.resolveLiveShotBlock(farLm, 'home', { x: 100, y: 50 }, 50), null,
  'a defender outside the shot lane must not block the attempt');
assert.equal(calls, beforeFar, 'an ineligible defender must not consume gameplay RNG');

assert.match(source, /blockerStats\.blocks = \(Number\(blockerStats\.blocks\) \|\| 0\) \+ 1/,
  'successful blocks must be recorded in player statistics');
assert.match(source, /lm\.gameplayPossession = \{ side: defendingSide, playerId: block\.player\.id \}/,
  'a block must transfer gameplay possession to the defending player');
assert.match(source, /shot\.outcome === 'сейв' \|\| shot\.outcome === 'блокирован' \? shot\.defendingSide/,
  'the puck animation must return blocked shots to the defending side');
assert.match(source, /nextCarrierIndex: block \? \(lm\.positions\[defendingSide\] \|\| \[\]\)\.findIndex/,
  'the visual puck should be collected by the actual blocker');
console.log('LIVE shot-block checks passed.');
