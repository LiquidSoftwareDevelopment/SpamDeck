'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { T, M, demoDeck } = require('./helpers.js');

const deck = demoDeck();
const byId = Object.fromEntries(deck.cards.map((c) => [c.id, c]));
const res = M.computeAll(deck.cards);

test('the flagship pair: Hirewire wants Ledgerly (hot) and Ledgerly wants Hirewire back', () => {
  const ab = M.scorePair(byId.hirewire, byId.ledgerly);
  const ba = M.scorePair(byId.ledgerly, byId.hirewire);
  assert.ok(ab.score >= M.THRESHOLDS.hot, 'hirewire->ledgerly ' + ab.score);
  assert.ok(ba.score >= M.THRESHOLDS.match, 'ledgerly->hirewire ' + ba.score);
  assert.ok(res.mutual.some((m) => (m.a === 'hirewire' && m.b === 'ledgerly') || (m.a === 'ledgerly' && m.b === 'hirewire')));
});

test('every point has a sentence: reasons add up to the score', () => {
  for (const p of Object.values(res.byKey)) {
    const sum = p.reasons.reduce((n, r) => n + r.points, 0);
    assert.equal(p.score, Math.max(0, Math.min(100, sum)), p.from + '>' + p.to);
    for (const r of p.reasons) assert.ok(r.text && r.you, 'reason needs text and a "you" phrasing: ' + JSON.stringify(r));
  }
});

test('a pitch to everyone is not a match with anyone in particular', () => {
  // Podly pitches "B2B founders": pitches any industry, weak role, generic situation. Below the bar.
  const p = M.scorePair(byId.podly, byId.brightpath);
  assert.ok(p.score < M.THRESHOLDS.match, 'podly->brightpath ' + p.score);
  assert.equal(res.byCompany.podly.mutual.length, 0);
});

test('binned cards are never matched', () => {
  assert.equal(res.live, 18);
  assert.ok(!res.byCompany['legal-chambers-intl']);
  assert.ok(!res.byCompany['saasweekly']);
  assert.ok(!Object.keys(res.byKey).some((k) => k.includes('saasweekly') || k.includes('legal-chambers')));
});

test('no company is matched with itself and wants/wantedBy are two views of the same pairs', () => {
  let wants = 0, wantedBy = 0;
  for (const [id, b] of Object.entries(res.byCompany)) {
    assert.ok(!b.wants.some((w) => w.id === id));
    wants += b.wants.length; wantedBy += b.wantedBy.length;
  }
  assert.equal(wants, res.pairs.length);
  assert.equal(wantedBy, res.pairs.length);
});

test('mutual means both directions clear the bar, and the list is sorted best first', () => {
  for (const m of res.mutual) {
    assert.ok(m.ab.score >= res.threshold && m.ba.score >= res.threshold);
    assert.equal(m.ab.from, m.a); assert.equal(m.ba.from, m.b);
  }
  for (let i = 1; i < res.mutual.length; i++) assert.ok(res.mutual[i - 1].score >= res.mutual[i].score);
  assert.ok(res.mutual.length >= 5 && res.mutual.length <= 30, 'mutual count ' + res.mutual.length);
});

test('cross-pool matching: Boomerang (Priya\'s inbox) and Chatterbox (your inbox) want each other', () => {
  const m = res.mutual.find((x) => [x.a, x.b].sort().join('+') === 'boomerangreturns+chatterbox');
  assert.ok(m, 'expected a mutual match');
  assert.ok(m.score >= M.THRESHOLDS.hot);
  assert.notEqual(byId.boomerangreturns.sources[0].contributorId, byId.chatterbox.sources[0].contributorId);
});

test('the viral loop: Vettd pitched Hirewire, Hirewire brought it in, and they match', () => {
  assert.equal(byId.vettd.sources[0].contributorId, 'hirewire');
  assert.ok(res.byCompany.hirewire.mutual.includes('vettd'));
});

test('rivals get a penalty and are flagged, never matched', () => {
  const a = T.normalizeCard({ company: { name: 'A', domain: 'a.example' }, sells: { category: 'bookkeeping-software', tags: ['books'] },
    profile: { industry: 'fintech', size: 40, hasOffice: true, teams: ['engineering', 'sales', 'support'], hiring: true },
    targets: { industries: ['fintech'], sizeBands: ['11-50'], roles: ['cto'], tags: ['hiring'] } });
  const b = T.normalizeCard({ company: { name: 'B', domain: 'b.example' }, sells: { category: 'bookkeeping-software', tags: ['books'] },
    profile: { industry: 'fintech', size: 40, hasOffice: true, teams: ['engineering', 'sales', 'support'], hiring: true },
    targets: { industries: ['fintech'], sizeBands: ['11-50'], roles: ['cto'], tags: ['hiring'] } });
  const p = M.scorePair(a, b);
  assert.equal(p.rival, true);
  assert.ok(p.reasons.some((r) => r.facet === 'rival' && r.points < 0));
  const r = M.computeAll([a, b]);
  assert.equal(r.pairs.length, 0);
  assert.deepEqual(r.byCompany.a.rivals, ['b']);
});

test('suggested listen price rises with company size', () => {
  assert.ok(M.suggestListenPrice(byId.podly) < M.suggestListenPrice(byId.ledgerly));
  assert.ok(M.suggestListenPrice(byId.ledgerly) < M.suggestListenPrice(byId.shipshape));
});

test('explain() names both companies and the score', () => {
  const s = M.explain(res.byKey['hirewire>ledgerly'], deck.cards);
  assert.match(s, /Hirewire wants to pitch Ledgerly \(\d+\/100\)/);
});
