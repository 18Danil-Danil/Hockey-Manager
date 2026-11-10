const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/teams.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/team-uniforms.js'), 'utf8'), context);
const teams = context.window.VHL_TEAMS;
const palettes = context.window.VHL_JERSEYS;
assert.equal(teams.length, 30, 'expected 30 current VHL teams');
assert.equal(Object.keys(palettes).length, 30, 'every current VHL team needs a jersey palette');

const homeSignatures = new Set();
const awaySignatures = new Set();
const pairSignatures = new Set();

for (const team of teams) {
  const palette = palettes[team.slug];
  assert.ok(palette, `missing jersey palette for ${team.slug}`);
  for (const key of ['primary', 'secondary', 'accent']) {
    assert.match(palette[key], /^#[0-9a-f]{6}$/i, `invalid ${key} color for ${team.slug}`);
  }
  assert.ok(['stripe', 'hoops', 'yoke', 'shoulders', 'diagonal'].includes(palette.pattern),
    `unknown jersey pattern for ${team.slug}`);
  const home = context.window.getTeamJersey(team, 'home');
  const away = context.window.getTeamJersey(team, 'away');
  assert.equal(home.base, palette.primary);
  assert.equal(away.base, '#F4F6F8');
  assert.equal(away.secondary, palette.primary);
  assert.notEqual(home.base, away.base);
  const homeSignature = [home.base, home.secondary, home.accent, home.pattern].join('|');
  const awaySignature = [away.base, away.secondary, away.accent, away.pattern].join('|');
  assert.ok(!homeSignatures.has(homeSignature), `duplicate home uniform for ${team.slug}`);
  assert.ok(!awaySignatures.has(awaySignature), `duplicate away uniform for ${team.slug}`);
  homeSignatures.add(homeSignature);
  awaySignatures.add(awaySignature);
  const pairSignature = homeSignature + '::' + awaySignature;
  assert.ok(!pairSignatures.has(pairSignature), `duplicate home/away uniform pair for ${team.slug}`);
  pairSignatures.add(pairSignature);
}
assert.equal(homeSignatures.size, teams.length, 'every team must have a unique home uniform');
assert.equal(awaySignatures.size, teams.length, 'every team must have a unique away uniform');
assert.equal(pairSignatures.size, teams.length, 'every team must have a unique home/away pair');
const unknown = context.window.getTeamJersey({ id: 999, name: 'Unknown' }, 'home');
assert.match(unknown.base, /^#[0-9a-f]{6}$/i);
console.log('Team uniform checks passed.');
