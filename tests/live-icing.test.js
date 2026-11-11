const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');
const start = source.indexOf('function resolveLiveIcing(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'resolveLiveIcing() must exist');
const helper = source.slice(start, end);
const events = [];
const restarts = [];
const api = new Function(
  'getLiveManpowerState', 'livePushEvent', 'liveFmtTime',
  'homeTeamNameShort', 'awayTeamNameShort', 'resolveLiveFaceoff',
  `${helper}; return resolveLiveIcing;`
)(
  lm => lm.manpower,
  event => events.push(event),
  () => '08:12',
  () => 'HOME', () => 'AWAY',
  (lm, reason, spot) => {
    restarts.push({ reason, spot });
    lm.positions.puck.icingPending = null;
  }
);

const makeState = (side, manpower) => ({
  timeLeft: 492, period: 2, manpower,
  positions: { puck: { icingPending: { side } } },
});

const homeState = makeState('home', {
  home: { skaters: 5 }, away: { skaters: 5 },
});
assert.equal(api(homeState), true);
assert.equal(events.at(-1).type, 'icing');
assert.match(events.at(-1).text, /HOME/);
assert.deepEqual(restarts.at(-1), { reason: 'проброс', spot: { x: 30, y: 50 } });
assert.equal(homeState.positions.puck.icingPending, null);

const awayState = makeState('away', {
  home: { skaters: 5 }, away: { skaters: 5 },
});
assert.equal(api(awayState), true);
assert.deepEqual(restarts.at(-1), { reason: 'проброс', spot: { x: 170, y: 50 } });

const penaltyKillState = makeState('home', {
  home: { skaters: 4 }, away: { skaters: 5 },
});
const eventCount = events.length;
const restartCount = restarts.length;
assert.equal(api(penaltyKillState), false, 'icing should be waived for a team killing a penalty');
assert.equal(penaltyKillState.positions.puck.icingPending, null);
assert.equal(events.length, eventCount);
assert.equal(restarts.length, restartCount);

assert.match(source, /const icingCandidate = !block && outcome === 'мимо' && !isPenaltyKilling/);
assert.match(source, /if \(shot\.icingCandidate\) puck\.icingPending = \{ side: shot\.side \}/);
assert.match(source, /resolveLiveIcing\(lm\) \|\| resolveLiveOffside\(lm\)/);

console.log('LIVE icing checks passed.');
