import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVhlCareer } from '../tools/vhl-career-history-sync.mjs';

test('parses full skater season statistics by stage and team', () => {
  const html = '<table>' +
    '<tr><th>Season / Team</th><th>#</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>+/-</th><th>PIM</th><th>SOG</th></tr>' +
    '<tr><td>25/26</td><td colspan="8">Regular Season</td></tr>' +
    '<tr><td><a href="/teams/1/">Magnitka</a></td><td>31</td><td>60</td><td>25</td><td>16</td><td>41</td><td>8</td><td>20</td><td>187</td></tr>' +
    '<tr><td>25/26</td><td colspan="8">Playoffs</td></tr>' +
    '<tr><td><a href="/teams/1/">Magnitka</a></td><td>31</td><td>11</td><td>3</td><td>2</td><td>5</td><td>3</td><td>2</td><td>25</td></tr>' +
    '<tr><td>24/25</td><td colspan="8">Regular Season</td></tr>' +
    '<tr><td><a href="/teams/2/">Omskie Krylya</a></td><td>94</td><td>57</td><td>14</td><td>12</td><td>26</td><td>-8</td><td>43</td><td>120</td></tr>' +
    '</table>';
  assert.deepEqual(parseVhlCareer(html), [
    { season: '25/26', league: 'VHL', gp: 60, goals: 25, assists: 16, points: 41, plusMinus: 8, pim: 20, shotsOnGoal: 187, team: 'Magnitka', stage: 'regular' },
    { season: '25/26', league: 'VHL', gp: 11, goals: 3, assists: 2, points: 5, plusMinus: 3, pim: 2, shotsOnGoal: 25, team: 'Magnitka', stage: 'playoffs' },
    { season: '24/25', league: 'VHL', gp: 57, goals: 14, assists: 12, points: 26, plusMinus: -8, pim: 43, shotsOnGoal: 120, team: 'Omskie Krylya', stage: 'regular' }
  ]);
});

test('parses goalie wins, saves, save percentage and goals against', () => {
  const html = '<table>' +
    '<tr><th>Season / Team</th><th>#</th><th>GP</th><th>W</th><th>L</th><th>SOP</th><th>SOG</th><th>GA</th><th>Sv</th><th>%Sv</th><th>GAA</th><th>G</th><th>A</th><th>SO</th><th>PIM</th><th>TOI</th></tr>' +
    '<tr><td>25/26</td><td colspan="15">Regular Season</td></tr>' +
    '<tr><td><a href="/teams/1/">AKM</a></td><td>60</td><td>35</td><td>7</td><td>17</td><td>8</td><td>1087</td><td>85</td><td>1002</td><td>92.2</td><td>2.67</td><td>0</td><td>1</td><td>1</td><td>4</td><td>1911:37</td></tr>' +
    '</table>';
  assert.deepEqual(parseVhlCareer(html), [
    { season: '25/26', league: 'VHL', gp: 35, wins: 7, losses: 17, shootoutsPlayed: 8, shotsAgainst: 1087, goalsAgainst: 85, saves: 1002, savePercentage: 92.2, goalsAgainstAverage: 2.67, goals: 0, assists: 1, shutouts: 1, pim: 4, timeOnIce: '1911:37', team: 'AKM', stage: 'regular' }
  ]);
});

test('does not create rows for zero-game seasons', () => {
  const html = '<tr><td>Season / Team</td><td>#</td><td>GP</td><td>G</td></tr>' +
    '<tr><td>26/27</td><td>Regular Season</td></tr>' +
    '<tr><td><a href="/teams/1/">Dynamo-Altai</a></td><td>-</td><td>0</td><td>0</td></tr>';
  assert.deepEqual(parseVhlCareer(html), []);
});
