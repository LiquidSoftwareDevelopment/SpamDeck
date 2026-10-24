/* SpamDeck — the matching engine: who would want to pitch whom, and why.
   Deterministic and explainable on purpose: every point has a sentence attached.
   Browser: window.SpamDeck.match · Node: require('./match.js') */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./taxonomy.js'));
  } else {
    root.SpamDeck = root.SpamDeck || {};
    root.SpamDeck.match = factory(root.SpamDeck.taxonomy);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  var WEIGHTS = {
    industryExact: 25,   // A targets exactly B's industry
    industryUmbrella: 15, // A targets "SaaS", B is hr-tech software: close enough
    industryAny: 10,     // A pitches anyone (a weak signal: it tells us nothing about B)
    sizeExact: 20,       // B's headcount is in a band A asked for
    sizeAdjacent: 10,    // one band off
    sizeUnspecified: 5,  // A never said
    roleStrong: 15,      // A pitches CFOs and B has a finance team
    roleWeak: 5,         // A pitches founders (everyone has one)
    perSituation: 20,    // A looks for companies without a finance team; B has none — the strongest signal there is
    weakSituation: 5,    // generic situations (startup, b2b, remote) count for less
    situationCap: 35,
    rival: -40,          // same product category: a pitch nobody wants
    adjacent: -10        // overlapping product tags: probably competitors
  };
  var THRESHOLDS = { match: 55, hot: 70 };
  var WEAK_SITUATIONS = { startup: true, b2b: true, remote: true };

  function overlap(a, b) {
    var out = [];
    (a || []).forEach(function (x) { if (T.has(b, x) && out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  function label(ind) { return T.INDUSTRY_LABEL[ind] || ind; }

  // Score how much pitcher A would want to pitch listener B (0..100), with reasons.
  function scorePair(a, b) {
    var reasons = [];
    var total = 0;
    var bName = b.company.name;

    // 1. Industry
    var ti = a.targets.industries || [];
    if (T.has(ti, b.profile.industry)) {
      total += WEIGHTS.industryExact;
      reasons.push({ facet: 'industry', points: WEIGHTS.industryExact, text: 'targets ' + label(b.profile.industry) + ' companies and ' + bName + ' is one', you: 'you are a ' + label(b.profile.industry) + ' company, exactly who they sell to' });
    } else {
      var umbrella = ti.filter(function (i) { return T.INDUSTRY_SECTOR[i] === b.profile.sector && T.UMBRELLA_SECTORS[b.profile.sector]; });
      if (umbrella.length) {
        total += WEIGHTS.industryUmbrella;
        reasons.push({ facet: 'industry', points: WEIGHTS.industryUmbrella, text: 'targets ' + label(umbrella[0]) + ' and ' + bName + ' is ' + label(b.profile.industry) + ', close enough', you: 'you are a ' + label(b.profile.industry) + ' company, close to the ' + label(umbrella[0]) + ' companies they sell to' });
      } else if (T.has(ti, 'any')) {
        total += WEIGHTS.industryAny;
        reasons.push({ facet: 'industry', points: WEIGHTS.industryAny, text: 'pitches any industry', you: 'they pitch any industry' });
      }
    }

    // 2. Size
    var bands = a.targets.sizeBands || [];
    if (!bands.length) {
      total += WEIGHTS.sizeUnspecified;
      reasons.push({ facet: 'size', points: WEIGHTS.sizeUnspecified, text: 'never said what size of company it wants', you: 'they never said what size of company they want' });
    } else if (T.has(bands, b.profile.sizeBand)) {
      total += WEIGHTS.sizeExact;
      reasons.push({ facet: 'size', points: WEIGHTS.sizeExact, text: 'wants companies of ' + b.profile.sizeBand + ' people and ' + bName + ' has about ' + b.profile.size, you: 'you have about ' + b.profile.size + ' people, the size they look for' });
    } else {
      var bi = T.bandIndex(b.profile.sizeBand);
      var near = bands.some(function (x) { return Math.abs(T.bandIndex(x) - bi) === 1; });
      if (near) {
        total += WEIGHTS.sizeAdjacent;
        reasons.push({ facet: 'size', points: WEIGHTS.sizeAdjacent, text: bName + ' (' + b.profile.size + ' people) is one size band off what it asked for', you: 'you are close to the size they look for' });
      }
    }

    // 3. Role: does B have the person A sells to?
    var best = null;
    (a.targets.roles || []).forEach(function (role) {
      var need = T.ROLE_NEEDS[role];
      if (!need) return;
      var hit = false, pts = 0;
      if (need.weak) { hit = true; pts = WEIGHTS.roleWeak; }
      else if (need.needs === 'office') { hit = b.profile.hasOffice === true; pts = WEIGHTS.roleStrong; }
      else if (need.needs === 'hiring') { hit = !!b.profile.hiring || T.has(b.profile.teams, 'engineering'); pts = WEIGHTS.roleStrong; }
      else if (need.team) { hit = T.has(b.profile.teams, need.team) || (need.altTeam && T.has(b.profile.teams, need.altTeam)); pts = WEIGHTS.roleStrong; }
      if (hit && (!best || pts > best.points)) best = { points: pts, role: role, label: need.label };
    });
    if (best) {
      total += best.points;
      reasons.push({ facet: 'role', points: best.points, text: 'pitches to ' + (T.ROLE_PLURAL[best.role] || best.role) + ' and ' + bName + ' has ' + best.label, you: 'you have ' + best.label + ', who they pitch to' });
    }

    // 4. Situations: what A looks for vs what B is
    var sit = overlap(a.targets.tags, b.situations);
    if (sit.length) {
      var pts2 = 0;
      sit.forEach(function (s) { pts2 += WEAK_SITUATIONS[s] ? WEIGHTS.weakSituation : WEIGHTS.perSituation; });
      pts2 = Math.min(WEIGHTS.situationCap, pts2);
      total += pts2;
      var plural = function (s) { return (T.SITUATION_LABEL[s] || s).replace(/^is /, 'are ').replace(/^has /, 'have ').replace(/^sells /, 'sell ').replace(/^bills /, 'bill '); };
      var singular = function (s) { return T.SITUATION_LABEL[s] || s; };
      reasons.push({ facet: 'situation', points: pts2, text: 'looks for companies that ' + sit.map(plural).join(', ') + ' — ' + bName + ' ' + sit.map(singular).join(', '), you: 'you ' + sit.map(plural).map(function (t) { return t.replace(/^are /, 'are ').replace(/^have /, 'have '); }).join(' and ') });
    }

    // 5. Rivals and near-rivals. A category that names no product ("other", the generic "software") makes nobody a rival.
    var rival = false;
    if (a.sells.category === b.sells.category && !T.isGenericCategory(a.sells.category)) {
      rival = true;
      total += WEIGHTS.rival;
      reasons.push({ facet: 'rival', points: WEIGHTS.rival, text: 'sells the same thing (' + a.sells.category.replace(/-/g, ' ') + ') — a pitch nobody wants', you: 'you sell the same thing' });
    } else {
      var shared = overlap(a.sells.tags, b.sells.tags);
      if (shared.length >= 2) {
        total += WEIGHTS.adjacent;
        reasons.push({ facet: 'adjacent', points: WEIGHTS.adjacent, text: 'sells something similar (' + shared.join(', ') + ')', you: 'you sell something similar' });
      }
    }

    var score = Math.max(0, Math.min(100, Math.round(total)));
    return {
      from: a.id, to: b.id, score: score, rival: rival,
      tier: score >= THRESHOLDS.hot ? 'hot' : (score >= THRESHOLDS.match ? 'warm' : 'none'),
      reasons: reasons
    };
  }

  // Plain code-point order, the same in every browser and locale (localeCompare is not).
  function cmp(x, y) { return x < y ? -1 : (x > y ? 1 : 0); }

  // Score every ordered pair of live cards; find mutual wants. The answer, ties included, does not depend on the order
  // of the deck: every list is sorted by score, then by id.
  function computeAll(cards, opts) {
    opts = opts || {};
    var threshold = opts.threshold != null ? opts.threshold : THRESHOLDS.match;
    var seen = {};
    var live = (cards || []).filter(function (c) {
      if (!c || T.isBinned(c) || Object.prototype.hasOwnProperty.call(seen, c.id)) return false;  // a card listed twice is one company
      seen[c.id] = true;
      return true;
    });
    var pairs = [], byKey = {}, byCompany = {};
    live.forEach(function (c) { byCompany[c.id] = { wants: [], wantedBy: [], mutual: [], rivals: [] }; });
    for (var i = 0; i < live.length; i++) {
      for (var j = 0; j < live.length; j++) {
        if (i === j) continue;
        var p = scorePair(live[i], live[j]);
        byKey[p.from + '>' + p.to] = p;
        if (p.rival && byCompany[p.from].rivals.indexOf(p.to) < 0) byCompany[p.from].rivals.push(p.to);
        if (p.score >= threshold) {
          pairs.push(p);
          byCompany[p.from].wants.push({ id: p.to, score: p.score });
          byCompany[p.to].wantedBy.push({ id: p.from, score: p.score });
        }
      }
    }
    var mutual = [];
    pairs.forEach(function (p) {
      if (p.from < p.to) {
        var back = byKey[p.to + '>' + p.from];
        if (back && back.score >= threshold) {
          var m = { a: p.from, b: p.to, ab: p, ba: back, score: Math.round((p.score + back.score) / 2) };
          mutual.push(m);
          byCompany[p.from].mutual.push(p.to);
          byCompany[p.to].mutual.push(p.from);
        }
      }
    });
    pairs.sort(function (x, y) { return y.score - x.score || cmp(x.from, y.from) || cmp(x.to, y.to); });
    mutual.sort(function (x, y) { return y.score - x.score || cmp(x.a, y.a) || cmp(x.b, y.b); });
    var mutualScore = {};
    mutual.forEach(function (m) { mutualScore[m.a + '>' + m.b] = mutualScore[m.b + '>' + m.a] = m.score; });
    var byScoreThenId = function (x, y) { return y.score - x.score || cmp(x.id, y.id); };
    Object.keys(byCompany).forEach(function (id) {
      var b = byCompany[id];
      b.wants.sort(byScoreThenId);
      b.wantedBy.sort(byScoreThenId);
      b.mutual.sort(function (x, y) { return mutualScore[id + '>' + y] - mutualScore[id + '>' + x] || cmp(x, y); });
      b.rivals.sort(cmp);
    });
    return { pairs: pairs, mutual: mutual, byKey: byKey, byCompany: byCompany, threshold: threshold, live: live.length };
  }

  function pairScore(result, fromId, toId) {
    var p = result && result.byKey[fromId + '>' + toId];
    return p ? p.score : 0;
  }

  // One-line explanation for the UI/outbox.
  function explain(p, cards) {
    var byId = {};
    (cards || []).forEach(function (c) { byId[c.id] = c; });
    var a = byId[p.from], b = byId[p.to];
    var who = a ? a.company.name : p.from, whom = b ? b.company.name : p.to;
    var top = p.reasons.filter(function (r) { return r.points > 0; }).sort(function (x, y) { return y.points - x.points; }).slice(0, 2);
    return who + ' wants to pitch ' + whom + ' (' + p.score + '/100): ' + top.map(function (r) { return r.text; }).join('; ') + '.';
  }

  // A fair default "listen price" for a company, by size: bigger companies' attention costs more. In cents.
  var LISTEN_PRICE_BY_BAND = { '1-10': 2500, '11-50': 7500, '51-200': 10000, '201-1000': 20000, '1000+': 40000 };
  function suggestListenPrice(card) {
    return LISTEN_PRICE_BY_BAND[card.profile.sizeBand] || 7500;
  }

  return {
    WEIGHTS: WEIGHTS, THRESHOLDS: THRESHOLDS, WEAK_SITUATIONS: WEAK_SITUATIONS, LISTEN_PRICE_BY_BAND: LISTEN_PRICE_BY_BAND,
    scorePair: scorePair, computeAll: computeAll, pairScore: pairScore, explain: explain, suggestListenPrice: suggestListenPrice
  };
});
