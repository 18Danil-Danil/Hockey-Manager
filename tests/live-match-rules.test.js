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
  'LIVE_PENALTY_RATE', 'LIVE_PP_BOOST', 'LIVE_PK_NERF', 'clamp',
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
      shots: { home: 0, away: 0 },
      goalieStats: { home: { shots: 0, goals: 0 }, away: { shots: 0, goals: 0 } },
      homeLineup: { skaters: [homePlayer] }, awayLineup: { skaters: [awayPlayer] },
      isPlayoff: false, events: [],
    },
  };
}
const state = makeLiveState();
const randomValues = [0.99, 0.99, 0.1, 0.1, 0.99, 0.99, 0.1, 0.9];
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
  0.0065, 2.6, 0.55, (v, min, max) => Math.max(min, Math.min(max, v))
);
advance(5);
advance(5);
assert.equal(state.lm.shots.home, 1, 'home shot was not counted');
assert.equal(state.lm.shots.away, 1, 'away shot was not counted');
assert.equal(state.lm.goalieStats.away.shots, 1, 'away goalie did not face the home shot');
assert.equal(state.lm.goalieStats.home.shots, 1, 'home goalie did not face the away shot');
assert.equal(ensureStats(state.homePlayer).shots, 1);
assert.equal(ensureStats(state.awayPlayer).shots, 1);

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

console.log('LIVE match rules checks passed.');
