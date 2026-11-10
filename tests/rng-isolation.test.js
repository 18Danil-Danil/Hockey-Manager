/*
 * RNG isolation regression test.
 * Run with: node tests/rng-isolation.test.js
 *
 * Protects the contract that cosmetic animation randomness never consumes
 * the gameplay RNG sequence. No game balance or save format is changed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const rngSource = fs.readFileSync(path.join(root, 'core/rng.js'), 'utf8');
const liveSource = fs.readFileSync(path.join(root, 'engine/live-match.js'), 'utf8');

const browserWindow = {};
vm.runInNewContext(rngSource, { window: browserWindow });
const api = browserWindow.GAME_RNG;

assert.ok(api, 'GAME_RNG must be exposed on window');
assert.equal(typeof api.rng, 'function');
assert.equal(typeof api.visualRng, 'function');
assert.equal(typeof api.setVisualSeed, 'function');

// Visual draws must not advance or otherwise alter the gameplay sequence.
api.setSeed(123456);
const expectedGameplay = Array.from({ length: 20 }, () => api.rng());
api.setSeed(123456);
api.setVisualSeed(987654);
for (let i = 0; i < 5000; i++) api.visualRng();
const actualGameplay = Array.from({ length: 20 }, () => api.rng());
assert.deepEqual(actualGameplay, expectedGameplay,
  'visual RNG calls changed the gameplay RNG sequence');

// Gameplay draws must not advance or otherwise alter the visual sequence.
api.setVisualSeed(246810);
const expectedVisual = Array.from({ length: 20 }, () => api.visualRng());
api.setVisualSeed(246810);
api.setSeed(13579);
for (let i = 0; i < 5000; i++) api.rng();
const actualVisual = Array.from({ length: 20 }, () => api.visualRng());
assert.deepEqual(actualVisual, expectedVisual,
  'gameplay RNG calls changed the visual RNG sequence');

// Guard the animation update itself: it may use visualRng, never gameplay rng.
const updateStart = liveSource.indexOf('function liveUpdatePositions()');
const updateEnd = liveSource.indexOf('function liveAnimationLoop()', updateStart);
assert.ok(updateStart >= 0 && updateEnd > updateStart,
  'liveUpdatePositions() or its boundary was not found');
const visualUpdate = liveSource.slice(updateStart, updateEnd);
assert.match(visualUpdate, /visualRng\(\)/,
  'liveUpdatePositions() must use visualRng()');
assert.doesNotMatch(visualUpdate, /\brng\s*\(/,
  'liveUpdatePositions() must not consume gameplay rng()');

console.log('RNG isolation checks passed.');
