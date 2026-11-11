const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const directorySource = fs.readFileSync(path.join(root, 'data/vhl-club-directory.js'), 'utf8');
const seasonSource = fs.readFileSync(path.join(root, 'data/vhl-season-results.js'), 'utf8');
const window = {};
vm.runInNewContext(directorySource, { window });
vm.runInNewContext(seasonSource, { window });

const clubs = window.VHL_CLUB_DIRECTORY;
const seasons = window.VHL_SEASON_RESULTS;
assert.strictEqual(clubs.length, 61, 'Справочник должен содержать 61 объединённую карточку');

const historicalIds = clubs.flatMap(club => club.historicalIds);
assert.strictEqual(historicalIds.length, 74, 'Все 74 исходных historicalId должны сохраниться');
assert.strictEqual(new Set(historicalIds).size, historicalIds.length, 'Исторический ID не должен принадлежать двум карточкам');

const expectedGroups = {
  'ariada-volzhsk': ['ariada-volzhsk', 'ariada-akpars'],
  'dynamo-moscow-region': ['dynamo-moscow-region', 'dynamo-balashikha', 'dynamo-tver'],
  'lada-togliatti': ['lada-togliatti', 'lada-tolyatti'],
  'ska-vmf': ['khk-vmf', 'vmf-karelia', 'ska-karelia-kondopoga', 'ska-neva', 'ska-vmf'],
  ryazan: ['ryazan', 'hk-ryazan'],
  sarov: ['sarov', 'hk-sarov'],
  'chelmet-chelyabinsk': ['chelmet-chelyabinsk', 'mechel-chelyabinsk'],
  'yuzhny-ural': ['yuzhny-ural', 'yuzhny-ural-orsk'],
};
for (const [id, expected] of Object.entries(expectedGroups)) {
  const club = clubs.find(item => item.id === id);
  assert(club, 'Не найдена объединённая карточка ' + id);
  assert.deepStrictEqual(Array.from(club.historicalIds).sort(), expected.slice().sort(), 'Неверный набор ID: ' + id);
  const seasonNames = club.seasons.map(item => item.season);
  assert.strictEqual(new Set(seasonNames).size, seasonNames.length, 'Повтор сезона в карточке ' + id);
}

const allDirectoryIds = new Set(historicalIds);
for (const season of seasons) {
  for (const team of season.teams) {
    assert(allDirectoryIds.has(team.historicalId), 'Сезонный ID отсутствует в справочнике: ' + team.historicalId);
  }
}
const directoryRows = clubs.reduce((sum, club) => sum + club.seasons.length, 0);
const sourceRows = seasons.reduce((sum, season) => sum + season.teams.length, 0);
assert.strictEqual(directoryRows, sourceRows, 'Справочник должен сохранять все исходные сезонные строки');
assert.strictEqual(directoryRows, 435, 'Ожидается 435 сезонных записей');

const lada = clubs.find(item => item.id === 'lada-togliatti');
assert(lada.note.includes('2014/15–2017/18'));
assert(lada.note.includes('КХЛ'));
assert(lada.note.includes('2018/19'));

const ska = clubs.find(item => item.id === 'ska-vmf');
assert(ska.note.includes('ВМФ-Карелия'));
assert(ska.note.includes('СКА-Карелия'));
assert(ska.note.includes('СКА-Нева'));
assert(ska.note.includes('СКА-ВМФ'));

console.log('VHL club directory tests passed:', clubs.length, 'cards,', directoryRows, 'season rows,', historicalIds.length, 'historical IDs');
