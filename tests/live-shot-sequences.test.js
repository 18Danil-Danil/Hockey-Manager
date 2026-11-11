/*
 * LIVE shot-sequence regression checks.
 * Run with: node tests/live-shot-sequences.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const start = source.indexOf('function getLiveBreakawayThreat(');
const end = source.indexOf('function liveAdvance(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE shot-sequence helpers');

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
let rolls = [];
const rng = () => rolls.length ? rolls.shift() : 0.99;
const events = [];
const statsFor = player => (player.stats ||= {});
const helpers = new Function(
  'rng', 'clamp', 'pickWeighted', 'shotWeight', 'ensureStats', 'ensurePlayoffStats',
  'livePushEvent', 'liveFmtTime',
  source.slice(start, end) + '; return { getLiveBreakawayThreat, getLiveShotOpportunity, resolveLiveShotRebound };'
)(
  rng, clamp, players => players[0], () => 1, statsFor, statsFor,
  event => events.push(event), () => '08:12'
);

const carrier = { id: 'carrier', name: 'Нападающий', ovr: 78, attrs: { passing: 85, physical: 75, skating: 85, iq: 80 } };
const slotForward = { id: 'slot', name: 'Центр', ovr: 82, attrs: { physical: 80, skating: 88, iq: 85, defense: 65 } };
const defender = { id: 'defender', name: 'Защитник', ovr: 75, attrs: { physical: 78, skating: 76, iq: 75, defense: 80 } };
const homeGoalie = { id: 'hg', name: 'Вратарь хозяев', ovr: 80, attrs: { reflexes: 80, reboundControl: 82 } };
const awayGoalie = { id: 'ag', name: 'Вратарь гостей', ovr: 80, attrs: { reflexes: 80, reboundControl: 82 } };

const lm = {
  isPlayoff: false, homeId: 'home', awayId: 'away', period: 2, timeLeft: 492,
  homeLineup: { skaters: [carrier, slotForward], goalie: homeGoalie },
  awayLineup: { skaters: [defender], goalie: awayGoalie },
  positions: {
    home: [
      { role: 'goalie', playerId: 'hg', onIce: true, x: 12, y: 50 },
      { role: 'F', playerId: 'carrier', onIce: true, x: 160, y: 50 },
      { role: 'C', playerId: 'slot', onIce: true, x: 178, y: 50 },
    ],
    away: [
      { role: 'goalie', playerId: 'ag', onIce: true, x: 188, y: 50 },
      { role: 'D', playerId: 'defender', onIce: true, x: 180, y: 50 },
    ],
    puck: { x: 160, y: 50 },
  },
  gameplayPossession: { side: 'home', playerId: 'carrier' },
};

assert.equal(helpers.getLiveBreakawayThreat(lm, 'home'), null,
  'a defender in front should prevent a breakaway');
lm.positions.away[1].x = 190;
assert.equal(helpers.getLiveBreakawayThreat(lm, 'home'), 'carrier',
  'a clear lane in the attacking zone should create a breakaway threat');
let opportunity = helpers.getLiveShotOpportunity(lm, 'home', [carrier, slotForward], lm.positions.puck);
assert.equal(opportunity.type, 'breakaway');
assert.equal(opportunity.shooter.id, 'carrier');

// Move a defender close enough to close the breakaway lane; a skilled carrier
// should be able to find the teammate stationed in the slot.
lm.positions.away[1].x = 174;
rolls = [0];
opportunity = helpers.getLiveShotOpportunity(lm, 'home', [carrier, slotForward], lm.positions.puck);
assert.equal(opportunity.type, 'slot');
assert.equal(opportunity.passer.id, 'carrier');
assert.equal(opportunity.shooter.id, 'slot');
assert.equal(opportunity.slotPass, true);

// A saved shot creates a real rebound contest and updates gameplay possession.
lm.positions.home[1].x = 176;
lm.positions.home[2].x = 180;
lm.positions.away[1].x = 178;
lm.gameplayPossession = { side: 'home', playerId: 'slot' };
rolls = [0.99, 0]; // goalie does not freeze it; attacker wins the contested rebound
const rebound = helpers.resolveLiveShotRebound(lm, 'home', slotForward, 'сейв', 50);
assert.equal(rebound.side, 'home');
assert.equal(lm.gameplayPossession.side, 'home');
assert.equal(lm.gameplayPossession.playerId, 'slot');
assert.equal(slotForward.stats.reboundRecoveries, 1);
assert.equal(slotForward.stats.reboundBattlesWon, 1);
assert.ok(events.some(event => event.type === 'rebound' && event.winnerId === 'slot'));

// A controlled save belongs to the goalie, not an arbitrary skater.
rolls = [0];
const covered = helpers.resolveLiveShotRebound(lm, 'home', slotForward, 'сейв', 50);
assert.equal(covered.frozen, true);
assert.equal(covered.side, 'away');
assert.equal(covered.carrierIndex, 0);
assert.equal(lm.gameplayPossession.side, 'away');
assert.equal(lm.gameplayPossession.playerId, null);
assert.equal(awayGoalie.stats.reboundCovers, 1);
assert.ok(events.some(event => event.type === 'goalie_cover'));

console.log('LIVE shot-sequence checks passed.');
