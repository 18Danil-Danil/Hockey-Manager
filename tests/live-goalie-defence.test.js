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

// Run the actual positioning update with a puck moved across the attacking zone.
const updateStart = source.indexOf('function liveUpdatePositions(');
const updateEnd = source.indexOf('function liveAnimationLoop(', updateStart);
assert.ok(updateStart >= 0 && updateEnd > updateStart, 'Could not locate LIVE positioning update');
const visualUpdate = new Function(
  'G', 'window', 'getLiveManpowerState', 'clamp',
  source.slice(updateStart, updateEnd) + '; return liveUpdatePositions;'
)({
  league: { teams: [
    { id: 'home', tactics: {} },
    { id: 'away', tactics: {} },
  ] },
}, {
  GAME_RNG: { visualRng: () => 0.5 },
}, () => ({
  home: { skaters: 5, advantage: 0 },
  away: { skaters: 5, advantage: 0 },
}), clamp);
const makeSlot = (role, idx, x, y) => ({
  role, idx, x, y, baseX: x, baseY: y, vx: 0, vy: 0, onIce: true,
  playerId: role === 'goalie' ? 'goalie-' + idx : 'skater-' + idx,
});
const positioningState = {
  positions: {
    home: [
      makeSlot('goalie', 0, 12, 50),
      makeSlot('D', 1, 120, 40),
      makeSlot('D', 2, 120, 60),
      makeSlot('F', 3, 150, 35),
      makeSlot('C', 4, 150, 50),
      makeSlot('F', 5, 150, 65),
    ],
    away: [
      makeSlot('goalie', 0, 188, 50),
      makeSlot('D', 1, 160, 40),
      makeSlot('D', 2, 160, 60),
      makeSlot('F', 3, 175, 35),
      makeSlot('C', 4, 175, 50),
      makeSlot('F', 5, 175, 65),
    ],
    puck: { x: 165, y: 80, possessionSide: 'home', carrierIndex: 3, actionFrames: 100, looseFrames: 0 },
  },
};
visualUpdate({ liveMatch: positioningState })();
assert.ok(positioningState.positions.away[0].y > 50,
  'goalie did not move laterally toward a puck carried across the zone');

// The rendered goalie tracks the shot lane and cross-ice puck movement;
// defensive partners protect the slot instead of both chasing the carrier.
assert.match(source, /const shotLaneY = shotOnGoalie \? puck\.shotAnimation\.targetY : 50 \+ \(puck\.y - 50\) \* 0\.34/);
assert.match(source, /targetY = clamp\(shotLaneY, 34, 66\)/);
assert.match(source, /const response = isGoalie \? 0\.105 : 0\.035/);
assert.match(source, /Дальний защитник закрывает внутренний коридор/);
assert.match(source, /const coverLane = player\.idx === 1 \? 43 : 57/);
console.log('LIVE goalie and defensive-positioning checks passed.');
