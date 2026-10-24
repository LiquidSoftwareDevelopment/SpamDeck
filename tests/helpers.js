'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const T = require(path.join(root, 'js/engine/taxonomy.js'));
const M = require(path.join(root, 'js/engine/match.js'));
const K = require(path.join(root, 'js/engine/market.js'));
const X = require(path.join(root, 'js/engine/extract.js'));
const { EMAILS, CONTRIBUTORS } = require(path.join(root, 'js/data/demo_inbox.js'));
const { READINGS } = require(path.join(root, 'js/data/demo_cards.js'));

function demoDeck() { return X.dealEmails(EMAILS, (e) => X.readFixture(e, READINGS)); }

function demoMarket(opts) {
  const st = K.createState(Object.assign({ fixedNow: '2026-10-24T12:00:00.000Z' }, opts || {}));
  K.addContributors(st, CONTRIBUTORS);
  K.addCards(st, demoDeck().cards);
  return st;
}

// Cash must be conserved: every dollar a company pays shows up somewhere (escrow, listener, contributor, platform).
function cashSum(st) { return st.ledger.filter((e) => !e.credits).reduce((n, e) => n + e.amountCents, 0); }
function creditSum(st) { return st.ledger.filter((e) => e.credits).reduce((n, e) => n + e.amountCents, 0); }

module.exports = { T, M, K, X, EMAILS, CONTRIBUTORS, READINGS, demoDeck, demoMarket, cashSum, creditSum };
