'use strict';
// Odd and missing input to normalizeCard and the vocabulary helpers. Every case here crashed, produced NaN,
// or produced a card the rest of the engine misreads before the 2026-10-24 hardening.
const test = require('node:test');
const assert = require('node:assert/strict');
const { T } = require('./helpers.js');

test('uniq keeps words that happen to be names of built-in object properties', () => {
  // Was []: the seen-table was a plain object, so "constructor" and "toString" looked already seen.
  assert.deepEqual(T.uniq(['constructor', 'toString', '__proto__', 'a', 'a', null, undefined]), ['constructor', 'toString', '__proto__', 'a']);
});

test('normalizeCard survives a missing or empty reading', () => {
  for (const raw of [undefined, null, {}, { company: null, profile: null, targets: null, sells: null }]) {
    const c = T.normalizeCard(raw);
    assert.equal(c.company.name, 'Unknown company');
    assert.equal(c.profile.industry, 'other');
    assert.deepEqual(c.targets.industries, ['any']);
    assert.equal(c.sells.category, 'other');
    assert.equal(c.confidence, 0.5);
    assert.equal(T.isBinned(c), false);
  }
});

test('normalizeCard accepts a single word or a comma list where a list is expected (it used to throw)', () => {
  const c = T.normalizeCard({ company: { name: 'A' }, flags: 'scam',
    profile: { teams: 'engineering, Sales', tags: 'hiring' },
    targets: { industries: 'saas', sizeBands: '11-50', roles: 'cto', tags: 'startup' },
    sells: { tags: 'Books, ledgers' } });
  assert.deepEqual(c.profile.teams, ['engineering', 'sales']);
  assert.deepEqual(c.profile.tags, ['hiring']);
  assert.deepEqual(c.targets.industries, ['saas']);
  assert.deepEqual(c.targets.sizeBands, ['11-50']);
  assert.deepEqual(c.targets.roles, ['cto']);
  assert.deepEqual(c.targets.tags, ['startup']);
  assert.deepEqual(c.sells.tags, ['books', 'ledgers']);
  assert.deepEqual(c.flags, ['scam']);
  assert.ok(T.isBinned(c));
});

test('vocabulary words are matched without regard to case or stray spaces', () => {
  const c = T.normalizeCard({ company: { name: 'A' }, profile: { industry: ' SaaS ', teams: ['Engineering'], stage: 'Startup' },
    targets: { industries: ['FinTech', 'ANY'], roles: ['CTO', 'Office Manager'], tags: ['No-Finance-Team'] } });
  assert.equal(c.profile.industry, 'saas');
  assert.equal(c.profile.sector, 'software');
  assert.deepEqual(c.profile.teams, ['engineering']);
  assert.equal(c.profile.stage, 'startup');
  assert.deepEqual(c.targets.industries, ['fintech', 'any']);
  assert.deepEqual(c.targets.roles, ['cto', 'office manager']);
  assert.deepEqual(c.targets.tags, ['no-finance-team']);
  assert.equal(T.normalizeCard({ company: { name: 'A' }, profile: { stage: 'seed-ish' } }).profile.stage, 'growth', 'an unknown stage falls back to the default');
});

test('headcount: numbers in text, commas, and nonsense all become a whole positive number', () => {
  const size = (s) => T.normalizeCard({ company: { name: 'A' }, profile: { size: s } }).profile;
  assert.equal(size('40').size, 40);
  assert.equal(size(' 40 ').size, 40);
  assert.equal(size('40 people').size, 40, 'was 10');
  assert.equal(size('1,200').size, 1200, 'was 10');
  assert.equal(size('1,200').sizeBand, '1000+');
  assert.equal(size(12.7).size, 13, 'a headcount is a whole number');
  assert.equal(size(-5).size, 10, 'was -5');
  assert.equal(size(Infinity).size, 10, 'was Infinity, which JSON stores as null');
  assert.equal(size(0).size, 10);
  assert.equal(size(NaN).size, 10);
  assert.equal(size(null).size, 10);
});

test('confidence is always a number from 0 to 1', () => {
  const conf = (v) => T.normalizeCard({ company: { name: 'A' }, confidence: v }).confidence;
  assert.equal(conf('high'), 0.5, 'was NaN');
  assert.equal(conf(NaN), 0.5, 'was NaN');
  assert.equal(conf('0.7'), 0.7);
  assert.equal(conf(5), 1);
  assert.equal(conf(-1), 0);
  assert.equal(conf(undefined), 0.5);
});

test('a reading that says "not a pitch" is binned even when it gives no reason', () => {
  // Was live: the bin flag was only set when binReason was present, so a non-pitch went to market and got invited.
  const c = T.normalizeCard({ company: { name: 'A' }, isPitch: false, binReason: null });
  assert.ok(T.isBinned(c));
  assert.equal(c.binReason, 'other');
  assert.deepEqual(c.flags, ['other']);
  const s = T.normalizeCard({ company: { name: 'B' }, isPitch: false, binReason: 'scam' });
  assert.deepEqual(s.flags, ['scam']);
  assert.equal(s.binReason, 'scam');
});

test('true / false that arrive as words are read as words', () => {
  const c = T.normalizeCard({ company: { name: 'A' }, profile: { hiring: 'false', hasOffice: 'no' } });
  assert.equal(c.profile.hiring, false);
  assert.ok(!c.situations.includes('hiring'), 'was "is hiring" because the string "false" is truthy');
  assert.equal(c.profile.hasOffice, false);
  assert.ok(c.situations.includes('no-office'));
  const d = T.normalizeCard({ company: { name: 'A' }, profile: { hiring: 'yes', hasOffice: 'maybe' } });
  assert.equal(d.profile.hiring, true);
  assert.equal(d.profile.hasOffice, null);
});

test('product category: missing becomes "other", free text becomes kebab-case', () => {
  assert.equal(T.normalizeCard({ company: { name: 'A' }, sells: { category: null } }).sells.category, 'other', 'was null');
  assert.equal(T.normalizeCard({ company: { name: 'A' }, sells: { category: '' } }).sells.category, 'other');
  assert.equal(T.normalizeCard({ company: { name: 'A' }, sells: { category: 'Bookkeeping Software' } }).sells.category, 'bookkeeping-software');
  assert.equal(T.normalizeCard({ company: { name: 'A' }, sells: { category: 'bookkeeping-software' } }).sells.category, 'bookkeeping-software');
  assert.equal(T.normalizeCard({ company: { name: 'A' }, sells: { summary: null } }).sells.summary, '');
});

test('email domains: case, the last @, and a mixed-case address', () => {
  const c = T.normalizeCard({ company: { contact: { email: 'Mixed.Case@Example.COM' } } });
  assert.equal(c.company.domain, 'example.com');
  assert.equal(c.company.name, 'Example', 'a name made from the domain reads like a name');
  assert.equal(c.id, 'example-com');
  assert.equal(T.normalizeCard({ company: { contact: { email: 'odd@quoted@Acme.io' } } }).company.domain, 'acme.io', 'the domain is after the last @ (was "quoted")');
  assert.equal(T.normalizeCard({ company: { name: 'A', domain: ' https://www.Acme.io/about ' } }).company.domain, 'acme.io');
});

test('a sender on a subdomain is named and filed under the company, not the mail server', () => {
  const c = T.normalizeCard({ company: { contact: { email: 'jo@mail.bigcorp-sales.com' } } });
  assert.equal(c.company.domain, 'mail.bigcorp-sales.com', 'the domain itself is kept as sent');
  assert.equal(c.company.name, 'Bigcorp Sales', 'was "mail"');
  assert.equal(c.id, 'bigcorp-sales-com', 'same card as bigcorp-sales.com');
  assert.equal(T.normalizeCard({ company: { name: 'X', domain: 'bigcorp-sales.com' } }).id, 'bigcorp-sales-com');
  assert.equal(T.normalizeCard({ company: { name: 'X', domain: 'shop.acme.co.uk' } }).id, 'acme-co-uk');
  assert.equal(T.normalizeCard({ company: { name: 'X', domain: 'mail.ledgerly.example' } }).id, 'ledgerly', 'demo ids are unchanged');
  assert.equal(T.normalizeCard({ company: { name: 'X', domain: 'ledgerly.example' } }).id, 'ledgerly');
  assert.equal(T.companyDomain('a.b.c.example'), 'c.example');
  assert.equal(T.companyDomain('localhost'), 'localhost');
});

test('two companies writing from Gmail are two cards, not one card called "gmail"', () => {
  const a = T.normalizeCard({ company: { name: 'Acme Widgets', contact: { email: 'bob@gmail.com' } } });
  const b = T.normalizeCard({ company: { name: 'Zed Paints', contact: { email: 'zoe@Gmail.com' } } });
  assert.notEqual(a.id, b.id, 'both were "gmail-com", and mergeCards made them one company');
  assert.equal(a.id, 'acme-widgets');
  const nameless = T.normalizeCard({ company: { contact: { email: 'bob@gmail.com' } } });
  assert.equal(nameless.company.name, 'Unknown company', 'was "gmail"');
  assert.equal(nameless.id, 'bob-gmail-com', 'one person writing twice is still one card');
  assert.ok(T.isFreeMail('outlook.com') && T.isFreeMail('yahoo.co.uk') && T.isFreeMail('mail.com'));
  assert.ok(!T.isFreeMail('ledgerly.example') && !T.isFreeMail('mail.bigcorp-sales.com'));
});

test('a name that is only spaces counts as no name; names are trimmed', () => {
  assert.equal(T.normalizeCard({ company: { name: '   ', domain: 'acme-widgets.co' } }).company.name, 'Acme Widgets');
  assert.equal(T.normalizeCard({ company: { name: '  Ledgerly ', domain: 'ledgerly.example' } }).company.name, 'Ledgerly');
});

test('the demo readings normalise exactly as before (ids, names, categories)', () => {
  const { READINGS } = require('./helpers.js');
  const expected = { e01: 'ledgerly', e02: 'hirewire', e03: 'fortifylabs', e04: 'deskwell', e05: 'chatterbox', e06: 'meridianoutbound', e07: 'nordicbean',
    e08: 'greenpledge', e09: 'podly', e10: 'stacklinestudio', e11: 'brightpath', e12: 'vance-estates-legal', e13: 'saasweekly', p01: 'shipshape',
    p02: 'boomerangreturns', p03: 'pixelprose', p04: 'salestaxly', h01: 'vettd', h02: 'outreachly', h03: 'hiveandco' };
  for (const [k, id] of Object.entries(expected)) {
    const c = T.normalizeCard(READINGS[k]);
    assert.equal(c.id, id, k);
    assert.equal(c.company.name, READINGS[k].company.name, k);
    assert.equal(c.sells.category, READINGS[k].sells.category, k);
  }
});
