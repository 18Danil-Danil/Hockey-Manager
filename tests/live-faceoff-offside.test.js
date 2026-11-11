const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/live-match.js'), 'utf8');

function extract(name, next) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${next}(`, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${name}()`);
  return source.slice(start, end);
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [];
const rng = () => rolls.length ? rolls.shift() : 0.5;
const events = [];
const api = new Function(
  'clamp', 'rng', 'liveFmtTime', 'livePushEvent', 'ensureStats',
  'ensurePlayoffStats', 'homeTeamNameShort', 'awayTeamNameShort',
  `${extract('getLiveFaceoffCenter', 'resolveLiveFaceoff')}
   ${extract('resolveLiveFaceoff', 'resolveLiveOffside')}
   ${extract('resolveLiveOffside', 'liveAdvance')}
   return { getLiveFaceoffCenter, resolveLiveFaceoff, resolveLiveOffside };`
)(
  clamp, rng, () => '12:34', event => events.push(event),
  player => player.stats ||= {}, player => player.playoffStats ||= {},
  () => 'HOME', () => 'AWAY'
);

function makeSide(side, rating) {
  const players = [
    { id: side + '-d1', name: 'Defender 1', position: 'D', attrs: { faceoff: 40 } },
    { id: side + '-d2', name: 'Defender 2', position: 'D', attrs: { faceoff: 40 } },
    { id: side + '-w1', name: 'Wing 1', position: 'LW', attrs: { faceoff: 40 } },
    { id: side + '-c', name: 'Center ' + side, position: 'C', attrs: { faceoff: rating } },
    { id: side + '-w2', name: 'Wing 2', position: 'RW', attrs: { faceoff: 40 } },
  ];
  return {
    lineup: { skaters: players },
    slots: [
      { role: 'goalie', playerId: side + '-g', onIce: true, x: side === 'home' ? 10 : 190, y: 50 },
      ...players.map((player, index) => ({
        role: player.position === 'C' ? 'C' : player.position === 'D' ? 'D' : 'F',
        position: player.position, playerId: player.id, onIce: true,
        x: side === 'home' ? 50 + index * 5 : 150 - index * 5,
        y: 25 + index * 10, vx: 0, vy: 0,
      })),
    ],
  };
}

const home = makeSide('home', 90);
const away = makeSide('away', 45);
const lm = {
  homeLineup: home.lineup, awayLineup: away.lineup,
  positions: { home: home.slots, away: away.slots, puck: {} },
  penalties: { home: [], away: [] }, totalSecPlayed: 0,
  timeLeft: 754, period: 2, isPlayoff: false,
  gameplayPossession: null,
};
rolls = [0.1];
const faceoff = api.resolveLiveFaceoff(lm, 'тест', { x: 135, y: 50 });
assert.equal(faceoff.winner, 'home', 'higher faceoff rating should materially improve the draw chance');
assert.equal(lm.gameplayPossession.side, 'home');
assert.equal(lm.positions.puck.x, 135);
assert.equal(lm.positions.puck.y, 50);
assert.equal(lm.positions.puck.carrierIndex, 4);
assert.equal(lm.positions.puck.looseFrames, 0);
assert.equal(lm.homeLineup.skaters.find(p => p.position === 'C').stats.faceoffsWon, 1);
assert.equal(lm.awayLineup.skaters.find(p => p.position === 'C').stats.faceoffsLost, 1);
assert.equal(events.at(-1).type, 'faceoff');

// Home attacks to the right: a teammate already beyond x=140 when the puck
// crosses that blue line is offside. The puck carrier is not counted as a
// second attacker because the carrier controls the puck itself.
const offsideLm = {
  ...lm,
  positions: {
    home: [
      { role: 'goalie', onIce: true },
      { role: 'D', playerId: 'h1', onIce: true, x: 150, y: 35 },
      { role: 'D', playerId: 'h2', onIce: true, x: 125, y: 65 },
      { role: 'F', playerId: 'h3', onIce: true, x: 155, y: 50 },
      { role: 'C', playerId: 'hc', onIce: true, x: 142, y: 50 },
    ],
    away: away.slots,
    puck: { x: 141, y: 50, lastRuleX: 139, possessionSide: 'home', carrierIndex: 4, looseFrames: 0 },
  },
  gameplayPossession: { side: 'home', playerId: 'hc' },
};
rolls = [0.8];
assert.equal(api.resolveLiveOffside(offsideLm), true);
assert.equal(events.at(-2).type, 'offside');
assert.equal(events.at(-1).type, 'faceoff');
assert.equal(offsideLm.positions.puck.x, 135);
assert.equal(offsideLm.positions.puck.looseFrames, 0);

// No stoppage when no teammate is ahead of the puck at the line.
const cleanLm = {
  ...offsideLm,
  positions: {
    ...offsideLm.positions,
    home: offsideLm.positions.home.map((slot, index) =>
      index === 3 ? { ...slot, x: 130 } : slot),
    puck: { ...offsideLm.positions.puck, x: 141, lastRuleX: 139 },
  },
  gameplayPossession: { side: 'home', playerId: 'hc' },
};
rolls = [0.4];
assert.equal(api.resolveLiveOffside(cleanLm), false);
assert.equal(cleanLm.positions.puck.lastRuleX, 141);

// Away attacks to the left; the same blue-line rule must be mirrored.
const awayOffside = {
  ...offsideLm,
  positions: {
    ...offsideLm.positions,
    away: away.slots.map((slot, index) =>
      index === 2 ? { ...slot, x: 45 } : slot),
    puck: { x: 59, y: 50, lastRuleX: 61, possessionSide: 'away', carrierIndex: 4, looseFrames: 0 },
  },
  gameplayPossession: { side: 'away', playerId: away.slots[4].playerId },
};
rolls = [0.6];
assert.equal(api.resolveLiveOffside(awayOffside), true, 'away-side offside must be mirrored');
assert.equal(awayOffside.positions.puck.x, 65);

console.log('LIVE faceoff and offside checks passed.');
