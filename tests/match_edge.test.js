'use strict';
// Matching must be deterministic (same deck in any order gives the same answer) and must not invent rivals.
const test = require('node:test');
const assert = require('node:assert/strict');
const { T, M, demoDeck } = require('./helpers.js');

function card(id, cat, extra) {
  return T.normalizeCard(Object.assign({ company: { name: id, domain: id + '.example' }, sells: { category: cat, tags: [] },
    profile: { industry: 'saas', size: 30, hasOffice: true, teams: ['engineering', 'finance'], hiring: true },
    targets: { industries: ['saas'], sizeBands: ['11-50'], roles: ['cto'], tags: ['hiring'] } }, extra || {}));
}

test('two companies whose product is unknown ("other") are not rivals', () => {
  // Was rival: "other" === "other" cost 40 points, so two unrelated pitches the simple reader could not classify never matched.
  const p = M.scorePair(card('a', 'other'), card('b', 'other'));
  assert.equal(p.rival, false);
  assert.ok(!p.reasons.some((r) => r.facet === 'rival'));
  assert.ok(p.score >= M.THRESHOLDS.match, 'score ' + p.score);
  const g = M.scorePair(card('a', 'software'), card('b', 'software'));
  assert.equal(g.rival, false, 'the generic "software" fallback is not a product either');
  const r = M.scorePair(card('a', 'bookkeeping-software'), card('b', 'bookkeeping-software'));
  assert.equal(r.rival, true, 'a real shared category is still a rival');
});

test('computeAll twice on the same deck gives identical output', () => {
  const deck = demoDeck().cards;
  assert.deepEqual(M.computeAll(deck), M.computeAll(deck));
});

test('the deck order does not change any answer, including the order of ties', () => {
  const deck = demoDeck().cards;
  const a = M.computeAll(deck);
  for (const shuffled of [deck.slice().reverse(), deck.slice(7).concat(deck.slice(0, 7))]) {
    const b = M.computeAll(shuffled);
    assert.deepEqual(b.pairs.map((p) => p.from + '>' + p.to + ':' + p.score), a.pairs.map((p) => p.from + '>' + p.to + ':' + p.score));
    assert.deepEqual(b.mutual.map((m) => m.a + '+' + m.b + ':' + m.score), a.mutual.map((m) => m.a + '+' + m.b + ':' + m.score));
    for (const id of Object.keys(a.byCompany)) assert.deepEqual(b.byCompany[id], a.byCompany[id], id);
    assert.deepEqual(Object.keys(b.byKey).sort(), Object.keys(a.byKey).sort());
    for (const k of Object.keys(a.byKey)) assert.deepEqual(b.byKey[k], a.byKey[k], k);
  }
});

test('ties are broken by id, the same way in every browser (no locale-dependent comparison)', () => {
  const res = M.computeAll(demoDeck().cards);
  for (let i = 1; i < res.pairs.length; i++) {
    const x = res.pairs[i - 1], y = res.pairs[i];
    assert.ok(x.score > y.score || (x.score === y.score && (x.from < y.from || (x.from === y.from && x.to < y.to))), x.from + '>' + x.to + ' before ' + y.from + '>' + y.to);
  }
  for (const b of Object.values(res.byCompany)) {
    for (let i = 1; i < b.wants.length; i++) assert.ok(b.wants[i - 1].score > b.wants[i].score || (b.wants[i - 1].score === b.wants[i].score && b.wants[i - 1].id < b.wants[i].id));
    assert.deepEqual(b.rivals, b.rivals.slice().sort());
  }
});

test('a card listed twice is one company: no self-match, no self-rival, no double counting', () => {
  const a = card('a', 'bookkeeping-software'), b = card('b', 'support-software');
  const r = M.computeAll([a, a, b]);
  assert.equal(r.live, 2);
  assert.ok(!r.byKey['a>a'], 'was scored against itself');
  assert.deepEqual(r.byCompany.a.rivals, [], 'was its own rival');
  assert.equal(r.pairs.filter((p) => p.from === 'a' && p.to === 'b').length, r.byKey['a>b'].score >= r.threshold ? 1 : 0);
  assert.ok(r.byCompany.b.wantedBy.length <= 1);
});

test('the demo deck still matches exactly as tuned (scores are unchanged by the hardening)', () => {
  // Measured 2026-10-24 on the engine before the hardening: 113 pairs over the bar, 21 mutual.
  const res = M.computeAll(demoDeck().cards);
  assert.equal(res.pairs.length, 113);
  assert.equal(res.mutual.length, 21);
  assert.equal(M.pairScore(res, 'hirewire', 'ledgerly'), 80);
  assert.equal(M.pairScore(res, 'ledgerly', 'hirewire'), 55);
  assert.equal(M.pairScore(res, 'boomerangreturns', 'chatterbox'), 80);
  assert.equal(M.pairScore(res, 'podly', 'brightpath'), 35);
});

test('role labels read as proper plurals in match reasons ("CTOs", not "ctos")', () => {
  const res = M.computeAll(demoDeck().cards);
  const r = res.byKey['hirewire>ledgerly'].reasons.find((x) => x.facet === 'role');
  assert.equal(r.text, 'pitches to CTOs and Ledgerly has an engineering team');
  for (const p of Object.values(res.byKey)) {
    // The old engine wrote these: role + 's' unless the role already ended in s.
    for (const x of p.reasons) assert.ok(!/pitches to (ctos|cfos|ceos|hrs|engineerings|recruitings|marketings|supports|finances|ops and|sales and)\b/.test(x.text), x.text);
  }
  for (const role of T.ROLES) assert.ok(T.ROLE_PLURAL[role], 'plural for ' + role);
  assert.equal(T.ROLE_PLURAL.hr, 'HR');
  assert.equal(T.ROLE_PLURAL.ops, 'ops leads');
});
