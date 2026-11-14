const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const logoSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'club-logos.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');
const youthEngineSource = fs.readFileSync(path.join(__dirname, '..', 'engine', 'youth-leagues.js'), 'utf8');
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

console.log('Offline club logo rendering checks passed.');
