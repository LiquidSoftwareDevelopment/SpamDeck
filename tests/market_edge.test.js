'use strict';
// Market holes found in the 2026-10-24 review. Each test names the input that used to break the market.
const test = require('node:test');
const assert = require('node:assert/strict');
const { K, CONTRIBUTORS, demoDeck, demoMarket, cashSum, creditSum } = require('./helpers.js');

function joined(ids, opts) {
  const st = demoMarket();
  K.invite(st);
  ids.forEach((id) => K.optIn(st, id, opts && opts[id]));
  return st;
}
function wholeCents(st) { for (const e of st.ledger) assert.ok(Number.isSafeInteger(e.amountCents), e.type + ' ' + e.amountCents); }

test('an offer price that is not a number is refused, and nothing is charged (was NaN in the ledger)', () => {
  for (const bad of [NaN, Infinity, -Infinity, 'abc', '12abc', {}, [1, 2]]) {
    const st = joined(['hirewire', 'ledgerly'], { ledgerly: { listenPriceCents: 0 } });
    assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: bad }), /must be a number of dollars/, String(bad));
    assert.equal(Object.keys(st.offers).length, 0);
    assert.equal(st.ledger.length, 0);
  }
});

test('offer prices: half cents round, numeric strings count, negatives stay below the floor', () => {
  const st = joined(['hirewire', 'ledgerly'], { ledgerly: { listenPriceCents: 0 } });
  assert.equal(K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: 12.5 }).priceCents, 13);
  assert.equal(K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: '75' }).priceCents, 75);
  assert.equal(K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: ' 75 ' }).priceCents, 75);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: -1 }), /charges at least \$0\.00/);
  assert.equal(K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: null }).priceCents, 0, 'no price means the floor');
});

test('amounts too large to keep exact to the cent are refused', () => {
  const st = joined(['hirewire', 'ledgerly']);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: 1e300 }), /exact to the cent/);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: K.MAX_CENTS + 1 }), /exact to the cent/);
  assert.throws(() => K.setListenPrice(st, 'ledgerly', 1e300), /exact to the cent/);
  // The largest legal price still splits to the cent.
  K.setListenPrice(st, 'ledgerly', 0);
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: K.MAX_CENTS });
  K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, { answer: 'no' });
  assert.equal(cashSum(st), 0);
  wholeCents(st);
});

test('a listen price of Infinity is refused (it used to price every pitch at Infinity)', () => {
  const st = joined(['hirewire', 'ledgerly']);
  for (const bad of [Infinity, NaN, 'abc', -1, null, '', true]) {
    assert.throws(() => K.setListenPrice(st, 'ledgerly', bad), /A listen price must be a number of dollars, zero or more\./, String(bad));
  }
  assert.equal(st.companies.ledgerly.listenPriceCents, 7500, 'unchanged');
  K.setListenPrice(st, 'ledgerly', '75');
  assert.equal(st.companies.ledgerly.listenPriceCents, 75);
  K.setListenPrice(st, 'ledgerly', 12.5);
  assert.equal(st.companies.ledgerly.listenPriceCents, 13);
});

test('a failed join leaves the company exactly as it was (it used to be opted in anyway)', () => {
  const st = demoMarket();
  K.invite(st);
  const before = JSON.stringify(st.companies.ledgerly);
  assert.throws(() => K.optIn(st, 'ledgerly', { listenPriceCents: -5 }), /listen price/);
  assert.throws(() => K.optIn(st, 'ledgerly', { listenPriceCents: Infinity }), /listen price/);
  assert.throws(() => K.optIn(st, 'ledgerly', { payout: 'bitcoin' }), /cash or credits/);
  assert.equal(JSON.stringify(st.companies.ledgerly), before);
  assert.equal(st.companies.ledgerly.status, 'invited');
  K.optIn(st, 'ledgerly', { listenPriceCents: 5000, payout: 'credits', openBooth: true });
  assert.equal(st.companies.ledgerly.status, 'opted_in');
  assert.equal(st.companies.ledgerly.payout, 'credits');
});

test('consent runs in order: a company joins or declines only after it has been invited', () => {
  const st = demoMarket();
  assert.throws(() => K.optIn(st, 'ledgerly'), /has not been invited yet/);
  assert.throws(() => K.decline(st, 'podly'), /has not been invited yet/);
  assert.equal(st.companies.ledgerly.status, 'dealt');
  assert.equal(st.companies.podly.status, 'dealt');
  K.invite(st, ['ledgerly', 'podly']);
  K.optIn(st, 'ledgerly');
  K.decline(st, 'podly');
  assert.throws(() => K.decline(st, 'ledgerly'), /already joined/);
  assert.throws(() => K.optIn(st, 'podly'), /declined earlier/);
});

test('declining twice is one decline: the 30-day clock is not restarted and the log is not repeated', () => {
  const st = demoMarket({ fixedNow: '2026-10-01T00:00:00.000Z' });
  K.invite(st, ['podly']);
  K.decline(st, 'podly');
  const n = st.log.length;
  st.fixedNow = '2026-10-20T00:00:00.000Z';
  K.decline(st, 'podly');
  assert.equal(st.companies.podly.declinedAt, '2026-10-01T00:00:00.000Z');
  assert.equal(st.log.length, n);
});

test('inviting a list that names an unknown company invites nobody', () => {
  const st = demoMarket();
  assert.throws(() => K.invite(st, ['ledgerly', 'no-such-co']), /No such company/);
  assert.equal(st.companies.ledgerly.status, 'dealt', 'was invited, with its letter in the outbox');
  assert.equal(st.outbox.length, 0);
  assert.equal(K.invite(st, 'ledgerly'), 1, 'a single id works too');
});

test('the four shares must be whole, non-negative basis points (garbage used to pass as 0)', () => {
  const base = { listener: 5000, listenerContributor: 2000, pitcherContributor: 1000, platform: 2000 };
  assert.ok(K.validateSplits(base));
  assert.throws(() => K.validateSplits(Object.assign({}, base, { listener: 'fifty', listenerContributor: 7000 })), /whole number of basis points/);
  assert.throws(() => K.validateSplits(Object.assign({}, base, { listener: 5000.9 })), /whole number of basis points/);
  assert.throws(() => K.validateSplits(Object.assign({}, base, { listener: NaN, platform: 7000 })), /whole number of basis points/);
  assert.throws(() => K.validateSplits(Object.assign({}, base, { listener: 4294972296 })), /add up to 100%/, 'was accepted: 2^32 + 5000 wrapped to 5000');
  assert.throws(() => K.validateSplits(Object.assign({}, base, { listener: 9000, platform: -2000 })), /cannot be negative/);
  assert.throws(() => K.validateSplits(undefined), /add up to 100%/, 'was a TypeError');
  assert.throws(() => K.createState({ config: { splitsBp: { listener: 'x', listenerContributor: 7000, pitcherContributor: 1000, platform: 2000 } } }), /whole number/);
});

test('the market settings are checked when the market is created', () => {
  assert.throws(() => K.createState({ config: { meetingMultiplier: 0 } }), /meeting/i);
  assert.throws(() => K.createState({ config: { meetingMultiplier: NaN } }), /meeting/i);
  assert.throws(() => K.createState({ config: { creditBonusBp: -1 } }), /credit bonus/i);
  assert.throws(() => K.createState({ config: { creditBonusBp: 2.5 } }), /credit bonus/i);
  assert.throws(() => K.createState({ config: { matchThreshold: 'high' } }), /match threshold/i);
  assert.ok(K.createState({ config: { meetingMultiplier: 1.5, creditBonusBp: 0, matchThreshold: 40 } }));
});

test('a fractional meeting multiplier still prices meetings in whole cents, rounded up for the listener', () => {
  const st = K.createState({ fixedNow: '2026-10-24T12:00:00.000Z', config: { meetingMultiplier: 1.5 } });
  K.addContributors(st, CONTRIBUTORS);
  K.addCards(st, demoDeck().cards);
  K.invite(st);
  K.optIn(st, 'hirewire', { listenPriceCents: 3333 });
  K.optIn(st, 'ledgerly', { listenPriceCents: 2525 });
  assert.equal(K.priceFloor(st, 'hirewire', 'ledgerly', 'meeting'), 3788, 'was 3787.5');
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', kind: 'meeting' });
  assert.equal(o.priceCents, 3788);
  K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, {});
  wholeCents(st);
  assert.equal(cashSum(st), 0);
});

test('odd amounts split exactly: 0, 1, 3, 7 and 333 cents, and every amount up to $1,000', () => {
  const st = joined(['hirewire', 'ledgerly']);
  K.setListenPrice(st, 'ledgerly', 0);
  for (const g of [0, 1, 2, 3, 5, 7, 333]) {
    const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: g });
    K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, { answer: 'no' });
    const d = o.distributions[0];
    const parts = d.listenerCents + d.contributorShares.reduce((n, cs) => n + cs.amountCents, 0) + d.platformCents;
    assert.equal(parts, g, g + ' cents: the parts add up to the whole');
    assert.ok(d.platformCents >= 0, g + ' cents: platform share ' + d.platformCents);
  }
  const d333 = st.offers[Object.keys(st.offers).pop()].distributions[0];
  assert.deepEqual([d333.listenerCents, d333.contributorShares.map((c) => c.amountCents), d333.platformCents], [167, [67, 33], 66]);
  assert.equal(cashSum(st), 0);
  // Every gross amount up to $1,000 under the default house rules, without walking the market.
  const s = st.config.splitsBp;
  for (let g = 0; g <= 100000; g++) {
    const l = Math.round(g * s.listener / 10000), a = Math.round(g * s.listenerContributor / 10000), b = Math.round(g * s.pitcherContributor / 10000);
    const p = g - l - a - b;
    if (p < 0 || l < 0 || a < 0 || b < 0) assert.fail('negative share at ' + g + ' cents');
  }
});

test('with a 0% platform share the platform absorbs rounding by at most one cent', () => {
  const st = K.createState({ fixedNow: '2026-10-24T12:00:00.000Z', config: { splitsBp: { listener: 6000, listenerContributor: 2500, pitcherContributor: 1500, platform: 0 } } });
  K.addContributors(st, CONTRIBUTORS);
  K.addCards(st, demoDeck().cards);
  K.invite(st);
  K.optIn(st, 'hirewire'); K.optIn(st, 'ledgerly', { listenPriceCents: 0 });
  for (let g = 0; g <= 40; g++) {
    const o = K.propose(st, { from: 'hirewire', to: 'ledgerly', priceCents: g });
    K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, { answer: 'no' });
    assert.ok(o.distributions[0].platformCents >= -1, g + ': ' + o.distributions[0].platformCents);
  }
  assert.equal(cashSum(st), 0);
});

test('open pitches refuse budgets that are not finite numbers (Infinity used to put NaN in the ledger)', () => {
  const st = joined(['stacklinestudio', 'chatterbox']);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: Infinity, maxReads: 2 }), /Price per read/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: Infinity }), /reads/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 'abc', maxReads: 2 }), /Price per read/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 0, maxReads: 2 }), /Price per read must be above zero/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 0 }), /Allow at least one read/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 2, minScore: 'high' }), /match score/);
  assert.throws(() => K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: K.MAX_CENTS, maxReads: 2 }), /exact to the cent/);
  assert.equal(st.ledger.length, 0);
  assert.equal(Object.keys(st.openPitches).length, 0);
  const p = K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 2.5, minScore: '50' });
  assert.equal(p.maxReads, 3);
  assert.equal(p.minScore, 50);
  assert.equal(cashSum(st), 0);
});

test('nobody is eligible to read a closed open pitch', () => {
  const st = joined(['stacklinestudio', 'chatterbox']);
  const p = K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 3 });
  assert.deepEqual(K.eligibleReaders(st, p.id), ['chatterbox']);
  K.closeOpenPitch(st, p.id);
  assert.deepEqual(K.eligibleReaders(st, p.id), [], 'was ["chatterbox"]');
  assert.throws(() => K.readOpenPitch(st, { pitchId: p.id, listenerId: 'chatterbox', answer: 'no' }), /That open pitch is closed\./);
});

test('summary after a refund: money returned is not volume', () => {
  const st = joined(['stacklinestudio', 'chatterbox']);
  const p = K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 2000, maxReads: 3 });
  K.readOpenPitch(st, { pitchId: p.id, listenerId: 'chatterbox', answer: 'no' });
  K.closeOpenPitch(st, p.id);
  const s = K.summary(st);
  assert.equal(s.companies.stacklinestudio.paid, 2000);
  assert.equal(s.volumeCents, 2000, 'was 6000: the $40 that came back was counted as paid in');
  assert.equal(s.completedPitches, 1);
  assert.equal(s.escrowCents, 0);
});

test('summary agrees with the ledger and the company records after credits, refunds and a swap', () => {
  const st = joined(['meridianoutbound', 'outreachly', 'deskwell', 'nordicbean', 'stacklinestudio', 'chatterbox'], {
    meridianoutbound: { listenPriceCents: 7500, payout: 'credits' }, deskwell: { listenPriceCents: 4000 }, nordicbean: { listenPriceCents: 2500 } });
  const flow = (o, answer) => { K.acceptOffer(st, o.id); K.pay(st, o.id); K.complete(st, o.id, answer ? { answer } : {}); };
  flow(K.propose(st, { from: 'outreachly', to: 'meridianoutbound', kind: 'read' }), 'interested');
  flow(K.propose(st, { from: 'meridianoutbound', to: 'deskwell', kind: 'read', priceCents: 4500, payWith: 'credits' }), 'no');
  flow(K.propose(st, { from: 'deskwell', to: 'nordicbean', kind: 'swap' }));
  const p = K.postOpenPitch(st, { from: 'stacklinestudio', pricePerReadCents: 1999, maxReads: 4 });
  K.readOpenPitch(st, { pitchId: p.id, listenerId: 'chatterbox', answer: 'interested' });
  K.closeOpenPitch(st, p.id);
  const s = K.summary(st);
  assert.equal(cashSum(st), 0);
  const companyCredits = Object.values(s.companies).reduce((n, c) => n + c.credits, 0);
  assert.equal(companyCredits, s.creditsOutstandingCents);
  assert.equal(creditSum(st), s.creditsOutstandingCents + s.escrowCreditsCents);
  for (const [id, c] of Object.entries(s.companies)) assert.equal(c.credits, st.companies[id].creditsCents, id);
  const paidIn = st.ledger.filter((e) => e.type === 'payment' || e.type === 'credits_spent').reduce((n, e) => n - e.amountCents, 0);
  const refunds = st.ledger.filter((e) => e.type === 'refund').reduce((n, e) => n + e.amountCents, 0);
  assert.equal(s.volumeCents, paidIn - refunds);
  const total = s.platformCents + s.escrowCents + Object.values(s.contributors).reduce((n, x) => n + x, 0) + Object.values(s.companies).reduce((n, c) => n + c.cash - c.paid, 0);
  assert.equal(total, 0, 'every cash cent is somewhere');
});

test('an unknown pitch kind is refused even when it is the name of a built-in property', () => {
  const st = joined(['hirewire', 'ledgerly']);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', kind: 'constructor' }), /Unknown pitch kind: constructor/);
  assert.throws(() => K.propose(st, { from: 'hirewire', to: 'ledgerly', kind: 'toString' }), /Unknown pitch kind/);
});

test('the ledger only ever holds whole cents: a broken amount is stopped at the door', () => {
  const st = joined(['hirewire', 'ledgerly']);
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly' });
  K.acceptOffer(st, o.id);
  o.priceCents = 12.5; // simulate a corrupted saved state
  assert.throws(() => K.pay(st, o.id), /whole cents/);
  assert.equal(st.ledger.length, 0, 'nothing was written');
  assert.equal(o.status, 'accepted');
});

test('wrong-order actions are refused and change nothing', () => {
  const st = joined(['hirewire', 'ledgerly']);
  const o = K.propose(st, { from: 'hirewire', to: 'ledgerly' });
  const snap = () => JSON.stringify({ o, ledger: st.ledger, c: st.companies });
  let s0 = snap();
  assert.throws(() => K.pay(st, o.id), /after the listener accepts/);
  assert.throws(() => K.complete(st, o.id, { answer: 'no' }), /Nothing to release/);
  assert.equal(snap(), s0);
  K.acceptOffer(st, o.id);
  s0 = snap();
  assert.throws(() => K.acceptOffer(st, o.id), /not open/);
  assert.throws(() => K.declineOffer(st, o.id), /not open/);
  assert.throws(() => K.complete(st, o.id, { answer: 'no' }), /Nothing to release/);
  assert.equal(snap(), s0);
  K.pay(st, o.id);
  s0 = snap();
  assert.throws(() => K.pay(st, o.id), /after the listener accepts/, 'no double payment');
  assert.throws(() => K.complete(st, o.id, { answer: 'maybe' }), /interested, not now, or no/);
  assert.equal(snap(), s0);
  K.complete(st, o.id, { answer: 'no' });
  s0 = snap();
  assert.throws(() => K.complete(st, o.id, { answer: 'no' }), /Nothing to release/, 'no double completion');
  assert.throws(() => K.declineOffer(st, o.id), /not open/);
  assert.equal(snap(), s0);
  const d = K.propose(st, { from: 'hirewire', to: 'ledgerly' });
  K.declineOffer(st, d.id);
  assert.throws(() => K.acceptOffer(st, d.id), /not open/);
  assert.throws(() => K.pay(st, d.id), /after the listener accepts/, 'a declined offer cannot be paid');
  assert.equal(cashSum(st), 0);
});

test('the pitch kinds describe what the engine actually does', () => {
  assert.match(K.KINDS.read.blurb, /interested, not now, or no/, 'complete() accepts exactly these answers');
  assert.ok(!/answer yes/.test(K.KINDS.read.blurb));
  assert.match(K.KINDS.swap.blurb, /records both legs/);
  assert.ok(!/nets it out/.test(K.KINDS.swap.blurb), 'the ledger records both legs in full; nothing is netted');
});
