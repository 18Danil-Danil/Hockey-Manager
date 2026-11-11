const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'engine/live-match.js'), 'utf8');
const screen = fs.readFileSync(path.join(root, 'ui/live-match-screen.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

const helperStart = engine.indexOf('function getLiveCanvasResolution(');
const helperEnd = engine.indexOf('function drawLiveCanvas(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'canvas resolution helper must exist');
const helperSource = engine.slice(helperStart, helperEnd);
const getResolution = new Function('clamp', helperSource + '; return getLiveCanvasResolution;')(
  (value, min, max) => Math.max(min, Math.min(max, value))
);

const standard = getResolution(1224, 1);
const retina = getResolution(1224, 2);
const capped = getResolution(1224, 4);
assert.equal(standard.cssWidth, 1200);
assert.equal(standard.width, 1200);
assert.equal(standard.height, 600);
assert.equal(retina.cssWidth, 1200);
assert.equal(retina.width, 2400);
assert.equal(retina.height, 1200);
assert.equal(retina.scale, 2);
assert.equal(capped.scale, 2.5, 'high-density displays must be capped to avoid excessive canvas memory');
assert.equal(capped.width, 3000);
assert.equal(getResolution(0, 1).cssWidth, 320, 'narrow or not-yet-laid-out canvases need a safe minimum');

assert.match(engine, /ctx\.setTransform\(resolution\.scale, 0, 0, resolution\.scale, 0, 0\)/,
  'drawing coordinates must stay in CSS pixels while the backing store scales');
assert.match(engine, /const r = Math\.max\(6, Math\.round\(W \/ 86\)\)/,
  'player silhouettes and jerseys should be larger and easier to inspect');
assert.match(engine, /ctx\.fillRect\(-5\.2, 5\.4, 10\.4, 1\.05\)/,
  'jersey hem detailing should be rendered');
assert.match(engine, /jerseyLuminance > 158/,
  'jersey numbers need a contrast-aware dark/light color');

for (const id of [
  'live-stat-home-shots', 'live-stat-away-shots',
  'live-stat-home-attempts', 'live-stat-away-attempts',
  'live-stat-home-penalties', 'live-stat-away-penalties',
]) {
  assert.ok(screen.includes(id), `missing live statistic element: ${id}`);
  assert.ok(engine.includes(`updateStat('${id}'`), `missing live update for statistic: ${id}`);
}
assert.match(css, /\.live-canvas-wrap[^\n]*max-width: 1720px/);
assert.match(css, /\.live-canvas[^\n]*max-height: 68vh/);
assert.match(css, /\.live-match-stats/);
assert.match(css, /LIVE: compact layout and readable uniforms on narrow screens/);

console.log('LIVE rendering quality checks passed.');
