/*
 * LIVE empty-net / goalie-pull regression checks.
 * Run with: node tests/live-goalie-pull.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');

function extract(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${name}()`);
  return source.slice(start, end);
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const getLiveManpowerState = new Function('clamp', extract('getLiveManpowerState', 'liveGetOnIceSkaters') + '; return getLiveManpowerState;')(clamp);
const buildFormation = new Function(extract('buildFormation', 'livePushEvent') + '; return buildFormation;')();
const updateLiveGoaliePulls = new Function(
  'livePushEvent', 'liveFmtTime',
  extract('updateLiveGoaliePulls', 'liveAdvance') + '; return updateLiveGoaliePulls;'
)((event) => events.push(event), (time) => String(time));
const reconcileLiveManpower = new Function('getLiveManpowerState', extract('reconcileLiveManpower', 'updateLiveShifts') + '; return reconcileLiveManpower;')(getLiveManpowerState);

const skaters = [
  { id: 'd1', name: 'D1', position: 'D' }, { id: 'd2', name: 'D2', position: 'D' },
  { id: 'f1', name: 'F1', position: 'F' }, { id: 'f2', name: 'F2', position: 'F' },
  { id: 'f3', name: 'F3', position: 'F' }, { id: 'f4', name: 'F4', position: 'F' },
  { id: 'f5', name: 'F5', position: 'F' },
];
const lineup = { goalie: { id: 'g1', name: 'Goalie', position: 'G' }, skaters, defense: skaters.filter(p => p.position === 'D'), forwards: skaters.filter(p => p.position !== 'D').slice(0, 3) };
const home = buildFormation('home', lineup);
assert.equal(home.length, 7, 'formation must have a goalie slot and six skater slots');
assert.equal(home[6].playerId, 'f4', 'sixth skater was not assigned from the roster');
assert.equal(home[6].onIce, false, 'sixth skater must start on the bench');

const events = [];
const lm = {
  hg: 1, ag: 2, period: 3, timeLeft: 89, totalSecPlayed: 3511,
  goaliePulled: { home: false, away: false },
  penalties: { home: [], away: [] },
  homeLineup: lineup,
  awayLineup: { goalie: { id: 'g2', name: 'Away goalie', position: 'G' }, skaters: skaters.map(p => ({ ...p, id: 'a' + p.id })) },
  positions: {
    home, away: buildFormation('away', { ...lineup, goalie: { id: 'g2', name: 'Away goalie', position: 'G' }, skaters: skaters.map(p => ({ ...p, id: 'a' + p.id })) }),
    puck: { x: 100, y: 50, possessionSide: 'home', carrierIndex: 3, looseFrames: 0 },
  },
};
updateLiveGoaliePulls(lm);
assert.equal(lm.goaliePulled.home, true, 'one-goal deficit inside 90 seconds did not trigger goalie pull');
assert.equal(lm.positions.home[0].onIce, false, 'pulled goalie remains on the ice');
reconcileLiveManpower(lm);
assert.equal(getLiveManpowerState(lm).home.skaters, 6, 'goalie pull did not create a sixth skater');
assert.equal(lm.positions.home.slice(1).filter(p => p.onIce !== false).length, 6, 'six skaters were not activated');
assert.equal(new Set(lm.positions.home.slice(1).filter(p => p.onIce !== false).map(p => p.playerId)).size, 6,
  'same player occupies multiple on-ice slots');

const shortHanded = {
  ...lm,
  hg: 1, ag: 2, totalSecPlayed: 3511,
  penalties: { home: [{ playerId: 'd1', endsAt: 3600 }], away: [] },
  goaliePulled: { home: true, away: false },
};
assert.equal(getLiveManpowerState(shortHanded).home.skaters, 5,
  'goalie pull plus one penalty should result in five skaters, not six');

lm.hg = 2;
lm.ag = 2;
updateLiveGoaliePulls(lm);
assert.equal(lm.goaliePulled.home, false, 'goalie was not returned after equalizer');
assert.equal(lm.positions.home[0].onIce, true, 'goalie slot was not restored');

const twoGoalState = { hg: 0, ag: 2, period: 3, timeLeft: 150, goaliePulled: { home: false, away: false }, positions: { puck: { x: 100, y: 50 } } };
updateLiveGoaliePulls(twoGoalState);
assert.equal(twoGoalState.goaliePulled.home, true, 'two-goal deficit inside 150 seconds did not trigger pull');

const noPullState = { hg: 0, ag: 1, period: 2, timeLeft: 20, goaliePulled: { home: false, away: false }, positions: { puck: { x: 100, y: 50 } } };
updateLiveGoaliePulls(noPullState);
assert.equal(noPullState.goaliePulled.home, false, 'goalie was pulled outside the third period');

assert.match(source, /if \(lm\.goaliePulled\?\.away\) hMod \*= 1\.35/);
assert.match(source, /if \(lm\.goaliePulled\?\.home\) aMod \*= 1\.35/);
assert.match(source, /if \(goalieOnIce\) lm\.goalieStats\[defendingSide\]\.shots\+\+/);
assert.match(source, /if \(defendingGoalieOnIce\) lm\.goalieStats\[defendingSide\]\.goals\+\+/);
assert.match(source, /const goalsAgainst = lm\.goalieStats\.away\.goals/);
assert.match(source, /const goalsAgainst = lm\.goalieStats\.home\.goals/);

console.log('LIVE goalie-pull checks passed.');
