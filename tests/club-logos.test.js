const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const logoSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'club-logos.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');
const youthEngineSource = fs.readFileSync(path.join(__dirname, '..', 'engine', 'youth-leagues.js'), 'utf8');
const youthRegistrySource = fs.readFileSync(path.join(__dirname, '..', 'data', 'youth-clubs.js'), 'utf8');
const youthCatalogSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'youth-league-clubs.js'), 'utf8');
const internationalSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'international-leagues.js'), 'utf8');
const vhlTeamsSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'teams.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const context = { getInitials: name => String(name).split(/\\s+/).map(part => part[0]).join('').slice(0, 3).toUpperCase() };
vm.createContext(context);
vm.runInContext(logoSource, context);

const generated = context.clubLogoMarkup({ name: 'Рязань-ВДВ' }, 32, 'test-mark');
assert.match(generated, /<svg viewBox="0 0 64 64"/);
assert.match(generated, /aria-label="Эмблема Рязань-ВДВ"/);
assert.match(generated, /class="club-logo test-mark"/);

const withOfficial = context.clubLogoWithFallback({ name: 'АКМ', logo: 'https://example.test/akm.png' }, 36);
assert.match(withOfficial, /<img src="https:\/\/example.test\/akm.png"/);
assert.match(withOfficial, /<svg viewBox="0 0 64 64"/, 'generated local mark must remain available if the official image fails');

assert.ok(indexSource.indexOf('data/club-logos.js') < indexSource.indexOf('ui/render.js'),
  'logo helper must load before UI render functions are used');
assert.match(renderSource, /clubLogoWithFallback\(team, 32, 'team-logo-header'\)/);
assert.match(renderSource, /clubLogoWithFallback\(club, 28, 'market-club-logo'\)/);
assert.match(youthEngineSource, /'mhl-academy-mikhailov': 'academy-mikhailov'/);
assert.match(youthEngineSource, /'mhl-sputnik-al': 'sputnik-almetyevsk'/);
assert.match(youthEngineSource, /'rhl-arktika': 'arktika'/);
assert.match(youthEngineSource, /'rhl-ekoniva-bobrov': 'econiva-bobrov'/);
assert.match(youthEngineSource, /logo: getYouthOfficialLogo\(meta\)/);
assert.match(renderSource, /clubLogoWithFallback\(team, 24, 'youth-table-logo'\)/);

const catalogContext = { window: {} };
vm.createContext(catalogContext);
vm.runInContext(youthCatalogSource, catalogContext);
assert.equal(catalogContext.window.getYouthClubLogoUrl('mhl', 'academy-mikhailov'),
  'https://img.khl.ru/clubs/ru/671/40.png');
assert.equal(catalogContext.window.getYouthClubLogoUrl('rhl', 'arktika'),
  'https://ss.fhr.ru/files/images/league/teams/200_200/66.png?1=');

const registryContext = { window: {} };
vm.createContext(registryContext);
vm.runInContext(youthRegistrySource, registryContext);
const youthTeams = registryContext.window.YOUTH_CLUBS.teams;
const mappingContext = {};
vm.createContext(mappingContext);
let mhlLogoMapping = null;
for (const mappingName of ['MHL_OFFICIAL_LOGO_IDS', 'RHL_OFFICIAL_LOGO_IDS']) {
  const declaration = youthEngineSource.match(new RegExp('const ' + mappingName + ' = \\{[\\s\\S]*?\\n\\};'));
  assert.ok(declaration, mappingName + ' mapping must exist');
  vm.runInContext(declaration[0] + '\nglobalThis.__mapping = ' + mappingName + ';', mappingContext);
  const mapping = mappingContext.__mapping;
  if (mappingName === 'MHL_OFFICIAL_LOGO_IDS') mhlLogoMapping = mapping;
  for (const [teamId, catalogId] of Object.entries(mapping)) {
    assert.ok(youthTeams.some(team => team.id === teamId), mappingName + ' has unknown game team ' + teamId);
    const leagueId = mappingName === 'MHL_OFFICIAL_LOGO_IDS' ? 'mhl' : 'rhl';
    assert.ok(catalogContext.window.getYouthClubLogoUrl(leagueId, catalogId),
      mappingName + ' has missing official source for ' + teamId);
  }
}
const mhlTeams = youthTeams.filter(team => team.league === 'MHL');
assert.equal(mhlTeams.length, 34, 'all 34 MHL game teams should be catalogued');
assert.ok(mhlTeams.every(team => mhlLogoMapping[team.id]),
  'every MHL game team should have an official logo source');

const internationalContext = { window: {} };
vm.createContext(internationalContext);
vm.runInContext(internationalSource, internationalContext);
const khl = internationalContext.window.INTERNATIONAL_LEAGUES.find(league => league.id === 'khl');
assert.equal(khl.clubs.length, 22, 'KHL catalogue should contain 22 clubs');
assert.ok(khl.clubs.every(club => club.logo), 'every KHL club should have an official logo URL');

const kazakhstan = internationalContext.window.INTERNATIONAL_LEAGUES.find(league => league.id === 'kazakhstan');
const belarus = internationalContext.window.INTERNATIONAL_LEAGUES.find(league => league.id === 'belarus');
const liiga = internationalContext.window.INTERNATIONAL_LEAGUES.find(league => league.id === 'finland-liiga');
assert.equal(kazakhstan.clubs.length, 10, 'Kazakhstan catalogue should match the 10 Pro Hokei Ligasy clubs');
assert.equal(belarus.clubs.length, 14, 'Belarus catalogue should contain the 14 current game entries');
assert.equal(liiga.clubs.length, 16, 'Liiga catalogue currently has 16 game entries; the missing Pelicans club is documented');
assert.ok(!liiga.clubs.some(club => club.id === 'pelicans'), 'do not silently claim Liiga coverage is complete while Pelicans is absent');
for (const league of internationalContext.window.INTERNATIONAL_LEAGUES.filter(item => item.id !== 'khl')) {
  assert.ok(league.clubs.every(club => !club.logo),
    league.id + ' must keep the safe fallback until an approved logo source is integrated');
}

for (const league of internationalContext.window.INTERNATIONAL_LEAGUES) {
  for (const club of league.clubs) {
    const markup = context.clubLogoWithFallback(club, 28, 'international-test');
    assert.match(markup, /<svg viewBox="0 0 64 64"/, league.id + '/' + club.id + ' must have an offline fallback badge');
  }
}
const vhlContext = { window: {} };
vm.createContext(vhlContext);
vm.runInContext(vhlTeamsSource, vhlContext);
assert.equal(vhlContext.window.VHL_TEAMS.length, 30, 'all 30 VHL clubs should be present');
assert.ok(vhlContext.window.VHL_TEAMS.every(club => club.logo), 'all VHL clubs should retain their official logo source');

console.log('Offline club logo rendering checks passed.');
