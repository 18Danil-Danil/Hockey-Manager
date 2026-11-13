import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, matchMasterPlayer, normalizeName } from '../tools/hockey-databank-career-sync.mjs';

test('parses quoted commas, escaped quotes and CRLF CSV rows', () => {
  const rows = parseCsv('playerID,firstName,lastName,city\r\nabc,"John, Jr.","O""Brien",Toronto\r\n');
  assert.deepEqual(rows, [
    { playerID: 'abc', firstName: 'John, Jr.', lastName: 'O"Brien', city: 'Toronto' }
  ]);
});

test('matches VHL profile identity by exact birth date and reversed name order', () => {
  const master = [
    { playerID: 'borod01', firstName: 'Artyom', lastName: 'Borodkin', birthYear: '1991', birthMon: '10', birthDay: '11' },
    { playerID: 'other01', firstName: 'Artyom', lastName: 'Borodkin', birthYear: '1990', birthMon: '10', birthDay: '11' }
  ];
  assert.equal(matchMasterPlayer({ nameEn: 'Borodkin Artyom', birthDate: '1991-10-11' }, master).playerID, 'borod01');
  assert.equal(matchMasterPlayer({ nameEn: 'Borodkin Artyom', birthDate: '1992-10-11' }, master), null);
});

test('normalizes accented Latin names', () => {
  assert.equal(normalizeName('Mikaël Granlund'), 'mikaelgranlund');
});
