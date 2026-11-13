const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'data/player-rating-model.js'), 'utf8');
const sandbox = {
  console,
  window: {},
  SKATER_ATTRS: ['skating', 'shooting', 'passing', 'defense', 'physical', 'iq'],
  GOALIE_ATTRS: ['reflexes', 'positioning', 'glove', 'stick', 'iq'],
  overallFromAttrs(attrs, isGoalie) {
    return isGoalie
      ? Math.round(attrs.reflexes * .3 + attrs.positioning * .3 + attrs.glove * .15 + attrs.stick * .15 + attrs.iq * .1)
      : Math.round(attrs.skating * .15 + attrs.shooting * .2 + attrs.passing * .2 + attrs.defense * .2 + attrs.physical * .1 + attrs.iq * .15);
  }
};
sandbox.window = sandbox;
vm.runInNewContext(source, sandbox);

const data = {
  players: {
    f1: { position: 'forward', seasons: [{ season: '25/26', stage: 'regular', gp: 50, goals: 25, assists: 30, points: 55, shots: 150, shootingPct: 16.7, plusMinus: 20, hits: 25, blocks: 10, pim: 10, toiPerGame: 19, shiftsPerGame: 25 }] },
    f2: { position: 'forward', seasons: [{ season: '25/26', stage: 'regular', gp: 50, goals: 10, assists: 15, points: 25, shots: 100, shootingPct: 10, plusMinus: 0, hits: 15, blocks: 15, pim: 20, toiPerGame: 15, shiftsPerGame: 20 }] },
    f3: { position: 'forward', seasons: [{ season: '25/26', stage: 'regular', gp: 50, goals: 2, assists: 5, points: 7, shots: 40, shootingPct: 5, plusMinus: -15, hits: 5, blocks: 5, pim: 30, toiPerGame: 10, shiftsPerGame: 15 }] },
    d1: { position: 'defense', seasons: [{ season: '25/26', stage: 'regular', gp: 50, goals: 8, assists: 25, points: 33, shots: 90, shootingPct: 8.9, plusMinus: 18, hits: 70, blocks: 100, pim: 30, toiPerGame: 23, shiftsPerGame: 30 }] },
    d2: { position: 'defense', seasons: [{ season: '25/26', stage: 'regular', gp: 50, goals: 2, assists: 8, points: 10, shots: 35, shootingPct: 5.7, plusMinus: -10, hits: 20, blocks: 30, pim: 12, toiPerGame: 14, shiftsPerGame: 18 }] },
    g1: { position: 'goaltender', seasons: [{ season: '25/26', stage: 'regular', gp: 40, wins: 28, shotsAgainst: 1000, saves: 940, goalsAgainst: 60, savePct: 94, gaa: 1.5, shutouts: 6, minutes: 2400 }] },
    g2: { position: 'goaltender', seasons: [{ season: '25/26', stage: 'regular', gp: 40, wins: 12, shotsAgainst: 1000, saves: 890, goalsAgainst: 110, savePct: 89, gaa: 2.75, shutouts: 1, minutes: 2400 }] }
  }
};
sandbox.VHL_PLAYER_STATS_DATA = data;
const index = sandbox.buildVhlRatingIndex(data);
assert.equal(index.size, 7);
const strongForward = sandbox.makeVhlRating('f1', { ratings: { att: 74, def: 70, gk: 68 } }, 22);
const weakForward = sandbox.makeVhlRating('f3', { ratings: { att: 74, def: 70, gk: 68 } }, 22);
assert.ok(strongForward.ovr > weakForward.ovr, 'stronger statistical forward should receive a higher OVR');
assert.ok(strongForward.pot >= strongForward.ovr, 'potential must not be lower than current OVR');
assert.ok(strongForward.attrs.shooting > weakForward.attrs.shooting, 'goal and shot production should affect shooting');
const strongDefender = sandbox.makeVhlRating('d1', { ratings: { att: 70, def: 76, gk: 68 } }, 27);
const weakDefender = sandbox.makeVhlRating('d2', { ratings: { att: 70, def: 76, gk: 68 } }, 27);
assert.ok(strongDefender.attrs.defense > weakDefender.attrs.defense, 'defensive production should affect defense attribute');
const strongGoalie = sandbox.makeVhlRating('g1', { ratings: { att: 70, def: 70, gk: 75 } }, 24);
const weakGoalie = sandbox.makeVhlRating('g2', { ratings: { att: 70, def: 70, gk: 75 } }, 24);
assert.ok(strongGoalie.ovr > weakGoalie.ovr, 'better save percentage and GAA should raise goalie OVR');
assert.ok(strongGoalie.attrs.reflexes > weakGoalie.attrs.reflexes);
assert.equal(sandbox.makeVhlRating('missing', { ratings: { att: 70, def: 70, gk: 70 } }, 20), null);
console.log('VHL player rating model checks passed.');
