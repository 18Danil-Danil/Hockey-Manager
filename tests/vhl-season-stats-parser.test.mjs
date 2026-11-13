import assert from 'node:assert/strict';
import { parseVhlSeasonStats } from '../tools/vhl-season-stats-parser.mjs';

const roster = new Map([
  ['101', { playerId: 101, position: 'forward' }],
  ['202', { playerId: 202, position: 'goaltender' }]
]);
const html = `
<select name="tournament"><option value="/en/calendar/1374/0/" selected>25/26 | Regular Season</option></select>
<h2>Forwards</h2><table><thead><tr><th>Player</th><th>#</th><th>Team</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PIM</th><th>ESG</th><th>PPG</th><th>SHG</th><th>OTG</th><th>GWG</th><th>SDS</th><th>SOG</th><th>%SOG</th><th>S/G</th><th>FO</th><th>FOW</th><th>%FO</th><th>TOI/G</th><th>Sft/G</th><th>Hits</th><th>BLS</th></tr></thead>
<tbody><tr><td><a href="/en/players/101/">Player One</a></td><td>17</td><td>Team A</td><td>20</td><td>8</td><td>9</td><td>17</td><td>5</td><td>10</td><td>4</td><td>2</td><td>0</td><td>0</td><td>1</td><td>0</td><td>55</td><td>14.5</td><td>2.8</td><td>40</td><td>20</td><td>50</td><td>18:30</td><td>24.2</td><td>12</td><td>8</td></tr></tbody></table>
<h2>Goaltenders</h2><table><thead><tr><th>Player</th><th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>SOP</th><th>SOG</th><th>GA</th><th>Sv</th><th>%Sv</th><th>GAA</th><th>G</th><th>A</th><th>SO</th><th>PIM</th><th>TOI</th></tr></thead>
<tbody><tr><td><a href="/en/players/202/">Goalie Two</a></td><td>30</td><td>Team B</td><td>10</td><td>6</td><td>2</td><td>1</td><td>300</td><td>20</td><td>280</td><td>93.3</td><td>2.0</td><td>0</td><td>1</td><td>2</td><td>4</td><td>600:00</td></tr></tbody></table>`;
const parsed = parseVhlSeasonStats(html, '25/26', 'regular', roster);
assert.equal(parsed.size, 2);
assert.equal(parsed.get('101')[0].points, 17);
assert.equal(parsed.get('101')[0].toiPerGame, 18.5);
assert.equal(parsed.get('101')[0].team, 'Team A');
assert.equal(parsed.get('202')[0].wins, 6);
assert.equal(parsed.get('202')[0].minutes, 600);
assert.throws(() => parseVhlSeasonStats(html, '24/25', 'regular', roster), /другой турнир/);
console.log('VHL season stats parser checks passed.');
