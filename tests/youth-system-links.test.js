const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'engine/youth-leagues.js'), 'utf8');
const clubsSource = fs.readFileSync(path.join(root, 'data/youth-clubs.js'), 'utf8');

const window = {};
vm.runInNewContext(clubsSource, { window });
const context = {
  window,
  G: { league: { youth: { leagues: {} } } },
};
vm.runInNewContext(source + '\nthis.__exports = { createYouthTeam, youthTeamBelongsToSeniorClub, getOwnYouthTeam, getOwnYouthTeams, normalizeYouthLeagues };', context);
const api = context.__exports;


const expectedLinks = {
  'mhl-spartak': 'khimik',
  'mhl-spartak-max': 'khimik',
  'mhl-irbis': 'bars',
  'mhl-steel-foxes': 'magnitka',
  'mhl-white-bears': 'chelmet',
  'mhl-avto': 'gornyak',
  'mhl-red-army': 'zvezda',
  'mhl-ska-academy': 'ska-vmf',
  'mhl-ska-1946': 'ska-vmf',
  'mhl-dynamo-spb': 'dinamo-spb',
  'rhl-dynamo-576': 'dinamo-spb',
  'mhl-kuznetskie-medvedi': 'metallurg',
  'rhl-kristall-saratov': 'kristall',
};
for (const [teamId, slug] of Object.entries(expectedLinks)) {
  const meta = window.YOUTH_CLUBS.teams.find(team => team.id === teamId);
  assert(meta, 'Missing youth team metadata: ' + teamId);
  assert.strictEqual(meta.seniorTeamSlug, slug, teamId + ' must link to ' + slug);
}
const reactorMeta = window.YOUTH_CLUBS.teams.find(team => team.id === 'mhl-reactor');
assert.strictEqual(reactorMeta.org, 'org-neftekhimik', 'Reactor belongs to Neftekhimik, not Toros');
assert.deepStrictEqual(Array.from(reactorMeta.senior), ['Нефтехимик (КХЛ)']);

const omskMeta = window.YOUTH_CLUBS.teams.find(team => team.id === 'mhl-omsk-hawks');
assert.strictEqual(omskMeta.seniorTeamSlug, 'omskie-krylya', 'Омские Ястребы должны быть привязаны к клубу ВХЛ Омские Крылья');

const omskYouth = {
  id: omskMeta.id,
  name: omskMeta.name,
  leagueId: 'MHL',
  seniorLinks: omskMeta.senior,
  seniorTeamSlug: omskMeta.seniorTeamSlug,
};
const krylya = { id: 19, slug: 'omskie-krylya', name: 'Омские Крылья' };
const avangard = { id: 99, slug: 'avangard', name: 'Авангард' };
assert.strictEqual(api.youthTeamBelongsToSeniorClub(omskYouth, krylya), true);
assert.strictEqual(api.youthTeamBelongsToSeniorClub(omskYouth, avangard), false,
  'КХЛ-партнёр не должен получать вторую бесплатную привязку к той же молодёжной команде');

const ryazanYouth = { id: 'rhl-ryazan-vdv', name: 'МХК Рязань-ВДВ', seniorLinks: ['Рязань-ВДВ'] };
const ryazan = { id: 21, slug: 'ryazan-vdv', name: 'Рязань-ВДВ' };
assert.strictEqual(api.youthTeamBelongsToSeniorClub(ryazanYouth, ryazan), true,
  'Старая схема привязки Рязани должна продолжать работать');

context.G.league.youth.leagues = { MHL: { id: 'MHL', teams: [omskYouth] }, RHL: { id: 'RHL', teams: [] } };
assert.strictEqual(api.getOwnYouthTeam(krylya).team.id, 'mhl-omsk-hawks',
  'Крылья должны находить собственную молодёжную команду');


const spartak = { id: 50, slug: 'khimik', name: 'Химик' };
context.G.league.youth.leagues = {
  MHL: { id: 'MHL', teams: [
    { id: 'mhl-spartak', name: 'МХК Спартак', seniorLinks: ['Спартак (КХЛ)'], seniorTeamSlug: 'khimik' },
    { id: 'mhl-spartak-max', name: 'МХК Спартак МАХ', seniorLinks: ['Спартак (КХЛ)'], seniorTeamSlug: 'khimik' },
  ] },
  RHL: { id: 'RHL', teams: [] },
};
assert.deepStrictEqual(
  Array.from(api.getOwnYouthTeams(spartak), item => item.team.id),
  ['mhl-spartak', 'mhl-spartak-max'],
  'The adult club must see every linked youth team, not only the first one'
);
assert.strictEqual(api.getOwnYouthTeam(spartak).team.id, 'mhl-spartak',
  'The legacy singular helper must remain backwards-compatible');

const legacyTeam = {
  id: 'mhl-omsk-hawks',
  roster: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, age: 17, ovr: 55, position: 'C', attrs: {}, attrPot: {}, pot: 60,
    contract: {}, stats: {}, youth: {}, status: 'youth',
  })),
  record: {}, history: [],
};
context.G.league.youth = {
  season: 1, graduates: [], transferLog: [], promotionHistory: [],
  leagues: { MHL: { id: 'MHL', teams: [legacyTeam], schedule: [1], results: [], history: [], currentRound: 0 } },
};
api.normalizeYouthLeagues();
assert.strictEqual(legacyTeam.seniorTeamSlug, 'omskie-krylya',
  'Связь должна мигрировать и в уже существующее сохранение');

console.log('Youth system links: all checks passed.');
