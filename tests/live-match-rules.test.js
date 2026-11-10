/*
 * LIVE match regression checks.
 * Run with: node tests/live-match-rules.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${name}()`);
  return source.slice(start, end);
}

// A normal non-goal shot must be credited symmetrically to either side.
const advanceSource = extractFunction('liveAdvance', 'liveGoal');
const liveAdvance = new Function(
  'G', 'rng', 'liveIsPP', 'liveGoal', 'livePenalty', 'pickWeighted', 'pick',
  'shotWeight', 'ensureStats', 'ensurePlayoffStats', 'livePushEvent',
  'liveFmtTime', 'homeTeamNameShort', 'awayTeamNameShort',
  'LIVE_PENALTY_RATE', 'LIVE_PP_BOOST', 'LIVE_PK_NERF', 'LIVE_SHOT_RATE', 'clamp',
  `${advanceSource}; return liveAdvance;`
);

function makeLiveState() {
  const homePlayer = { id: 'h1', name: 'Home shooter', position: 'F' };
  const awayPlayer = { id: 'a1', name: 'Away shooter', position: 'F' };
  return {
    homePlayer, awayPlayer,
    lm: {
      homeId: 'home', awayId: 'away', period: 1, timeLeft: 1000,
      totalSecPlayed: 0, xgCurrent: { home: 2.5, away: 2.5 },
      penalties: { home: [], away: [] },
      shots: { home: 0, away: 0 }, shotAttempts: { home: 0, away: 0 },
      goalieStats: { home: { shots: 0, goals: 0 }, away: { shots: 0, goals: 0 } },
      homeLineup: { skaters: [homePlayer] }, awayLineup: { skaters: [awayPlayer] },
      isPlayoff: false, events: [],
    },
  };
}
const state = makeLiveState();
const randomValues = [0.99, 0.99, 0.01, 0.1, 0.99, 0.99, 0.01, 0.9];
let randomIndex = 0;
const rng = () => randomValues[randomIndex++];
const stats = new Map();
const ensureStats = p => {
  if (!stats.has(p.id)) stats.set(p.id, { shots: 0 });
  return stats.get(p.id);
};
const advance = liveAdvance(
  { liveMatch: state.lm }, rng, () => false, () => {}, () => {},
  players => players[0], arr => arr[0], () => 1, ensureStats, ensureStats,
  ev => state.lm.events.push(ev), () => '19:00', () => 'HOME', () => 'AWAY',
  0.00195, 1.8, 0.70, 0.055, (v, min, max) => Math.max(min, Math.min(max, v))
);
advance(5);
advance(5);
assert.equal(state.lm.shots.home, 1, 'home shot was not counted');
assert.equal(state.lm.shots.away, 1, 'away shot was not counted');
assert.equal(state.lm.goalieStats.away.shots, 1, 'away goalie did not face the home shot');
assert.equal(state.lm.goalieStats.home.shots, 1, 'home goalie did not face the away shot');
assert.equal(ensureStats(state.homePlayer).shots, 1);
assert.equal(ensureStats(state.awayPlayer).shots, 1);

// Missed shots and posts are attempts, not shots on goal or goalie saves.
const missState = makeLiveState();
const missRandomValues = [0.99, 0.99, 0.01, 0.1];
let missRandomIndex = 0;
const missStats = new Map();
const ensureMissStats = p => {
  if (!missStats.has(p.id)) missStats.set(p.id, { shots: 0 });
  return missStats.get(p.id);
};
const missAdvance = liveAdvance(
  { liveMatch: missState.lm }, () => missRandomValues[missRandomIndex++],
  () => false, () => {}, () => {},
  players => players[0], arr => arr[3], () => 1,
  ensureMissStats, ensureMissStats, ev => missState.lm.events.push(ev),
  () => '19:00', () => 'HOME', () => 'AWAY',
  0.00195, 1.8, 0.70, 0.055, (v, min, max) => Math.max(min, Math.min(max, v))
);
missAdvance(5);
assert.equal(missState.lm.shotAttempts.home, 1, 'missed attempt was not recorded');
assert.equal(missState.lm.shots.home, 0, 'missed shot incorrectly counted on goal');
assert.equal(missState.lm.goalieStats.away.shots, 0, 'goalie incorrectly credited with a missed shot');
assert.equal(ensureMissStats(missState.homePlayer).shots, 0, 'skater shot-on-goal stat incorrectly includes a miss');

// LIVE calibration constants must stay aligned with the tested simulation.
assert.match(source, /const LIVE_XG_MULTIPLIER = 0\.96/);
assert.match(source, /const LIVE_PP_BOOST = 1\.8/);
assert.match(source, /const LIVE_PK_NERF\s*= 0\.70/);
assert.match(source, /const LIVE_PENALTY_RATE = 0\.00195/);
assert.match(source, /const LIVE_SHOT_RATE = 0\.093/);
assert.match(source, /if \(rShot < LIVE_SHOT_RATE\)/);

// A full regulation-length sample must produce a hockey-like shot volume.
const volumeState = makeLiveState();
volumeState.lm.timeLeft = 100000;
let seed = 123456789;
const seededRng = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
};
const volumeAdvance = liveAdvance(
  { liveMatch: volumeState.lm }, seededRng, () => false, () => {}, () => {},
  players => players[0], arr => arr[Math.floor(seededRng() * arr.length)], () => 1, ensureStats, ensureStats,
  ev => volumeState.lm.events.push(ev), () => '19:00', () => 'HOME', () => 'AWAY',
  0.00195, 1.8, 0.70, 0.093, (v, min, max) => Math.max(min, Math.min(max, v))
);
for (let i = 0; i < 720; i++) volumeAdvance(5);
const totalShots = volumeState.lm.shots.home + volumeState.lm.shots.away;
assert.ok(totalShots >= 35 && totalShots <= 55, `unexpected LIVE shots-on-goal volume: ${totalShots}`);
assert.ok(volumeState.lm.shots.home >= 10 && volumeState.lm.shots.away >= 10,
  'LIVE shot generation is not balanced between teams');
assert.match(source, /xgTotal: \{ home: liveXgH, away: liveXgA \}/);
assert.match(source, /lm\.xgCurrent\.home = xgH \* LIVE_XG_MULTIPLIER/);

// A goal must award plus/minus only to the five skaters on the ice on each side.
const goalSource = source.slice(
  source.indexOf('function liveGoal('),
  source.indexOf('function livePenalty(', source.indexOf('function liveGoal('))
);
const liveGoal = new Function(
  'G', 'pickWeighted', 'scorerWeight', 'ensurePlayoffStats', 'ensureStats',
  'rng', 'addNews', 'liveIsPP', 'livePushEvent', 'liveFmtTime',
  'finishLiveMatch', 'clearInterval',
  `${goalSource}; return liveGoal;`
);
const homeSkaters = Array.from({ length: 6 }, (_, i) => ({ id: `h${i + 1}`, name: `Home ${i + 1}`, position: 'F', ovr: 60 }));
const awaySkaters = Array.from({ length: 6 }, (_, i) => ({ id: `a${i + 1}`, name: `Away ${i + 1}`, position: 'F', ovr: 60 }));
const goalStats = new Map();
const ensureGoalStats = p => {
  if (!goalStats.has(p.id)) goalStats.set(p.id, { goals: 0, shots: 0, points: 0, assists: 0, plusMinus: 0 });
  return goalStats.get(p.id);
};
const goalLm = {
  homeId: 'home', awayId: 'away', hg: 0, ag: 0, period: 1, timeLeft: 900,
  isPlayoff: false, penalties: { home: [], away: [] }, totalSecPlayed: 100,
  homeLineup: { skaters: homeSkaters }, awayLineup: { skaters: awaySkaters },
  goalieStats: { home: { shots: 0, goals: 0 }, away: { shots: 0, goals: 0 } },
  shots: { home: 0, away: 0 }, shotAttempts: { home: 0, away: 0 },
  positions: { puck: { x: 100, y: 50 } }, scorers: {}, assisters: {},
};
const selectedIds = new Set();
const chooseUnselected = players => {
  const selected = players.find(p => !selectedIds.has(p.id)) || players[0];
  selectedIds.add(selected.id);
  return selected;
};
const runGoal = liveGoal(
  { liveMatch: goalLm, league: { teams: [{ id: 'home', name: 'Home' }, { id: 'away', name: 'Away' }] } },
  players => chooseUnselected(players), () => 1,
  ensureGoalStats, ensureGoalStats, () => 0.01, () => {}, () => false,
  () => {}, () => '15:00', () => {}, () => {}
);
runGoal('home');
assert.equal(goalLm.hg, 1);
assert.equal(goalLm.shotAttempts.home, 1, 'goal attempt was not counted');
assert.equal(goalLm.shots.home, 1, 'goal was not counted as a shot on goal');
assert.equal(homeSkaters.filter(p => ensureGoalStats(p).plusMinus === 1).length, 5,
  'plus was not limited to five attacking skaters');
assert.equal(awaySkaters.filter(p => ensureGoalStats(p).plusMinus === -1).length, 5,
  'minus was not limited to five defending skaters');
assert.equal(awaySkaters.filter(p => ensureGoalStats(p).plusMinus === 0).length, 1,
  'bench player incorrectly received a minus');

// A tied overtime must be resolved by a shootout; the deciding goal is a team
// result only and is not added to skater/goalie box-score statistics.
const shootoutSource = source.slice(
  source.indexOf('function runLiveShootout()'),
  source.indexOf('function liveResumeFromBreak()', source.indexOf('function runLiveShootout()'))
);
const runLiveShootout = new Function(
  'G', 'rng', 'clamp', 'pickWeighted', 'scorerWeight', 'livePushEvent',
  'clearInterval', 'finishLiveMatch',
  `${shootoutSource}; return runLiveShootout;`
);
const homeShooter = { id: 'hs', name: 'Home', ovr: 60 };
const awayShooter = { id: 'as', name: 'Away', ovr: 60 };
const lm = {
  homeId: 'home', awayId: 'away', hg: 2, ag: 2, ot: true,
  period: 4, timeLeft: 0, shootout: false, pbp: [], shootoutAttempts: { home: 0, away: 0 },
  homeLineup: { skaters: [homeShooter], goalie: { name: 'Home goalie' } },
  awayLineup: { skaters: [awayShooter], goalie: { name: 'Away goalie' } },
  events: [], pbp: [], intervalId: null, isFinished: false,
};
let finished = false;
const run = runLiveShootout(
  { liveMatch: lm, league: { teams: [
    { id: 'home', name: 'Home', shortName: 'HOME' },
    { id: 'away', name: 'Away', shortName: 'AWAY' },
  ] } },
  () => 0.99,
  (v, min, max) => Math.max(min, Math.min(max, v)),
  players => players[0], () => 1,
  ev => lm.events.push(ev),
  () => {},
  () => { finished = true; }
);
run();
assert.equal(lm.shootout, true);
assert.equal(lm.period, 5);
assert.equal(lm.shootoutWinner, 'away');
assert.equal(lm.hg, 2);
assert.equal(lm.ag, 3, 'shootout winner should receive the deciding team goal');
assert.equal(lm.shootoutAttempts.home, lm.shootoutAttempts.away);
assert.equal(finished, true, 'shootout did not finish the match');
assert.ok(lm.pbp.length >= 0);


// Formation slots must refer to actual players from the selected match lineup.
const formationSource = source.slice(
  source.indexOf('function buildFormation('),
  source.indexOf('function livePushEvent(', source.indexOf('function buildFormation('))
);
const buildFormation = new Function(`${formationSource}; return buildFormation;`)();
const goalie = { id: 'g1', name: 'Goalie', position: 'G' };
const defenders = [{ id: 'd1', name: 'D1', position: 'D' }, { id: 'd2', name: 'D2', position: 'D' }];
const forwards = [
  { id: 'f1', name: 'F1', position: 'F' },
  { id: 'f2', name: 'F2', position: 'C' },
  { id: 'f3', name: 'F3', position: 'F' },
];
const formation = buildFormation('home', { goalie, defense: defenders, forwards, skaters: [...defenders, ...forwards] });
assert.deepEqual(formation.map(p => p.playerId), ['g1', 'd1', 'd2', 'f1', 'f2', 'f3']);
assert.equal(formation[0].role, 'goalie');

// Possession-based animation must keep players on the rink and move the puck
// with its carrier, using only the visual random stream.
const animationStart = source.indexOf('function liveUpdatePositions(');
const animationEnd = source.indexOf('function liveAnimationLoop(', animationStart);
assert.ok(animationStart >= 0 && animationEnd > animationStart);
const animationSource = source.slice(animationStart, animationEnd);
const liveUpdatePositions = new Function(
  'G', 'window', 'clamp', `${animationSource}; return liveUpdatePositions;`
);
const homePositions = formation.map(p => ({ ...p }));
const awayPositions = buildFormation('away', { goalie: { id: 'ag', position: 'G' }, defense: defenders, forwards, skaters: [...defenders, ...forwards] });
const animationState = {
  positions: {
    home: homePositions, away: awayPositions,
    puck: { x: 100, y: 50, vx: 0, vy: 0, possessionSide: 'home', carrierIndex: 3, actionFrames: 40, looseFrames: 0 },
  },
};
const visualWindow = { GAME_RNG: { visualRng: () => 0.5 } };
liveUpdatePositions({ liveMatch: animationState }, visualWindow, (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.ok(homePositions.every(p => p.x >= 5 && p.x <= 195 && p.y >= 5 && p.y <= 95));
assert.ok(awayPositions.every(p => p.x >= 5 && p.x <= 195 && p.y >= 5 && p.y <= 95));
assert.ok(Math.abs(animationState.positions.puck.x - (homePositions[3].x + 3.2)) < 30,
  'puck did not move toward the home carrier');
assert.ok(animationState.positions.puck.x > 100, 'home possession did not advance toward the attacking half');

// The canvas animation loop must sleep while paused, between periods or after the final whistle.
const loopStart = source.indexOf('function liveAnimationLoop(');
const loopEnd = source.indexOf('function startLiveAnimation(', loopStart);
assert.ok(loopStart >= 0 && loopEnd > loopStart, 'liveAnimationLoop() was not found');
const loopSource = source.slice(loopStart, loopEnd);
const makeAnimationLoop = new Function(
  'G', 'liveUpdatePositions', 'drawLiveCanvas', 'requestAnimationFrame',
  `let _liveRafId = null; ${loopSource}; return liveAnimationLoop;`
);
let animationUpdates = 0;
let animationDraws = 0;
let rafRequests = 0;
const requestFrame = () => { rafRequests++; return rafRequests; };
const animationLoop = makeAnimationLoop(
  { liveMatch: { paused: true, isBreak: false, isFinished: false } },
  () => animationUpdates++, () => animationDraws++, requestFrame
);
animationLoop();
assert.equal(rafRequests, 0, 'paused match kept requesting animation frames');
assert.equal(animationUpdates, 0);
assert.equal(animationDraws, 0);
const runningLoop = makeAnimationLoop(
  { liveMatch: { paused: false, isBreak: false, isFinished: false } },
  () => animationUpdates++, () => animationDraws++, requestFrame
);
runningLoop();
assert.equal(rafRequests, 1, 'running match did not schedule the next animation frame');
assert.equal(animationUpdates, 1);
assert.equal(animationDraws, 1);

console.log('LIVE match rules checks passed.');
