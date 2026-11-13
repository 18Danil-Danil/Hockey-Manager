/*
 * Auto-lineup must preserve chemistry for unchanged player groups.
 * Run with: node tests/line-management-autolineup.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine/line-management.js'), 'utf8');
function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `next function after ${name} must exist`);
  return source.slice(start, end).trim();
}

const initLinesSource = extractFunction('initLines', 'syncLines');
const resetLinesSource = extractFunction('resetLinesToOvr', 'ensureAllLines');
const initLines = new Function(`${initLinesSource}; return initLines;`)();
function makeTeam() {
  const roster = [];
  for (let i = 0; i < 12; i++) roster.push({ id: `F${i}`, position: 'C', ovr: 90 - i });
  for (let i = 0; i < 6; i++) roster.push({ id: `D${i}`, position: 'D', ovr: 85 - i });
  for (let i = 0; i < 2; i++) roster.push({ id: `G${i}`, position: 'G', ovr: 80 - i });
  const team = { id: 1, roster, bench: [] };
  initLines(team);
  return team;
}
function runAutoLineup(team) {
  const G = { playerTeamId: team.id, league: { teams: [team] } };
  let renderCalls = 0;
  const reset = new Function('G', 'initLines', 'render', `${resetLinesSource}; return resetLinesToOvr;`)(G, initLines, () => renderCalls++);
  reset();
  assert.equal(renderCalls, 1, 'auto lineup should render once');
}

const unchangedTeam = makeTeam();
const chemistryByLine = { f1: 87, f2: 74, f3: 63, f4: 52, d1: 91, d2: 42, d3: 68 };
for (const [key, value] of Object.entries(chemistryByLine)) {
  unchangedTeam.lines[key].chemistry = value;
  unchangedTeam.lines[key].style = key === 'f1' ? 'aggressive' : 'defensive';
  unchangedTeam.lines[key].role = key === 'f1' ? 'top6' : 'energy';
}
runAutoLineup(unchangedTeam);
for (const [key, value] of Object.entries(chemistryByLine)) {
  assert.equal(unchangedTeam.lines[key].chemistry, value, `${key}: chemistry should survive unchanged auto lineup`);
}
assert.equal(unchangedTeam.lines.f1.style, 'aggressive', 'line style should be preserved');
assert.equal(unchangedTeam.lines.f1.role, 'top6', 'line role should be preserved');

const changedTeam = makeTeam();
changedTeam.lines.f1.chemistry = 88;
changedTeam.lines.d1.chemistry = 77;
changedTeam.lines.d1.style = 'aggressive';
changedTeam.roster.find(player => player.id === 'F11').ovr = 99;
runAutoLineup(changedTeam);
assert.equal(changedTeam.lines.f1.chemistry, 50, 'chemistry should reset when the line composition changes');
assert.equal(changedTeam.lines.d1.chemistry, 77, 'unaffected defensive pair chemistry should survive');
assert.equal(changedTeam.lines.d1.style, 'aggressive', 'style should survive an auto lineup that changes another line');

console.log('Auto-lineup chemistry preservation checks passed.');
