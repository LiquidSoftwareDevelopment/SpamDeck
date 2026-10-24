'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { K, demoMarket, cashSum, creditSum } = require('./helpers.js');

function joinBoth(st) { K.invite(st); K.optIn(st, 'hirewire', { listenPriceCents: 7500 }); K.optIn(st, 'ledgerly', { listenPriceCents: 7500 }); }

test('a paid pitch nobody answers is refunded in full; nobody else is paid', () => {
  const st = demoMarket();
  joinBoth(st);
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', kind: 'read' });
  assert.throws(() => K.refund(st, o.id), /Only a paid, unanswered pitch/);
  K.acceptOffer(st, o.id); K.pay(st, o.id);
  K.refund(st, o.id);
  assert.equal(o.status, 'refunded');
  const s = K.summary(st);
  assert.equal(s.companies.hirewire.paid, 0, 'the pitcher is made whole');
  assert.equal(s.companies.ledgerly.cash, 0);
  assert.equal(s.contributors.you, 0);
  assert.equal(s.platformCents, 0);
  assert.equal(s.escrowCents, 0);
  assert.equal(cashSum(st), 0);
  assert.throws(() => K.complete(st, o.id, { answer: 'no' }), /this offer is refunded/);
  assert.throws(() => K.refund(st, o.id), /this offer is refunded/);
});

test('a swap that never happens returns both legs', () => {
  const st = demoMarket();
  K.invite(st); K.optIn(st, 'deskwell', { listenPriceCents: 4000 }); K.optIn(st, 'nordicbean', { listenPriceCents: 2500 });
  const o = K.propose(st, { from: 'deskwell', to: 'nordicbean', kind: 'swap' });
  K.acceptOffer(st, o.id); K.pay(st, o.id); K.refund(st, o.id);
  const s = K.summary(st);
  assert.equal(s.companies.deskwell.paid, 0);
  assert.equal(s.companies.nordicbean.paid, 0);
  assert.equal(s.escrowCents, 0);
  assert.equal(cashSum(st), 0);
});

test('credits spent on an unanswered pitch come back as credits', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
  K.optIn(st, 'outreachly', { listenPriceCents: 7500 });
  K.optIn(st, 'deskwell', { listenPriceCents: 4000 });
  const o1 = K.propose(st, { from: 'outreachly', to: 'meridianoutbound', kind: 'read' });
  K.acceptOffer(st, o1.id); K.pay(st, o1.id); K.complete(st, o1.id, { answer: 'interested' });
  const before = st.companies.meridianoutbound.creditsCents;
  const o2 = K.propose(st, { from: 'meridianoutbound', to: 'deskwell', kind: 'read', priceCents: 4000, payWith: 'credits' });
  K.acceptOffer(st, o2.id); K.pay(st, o2.id);
  assert.equal(st.companies.meridianoutbound.creditsCents, before - 4000);
  K.refund(st, o2.id);
  assert.equal(st.companies.meridianoutbound.creditsCents, before, 'credits restored');
  assert.equal(cashSum(st), 0);
  assert.equal(creditSum(st), before, 'credits ledger balanced to what is held');
});
