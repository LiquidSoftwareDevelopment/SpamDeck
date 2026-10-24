/* SpamDeck — the screens. Each view is a function of state that returns DOM. Re-rendered whole on every change. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, D = S.dom, h = D.h, T = S.taxonomy, K = S.market, M = S.match, X = S.extract, A = S.actions, store = S.store, C = S.claude;
  var money = K.money;

  // ---------------- shared bits ----------------
  function card(st, id) { return st.market.cards[id]; }
  function cname(st, id) { var c = card(st, id); return c ? c.company.name : (st.market.contributors[id] ? st.market.contributors[id].name : id); }
  function contrib(st, id) { return st.market.contributors[id] || { name: id, label: id }; }
  function srcText(st, c) {
    var ids = T.uniq((c.sources || []).map(function (s) { return s.contributorId; }));
    if (ids.length > 1) return ids.length + ' inboxes';
    return 'from ' + contrib(st, ids[0]).label;
  }
  function readerKey(c) { return (c.readBy || '').split(':')[0]; }
  var READER_SHORT = { fixture: 'demo label', heuristic: 'simple reader', claude: 'live AI' };
  // The live reader also names its model on the card, so that fact is not only in a tooltip.
  function readerShort(c) { var k = readerKey(c); return (READER_SHORT[k] || c.readBy) + (k === 'claude' && c.readBy.split(':')[1] ? ' (' + c.readBy.split(':')[1] + ')' : ''); }
  // Role chips on a card: "founders", "CTOs", from the taxonomy's own plural table (plain r + 's' gave "opss").
  function roleChip(r) { return (T.ROLE_PLURAL && T.ROLE_PLURAL[r]) || r; }
  // When you play one company, everyone else's buttons are off. Say so on the page, not only in tooltips.
  function actorNote(st) {
    var a = st.app.actor;
    if (!st.market.companies[a]) return null;
    var n = cname(st, a);
    return h('div', { class: 'note', style: { marginBottom: '12px' } }, 'Playing as ', h('b', null, n), ': only ' + n + '’s buttons work. Pick “Everyone (demo mode)” in Playing as to press the rest.');
  }
  function notYou(st, id, what) { return 'Playing as ' + cname(st, st.app.actor) + '. Only ' + cname(st, id) + ' can ' + what + '.'; }
  function readerPill(c) {
    var k = readerKey(c);
    if (k === 'claude') return h('span', { class: 'pill live', title: c.readBy }, 'live AI');
    if (k === 'heuristic') return h('span', { class: 'pill' }, 'simple reader');
    return h('span', { class: 'pill' }, 'demo label');
  }
  function statusPill(st, id) {
    var c = card(st, id), rec = st.market.companies[id];
    if (!c) return null;
    if (T.isBinned(c)) return h('span', { class: 'pill binned' }, 'binned');
    var s = rec ? rec.status : 'dealt';
    return h('span', { class: 'pill ' + s }, s === 'opted_in' ? 'joined' : s);
  }
  function errorNote(st) { return st.app.lastError ? h('div', { class: 'note err', role: 'alert', style: { marginBottom: '12px' } }, st.app.lastError) : null; }
  function head(title, lead, right) {
    return h('div', { class: 'view-head' }, h('div', null, h('h2', null, title), lead ? h('p', null, lead) : null), right ? h('div', { class: 'row' }, right) : null);
  }
  function emptyBox(text, btn) { return h('div', { class: 'empty' }, h('p', null, text), btn || null); }
  function industry(c) { return T.INDUSTRY_LABEL[c.profile.industry] || c.profile.industry; }
  function dollars(cents) { return (cents / 100).toFixed(2).replace(/\.00$/, ''); }
  function toCents(v) {
    var s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    var n = s === '' ? NaN : Number(s);
    if (!isFinite(n) || n < 0) throw new Error('Enter a dollar amount, zero or more.');
    return Math.round(n * 100);
  }
  function excerpt(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }

  // ---------------- welcome ----------------
  function welcome(st) {
    return h('section', { class: 'welcome' },
      h('div', { class: 'welcome-row' }, h('h2', null, 'Charge spammers to pitch each other.'), D.svgUse('sd-burst', 120, 120, 'burst', { label: 'They pay' })),
      h('p', { class: 'lead' }, 'A sales pitch you never wanted may contain a business connection someone else values. SpamDeck reads your unsolicited pitches, finds the companies that want to reach each other, and lets them pay for the introduction with everyone’s consent. You, the inbox, get a cut.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn primary', onclick: function () { A.welcomed(); S.tour.start(); } }, 'Play the story (2 minutes)'),
        h('button', { class: 'btn', onclick: function () { A.welcomed(); } }, 'Let me click around')),
      h('p', { class: 'small muted', style: { marginTop: '14px' } }, 'Every company is fictional. Every payment is simulated. ', h('a', { href: '#reality' }, 'What is real.'))
    );
  }

  // ---------------- inbox ----------------
  function inbox(st) {
    var emails = st.emails, dealt = st.app.dealt;
    var undealt = emails.filter(function (e) { return !dealt[e.id]; });
    var selId = st.app.selectedEmail && emails.some(function (e) { return e.id === st.app.selectedEmail; }) ? st.app.selectedEmail : (undealt[0] || emails[0] || {}).id;
    var sel = emails.filter(function (e) { return e.id === selId; })[0];

    var readerChips = h('div', { class: 'row', role: 'group', 'aria-label': 'Reader' },
      h('span', { class: 'small muted' }, 'Reader:'),
      h('button', { class: 'chip' + (st.app.reader === 'fixture' ? ' on' : ''), 'data-fk': 'reader:fixture', 'aria-pressed': st.app.reader === 'fixture' ? 'true' : 'false', onclick: function () { A.setReader('fixture'); }, title: 'Hand-labelled cards for the demo emails; pasted emails use the simple reader' }, 'demo labels'),
      h('button', { class: 'chip' + (st.app.reader === 'heuristic' ? ' on' : ''), 'data-fk': 'reader:heuristic', 'aria-pressed': st.app.reader === 'heuristic' ? 'true' : 'false', onclick: function () { A.setReader('heuristic'); }, title: 'Offline keyword rules. Crude on purpose.' }, 'simple reader'),
      h('button', { class: 'chip' + (C.isOn() ? ' on' : ''), 'aria-haspopup': 'dialog', onclick: function () { modals.key(); }, title: C.isOn() ? 'Live AI is on: use “Re-read with live AI” on any email.' : 'Add your Anthropic key to read pitches live' }, C.isOn() ? 'Live AI: on' : 'Live AI: off')
    );
    var right = [
      readerChips,
      h('button', { class: 'btn', 'aria-haspopup': 'dialog', onclick: function () { modals.paste(); } }, 'Paste a pitch'),
      undealt.length
        ? h('button', { class: 'btn primary', onclick: function () { A.dealAll(); A.tab('deck'); } }, 'Deal all ' + undealt.length)
        : h('button', { class: 'btn primary', disabled: true, title: 'Every email in the inbox is already on a card. Paste a pitch to deal a new one.' }, 'All dealt')
    ];

    var groups = S.demoInbox.CONTRIBUTORS.map(function (ct) {
      var list = emails.filter(function (e) { return e.contributorId === ct.id; });
      if (!list.length) return null;
      return [
        h('div', { class: 'mail-group' }, h('span', null, ct.label), h('span', null, list.filter(function (e) { return !dealt[e.id]; }).length + ' to deal')),
        list.map(function (e) {
          var c = dealt[e.id] ? card(st, dealt[e.id]) : null;
          var pill = st.app.reading[e.id] ? h('span', { class: 'reading-anim' }, 'Reading...') : (c ? (T.isBinned(c) ? h('span', { class: 'pill binned' }, 'binned') : statusPill(st, c.id)) : h('span', { class: 'pill unread' }, 'new'));
          return h('button', { class: 'mail' + (e.id === selId ? ' active' : '') + (c && T.isBinned(c) ? ' binned' : ''), 'data-fk': 'mail:' + e.id, 'aria-label': 'From ' + (e.from.name || e.from.email) + ': ' + e.subject, 'aria-pressed': e.id === selId ? 'true' : 'false', onclick: function () { A.select(e.id); showReading(); } },
            h('span', { class: 'from' }, e.from.name || e.from.email), h('span', { class: 'meta' }, D.fmtDate(e.receivedAt), ' ', pill),
            h('span', { class: 'subj' }, e.subject));
        })
      ];
    });

    var pane = sel ? readingPane(st, sel) : emptyBox('No emails. Paste one.');
    return h('section', null, head('Inbox', 'Unsolicited pitches, as they arrived, from three pooled inboxes. Nobody asked for any of them.', right), errorNote(st),
      h('div', { class: 'inbox' }, h('div', { class: 'mail-list' }, groups), pane));
  }
  // On a narrow screen the email opens below the whole list; bring it into view after a tap.
  function showReading() {
    if (!root.matchMedia || !root.matchMedia('(max-width: 900px)').matches) return;
    var r = document.querySelector('#view .reading');
    if (r && r.scrollIntoView) r.scrollIntoView({ block: 'start' });
  }

  function readingPane(st, e) {
    var c = st.app.dealt[e.id] ? card(st, st.app.dealt[e.id]) : null;
    var reading = !!st.app.reading[e.id];
    var actions = [];
    if (reading) actions.push(h('span', { class: 'reading-anim' }, 'The Dealer is reading...'));
    else if (!c) {
      actions.push(h('button', { class: 'btn primary', onclick: function () { A.dealEmail(e.id); } }, 'Deal this'));
      if (C.isOn()) actions.push(h('button', { class: 'btn', onclick: function () { S.main.readLive(e.id); } }, 'Read with live AI'));
    } else {
      actions.push(h('button', { class: 'btn', onclick: function () { A.tab('deck'); } }, 'See the card'));
      actions.push(h('button', { class: 'btn ghost small', onclick: function () { S.main.reRead(e.id, 'heuristic'); } }, 'Re-read with the simple reader'));
      if (!e.pasted) actions.push(h('button', { class: 'btn ghost small', onclick: function () { S.main.reRead(e.id, 'fixture'); } }, 'Re-read with the demo label'));
      actions.push(h('button', { class: 'btn ghost small', disabled: !C.isOn(), title: C.isOn() ? '' : 'Live AI is off. Add your Anthropic key with the Live AI button at the top first.', onclick: function () { S.main.readLive(e.id); } }, 'Re-read with live AI'));
    }
    var ct = contrib(st, e.contributorId);
    return h('div', { class: 'reading' },
      h('div', { class: 'hdr' },
        h('span', null, 'From'), h('b', null, (e.from.name ? e.from.name + ' ' : '') + '<' + e.from.email + '>'),
        h('span', null, 'To'), h('b', null, ct.label),
        h('span', null, 'Date'), h('b', null, e.receivedAt),
        h('span', null, 'Subject'), h('b', null, e.subject)),
      h('pre', null, e.body),
      h('div', { class: 'actions' }, actions),
      c ? h('div', { class: 'result' }, h('div', { class: 'row between' }, h('h4', null, 'The Dealer’s card'), readerPill(c)), cardFront(st, c, { compact: true })) : null
    );
  }

  // ---------------- deck ----------------
  function cardFront(st, c, opts) {
    opts = opts || {};
    var binned = T.isBinned(c);
    var sizeText = c.profile.size + ' people';
    var kids = [
      h('div', { class: 'hdr' }, D.monogram(c.company.name), h('div', null, h('h4', null, c.company.name), h('div', { class: 'sub' }, binned ? ('binned: ' + (c.binReason || 'not a pitch')) : industry(c) + ' · ' + sizeText + ' · ' + srcText(st, c))),
        binned ? null : h('div', { class: 'suit' }, (c.sells.category || '').replace(/-/g, ' '))),
      // The Dealer's one-line note sits under the header on the front; the vocabulary (industries, sizes, roles) is on the back.
      c.dealerNote ? h('div', { class: 'dealer-note' }, c.dealerNote) : null,
      h('div', { class: 'line' }, h('b', null, 'Sells'), c.sells.summary),
      binned ? null : h('div', { class: 'line' }, h('b', null, 'Wants to reach'), c.targets.summary || '—'),
      h('div', { class: 'conf', 'aria-hidden': 'true' }, h('i', { style: { width: Math.round(c.confidence * 100) + '%' } })),
      h('div', { class: 'foot' }, h('span', null, Math.round(c.confidence * 100) + '% sure · ' + readerShort(c)),
        opts.compact ? statusPill(st, c.id) : h('span', { class: 'row' }, statusPill(st, c.id), h('button', { class: 'btn ghost', 'data-fk': 'flip:' + c.id, 'aria-label': 'Flip the ' + c.company.name + ' card to its original email', onclick: function () { A.toggleFlip(c.id); } }, 'Flip')))
    ];
    // The face turned away is inert: its buttons are not tab stops and screen readers skip it.
    return h('div', { class: 'card-face front' + (opts.compact ? ' compact' : ''), inert: !!opts.hidden, 'aria-hidden': opts.hidden ? 'true' : null, style: opts.compact ? { position: 'relative', height: 'auto', minHeight: '0' } : null }, kids);
  }

  function cardBack(st, c, hidden) {
    var src = c.sources[0] || {};
    var email = A.emailById(src.emailId);
    return h('div', { class: 'card-face back', inert: !!hidden, 'aria-hidden': hidden ? 'true' : null },
      h('div', { class: 'row between' }, h('h4', null, c.company.name), readerPill(c)),
      T.isBinned(c) ? h('div', { class: 'dealer-note' }, c.dealerNote || '—') : h('div', { class: 'chips' },
        c.targets.industries.map(function (i) { return h('span', null, T.INDUSTRY_LABEL[i] || i); }),
        c.targets.sizeBands.map(function (b) { return h('span', null, b + ' staff'); }),
        c.targets.roles.slice(0, 3).map(function (r) { return h('span', null, roleChip(r)); })),
      h('div', { class: 'line' }, h('b', null, (c.sources.length > 1 ? c.sources.length + ' emails · showing the first' : 'The original email') + (email ? ' · ' + email.subject : ''))),
      h('div', { class: 'back-body' }, email ? email.body : '(email not found)'),
      h('div', { class: 'foot' }, h('span', null, 'contact hidden until both sides agree'), h('button', { class: 'btn ghost', 'data-fk': 'flip:' + c.id, onclick: function () { A.toggleFlip(c.id); } }, 'Flip back'))
    );
  }

  function deck(st) {
    var all = Object.keys(st.market.cards).map(function (id) { return st.market.cards[id]; });
    var f = st.app.deckFilter;
    var shown = all.filter(function (c) {
      if (f === 'live') return !T.isBinned(c);
      if (f === 'binned') return T.isBinned(c);
      if (f === 'joined') return st.market.companies[c.id] && st.market.companies[c.id].status === 'opted_in';
      if (f.indexOf('inbox:') === 0) return c.sources.some(function (s) { return s.contributorId === f.slice(6); });
      return true;
    });
    var m = st.market.matches || { mutual: [], live: 0 };
    var cross = m.mutual.filter(function (p) { var a = card(st, p.a), b = card(st, p.b); return a && b && a.sources[0].contributorId !== b.sources[0].contributorId; }).length;
    var chip = function (key, label) { return h('button', { class: 'chip' + (f === key ? ' on' : ''), 'data-fk': 'deckf:' + key, 'aria-pressed': f === key ? 'true' : 'false', onclick: function () { A.setDeckFilter(key); } }, label); };
    var joinedN = all.filter(function (c) { return st.market.companies[c.id] && st.market.companies[c.id].status === 'opted_in'; }).length;
    var fromInbox = function (id) { return all.filter(function (c) { return c.sources.some(function (s) { return s.contributorId === id; }); }).length; };
    var filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Show cards' },
      chip('all', 'All ' + all.length), chip('live', 'Live ' + all.filter(function (c) { return !T.isBinned(c); }).length), chip('binned', 'Binned ' + all.filter(T.isBinned).length), chip('joined', 'Joined ' + joinedN),
      S.demoInbox.CONTRIBUTORS.map(function (ct) { return chip('inbox:' + ct.id, ct.label + ' ' + fromInbox(ct.id)); }),
      h('span', { class: 'small muted', style: { marginLeft: 'auto' } }, all.length ? (Object.keys(st.market.contributors).length + ' inboxes · ' + m.live + ' companies · ' + m.mutual.length + ' mutual matches · ' + cross + ' across inboxes') : '')
    );
    if (!all.length) return h('section', null, head('The deck', 'One card per company. Nothing dealt yet.'), emptyBox('The deck is empty. Deal the inbox first.', h('button', { class: 'btn primary', style: { marginTop: '10px' }, onclick: function () { A.dealAll(); } }, 'Deal all')));
    return h('section', null,
      head('The deck', 'One card per company: what they sell, who they want. The Dealer wrote the notes. Flip a card for the original email.'),
      errorNote(st), filters,
      h('div', { class: 'deck-grid' }, shown.map(function (c) {
        var flipped = !!st.app.flipped[c.id];
        return h('div', { class: 'card' + (flipped ? ' flipped' : '') + (T.isBinned(c) ? ' binned' : '') + (st.app.justDealt === c.id ? ' dealing' : ''), id: 'card-' + c.id },
          h('div', { class: 'card-inner' }, cardFront(st, c, { hidden: flipped }), cardBack(st, c, !flipped)));
      }))
    );
  }

  // ---------------- matches ----------------
  function who(st, id) {
    var c = card(st, id);
    return h('div', { class: 'who' }, D.monogram(c.company.name), h('div', { style: { minWidth: 0 } }, h('div', { class: 'nm' }, c.company.name), h('div', { class: 'src' }, excerpt(c.sells.summary, 44) + ' · ' + srcText(st, c))));
  }
  function reasonList(title, p) {
    return h('div', null, h('b', null, title), h('ul', null, p.reasons.map(function (r) { return h('li', { class: r.points < 0 ? 'neg' : '' }, r.text + ' (' + (r.points > 0 ? '+' : '') + r.points + ')'); })));
  }
  // The reason worth the most points, shown on the row; "Why" still opens every reason.
  function topReason(st, id, p) {
    var best = (p && p.reasons || []).slice().sort(function (x, y) { return y.points - x.points; })[0];
    return best ? h('div', { class: 'top-reason' }, cname(st, id) + ': ' + best.text) : null;
  }
  function pitchButton(st, fromId, toId) {
    var notJoined = [fromId, toId].filter(function (id) { return !(st.market.companies[id] && st.market.companies[id].status === 'opted_in'); }).map(function (id) { return cname(st, id); });
    var why = notJoined.length ? 'Both must join first: ' + notJoined.join(' and ') + (notJoined.length > 1 ? ' have' : ' has') + ' not joined yet.' : (A.can(fromId) ? '' : notYou(st, fromId, 'send this pitch'));
    return h('button', { class: 'btn small', 'aria-haspopup': 'dialog', disabled: !!why, title: why || ('Propose a pitch from ' + cname(st, fromId) + ' to ' + cname(st, toId)), onclick: function () { modals.propose(fromId, toId); } }, 'Pitch');
  }
  function matches(st) {
    var m = st.market.matches;
    if (!m || !m.live) return h('section', null, head('Matches', 'Who wants to pitch whom, scored both ways.'), emptyBox('No cards yet. Deal the inbox first.'));
    var f = st.app.matchFilter || 'hot';
    var mutualKeys = {};
    m.mutual.forEach(function (p) { mutualKeys[p.a + '>' + p.b] = true; mutualKeys[p.b + '>' + p.a] = true; });
    var oneWay = m.pairs.filter(function (p) { return !mutualKeys[p.from + '>' + p.to]; });
    var isCross = function (a, b) { return card(st, a).sources[0].contributorId !== card(st, b).sources[0].contributorId; };
    var chip = function (key, label) { return h('button', { class: 'chip' + (f === key ? ' on' : ''), 'data-fk': 'matchf:' + key, 'aria-pressed': f === key ? 'true' : 'false', onclick: function () { A.setMatchFilter(key); } }, label); };
    // Each chip counts the rows it shows (Hot = hot mutual pairs + hot one-way pairs, one row each).
    var hotN = m.mutual.filter(function (p) { return p.score >= M.THRESHOLDS.hot; }).length + oneWay.filter(function (p) { return p.tier === 'hot'; }).length;
    var filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Show matches' },
      chip('hot', 'Hot ' + hotN), chip('mutual', 'Want each other ' + m.mutual.length), chip('oneway', 'One-way ' + oneWay.length),
      chip('cross', 'Across inboxes ' + m.mutual.filter(function (p) { return isCross(p.a, p.b); }).length), chip('all', 'Everything ' + (m.mutual.length + oneWay.length)),
      h('span', { class: 'small muted', style: { marginLeft: 'auto' } }, 'match = ' + m.threshold + '+ of 100 · hot = ' + M.THRESHOLDS.hot + '+'));

    function mutualRow(p) {
      var key = p.a + '+' + p.b, open = st.app.openMatches[key];
      return h('div', { class: 'match' + (open ? ' open' : '') },
        who(st, p.a), h('div', { class: 'arrow mutual', role: 'img', 'aria-label': 'want each other' }, '⇄'), who(st, p.b),
        h('div', { class: 'score' }, h('div', { class: 'bar' + (p.score < M.THRESHOLDS.hot ? ' warm' : '') }, h('i', { style: { width: p.score + '%' } })), h('span', null, h('b', null, p.ab.score), ' → · ', h('b', null, p.ba.score), ' ← · ', h('span', { class: 'pill ' + (p.score >= M.THRESHOLDS.hot ? 'hot' : 'warm') }, p.score >= M.THRESHOLDS.hot ? 'hot' : 'warm')), topReason(st, p.a, p.ab), topReason(st, p.b, p.ba)),
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', 'data-fk': 'why:' + key, 'aria-expanded': open ? 'true' : 'false', onclick: function () { A.toggleMatch(key); } }, open ? 'Hide why' : 'Why'), pitchButton(st, p.a, p.b)),
        h('div', { class: 'reasons' }, reasonList(cname(st, p.a) + ' wants ' + cname(st, p.b) + ' because it', p.ab), reasonList(cname(st, p.b) + ' wants ' + cname(st, p.a) + ' because it', p.ba)));
    }
    function oneWayRow(p) {
      var key = p.from + '>' + p.to, open = st.app.openMatches[key];
      var back = m.byKey[p.to + '>' + p.from];
      return h('div', { class: 'match' + (open ? ' open' : '') },
        who(st, p.from), h('div', { class: 'arrow', role: 'img', 'aria-label': 'wants' }, '→'), who(st, p.to),
        h('div', { class: 'score' }, h('div', { class: 'bar' + (p.tier !== 'hot' ? ' warm' : '') }, h('i', { style: { width: p.score + '%' } })), h('span', null, h('b', null, p.score), '/100 · ', h('span', { class: 'pill ' + p.tier }, p.tier), back ? ' · back: ' + back.score : ''), topReason(st, p.from, p)),
        h('div', { class: 'row' }, h('button', { class: 'btn small ghost', 'data-fk': 'why:' + key, 'aria-expanded': open ? 'true' : 'false', onclick: function () { A.toggleMatch(key); } }, open ? 'Hide why' : 'Why'), pitchButton(st, p.from, p.to)),
        h('div', { class: 'reasons' }, reasonList(cname(st, p.from) + ' wants ' + cname(st, p.to) + ' because it', p), back ? reasonList(cname(st, p.to) + ' scores ' + cname(st, p.from) + ' only ' + back.score + ' because it', back) : null));
    }
    var body = [];
    if (f === 'mutual' || f === 'all' || f === 'cross' || f === 'hot') {
      var mm = m.mutual.filter(function (p) { return f !== 'cross' || isCross(p.a, p.b); }).filter(function (p) { return f !== 'hot' || p.score >= M.THRESHOLDS.hot; });
      body.push(h('div', { class: 'match-group' }, 'Want each other', h('span', { class: 'count' }, mm.length + ' pairs')));
      body.push(mm.length ? mm.map(mutualRow) : h('div', { class: 'note' }, 'None in this filter.'));
    }
    if (f === 'oneway' || f === 'all' || f === 'hot') {
      var ow = oneWay.filter(function (p) { return f !== 'hot' || p.tier === 'hot'; });
      body.push(h('div', { class: 'match-group' }, 'One-way', h('span', { class: 'count' }, ow.length + ' · the listener is wanted; whether it listens is up to it')));
      body.push(ow.map(oneWayRow));
    }
    return h('section', null, head('Matches', 'Every pair scored in both directions, every point explained. The Dealer never introduces rivals.'), errorNote(st), actorNote(st), filters, h('div', { class: 'match-list' }, body));
  }

  // ---------------- market ----------------
  function market(st) {
    var m = st.market, comps = m.companies;
    var ids = Object.keys(comps);
    if (!ids.length) return h('section', null, head('Market', 'Where consenting companies pay to pitch each other.'), emptyBox('No companies yet. Deal the inbox first.'));
    var by = function (s) { return ids.filter(function (id) { return comps[id].status === s; }); };
    var dealt = by('dealt'), invited = by('invited'), joined = by('opted_in'), declined = by('declined');
    var right = [
      dealt.length
        ? h('button', { class: 'btn', onclick: function () { A.invite(); A.tab('outbox'); } }, 'Invite ' + dealt.length + ' not yet invited')
        : h('button', { class: 'btn', disabled: true, title: 'Every company on a card has its letter. Nothing else goes out until one joins.' }, 'Everyone invited'),
      h('button', { class: 'btn primary', 'aria-haspopup': 'dialog', disabled: joined.length < 2, title: joined.length < 2 ? 'Two companies must join first (' + joined.length + ' joined so far)' : '', onclick: function () { modals.propose(); } }, 'Propose a pitch'),
      h('button', { class: 'btn', 'aria-haspopup': 'dialog', disabled: !joined.length, title: joined.length ? '' : 'A company must join first', onclick: function () { modals.openPitch(); } }, 'Post an open pitch')
    ];
    var sections = [];

    // Booths
    sections.push(h('div', { class: 'section' }, h('h3', null, 'Booths', h('span', { class: 'count' }, joined.length + ' joined')),
      joined.length ? h('div', { class: 'booths' }, joined.map(function (id) { return booth(st, id); }))
        : h('div', { class: 'note' }, h('p', null, 'Nobody has joined yet. Invite the companies and join as one of them, or let the Dealer run a sample deal.'),
          h('button', { class: 'btn primary', onclick: function () { A.sampleDeal(); } }, 'Run a sample deal'))));

    // Waiting
    var waiting = invited.concat(dealt);
    if (waiting.length) sections.push(h('div', { class: 'section' }, h('h3', null, 'Waiting', h('span', { class: 'count' }, invited.length + ' invited · ' + dealt.length + ' not yet invited')),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl stack' }, h('thead', null, h('tr', null, h('th', null, 'Company'), h('th', null, 'Status'), h('th', null, 'Matched'), h('th', null, 'Suggested price'), h('th', null, h('span', { class: 'sr' }, 'Actions')))),
        h('tbody', null, waiting.map(function (id) {
          var c = card(st, id), rec = comps[id], mc = K.matchCounts(m, id), mayAnswer = A.can(id);
          return h('tr', null, h('td', { 'data-label': 'Company' }, h('div', { class: 'who' }, D.monogram(c.company.name), h('div', null, h('div', { class: 'nm' }, c.company.name), h('div', { class: 'src' }, srcText(st, c))))),
            h('td', { 'data-label': 'Status' }, statusPill(st, id)), h('td', { 'data-label': 'Matched' }, mc.wants + ' it wants · ' + mc.wantedBy + ' want it · ' + mc.mutual + ' mutual'), h('td', { class: 'num', 'data-label': 'Price' }, money(rec.listenPriceCents) + ' / read'),
            h('td', { 'data-label': '' }, h('div', { class: 'actions' },
              rec.status === 'dealt' ? h('button', { class: 'btn small', title: 'Send ' + c.company.name + ' the letter', onclick: function () { A.invite([id]); } }, 'Invite') : null,
              rec.status === 'invited' ? h('button', { class: 'btn small primary', 'aria-haspopup': 'dialog', disabled: !mayAnswer, title: mayAnswer ? '' : notYou(st, id, 'answer its invitation'), onclick: function () { modals.optIn(id); } }, 'Join') : null,
              rec.status === 'invited' ? h('button', { class: 'btn small ghost', disabled: !mayAnswer, title: mayAnswer ? '' : notYou(st, id, 'answer its invitation'), onclick: function () { A.decline(id); } }, 'Decline') : null)));
        }))))));

    // Offers
    var offers = Object.keys(m.offers).map(function (id) { return m.offers[id]; }).reverse();
    var openN = offers.filter(function (o) { return ['proposed', 'accepted', 'paid'].indexOf(o.status) >= 0; }).length; // the Market tab's count
    sections.push(h('div', { class: 'section' }, h('h3', null, 'Pitches', h('span', { class: 'count' }, D.plural(offers.length, 'offer') + ' · ' + openN + ' open')),
      offers.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl stack' }, h('thead', null, h('tr', null, h('th', null, 'Pitcher'), h('th', null, 'Listener'), h('th', null, 'Kind'), h('th', null, 'Price'), h('th', null, 'Status'), h('th', null, 'Next'))),
        h('tbody', null, offers.map(function (o) { return offerRow(st, o); })))) : h('div', { class: 'note' }, 'No pitches yet. A pitch needs two joined companies and a match (or an open booth).')));

    // Open pitches
    var opens = Object.keys(m.openPitches).map(function (id) { return m.openPitches[id]; }).reverse();
    if (opens.length) sections.push(h('div', { class: 'section' }, h('h3', null, 'Open pitches', h('span', { class: 'count' }, 'listen to earn')), opens.map(function (p) { return openPitchBox(st, p); })));

    if (declined.length) sections.push(h('div', { class: 'section' }, h('h3', null, 'Declined', h('span', { class: 'count' }, declined.length)), h('div', { class: 'note' }, declined.map(function (id) { return cname(st, id); }).join(', ') + ' — card deleted in ' + m.config.cardTtlDays + ' days, nothing else happens.')));

    return h('section', null, head('Market', 'Only companies that said yes are here. Attention has a price. A pitch needs a match, or an open booth.', right), errorNote(st), actorNote(st), sections);
  }

  function booth(st, id) {
    var m = st.market, c = card(st, id), rec = m.companies[id], mc = K.matchCounts(m, id), sum = K.summary(m).companies[id] || { cash: 0, credits: 0, paid: 0 };
    var mine = st.app.actor === id;
    return h('div', { class: 'booth' + (mine ? ' mine' : '') },
      h('div', { class: 'hdr' }, D.monogram(c.company.name), h('div', null, h('div', null, h('b', null, c.company.name)), h('div', { class: 'small muted' }, srcText(st, c) + (rec.openBooth ? ' · booth open to anyone' : '')))),
      h('div', { class: 'price' }, money(rec.listenPriceCents), h('small', null, ' / read · ' + money(rec.listenPriceCents * m.config.meetingMultiplier) + ' / meeting')),
      h('div', { class: 'kv' },
        h('span', null, 'Earned'), h('b', null, money(sum.cash) + (rec.creditsCents ? ' + ' + money(rec.creditsCents) + ' credits' : '')),
        h('span', null, 'Paid'), h('b', null, money(sum.paid)),
        h('span', null, 'Payout'), h('b', null, rec.payout === 'credits' ? 'credits (+' + (m.config.creditBonusBp / 100) + '%)' : 'cash'),
        h('span', null, 'Matches'), h('b', null, mc.wants + ' it wants · ' + mc.wantedBy + ' want it')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn small primary', 'aria-haspopup': 'dialog', disabled: !A.can(id), title: A.can(id) ? '' : notYou(st, id, 'pitch from this booth'), onclick: function () { modals.propose(id); } }, 'Pitch someone'),
        h('button', { class: 'btn small', 'aria-haspopup': 'dialog', disabled: !A.can(id), title: A.can(id) ? '' : notYou(st, id, 'change its settings'), onclick: function () { modals.optIn(id, true); } }, 'Settings'),
        h('button', { class: 'btn small ghost', 'data-fk': 'booth:' + id, disabled: !A.can(id), title: A.can(id) ? (rec.openBooth ? 'Stop hearing unmatched companies' : 'Hear anyone at the listen price, matched or not') : notYou(st, id, 'change its booth'), onclick: function () { A.setOpenBooth(id, !rec.openBooth); } }, rec.openBooth ? 'Close booth' : 'Open booth')));
  }

  function offerRow(st, o) {
    var next = [];
    if (o.status === 'proposed') {
      next.push(h('button', { class: 'btn small primary', disabled: !A.can(o.to), title: A.can(o.to) ? '' : notYou(st, o.to, 'accept'), onclick: function () { A.acceptOffer(o.id); } }, 'Accept'));
      next.push(h('button', { class: 'btn small ghost', disabled: !A.can(o.to), title: A.can(o.to) ? '' : notYou(st, o.to, 'decline'), onclick: function () { A.declineOffer(o.id); } }, 'Decline'));
    } else if (o.status === 'accepted') {
      next.push(h('button', { class: 'btn small gold', 'aria-haspopup': 'dialog', disabled: !A.can(o.from), title: A.can(o.from) ? '' : notYou(st, o.from, 'pay'), onclick: function () { modals.checkout(o); } }, 'Pay ' + money(o.priceCents) + (o.kind === 'swap' ? ' + ' + money(o.backPriceCents) : '')));
    } else if (o.status === 'paid') {
      next.push(h('button', { class: 'btn small primary', 'aria-haspopup': 'dialog', disabled: !A.can(o.to), title: A.can(o.to) ? '' : notYou(st, o.to, 'confirm it'), onclick: function () { modals.respond(o); } }, o.kind === 'read' ? 'Answer the pitch' : 'It happened'));
      next.push(h('button', { class: 'btn small', disabled: !A.can(o.from), title: A.can(o.from) ? 'Return the money if the listener never answers' : 'Only the pitcher can ask for a refund', onclick: function () { A.refund(o.id); } }, 'No answer, refund'));
    } else if (o.status === 'refunded') {
      next.push(h('span', { class: 'small' }, 'refunded, money returned'));
    } else if (o.status === 'completed') {
      next.push(h('span', { class: 'small muted' }, o.response && o.response.answer !== 'done' ? 'answered “' + o.response.answer + '”' : 'done · money released'));
    } else if (o.status === 'declined') next.push(h('span', { class: 'small muted' }, 'declined, nothing moved'));
    return h('tr', null,
      h('td', { 'data-label': 'Pitcher' }, cname(st, o.from)), h('td', { 'data-label': 'Listener' }, cname(st, o.to)), h('td', { 'data-label': 'Kind' }, K.KINDS[o.kind].label),
      h('td', { class: 'num', 'data-label': 'Price' }, money(o.priceCents) + (o.kind === 'swap' ? ' ⇄ ' + money(o.backPriceCents) : '') + (o.payWith === 'credits' ? ' (credits)' : '')),
      h('td', { 'data-label': 'Status' }, h('span', { class: 'pill ' + o.status }, o.status)), h('td', { 'data-label': 'Next' }, h('div', { class: 'actions' }, next)));
  }

  function openPitchBox(st, p) {
    var m = st.market;
    var eligible = p.status === 'open' ? K.eligibleReaders(m, p.id) : [];
    return h('div', { class: 'booth', style: { marginBottom: '10px' } },
      h('div', { class: 'row between' }, h('div', null, h('b', null, cname(st, p.from)), ' pays ', h('b', null, money(p.pricePerReadCents)), ' per read · ', p.reads.length + ' of ' + p.maxReads + ' read', ' · match ' + p.minScore + '+'), h('span', { class: 'pill ' + (p.status === 'open' ? 'opted_in' : 'declined') }, p.status)),
      h('div', { class: 'small', style: { fontStyle: 'italic' } }, '“' + p.text + '”'),
      p.reads.length ? h('div', { class: 'small muted' }, 'Answers: ' + p.reads.map(function (r) { return cname(st, r.listenerId) + ' — ' + r.answer; }).join(' · ')) : null,
      p.status === 'open' ? h('div', { class: 'actions' },
        eligible.map(function (id) { return h('button', { class: 'btn small', disabled: !A.can(id), title: A.can(id) ? 'Read and answer as ' + cname(st, id) : 'Play as ' + cname(st, id) + ' to read it', onclick: function () { modals.readOpen(p, id); } }, 'Read as ' + cname(st, id)); }),
        eligible.length ? null : h('span', { class: 'small muted' }, 'no eligible readers left'),
        h('button', { class: 'btn small ghost', disabled: !A.can(p.from), title: A.can(p.from) ? 'Stop the pitch and return the unused budget' : notYou(st, p.from, 'close it'), onclick: function () { A.closeOpenPitch(p.id); } }, 'Close & refund')) : null);
  }

  // ---------------- ledger ----------------
  function ledger(st) {
    var m = st.market, s = K.summary(m), cfg = m.config.splitsBp;
    var tiles = h('div', { class: 'tiles' },
      S.demoInbox.CONTRIBUTORS.map(function (ct) {
        var label = ct.id === 'you' ? 'Your inbox earned (simulated)' : ct.label.charAt(0).toUpperCase() + ct.label.slice(1) + ' earned';
        return h('div', { class: 'tile' + (ct.id === 'you' ? ' you' : '') }, h('div', { class: 'n' }, money(s.contributors[ct.id] || 0)), h('div', { class: 'l' }, label));
      }),
      h('div', { class: 'tile' }, h('div', { class: 'n' }, money(s.platformCents)), h('div', { class: 'l' }, 'SpamDeck kept')),
      h('div', { class: 'tile' }, h('div', { class: 'n' }, money(s.volumeCents)), h('div', { class: 'l' }, 'Paid in, ' + s.completedPitches + ' pitches heard')),
      h('div', { class: 'tile' }, h('div', { class: 'n' }, money(s.escrowCents)), h('div', { class: 'l' }, 'Held until pitches are answered')),
      h('div', { class: 'tile' }, h('div', { class: 'n' }, money(s.creditsOutstandingCents)), h('div', { class: 'l' }, 'Credits outstanding')));

    var inputs = {};
    var fields = ['listener', 'listenerContributor', 'pitcherContributor', 'platform'];
    var labels = { listener: 'Listener', listenerContributor: 'Listener’s inbox', pitcherContributor: 'Pitcher’s inbox', platform: 'SpamDeck' };
    var sumEl = h('div', { class: 'sum' }, '= 100%');
    var whyEl = h('div', { class: 'small splits-why', role: 'status' });
    var applyBtn = h('button', { class: 'btn small', onclick: function () { var bp = readSplits(); if (bp) A.setSplits(bp); } }, 'Apply');
    // The four shares in basis points, or null (with the reason shown) when they cannot be applied.
    // Checked here so a bad sum keeps what you typed instead of bouncing off the engine and resetting the boxes.
    function readSplits() {
      var bp = {}, t = 0, bad = '';
      fields.forEach(function (f) {
        var v = String(inputs[f].value).trim(), n = Number(v);
        if (v === '' || !isFinite(n)) bad = bad || labels[f] + ' needs a number.';
        else if (n < 0) bad = bad || 'A share cannot be negative.';
        bp[f] = Math.round(n * 100); t += bp[f] || 0;
      });
      if (!bad && t !== 10000) bad = 'The four shares must add up to 100% (now ' + (t / 100) + '%).';
      sumEl.textContent = '= ' + (t / 100) + '%'; sumEl.className = 'sum' + (bad ? ' bad' : '');
      whyEl.textContent = bad; applyBtn.disabled = !!bad; applyBtn.title = bad;
      return bad ? null : bp;
    }
    function recompute() { readSplits(); }
    var rules = h('div', { class: 'section' }, h('h3', null, 'House rules', h('span', { class: 'count' }, 'who gets what from each paid pitch')),
      h('div', { class: 'splits' },
        fields.map(function (f) { inputs[f] = h('input', { type: 'number', min: 0, max: 100, step: 1, value: cfg[f] / 100, oninput: recompute }); return h('div', { class: 'field' }, h('label', null, labels[f] + ' %'), inputs[f]); }),
        h('div', { class: 'row' }, sumEl, applyBtn)),
      whyEl,
      h('p', { class: 'small muted', style: { marginTop: '8px' } }, 'Defaults are a first guess, not a measurement: the listener’s time is the scarce good (50%), the inbox that supplied the listener did the real work (20%), the inbox that supplied the pitcher found the buyer (10%), SpamDeck runs it (20%). A listener who takes credits instead of cash gets ' + (m.config.creditBonusBp / 100) + '% more; on a pitch paid with credits SpamDeck forgoes its cut, so the sweetener costs exactly the fee.'));

    var rows = m.ledger.slice().reverse();
    var partyName = function (e) { return e.party.kind === 'company' ? cname(st, e.party.id) : e.party.kind === 'contributor' ? contrib(st, e.party.id).name + ' (inbox)' : e.party.kind === 'platform' ? 'SpamDeck' : 'Escrow'; };
    var table = rows.length ? h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl ledger-tbl' }, h('thead', null, h('tr', null, h('th', null, 'When'), h('th', null, 'Who'), h('th', null, 'What'), h('th', { class: 'right' }, 'Amount'))),
      h('tbody', null, rows.map(function (e) {
        return h('tr', null, h('td', { class: 'small muted nowrap' }, D.fmtTime(e.at)), h('td', null, partyName(e)), h('td', null, e.memo, e.credits ? [' ', h('span', { class: 'pill' }, 'credits')] : null),
          h('td', { class: 'num ' + (e.amountCents < 0 ? 'neg' : 'pos') }, (e.amountCents > 0 ? '+' : '') + money(e.amountCents)));
      })))) : h('div', { class: 'note' }, 'Nothing yet. Money moves when a pitch is paid for and heard.');
    return h('section', null, head('Ledger', 'Every cent, simulated. The parts always add up to the whole; the platform absorbs the rounding.', h('span', { class: 'pill sim' }, 'no real money')), errorNote(st), tiles, rules,
      h('div', { class: 'section' }, h('h3', null, 'Entries', h('span', { class: 'count' }, rows.length)), table));
  }

  // ---------------- outbox ----------------
  // A letter that has just been opened (the story opens the invitation) is brought into view once: the ids open at the
  // last draw are remembered, so a re-render with the same letters open does not jump again.
  var lastScrolledMail = null, openAtLastDraw = {};
  function scrollMail(id) {
    setTimeout(function () { var el = document.getElementById('mailrow-' + id); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, 0);
  }
  function outbox(st) {
    var mails = st.market.outbox.slice().reverse();
    var f = st.app.mailFilter || 'all';
    var types = { all: 'All', invite: 'Invitations', request: 'Pitch requests', intro: 'Introductions', receipt: 'Receipts', statement: 'Statements' };
    var shown = mails.filter(function (x) { return f === 'all' || x.type === f; });
    var openNow = {};
    Object.keys(st.app.openMails).forEach(function (id) { if (st.app.openMails[id]) openNow[id] = true; });
    var filters = h('div', { class: 'filters' }, Object.keys(types).map(function (k) {
      var n = k === 'all' ? mails.length : mails.filter(function (x) { return x.type === k; }).length;
      return h('button', { class: 'chip' + (f === k ? ' on' : ''), 'data-fk': 'mailf:' + k, 'aria-pressed': f === k ? 'true' : 'false', onclick: function () { store.commit(function (s) { s.app.mailFilter = k; }); } }, types[k] + ' ' + n);
    }));
    var section = h('section', null, head('Outbox', 'Every email the Dealer would have sent. None were sent; this is where they land instead.', h('span', { class: 'pill sim' }, 'nothing sent')),
      filters,
      shown.length ? h('div', { class: 'mails' }, shown.map(function (x) {
        var open = !!st.app.openMails[x.id];
        if (open && !openAtLastDraw[x.id] && x.id !== lastScrolledMail) { lastScrolledMail = x.id; scrollMail(x.id); }
        return h('div', { class: 'mailrow' + (open ? ' open' : ''), id: 'mailrow-' + x.id },
          h('button', { id: 'mailbtn-' + x.id, 'data-fk': 'mailrow:' + x.id, 'aria-expanded': open ? 'true' : 'false', 'aria-label': x.type + ': ' + x.subject, onclick: function () { A.toggleMail(x.id); } }, h('span', { class: 'pill ' + (x.type === 'intro' ? 'paid' : x.type === 'statement' ? 'opted_in' : '') }, x.type), h('span', null, h('div', { class: 'subj' }, x.subject), h('div', { class: 'to' }, 'to ' + x.to.map(function (t) { return t.name + (t.email ? ' <' + t.email + '>' : ''); }).join(', '))), h('span', { class: 'small muted' }, D.fmtTime(x.at))),
          h('div', { class: 'body' }, x.body));
      })) : emptyBox(mails.length ? 'None of these yet.' : 'Nothing here yet. Invitations appear when you invite the deck.'));
    openAtLastDraw = openNow;
    return section;
  }

  // ---------------- reality ----------------
  function reality(st) {
    var rows = [
      ['Reading pitches (the AI)', 'Real when Live AI is on: your Anthropic key, your browser, straight to the API, with the prompt and schema shown below. Without a key: hand-labelled demo cards, plus an offline simple reader for anything you paste. Each card says which reader made it. The simple reader scored 22 of 22 company names and 22 of 22 product categories against the hand labels (measured 2026-10-24, tests/extract.test.js).'],
      ['Matching', 'Real. Deterministic code with every point explained (js/engine/match.js). The weights are a first guess, tuned by hand on this deck.'],
      ['Consent and the invitations', 'Real logic, fictional people. Nothing is sent; you play the companies from the menu at the top.'],
      ['Payments', 'Simulated. SpamPay is a fake checkout. No payment provider, no card, no money.'],
      ['The ledger and the splits', 'Real arithmetic on simulated payments. Conserved to the cent (tests/market.test.js).'],
      ['Credits', 'Real logic, simulated value.'],
      ['The pool (three inboxes)', 'Fictional. Every company, person and domain is invented (.example).'],
      ['Traction', 'None. No users, no revenue, no pilots. This is a competition entry.']
    ];
    function saveKey() { C.setKey(keyIn.value.trim()); C.setModel(modelSel.value); store.emit(); }
    var keyIn = h('input', { type: 'password', placeholder: 'sk-ant-…', value: C.getKey(), autocomplete: 'off', spellcheck: 'false', style: { width: '100%' }, onkeydown: function (ev) { if (ev.key === 'Enter') saveKey(); } });
    var modelSel = h('select', null, C.MODELS.map(function (mo) { return h('option', { value: mo.id, selected: mo.id === C.getModel() }, mo.label); }));
    var testOut = h('div', { class: 'small', role: 'status', style: { marginTop: '8px' } });
    var live = h('div', { class: 'section' }, h('h3', null, 'Live AI', h('span', { class: 'count' }, C.isOn() ? 'on' : 'off')),
      h('div', { class: 'two-col' },
        h('div', null,
          h('div', { class: 'field' }, h('label', null, 'Your Anthropic API key'), keyIn, h('span', { class: 'hint' }, 'Kept in this tab’s session storage only. Sent to api.anthropic.com and nowhere else; SpamDeck has no server.')),
          h('div', { class: 'field' }, h('label', null, 'Model'), modelSel),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onclick: saveKey }, 'Save'),
            h('button', { class: 'btn ghost', onclick: function () { C.setKey(''); keyIn.value = ''; store.emit(); } }, 'Forget key'),
            h('button', { class: 'btn', disabled: !C.isOn(), title: C.isOn() ? 'Reads one demo email live; nothing is dealt' : 'Save a key first', onclick: function () {
              var first = st.emails.filter(function (e) { return !e.pasted; })[0] || st.emails[0];
              testOut.textContent = 'Reading the first demo email live…';
              C.read(first).then(function (c) { testOut.textContent = 'OK: ' + c.company.name + ' — ' + c.sells.summary + ' (' + Math.round(c.confidence * 100) + '% sure' + (c.usage ? ', ' + c.usage.input + ' in / ' + c.usage.output + ' out tokens' : '') + '). Note: “' + c.dealerNote + '”'; })
                .catch(function (e) { testOut.textContent = 'Failed: ' + e.message; });
            } }, 'Test the key on one email')),
          testOut),
        h('div', null, h('div', { class: 'field' }, h('label', null, 'What the Dealer is told (system prompt)'), h('pre', { class: 'prompt' }, X.SYSTEM_PROMPT)),
          h('details', null, h('summary', { class: 'small muted' }, 'The JSON schema every card must fit'), h('pre', { class: 'prompt' }, JSON.stringify(X.SCHEMA, null, 2))))));
    var notBuilt = h('div', { class: 'section' }, h('div', { class: 'uc' }, h('span', null, 'UNDER CONSTRUCTION')), h('h3', null, 'What is not built'),
      h('ul', { class: 'small' },
        h('li', null, 'Real payments, payouts, escrow or refunds. SpamPay is a fake checkout.'),
        h('li', null, 'Real email: nothing is sent, nothing is received, no inbox is connected.'),
        h('li', null, 'Accounts, sign-in, or a second person. You play every company from one menu.'),
        h('li', null, 'A server of any kind. The page runs in your browser only.'),
        h('li', null, 'The 30-day card deletion and the 7-day response window as real timers.'),
        h('li', null, 'A learned matcher. The matcher is hand-weighted code.'),
        h('li', null, 'Live reading of a whole inbox at once. Live AI reads one email at a time.'),
        h('li', null, 'Rejoining after a decline.')));
    var weak = h('div', { class: 'section' }, h('h3', null, 'Honest weak spots'),
      h('ul', { class: 'small' },
        h('li', null, 'Will spammers pay? Reasoned, not measured: they already pay for leads and meetings (one of the cards in this deck sells exactly that). A consented, matched introduction is the thing they buy today, at a lower price than an agency.'),
        h('li', null, 'Will anyone listen for money? The listen price is set by the listener; if nobody accepts at $75, the market finds the price. Untested.'),
        h('li', null, 'Legal. The product never sells contact details: the card is a description, the contact is revealed only after both sides agree and the pitcher pays, and the invitation replies to an email the company sent first. A real launch still needs counsel on CAN-SPAM, GDPR and consent records.'),
        h('li', null, 'Cold start. A thin pool has few matches. The viral loop (every invited company receives spam too) and listen-to-earn are the answer on paper; neither is proven.'),
        h('li', null, 'The matcher is explainable, not learned. It will miss matches a human would see. Reading with live AI fixes half of that; the other half needs a feedback loop that does not exist yet.'),
        h('li', null, 'The joke can read as mean. The invitation is written to be read by the person it names. Keep it that way.')));
    return h('section', { class: 'reality' }, head('What is real', 'Judges deserve a straight answer. Here it is.'),
      h('div', { class: 'tbl-wrap', style: { marginBottom: '22px' } }, h('table', { class: 'tbl' }, h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', null, r[0]), h('td', null, r[1])); })))),
      live, notBuilt, weak);
  }

  // ---------------- modals ----------------
  // One dialog at a time. Focus moves in and Tab stays in; Escape, Cancel or a click on the backdrop closes it, and focus
  // goes back to the button that opened it. Errors (from the engine, or a number that is not a number) show inside the
  // dialog: before this, they landed on the page behind the backdrop, or were thrown and vanished.
  var modalRoot = function () { return document.getElementById('modal-root'); };
  var current = null, dlgSeq = 0;
  function focusables(scope) {
    return Array.prototype.filter.call(scope.querySelectorAll('button, input, select, textarea, a[href], summary'), function (el) { return !el.disabled && el.offsetParent !== null; });
  }
  function restoreFocus(o) {
    if (!o) return;
    var el = o.el && o.el.isConnected ? o.el : null;
    if (!el && o.fk) el = document.querySelector('[data-fk="' + o.fk + '"]');
    if (!el && o.text) el = Array.prototype.filter.call(document.querySelectorAll('#view button, #dealer button, .top button'), function (b) { return !b.disabled && b.textContent.trim() === o.text; })[0];
    if (el && el.focus) el.focus({ preventScroll: true });
  }
  function closeModal() {
    var was = current;
    current = null;
    D.clear(modalRoot());
    if (was) restoreFocus(was.opener);
  }
  // opts.enter: the button that Enter presses from a one-line field (only where that is the obvious action).
  function openModal(title, lead, body, actions, opts) {
    opts = opts || {};
    var mroot = modalRoot(), active = document.activeElement;
    var opener = current ? current.opener : (active && active !== document.body ? { el: active, fk: active.getAttribute && active.getAttribute('data-fk'), text: (active.textContent || '').trim() } : null);
    D.clear(mroot);
    var id = 'dlg-' + (++dlgSeq);
    var err = h('div', { class: 'note err', role: 'alert', hidden: true });
    var box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id },
      h('h3', { id: id }, title), lead ? h('p', { class: 'lead' }, lead) : null, body, err, h('div', { class: 'actions' }, actions));
    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Tab') {
        var f = focusables(box), i = f.indexOf(document.activeElement);
        if (!f.length) return;
        if (ev.shiftKey && i <= 0) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
      } else if (ev.key === 'Enter' && opts.enter && ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox' && !opts.enter.disabled) {
        ev.preventDefault(); opts.enter.click();
      }
    });
    var downOnBack = false; // a drag that starts in a field and ends on the backdrop must not close the dialog
    mroot.appendChild(h('div', { class: 'modal-back',
      onmousedown: function (ev) { downOnBack = ev.target === ev.currentTarget; },
      onclick: function (ev) { if (ev.target === ev.currentTarget && downOnBack) closeModal(); downOnBack = false; } }, box));
    D.linkLabels(box);
    current = { box: box, err: err, opener: opener };
    var first = box.querySelector('input:not([disabled]), textarea, select:not([disabled])') || focusables(box)[0];
    if (first) first.focus();
    return current;
  }
  function showModalError(msg) {
    if (!current) { store.commit(function (s) { s.app.lastError = msg; }); return; }
    current.err.textContent = msg;
    current.err.hidden = false;
    // The dialog shows the error; drop the copy the engine put on the page behind it.
    if (store.state.app.lastError) { store.state.app.lastError = null; store.save(); store.emit(); }
  }
  function tryClose(fn) {
    return function () {
      var r;
      try { r = fn(); } catch (e) { r = { error: e.message || String(e) }; }
      if (r && r.error) showModalError(r.error); else closeModal();
    };
  }
  var modals = {
    close: closeModal,
    paste: function () {
      var from = h('input', { placeholder: 'Jane Doe <jane@vendor.com>', value: '', autocomplete: 'off', spellcheck: 'false' });
      var subject = h('input', { placeholder: 'Quick question', value: '' });
      var body = h('textarea', { placeholder: 'Paste the pitch here…' });
      function add(deal) {
        var r = A.pasteEmail({ from: from.value, subject: subject.value, body: body.value });
        if (r && r.error) { showModalError(r.error); return; }
        closeModal();
        if (deal) { if (C.isOn()) S.main.readLive(r.id); else A.dealEmail(r.id, 'heuristic'); }
      }
      var dealBtn = h('button', { class: 'btn primary', onclick: function () { add(true); } }, C.isOn() ? 'Add and read with live AI' : 'Add and deal');
      openModal('Paste a pitch', 'Any cold email you have received. The Dealer names the company from the sender’s domain.',
        h('div', null, h('div', { class: 'field' }, h('label', null, 'From'), from, h('span', { class: 'hint' }, 'Name and address, or just the address.')), h('div', { class: 'field' }, h('label', null, 'Subject'), subject), h('div', { class: 'field' }, h('label', null, 'Body'), body)),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn', onclick: function () { add(false); } }, 'Add to inbox'), dealBtn], { enter: dealBtn });
    },
    optIn: function (id, edit) {
      var st = store.state, m = st.market, rec = m.companies[id], c = card(st, id), mc = K.matchCounts(m, id);
      var price = h('input', { type: 'number', min: 0, step: 5, value: dollars(rec.listenPriceCents) });
      var payout = h('select', null, h('option', { value: 'cash', selected: rec.payout === 'cash' }, 'Cash'), h('option', { value: 'credits', selected: rec.payout === 'credits' }, 'Pitching credits (+' + (m.config.creditBonusBp / 100) + '%)'));
      var open = h('input', { type: 'checkbox', checked: rec.openBooth });
      openModal((edit ? 'Settings: ' : 'Join as ') + c.company.name, edit ? null : mc.wantedBy + ' companies want to pitch you; you want ' + mc.wants + ' of them; ' + mc.mutual + ' both ways. Set a price for your attention.',
        h('div', null,
          h('div', { class: 'field' }, h('label', null, 'Listen price ($ per read; a meeting is ' + m.config.meetingMultiplier + '×)'), price, h('span', { class: 'hint' }, 'Suggested for a company of ' + c.profile.size + ': ' + money(M.suggestListenPrice(c)))),
          h('div', { class: 'field' }, h('label', null, 'Take payouts as'), payout),
          h('div', { class: 'field' }, h('label', { class: 'row' }, open, ' Open booth: hear anyone at the listen price, matched or not'))),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: tryClose(function () {
          var cents = toCents(price.value);
          if (edit) { var r1 = A.setListenPrice(id, cents); if (r1 && r1.error) return r1; A.setPayout(id, payout.value); A.setOpenBooth(id, open.checked); return {}; }
          return A.optIn(id, { listenPriceCents: cents, payout: payout.value, openBooth: open.checked });
        }) }, edit ? 'Save' : 'Join')]);
    },
    propose: function (fromId, toId) {
      var st = store.state, m = st.market;
      var joined = Object.keys(m.companies).filter(function (id) { return m.companies[id].status === 'opted_in'; });
      var froms = st.app.actor === 'everyone' ? joined : joined.filter(function (id) { return A.can(id); });
      if (!froms.length) { store.commit(function (s) { s.app.lastError = 'You are not playing a joined company. Pick one from the menu at the top, or play as everyone.'; }); return; }
      var from = h('select', null, froms.map(function (id) { return h('option', { value: id, selected: id === (fromId || froms[0]) }, cname(st, id)); }));
      var to = h('select');
      var kind = h('select', null, Object.keys(K.KINDS).map(function (k) { return h('option', { value: k }, K.KINDS[k].label + ' — ' + K.KINDS[k].blurb); }));
      var price = h('input', { type: 'number', min: 0, step: 5 });
      var payWith = h('select', null, h('option', { value: 'cash' }, 'Cash (simulated card)'), h('option', { value: 'credits' }, 'Credits'));
      var pitch = h('textarea', { style: { minHeight: '90px' } });
      var why = h('div', { class: 'hint' });
      function refreshTo() {
        var f = from.value;
        D.clear(to);
        joined.filter(function (id) { return id !== f; }).forEach(function (id) {
          var gate = K.canPitch(m, f, id);
          to.appendChild(h('option', { value: id, selected: id === toId, disabled: !gate.ok }, cname(st, id) + ' — ' + (gate.ok ? gate.why : gate.why.split('.')[0])));
        });
        refreshPrice();
      }
      function refreshPrice() {
        var f = from.value, t = to.value;
        if (!t) { why.textContent = 'No joined company can be pitched by ' + cname(st, f) + ' yet.'; return; }
        var floor = K.priceFloor(m, f, t, kind.value);
        price.value = dollars(floor);
        var credits = m.companies[f].creditsCents;
        why.textContent = cname(st, t) + ' charges at least ' + money(floor) + ' for a ' + kind.value + '. ' + cname(st, f) + ' has ' + money(credits) + ' in credits.';
        pitch.value = '';
      }
      from.onchange = refreshTo; to.onchange = refreshPrice; kind.onchange = refreshPrice;
      refreshTo();
      openModal('Propose a pitch', 'The listener gets an email with your one-paragraph pitch and the price. Nothing is charged until they accept.',
        h('div', null,
          h('div', { class: 'field' }, h('label', null, 'Pitcher'), from), h('div', { class: 'field' }, h('label', null, 'Listener (joined companies; greyed = no match and no open booth)'), to),
          h('div', { class: 'field' }, h('label', null, 'Kind'), kind), h('div', { class: 'field' }, h('label', null, 'Offer ($)'), price, why),
          h('div', { class: 'field' }, h('label', null, 'Pay with'), payWith), h('div', { class: 'field' }, h('label', null, 'Your pitch (leave blank for the Dealer’s draft)'), pitch)),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn primary', onclick: tryClose(function () {
          if (!to.value) return { error: 'Pick a listener.' };
          return A.propose({ from: from.value, to: to.value, kind: kind.value, priceCents: toCents(price.value), payWith: payWith.value, pitch: pitch.value.trim() || undefined });
        }) }, 'Send the offer')]);
    },
    checkout: function (o) {
      var st = store.state;
      var total = o.priceCents + (o.kind === 'swap' ? o.backPriceCents : 0);
      openModal('SpamPay — a fake checkout', 'This is where a payment provider would go. There is none. Nothing is charged, ever.',
        h('div', null, h('div', { class: 'checkout' }, h('div', { class: 'amt' }, money(o.priceCents)), h('div', { class: 'small' }, cname(st, o.from) + ' pays to pitch ' + cname(st, o.to) + ' (' + K.KINDS[o.kind].label.toLowerCase() + ')' + (o.kind === 'swap' ? ' · ' + cname(st, o.to) + ' pays ' + money(o.backPriceCents) + ' back' : '')),
          o.payWith === 'credits' ? h('div', { class: 'small', style: { marginTop: '6px' } }, 'Paid from credits: ' + money(st.market.companies[o.from].creditsCents) + ' available.') : h('div', { class: 'cardno', style: { marginTop: '8px' } }, '4242 4242 4242 4242 · 12/34 · 123 (test)')),
          h('p', { class: 'small muted' }, 'Held by SpamDeck until ' + cname(st, o.to) + ' confirms the pitch happened. Refunded if nothing happens in ' + st.market.config.responseDays + ' days.')),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn gold', onclick: tryClose(function () { return A.pay(o.id); }) }, 'Pay ' + money(total) + ' (simulated)')]);
    },
    respond: function (o) {
      var st = store.state;
      var note = h('input', { placeholder: 'optional note to the pitcher' });
      var body = h('div', null, h('p', null, h('b', null, cname(st, o.from) + '’s pitch: '), '“' + o.pitch + '”'), h('div', { class: 'field' }, h('label', null, 'Note'), note));
      var acts = o.kind === 'read'
        ? [['interested', 'Interested', 'primary'], ['not now', 'Not now', ''], ['no', 'No', 'ghost']].map(function (a) { return h('button', { class: 'btn ' + a[2], onclick: tryClose(function () { return A.complete(o.id, { answer: a[0], note: note.value }); }) }, a[1]); })
        : [h('button', { class: 'btn primary', onclick: tryClose(function () { return A.complete(o.id, { answer: 'done', note: note.value }); }) }, 'It happened — release the money')];
      openModal(o.kind === 'read' ? 'Answer the pitch' : 'Confirm the ' + o.kind, 'Answering releases ' + money(o.priceCents) + (o.kind === 'swap' ? ' and ' + money(o.backPriceCents) : '') + ' from escrow and pays everyone their share.', body, [h('button', { class: 'btn ghost', onclick: closeModal }, 'Later')].concat(acts));
    },
    openPitch: function (fromId) {
      var st = store.state, m = st.market;
      var joined = Object.keys(m.companies).filter(function (id) { return m.companies[id].status === 'opted_in' && A.can(id); });
      if (!joined.length) { store.commit(function (s) { s.app.lastError = 'Play as a joined company (or as everyone) to post an open pitch.'; }); return; }
      var from = h('select', null, joined.map(function (id) { return h('option', { value: id, selected: id === fromId }, cname(st, id)); }));
      var price = h('input', { type: 'number', min: 1, step: 5, value: 20 });
      var max = h('input', { type: 'number', min: 1, step: 1, value: 5 });
      var minScore = h('input', { type: 'number', min: 0, max: 100, step: 5, value: m.config.matchThreshold });
      var text = h('textarea', { style: { minHeight: '90px' }, placeholder: 'Leave blank for the Dealer’s draft' });
      openModal('Post an open pitch', 'Pay per read. Any matched company can read it, must answer, and keeps the listener’s share — in cash or credits. The budget is charged now (simulated) and the unused part refunded when you close it.',
        h('div', null, h('div', { class: 'field' }, h('label', null, 'Pitcher'), from), h('div', { class: 'row' }, h('div', { class: 'field grow' }, h('label', null, '$ per read'), price), h('div', { class: 'field grow' }, h('label', null, 'Max readers'), max), h('div', { class: 'field grow' }, h('label', null, 'Min match score'), minScore)), h('div', { class: 'field' }, h('label', null, 'Pitch'), text)),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), h('button', { class: 'btn gold', onclick: tryClose(function () { return A.postOpenPitch({ from: from.value, pricePerReadCents: toCents(price.value), maxReads: Number(max.value), minScore: Number(minScore.value), text: text.value.trim() || undefined }); }) }, 'Pay the budget (simulated) and post')]);
    },
    readOpen: function (p, listenerId) {
      var st = store.state, m = st.market;
      var share = Math.round(p.pricePerReadCents * m.config.splitsBp.listener / 10000);
      var note = h('input', { placeholder: 'optional note' });
      openModal('Read as ' + cname(st, listenerId), cname(st, p.from) + ' pays ' + money(p.pricePerReadCents) + ' for your answer. Your share: ' + money(share) + (m.companies[listenerId].payout === 'credits' ? ' as ' + money(Math.round(share * (10000 + m.config.creditBonusBp) / 10000)) + ' in credits' : ' in cash') + '.',
        h('div', null, h('p', { style: { fontStyle: 'italic' } }, '“' + p.text + '”'), h('div', { class: 'field' }, h('label', null, 'Note'), note)),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Later')].concat([['interested', 'Interested', 'primary'], ['not now', 'Not now', ''], ['no', 'No', 'ghost']].map(function (a) { return h('button', { class: 'btn ' + a[2], onclick: tryClose(function () { return A.readOpenPitch({ pitchId: p.id, listenerId: listenerId, answer: a[0], note: note.value }); }) }, a[1]); })));
    },
    key: function () {
      var keyIn = h('input', { type: 'password', placeholder: 'sk-ant-…', value: C.getKey(), autocomplete: 'off' });
      var modelSel = h('select', null, C.MODELS.map(function (mo) { return h('option', { value: mo.id, selected: mo.id === C.getModel() }, mo.label); }));
      openModal('Live AI (bring your own key)', 'With a key, the Dealer reads pitches live: your browser calls api.anthropic.com directly. SpamDeck has no server; the key is kept in this tab only and never leaves your machine except to Anthropic.',
        h('div', null, h('div', { class: 'field' }, h('label', null, 'Anthropic API key'), keyIn), h('div', { class: 'field' }, h('label', null, 'Model'), modelSel), h('p', { class: 'small muted' }, 'Each read costs a fraction of a cent to a few cents depending on the model. The exact prompt and JSON schema are on the “What is real” tab.')),
        [h('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel'), C.isOn() ? h('button', { class: 'btn ghost', onclick: function () { C.setKey(''); closeModal(); store.emit(); } }, 'Turn off') : null, h('button', { class: 'btn primary', onclick: function () { C.setKey(keyIn.value.trim()); C.setModel(modelSel.value); closeModal(); store.emit(); } }, 'Save')]);
    }
  };

  S.views = { welcome: welcome, inbox: inbox, deck: deck, matches: matches, market: market, ledger: ledger, outbox: outbox, reality: reality, modals: modals, cname: cname };
})(window);
