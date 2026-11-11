/*
 * LIVE goalie and defensive-positioning regression checks.
 * Run with: node tests/live-goalie-defence.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function getLiveGoalieControl(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE goalie/rebound helpers');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [0.99, 0];
const rng = () => rolls.length ? rolls.shift() : 0.99;
const statsFor = player => (player.stats ||= {});
const events = [];
const api = new Function(
  'rng', 'clamp', 'ensureStats', 'ensurePlayoffStats', 'livePushEvent', 'liveFmtTime',
  source.slice(start, end)
    + '; return { getLiveGoalieControl, resolveLiveShotRebound };'
)(rng, clamp, statsFor, statsFor, event => events.push(event), () => '08:12');

const attacker = { id: 'attacker', name: 'Нападающий', attrs: { physical: 80, skating: 80, iq: 80, defense: 60 } };
const defender = { id: 'defender', name: 'Защитник', attrs: { physical: 80, skating: 80, iq: 80, defense: 85 } };
const goalie = { id: 'goalie', name: 'Вратарь', ovr: 80, attrs: { reboundControl: 90, reflexes: 85 } };
const lm = {
  isPlayoff: false, period: 2, timeLeft: 492, totalSecPlayed: 708,
  homeLineup: { skaters: [attacker], goalie: null },
  awayLineup: { skaters: [defender], goalie },
  positions: {
    home: [{ role: 'goalie', onIce: true }, { role: 'F', playerId: attacker.id, onIce: true, x: 178, y: 42 }],
    away: [{ role: 'goalie', playerId: goalie.id, onIce: true, x: 188, y: 50 }, { role: 'D', playerId: defender.id, onIce: true, x: 180, y: 58 }],
    puck: { x: 180, y: 42 },
  },
  gameplayPossession: { side: 'home', playerId: attacker.id },
};
assert.equal(api.getLiveGoalieControl(goalie), 90);
const rebound = api.resolveLiveShotRebound(lm, 'home', attacker, 'сейв', 42);
assert.equal(rebound.side, 'home');
assert.ok(rebound.targetX < 183, 'a controlled rebound should be pushed away from the goal mouth');
assert.ok(rebound.targetY > 50, 'a high-side shot should be redirected toward the opposite corner');
assert.equal(attacker.stats.reboundRecoveries, 1);
assert.equal(defender.stats.reboundBattlesLost, 1);
assert.ok(events.some(event => event.type === 'rebound'));

rolls = [0];
const covered = api.resolveLiveShotRebound(lm, 'home', attacker, 'сейв', 50);
assert.equal(covered.frozen, true, 'a goalie with strong rebound control should be able to freeze the puck');
assert.equal(covered.carrierIndex, 0);
assert.equal(goalie.stats.reboundCovers, 1);

// The rendered goalie tracks the shot lane and cross-ice puck movement;
// defensive partners protect the slot instead of both chasing the carrier.
assert.match(source, /const shotLaneY = shotOnGoalie \? puck\.shotAnimation\.targetY : 50 \+ \(puck\.y - 50\) \* 0\.34/);
assert.match(source, /targetY = clamp\(shotLaneY, 34, 66\)/);
assert.match(source, /const response = isGoalie \? 0\.105 : 0\.035/);
assert.match(source, /Дальний защитник закрывает внутренний коридор/);
assert.match(source, /const coverLane = player\.idx === 1 \? 43 : 57/);
console.log('LIVE goalie and defensive-positioning checks passed.');
