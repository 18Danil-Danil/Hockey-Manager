const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');
const context = { Math, Number, Array, Object };
vm.createContext(context);
vm.runInContext(source, context);

function player(id, options = {}) {
  return {
    id, name: options.name || 'Тестовый хоккеист', position: options.position || 'C',
    age: options.age || 24, ovr: options.ovr || 80, pot: options.pot || 85,
    nationality: options.nationality || 'Россия', status: 'contract',
    contract: { salary: options.salary ?? 2, years: 2 }
  };
}
function team(id, roster = [], options = {}) {
  return {
    id, name: options.name || 'Клуб ' + id, roster,
    finance: { balance: options.balance ?? 100, salaryCap: options.salaryCap ?? 100, expenses: {}, income: {} },
    lines: null, bench: []
  };
}

const listedPlayer = player(1);
const seller = team(1, [listedPlayer, ...Array.from({ length: 18 }, (_, i) => player(100 + i))], { name: 'Мой клуб' });
const buyer = team(2, Array.from({ length: 18 }, (_, i) => player(200 + i)), { name: 'Клуб-покупатель' });
context.G = { playerTeamId: 1, league: { currentRound: 5, season: '2026/27', name: 'Лига', teams: [seller, buyer], aiTransferOffers: [], aiTransferLog: [] } };
context.rng = () => 0.5;
context.pick = items => items[0];
context.nextId = () => 9001;
context.isTradeDeadlinePassed = () => false;
context.addNews = () => {};
context.addInboxMessage = () => {};
context.showToast = () => {};
context.render = () => {};
context.syncLines = () => {};

assert.equal(context.listPlayerForTransfer(1), true, 'manager should be able to list a player manually');
assert.equal(listedPlayer.transferListed, true);
assert.equal(context.generateAITransferOffer(listedPlayer), true, 'an AI club should be able to submit a cash offer');
assert.equal(context.G.league.aiTransferOffers.length, 1);
const offer = context.G.league.aiTransferOffers[0];
assert.ok(offer.amount > 0, 'offer must include a positive transfer fee');
assert.equal(context.acceptAITransferOffer(offer.id), true, 'manager should be able to accept a valid offer');
assert.equal(seller.roster.includes(listedPlayer), false);
assert.equal(buyer.roster.includes(listedPlayer), true);
assert.equal(listedPlayer.transferListed, false);
assert.equal(buyer.finance.balance, 100 - offer.amount);
assert.equal(seller.finance.balance, 100 + offer.amount);
assert.equal(context.G.league.aiTransferLog.length, 1);

const secondPlayer = player(2);
seller.roster.push(secondPlayer);
assert.equal(context.listPlayerForTransfer(2), true);
assert.equal(context.generateAITransferOffer(secondPlayer), true);
const secondOffer = context.G.league.aiTransferOffers[0];
assert.equal(context.declineAITransferOffer(secondOffer.id), true);
assert.equal(context.G.league.aiTransferOffers.length, 0);
assert.equal(secondPlayer.transferOfferCooldownRound, 11, 'declining an offer should pause repeat approaches');

assert.match(ui, /listPlayerForTransfer/, 'roster cards should expose the transfer-list action');
assert.match(ui, /acceptAITransferOffer/, 'transfer offers should be actionable from the transfer screen');
assert.match(ui, /Предложения о покупке твоих игроков/, 'transfer screen should display incoming cash offers');

console.log('Transfer listing and AI offer checks passed.');
