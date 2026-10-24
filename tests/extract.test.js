'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { X, EMAILS, READINGS, demoDeck } = require('./helpers.js');

test('fixture reader: 22 emails become 20 cards, 18 live, 2 binned, 2 repeat senders merged', () => {
  const d = demoDeck();
  assert.equal(d.read, 22);
  assert.equal(d.cards.length, 20);
  assert.equal(d.live.length, 18);
  assert.deepEqual(d.binned.map((c) => c.binReason).sort(), ['newsletter', 'scam']);
  assert.deepEqual(d.merged, ['hirewire', 'deskwell']);
  const deskwell = d.cards.find((c) => c.id === 'deskwell');
  assert.equal(deskwell.sources.length, 2);
  assert.deepEqual(deskwell.sources.map((s) => s.contributorId), ['you', 'priya']);
  assert.equal(d.errors.length, 0);
  assert.match(X.tally(d), /Read 22\. Dealt 18\. Binned 2 \(1 scam, 1 newsletter\)\. Merged 2 repeat senders/);
});

test('simple reader (offline): bins the scam and the newsletter, never a real pitch', () => {
  for (const e of EMAILS) {
    const f = X.readFixture(e, READINGS), h = X.heuristicRead(e);
    assert.equal(h.flags.length > 0, f.flags.length > 0, e.id);
    assert.equal(h.readBy, 'heuristic');
  }
});

test('simple reader (offline): measured accuracy against the hand labels does not regress', () => {
  // Measured 2026-10-24 on the 22 demo emails: company name 22/22, product category 22/22.
  let names = 0, cats = 0;
  for (const e of EMAILS) {
    const f = X.readFixture(e, READINGS), h = X.heuristicRead(e);
    if (f.company.name.toLowerCase().startsWith(h.company.name.toLowerCase())) names++;
    if (f.sells.category === h.sells.category) cats++;
  }
  assert.ok(names >= 20, 'company names right: ' + names + '/22');
  assert.ok(cats >= 20, 'product categories right: ' + cats + '/22');
});

test('simple reader never claims to be sure', () => {
  for (const e of EMAILS) assert.ok(X.heuristicRead(e).confidence <= 0.8, e.id);
});

test('simple reader reads size ranges into bands', () => {
  const ledgerly = X.heuristicRead(EMAILS.find((e) => e.id === 'e01'));
  assert.deepEqual(ledgerly.targets.sizeBands, ['11-50', '51-200']);
  const nordic = X.heuristicRead(EMAILS.find((e) => e.id === 'e07'));
  assert.deepEqual(nordic.targets.sizeBands, ['11-50', '51-200', '201-1000', '1000+']);
  const hive = X.heuristicRead(EMAILS.find((e) => e.id === 'h03'));
  assert.deepEqual(hive.targets.sizeBands, ['1-10', '11-50']);
});

test('the live request never carries a key, asks for strict JSON, and defaults to Opus', () => {
  const req = X.buildRequest(EMAILS[0]);
  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.ok(!('x-api-key' in req.headers));
  assert.equal(req.headers['anthropic-version'], '2026-10-21');
  assert.equal(req.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(req.body.model, 'claude-opus-5-5');
  assert.equal(req.body.output_config.format.type, 'json_schema');
  assert.equal(req.body.output_config.format.schema.additionalProperties, false);
  assert.equal(req.body.fallbacks, 'default');
  assert.match(req.body.system, /Never invent facts/);
  assert.match(req.body.messages[0].content, /Quick question about your books/);
  const haiku = X.buildRequest(EMAILS[0], { model: 'claude-haiku-5-5' });
  assert.ok(!('fallbacks' in haiku.body));
  assert.ok(!('anthropic-beta' in haiku.headers));
});

test('parseReading turns the API JSON into a card and refuses to invent one on a refusal', () => {
  const email = EMAILS[0];
  const good = { model: 'claude-opus-5-5', stop_reason: 'end_turn', usage: { input_tokens: 900, output_tokens: 300 },
    content: [{ type: 'text', text: JSON.stringify({ isPitch: true, binReason: null,
      company: { name: 'Ledgerly', domain: 'ledgerly.example', contact: { name: 'Dana Whitfield', title: 'Head of Growth', email: 'dana@ledgerly.example' } },
      sells: { summary: 'Bookkeeping automation', category: 'bookkeeping-software', tags: ['bookkeeping'] },
      profile: { industry: 'fintech', size: 40, hasOffice: true, teams: ['engineering'], hiring: true, stage: 'startup', tags: [] },
      targets: { summary: 'Small companies', industries: ['any'], sizeBands: ['11-50'], roles: ['founder'], tags: ['no-finance-team'] },
      confidence: 0.9, dealerNote: 'Fine.' }) }] };
  const card = X.parseReading(good, email);
  assert.equal(card.id, 'ledgerly');
  assert.equal(card.readBy, 'claude:claude-opus-5-5');
  assert.deepEqual(card.usage, { input: 900, output: 300 });
  assert.equal(card.sources[0].emailId, 'e01');
  assert.throws(() => X.parseReading({ stop_reason: 'refusal', stop_details: { category: 'general_harms' }, content: [] }, email), /declined to read/);
  assert.throws(() => X.parseReading({ type: 'error', error: { message: 'invalid x-api-key' } }, email), /API error: invalid x-api-key/);
  assert.throws(() => X.parseReading({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] }, email), /not JSON/);
});

test('mergeCards keeps the more confident reading but all the sources', () => {
  const T = require('./helpers.js').T;
  const a = T.normalizeCard({ company: { name: 'Same Co', domain: 'same.example' }, confidence: 0.4 }, { emailId: 'x1', contributorId: 'you' });
  const b = T.normalizeCard({ company: { name: 'Same Co', domain: 'same.example' }, confidence: 0.9, dealerNote: 'better' }, { emailId: 'x2', contributorId: 'priya' });
  const m = X.mergeCards([a, b]);
  assert.equal(m.cards.length, 1);
  assert.equal(m.cards[0].dealerNote, 'better');
  assert.deepEqual(m.cards[0].sources.map((s) => s.emailId), ['x1', 'x2']);
  assert.deepEqual(m.merged, ['same']);
});
