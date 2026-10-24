'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { K, demoMarket, cashSum, creditSum } = require('./helpers.js');

test('the four shares must add up to 100%', () => {
  assert.throws(() => K.createState({ config: { splitsBp: { listener: 5000, listenerContributor: 2000, pitcherContributor: 1000, platform: 1900 } } }), /add up to 100%/);
  assert.ok(K.createState({ config: { splitsBp: { listener: 6000, listenerContributor: 1500, pitcherContributor: 500, platform: 2000 } } }));
});

test('money formats as dollars and cents', () => {
  assert.equal(K.money(7500), '$75.00');
  assert.equal(K.money(4688), '$46.88');
  assert.equal(K.money(-250), '-$2.50');
  assert.equal(K.money(123456), '$1,234.56');
});

test('dealing registers 18 live companies; binned cards get no market record', () => {
  const st = demoMarket();
  assert.equal(Object.keys(st.companies).length, 18);
  assert.equal(Object.keys(st.cards).length, 20);
  assert.equal(st.companies.ledgerly.status, 'dealt');
  assert.equal(st.companies.ledgerly.contributorId, 'you');
  assert.equal(st.companies.vettd.contributorId, 'hirewire');
  assert.ok(!st.companies['legal-chambers-intl']);
});

test('invite sends one disclosure letter per company and says what was not shared', () => {
  const st = demoMarket();
  assert.equal(K.invite(st), 18);
  const invites = st.outbox.filter((m) => m.type === 'invite');
  assert.equal(invites.length, 18);
  const one = invites.find((m) => m.companyId === 'ledgerly');
  assert.match(one.body, /did not share your email address/);
  assert.match(one.body, /Do nothing\. Your card is deleted in 30 days/);
  assert.match(one.subject, /You pitched your inbox/);
  assert.equal(st.companies.ledgerly.status, 'invited');
  assert.equal(K.invite(st), 0, 'inviting twice sends nothing');
});

test('nothing happens to a company that has not opted in', () => {
  const st = demoMarket();
  K.invite(st);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly' }), /has not joined/);
  K.optIn(st, 'hirewire');
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly' }), /No pitch reaches a company that has not opted in/);
  K.decline(st, 'podly');
  assert.equal(st.companies.podly.status, 'declined');
  assert.throws(() => K.optIn(st, 'podly'), /declined earlier/);
});

test('the full happy path: propose, accept, pay (simulated), complete, split 50/20/10/20', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'hirewire', { listenPriceCents: 7500 });
  K.optIn(st, 'ledgerly', { listenPriceCents: 7500 });
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: 100 }), /charges at least \$75\.00/);
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', kind: 'read' });
  assert.equal(o.priceCents, 7500);
  assert.equal(o.status, 'proposed');
  assert.ok(st.outbox.some((m) => m.type === 'request' && m.offerId === o.id && /wants to pitch you/.test(m.subject)));
  assert.throws(() => K.pay(st, o.id), /after the listener accepts/);
  K.acceptOffer(st, o.id);
  K.pay(st, o.id);
  assert.equal(o.status, 'paid');
  const intro = st.outbox.find((m) => m.type === 'intro' && m.offerId === o.id);
  assert.ok(intro, 'intro email');
  assert.match(intro.body, /marcus@hirewire\.example/);
  assert.match(intro.body, /dana@ledgerly\.example/);
  assert.ok(st.outbox.some((m) => m.type === 'receipt' && /SIMULATED/.test(m.subject)));
  assert.throws(() => K.complete(st, o.id, { answer: 'maybe' }), /interested, not now, or no/);
  K.complete(st, o.id, { answer: 'interested' });
  assert.equal(o.status, 'completed');
  const s = K.summary(st);
  assert.equal(s.companies.ledgerly.cash, 3750, 'listener keeps 50%');
  assert.equal(s.contributors.you, 2250, 'you supplied both sides: 20% + 10%');
  assert.equal(s.platformCents, 1500, 'platform 20%');
  assert.equal(s.escrowCents, 0, 'escrow emptied');
  assert.equal(s.volumeCents, 7500);
  assert.equal(cashSum(st), 0, 'cash is conserved');
  assert.ok(st.outbox.some((m) => m.type === 'statement' && /earned \$22\.50/.test(m.subject) === false), 'statements are per share');
  const statements = st.outbox.filter((m) => m.type === 'statement' && m.offerId === o.id);
  assert.equal(statements.length, 2);
});

test('cross-pool: the contributor who supplied the listener earns 20%, the one who supplied the pitcher 10%', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'chatterbox', { listenPriceCents: 7500 });
  K.optIn(st, 'boomerangreturns', { listenPriceCents: 10000 });
  const o = K.propose(st, { from: 'chatterbox', to: 'boomerangreturns', kind: 'read' });
  assert.equal(o.priceCents, 10000);
  K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, { answer: 'not now' });
  const s = K.summary(st);
  assert.equal(s.companies.boomerangreturns.cash, 5000);
  assert.equal(s.contributors.priya, 2000, 'Priya supplied Boomerang, the listener');
  assert.equal(s.contributors.you, 1000, 'you supplied Chatterbox, the pitcher');
  assert.equal(s.platformCents, 2000);
  assert.equal(cashSum(st), 0);
});

test('a meeting costs twice the listen price; a swap is paid both ways and both sides get paid', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'deskwell', { listenPriceCents: 10000 });
  K.optIn(st, 'nordicbean', { listenPriceCents: 2500 });
  assert.equal(K.priceFloor(st, 'deskwell', 'nordicbean', 'meeting'), 5000);
  assert.throws(() => K.propose(st, { from: 'deskwell', to: 'nordicbean', kind: 'swap', payWith: 'credits' }), /settles in cash/);
  const o = K.propose(st, { from: 'deskwell', to: 'nordicbean', kind: 'swap' });
  assert.equal(o.priceCents, 5000, 'Deskwell pays Nordic Bean\'s meeting price');
  assert.equal(o.backPriceCents, 20000, 'Nordic Bean pays Deskwell\'s meeting price');
  K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, {});
  const s = K.summary(st);
  assert.equal(s.companies.nordicbean.cash, 2500);
  assert.equal(s.companies.nordicbean.paid, 20000);
  assert.equal(s.companies.deskwell.cash, 10000);
  assert.equal(s.companies.deskwell.paid, 5000);
  // Deskwell was supplied by two inboxes (you and Priya), so its contributor shares are split equally (coordinator's ruling
  // 2026-10-24; before it, you got all 7,500 as the first inbox). Leg 1 (5,000): you 1,000 for Nordic Bean, 250 + 250 for
  // Deskwell. Leg 2 (20,000): 2,000 + 2,000 for Deskwell, you 2,000 for Nordic Bean.
  assert.equal(s.contributors.you, 5250, 'you: 30% of both legs, less Priya\'s half of Deskwell\'s shares');
  assert.equal(s.contributors.priya, 2250, 'Priya also supplied Deskwell');
  assert.equal(s.platformCents, 5000);
  assert.equal(s.escrowCents, 0);
  assert.equal(cashSum(st), 0);
});

test('listen to earn: credits pay 25% more than cash, are spent on pitches, and the platform funds them from its cut', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
  K.optIn(st, 'outreachly', { listenPriceCents: 7500 });
  K.optIn(st, 'deskwell', { listenPriceCents: 4000 });
  // Outreachly pays cash to pitch Meridian; Meridian takes credits
  const o1 = K.propose(st, { from: 'outreachly', to: 'meridianoutbound', kind: 'read' });
  K.acceptOffer(st, o1.id); K.pay(st, o1.id); K.complete(st, o1.id, { answer: 'interested' });
  assert.equal(st.companies.meridianoutbound.creditsCents, 4688, '50% of $75 is $37.50; plus 25% is $46.88');
  let s = K.summary(st);
  assert.equal(s.companies.meridianoutbound.cash, 0);
  assert.equal(s.contributors.you, 1500, 'you supplied Meridian (listener)');
  assert.equal(s.contributors.hirewire, 750, 'Hirewire supplied Outreachly (pitcher)');
  assert.equal(s.platformCents, 1500 + 3750, 'platform fee plus the cash it holds against the credits it owes');
  assert.equal(cashSum(st), 0);
  // Meridian tries to spend more credits than it has
  const tooMuch = K.propose(st, { from: 'meridianoutbound', to: 'deskwell', kind: 'read', priceCents: 6000, payWith: 'credits' });
  K.acceptOffer(st, tooMuch.id);
  assert.throws(() => K.pay(st, tooMuch.id), /has \$46\.88 in credits and needs \$60\.00/);
  // ...then spends what it has
  const o2 = K.propose(st, { from: 'meridianoutbound', to: 'deskwell', kind: 'read', priceCents: 4500, payWith: 'credits' });
  K.acceptOffer(st, o2.id); K.pay(st, o2.id);
  assert.equal(st.companies.meridianoutbound.creditsCents, 188);
  K.complete(st, o2.id, { answer: 'no' });
  s = K.summary(st);
  assert.equal(s.companies.deskwell.cash, 2250, 'Deskwell is paid in cash although the pitch was bought with credits');
  assert.equal(s.contributors.you, 1500 + 450 + 450, 'you supplied Meridian, and Deskwell together with Priya (split since 2026-10-24)');
  assert.equal(s.contributors.priya, 450, 'Priya\'s half of Deskwell\'s 20% listener-contributor share');
  assert.equal(s.platformCents, 5250 - 3600, 'the credit-paid pitch cost the platform the cash it paid out');
  assert.equal(cashSum(st), 0, 'cash still conserved');
  assert.equal(creditSum(st), 4688 - 4500 + 4500 - 4500, 'credits: earned 4688, spent 4500 (escrowed and released)');
  assert.equal(s.creditsOutstandingCents, 188);
});

test('open pitches: matched companies read, answer, and get paid; unused budget is refunded', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'stacklinestudio');
  K.optIn(st, 'chatterbox', { payout: 'credits' });
  K.optIn(st, 'nordicbean');
  const p = K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 3 });
  const eligible = K.eligibleReaders(st, p.id);
  assert.ok(eligible.includes('chatterbox'), 'Chatterbox is matched');
  assert.ok(!eligible.includes('nordicbean'), 'Nordic Bean is not what Stackline targets');
  assert.ok(!eligible.includes('stacklinestudio'));
  assert.throws(() => K.readOpenPitch(st, { pitchId: p.id, listenerId: 'nordicbean', answer: 'no' }), /not eligible/);
  K.readOpenPitch(st, { pitchId: p.id, listenerId: 'chatterbox', answer: 'not now' });
  assert.equal(st.companies.chatterbox.creditsCents, 1250, '50% of $20 = $10, +25% = $12.50 in credits');
  assert.throws(() => K.readOpenPitch(st, { pitchId: p.id, listenerId: 'chatterbox', answer: 'no' }), /not eligible/);
  K.closeOpenPitch(st, p.id);
  const s = K.summary(st);
  assert.equal(s.companies.stacklinestudio.paid, 6000 - 4000, 'paid $60, refunded $40');
  assert.equal(s.escrowCents, 0);
  assert.equal(cashSum(st), 0);
});

test('no match, no pitch — unless the booth is open', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'chatterbox');
  K.optIn(st, 'brightpath', { listenPriceCents: 50000 });
  assert.equal(K.canPitch(st, 'chatterbox', 'brightpath').ok, false);
  assert.throws(() => K.propose(st, { from: 'chatterbox', to: 'brightpath' }), /No match/);
  K.setOpenBooth(st, 'brightpath', true);
  assert.equal(K.canPitch(st, 'chatterbox', 'brightpath').ok, true);
  const o = K.propose(st, { from: 'chatterbox', to: 'brightpath', kind: 'meeting' });
  assert.equal(o.priceCents, 100000, 'a meeting with a VC: twice the $500 listen price');
});

test('declining an offer moves no money; the Dealer narrates every step', () => {
  const st = demoMarket();
  K.invite(st);
  K.optIn(st, 'hirewire'); K.optIn(st, 'ledgerly');
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly' });
  K.declineOffer(st, o.id, 'not now');
  assert.equal(o.status, 'declined');
  assert.equal(st.ledger.length, 0);
  assert.ok(st.log.length >= 4);
  assert.match(st.log[st.log.length - 1].text, /No money moves/);
});
