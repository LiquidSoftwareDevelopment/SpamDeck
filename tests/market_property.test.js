'use strict';
// Property test: 300 random sequences of market actions over the demo deck, with varied house rules, checking every
// invariant after every action. Seeded (mulberry32), no dependencies: a failure names its seed and step, and replays.
const test = require('node:test');
const assert = require('node:assert/strict');
const { K, X, CONTRIBUTORS, EMAILS, demoDeck, cashSum } = require('./helpers.js');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const SPLITS = [
  { listener: 5000, listenerContributor: 2000, pitcherContributor: 1000, platform: 2000 },
  { listener: 6000, listenerContributor: 2500, pitcherContributor: 1500, platform: 0 },
  { listener: 3333, listenerContributor: 3333, pitcherContributor: 3334, platform: 0 },
  { listener: 2500, listenerContributor: 2500, pitcherContributor: 2500, platform: 2500 },
  { listener: 10000, listenerContributor: 0, pitcherContributor: 0, platform: 0 },
  { listener: 1, listenerContributor: 1, pitcherContributor: 1, platform: 9997 }
];
const ODD = [0, 1, 2, 3, 5, 7, 99, 333, 2525, 7500, 10001, 12345];
const GARBAGE = [NaN, Infinity, -Infinity, -5, 'abc', '', null, true, {}, 1e300];
const TRANSITIONS = { proposed: ['accepted', 'declined'], accepted: ['paid'], paid: ['completed'], completed: [], declined: [] };
const CONSENT = { dealt: ['invited'], invited: ['opted_in', 'declined'], opted_in: [], declined: [] };
const heuristicDeck = X.dealEmails(EMAILS, (e) => X.heuristicRead(e)).cards;

function makeMarket(rnd) {
  const config = { splitsBp: SPLITS[Math.floor(rnd() * SPLITS.length)], meetingMultiplier: [2, 1.5, 3, 1.25][Math.floor(rnd() * 4)], creditBonusBp: [2500, 0, 3333, 10000][Math.floor(rnd() * 4)] };
  const st = K.createState({ fixedNow: '2026-10-24T12:00:00.000Z', config });
  K.addContributors(st, CONTRIBUTORS);
  K.addCards(st, rnd() < 0.2 ? JSON.parse(JSON.stringify(heuristicDeck)) : demoDeck().cards);
  for (const id of Object.keys(st.companies)) {
    const r = rnd();
    if (r < 0.15) { st.companies[id].contributorId = null; st.cards[id].sources = []; }      // nobody supplied it: its shares go to the platform
    else if (r < 0.35) st.cards[id].sources = st.cards[id].sources.concat([{ emailId: 'extra-' + id, contributorId: ['you', 'priya', 'hirewire'][Math.floor(rnd() * 3)] }]); // a second inbox: shares split
  }
  return st;
}

// What escrow must hold, computed from the offers and open pitches rather than from the ledger.
function owedByEscrow(st) {
  let cash = 0, credits = 0;
  for (const o of Object.values(st.offers)) {
    if (o.status !== 'paid') continue;
    if (o.payWith === 'credits') credits += o.priceCents; else cash += o.priceCents;
    cash += o.backPriceCents;
  }
  for (const p of Object.values(st.openPitches)) if (p.status === 'open') cash += p.budgetCents - p.spentCents;
  return { cash, credits };
}

function checkInvariants(st, prev, where) {
  const s = K.summary(st);
  assert.equal(cashSum(st), 0, where + ': cash is conserved');
  for (const e of st.ledger) assert.ok(Number.isSafeInteger(e.amountCents), where + ': whole cents ' + e.amountCents);
  const owed = owedByEscrow(st);
  assert.ok(s.escrowCents >= 0 && s.escrowCreditsCents >= 0, where + ': escrow never negative');
  assert.equal(s.escrowCents, owed.cash, where + ': escrow holds exactly the cash still owed');
  assert.equal(s.escrowCreditsCents, owed.credits, where + ': escrow holds exactly the credits still owed');
  // Credits: never negative, and the ledger agrees with each company record.
  const ledgerCredits = {};
  for (const e of st.ledger) if (e.credits && e.party.kind === 'company') ledgerCredits[e.party.id] = (ledgerCredits[e.party.id] || 0) + e.amountCents;
  let outstanding = 0;
  for (const [id, c] of Object.entries(st.companies)) {
    assert.ok(Number.isSafeInteger(c.creditsCents) && c.creditsCents >= 0, where + ': ' + id + ' credits ' + c.creditsCents);
    assert.equal(c.creditsCents, ledgerCredits[id] || 0, where + ': ' + id + ' credits match the ledger');
    assert.equal(s.companies[id].credits, c.creditsCents, where + ': summary credits for ' + id);
    outstanding += c.creditsCents;
    assert.ok(c.listenPriceCents >= 0 && Number.isSafeInteger(c.listenPriceCents), where + ': listen price');
    const was = prev.companies[id];
    assert.ok(was === c.status || CONSENT[was].includes(c.status), where + ': ' + id + ' consent ' + was + ' -> ' + c.status);
    prev.companies[id] = c.status;
  }
  assert.equal(s.creditsOutstandingCents, outstanding, where);
  // Offers: only legal transitions; money fields consistent with the status.
  let completed = 0;
  for (const o of Object.values(st.offers)) {
    const was = prev.offers[o.id];
    assert.ok(was === undefined ? o.status === 'proposed' : (was === o.status || TRANSITIONS[was].includes(o.status)), where + ': offer ' + o.id + ' ' + was + ' -> ' + o.status);
    prev.offers[o.id] = o.status;
    for (const f of ['priceCents', 'backPriceCents']) assert.ok(Number.isSafeInteger(o[f]) && o[f] >= 0 && o[f] <= K.MAX_CENTS, where + ': offer ' + o.id + ' ' + f + ' ' + o[f]);
    assert.equal(!!o.paidAt, o.status === 'paid' || o.status === 'completed', where + ': paidAt');
    assert.equal(o.distributions.length, o.status === 'completed' ? (o.kind === 'swap' ? 2 : 1) : 0, where + ': distributions');
    for (const d of o.distributions) {
      const parts = (d.viaCredits ? 0 : d.listenerCents) + d.contributorShares.reduce((n, cs) => n + cs.amountCents, 0) + d.platformCents;
      if (!d.viaCredits && d.listenerCredits === 0) assert.equal(parts, d.grossCents, where + ': parts add up to the whole');
    }
    if (o.status === 'completed') completed++;
  }
  // Open pitches: spend, reads and budget agree.
  let reads = 0;
  for (const p of Object.values(st.openPitches)) {
    for (const f of ['pricePerReadCents', 'maxReads', 'budgetCents']) assert.ok(Number.isSafeInteger(p[f]) && p[f] > 0 && p[f] <= K.MAX_CENTS, where + ': open pitch ' + f + ' ' + p[f]);
    assert.ok(typeof p.minScore === 'number' && isFinite(p.minScore), where + ': open pitch minScore ' + p.minScore);
    assert.equal(p.spentCents, p.reads.length * p.pricePerReadCents, where + ': spent');
    assert.ok(p.reads.length <= p.maxReads, where + ': reads');
    assert.equal(p.budgetCents, p.pricePerReadCents * p.maxReads, where + ': budget');
    if (p.reads.length === p.maxReads) assert.equal(p.status, 'closed', where + ': full pitch is closed');
    reads += p.reads.length;
  }
  // The summary agrees with the ledger, line by line.
  let platform = 0, volume = 0; const contrib = {}, comp = {};
  for (const e of st.ledger) {
    const k = e.party.kind, id = e.party.id, a = e.amountCents;
    if (k === 'platform') platform += a;
    if (k === 'contributor') contrib[id] = (contrib[id] || 0) + a;
    if (k === 'company' && !e.credits) {
      comp[id] = comp[id] || { cash: 0, paid: 0 };
      if (e.type === 'refund') comp[id].paid -= a; else if (a < 0) comp[id].paid -= a; else comp[id].cash += a;
    }
    if (e.type === 'payment' || e.type === 'credits_spent') volume -= a;
    if (e.type === 'refund') volume -= a;
  }
  assert.equal(s.platformCents, platform, where + ': platform');
  assert.equal(s.volumeCents, volume, where + ': volume');
  for (const [id, v] of Object.entries(contrib)) assert.equal(s.contributors[id], v, where + ': contributor ' + id);
  for (const [id, v] of Object.entries(comp)) { assert.equal(s.companies[id].cash, v.cash, where + ': cash ' + id); assert.equal(s.companies[id].paid, v.paid, where + ': paid ' + id); }
  assert.equal(s.completedPitches, completed + reads, where + ': pitches heard');
  const total = s.platformCents + s.escrowCents + Object.values(s.contributors).reduce((n, x) => n + x, 0) + Object.values(s.companies).reduce((n, c) => n + c.cash - c.paid, 0);
  assert.equal(total, 0, where + ': every cash cent is somewhere');
  const counts = { dealt: 0, invited: 0, opted_in: 0, declined: 0 };
  for (const c of Object.values(st.companies)) counts[c.status]++;
  for (const k of Object.keys(counts)) assert.equal(s.counts[k], counts[k], where + ': count ' + k);
}

function fingerprint(st) {
  return JSON.stringify({ c: st.companies, o: st.offers, p: st.openPitches, n: st.ledger.length, last: st.ledger[st.ledger.length - 1], m: st.outbox.length, l: st.log.length, seq: st.seq });
}

function runSequence(seed, steps) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const st = makeMarket(rnd);
  if (rnd() < 0.7) K.invite(st);   // most markets start by sending every letter; the rest invite one at a time
  const prev = { companies: {}, offers: {} };
  for (const [id, c] of Object.entries(st.companies)) prev.companies[id] = c.status;
  const ids = (status) => Object.keys(st.companies).filter((id) => st.companies[id].status === status);
  const offers = (status) => Object.values(st.offers).filter((o) => status.includes(o.status));
  const price = () => (rnd() < 0.5 ? pick(ODD) : Math.floor(rnd() * 60000));
  const stats = { ok: 0, refused: 0 };
  const actions = [
    [3, () => (rnd() < 0.3 ? K.invite(st) : K.invite(st, [pick(Object.keys(st.companies))]))],
    [6, () => { const id = pick(rnd() < 0.9 && ids('invited').length ? ids('invited') : Object.keys(st.companies)); if (id) K.optIn(st, id, { listenPriceCents: rnd() < 0.8 ? (rnd() < 0.95 ? price() : pick(GARBAGE)) : undefined, payout: rnd() < 0.5 ? 'credits' : (rnd() < 0.97 ? 'cash' : 'bitcoin'), openBooth: rnd() < 0.25 }); }],
    [1, () => { const id = pick(ids('invited').concat(ids('opted_in'))); if (id) K.decline(st, id); }],
    [2, () => { const id = pick(ids('opted_in')); if (id) K.setListenPrice(st, id, rnd() < 0.85 ? price() : pick(GARBAGE)); }],
    [1, () => { const id = pick(ids('opted_in')); if (id) K.setPayout(st, id, rnd() < 0.9 ? pick(['cash', 'credits']) : 'bitcoin'); }],
    [1, () => { const id = pick(ids('opted_in')); if (id) K.setOpenBooth(st, id, rnd() < 0.5); }],
    [12, () => {
      const from = pick(rnd() < 0.95 ? ids('opted_in') : Object.keys(st.companies));
      if (!from) return;
      const legal = st.companies[from].status === 'opted_in' ? ids('opted_in').filter((t) => t !== from && K.canPitch(st, from, t).ok) : [];
      const to = rnd() < 0.85 && legal.length ? pick(legal) : pick(Object.keys(st.companies));
      const kind = pick(['read', 'read', 'meeting', 'swap']);
      let floor = 0; try { floor = K.priceFloor(st, from, to, kind); } catch (e) { floor = 0; }
      const r = rnd();
      const priceCents = r < 0.5 ? undefined : (r < 0.85 ? floor + pick(ODD) : (r < 0.93 ? floor - 1 : pick(GARBAGE)));
      const payWith = kind !== 'swap' && st.companies[from] && st.companies[from].creditsCents > 0 && rnd() < 0.6 ? 'credits' : (rnd() < 0.05 ? 'credits' : 'cash');
      K.propose(st, { from, to, kind, priceCents, payWith });
    }],
    [6, () => {   // spend credits: the path where SpamDeck funds the payouts from its own cash
      const from = pick(ids('opted_in').filter((id) => st.companies[id].creditsCents > 0)); if (!from) return;
      const credits = st.companies[from].creditsCents, kind = rnd() < 0.8 ? 'read' : 'meeting';
      const to = pick(ids('opted_in').filter((t) => t !== from && K.canPitch(st, from, t).ok && K.priceFloor(st, from, t, kind) <= credits)); if (!to) return;
      const floor = K.priceFloor(st, from, to, kind);
      K.propose(st, { from, to, kind, priceCents: floor + Math.floor(rnd() * (credits - floor + 1)), payWith: 'credits' });
    }],
    [8, () => { const o = pick(offers(rnd() < 0.9 ? ['proposed'] : ['accepted', 'paid', 'completed', 'declined'])); if (o) K.acceptOffer(st, o.id); }],
    [2, () => { const o = pick(offers(rnd() < 0.9 ? ['proposed'] : ['accepted', 'paid', 'completed'])); if (o) K.declineOffer(st, o.id, 'no thanks'); }],
    [8, () => { const o = pick(offers(rnd() < 0.9 ? ['accepted'] : ['proposed', 'paid', 'completed', 'declined'])); if (o) K.pay(st, o.id); }],
    [8, () => { const o = pick(offers(rnd() < 0.9 ? ['paid'] : ['proposed', 'accepted', 'completed', 'declined'])); if (o) K.complete(st, o.id, o.kind === 'read' || rnd() < 0.1 ? { answer: rnd() < 0.95 ? pick(['interested', 'not now', 'no']) : 'maybe' } : {}); }],
    [3, () => { const from = pick(ids('opted_in')); if (from) K.postOpenPitch(st, { from, pricePerReadCents: rnd() < 0.9 ? 1 + Math.floor(rnd() * 5000) : pick(GARBAGE), maxReads: rnd() < 0.95 ? 1 + Math.floor(rnd() * 5) : pick(GARBAGE), minScore: rnd() < 0.5 ? undefined : pick([0, 30, 55, 70, 101]) }); }],
    [6, () => {
      const p = pick(Object.values(st.openPitches)); if (!p) return;
      const eligible = K.eligibleReaders(st, p.id);
      const listenerId = rnd() < 0.85 && eligible.length ? pick(eligible) : pick(Object.keys(st.companies));
      K.readOpenPitch(st, { pitchId: p.id, listenerId, answer: rnd() < 0.95 ? pick(['interested', 'not now', 'no']) : 'later' });
    }],
    [2, () => { const p = pick(Object.values(st.openPitches)); if (p) K.closeOpenPitch(st, p.id); }]
  ];
  const weights = actions.reduce((n, a) => n + a[0], 0);
  for (let step = 0; step < steps; step++) {
    let r = rnd() * weights, a = 0;
    while (r >= actions[a][0]) { r -= actions[a][0]; a++; }
    const before = fingerprint(st);
    try { actions[a][1](); stats.ok++; }
    catch (e) {
      stats.refused++;
      assert.ok(e instanceof Error && typeof e.message === 'string' && e.message.length > 0 && !/undefined|TypeError|Cannot read/.test(e.message), 'seed ' + seed + ' step ' + step + ': plain-English refusal, got: ' + e.message);
      assert.equal(fingerprint(st), before, 'seed ' + seed + ' step ' + step + ': a refused action (' + e.message + ') changed the market');
    }
    checkInvariants(st, prev, 'seed ' + seed + ' step ' + step + ' action ' + a);
  }
  // Drain: every open offer is accepted, paid where the payer can, and answered; every open pitch is closed.
  // Each step is checked like the random ones, and escrow must end empty to the cent.
  const drainStep = (label, fn) => {
    const before = fingerprint(st);
    try { fn(); } catch (e) { assert.equal(fingerprint(st), before, 'seed ' + seed + ' ' + label + ': a refused action changed the market'); }
    checkInvariants(st, prev, 'seed ' + seed + ' ' + label);
  };
  for (const o of offers(['proposed'])) drainStep('drain accept', () => K.acceptOffer(st, o.id));
  for (const o of offers(['accepted'])) drainStep('drain pay', () => K.pay(st, o.id));   // too few credits: refused, stays accepted
  for (const o of offers(['paid'])) drainStep('drain complete', () => K.complete(st, o.id, o.kind === 'read' ? { answer: 'no' } : {}));
  for (const p of Object.values(st.openPitches)) drainStep('drain close', () => K.closeOpenPitch(st, p.id));
  const s = K.summary(st);
  assert.equal(s.escrowCents, 0, 'seed ' + seed + ': escrow empty after draining');
  assert.equal(s.escrowCreditsCents, 0, 'seed ' + seed + ': credit escrow empty after draining');
  return { st, stats };
}

test('300 random sequences of market actions keep every invariant after every action', () => {
  const n = { ok: 0, refused: 0, completed: 0, swaps: 0, creditPaid: 0, creditsBothSides: 0, reads: 0, splitShares: 0 };
  for (let i = 0; i < 300; i++) {
    const { st, stats } = runSequence(20261024 + i, 80);
    n.ok += stats.ok; n.refused += stats.refused;
    const done = Object.values(st.offers).filter((o) => o.status === 'completed');
    n.completed += done.length;
    n.swaps += done.filter((o) => o.kind === 'swap').length;
    n.creditPaid += done.filter((o) => o.payWith === 'credits').length;
    n.creditsBothSides += done.filter((o) => o.payWith === 'credits' && o.distributions[0].listenerCredits > 0).length;
    n.reads += Object.values(st.openPitches).reduce((x, p) => x + p.reads.length, 0);
    n.splitShares += done.reduce((x, o) => x + o.distributions.reduce((y, d) => y + d.contributorShares.filter((c) => c.sharedWith).length, 0), 0);
  }
  // The sequences must exercise the market, not bounce off refusals. Measured 2026-10-24 with these seeds (after the split
  // of contributor shares): 20,275 actions went through, 3,725 were refused, 1,314 pitches completed (300 swaps, 127 paid
  // in credits, 59 of those to a listener taking credits), 302 open-pitch reads, 794 contributor shares split between
  // inboxes. The floors sit 20% or more below, so a change that starves a path fails here.
  assert.ok(n.ok > 16000, 'actions that went through: ' + n.ok);
  assert.ok(n.refused > 2500, 'actions refused: ' + n.refused);
  assert.ok(n.completed > 1000, 'pitches completed: ' + n.completed);
  assert.ok(n.swaps > 200, 'swaps completed: ' + n.swaps);
  assert.ok(n.creditPaid > 100, 'credit-paid pitches completed: ' + n.creditPaid);
  assert.ok(n.creditsBothSides > 40, 'credit-paid pitches heard by a listener taking credits: ' + n.creditsBothSides);
  assert.ok(n.reads > 200, 'open-pitch reads: ' + n.reads);
  assert.ok(n.splitShares > 200, 'contributor shares split between inboxes: ' + n.splitShares);
});
