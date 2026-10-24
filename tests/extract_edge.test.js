'use strict';
// Dedupe, fixture lookup, dealing, and the live request's schema.
const test = require('node:test');
const assert = require('node:assert/strict');
const { T, X, EMAILS, READINGS } = require('./helpers.js');

const card = (conf, emailId, contributorId, extra) => T.normalizeCard(Object.assign({ company: { name: 'Same Co', domain: 'same.example' }, confidence: conf }, extra || {}), { emailId, contributorId });

test('mergeCards does not change the cards it is given (merging twice used to repeat sources)', () => {
  const a = card(0.4, 'x1', 'you'), b = card(0.9, 'x2', 'priya');
  const before = JSON.stringify([a, b]);
  const m1 = X.mergeCards([a, b]);
  const m2 = X.mergeCards([a, b]);
  assert.equal(JSON.stringify([a, b]), before, 'the input cards were mutated');
  assert.deepEqual(m1, m2);
  assert.deepEqual(m2.cards[0].sources.map((s) => s.emailId), ['x1', 'x2'], 'was x1, x2, x2 on the second call');
});

test('mergeCards: the same email read twice is one source, and is not a "repeat sender"', () => {
  const a = card(0.4, 'x1', 'you'), again = card(0.6, 'x1', 'you');
  const m = X.mergeCards([a, again]);
  assert.equal(m.cards.length, 1);
  assert.deepEqual(m.cards[0].sources.map((s) => s.emailId), ['x1']);
  assert.equal(m.cards[0].confidence, 0.6, 'the better reading still wins');
  assert.deepEqual(m.merged, []);
});

test('mergeCards: ties keep the first reading; three readings keep every source in order', () => {
  const m = X.mergeCards([card(0.5, 'x1', 'you', { dealerNote: 'first' }), card(0.5, 'x2', 'priya', { dealerNote: 'second' }), card(0.7, 'x3', 'hirewire', { dealerNote: 'third' })]);
  assert.equal(m.cards[0].dealerNote, 'third');
  assert.deepEqual(m.cards[0].sources.map((s) => s.emailId), ['x1', 'x2', 'x3']);
  const t = X.mergeCards([card(0.5, 'x1', 'you', { dealerNote: 'first' }), card(0.5, 'x2', 'priya', { dealerNote: 'second' })]);
  assert.equal(t.cards[0].dealerNote, 'first');
  assert.deepEqual(t.merged, ['same']);
});

test('mergeCards skips empty entries and cards without a source list', () => {
  const bare = { id: 'bare', company: { name: 'Bare' }, confidence: 0.5 };
  const m = X.mergeCards([null, card(0.4, 'x1', 'you'), undefined, bare, Object.assign({}, bare, { confidence: 0.9 })]);
  assert.deepEqual(m.cards.map((c) => c.id), ['same', 'bare']);
  assert.deepEqual(m.cards[1].sources, [], 'was [undefined]');
  assert.equal(m.cards[1].confidence, 0.9);
  assert.deepEqual(X.mergeCards(null), { cards: [], merged: [] });
});

test('readFixture returns null for a missing or circular "sameAs" instead of throwing', () => {
  const readings = { a: { sameAs: 'missing' }, b: { sameAs: 'c' }, c: { sameAs: 'b' }, d: { sameAs: 'e' }, e: { sameAs: 'f' }, f: READINGS.e01 };
  const email = (id) => ({ id, contributorId: 'you', from: { name: 'x', email: 'x@y.example' }, subject: '', body: '' });
  assert.equal(X.readFixture(email('a'), readings), null, 'was a JSON SyntaxError');
  assert.equal(X.readFixture(email('b'), readings), null);
  assert.equal(X.readFixture(email('d'), readings).id, 'ledgerly', 'a chain of two is followed');
  assert.equal(X.readFixture(email('zzz'), readings), null);
});

test('dealEmails records an empty slot as an error instead of crashing', () => {
  const d = X.dealEmails([EMAILS[0], null, EMAILS[1]], (e) => X.readFixture(e, READINGS));
  assert.equal(d.cards.length, 2);
  assert.equal(d.errors.length, 1);
  assert.equal(d.read, 3);
});

test('the live reader\'s JSON schema uses only features structured outputs accepts', () => {
  // Structured outputs reject numerical and string-length constraints with a 400; the SDK helpers strip them, but the app
  // sends this schema with fetch, unstripped. Every object must say additionalProperties: false; optional fields are capped.
  const banned = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minLength', 'maxLength', 'pattern', 'maxItems', 'uniqueItems', 'oneOf', 'not', 'if', 'then', 'else'];
  let unions = 0, optional = 0;
  (function walk(node, path) {
    if (!node || typeof node !== 'object') return;
    for (const k of banned) assert.ok(!(k in node), path + ' uses "' + k + '"');
    if (Array.isArray(node.type)) unions++;
    if (node.enum) for (const v of node.enum) assert.ok(v === null || ['string', 'number', 'boolean'].includes(typeof v), path + ' enum value');
    if (node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'))) {
      assert.equal(node.additionalProperties, false, path + ' additionalProperties');
      const keys = Object.keys(node.properties || {});
      optional += keys.filter((k) => !(node.required || []).includes(k)).length;
      for (const k of keys) walk(node.properties[k], path + '.' + k);
    }
    if (node.items) walk(node.items, path + '[]');
  })(X.SCHEMA, 'SCHEMA');
  assert.ok(unions <= 16, unions + ' union-typed fields');
  assert.ok(optional <= 24, optional + ' optional fields');
  assert.match(X.SCHEMA.properties.confidence.description || '', /0.*1/, 'the 0..1 range moved into the description');
});

test('everything the schema lets Claude say, normalizeCard keeps', () => {
  // A reading that uses every enum value at once survives normalisation unchanged.
  const S = X.SCHEMA.properties;
  const raw = { isPitch: true, binReason: null,
    company: { name: 'Every Co', domain: 'every.example', contact: { name: 'A B', title: 'CEO', email: 'a@every.example' } },
    sells: { summary: 'Everything', category: 'everything-software', tags: ['x'] },
    profile: { industry: 'healthcare', size: 12, hasOffice: null, teams: S.profile.properties.teams.items.enum.slice(), hiring: true, stage: 'established', tags: S.profile.properties.tags.items.enum.slice() },
    targets: { summary: 's', industries: S.targets.properties.industries.items.enum.slice(), sizeBands: S.targets.properties.sizeBands.items.enum.slice(), roles: S.targets.properties.roles.items.enum.slice(), tags: S.targets.properties.tags.items.enum.slice() },
    confidence: 0.75, dealerNote: 'n' };
  const c = T.normalizeCard(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(c.profile.teams, raw.profile.teams);
  assert.deepEqual(c.profile.tags, raw.profile.tags);
  assert.deepEqual(c.targets.industries, raw.targets.industries);
  assert.deepEqual(c.targets.sizeBands, raw.targets.sizeBands);
  assert.deepEqual(c.targets.roles, raw.targets.roles);
  assert.deepEqual(c.targets.tags, raw.targets.tags);
  assert.equal(c.profile.industry, 'healthcare');
  assert.equal(c.profile.stage, 'established');
  assert.deepEqual(S.binReason.enum.filter(Boolean).sort(), ['newsletter', 'other', 'personal', 'scam']);
  for (const r of ['scam', 'newsletter', 'personal', 'other']) assert.ok(T.isBinned(T.normalizeCard({ isPitch: false, binReason: r, company: { name: 'n' } })), r);
});

test('parseReading refuses JSON that is not a card object, in plain English', () => {
  const email = EMAILS[0];
  for (const text of ['42', 'null', '[1,2]', '"a card"']) {
    assert.throws(() => X.parseReading({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }, email), /not a card/, text);
  }
  assert.throws(() => X.parseReading({ stop_reason: 'end_turn', content: 'oops' }, email), /not JSON|not a card/);
});

test('the prompt never says "undefined" for a sender without a name', () => {
  const p = X.userPromptFor({ id: 'z', from: { email: 'jo@acme.io' }, subject: 'Hi', body: 'Body' });
  assert.ok(!/undefined/.test(p), p);
  assert.match(p, /From: <jo@acme\.io>/);
  assert.match(X.userPromptFor(EMAILS[0]), /From: Dana Whitfield <dana@ledgerly\.example>/, 'unchanged for a named sender');
});

test('normalizeCard is stable: normalising a card again changes nothing', () => {
  const { demoDeck } = require('./helpers.js');
  const cards = demoDeck().cards.concat(EMAILS.map((e) => X.heuristicRead(e)));
  for (const c of cards) {
    const again = T.normalizeCard(JSON.parse(JSON.stringify(c)));
    assert.deepEqual(again, c, c.id);
  }
});
