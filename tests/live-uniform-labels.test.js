const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../engine/live-match.js'), 'utf8');
assert.match(source, /p\.jerseyNumber\s*\?\?\s*p\.number/, 'supports explicit jersey numbers');
assert.match(source, /p\.playerId\s*\|\|\s*p\.playerName/, 'stable fallback number is based on player identity');
assert.match(source, /usedNumbers\.has\(jerseyNumber\)/, 'prevents duplicate numbers within one on-ice unit');
assert.match(source, /ctx\.fillText\(String\(jerseyNumber\)/, 'draws the number on the jersey');
assert.match(source, /const surname = fullName \? fullName\.split/, 'extracts the player surname');
assert.match(source, /const labelText = `\$\{numberText\} \$\{surnameText\}`/, 'builds number and surname nameplate');
assert.match(source, /drawPlayer\(p, 'home', homeNumbers\)/, 'tracks home team numbers separately');
assert.match(source, /drawPlayer\(p, 'away', awayNumbers\)/, 'tracks away team numbers separately');
console.log('LIVE uniform number and surname label checks passed.');
