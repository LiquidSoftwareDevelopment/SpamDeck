/* SpamDeck — the marketplace: consent, offers, simulated payment, introductions, credits and the ledger.
   All money is integer cents. All payments are SIMULATED (no payment provider is wired in; see docs/WHAT_IS_REAL.md).
   Every function mutates the state it is given and returns something useful. Validation errors are thrown as plain
   English so the UI can show them. Browser: window.SpamDeck.market · Node: require('./market.js') */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./taxonomy.js'), require('./match.js'));
  } else {
    root.SpamDeck = root.SpamDeck || {};
    root.SpamDeck.market = factory(root.SpamDeck.taxonomy, root.SpamDeck.match);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, M) {
  'use strict';

  var DEFAULT_CONFIG = {
    // Who gets what when a pitch is paid for and heard. Basis points; must sum to 10,000.
    splitsBp: { listener: 5000, listenerContributor: 2000, pitcherContributor: 1000, platform: 2000 },
    creditBonusBp: 2500,        // a listener who takes credits instead of cash gets 25% more
    meetingMultiplier: 2,       // a live meeting costs twice the listen (read) price
    cardTtlDays: 30,            // an invited company that never answers is deleted after this
    responseDays: 7,            // a paid pitch must be answered within this
    matchThreshold: M.THRESHOLDS.match
  };

  var KINDS = {
    read: { label: 'Read', blurb: 'The listener reads a written one-page pitch and must answer interested, not now, or no within 7 days.' },
    meeting: { label: 'Meeting', blurb: 'A 20-minute video call. The pitcher pitches; the listener listens and answers.' },
    swap: { label: 'Swap', blurb: 'A 30-minute call where both sides pitch each other. Each pays the other’s meeting price and the ledger records both legs.' }
  };

  // The largest amount the market accepts, in cents. Every amount is multiplied by at most 20,000 on its way through
  // (a share in basis points, up to 10,000; a credit bonus of up to 10,000 basis points on top of 10,000), and the
  // result must stay a whole number that JavaScript holds exactly (Number.MAX_SAFE_INTEGER). About $4.5 billion.
  var MAX_CENTS = Math.floor(Number.MAX_SAFE_INTEGER / 20000);

  // A whole number of cents from a number or a numeric string; NaN for anything else (Infinity, '', null, true, '12abc').
  function toCents(v) {
    if (typeof v === 'string') v = v.trim() === '' ? NaN : Number(v);
    if (typeof v !== 'number' || !isFinite(v)) return NaN;
    return Math.round(v);
  }
  function tooMuch() { return new Error('That is more than SpamDeck can keep exact to the cent (the most is ' + money(MAX_CENTS) + ').'); }
  function isWholeCents(n) { return typeof n === 'number' && Number.isSafeInteger(n); }

  function money(cents) {
    var n = Math.round(Number(cents) || 0);
    var sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    var d = Math.floor(n / 100), c = n % 100;
    return sign + '$' + d.toLocaleString('en-US') + '.' + (c < 10 ? '0' : '') + c;
  }

  var SHARES = ['listener', 'listenerContributor', 'pitcherContributor', 'platform'];

  // Each share is a whole number of basis points; a missing share counts as 0. (The old check used `| 0`, which turned
  // 'fifty' and NaN into 0, cut 5000.9 to 5000, and wrapped 2^32 + 5000 round to 5000, so all of those passed.)
  function validateSplits(s) {
    s = s || {};
    var v = {};
    SHARES.forEach(function (k) {
      v[k] = s[k] == null ? 0 : Number(s[k]);
      if (!Number.isSafeInteger(v[k])) throw new Error('Each share must be a whole number of basis points (100 basis points = 1%).');
    });
    var sum = v.listener + v.listenerContributor + v.pitcherContributor + v.platform;
    if (sum !== 10000) throw new Error('The four shares must add up to 100% (they add up to ' + (sum / 100) + '%).');
    SHARES.forEach(function (k) {
      if (v[k] < 0) throw new Error('A share cannot be negative.');
    });
    return true;
  }

  function validateConfig(c) {
    var m = Number(c.meetingMultiplier);
    if (typeof c.meetingMultiplier !== 'number' || !isFinite(m) || m <= 0) throw new Error('A meeting must cost a positive multiple of the read price.');
    if (!Number.isSafeInteger(c.creditBonusBp) || c.creditBonusBp < 0 || c.creditBonusBp > 10000) throw new Error('The credit bonus must be a whole number of basis points from 0 to 10,000.');
    if (typeof c.matchThreshold !== 'number' || !(c.matchThreshold >= 0 && c.matchThreshold <= 100)) throw new Error('The match threshold must be a number from 0 to 100.');
    ['cardTtlDays', 'responseDays'].forEach(function (k) {
      if (typeof c[k] !== 'number' || !(c[k] > 0) || !isFinite(c[k])) throw new Error('A number of days must be above zero.');
    });
    validateSplits(c.splitsBp);
    return true;
  }

  function createState(opts) {
    opts = opts || {};
    var config = Object.assign({}, DEFAULT_CONFIG, opts.config || {});
    config.splitsBp = Object.assign({}, DEFAULT_CONFIG.splitsBp, (opts.config && opts.config.splitsBp) || {});
    validateConfig(config);
    return {
      version: 1,
      config: config,
      fixedNow: opts.fixedNow || null,
      seq: 0,
      contributors: {},
      cards: {},        // the deck: id -> card (normalised)
      companies: {},    // id -> market record for a live card
      offers: {},
      openPitches: {},
      ledger: [],
      outbox: [],
      log: [],
      matches: null
    };
  }

  function now(state) { return state.fixedNow || new Date().toISOString(); }
  function nextId(state, prefix) { state.seq += 1; return prefix + '-' + String(state.seq).padStart(3, '0'); }
  function say(state, text) { state.log.push({ at: now(state), text: text }); return text; }

  function addContributors(state, list) {
    (list || []).forEach(function (c) { state.contributors[c.id] = Object.assign({}, c); });
  }

  // Register cards in the deck; live (not binned) cards get a market record.
  function addCards(state, cards) {
    var added = 0;
    (cards || []).forEach(function (card) {
      state.cards[card.id] = card;
      if (T.isBinned(card)) return;
      if (!state.companies[card.id]) {
        state.companies[card.id] = {
          id: card.id,
          status: 'dealt',           // dealt -> invited -> opted_in | declined
          listenPriceCents: M.suggestListenPrice(card),
          payout: 'cash',            // or 'credits'
          openBooth: false,          // true = will hear anyone at the listen price, matched or not
          creditsCents: 0,
          cashCents: 0,
          contributorId: (card.sources && card.sources[0] && card.sources[0].contributorId) || null,
          invitedAt: null, joinedAt: null, declinedAt: null
        };
        added += 1;
      }
    });
    refreshMatches(state);
    return added;
  }

  function refreshMatches(state) {
    var cards = Object.keys(state.cards).map(function (id) { return state.cards[id]; });
    state.matches = M.computeAll(cards, { threshold: state.config.matchThreshold });
    return state.matches;
  }

  function score(state, fromId, toId) {
    if (!state.matches) refreshMatches(state);
    return M.pairScore(state.matches, fromId, toId);
  }

  function company(state, id) {
    var c = state.companies[id];
    if (!c) throw new Error('No such company in the market: ' + id);
    return c;
  }
  function card(state, id) { return state.cards[id]; }
  function name(state, id) { var c = state.cards[id]; return c ? c.company.name : (state.contributors[id] ? state.contributors[id].name : id); }
  function contributorName(state, id) { var c = state.contributors[id]; return c ? c.name : (id || 'nobody'); }
  function contributorLabel(state, id) { var c = state.contributors[id]; return c ? c.label : 'an inbox'; }

  function matchCounts(state, id) {
    var m = state.matches && state.matches.byCompany[id];
    if (!m) return { wants: 0, wantedBy: 0, mutual: 0 };
    return { wants: m.wants.length, wantedBy: m.wantedBy.length, mutual: m.mutual.length };
  }

  // ---------------- Consent ----------------

  function invite(state, ids) {
    if (typeof ids === 'string') ids = [ids];
    var targets = ids || Object.keys(state.companies).filter(function (id) { return state.companies[id].status === 'dealt'; });
    var recs = targets.map(function (id) { return company(state, id); });  // an unknown id stops the invite before any letter goes out
    var sent = 0;
    targets.forEach(function (id, i) {
      var c = recs[i];
      if (c.status !== 'dealt') return;
      c.status = 'invited';
      c.invitedAt = now(state);
      state.outbox.push(inviteEmail(state, id));
      sent += 1;
    });
    if (sent) say(state, 'Invited ' + sent + ' compan' + (sent === 1 ? 'y' : 'ies') + '. Same letter to each: what we did, what we did not share, what they can do about it.');
    return sent;
  }

  // Consent runs in order: dealt -> invited -> opted_in | declined. Nobody joins (or declines) a market it was never told about.
  function optIn(state, id, opts) {
    opts = opts || {};
    var c = company(state, id);
    if (c.status === 'declined') throw new Error(name(state, id) + ' declined earlier. In this demo a declined company stays declined.');
    if (c.status === 'opted_in') return c;
    if (c.status !== 'invited') throw new Error(name(state, id) + ' has not been invited yet. A company can join only after it has had the invitation letter.');
    // Check everything first, so a bad price or payout leaves the company exactly as it was (it used to join anyway).
    var price = opts.listenPriceCents != null ? listenPrice(opts.listenPriceCents) : null;
    if (opts.payout && opts.payout !== 'cash' && opts.payout !== 'credits') throw new Error('Payout must be cash or credits.');
    c.status = 'opted_in';
    c.joinedAt = now(state);
    if (price != null) c.listenPriceCents = price;
    if (opts.payout) c.payout = opts.payout;
    if (opts.openBooth != null) c.openBooth = !!opts.openBooth;
    say(state, name(state, id) + ' joined. Attention priced at ' + money(c.listenPriceCents) + ' a read' + (c.openBooth ? ', booth open to anyone' : '') + '.');
    return c;
  }

  function decline(state, id) {
    var c = company(state, id);
    if (c.status === 'opted_in') throw new Error(name(state, id) + ' already joined.');
    if (c.status === 'declined') return c;  // one decline: the 30-day clock is not restarted
    if (c.status !== 'invited') throw new Error(name(state, id) + ' has not been invited yet. There is nothing to decline.');
    c.status = 'declined';
    c.declinedAt = now(state);
    say(state, name(state, id) + ' declined. Card deleted in ' + state.config.cardTtlDays + ' days. Nothing else happens.');
    return c;
  }

  function listenPrice(v) {
    var cents = toCents(v);
    if (!(cents >= 0)) throw new Error('A listen price must be a number of dollars, zero or more.');
    if (cents > MAX_CENTS) throw tooMuch();
    return cents;
  }

  function setListenPrice(state, id, cents) {
    var c = company(state, id);
    c.listenPriceCents = listenPrice(cents);
    return c;
  }

  function setPayout(state, id, payout) {
    if (payout !== 'cash' && payout !== 'credits') throw new Error('Payout must be cash or credits.');
    company(state, id).payout = payout;
  }

  function setOpenBooth(state, id, open) { company(state, id).openBooth = !!open; }

  // ---------------- Offers: pay to pitch ----------------

  // A meeting costs the read price times the multiplier, in whole cents, rounded up so the listener never gets less.
  function meetingPrice(state, readCents) { return Math.ceil(readCents * state.config.meetingMultiplier); }

  function priceFloor(state, fromId, toId, kind) {
    var listener = company(state, toId);
    var base = listener.listenPriceCents;
    if (kind === 'read') return base;
    if (kind === 'meeting') return meetingPrice(state, base);
    if (kind === 'swap') return meetingPrice(state, base); // the proposer's leg; the acceptor's leg is priced off the proposer
    throw new Error('Unknown pitch kind: ' + kind);
  }

  function canPitch(state, fromId, toId) {
    var listener = company(state, toId);
    var s = score(state, fromId, toId);
    var p = state.matches && state.matches.byKey[fromId + '>' + toId];
    if (p && p.rival) return { ok: false, why: 'They sell the same thing. The Dealer does not introduce rivals.' };
    if (listener.openBooth) return { ok: true, why: 'Booth is open: hears anyone at the listen price.', score: s };
    if (s >= state.config.matchThreshold) return { ok: true, why: 'Matched at ' + s + '/100.', score: s };
    return { ok: false, why: 'No match (' + s + '/100, needs ' + state.config.matchThreshold + ') and their booth is not open.', score: s };
  }

  function propose(state, o) {
    o = o || {};
    var from = company(state, o.from), to = company(state, o.to);
    if (o.from === o.to) throw new Error('A company cannot pitch itself. Tempting, though.');
    if (from.status !== 'opted_in') throw new Error(name(state, o.from) + ' has not joined yet.');
    if (to.status !== 'opted_in') throw new Error(name(state, o.to) + ' has not joined yet. No pitch reaches a company that has not opted in.');
    var kind = o.kind || 'read';
    if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) throw new Error('Unknown pitch kind: ' + kind);
    var gate = canPitch(state, o.from, o.to);
    if (!gate.ok) throw new Error(gate.why);
    var floor = priceFloor(state, o.from, o.to, kind);
    var price = o.priceCents != null ? toCents(o.priceCents) : floor;
    if (!isFinite(price)) throw new Error('An offer must be a number of dollars.');  // NaN and Infinity used to slip past the floor
    if (price < floor) throw new Error(name(state, o.to) + ' charges at least ' + money(floor) + ' for a ' + kind + '.');
    var backPrice = kind === 'swap' ? meetingPrice(state, from.listenPriceCents) : 0;
    if (price > MAX_CENTS || backPrice > MAX_CENTS) throw tooMuch();
    var payWith = o.payWith || 'cash';
    if (payWith !== 'cash' && payWith !== 'credits') throw new Error('Pay with cash or credits.');
    if (kind === 'swap' && payWith === 'credits') throw new Error('A swap settles in cash both ways.');
    var offer = {
      id: nextId(state, 'offer'),
      from: o.from, to: o.to, kind: kind,
      priceCents: price,
      backPriceCents: backPrice,
      payWith: payWith,
      pitch: o.pitch || defaultPitch(state, o.from, o.to),
      status: 'proposed',
      createdAt: now(state), acceptedAt: null, paidAt: null, completedAt: null,
      response: null,
      score: gate.score || 0,
      distributions: []
    };
    state.offers[offer.id] = offer;
    state.outbox.push(pitchRequestEmail(state, offer));
    say(state, name(state, o.from) + ' offers ' + money(price) + ' to ' + (kind === 'swap' ? 'swap pitches with' : 'pitch') + ' ' + name(state, o.to) + ' (' + KINDS[kind].label.toLowerCase() + ').');
    return offer;
  }

  function defaultPitch(state, fromId, toId) {
    var a = card(state, fromId), b = card(state, toId);
    return 'Hi ' + b.company.name + ' — ' + a.company.name + ' ' + lowerFirst(a.sells.summary) + '. ' +
      'We think you fit because ' + (matchReason(state, fromId, toId) || 'you are the kind of company we work with') + '. ' +
      'Fifteen minutes is all we need to show you on your own numbers.';
  }

  function matchReason(state, fromId, toId) {
    var p = state.matches && state.matches.byKey[fromId + '>' + toId];
    if (!p || !p.reasons.length) return '';
    var top = p.reasons.filter(function (r) { return r.points > 0 && r.you; }).sort(function (x, y) { return y.points - x.points; })[0];
    return top ? top.you : '';
  }

  function lowerFirst(s) { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); }

  function offerOf(state, id) {
    var o = state.offers[id];
    if (!o) throw new Error('No such offer: ' + id);
    return o;
  }

  function acceptOffer(state, id) {
    var o = offerOf(state, id);
    if (o.status !== 'proposed') throw new Error('This offer is ' + o.status + ', not open.');
    o.status = 'accepted';
    o.acceptedAt = now(state);
    say(state, name(state, o.to) + ' accepts. ' + name(state, o.from) + ' can now pay' + (o.kind === 'swap' ? '; both sides settle at once' : '') + '.');
    return o;
  }

  function declineOffer(state, id, note) {
    var o = offerOf(state, id);
    if (o.status !== 'proposed') throw new Error('This offer is ' + o.status + ', not open.');
    o.status = 'declined';
    o.response = { answer: 'declined', note: note || '' };
    say(state, name(state, o.to) + ' declines ' + name(state, o.from) + '. No money moves.');
    return o;
  }

  // The SIMULATED payment. There is no payment provider. The UI shows a fake checkout, then calls this.
  function pay(state, id) {
    var o = offerOf(state, id);
    if (o.status !== 'accepted') throw new Error('Pay only after the listener accepts (this offer is ' + o.status + ').');
    var from = company(state, o.from), to = company(state, o.to);
    if (!isWholeCents(o.priceCents) || !isWholeCents(o.backPriceCents) || o.priceCents < 0 || o.backPriceCents < 0) {
      throw new Error('Prices are whole cents; this offer holds ' + o.priceCents + ' and cannot be paid.');
    }
    if (o.payWith === 'credits') {
      if (from.creditsCents < o.priceCents) throw new Error(name(state, o.from) + ' has ' + money(from.creditsCents) + ' in credits and needs ' + money(o.priceCents) + '. Listen to a pitch or two first.');
      from.creditsCents -= o.priceCents;
      entry(state, { type: 'credits_spent', offerId: o.id, party: { kind: 'company', id: o.from }, amountCents: -o.priceCents, credits: true, memo: 'Spent credits to pitch ' + name(state, o.to) });
      entry(state, { type: 'escrow_in', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: o.priceCents, credits: true, memo: 'Held (credits) until ' + name(state, o.to) + ' answers' });
    } else {
      entry(state, { type: 'payment', offerId: o.id, party: { kind: 'company', id: o.from }, amountCents: -o.priceCents, memo: 'Paid to pitch ' + name(state, o.to) + ' (simulated)' });
      entry(state, { type: 'escrow_in', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: o.priceCents, memo: 'Held until ' + name(state, o.to) + ' answers' });
    }
    if (o.kind === 'swap') {
      entry(state, { type: 'payment', offerId: o.id, party: { kind: 'company', id: o.to }, amountCents: -o.backPriceCents, memo: 'Paid to pitch ' + name(state, o.from) + ' back (swap, simulated)' });
      entry(state, { type: 'escrow_in', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: o.backPriceCents, memo: 'Held until the swap happens' });
    }
    o.status = 'paid';
    o.paidAt = now(state);
    state.outbox.push(introEmail(state, o));
    state.outbox.push(receiptEmail(state, o));
    say(state, 'Paid (simulated). Introduction sent: for the first time, ' + name(state, o.from) + ' and ' + name(state, o.to) + ' can see each other’s contact details.');
    return o;
  }

  // The listener confirms the pitch happened (read: with an answer; meeting/swap: it took place). Money is released.
  function complete(state, id, response) {
    var o = offerOf(state, id);
    if (o.status !== 'paid') throw new Error('Nothing to release: this offer is ' + o.status + '.');
    company(state, o.from); company(state, o.to);  // both still in the market, before anything changes
    response = response || {};
    if (o.kind === 'read' && ['interested', 'not now', 'no'].indexOf(response.answer) < 0) throw new Error('A read ends with an answer: interested, not now, or no.');
    o.response = { answer: response.answer || 'done', note: response.note || '' };
    o.status = 'completed';
    o.completedAt = now(state);
    o.distributions.push(distribute(state, { offerId: o.id, grossCents: o.priceCents, listenerId: o.to, pitcherId: o.from, viaCredits: o.payWith === 'credits' }));
    if (o.kind === 'swap') o.distributions.push(distribute(state, { offerId: o.id, grossCents: o.backPriceCents, listenerId: o.from, pitcherId: o.to, viaCredits: false }));
    o.distributions.forEach(function (d) {
      d.contributorShares.forEach(function (cs) { state.outbox.push(statementEmail(state, o, d, cs)); });
    });
    say(state, name(state, o.to) + (o.kind === 'read' ? ' answered "' + o.response.answer + '". ' : ' confirms it happened. ') + 'Money released: ' + describeDistribution(state, o.distributions[0]) + '.');
    return o;
  }

  // The intro email promises a refund if nothing happens within responseDays. This is that path (the clock is the user's: a button).
  function refund(state, id, note) {
    var o = offerOf(state, id);
    if (o.status !== 'paid') throw new Error('Only a paid, unanswered pitch can be refunded (this offer is ' + o.status + ').');
    var from = company(state, o.from), to = company(state, o.to);
    if (o.payWith === 'credits') {
      entry(state, { type: 'escrow_out', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: -o.priceCents, credits: true, memo: 'Returned: no answer from ' + name(state, o.to) });
      from.creditsCents += o.priceCents;
      entry(state, { type: 'credits_refund', offerId: o.id, party: { kind: 'company', id: o.from }, amountCents: o.priceCents, credits: true, memo: 'Credits returned: ' + name(state, o.to) + ' never answered' });
    } else {
      entry(state, { type: 'escrow_out', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: -o.priceCents, memo: 'Returned: no answer from ' + name(state, o.to) });
      entry(state, { type: 'refund', offerId: o.id, party: { kind: 'company', id: o.from }, amountCents: o.priceCents, memo: 'Refunded (simulated): ' + name(state, o.to) + ' never answered' });
    }
    if (o.kind === 'swap' && o.backPriceCents) {
      entry(state, { type: 'escrow_out', offerId: o.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: -o.backPriceCents, memo: 'Returned: the swap never happened' });
      entry(state, { type: 'refund', offerId: o.id, party: { kind: 'company', id: o.to }, amountCents: o.backPriceCents, memo: 'Refunded (simulated): the swap never happened' });
    }
    o.status = 'refunded';
    o.refundedAt = now(state);
    o.response = { answer: 'no answer', note: note || '' };
    say(state, name(state, o.to) + ' never answered. ' + money(o.priceCents) + (o.kind === 'swap' ? ' and ' + money(o.backPriceCents) : '') + ' returned. Nobody is paid for a pitch that did not happen.');
    return o;
  }

  // ---------------- The split ----------------

  // The inboxes that supplied a company: every distinct contributor on its card's sources, in the order the emails came.
  // A card without sourced contributors falls back to the company record's contributor.
  function suppliers(state, id) {
    var c = state.cards[id], out = [];
    ((c && c.sources) || []).forEach(function (src) { if (src && src.contributorId && out.indexOf(src.contributorId) < 0) out.push(src.contributorId); });
    var rec = state.companies[id];
    if (!out.length && rec && rec.contributorId) out.push(rec.contributorId);
    return out;
  }

  // Who gets what from one gross payment. The platform absorbs rounding so the parts always add up to the whole.
  function distribute(state, d) {
    var s = state.config.splitsBp;
    var gross = d.grossCents;
    var listener = company(state, d.listenerId);
    var pitcher = company(state, d.pitcherId);
    var listenerShare = Math.round(gross * s.listener / 10000);
    var lcShare = Math.round(gross * s.listenerContributor / 10000);
    var pcShare = Math.round(gross * s.pitcherContributor / 10000);
    var platformShare;
    var contributorShares = [];

    entry(state, { type: 'escrow_out', offerId: d.offerId, party: { kind: 'escrow', id: 'escrow' }, amountCents: -gross, credits: !!d.viaCredits, memo: 'Released' });

    // Listener: cash, or credits with a bonus (SpamDeck keeps the cash and owes the credits)
    var listenerCredits = 0;
    if (listener.payout === 'credits') {
      listenerCredits = Math.round(listenerShare * (10000 + state.config.creditBonusBp) / 10000);
      listener.creditsCents += listenerCredits;
      entry(state, { type: 'credits_earned', offerId: d.offerId, party: { kind: 'company', id: d.listenerId }, amountCents: listenerCredits, credits: true, memo: 'Listened to ' + name(state, d.pitcherId) + ' — took credits (+' + (state.config.creditBonusBp / 100) + '%)' });
      if (!d.viaCredits) entry(state, { type: 'platform_holds', offerId: d.offerId, party: { kind: 'platform', id: 'platform' }, amountCents: listenerShare, memo: 'Cash kept against ' + money(listenerCredits) + ' of credits owed to ' + name(state, d.listenerId) });
    } else {
      listener.cashCents += listenerShare;
      entry(state, { type: 'payout', offerId: d.offerId, party: { kind: 'company', id: d.listenerId }, amountCents: listenerShare, memo: 'Listened to ' + name(state, d.pitcherId) + ' (' + (s.listener / 100) + '%)' });
    }

    // Contributors: the inboxes that supplied the listener, then those that supplied the pitcher. A share is split equally
    // among a company's distinct inboxes, in the order its emails came. Unclaimed shares, and the cents that do not divide,
    // go to the platform, so the parts still add up to the whole.
    var claimed = 0, unclaimed = false, leftover = false;
    [{ total: lcShare, ids: suppliers(state, d.listenerId), role: 'listener', id: d.listenerId, bp: s.listenerContributor },
      { total: pcShare, ids: suppliers(state, d.pitcherId), role: 'pitcher', id: d.pitcherId, bp: s.pitcherContributor }].forEach(function (g) {
      if (!g.total) return;
      if (!g.ids.length) { unclaimed = true; return; }
      var each = Math.floor(g.total / g.ids.length);
      if (each * g.ids.length !== g.total) leftover = true;
      if (!each) return;
      g.ids.forEach(function (cid) {
        var others = g.ids.filter(function (x) { return x !== cid; });
        var shared = others.length ? ', shared with ' + others.map(function (x) { return contributorLabel(state, x); }).join(' and ') : '';
        entry(state, { type: 'payout', offerId: d.offerId, party: { kind: 'contributor', id: cid }, amountCents: each, memo: 'Supplied the ' + g.role + ', ' + name(state, g.id) + ' (' + (g.bp / 100) + '%' + shared + ')' });
        var cs = { contributorId: cid, amountCents: each, role: 'supplied the ' + g.role, who: name(state, g.id) };
        if (others.length) cs.sharedWith = others;
        contributorShares.push(cs);
        claimed += each;
      });
    });
    platformShare = gross - listenerShare - claimed;

    // Platform. When the pitch was paid in credits no cash came in, so the cash payouts above come out of SpamDeck's pocket.
    if (d.viaCredits) {
      var cashOut = (listener.payout === 'credits' ? 0 : listenerShare) + claimed;
      entry(state, { type: 'platform_funds', offerId: d.offerId, party: { kind: 'platform', id: 'platform' }, amountCents: -cashOut, memo: 'Funded a credits-paid pitch from earlier cash (its ' + (s.platform / 100) + '% share is forgone)' });
      platformShare = -cashOut;
    } else {
      var extra = [];
      if (unclaimed) extra.push('unclaimed contributor share');
      if (leftover) extra.push('cents left over from a shared contributor share');
      entry(state, { type: 'platform_fee', offerId: d.offerId, party: { kind: 'platform', id: 'platform' }, amountCents: platformShare, memo: 'SpamDeck fee (' + (s.platform / 100) + '%' + (extra.length ? ' + ' + extra.join(' + ') : '') + ')' });
    }

    return {
      grossCents: gross, listenerId: d.listenerId, pitcherId: d.pitcherId, viaCredits: !!d.viaCredits,
      listenerCents: listener.payout === 'credits' ? 0 : listenerShare, listenerCredits: listenerCredits,
      contributorShares: contributorShares, platformCents: platformShare
    };
  }

  function describeDistribution(state, d) {
    var parts = [];
    if (d.listenerCredits) parts.push(name(state, d.listenerId) + ' ' + money(d.listenerCredits) + ' in credits');
    else parts.push(name(state, d.listenerId) + ' ' + money(d.listenerCents));
    var byC = {};
    d.contributorShares.forEach(function (cs) { byC[cs.contributorId] = (byC[cs.contributorId] || 0) + cs.amountCents; });
    Object.keys(byC).forEach(function (id) { parts.push(contributorName(state, id) + ' ' + money(byC[id])); });
    parts.push('SpamDeck ' + money(d.platformCents));
    return parts.join(', ');
  }

  // ---------------- Open pitches: listen to earn ----------------

  function postOpenPitch(state, o) {
    var from = company(state, o.from);
    if (from.status !== 'opted_in') throw new Error(name(state, o.from) + ' has not joined yet.');
    var price = toCents(o.pricePerReadCents), max = toCents(o.maxReads);
    if (!isFinite(price)) throw new Error('Price per read must be a number of dollars above zero.');
    if (!(price > 0)) throw new Error('Price per read must be above zero.');
    if (!isFinite(max)) throw new Error('The number of reads must be a whole number.');
    if (!(max > 0)) throw new Error('Allow at least one read.');
    var minScore = state.config.matchThreshold;
    if (o.minScore != null && o.minScore !== '') {
      minScore = typeof o.minScore === 'string' ? Number(o.minScore.trim()) : o.minScore;
      if (typeof minScore !== 'number' || !isFinite(minScore)) throw new Error('The minimum match score must be a number.');
    }
    var budget = price * max;
    if (budget > MAX_CENTS) throw tooMuch();
    var p = {
      id: nextId(state, 'open'), from: o.from, pricePerReadCents: price, maxReads: max,
      minScore: minScore,
      text: o.text || defaultPitch(state, o.from, o.from).replace(/^Hi [^—]*— /, ''),
      budgetCents: budget, spentCents: 0, reads: [], status: 'open', createdAt: now(state)
    };
    entry(state, { type: 'payment', openPitchId: p.id, party: { kind: 'company', id: o.from }, amountCents: -budget, memo: 'Budget for an open pitch: ' + max + ' reads at ' + money(price) + ' (simulated)' });
    entry(state, { type: 'escrow_in', openPitchId: p.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: budget, memo: 'Held for ' + name(state, o.from) + '’s open pitch' });
    state.openPitches[p.id] = p;
    say(state, name(state, o.from) + ' posts an open pitch: ' + money(price) + ' to any matched company that reads it and answers, up to ' + max + ' readers.');
    return p;
  }

  function eligibleReaders(state, pitchId) {
    var p = state.openPitches[pitchId];
    if (!p) throw new Error('No such open pitch: ' + pitchId);
    if (p.status !== 'open') return [];  // nobody can read a closed pitch
    if (!state.matches) refreshMatches(state);
    return Object.keys(state.companies).filter(function (id) {
      var c = state.companies[id];
      if (id === p.from || c.status !== 'opted_in') return false;
      if (p.reads.some(function (r) { return r.listenerId === id; })) return false;
      var pair = state.matches.byKey[p.from + '>' + id];
      if (pair && pair.rival) return false;
      return c.openBooth || score(state, p.from, id) >= p.minScore;
    });
  }

  function readOpenPitch(state, o) {
    var p = state.openPitches[o.pitchId];
    if (!p) throw new Error('No such open pitch: ' + o.pitchId);
    if (p.status !== 'open') throw new Error('That open pitch is closed.');
    if (['interested', 'not now', 'no'].indexOf(o.answer) < 0) throw new Error('Reading ends with an answer: interested, not now, or no.');
    if (eligibleReaders(state, p.id).indexOf(o.listenerId) < 0) throw new Error(name(state, o.listenerId) + ' is not eligible to read this pitch (not matched, not joined, or already read it).');
    p.reads.push({ listenerId: o.listenerId, answer: o.answer, note: o.note || '', at: now(state) });
    p.spentCents += p.pricePerReadCents;
    var d = distribute(state, { offerId: p.id, grossCents: p.pricePerReadCents, listenerId: o.listenerId, pitcherId: p.from, viaCredits: false });
    d.contributorShares.forEach(function (cs) { state.outbox.push(statementEmail(state, { id: p.id, from: p.from, to: o.listenerId, kind: 'read', priceCents: p.pricePerReadCents }, d, cs)); });
    if (p.reads.length >= p.maxReads) p.status = 'closed';
    say(state, name(state, o.listenerId) + ' read ' + name(state, p.from) + '’s pitch and answered "' + o.answer + '". ' + describeDistribution(state, d) + '.');
    return d;
  }

  function closeOpenPitch(state, pitchId) {
    var p = state.openPitches[pitchId];
    if (!p) throw new Error('No such open pitch: ' + pitchId);
    if (p.status !== 'open') return p;
    var left = p.budgetCents - p.spentCents;
    if (left > 0) {
      entry(state, { type: 'escrow_out', openPitchId: p.id, party: { kind: 'escrow', id: 'escrow' }, amountCents: -left, memo: 'Unused budget returned' });
      entry(state, { type: 'refund', openPitchId: p.id, party: { kind: 'company', id: p.from }, amountCents: left, memo: 'Unused open-pitch budget returned (simulated)' });
    }
    p.status = 'closed';
    say(state, name(state, p.from) + ' closed its open pitch. ' + money(left) + ' returned.');
    return p;
  }

  // ---------------- Ledger ----------------

  // Every ledger entry is a whole number of cents. Anything else is a bug upstream; stop it here rather than corrupt the books.
  function entry(state, e) {
    if (!isWholeCents(e.amountCents)) throw new Error('Ledger entries are whole cents; refusing ' + e.amountCents + '.');
    e.id = nextId(state, 'led');
    e.at = now(state);
    e.credits = !!e.credits;
    state.ledger.push(e);
    return e;
  }

  function summary(state) {
    var contributors = {}, companies = {}, platform = 0, escrowCash = 0, escrowCredits = 0, volume = 0;
    Object.keys(state.contributors).forEach(function (id) { contributors[id] = 0; });
    Object.keys(state.companies).forEach(function (id) { companies[id] = { cash: 0, credits: 0, paid: 0 }; });
    state.ledger.forEach(function (e) {
      var k = e.party.kind, id = e.party.id, amt = e.amountCents;
      if (k === 'contributor') contributors[id] = (contributors[id] || 0) + amt;
      else if (k === 'platform') platform += amt;
      else if (k === 'escrow') { if (e.credits) escrowCredits += amt; else escrowCash += amt; }
      else if (k === 'company') {
        companies[id] = companies[id] || { cash: 0, credits: 0, paid: 0 };
        if (e.credits) companies[id].credits += amt;
        else if (e.type === 'refund') companies[id].paid -= amt;   // money back is not money earned
        else if (amt < 0) companies[id].paid += -amt;
        else companies[id].cash += amt;
      }
      if (e.type === 'payment' || e.type === 'credits_spent') volume += -amt;
      if (e.type === 'refund') volume -= amt;   // money that came back was never spent on a pitch
    });
    var creditsOutstanding = 0;
    Object.keys(state.companies).forEach(function (id) { creditsOutstanding += state.companies[id].creditsCents; });
    var completed = Object.keys(state.offers).filter(function (id) { return state.offers[id].status === 'completed'; }).length;
    var reads = Object.keys(state.openPitches).reduce(function (n, id) { return n + state.openPitches[id].reads.length; }, 0);
    return {
      contributors: contributors, companies: companies, platformCents: platform,
      escrowCents: escrowCash, escrowCreditsCents: escrowCredits, creditsOutstandingCents: creditsOutstanding,
      volumeCents: volume, completedPitches: completed + reads,
      counts: statusCounts(state)
    };
  }

  function statusCounts(state) {
    var out = { dealt: 0, invited: 0, opted_in: 0, declined: 0, binned: 0, cards: 0 };
    Object.keys(state.cards).forEach(function (id) { out.cards += 1; if (T.isBinned(state.cards[id])) out.binned += 1; });
    Object.keys(state.companies).forEach(function (id) { out[state.companies[id].status] += 1; });
    return out;
  }

  // ---------------- Emails (nothing is sent; they land in the outbox) ----------------

  var FOOTER = '\n\n— The Dealer, SpamDeck\n(Demo: this message was generated, not sent. No money moved.)';

  function firstName(c) { var n = c.company.contact && c.company.contact.name; return n ? n.split(' ')[0] : c.company.name; }
  function contactLine(c) {
    var k = c.company.contact || {};
    return c.company.name + ' — ' + (k.name || 'contact') + (k.title ? ', ' + k.title : '') + (k.email ? ' <' + k.email + '>' : '');
  }

  function inviteEmail(state, id) {
    var c = card(state, id), rec = company(state, id);
    var src = c.sources[0] || {};
    var counts = matchCounts(state, id);
    var s = state.config.splitsBp;
    return {
      id: nextId(state, 'mail'), at: now(state), type: 'invite', companyId: id,
      to: [{ name: c.company.contact.name || c.company.name, email: c.company.contact.email }],
      subject: 'You pitched ' + contributorLabel(state, src.contributorId) + '. Here’s a better pitch.',
      body: 'Hi ' + firstName(c) + ',\n\n' +
        'On ' + (src.receivedAt || 'a recent day') + ' you emailed ' + contributorLabel(state, src.contributorId) + ' about ' + lowerFirst(c.sells.summary) + '. It wasn’t for them. ' +
        'But they have added ' + c.company.name + ' to SpamDeck, a marketplace where companies pay to pitch each other, with everyone’s consent.\n\n' +
        'What we did: we read your email and wrote a one-line card about ' + c.company.name + ' — what you sell, and who you want to reach. We did not share your email address, or this message, with anyone.\n\n' +
        'What’s on the table: ' + counts.wants + ' compan' + (counts.wants === 1 ? 'y' : 'ies') + ' in the pool look like the companies you are trying to reach. ' +
        counts.mutual + ' of them ' + (counts.mutual === 1 ? 'is' : 'are') + ' also trying to reach a company like yours.\n\n' +
        'Your options:\n' +
        '  1. Join and set a price for your attention. When a matched company pays to pitch you, you keep ' + (s.listener / 100) + '%. Our suggestion for a company your size: ' + money(rec.listenPriceCents) + ' a read.\n' +
        '  2. Pay to pitch a matched company that has agreed to listen.\n' +
        '  3. No budget? Read a few pitches, earn credits, and spend them on the introductions you actually want.\n' +
        '  4. Do nothing. Your card is deleted in ' + state.config.cardTtlDays + ' days and you never hear from us again.' + FOOTER
    };
  }

  function pitchRequestEmail(state, o) {
    var a = card(state, o.from), b = card(state, o.to), listener = company(state, o.to);
    var s = state.config.splitsBp;
    var share = Math.round(o.priceCents * s.listener / 10000);
    var credits = Math.round(share * (10000 + state.config.creditBonusBp) / 10000);
    var reason = matchReason(state, o.from, o.to);
    return {
      id: nextId(state, 'mail'), at: now(state), type: 'request', offerId: o.id, companyId: o.to,
      to: [{ name: b.company.contact.name || b.company.name, email: b.company.contact.email }],
      subject: a.company.name + ' wants to pitch you — and will pay ' + money(o.priceCents) + ' for a ' + KINDS[o.kind].label.toLowerCase(),
      body: 'Hi ' + firstName(b) + ',\n\n' +
        a.company.name + ' (' + lowerFirst(a.sells.summary) + ') has asked to pitch ' + b.company.name + '.\n\n' +
        'Why they want you: ' + (reason || 'their booth matched yours') + '.\n\n' +
        'If you accept: ' + KINDS[o.kind].blurb + (o.kind === 'swap' ? ' You would pay ' + money(o.backPriceCents) + ' for your side of the swap.' : '') + '\n' +
        'You keep ' + (s.listener / 100) + '% of ' + money(o.priceCents) + ': ' + money(share) + ' in cash, or ' + money(credits) + ' in pitching credits.\n\n' +
        'Their pitch, in one paragraph:\n"' + o.pitch + '"\n\n' +
        'Decline and nothing happens. ' + (listener.openBooth ? 'Your booth is open, so they did not need a match to ask.' : 'They could only ask because the Dealer matched you.') + FOOTER
    };
  }

  function introEmail(state, o) {
    var a = card(state, o.from), b = card(state, o.to);
    return {
      id: nextId(state, 'mail'), at: now(state), type: 'intro', offerId: o.id, companyId: o.to,
      to: [{ name: a.company.contact.name || a.company.name, email: a.company.contact.email }, { name: b.company.contact.name || b.company.name, email: b.company.contact.email }],
      subject: 'Introduction: ' + a.company.name + ' ' + (o.kind === 'swap' ? '⇄' : '→') + ' ' + b.company.name + ' (pitch accepted and paid)',
      body: 'Hello both,\n\n' +
        b.company.name + ' agreed to hear ' + a.company.name + '’s pitch' + (o.kind === 'swap' ? ', and vice versa' : '') + '. ' +
        a.company.name + ' has paid ' + money(o.priceCents) + (o.kind === 'swap' ? ' and ' + b.company.name + ' has paid ' + money(o.backPriceCents) : '') + ', held by SpamDeck until the pitch happens.\n\n' +
        'Here are each other’s details — the first time either side sees them:\n' +
        '  ' + contactLine(a) + '\n' +
        '  ' + contactLine(b) + '\n\n' +
        'What happens next: ' + KINDS[o.kind].blurb + '\n' +
        b.company.name + ': when it’s done, confirm on SpamDeck' + (o.kind === 'read' ? ' with your answer (interested / not now / no)' : '') + ' and the money is released. ' +
        'If nothing happens within ' + state.config.responseDays + ' days, ' + a.company.name + ' is refunded.' + FOOTER
    };
  }

  function receiptEmail(state, o) {
    var a = card(state, o.from), b = card(state, o.to);
    return {
      id: nextId(state, 'mail'), at: now(state), type: 'receipt', offerId: o.id, companyId: o.from,
      to: [{ name: a.company.contact.name || a.company.name, email: a.company.contact.email }],
      subject: 'Receipt: ' + money(o.priceCents) + ' to pitch ' + b.company.name + ' (SIMULATED — no money moved)',
      body: 'This is a demo receipt. SpamDeck’s demo has no payment provider; nothing was charged.\n\n' +
        'Item: one ' + KINDS[o.kind].label.toLowerCase() + ' pitch to ' + b.company.name + '\n' +
        'Paid with: ' + (o.payWith === 'credits' ? 'pitching credits' : 'card (test)') + '\n' +
        'Amount: ' + money(o.priceCents) + '\n' +
        'Held until ' + b.company.name + ' confirms. Refunded if they don’t within ' + state.config.responseDays + ' days.' + FOOTER
    };
  }

  function statementEmail(state, o, d, cs) {
    var total = 0;
    state.ledger.forEach(function (e) { if (e.party.kind === 'contributor' && e.party.id === cs.contributorId) total += e.amountCents; });
    var c = state.contributors[cs.contributorId] || { name: cs.contributorId, label: 'your inbox' };
    return {
      id: nextId(state, 'mail'), at: now(state), type: 'statement', offerId: o.id, contributorId: cs.contributorId,
      to: [{ name: c.name, email: '' }],
      subject: (cs.contributorId === 'you' ? 'Your inbox' : c.label.charAt(0).toUpperCase() + c.label.slice(1)) + ' just earned ' + money(cs.amountCents),
      body: name(state, o.from) + ' paid ' + money(d.grossCents) + ' to pitch ' + name(state, o.to) + '. You ' + cs.role + ' (' + cs.who + ' came from ' + c.label +
        (cs.sharedWith && cs.sharedWith.length ? ', shared with ' + cs.sharedWith.map(function (x) { return contributorLabel(state, x); }).join(' and ') + ', which also supplied it' : '') + ').\n\n' +
        'Your share: ' + money(cs.amountCents) + '\nRunning total: ' + money(total) + '\n\nYou did nothing. That was the point.' + FOOTER
    };
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG, KINDS: KINDS, MAX_CENTS: MAX_CENTS,
    money: money, validateSplits: validateSplits,
    createState: createState, addContributors: addContributors, addCards: addCards, refreshMatches: refreshMatches,
    invite: invite, optIn: optIn, decline: decline, setListenPrice: setListenPrice, setPayout: setPayout, setOpenBooth: setOpenBooth,
    canPitch: canPitch, priceFloor: priceFloor, propose: propose, acceptOffer: acceptOffer, declineOffer: declineOffer, pay: pay, complete: complete, refund: refund,
    postOpenPitch: postOpenPitch, eligibleReaders: eligibleReaders, readOpenPitch: readOpenPitch, closeOpenPitch: closeOpenPitch,
    summary: summary, statusCounts: statusCounts, matchCounts: matchCounts, score: score, say: say, name: name, contributorName: contributorName
  };
});
