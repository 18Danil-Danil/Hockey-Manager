import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVhlCareer } from '../tools/vhl-career-history-sync.mjs';

test('parses season, stage, team and GP from a player table', () => {
  const html = '<table>' +
    '<tr><th>Season / Team</th><th>#</th><th>GP</th><th>G</th></tr>' +
    '<tr><td>25/26</td><td colspan="3">Regular Season</td></tr>' +
    '<tr><td><a href="/teams/1/">Magnitka</a></td><td>31</td><td>60</td><td>25</td></tr>' +
    '<tr><td>25/26</td><td colspan="3">Playoffs</td></tr>' +
    '<tr><td><a href="/teams/1/">Magnitka</a></td><td>31</td><td>11</td><td>3</td></tr>' +
    '<tr><td>24/25</td><td colspan="3">Regular Season</td></tr>' +
    '<tr><td><a href="/teams/2/">Omskie Krylya</a></td><td>94</td><td>57</td><td>14</td></tr>' +
    '<tr><td>Regular Season</td><td></td><td>117</td><td>39</td></tr>' +
    '</table>';
  assert.deepEqual(parseVhlCareer(html), [
    { season: '25/26', league: 'VHL', gp: 60, team: 'Magnitka', stage: 'regular' },
    { season: '25/26', league: 'VHL', gp: 11, team: 'Magnitka', stage: 'playoffs' },
    { season: '24/25', league: 'VHL', gp: 57, team: 'Omskie Krylya', stage: 'regular' }
  ]);
});

test('does not create rows for zero-game seasons', () => {
  const html = '<tr><td>26/27</td><td>Regular Season</td></tr>' +
    '<tr><td><a href="/teams/1/">Dynamo-Altai</a></td><td>-</td><td>0</td><td>0</td></tr>';
  assert.deepEqual(parseVhlCareer(html), []);
});
