'use strict';
// A company supplied by more than one inbox (Deskwell pitched both you and Priya): each contributor share is split
// equally among the distinct inboxes on the card, in the order its emails arrived; cents that do not divide go to the
// platform. Coordinator's ruling, 2026-10-24 (before it, only the first inbox earned).
const test = require('node:test');
const assert = require('node:assert/strict');
const { K, demoMarket, cashSum } = require('./helpers.js');

function market() {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'outreachly');
  K.optIn(st, 'deskwell', { listenPriceCents: 10000, openBooth: true });
  K.optIn(st, 'nordicbean', { listenPriceCents: 2500 });
  K.optIn(st, 'meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
  return st;
}
const run = (st, o, answer) => { K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, answer ? { answer } : {}); return o; };

test('Deskwell as listener: you and Priya each get 10% of the gross', () => {
  const st = market();
  assert.deepEqual(st.cards.deskwell.sources.map((s) => s.contributorId), ['you', 'priya']);
  const o = run(st, K.propose(st, { from: 'outreachly', to: 'deskwell', kind: 'read' }), 'no');
  const s = K.summary(st);
  assert.equal(s.companies.deskwell.cash, 5000);
  assert.equal(s.contributors.you, 1000, 'half of the 20% listener-contributor share');
  assert.equal(s.contributors.priya, 1000, 'the other half');
  assert.equal(s.contributors.hirewire, 1000, 'Hirewire supplied the pitcher, alone: the whole 10%');
  assert.equal(s.platformCents, 2000);
  assert.equal(cashSum(st), 0);
  const d = o.distributions[0];
  assert.deepEqual(d.contributorShares.map((c) => [c.contributorId, c.amountCents]), [['you', 1000], ['priya', 1000], ['hirewire', 1000]]);
  const statements = st.outbox.filter((m) => m.type === 'statement' && m.offerId === o.id);
  assert.equal(statements.length, 3, 'one statement per contributor share');
  assert.match(statements.find((m) => m.contributorId === 'you').body, /shared with Priya.s inbox/);
  assert.match(statements.find((m) => m.contributorId === 'priya').body, /shared with your inbox/);
  assert.ok(!/shared with/.test(statements.find((m) => m.contributorId === 'hirewire').body));
  const memos = st.ledger.filter((e) => e.party.kind === 'contributor').map((e) => e.memo);
  assert.equal(memos.filter((m) => /shared with/.test(m)).length, 2);
});

test('Deskwell as pitcher: the pitcher-contributor share is split too', () => {
  const st = market();
  K.setOpenBooth(st, 'nordicbean', true);
  const o = run(st, K.propose(st, { from: 'deskwell', to: 'nordicbean', kind: 'read' }), 'interested');
  const s = K.summary(st);
  assert.deepEqual(o.distributions[0].contributorShares.map((c) => [c.contributorId, c.amountCents]), [['you', 500], ['you', 125], ['priya', 125]]);
  assert.equal(s.contributors.you, 625);
  assert.equal(s.contributors.priya, 125);
  assert.equal(s.platformCents, 500);
  assert.equal(cashSum(st), 0);
});

test('an odd share: the cent that does not divide goes to the platform, and the parts still add up', () => {
  const st = market();
  const o = run(st, K.propose(st, { from: 'outreachly', to: 'deskwell', kind: 'read', priceCents: 10105 }), 'no');
  const d = o.distributions[0];
  // listener 50% of 10105 = 5052.5 -> 5053; listener contributors 20% = 2021 -> 1010 + 1010, 1 cent left; pitcher contributor 10% = 1011 (1010.5 rounds up)
  assert.equal(d.listenerCents, 5053);
  assert.deepEqual(d.contributorShares.map((c) => c.amountCents), [1010, 1010, 1011]);
  assert.equal(d.platformCents, 10105 - 5053 - 2020 - 1011);
  assert.equal(d.listenerCents + d.contributorShares.reduce((n, c) => n + c.amountCents, 0) + d.platformCents, 10105);
  assert.match(st.ledger.filter((e) => e.type === 'platform_fee').pop().memo, /left over/);
  assert.equal(cashSum(st), 0);
});

test('a credit-paid pitch to Deskwell: SpamDeck funds exactly the cash it pays out, split shares included', () => {
  const st = market();
  run(st, K.propose(st, { from: 'outreachly', to: 'meridianoutbound', kind: 'read' }), 'interested');  // Meridian earns 4688 in credits
  K.setListenPrice(st, 'deskwell', 4000);
  const before = K.summary(st).platformCents;
  const o = run(st, K.propose(st, { from: 'meridianoutbound', to: 'deskwell', kind: 'read', priceCents: 4501, payWith: 'credits' }), 'no');
  const d = o.distributions[0];
  const paidOut = d.listenerCents + d.contributorShares.reduce((n, c) => n + c.amountCents, 0);
  assert.equal(K.summary(st).platformCents, before - paidOut);
  assert.equal(d.platformCents, -paidOut);
  assert.deepEqual(d.contributorShares.map((c) => [c.contributorId, c.amountCents]), [['you', 450], ['priya', 450], ['you', 450]]);
  assert.equal(cashSum(st), 0);
});

test('one inbox that sent two emails is one contributor: nothing to split', () => {
  const st = market();
  st.cards.nordicbean.sources = st.cards.nordicbean.sources.concat([{ emailId: 'again', contributorId: 'you' }]);
  K.setOpenBooth(st, 'nordicbean', true);
  const o = run(st, K.propose(st, { from: 'outreachly', to: 'nordicbean', kind: 'read' }), 'no');
  assert.deepEqual(o.distributions[0].contributorShares.map((c) => [c.contributorId, c.amountCents]), [['you', 500], ['hirewire', 250]]);
  assert.ok(!st.ledger.some((e) => /shared with/.test(e.memo || '')));
});

test('a company nobody supplied: both contributor shares go to the platform', () => {
  const st = market();
  st.cards.outreachly.sources = [];
  st.companies.outreachly.contributorId = null;
  const o = run(st, K.propose(st, { from: 'outreachly', to: 'deskwell', kind: 'read' }), 'no');
  assert.deepEqual(o.distributions[0].contributorShares.map((c) => [c.contributorId, c.amountCents]), [['you', 1000], ['priya', 1000]]);
  assert.equal(o.distributions[0].platformCents, 2000 + 1000);
  assert.equal(cashSum(st), 0);
});
