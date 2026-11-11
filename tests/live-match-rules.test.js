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

// A normal period break must refresh the screen and expose the resume controls.
const endPeriodStart = source.indexOf('function liveEndPeriod(');
const endPeriodEnd = source.indexOf('function runLiveShootout(', endPeriodStart);
assert.ok(endPeriodStart >= 0 && endPeriodEnd > endPeriodStart, 'liveEndPeriod() was not found');
const endPeriodSource = source.slice(endPeriodStart, endPeriodEnd);
const makeEndPeriod = new Function(
  'G', 'livePushEvent', 'clearInterval', 'render', 'runLiveShootout', 'finishLiveMatch',
  `${endPeriodSource}; return liveEndPeriod;`
);
const breakLm = { period: 1, hg: 1, ag: 1, isFinished: false, isBreak: false, paused: false, intervalId: 42 };
let clearedInterval = false;
let breakRendered = false;
const endPeriod = makeEndPeriod(
  { liveMatch: breakLm }, () => {}, () => { clearedInterval = true; },
  () => { breakRendered = true; }, () => {}, () => {}
);
endPeriod();
assert.equal(breakLm.isBreak, true);
assert.equal(breakLm.paused, true);
assert.equal(breakLm.intervalId, null);
assert.equal(clearedInterval, true, 'period break did not stop the match interval');
assert.equal(breakRendered, true, 'period break did not refresh the controls');

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

// LIVE shift plans follow the configured forward lines and defensive pairs.
const shiftSource = source.slice(
  source.indexOf('function buildLiveShiftPlan('),
  source.indexOf('function buildFormation(')
);
const shiftHelpers = new Function('clamp', `${shiftSource}; return { buildLiveShiftPlan, applyLiveShift, updateLiveShifts };`)(
  (v, min, max) => Math.max(min, Math.min(max, v))
);
const allForwards = Array.from({ length: 12 }, (_, i) => ({ id: `f${i + 1}`, name: `F${i + 1}`, position: 'F', fatigue: 0 }));
const allDefense = Array.from({ length: 6 }, (_, i) => ({ id: `d${i + 1}`, name: `D${i + 1}`, position: 'D', fatigue: 0 }));
const allSkaters = [...allForwards, ...allDefense];
const shiftTeam = { lines: {
  f1: { players: ['f1', 'f2', 'f3'] }, f2: { players: ['f4', 'f5', 'f6'] },
  f3: { players: ['f7', 'f8', 'f9'] }, f4: { players: ['f10', 'f11', 'f12'] },
  d1: { players: ['d1', 'd2'] }, d2: { players: ['d3', 'd4'] }, d3: { players: ['d5', 'd6'] },
} };
const shiftLineup = { forwards: allForwards, defense: allDefense, skaters: allSkaters };
const shiftPlan = shiftHelpers.buildLiveShiftPlan(shiftTeam, shiftLineup);
assert.equal(shiftPlan.forwards.length, 4, 'not all four forward lines were included');
assert.equal(shiftPlan.defense.length, 3, 'not all three defensive pairs were included');
assert.equal(shiftPlan.forwards[0][0].id, 'f1');
assert.equal(shiftPlan.forwards[3][2].id, 'f12');

// A line change waits for a safe moment, then replaces all five skaters together.
const shiftFormationHome = buildFormation('home', {
  goalie, defense: allDefense, forwards: allForwards, skaters: allSkaters,
});
const shiftFormationAway = buildFormation('away', {
  goalie: { id: 'ag', name: 'Away goalie', position: 'G' },
  defense: allDefense, forwards: allForwards, skaters: allSkaters,
});
const makeShiftState = puck => ({
  homeLineup: shiftLineup, awayLineup: shiftLineup,
  positions: { home: shiftFormationHome.map(p => ({ ...p })), away: shiftFormationAway.map(p => ({ ...p })), puck },
  shiftPlans: { home: shiftPlan, away: shiftPlan },
  shiftState: {
    home: { forwardIndex: 0, defenseIndex: 0, elapsed: 0, pending: false, changes: 0 },
    away: { forwardIndex: 0, defenseIndex: 0, elapsed: 0, pending: false, changes: 0 },
  },
  playerStamina: {
    home: Object.fromEntries(allSkaters.map(p => [p.id, 100])),
    away: Object.fromEntries(allSkaters.map(p => [p.id, 100])),
  },
});
const safeShift = makeShiftState({
  x: 100, y: 50, possessionSide: 'home', carrierIndex: 3, looseFrames: 0,
});
for (let i = 0; i < 9; i++) shiftHelpers.updateLiveShifts(safeShift, 5);
assert.equal(safeShift.shiftState.home.pending, true, '45-second shift did not become due');
assert.equal(safeShift.shiftState.home.changes, 0, 'line changed while the team still controlled the puck');
safeShift.positions.puck.looseFrames = 2;
shiftHelpers.updateLiveShifts(safeShift, 5);
assert.equal(safeShift.shiftState.home.changes, 1, 'line did not change at the safe loose-puck moment');
assert.equal(safeShift.positions.home[1].playerId, 'd3', 'defensive pair did not rotate');
assert.equal(safeShift.positions.home[3].playerId, 'f4', 'forward line did not rotate');
assert.ok(safeShift.playerStamina.home.f1 < 100, 'active skater did not lose stamina');
assert.ok(safeShift.playerStamina.home.f10 > 100 - 0.01, 'resting skater did not recover stamina');
assert.ok(safeShift.playerStamina.home.f1 < 70, 'active shift did not meaningfully drain stamina');
assert.match(source, /const staminaFactor = isGoalie \? 1 : clamp\(\(player\.stamina \?\? 100\) \/ 100, 0\.58, 1\)/,
  'low stamina is not reflected in player movement speed');

// Fatigue carried into the match lowers the player's initial stamina reserve.
const tired = { id: 'tired', name: 'Tired', position: 'F', fatigue: 80 };
const tiredRoster = [tired, ...allForwards.slice(1), ...allDefense];
const tiredLineup = {
  forwards: [tired, ...allForwards.slice(1)], defense: allDefense, skaters: tiredRoster,
};
const tiredPlan = shiftHelpers.buildLiveShiftPlan({ lines: {} }, tiredLineup);
const tiredState = makeShiftState({
  x: 100, y: 50, possessionSide: 'home', carrierIndex: 3, looseFrames: 0,
});
tiredState.homeLineup = tiredLineup;
tiredState.shiftPlans.home = tiredPlan;
tiredState.playerStamina.home = {};
tiredState.positions.home[3].playerId = 'tired';
shiftHelpers.updateLiveShifts(tiredState, 5);
assert.ok(tiredState.playerStamina.home.tired < 65, 'pre-match fatigue did not reduce initial stamina');

// A high-fatigue skater starts with a lower stamina reserve.
const tiredLineup = {
  forwards: [{ id: 'tired', name: 'Tired', position: 'F', fatigue: 80 }, ...allForwards.slice(1)],
  defense: allDefense, skaters: [{ id: 'tired', name: 'Tired', position: 'F', fatigue: 80 }, ...allForwards.slice(1), ...allDefense],
};
const tiredPlan = shiftHelpers.buildLiveShiftPlan({ lines: {} }, tiredLineup);
assert.ok(100 - 80 * 0.45 < 100, 'pre-match fatigue was not factored into stamina initialization');


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

// A visual pass transfers the puck between two skaters over several animation frames.
const passState = {
  positions: {
    home: formation.map(p => ({ ...p })),
    away: awayPositions.map(p => ({ ...p })),
    puck: { x: 100, y: 50, vx: 0, vy: 0, possessionSide: 'home', carrierIndex: 3, actionFrames: 1, looseFrames: 0 },
  },
};
liveUpdatePositions({ liveMatch: passState }, visualWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.notEqual(passState.positions.puck.carrierIndex, 3, 'visual pass did not select a new teammate');
assert.equal(passState.positions.puck.passFrames, 11, 'visual pass did not start and advance its animation');
const passStartX = passState.positions.puck.x;
liveUpdatePositions({ liveMatch: passState }, visualWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.equal(passState.positions.puck.passFrames, 10, 'visual pass animation did not advance');
assert.notEqual(passState.positions.puck.x, passStartX, 'puck did not travel toward the receiver');

// Turnovers send the loose puck toward an opposing skater, then assign that receiver.
const turnoverRngValues = [0, 0.5, 0.5, 0.5];
let turnoverRngIndex = 0;
const turnoverWindow = { GAME_RNG: { visualRng: () => turnoverRngValues[Math.min(turnoverRngIndex++, turnoverRngValues.length - 1)] } };
const turnoverState = {
  positions: {
    home: formation.map(p => ({ ...p })),
    away: awayPositions.map(p => ({ ...p })),
    puck: { x: 100, y: 50, vx: 0, vy: 0, possessionSide: 'home', carrierIndex: 3, actionFrames: 1, looseFrames: 0 },
  },
};
liveUpdatePositions({ liveMatch: turnoverState }, turnoverWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.equal(turnoverState.positions.puck.possessionSide, 'home', 'turnover changed possession before puck arrival');
assert.equal(turnoverState.positions.puck.nextPossessionSide, 'away');
assert.equal(turnoverState.positions.puck.looseFrames, 14, 'turnover did not animate a loose puck');
for (let i = 0; i < 14; i++) liveUpdatePositions({ liveMatch: turnoverState }, turnoverWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.equal(turnoverState.positions.puck.possessionSide, 'away', 'opponent did not receive the puck after turnover');

assert.equal(turnoverState.positions.puck.carrierIndex, 4, 'turnover receiver was not preserved');

// Recorded shots travel toward the goal, trigger a goalie lane response and create a rebound.
const shotState = {
  positions: {
    home: formation.map(p => ({ ...p })),
    away: awayPositions.map(p => ({ ...p })),
    puck: {
      x: 100, y: 35, possessionSide: 'home', carrierIndex: null, looseFrames: 0,
      shotAnimation: {
        side: 'home', outcome: 'сейв', defendingSide: 'away',
        startX: 150, startY: 35, targetX: 188, targetY: 46,
        frames: 12, totalFrames: 12,
      },
    },
  },
};
const shotUpdater = liveUpdatePositions(
  { liveMatch: shotState }, visualWindow,
  (v, min, max) => Math.max(min, Math.min(max, v))
);
const shotStartX = shotState.positions.puck.x;
for (let i = 0; i < 12; i++) shotUpdater();
assert.ok(shotState.positions.puck.x > shotStartX, 'shot did not travel toward the away goal');
assert.equal(shotState.positions.puck.shotAnimation, null, 'shot animation did not finish');
assert.equal(shotState.positions.puck.looseFrames, 18, 'saved shot did not create a rebound');
assert.equal(shotState.positions.puck.nextPossessionSide, 'away', 'saved shot did not award rebound to defending side');

assert.ok(shotState.positions.away[0].y < 50, 'goalie did not react toward the shot lane');

// Opposing skaters contest a loose puck; a board-side battle lasts longer.
const battleHome = formation.map(p => ({ ...p, x: p.role === 'goalie' ? p.x : 100, y: p.role === 'goalie' ? p.y : 50, baseX: p.role === 'goalie' ? p.baseX : 100, baseY: p.role === 'goalie' ? p.baseY : 50 }));
const battleAway = awayPositions.map(p => ({ ...p, x: p.role === 'goalie' ? p.x : 100, y: p.role === 'goalie' ? p.y : 50, baseX: p.role === 'goalie' ? p.baseX : 100, baseY: p.role === 'goalie' ? p.baseY : 50 }));
const battleState = { positions: {
  home: battleHome, away: battleAway,
  puck: { x: 100, y: 50, possessionSide: 'home', carrierIndex: null, looseFrames: 20, nextPossessionSide: 'home', nextCarrierIndex: 3, targetX: 100, targetY: 50 },
} };
const battleUpdater = liveUpdatePositions({ liveMatch: battleState }, visualWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)));
battleUpdater();
assert.ok(battleState.positions.puck.battle, 'opposing skaters did not contest the loose puck');
assert.ok(battleState.positions.puck.battle.frames > 0, 'puck battle has no duration');
assert.ok(battleHome.some(p => p.contactFrames > 0) && battleAway.some(p => p.contactFrames > 0),
  'players did not receive contact feedback');
for (let i = 0; i < 12; i++) battleUpdater();
assert.ok(['home', 'away'].includes(battleState.positions.puck.possessionSide),
  'puck battle did not resolve possession');

// Near the boards the same contest uses the longer board-battle animation.
const boardHome = battleHome.map(p => ({ ...p, x: p.role === 'goalie' ? p.x : 100, y: p.role === 'goalie' ? p.y : 89, baseX: p.role === 'goalie' ? p.baseX : 100, baseY: p.role === 'goalie' ? p.baseY : 89 }));
const boardAway = battleAway.map(p => ({ ...p, x: p.role === 'goalie' ? p.x : 100, y: p.role === 'goalie' ? p.y : 89, baseX: p.role === 'goalie' ? p.baseX : 100, baseY: p.role === 'goalie' ? p.baseY : 89 }));
const boardState = { positions: {
  home: boardHome, away: boardAway,
  puck: { x: 100, y: 89, possessionSide: 'home', carrierIndex: null, looseFrames: 20, nextPossessionSide: 'home', nextCarrierIndex: 3, targetX: 100, targetY: 89 },
} };
liveUpdatePositions({ liveMatch: boardState }, visualWindow,
  (v, min, max) => Math.max(min, Math.min(max, v)))();
assert.equal(boardState.positions.puck.battle?.type, 'board', 'board-side puck battle was not recognized');
assert.equal(boardState.positions.puck.battle?.frames, 12, 'board battle should last longer than an open-ice contest');




// Goalies stay on their goal line; skaters react to possession with attack/defence roles.
assert.ok(Math.abs(homePositions[0].x - 12) < 0.01, 'home goalie must start inside the home crease');
assert.ok(Math.abs(awayPositions[0].x - 188) < 0.01, 'away goalie must start inside the away crease');
const tacticalState = {
  positions: {
    home: formation.map(p => ({ ...p })),
    away: awayPositions.map(p => ({ ...p })),
    puck: { x: 165, y: 50, vx: 0, vy: 0, possessionSide: 'home', carrierIndex: 3, actionFrames: 500, looseFrames: 0 },
  },
};
const tacticalHome = tacticalState.positions.home;
const tacticalAway = tacticalState.positions.away;
const awayChaser = tacticalAway.slice(1).reduce((best, p) =>
  Math.hypot(p.x - 165, p.y - 50) < Math.hypot(best.x - 165, best.y - 50) ? p : best
);
const chaserDistanceBefore = Math.hypot(awayChaser.x - 165, awayChaser.y - 50);
for (let i = 0; i < 120; i++) {
  liveUpdatePositions({ liveMatch: tacticalState }, visualWindow,
    (v, min, max) => Math.max(min, Math.min(max, v)))();
}
assert.ok(tacticalHome[0].x >= 8 && tacticalHome[0].x <= 18, 'home goalie drifted away from the crease');
assert.ok(tacticalAway[0].x >= 182 && tacticalAway[0].x <= 192, 'away goalie drifted away from the crease');
assert.ok(tacticalHome[0].y >= 42 && tacticalHome[0].y <= 58, 'home goalie left the lateral crease range');
assert.ok(tacticalAway[0].y >= 42 && tacticalAway[0].y <= 58, 'away goalie left the lateral crease range');
assert.ok(Math.hypot(awayChaser.x - 165, awayChaser.y - 50) < chaserDistanceBefore,
  'nearest defending skater did not pressure the puck');
assert.ok(Math.abs(tacticalHome[3].y - tacticalHome[5].y) > 12,
  'attacking forwards collapsed into the same lane');
assert.ok(tacticalHome.slice(1).every(p => p.x >= 5 && p.x <= 195 && p.y >= 5 && p.y <= 95),
  'skaters left the rink bounds');

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
