const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
const context = { Math, Number, Array, Object };
vm.createContext(context);
vm.runInContext(source, context);

function player(id, position, ovr, options = {}) {
  return {
    id, position, ovr, pot: options.pot || ovr, age: options.age || 26,
    nationality: options.nationality || 'Россия',
    contract: { salary: options.salary ?? 2, years: options.years ?? 2 }
  };
}
function team(id, roster = [], options = {}) {
  return {
    id, roster,
    finance: { balance: options.balance ?? 100, salaryCap: options.salaryCap ?? 100 }
  };
}

const equalOfferMy = player(1, 'C', 70);
const equalOfferTheir = player(2, 'C', 70);
const myClub = team(1, [equalOfferMy]);
const otherClub = team(2, [equalOfferTheir]);
const fair = context.evaluateTradeProposal(myClub, otherClub, [equalOfferMy], [equalOfferTheir], 0, 0);
assert.equal(fair.decision, 'accept', 'similar assets should be considered a fair trade');

const weakAsset = player(3, 'LW', 58);
const strongAsset = player(4, 'LW', 70);
const counter = context.evaluateTradeProposal(team(3, [weakAsset]), team(4, [strongAsset]), [weakAsset], [strongAsset], 0, 0);
assert.equal(counter.decision, 'counter', 'a moderately underpriced offer should receive a counteroffer');
assert.ok(counter.counterMyCash > 0, 'counteroffer should specify the additional cash requested');

const lowAsset = player(5, 'D', 50);
const starAsset = player(6, 'D', 82);
const rejected = context.evaluateTradeProposal(team(5, [lowAsset]), team(6, [starAsset]), [lowAsset], [starAsset], 0, 0);
assert.equal(rejected.decision, 'reject', 'a clearly one-sided offer should be rejected');

const expensive = player(7, 'G', 75, { salary: 12 });
const capTeam = team(7, [player(8, 'G', 60, { salary: 4 })], { salaryCap: 10 });
const capOpponent = team(8, [expensive]);
const capResult = context.evaluateTradeProposal(capTeam, capOpponent, [capTeam.roster[0]], [expensive], 0, 0);
assert.equal(capResult.reason, 'salary-cap', 'trade evaluation must enforce both clubs salary caps');

const foreign = player(9, 'RW', 70, { nationality: 'Канада' });
const foreignRoster = [player(10, 'C', 60), player(11, 'LW', 60, { nationality: 'Канада' }), player(12, 'D', 60, { nationality: 'США' }), player(15, 'RW', 61, { nationality: 'Швеция' })];
const foreignTeam = team(9, foreignRoster);
const foreignOpponent = team(10, [foreign]);
const foreignResult = context.evaluateTradeProposal(foreignTeam, foreignOpponent, [foreignTeam.roster[0]], [foreign], 0, 0);
assert.equal(foreignResult.reason, 'foreign-limit', 'trade evaluation must enforce the foreign-player limit');

const noBudgetTeam = team(11, [player(13, 'C', 65)], { balance: 1 });
const cashOpponent = team(12, [player(14, 'C', 65)]);
assert.equal(context.evaluateTradeProposal(noBudgetTeam, cashOpponent, [noBudgetTeam.roster[0]], [cashOpponent.roster[0]], 2, 0).reason, 'budget');

const veteranSurplus = team(20, [
  player(20, 'C', 80, { age: 29 }), player(21, 'C', 79, { age: 29 }),
  player(22, 'C', 78, { age: 29 }), player(23, 'C', 77, { age: 29 }),
  player(24, 'C', 60, { age: 30 }), player(25, 'C', 58, { age: 31 })
]);
context.G = { playerTeamId: 99, league: { teams: [veteranSurplus] } };
context.refreshAITransferLists();
assert.equal(veteranSurplus.roster[4].transferListed, true, 'AI should list a surplus veteran with a lower rating');
assert.equal(veteranSurplus.roster[5].transferListed, true, 'AI may list a second surplus veteran');
// Покупка игрока ВХЛ за деньги: успешный переход и финансовые/спортивные ограничения.
const buyerPlayer = player(101, 'C', 70);
const sellerPlayer = player(102, 'D', 76, { pot: 82, salary: 3 });
sellerPlayer.name = 'Тестовый защитник';
sellerPlayer.transferListed = true;
const buyerClub = team(101, [buyerPlayer], { balance: 50, salaryCap: 100 });
const sellerClub = team(102, [sellerPlayer], { balance: 10, salaryCap: 100 });
context.G = { playerTeamId: 101, league: { season: '2026/27', currentRound: 12, teams: [buyerClub, sellerClub] } };
context.isTradeDeadlinePassed = () => false;
context.syncLines = () => {};
context.addNews = () => {};
context.showToast = () => {};
context.render = () => {};
context.saveGame = () => {};
const vhlQuote = context.getVHLTransferQuote(sellerPlayer, sellerClub, buyerClub);
assert.equal(vhlQuote.allowed, true, 'listed VHL player should be purchasable when all limits are satisfied');
assert.ok(vhlQuote.price > 0, 'VHL transfer quote should include a positive fee');
assert.equal(context.buyVHLPlayer(102, 102), true, 'valid VHL purchase should complete');
assert.equal(buyerClub.roster.includes(sellerPlayer), true, 'purchased player should join the user club');
assert.equal(sellerClub.roster.includes(sellerPlayer), false, 'purchased player should leave the selling club');
assert.equal(buyerClub.finance.balance, 50 - vhlQuote.price, 'buyer should pay the transfer fee');
assert.equal(sellerClub.finance.balance, 10 + vhlQuote.price, 'selling club should receive the transfer fee');
assert.equal(sellerPlayer.transferListed, false, 'completed transfer should clear listing flags');
assert.equal(context.G.league.vhlTransferLog.length, 1, 'completed transfer should be recorded');

const poorBuyer = team(103, [], { balance: 0, salaryCap: 100 });
const poorSellerPlayer = player(1031, 'LW', 75);
poorSellerPlayer.transferListed = true;
const poorSeller = team(104, [poorSellerPlayer], { balance: 10 });
assert.equal(context.getVHLTransferQuote(poorSellerPlayer, poorSeller, poorBuyer).reason, 'Недостаточно средств для трансфера');

const fullBuyer = team(105, Array.from({length:25}, (_,i) => player(1100+i, 'C', 60)), { balance: 100, salaryCap: 200 });
assert.equal(context.getVHLTransferQuote(poorSellerPlayer, poorSeller, fullBuyer).reason, 'В составе уже 25 игроков');

const foreignBuyer = team(106, [
  player(1201,'C',60,{nationality:'Канада'}), player(1202,'LW',60,{nationality:'США'}), player(1203,'D',60,{nationality:'Швеция'})
], { balance:100, salaryCap:200 });
const foreignTarget = player(1204,'RW',70,{nationality:'Финляндия'});
foreignTarget.transferListed = true;
assert.equal(context.getVHLTransferQuote(foreignTarget, poorSeller, foreignBuyer).reason, 'Лимит легионеров (3) уже исчерпан');

const ui = fs.readFileSync(path.join(__dirname, '..', 'ui', 'render.js'), 'utf8');
assert.match(ui, /ВХЛ · трансферный список/, 'market should include a VHL transfer-list tab');
assert.match(ui, /buyVHLPlayer/, 'VHL market should support direct cash purchases');
assert.match(ui, /prepareTradeForPlayer/, 'VHL market should retain the option to negotiate a trade');
assert.match(ui, /acceptTradeCounterOffer/, 'trade UI should let the user accept counterterms');

console.log('Trade negotiation checks passed.');
