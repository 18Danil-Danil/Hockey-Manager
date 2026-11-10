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
}
const unknown = context.window.getTeamJersey({ id: 999, name: 'Unknown' }, 'home');
assert.match(unknown.base, /^#[0-9a-f]{6}$/i);
console.log('Team uniform checks passed.');
