import assert from 'node:assert/strict';
import { parseVhlPlayerCareer } from '../tools/vhl-player-career-parser.mjs';

const skaterStats = [
  '60','25','16','41','8','20','21','4','0','1','3','1',
  '187','13.4','3.1','3','0','0.0','16:47','22.8','22','20'
];
const skaterRow = `<tr><td><a href="/en/stats/players/1374/all/15016/">Magnitka</a></td><td>31</td>${skaterStats.map(v => `<td>${v}</td>`).join('')}</tr>`;
const skaterHtml = `
<a href="/en/players/34526/games/">Games</a>
<h2 class="player-card__subtitle">Forward</h2>
<table>
<tr><th>Season / Team</th></tr>
<tr><td>25/26 | Regular Season</td></tr>
${skaterRow}
</table>`;
const skater = parseVhlPlayerCareer(skaterHtml, 34526, 'forward');
assert.equal(skater.position, 'forward');
assert.equal(skater.seasons.length, 1);
assert.equal(skater.seasons[0].season, '25/26');
assert.equal(skater.seasons[0].stage, 'regular');
assert.equal(skater.seasons[0].gp, 60);
assert.equal(skater.seasons[0].goals, 25);
assert.equal(skater.seasons[0].points, 41);
assert.equal(skater.seasons[0].toiPerGame, 16 + 47 / 60);

const goalieStats = ['30','15','10','2','800','50','750','93.8','1.67','0','1','5','4','1800:00'];
const goalieRow = `<tr><td><a href="/en/stats/players/1374/all/15016/">Team</a></td><td>1</td>${goalieStats.map(v => `<td>${v}</td>`).join('')}</tr>`;
const goalieHtml = `
<a href="/en/players/12345/games/">Games</a>
<h2 class="player-card__subtitle">Goalkeeper</h2>
<table><tr><td>25/26 | Regular Season</td></tr>${goalieRow}</table>`;
const russianGoalieHtml = goalieHtml.replace('25/26 | Regular Season','25/26 | Регулярный чемпионат').replace('Goalkeeper','Вратарь');
const goalie = parseVhlPlayerCareer(russianGoalieHtml, 12345, 'goaltender');
assert.equal(goalie.position, 'goaltender');
assert.equal(goalie.seasons[0].wins, 15);
assert.equal(goalie.seasons[0].savePct, 93.8);
assert.equal(goalie.seasons[0].minutes, 1800);

assert.throws(() => parseVhlPlayerCareer('<html></html>', 1, 'forward'));
console.log('VHL player career parser checks passed.');
