'use strict';
// The offline simple reader on awkward real-world shapes (tests/fixtures/extra_spam.js) and on free-mail senders.
const test = require('node:test');
const assert = require('node:assert/strict');
const { X, EMAILS, READINGS } = require('./helpers.js');
const extra = require('./fixtures/extra_spam.js');

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// A name is right when it equals the label, or is the label's first word(s) ("Chatterbox" for "Chatterbox AI").
const nameRight = (label, got) => norm(got) === norm(label) || (norm(got).length > 0 && norm(label).startsWith(norm(got) + ' '));
const byId = (id) => extra.EMAILS.find((e) => e.id === id);

test('a free-mail pitch that never names its company is "Unknown company (<local part>)", unsure, filed per address', () => {
  const e1 = { id: 'g1', contributorId: 'you', receivedAt: '2026-10-24', from: { name: 'Jo Bloggs', email: 'jo.bloggs@gmail.com' }, subject: 'Quick idea', body: 'Hi Michael,\n\nWe build Shopify themes for small brands. Want to see a few?\n\nJo' };
  const e2 = { id: 'g2', contributorId: 'you', receivedAt: '2026-10-24', from: { name: 'Sam Lee', email: 'sam.lee@outlook.com' }, subject: 'Quick idea', body: 'Hi Michael,\n\nWe build Shopify themes for small brands. Want to see a few?\n\nSam' };
  const c1 = X.heuristicRead(e1), c2 = X.heuristicRead(e2);
  assert.equal(c1.company.name, 'Unknown company (jo.bloggs)', 'was "Gmail"');
  assert.equal(c2.company.name, 'Unknown company (sam.lee)', 'was "Outlook"');
  assert.ok(c1.confidence <= 0.3, 'low confidence: ' + c1.confidence);
  assert.equal(c1.id, 'jo-bloggs-gmail-com');
  assert.notEqual(c1.id, c2.id);
  const same = X.heuristicRead(Object.assign({}, e1, { id: 'g3', from: { name: 'Jo', email: 'jo.bloggs@yahoo.com' } }));
  assert.notEqual(same.id, c1.id, 'unique per address, not per local part');
  const d = X.dealEmails([e1, e2], X.heuristicRead);
  assert.equal(d.cards.length, 2, 'two free-mail senders never merge into one card');
  assert.deepEqual(d.merged, []);
});

test('a free-mail sender who signs with a company is named after it, never after the mail provider', () => {
  const e = { id: 'g4', contributorId: 'you', receivedAt: '2026-10-24', from: { name: 'Jo Bloggs', email: 'jo.bloggs@gmail.com' }, subject: 'Shopify themes',
    body: 'Hi Michael,\n\nWe build Shopify themes for small brands. Want to see a few?\n\nBest,\nJo Bloggs\nFounder, Bloggs Design' };
  const c = X.heuristicRead(e);
  assert.equal(c.company.name, 'Bloggs Design');
  for (const provider of ['gmail', 'outlook', 'yahoo', 'hotmail', 'icloud']) {
    const card = X.heuristicRead(Object.assign({}, e, { body: 'We build Shopify themes.', from: { name: 'A B', email: 'a.b@' + provider + '.com' } }));
    assert.ok(!new RegExp(provider, 'i').test(card.company.name), card.company.name);
  }
});

test('CloudCost: the summary is the CloudCost sentence, not the subject line', () => {
  const c = X.heuristicRead(byId('x11'));
  assert.equal(c.company.name, 'CloudCost');
  assert.equal(c.sells.summary, 'CloudCost finds the waste in your AWS bill and turns it off');
  assert.deepEqual(c.targets.sizeBands, ['11-50', '51-200', '201-1000']);
  assert.deepEqual(c.targets.industries, ['saas']);
});

test('the summary prefers the sentence that names the company, and never a quoted header or a greeting', () => {
  for (const e of extra.EMAILS) {
    const c = X.heuristicRead(e);
    assert.notEqual(c.sells.summary, e.subject, e.id + ' fell back to the subject');
    assert.ok(!/^(>|on .* wrote|from:|hi |hello |hey )/i.test(c.sells.summary), e.id + ': ' + c.sells.summary);
    assert.ok(!/&nbsp;|<\/?p>|<br>/.test(c.sells.summary), e.id + ' kept HTML: ' + c.sells.summary);
  }
  assert.match(X.heuristicRead(byId('x05')).sells.summary, /^Redline Security runs penetration tests/);
});

test('the simple reader never bins a real pitch in the new set (USD prices and marketing footers included)', () => {
  for (const e of extra.EMAILS) assert.equal(X.heuristicRead(e).flags.length === 0, extra.LABELS[e.id].isPitch, e.id);
});

function score(emails, labels) {
  let names = 0, cats = 0, bins = 0, pitches = 0;
  for (const e of emails) {
    const L = labels[e.id], h = X.heuristicRead(e);
    if ((h.flags.length === 0) === L.isPitch) bins++;
    if (!L.isPitch) continue;
    pitches++;
    if (nameRight(L.name, h.company.name)) names++;
    if (h.sells.category === L.category) cats++;
  }
  return { names, cats, bins, pitches, emails: emails.length };
}

test('simple reader on the eleven awkward pitches: measured accuracy does not regress', () => {
  // Measured 2026-10-24. Original reader: names 6/11, categories 7/11, bin decisions 9/11, summary from the body 6/11.
  // After the hardening: names 11/11, categories 10/11 (CloudCost reads "other"; its label is "software"), bin decisions
  // 11/11, summary from the body 11/11. These eleven were used to design the fixes, so this is an in-sample number.
  const s = score(extra.EMAILS, extra.LABELS);
  assert.ok(s.names >= 11, 'names ' + s.names + '/11');
  assert.ok(s.cats >= 10, 'categories ' + s.cats + '/11');
  assert.ok(s.bins >= 11, 'bin decisions ' + s.bins + '/11');
});

test('simple reader on six held-out emails (not tuned on): measured accuracy does not regress', () => {
  // Measured once, 2026-10-24, after the tuning: names 5/5, categories 3/5, bin decisions 5/6. The original reader scored
  // exactly the same on these six. Misses: Helio reads bookkeeping ("accounting" comes before "carbon" and the first rule
  // in list order wins), Northstar's "first cheques" is no investor cue, and a friend's lunch note is not binned (the
  // simple reader has no test for personal mail).
  const s = score(extra.HELDOUT, extra.HELDOUT_LABELS);
  assert.ok(s.names >= 5, 'names ' + s.names + '/' + s.pitches);
  assert.ok(s.cats >= 3, 'categories ' + s.cats + '/' + s.pitches);
  assert.ok(s.bins >= 5, 'bin decisions ' + s.bins + '/' + s.emails);
});

test('simple reader on the 22 demo emails: still every name and every category', () => {
  // Measured 2026-10-24 before and after the hardening: 22/22 and 22/22 (the older test only asks for 20).
  let names = 0, cats = 0;
  for (const e of EMAILS) {
    const f = X.readFixture(e, READINGS), h = X.heuristicRead(e);
    if (f.company.name.toLowerCase().startsWith(h.company.name.toLowerCase())) names++;
    if (f.sells.category === h.sells.category) cats++;
  }
  assert.equal(names, 22);
  assert.equal(cats, 22);
});

test('a self-introduction stops at the end of the sentence ("I’m with Corvid Labs. We build…" is Corvid Labs)', () => {
  const read = (body) => X.heuristicRead({ id: 'q', contributorId: 'you', from: { name: 'A B', email: 'a.b@gmail.com' }, subject: 'Hello', body }).company.name;
  assert.equal(read('Hi, I’m with Corvid Labs. We build data pipelines.'), 'Corvid Labs', 'was "Corvid Labs. We"');
  assert.equal(read("Hi, I'm the founder of Ferngrove. We help clinics book patients."), 'Ferngrove');
  assert.equal(read('i run Patel Digital, a 4-person dev studio.'), 'Patel Digital');
});
