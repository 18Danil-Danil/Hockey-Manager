/*
 * LIVE contact-injury regression checks.
 * Run with: node tests/live-contact-injuries.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('engine/live-match.js', 'utf8');
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const reconcileStart = source.indexOf('function reconcileLiveManpower(');
const reconcileEnd = source.indexOf('function updateLiveShifts(', reconcileStart);
assert.ok(reconcileStart >= 0 && reconcileEnd > reconcileStart, 'Could not locate manpower reconciliation');
const getLiveManpowerState = () => ({ home: { skaters: 5 }, away: { skaters: 5 } });
const reconcileLiveManpower = new Function('getLiveManpowerState', 'clamp', 'getLivePlayerSurname',
  source.slice(reconcileStart, reconcileEnd) + '; return reconcileLiveManpower;'
)(getLiveManpowerState, clamp, player => player?.surname || String(player?.name || '').split(/\s+/)[0] || '');

const start = source.indexOf('function getLiveContactRating(');
const end = source.indexOf('function resolveLiveShotBlock(', start);
assert.ok(start >= 0 && end > start, 'Could not locate LIVE contact/injury helpers');
let rolls = [0, 0, 0, 0, 0, 0];
const rng = () => rolls.length ? rolls.shift() : 0.99;
const events = [];
const inbox = [];
const news = [];
const penalties = [];
const statsFor = player => (player.stats ||= {});
const G = {
  playerTeamId: 'home',
  league: { teams: [
    { id: 'home', name: 'Home', tactics: { physical: 100 }, infrastructure: { medical: 0 }, staff: { doctor: { level: 0 } } },
    { id: 'away', name: 'Away', tactics: { physical: 50 }, infrastructure: { medical: 0 }, staff: {} },
  ] },
};
const api = new Function(
  'clamp', 'rng', 'G', 'ensureStats', 'ensurePlayoffStats',
  'livePushEvent', 'liveFmtTime', 'livePenalty', 'LIVE_TICK_SEC',
  'reconcileLiveManpower', 'addNews', 'addInboxMessage',
  source.slice(start, end) + '; return { applyLiveContactInjury, resolveLivePhysicalContact };'
)(
  clamp, rng, G, statsFor, statsFor,
  event => events.push(event), () => '04:20', (...args) => penalties.push(args), 5,
  reconcileLiveManpower, (...args) => news.push(args), (...args) => inbox.push(args)
);

const carrier = {
  id: 'carrier', name: 'Уставший нападающий', position: 'F', ovr: 65,
  fatigue: 90, attrs: { physical: 40, skating: 40, defense: 40, iq: 40 },
};
const hitter = {
  id: 'hitter', name: 'Силовой защитник', position: 'D', ovr: 90,
  attrs: { physical: 95, skating: 90, defense: 90, iq: 80 },
};
const d1 = { id: 'd1', name: 'Защитник 1', position: 'D', ovr: 60 };
const d2 = { id: 'd2', name: 'Защитник 2', position: 'D', ovr: 60 };
const f2 = { id: 'f2', name: 'Нападающий 2', position: 'F', ovr: 60 };
const f3 = { id: 'f3', name: 'Нападающий 3', position: 'F', ovr: 60 };
const replacement = { id: 'replacement', name: 'Запасной нападающий', position: 'F', ovr: 58 };
const lm = {
  homeId: 'home', awayId: 'away', isPlayoff: false, period: 2, timeLeft: 260, totalSecPlayed: 2740,
  gameplayPossession: { side: 'home', playerId: carrier.id },
  homeLineup: { skaters: [d1, d2, carrier, f2, f3, replacement] },
  awayLineup: { skaters: [hitter] },
  penalties: { home: [], away: [] },
  playerStamina: { home: { carrier: 20 }, away: { hitter: 95 } },
  positions: {
    home: [
      { role: 'goalie', onIce: true, playerId: 'hg' },
      { role: 'F', playerId: carrier.id, onIce: true, x: 100, y: 50 },
      { role: 'D', playerId: d1.id, onIce: true, x: 95, y: 35 },
      { role: 'D', playerId: d2.id, onIce: true, x: 95, y: 65 },
      { role: 'F', playerId: f2.id, onIce: true, x: 105, y: 25 },
      { role: 'F', playerId: f3.id, onIce: true, x: 105, y: 75 },
    ],
    away: [
      { role: 'goalie', onIce: true, playerId: 'ag' },
      { role: 'D', playerId: hitter.id, onIce: true, x: 102, y: 50 },
    ],
    puck: { x: 100, y: 50, carrierIndex: 1, possessionSide: 'home', looseFrames: 0 },
  },
};

assert.equal(api.resolveLivePhysicalContact(lm, 5), true, 'the contact should resolve');
assert.equal(carrier.injury?.severity, 'major', 'a severe deterministic contact should produce a major injury');
assert.equal(carrier.injury?.gamesLeft, 8, 'major injury duration should use the configured game range');
assert.equal(carrier.injury?.source, 'live_contact');
assert.equal(carrier.playingThroughPain, false);
assert.equal(lm.positions.home.some(slot => slot.playerId === carrier.id && slot.onIce !== false), false,
  'the injured player must leave the ice immediately');
assert.equal(lm.positions.home.some(slot => slot.playerId === replacement.id && slot.onIce !== false), true,
  'a healthy reserve should replace the injured player');
assert.equal(lm.positions.puck.carrierIndex, null,
  'the puck carrier index must be cleared when the injured carrier is substituted');
assert.ok(events.some(event => event.type === 'injury' && event.playerId === carrier.id));
assert.ok(events.some(event => event.type === 'body_check' && event.injury === true));
assert.equal(inbox.length, 1, 'the controlled club should receive a medical inbox notice');
assert.equal(news.length, 1, 'a notable injury should be added to league news');
assert.equal(hitter.stats.hits, 1);
assert.equal(carrier.stats.hitsReceived, 1);

const sourceFilter = source.includes("&& (!player.injury || player.injury.gamesLeft <= 0 || player.playingThroughPain)");
assert.ok(sourceFilter, 'manpower selection must exclude unavailable injured players');
console.log('LIVE contact-injury checks passed.');
