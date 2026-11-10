/*
 * Match ratings must use the actual available lineup, including the selected goalie.
 * Run with: node tests/lineup-ratings.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tacticsSource = fs.readFileSync(path.join(__dirname, '..', 'engine/tactics.js'), 'utf8');
function extract(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = nextName ? source.indexOf(`function ${nextName}(`, start) : source.length;
  assert.ok(start >= 0 && (!nextName || end > start), `Could not locate ${name}()`);
  return source.slice(start, end);
}
const getLineupSource = extract(tacticsSource, 'getLineup', 'tacticMods');
const shouldRestSource = extract(tacticsSource, 'shouldRestGoalie', 'getLineup');
const ratingsSource = extract(tacticsSource, 'teamAttackRating', 'shouldRestGoalie');
const getLineup = new Function('syncLines', 'getEffectiveOvr', 'shouldRestGoalie',
  `${shouldRestSource}; ${getLineupSource}; return getLineup;`)(
    () => {}, p => p.ovr, (starter, backup) => !!starter.lastGameBad
  );
const ratings = new Function('getEffectiveOvr', 'getLineup',
  `${ratingsSource}; return { teamAttackRating, teamDefenseRating };`)(
    p => p.ovr, getLineup
  );

function player(id, position, ovr, extra = {}) {
  return { id, position, ovr, form: 50, injury: null, ...extra };
}
function makeTeam(prefix = 't') {
  const forwards = Array.from({length: 12}, (_, i) => player(`${prefix}f${i}`, 'F', 70));
  // These two players are assigned to lines but cannot play.
  forwards[0].ovr = 99;
  forwards[0].injury = { gamesLeft: 2 };
  forwards[1].ovr = 98;
  const defense = Array.from({length: 6}, (_, i) => player(`${prefix}d${i}`, 'D', 70));
  const badStarter = player(`${prefix}g1`, 'G', 99, { lastGameBad: true });
  const selectedGoalie = player(`${prefix}g2`, 'G', 65);
  const roster = [...forwards, ...defense, badStarter, selectedGoalie];
  return {
    roster,
    bench: [forwards[1].id],
    lines: {
      f1: { players: forwards.slice(0,3).map(p => p.id) },
      f2: { players: forwards.slice(3,6).map(p => p.id) },
      f3: { players: forwards.slice(6,9).map(p => p.id) },
      f4: { players: forwards.slice(9,12).map(p => p.id) },
      d1: { players: defense.slice(0,2).map(p => p.id) },
      d2: { players: defense.slice(2,4).map(p => p.id) },
      d3: { players: defense.slice(4,6).map(p => p.id) },
      g1: badStarter.id,
      g2: selectedGoalie.id,
    },
  };
}

// Injured and benched skaters are excluded by the real lineup builder.
const team = makeTeam();
const lineup = getLineup(team);
assert.equal(lineup.forwards.length, 10);
assert.ok(!lineup.forwards.some(p => p.id === team.roster[0].id), 'injured forward entered lineup');
assert.ok(!lineup.forwards.some(p => p.id === team.roster[1].id), 'benched forward entered lineup');
assert.equal(lineup.goalie.id, team.roster[19].id, 'selected healthy backup goalie was not used');
assert.equal(ratings.teamAttackRating(team, lineup), 70, 'inactive high-rated forwards affected attack rating');

// Defensive rating must use the actual six defenders and selected goalie, not the roster best goalie.
const expectedGoalieValue = 65 * 0.7 + 50 * 0.3;
const expectedDefense = 70 * 0.7 + expectedGoalieValue * 0.3;
assert.ok(Math.abs(ratings.teamDefenseRating(team, lineup) - expectedDefense) < 1e-9);

// Equal lineups must produce equal ratings.
const teamB = makeTeam('b');
const lineupB = getLineup(teamB);
assert.equal(ratings.teamAttackRating(team, lineup), ratings.teamAttackRating(teamB, lineupB));
assert.equal(ratings.teamDefenseRating(team, lineup), ratings.teamDefenseRating(teamB, lineupB));

// Empty or incomplete lineups must never produce NaN/Infinity.
const incomplete = { forwards: [], defense: [], goalie: null, skaters: [] };
assert.equal(ratings.teamAttackRating(team, incomplete), 50);
assert.equal(ratings.teamDefenseRating(team, incomplete), 50 * 0.7 + 60 * 0.3);
assert.ok(Number.isFinite(ratings.teamAttackRating(team, { forwards: [player('bad','F',NaN)] })));
assert.ok(Number.isFinite(ratings.teamDefenseRating(team, { defense: [player('badD','D',NaN)], goalie: player('badG','G',NaN) })));

console.log('Lineup rating checks passed.');
