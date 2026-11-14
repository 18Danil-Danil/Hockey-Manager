const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'club-negotiations.js'), 'utf8');
const context = { getInternationalTransferPrice: () => 10 };
vm.createContext(context);
vm.runInContext(source, context);

const player = { id: 1, name: 'Хоккеист', position: 'C', age: 26, transferListed: false, contract: { years: 3 } };
const club = { id: 'club-a', roster: [
  { id: 1, position: 'C' }, { id: 2, position: 'C' }, { id: 3, position: 'D' },
  { id: 4, position: 'LW' }, { id: 5, position: 'G' }, { id: 6, position: 'RW' }
] };
const team = { finance: { balance: 100 } };
const demand = context.getClubTransferDemand(player, club);
assert.equal(demand, 10.8, 'a club should ask a premium for an unlisted player with normal positional depth');
assert.equal(context.evaluateClubTransferOffer(player, club, team, demand).decision, 'accept');
assert.equal(context.evaluateClubTransferOffer(player, club, team, demand * 0.85).decision, 'counter');
assert.equal(context.evaluateClubTransferOffer(player, club, team, demand * 0.5).decision, 'reject');
assert.equal(context.evaluateClubTransferOffer(player, club, { finance: { balance: 1 } }, demand).reason, 'budget');

const listed = { ...player, transferListed: true };
assert.ok(context.getClubTransferDemand(listed, club) < demand, 'listed players should be cheaper to acquire');
const thinRosterClub = { ...club, roster: [{ id: 1, position: 'C' }, { id: 3, position: 'D' }] };
assert.ok(context.getClubTransferDemand(player, thinRosterClub) > demand, 'a club with little positional depth should demand more');

console.log('Club transfer negotiation checks passed.');
