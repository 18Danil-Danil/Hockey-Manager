const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'engine/youth-leagues.js'), 'utf8');
const clubsSource = fs.readFileSync(path.join(root, 'data/youth-clubs.js'), 'utf8');
const seniorSource = fs.readFileSync(path.join(root, 'data/teams.js'), 'utf8');

const window = {};
vm.runInNewContext(clubsSource, { window });
const seniorWindow = {};
vm.runInNewContext(seniorSource, { window: seniorWindow });
const context = {
  window,
  G: { league: { youth: { leagues: {} } } },
};
vm.runInNewContext(source + '\nthis.__exports = { createYouthTeam, youthTeamBelongsToSeniorClub, getOwnYouthTeam, getOwnYouthTeams, sendSeniorPlayerToYouth, normalizeYouthLeagues };', context);
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
  'mhl-krasnoyarsk-lynx': 'sokol',
  'mhl-mammoths': 'yugra',
  'mhl-sputnik-al': 'neftyanik',
  'mhl-molot': 'molot',
  'mhl-akm-junior': 'akm',
  'mhl-academy-mikhailov': 'akm',
  'rhl-ryazan-vdv': 'ryazan-vdv',
  'rhl-proton': 'buran',
  'rhl-ekoniva-bobrov': 'buran',
  'rhl-dizelist': 'dizel',
  'rhl-tambov': 'tambov',
  'rhl-progress-glazov': 'izhstal',
};
for (const [teamId, slug] of Object.entries(expectedLinks)) {
  const meta = window.YOUTH_CLUBS.teams.find(team => team.id === teamId);
  assert(meta, 'Missing youth team metadata: ' + teamId);
  assert.strictEqual(meta.seniorTeamSlug, slug, teamId + ' must link to ' + slug);
}
const seniorSlugs = new Set(seniorWindow.VHL_TEAMS.map(team => team.slug));
for (const meta of window.YOUTH_CLUBS.teams.filter(team => team.seniorTeamSlug)) {
  assert(seniorSlugs.has(meta.seniorTeamSlug), meta.id + ' points to a missing VHL club slug');
}
const kalugaRocketsMeta = window.YOUTH_CLUBS.teams.find(team => team.id === 'rhl-kaluga-rockets');
assert.strictEqual(kalugaRocketsMeta.org, 'org-kaluga');
assert.strictEqual(kalugaRocketsMeta.seniorTeamSlug, 'kaluga');
assert.deepStrictEqual(Array.from(kalugaRocketsMeta.senior), ['Калуга']);
const kalugaYouth = {
  id: kalugaRocketsMeta.id,
  name: kalugaRocketsMeta.name,
  seniorLinks: kalugaRocketsMeta.senior,
  seniorTeamSlug: kalugaRocketsMeta.seniorTeamSlug,
};
const kalugaSenior = { id: 11, slug: 'kaluga', name: 'Калуга' };
assert.strictEqual(api.youthTeamBelongsToSeniorClub(kalugaYouth, kalugaSenior), true,
  'Калужские Ракеты должны быть связаны с ХК Калуга');
assert.strictEqual(window.YOUTH_CLUBS.teams.find(team => team.id === 'rhl-dynamo-karelia').org, 'org-independent-dynamo-karelia');
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

const transferPlayer = { id: 501, name: 'Тестовый Игрок', age: 18, status: 'contract', youth: {} };
const seniorClub = { id: 50, name: 'Химик', slug: 'khimik', roster: [transferPlayer], bench: [], lines: null };
const transferResult = api.sendSeniorPlayerToYouth(seniorClub, transferPlayer.id, 'mhl-spartak-max');
assert.strictEqual(transferResult.success, true);
assert.strictEqual(transferResult.youthTeam.id, 'mhl-spartak-max',
  'The selected second youth team must receive the player');
assert.strictEqual(seniorClub.roster.length, 0);


const legacyReactor = {
  id: 'mhl-reactor', organizationId: 'org-toros', organizationName: 'Система Тороса',
  independent: false, seniorLinks: ['Торос'], roster: Array.from({ length: 20 }, (_, i) => ({
    id: 1000 + i, age: 17, ovr: 55, position: 'C', attrs: {}, attrPot: {}, pot: 60,
    contract: {}, stats: {}, youth: { parentSeniorClubId: 25, parentSeniorClubName: 'Торос' }, status: 'youth',
  })), record: {}, history: [],
};
const legacyKalugaRockets = {
  id: 'rhl-kaluga-rockets', organizationId: 'org-kaluga', organizationName: 'Система Калуги',
  independent: false, seniorLinks: ['Калуга'], roster: Array.from({ length: 20 }, (_, i) => ({
    id: 2000 + i, age: 17, ovr: 50, position: 'C', attrs: {}, attrPot: {}, pot: 55,
    contract: {}, stats: {}, youth: { parentSeniorClubId: 11, parentSeniorClubName: 'Калуга' }, status: 'youth',
  })), record: {}, history: [],
};
const legacyTeam = {
  id: 'mhl-omsk-hawks',
  roster: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, age: 17, ovr: 55, position: 'C', attrs: {}, attrPot: {}, pot: 60,
    contract: {}, stats: {}, youth: { parentSeniorClubId: 99, parentSeniorClubName: 'Авангард' }, status: 'youth',
  })),
  record: {}, history: [],
};
context.G.league.teams = [
  { id: 19, slug: 'omskie-krylya', name: 'Омские Крылья' },
  { id: 25, slug: 'toros', name: 'Торос' },
  { id: 11, slug: 'kaluga', name: 'Калуга' },
];
context.G.league.youth = {
  season: 1, graduates: [], transferLog: [], promotionHistory: [],
  leagues: { MHL: { id: 'MHL', teams: [legacyTeam, legacyReactor, legacyKalugaRockets], schedule: [1], results: [], history: [], currentRound: 0 } },
};
api.normalizeYouthLeagues();
assert.strictEqual(legacyTeam.seniorTeamSlug, 'omskie-krylya',
  'Связь должна мигрировать и в уже существующее сохранение');
assert.strictEqual(legacyTeam.roster[0].youth.parentSeniorClubId, 19);
assert.strictEqual(legacyTeam.roster[0].youth.parentSeniorClubName, 'Омские Крылья');
assert.strictEqual(legacyReactor.roster[0].youth.parentSeniorClubId, null);
assert.strictEqual(legacyKalugaRockets.roster[0].youth.parentSeniorClubId, 11);
assert.strictEqual(legacyKalugaRockets.roster[0].youth.parentSeniorClubName, 'Калуга');
assert.strictEqual(legacyReactor.organizationId, 'org-neftekhimik');
assert.deepStrictEqual(Array.from(legacyReactor.seniorLinks), ['Нефтехимик (КХЛ)']);
assert.strictEqual(legacyReactor.seniorTeamSlug, null,
  'Reactor must no longer retain the incorrect Toros link in old saves');
assert.strictEqual(legacyKalugaRockets.organizationId, 'org-kaluga');
assert.strictEqual(legacyKalugaRockets.independent, false);
assert.deepStrictEqual(Array.from(legacyKalugaRockets.seniorLinks), ['Калуга']);
assert.strictEqual(legacyKalugaRockets.seniorTeamSlug, 'kaluga');

console.log('Youth system links: all checks passed.');
