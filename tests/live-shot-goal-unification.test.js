const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');
const goalStart = source.indexOf('function liveGoal(');
const goalEnd = source.indexOf('function livePenalty(', goalStart);
assert.ok(goalStart >= 0 && goalEnd > goalStart, 'liveGoal() must exist');
const goalSource = source.slice(goalStart, goalEnd);

assert.doesNotMatch(source, /const rGoal = rng\(\)/,
  'a goal must not be rolled independently of a shot');
assert.match(source, /const shotGoalChance = clamp\(/,
  'xG-derived probability must be applied to the actual shot outcome');
assert.match(source, /const outcome = rng\(\) < shotGoalChance \? 'гол' : pick\(/,
  'goal must be one of the possible outcomes of a recorded shot');
assert.match(source, /liveGoal\(side, \{ shooterId: p\.id, shotAttemptAlreadyCounted: true \}\)/,
  'a scored shot must pass the actual shooter to the goal resolver');
assert.match(goalSource, /onIceScorers\.find\(player => player\.id === options\.shooterId\)/,
  'the goal resolver must award the goal to the player who took the shot');
assert.match(goalSource, /if \(!options\.shotAttemptAlreadyCounted\) lm\.shotAttempts\[side\]\+\+/,
  'a goal from a shot must not double-count the attempt');
assert.match(source, /type: 'shot', side,[\s\S]*if \(outcome === 'гол'\)/,
  'the shot event must be recorded before the goal event');

console.log('LIVE shot-to-goal consistency checks passed.');
