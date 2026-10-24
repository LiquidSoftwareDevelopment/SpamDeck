'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { T, READINGS } = require('./helpers.js');

test('size bands split at 10 / 50 / 200 / 1000', () => {
  assert.equal(T.bandOf(1), '1-10');
  assert.equal(T.bandOf(10), '1-10');
  assert.equal(T.bandOf(11), '11-50');
  assert.equal(T.bandOf(50), '11-50');
  assert.equal(T.bandOf(51), '51-200');
  assert.equal(T.bandOf(200), '51-200');
  assert.equal(T.bandOf(201), '201-1000');
  assert.equal(T.bandOf(1000), '201-1000');
  assert.equal(T.bandOf(1001), '1000+');
});

test('normalizeCard derives the situations a company is in', () => {
  const c = T.normalizeCard({
    company: { name: 'Shop Co', domain: 'shopco.example' },
    profile: { industry: 'ecommerce', size: 30, hasOffice: false, teams: ['sales', 'support'], hiring: true }
  });
  assert.equal(c.id, 'shopco');
  assert.equal(c.profile.sizeBand, '11-50');
  assert.equal(c.profile.sector, 'commerce');
  for (const s of ['sales-team', 'support-team', 'no-finance-team', 'no-office', 'remote', 'hiring', 'online-seller']) {
    assert.ok(c.situations.includes(s), 'expected ' + s + ' in ' + c.situations.join(','));
  }
  assert.ok(!c.situations.includes('has-office'));
});

test('normalizeCard drops words outside the controlled vocabulary instead of crashing', () => {
  const c = T.normalizeCard({
    company: { name: 'X', domain: 'x.example' },
    profile: { industry: 'quantum-ice-cream', teams: ['engineering', 'wizards'], tags: ['hiring', 'moonbase'] },
    targets: { industries: ['saas', 'nope'], sizeBands: ['11-50', 'huge'], roles: ['cto', 'king'], tags: ['hiring', 'rich'] }
  });
  assert.equal(c.profile.industry, 'other');
  assert.deepEqual(c.profile.teams, ['engineering']);
  assert.deepEqual(c.profile.tags, ['hiring']);
  assert.deepEqual(c.targets.industries, ['saas']);
  assert.deepEqual(c.targets.sizeBands, ['11-50']);
  assert.deepEqual(c.targets.roles, ['cto']);
  assert.deepEqual(c.targets.tags, ['hiring']);
});

test('a card with no industries targeted means "any"', () => {
  const c = T.normalizeCard({ company: { name: 'Y', domain: 'y.example' }, targets: { industries: [] } });
  assert.deepEqual(c.targets.industries, ['any']);
});

test('every hand-labelled demo reading uses only the controlled vocabulary', () => {
  for (const [id, r0] of Object.entries(READINGS)) {
    const r = r0.sameAs ? READINGS[r0.sameAs] : r0;
    if (r.isPitch === false) continue;
    assert.ok(T.INDUSTRIES.includes(r.profile.industry), id + ' profile.industry ' + r.profile.industry);
    for (const t of r.profile.teams) assert.ok(T.TEAMS.includes(t), id + ' team ' + t);
    for (const t of r.profile.tags) assert.ok(T.SITUATIONS.includes(t), id + ' profile tag ' + t);
    for (const i of r.targets.industries) assert.ok(i === 'any' || T.INDUSTRIES.includes(i), id + ' target industry ' + i);
    for (const b of r.targets.sizeBands) assert.ok(T.SIZE_BANDS.includes(b), id + ' band ' + b);
    for (const role of r.targets.roles) assert.ok(T.ROLES.includes(role), id + ' role ' + role);
    for (const t of r.targets.tags) assert.ok(T.SITUATIONS.includes(t), id + ' target tag ' + t);
    assert.ok(r.confidence > 0 && r.confidence <= 1, id + ' confidence');
    assert.ok(r.dealerNote && r.dealerNote.length < 220, id + ' dealer note length');
  }
});
