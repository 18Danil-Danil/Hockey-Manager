/*
 * LIVE passing-lane interception regression checks.
 * Run with: node tests/live-pass-interceptions.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function getLiveBreakawayThreat(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE passing helpers');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [0, 0];
let calls = 0;
const rng = () => { calls++; return rolls.length ? rolls.shift() : 0.99; };
const statsFor = player => (player.stats ||= {});
const events = [];
const api = new Function(
  'rng', 'clamp', 'pickWeighted', 'shotWeight', 'ensureStats', 'ensurePlayoffStats',
  'livePushEvent', 'liveFmtTime',
  source.slice(start, end)
    + '; return { getLiveShotOpportunity, resolveLivePassInterception };'
)(
  rng, clamp, players => players[0], () => 1, statsFor, statsFor,
  event => events.push(event), () => '08:12'
);

const passer = { id: 'passer', name: 'Пасующий', ovr: 60, attrs: { passing: 50 } };
const receiver = { id: 'receiver', name: 'Получатель', ovr: 80, attrs: { skating: 80 } };
const interceptor = {
  id: 'interceptor', name: 'Защитник', ovr: 90,
  attrs: { interception: 95, defense: 90, iq: 90 },
};
const goalie = { id: 'goalie', name: 'Вратарь', ovr: 75 };
const lm = {
  homeLineup: { skaters: [passer, receiver] },
  awayLineup: { skaters: [interceptor], goalie },
  positions: {
    home: [
      { role: 'goalie', playerId: 'home-goalie', onIce: true, x: 12, y: 50 },
      { role: 'F', playerId: passer.id, onIce: true, x: 160, y: 50 },
      { role: 'C', playerId: receiver.id, onIce: true, x: 180, y: 50 },
    ],
    away: [
      { role: 'goalie', playerId: goalie.id, onIce: true, x: 188, y: 50 },
      { role: 'D', playerId: interceptor.id, onIce: true, x: 170, y: 50 },
    ],
    puck: { x: 160, y: 50 },
  },
  gameplayPossession: { side: 'home', playerId: passer.id },
};

const opportunity = api.getLiveShotOpportunity(lm, 'home', [passer, receiver], lm.positions.puck);
assert.equal(opportunity.type, 'intercepted',
  'a defender standing directly in a pass lane should intercept a vulnerable pass');
assert.equal(opportunity.interceptor.id, interceptor.id);
assert.equal(opportunity.passer.id, passer.id);
assert.equal(opportunity.receiver.id, receiver.id);
assert.equal(calls, 2, 'pass choice and eligible interception should each use gameplay RNG');

// A defender far from the passing lane must not consume an interception roll.
lm.positions.away[1].y = 82;
rolls = [0, 0];
calls = 0;
const cleanPass = api.getLiveShotOpportunity(lm, 'home', [passer, receiver], lm.positions.puck);
assert.equal(cleanPass.type, 'slot');
assert.equal(cleanPass.shooter.id, receiver.id);
assert.equal(calls, 1, 'an off-lane defender must not receive an interception probability roll');

// The real match flow records the interception, awards possession and animates
// the puck toward the actual interceptor without counting a shot.
assert.match(source, /if \(opportunity\.type === 'intercepted' && opportunity\.interceptor\)/);
assert.match(source, /interceptionStats\.interceptions = \(Number\(interceptionStats\.interceptions\) \|\| 0\) \+ 1/);
assert.match(source, /lm\.gameplayPossession = \{ side: defendingSide, playerId: interceptor\.id \}/);
assert.match(source, /puck\.passFrames = 12/);
assert.match(source, /type: 'pass_interception'/);
console.log('LIVE passing-lane interception checks passed.');
