import assert from 'node:assert/strict';
import { findSuspiciousCrossSeasonDuplicates } from '../tools/player-stats-quality.mjs';

const clean = {
  '10': {
    seasons: [
      { season: '25/26', stage: 'regular', team: 'A', gp: 20, goals: 5, points: 10 },
      { season: '24/25', stage: 'regular', team: 'A', gp: 18, goals: 4, points: 8 }
    ]
  }
};
assert.equal(findSuspiciousCrossSeasonDuplicates(clean).length, 0);

const duplicated = {
  '20': {
    seasons: [
      { season: '25/26', stage: 'regular', team: 'B', gp: 12, goals: 3, points: 7 },
      { season: '24/25', stage: 'playoff', team: 'B', gp: 12, goals: 3, points: 7 }
    ]
  }
};
const found = findSuspiciousCrossSeasonDuplicates(duplicated);
assert.equal(found.length, 1);
assert.equal(found[0].playerId, '20');
assert.equal(found[0].first.season, '25/26');
assert.equal(found[0].repeated.season, '24/25');

const differentTeams = {
  '30': {
    seasons: [
      { season: '25/26', stage: 'regular', team: 'A', gp: 10, goals: 2, points: 4 },
      { season: '25/26', stage: 'regular', team: 'B', gp: 10, goals: 2, points: 4 }
    ]
  }
};
assert.equal(findSuspiciousCrossSeasonDuplicates(differentTeams).length, 0);

console.log('Player stats quality checks passed.');
