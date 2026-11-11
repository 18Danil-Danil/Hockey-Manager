const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const players = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: 'Player ' + String(i + 1).padStart(2, '0'),
  position: 'C',
  stats: { gp: 20 + i, goals: 12 - i, assists: i, points: 12, wins: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, shutouts: 0 },
  playoffStats: { gp: i < 8 ? 1 : 0, goals: i < 8 ? 2 : 0, assists: 0, points: i < 8 ? 2 : 0, wins: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, shutouts: 0 },
}));
const goalie = {
  id: 99, name: 'Goalie 99', position: 'G',
  stats: { gp: 20, goals: 0, assists: 0, points: 0, wins: 12, shotsAgainst: 400, saves: 380, goalsAgainst: 20, shutouts: 3 },
  playoffStats: { gp: 4, goals: 0, assists: 0, points: 0, wins: 2, shotsAgainst: 80, saves: 76, goalsAgainst: 4, shutouts: 1 },
};
const team = { id: 1, name: 'Test Club', roster: [...players, goalie] };
const context = {
  G: { league: { teams: [team] }, playerTeamId: 1, statsMode: 'regular' },
  ensureStats: p => p.stats,
  ensurePlayoffStats: p => p.playoffStats,
  render: () => {},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'engine/league-competition.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'ui/render.js'), 'utf8'), context);

const defaultLeaders = context.leagueLeaders(context.G.league, 'regular');
assert.equal(defaultLeaders.byPoints.length, 10, 'default historical snapshots remain limited to ten');
const fullLeaders = context.leagueLeaders(context.G.league, 'regular', 0);
assert.equal(fullLeaders.byPoints.length, 12, 'unlimited mode returns every skater');
assert.equal(fullLeaders.byGoals.length, 12, 'goal list returns every skater');
assert.equal(fullLeaders.bySvPct.length, 1, 'goalie leaderboard keeps its eligibility rules');
const playoffLeaders = context.leagueLeaders(context.G.league, 'playoff', 0);
assert.equal(playoffLeaders.byPoints.length, 8, 'playoff leaderboard excludes players without playoff games');

const collapsed = context.renderStats();
assert.match(collapsed, /Показать весь список/, 'expanded-list action is visible');
assert.match(collapsed, /Показано 10 из 12/, 'collapsed table explains how many rows are shown');
assert.doesNotMatch(collapsed, /Player 11/, 'collapsed table does not render row eleven');

context.G.statsExpanded = { 'regular-goals': true, 'regular-assists': true, 'regular-points': true };
const expanded = context.renderStats();
assert.match(expanded, /Player 11/, 'expanded lists include players outside the top ten');
assert.match(expanded, /Показано 12 из 12/, 'expanded table reports the full count');
assert.match(expanded, /Свернуть список/, 'expanded list can be collapsed again');
console.log('League leader expansion checks passed.');
