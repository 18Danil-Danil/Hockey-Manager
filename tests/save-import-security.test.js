/*
 * Imported career saves must not be able to inject markup or executable
 * code into the game's HTML templates.
 * Run with: node tests/save-import-security.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'core/persistence.js'), 'utf8');
const helperStart = source.indexOf('const MAX_SAVE_VALIDATION_NODES');
const helperEnd = source.indexOf('async function importCareerFile', helperStart);
assert.notEqual(helperStart, -1, 'save validation helpers must exist');
assert.notEqual(helperEnd, -1, 'save import function must follow validation helpers');

const helpersSource = source.slice(helperStart, helperEnd);
const api = new Function('URL', helpersSource +
  '; return { isSafeCareerSaveValue, isSafeCareerLogoUrl, isValidCareerSave };')(URL);

function makeSave() {
  return {
    format: 'hockey-manager-save',
    version: 1,
    data: {
      league: {
        teams: [{
          id: 1,
          name: 'АКМ',
          logo: 'https://www.vhlru.ru/upload/iblock/480/АКМ.png',
          finance: { expenses: {}, income: {} },
          staff: {},
          roster: [{ id: 101, name: 'Александр Иванов', position: 'C', contract: {} }],
        }],
        freeAgents: [],
        news: [{ id: 1, text: 'Обычная новость сезона' }],
      },
    },
  };
}

assert.equal(api.isValidCareerSave(makeSave()), true,
  'ordinary Russian-language career saves should remain valid');
assert.equal(api.isSafeCareerLogoUrl('https://files.eliteprospects.com/layout/logos/example.png'), true,
  'the currently used Elite Prospects image host should remain supported');
assert.equal(api.isSafeCareerLogoUrl('https://evil.example/logo.svg'), false,
  'unapproved remote logo hosts must be rejected');
assert.equal(api.isSafeCareerLogoUrl('javascript:alert(1)'), false,
  'script URLs must never be accepted as team logos');
assert.equal(api.isSafeCareerLogoUrl('http://www.vhlru.ru/logo.png'), false,
  'logo URLs must use HTTPS');

const htmlPayload = makeSave();
htmlPayload.data.league.teams[0].roster[0].name = '<img src=x onerror=alert(1)>';
assert.equal(api.isValidCareerSave(htmlPayload), false,
  'HTML markup in a saved player name must be rejected');

const entityPayload = makeSave();
entityPayload.data.league.news[0].text = '&#x3c;img src=x onerror=alert(1)';
assert.equal(api.isValidCareerSave(entityPayload), false,
  'HTML entity encodings must be rejected before insertion into templates');

const inlineHandlerPayload = makeSave();
inlineHandlerPayload.data.league.news[0].text = "safe text');alert(1)//";
assert.equal(api.isValidCareerSave(inlineHandlerPayload), false,
  'quotes and escape characters used to break inline handlers must be rejected');

const idPayload = makeSave();
idPayload.data.league.teams[0].id = "1);alert(1)//";
assert.equal(api.isValidCareerSave(idPayload), false,
  'IDs interpolated into inline handlers must use a restricted format');

const logoPayload = makeSave();
logoPayload.data.league.teams[0].logo = 'javascript:alert(1)';
assert.equal(api.isValidCareerSave(logoPayload), false,
  'unsafe logo URLs must invalidate the complete save');

const externalLogoPayload = makeSave();
externalLogoPayload.data.league.teams[0].logo = 'https://evil.example/tracker.png';
assert.equal(api.isValidCareerSave(externalLogoPayload), false,
  'unknown image hosts must not be imported');

const prototypePayload = makeSave();
prototypePayload.data.league.news[0] = JSON.parse('{"__proto__":{"polluted":true},"text":"hello"}');
assert.equal(api.isValidCareerSave(prototypePayload), false,
  'prototype-related object keys must be rejected');

const constructorPayload = makeSave();
constructorPayload.data.league.news[0] = JSON.parse('{"constructor":{"prototype":{"polluted":true}},"text":"hello"}');
assert.equal(api.isValidCareerSave(constructorPayload), false,
  'constructor/prototype payloads must be rejected');

const oversizedStringPayload = makeSave();
oversizedStringPayload.data.league.news[0].text = 'x'.repeat(10001);
assert.equal(api.isValidCareerSave(oversizedStringPayload), false,
  'oversized string values must be rejected');

const nonFinitePayload = makeSave();
nonFinitePayload.data.league.teams[0].roster[0].ovr = Infinity;
assert.equal(api.isValidCareerSave(nonFinitePayload), false,
  'non-finite numeric values must be rejected');

const oversizedArrayPayload = makeSave();
oversizedArrayPayload.data.league.news = new Array(50001).fill(null);
assert.equal(api.isValidCareerSave(oversizedArrayPayload), false,
  'oversized arrays must be rejected');

let deepPayload = makeSave();
let cursor = deepPayload.data.league.news[0];
for (let i = 0; i < 45; i++) {
  cursor.nested = {};
  cursor = cursor.nested;
}
assert.equal(api.isValidCareerSave(deepPayload), false,
  'excessively nested save objects must be rejected');


const missingFinancePayload = makeSave();
delete missingFinancePayload.data.league.teams[0].finance;
assert.equal(api.isValidCareerSave(missingFinancePayload), false,
  'team finance data required by loadGame must be present');

const missingContractPayload = makeSave();
delete missingContractPayload.data.league.teams[0].roster[0].contract;
assert.equal(api.isValidCareerSave(missingContractPayload), false,
  'player contract data required by loadGame must be present');

const malformedFreeAgentsPayload = makeSave();
malformedFreeAgentsPayload.data.league.freeAgents = 'not-an-array';
assert.equal(api.isValidCareerSave(malformedFreeAgentsPayload), false,
  'free-agent collection required by loadGame must be an array');

const malformedPayload = makeSave();
malformedPayload.data.league.teams[0].roster = 'not-an-array';
assert.equal(api.isValidCareerSave(malformedPayload), false,
  'malformed team rosters must be rejected');

assert.ok(source.includes('if (!isValidCareerSave(data)) return false;'),
  'stored saves must be validated before loadGame mutates the global game state');

console.log('Career save import security checks passed.');
