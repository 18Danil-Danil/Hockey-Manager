import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mergePlayerSeasons } from '../tools/vhl-career-history-sync.mjs';

function readHistory(source) {
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.VHL_PLAYER_LEAGUE_HISTORY;
}

const baseHistory = `window.VHL_PLAYER_LEAGUE_HISTORY = {
  schemaVersion: 2,
  players: {
    "1": {
      position: "forward"
    }
  }
};`;

test('adds identity and a full season row to an existing player', () => {
  const merged = mergePlayerSeasons(baseHistory, '1', [{
    season: '99/00', league: 'NHL', gp: 10, goals: 4, assists: 3, points: 7,
    team: "St. John's, NY", stage: 'regular', source: 'Hockey Databank v13.0'
  }], 'forward', { nameEn: 'Smith John', birthDate: '1980-01-02' });
  const history = readHistory(merged.text);
  assert.deepEqual({ ...history.players['1'].identity }, {
    nameEn: 'Smith John',
    birthDate: '1980-01-02'
  });
  assert.equal(history.players['1'].seasons.length, 1);
  assert.equal(history.players['1'].seasons[0].team, "St. John's, NY");
  assert.equal(history.players['1'].seasons[0].points, 7);
  assert.equal(merged.added, 1);
  assert.equal(merged.identityAdded, 1);
});

test('enriches an existing season row instead of appending a duplicate', () => {
  const existing = `window.VHL_PLAYER_LEAGUE_HISTORY = {
  schemaVersion: 2,
  players: {
    "1": {
      position: "forward",
      seasons: [
        { season: "99/00", league: "NHL", gp: 10, team: "St. John's, NY", stage: "regular" }
      ]
    }
  }
};`;
  const merged = mergePlayerSeasons(existing, '1', [{
    season: '99/00', league: 'NHL', gp: 10, goals: 4, assists: 3, points: 7,
    team: "St. John's, NY", stage: 'regular', source: 'Hockey Databank v13.0'
  }], 'forward', { nameEn: 'Smith John', birthDate: '1980-01-02' });
  const history = readHistory(merged.text);
  assert.equal(history.players['1'].seasons.length, 1);
  assert.equal(history.players['1'].seasons[0].goals, 4);
  assert.equal(history.players['1'].seasons[0].points, 7);
  assert.equal(merged.added, 0);
  assert.equal(merged.enriched, 1);
});

test('adds a new player entry without losing the outer players object', () => {
  const merged = mergePlayerSeasons(baseHistory, '2', [{
    season: '24/25', league: 'VHL', gp: 30, goals: 12, assists: 8, points: 20,
    team: 'Ryazan', stage: 'regular'
  }], 'defense', { nameEn: 'Ivanov Alex', birthDate: '2000-02-03' });
  const history = readHistory(merged.text);
  assert.equal(history.players['2'].position, 'defense');
  assert.equal(history.players['2'].identity.nameEn, 'Ivanov Alex');
  assert.equal(history.players['2'].seasons[0].team, 'Ryazan');
});
