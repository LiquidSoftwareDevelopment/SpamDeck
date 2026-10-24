'use strict';
// The app's guided tour (js/app/tour.js), replayed through the engine with the same calls the app's store makes.
// If a hardening change ever refuses a step the tour relies on, this fails. End figures measured 2026-10-24. They were
// identical before and after that day's hardening (you 25,000, Priya 2,000, 50 ledger entries, 50 emails); the split of
// contributor shares between the inboxes that supplied a company (coordinator's ruling the same day) then moved 1,500 from
// you to Priya, both of whom supplied Deskwell, and added three payout entries and three statements.
const test = require('node:test');
const assert = require('node:assert/strict');
const { T, X, K, EMAILS, CONTRIBUTORS, READINGS, cashSum, creditSum } = require('./helpers.js');

function replayTour() {
  const m = K.createState({ fixedNow: '2026-10-24T12:00:00.000Z' });
  K.addContributors(m, CONTRIBUTORS);
  // "The Dealer reads": dealEmail + placeCard, one email at a time
  for (const e of EMAILS) {
    const card = X.readFixture(e, READINGS) || X.heuristicRead(e);
    const existing = m.cards[card.id];
    if (existing) {
      const merged = X.mergeCards([existing, card]).cards[0];
      m.cards[card.id] = merged;
      if (!T.isBinned(merged) && !m.companies[card.id]) K.addCards(m, [merged]); else K.refreshMatches(m);
    } else K.addCards(m, [card]);
  }
  K.invite(m);                                                     // "The letter"
  [['ledgerly', 7500], ['hirewire', 7500], ['chatterbox', 7500], ['boomerangreturns', 10000], ['outreachly', 7500], ['nordicbean', 2500], ['stacklinestudio', 10000], ['vettd', 7500]]
    .forEach((p) => K.optIn(m, p[0], { listenPriceCents: p[1] }));  // "Who said yes"
  K.optIn(m, 'meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
  K.optIn(m, 'deskwell', { listenPriceCents: 4000 });
  K.optIn(m, 'brightpath', { listenPriceCents: 50000, openBooth: true });
  K.decline(m, 'podly');
  const flow = (from, to, kind, opts) => {
    opts = opts || {};
    const o = K.propose(m, Object.assign({ from, to, kind }, opts.offer || {}));
    K.acceptOffer(m, o.id); K.pay(m, o.id); K.complete(m, o.id, opts.response || {});
    return o;
  };
  flow('hirewire', 'ledgerly', 'read', { response: { answer: 'interested' } });          // pay to pitch, checkout, get paid to listen
  flow('chatterbox', 'boomerangreturns', 'read', { response: { answer: 'not now' } });  // across the pool
  flow('outreachly', 'meridianoutbound', 'read', { response: { answer: 'interested' } }); // listen to earn
  const credits = m.companies.meridianoutbound.creditsCents;
  const floor = K.priceFloor(m, 'meridianoutbound', 'deskwell', 'read');
  flow('meridianoutbound', 'deskwell', 'read', { offer: { priceCents: Math.max(floor, Math.min(credits, floor + 500)), payWith: 'credits' }, response: { answer: 'no' } });
  flow('deskwell', 'nordicbean', 'swap', {});                                           // the swap
  flow('chatterbox', 'brightpath', 'read', { response: { answer: 'not now' } });        // the open booth
  return m;
}

test('every step of the guided tour still runs, and the money comes out as before', () => {
  const m = replayTour();
  const s = K.summary(m);
  assert.deepEqual(s.contributors, { you: 23500, priya: 3500, hirewire: 750 });
  assert.equal(s.platformCents, 17750);
  assert.equal(s.escrowCents, 0);
  assert.equal(s.creditsOutstandingCents, 188);
  assert.equal(s.volumeCents, 92500);
  assert.equal(s.completedPitches, 6);
  assert.deepEqual(s.counts, { dealt: 0, invited: 6, opted_in: 11, declined: 1, binned: 2, cards: 20 });
  assert.equal(cashSum(m), 0);
  assert.equal(creditSum(m), 188);
  assert.equal(m.ledger.length, 53);
  assert.equal(m.outbox.length, 53);
  assert.equal(m.matches.mutual.length, 21);
});
