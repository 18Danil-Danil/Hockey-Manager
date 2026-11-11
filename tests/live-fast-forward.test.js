/*
 * Regression checks for LIVE fast-forward.
 * Run with: node tests/live-fast-forward.test.js
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

const exitSource = extract('exitLiveMatchEarly', 'closeLiveMatchModal');
const resumeSource = extract('liveResumeFromBreak', 'finishLiveMatch');
const LIVE_TICK_SEC = 5;
const LIVE_PERIOD_SEC = 120;

function runScenario(startPeriod, tiedAtRegulationEnd = false) {
  const lm = {
    intervalId: 123, paused: false, isBreak: false, isFinished: false,
    period: startPeriod, timeLeft: 10, totalSecPlayed: (startPeriod - 1) * LIVE_PERIOD_SEC,
    hg: 1, ag: 0, periodStarts: [], xgCurrent: { home: 2, away: 2 },
    homeId: 'h', awayId: 'a', homeLineup: { skaters: [] }, awayLineup: { skaters: [] },
    penalties: { home: [], away: [] }, events: [], pbp: [],
  };
  const stats = { goals: 0, assists: 0, shots: 0, penalties: 0, goalieUpdates: 0 };
  let cleared = 0, renders = 0, intervalStarts = 0, advanceCalls = 0, resumed = 0;
  const G = { liveMatch: lm, league: { teams: [
    { id: 'h', tactics: {} }, { id: 'a', tactics: {} },
  ] } };

  const liveAdvance = seconds => {
    advanceCalls++;
    lm.timeLeft -= seconds;
    lm.totalSecPlayed += seconds;
    // Deterministic event crediting represents the normal liveGoal/livePenalty path.
    if (advanceCalls % 2 === 0) {
      stats.goals++;
      stats.assists++;
      stats.shots++;
      lm.hg++;
    }
    if (advanceCalls % 3 === 0) stats.penalties++;
    if (lm.timeLeft <= 0) {
      if (lm.period < 3) lm.isBreak = true;
      else if (lm.hg === lm.ag && tiedAtRegulationEnd) {
        lm.period = 4;
        lm.timeLeft = 10;
        lm.ot = true;
      } else {
        lm.isFinished = true;
        stats.goalieUpdates++;
      }
    }
    if (lm.period === 4 && lm.timeLeft <= 0) {
      lm.isFinished = true;
      stats.goalieUpdates++;
    }
  };
  const liveResumeFromBreak = options => {
    if (!lm.isBreak || lm.isFinished) return false;
    resumed++;
    lm.period++;
    lm.timeLeft = lm.period === 4 ? 10 : LIVE_PERIOD_SEC;
    lm.periodStarts.push(lm.totalSecPlayed);
    lm.isBreak = false;
    lm.paused = false;
    if (options.startInterval !== false) intervalStarts++;
    if (options.render !== false) renders++;
    return true;
  };
  const liveEndPeriod = () => { lm.isFinished = true; };
  const finishLiveMatch = () => { lm.isFinished = true; stats.goalieUpdates++; };
  const exit = new Function(
    'G', 'clearInterval', 'LIVE_TICK_SEC', 'liveResumeFromBreak',
    'liveAdvance', 'liveEndPeriod', 'finishLiveMatch',
    `${exitSource}; return exitLiveMatchEarly;`
  )(G, () => { cleared++; }, LIVE_TICK_SEC, liveResumeFromBreak,
    liveAdvance, liveEndPeriod, finishLiveMatch);

  exit();
  assert.equal(cleared, 1, 'existing interval must be stopped');
  assert.equal(lm.isFinished, true, 'fast-forward must finish the game');
  assert.ok(advanceCalls > 0, 'fast-forward must use normal live simulation ticks');
  assert.ok(stats.goals > 0 && stats.assists > 0 && stats.shots > 0,
    'normal event/stat handlers must run during fast-forward');
  assert.ok(stats.penalties > 0, 'penalty processing must continue during fast-forward');
  assert.ok(stats.goalieUpdates > 0, 'goalie finalization must run');
  assert.equal(intervalStarts, 0, 'fast-forward must not restart the timer');
  assert.equal(renders, 0, 'fast-forward must not render every simulated period');
  assert.ok(resumed > 0, 'period breaks must be crossed automatically');
  return { advanceCalls, resumed, stats };
}

const regular = runScenario(1, false);
assert.ok(regular.resumed >= 2, 'regular-time fast-forward must cross both intermissions');
const overtime = runScenario(3, true);
assert.ok(overtime.advanceCalls >= 3, 'overtime scenario must continue through extra time');
console.log('LIVE fast-forward stat recording checks passed.');
