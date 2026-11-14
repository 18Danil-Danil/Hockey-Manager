const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let sequence = 100;
let roll = 0;
const messages = [];
const fields = {};
const context = {
  G: { playerTeamId: 1, league: { currentRound: 12, teams: [], loanLog: [], aiLoanOffers: [] } },
  rng: () => roll,
  pick: items => items[0],
  nextId: () => ++sequence,
  addNews: (...args) => messages.push(args),
  addInboxMessage: (...args) => messages.push(args),
  showToast: () => {},
  render: () => {},
  saveGame: () => {},
  syncLines: () => {},
  document: { getElementById: id => fields[id] || null }
};
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, '..', 'engine', 'roster-management.js'), 'utf8');
vm.runInContext(source, context);

const userPlayers = Array.from({ length: 19 }, (_, i) => ({
  id: i + 1, name: 'Хоккеист ' + (i + 1), age: 28, position: i % 2 ? 'D' : 'F',
  nationality: 'Россия', ovr: 65, contract: { salary: 2 }
}));
userPlayers[0].age = 22;
userPlayers[0].name = 'Молодой игрок';
const targetPlayer = userPlayers[0];
const targetPlayerId = targetPlayer.id;
const aiPlayers = Array.from({ length: 18 }, (_, i) => ({
  id: 1000 + i, name: 'Игрок ИИ ' + i, age: 25, position: i < 2 ? 'F' : i < 10 ? 'D' : 'G',
  nationality: 'Россия', ovr: 62, contract: { salary: 1 }
}));
const userClub = { id: 1, name: 'Наш клуб', roster: userPlayers, finance: { balance: 20, salaryCap: 100, income: {}, expenses: {} } };
const aiClub = { id: 2, name: 'Клуб-соперник', roster: aiPlayers, finance: { balance: 20, salaryCap: 100, income: {}, expenses: {} } };
const rivalPlayers = aiPlayers.map((player, i) => ({ ...player, id: 2000 + i, name: 'Игрок второго ИИ ' + i }));
const rivalClub = { id: 3, name: 'Второй клуб', roster: rivalPlayers, finance: { balance: 25, salaryCap: 100, income: {}, expenses: {} } };
context.G.league.teams = [userClub, aiClub, rivalClub];

assert.equal(context.generateAIIncomingLoanOffer(), true, 'AI club should generate an incoming loan proposal for an eligible young player');
const offer = context.G.league.aiLoanOffers[0];
assert.equal(offer.playerId, targetPlayerId);
assert.equal(context.G.league.aiLoanOffers.length, 2, 'two AI clubs should compete for the same eligible player');
assert.deepEqual([...new Set(context.G.league.aiLoanOffers.map(item => item.fromTeamId))].sort(), [2, 3]);
assert.ok(context.G.league.aiLoanOffers.every(item => item.competitionCount === 2), 'each bid should show the size of the bidding contest');
assert.equal(context.G.league.loanNegotiationHistory.filter(item => item.type === 'offer-created').length, 2, 'each AI bid should be recorded in negotiation history');
assert.equal(context.generateAIIncomingLoanOffer(), false, 'clubs that already bid must not submit duplicate offers');

assert.equal(context.acceptAIIncomingLoanOffer(offer.id), true);
const loaned = aiClub.roster.find(player => player.id === targetPlayerId);
assert.ok(loaned && loaned.loan, 'accepting the offer must move the player to the borrowing club');
assert.equal(loaned.loan.parentTeamId, userClub.id);
assert.equal(loaned.loan.borrowerTeamId, aiClub.id);
assert.equal(context.G.league.aiLoanOffers.length, 0);
assert.equal(context.G.league.loanLog.length, 1);
assert.ok(context.G.league.loanNegotiationHistory.some(item => item.type === 'deal-completed' && item.playerId === targetPlayerId), 'completed loan deals should be recorded in negotiation history');
assert.ok(userClub.finance.balance > 20, 'parent club should receive the loan fee');

const second = { ...userPlayers[1], id: 55, age: 21, position: 'F', name: 'Игрок для торга' };
userClub.roster.push(second);
assert.equal(context.generateAIIncomingLoanOffer(), true);
const counterOffer = context.G.league.aiLoanOffers[0];
context.G.pendingIncomingLoanCounter = { offerId: counterOffer.id };
fields['incoming-loan-rounds'] = { value: String(counterOffer.rounds) };
fields['incoming-loan-share'] = { value: String(counterOffer.wageShare) };
fields['incoming-loan-fee'] = { value: String(counterOffer.fee + 0.5) };
roll = 0;
assert.equal(context.submitIncomingLoanCounter(), true, 'AI should accept a reasonable counteroffer when the acceptance roll succeeds');
assert.ok([aiClub, rivalClub].some(club => club.roster.some(player => player.id === second.id && player.loan)), 'the selected AI bidder should receive the player after accepting the counteroffer');
assert.equal(context.G.pendingIncomingLoanCounter, null);

const stale = { id: 999, playerId: 999, fromTeamId: aiClub.id, rounds: 5, wageShare: 50, fee: 1, expiresRound: 10 };
context.G.league.aiLoanOffers = [stale];
assert.equal(context.acceptAIIncomingLoanOffer(999), false, 'stale offers with missing players must not move anyone');

console.log('AI incoming loan offer checks passed.');
