/* SpamDeck — wiring: tabs, stats strip, the Dealer bar, the actor menu, live reading, boot. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, D = S.dom, h = D.h, store = S.store, A = S.actions, V = S.views, K = S.market, T = S.taxonomy, X = S.extract, C = S.claude;
  var TABS = [['inbox', 'Inbox'], ['deck', 'Deck'], ['matches', 'Matches'], ['market', 'Market'], ['ledger', 'Ledger'], ['outbox', 'Outbox'], ['reality', 'What is real']];

  function tabCounts(st) {
    var m = st.market, mm = m.matches || { mutual: [] };
    var open = Object.keys(m.offers).filter(function (id) { return ['proposed', 'accepted', 'paid'].indexOf(m.offers[id].status) >= 0; }).length;
    return { inbox: st.emails.filter(function (e) { return !st.app.dealt[e.id]; }).length, deck: Object.keys(m.cards).length, matches: mm.mutual.length, market: open, ledger: m.ledger.length, outbox: m.outbox.length, reality: 0 };
  }

  function renderTabs(st) {
    var el = D.clear(document.getElementById('tabs')), counts = tabCounts(st);
    el.appendChild(document.createTextNode('[ '));
    TABS.forEach(function (t, i) {
      if (i) el.appendChild(document.createTextNode(' | '));
      el.appendChild(h('a', { class: 'tab' + (st.app.tab === t[0] ? ' active' : ''), href: '#' + t[0], 'aria-current': st.app.tab === t[0] ? 'page' : null, onclick: function (ev) { ev.preventDefault(); A.tab(t[0]); } }, t[1], counts[t[0]] ? h('span', { class: 'count' }, counts[t[0]]) : null));
    });
    el.appendChild(document.createTextNode(' ]'));
  }

  function pad6(n) { return ('000000' + n).slice(-6); }
  function renderStats(st) {
    var el = D.clear(document.getElementById('stats')), m = st.market, s = K.summary(m), c = K.statusCounts(m);
    var n = st.emails.length, digits = pad6(n).split('');
    var heads = ['Pitches in', 'Companies dealt', 'Mutual matches', 'Joined', 'Pitches heard', 'Your inbox earned'];
    var cells = [
      h('td', null, h('span', { class: 'ctr', role: 'img', 'aria-label': n + ' pitches in' }, digits.map(function (d) { return h('span', null, d); }))),
      h('td', { class: 'c' }, c.cards - c.binned),
      h('td', { class: 'c' }, (m.matches || { mutual: [] }).mutual.length),
      h('td', { class: 'c' }, c.opted_in),
      h('td', { class: 'c' }, s.completedPitches),
      h('td', { class: 'c money' }, K.money(s.contributors.you || 0), ' ', h('span', { class: 'sim' }, '[SIMULATED]'))
    ];
    if (m.companies[st.app.actor]) {
      var rec = m.companies[st.app.actor], cs = s.companies[st.app.actor] || { cash: 0 };
      heads.push('Playing as ' + V.cname(st, st.app.actor));
      cells.push(h('td', { class: 'c money' }, K.money(cs.cash) + (rec.creditsCents ? ' + ' + K.money(rec.creditsCents) + ' credits' : ''), ' ', h('span', { class: 'sim' }, '[SIMULATED]')));
    }
    el.appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tb stats-tb' },
      h('thead', null, h('tr', null, heads.map(function (t) { return h('th', null, t); }))),
      h('tbody', null, h('tr', null, cells)))));
  }

  function renderActor(st) {
    var sel = document.getElementById('actor');
    D.clear(sel);
    sel.appendChild(h('option', { value: 'everyone' }, 'Everyone (demo mode)'));
    var ids = Object.keys(st.market.companies).sort(function (a, b) { return V.cname(st, a).localeCompare(V.cname(st, b)); });
    if (ids.length) {
      var grp = h('optgroup', { label: 'A company' });
      ids.forEach(function (id) { var rec = st.market.companies[id]; grp.appendChild(h('option', { value: id }, V.cname(st, id) + ' · ' + (rec.status === 'opted_in' ? 'joined' : rec.status))); });
      sel.appendChild(grp);
    }
    sel.value = st.market.companies[st.app.actor] ? st.app.actor : 'everyone';
  }

  function renderView(st) {
    var el = D.clear(document.getElementById('view'));
    if (!st.app.welcomed && st.app.tab === 'inbox') el.appendChild(V.welcome(st));
    var fn = V[st.app.tab] || V.inbox;
    el.appendChild(fn(st));
    if (D.linkLabels) D.linkLabels(el);
  }

  function renderDealer(st) {
    var el = D.clear(document.getElementById('dealer'));
    var i = st.app.storyStep;
    el.className = 'dealer' + (i != null ? ' story' : '');
    if (i != null) {
      var step = S.tour.STEPS[i];
      el.appendChild(h('div', { class: 'in' }, D.svgUse('sd-card', 17, 24, 'dealer-card'),
        h('span', { class: 'say' }, h('b', null, 'The Dealer, step ' + (i + 1) + ' of ' + S.tour.STEPS.length + '. ' + step.title + '.'), ' ' + S.tour.line(i))));
      el.appendChild(h('div', { class: 'controls' },
        h('button', { class: 'btn small', disabled: i === 0, onclick: S.tour.back }, '< Back'),
        h('button', { class: 'btn small primary', onclick: S.tour.next }, i >= S.tour.STEPS.length - 1 ? 'Finish' : 'Next >'),
        h('button', { class: 'btn small', onclick: S.tour.exit, title: 'Leave the story; everything stays as it is' }, 'Exit')));
    } else {
      var last = st.market.log.length ? st.market.log[st.market.log.length - 1].text : 'Deal the inbox to begin, or play the story.';
      el.appendChild(h('div', { class: 'in' }, D.svgUse('sd-card', 17, 24, 'dealer-card'), h('span', { class: 'say' }, h('b', null, 'The Dealer:'), ' ' + last)));
      el.appendChild(h('div', { class: 'controls' }, h('button', { class: 'btn small', onclick: S.tour.start }, 'Play the story')));
    }
  }

  function renderHeader(st) {
    var b = document.getElementById('btn-claude');
    b.textContent = C.isOn() ? 'Live AI: on' : 'Live AI: off';
    b.className = 'btn';
    b.title = C.isOn() ? 'Reading with ' + C.getModel() + ' using your key' : 'Bring your own Anthropic key to read pitches live';
    document.getElementById('btn-story').textContent = st.app.storyStep != null ? 'Restart the story' : 'Play the story';
  }

  function publishBarHeight() {
    var bar = document.getElementById('dealer');
    if (bar) document.documentElement.style.setProperty('--dealer-h', bar.offsetHeight + 'px');
  }
  function render(st) {
    renderHeader(st); renderTabs(st); renderStats(st); renderActor(st); renderView(st); renderDealer(st);
    var vis = document.getElementById('visitor');
    if (vis) vis.textContent = pad6(st.emails.length);
    var vctr = document.getElementById('visitor-ctr');
    if (vctr) { var digits = pad6(st.emails.length).split(''); var cells = vctr.children; for (var di = 0; di < cells.length && di < digits.length; di++) cells[di].textContent = digits[di]; }
    var adc = document.getElementById('ad-count');
    if (adc) adc.textContent = st.emails.length;
    publishBarHeight();
    if (location.hash.replace('#', '') !== st.app.tab) { try { history.replaceState(null, '', '#' + st.app.tab); } catch (e) { /* file:// */ } }
  }

  // ---------------- live reading ----------------
  function readLive(emailId) {
    var email = A.emailById(emailId);
    if (!email) return;
    store.commit(function (s) { s.app.reading[emailId] = true; });
    C.read(email).then(function (cardOut) {
      if (store.state.app.dealt[emailId]) A.replaceCard(emailId, cardOut);
      else store.commit(function (s) { A.placeCard(s, email, cardOut); K.say(s.market, 'Read ' + cardOut.company.name + ' live with ' + cardOut.readBy.split(':')[1] + ': ' + Math.round(cardOut.confidence * 100) + '% sure. “' + cardOut.dealerNote + '”'); });
    }).catch(function (e) {
      store.commit(function (s) { delete s.app.reading[emailId]; s.app.lastError = 'Live read failed: ' + e.message; });
    });
  }
  function reRead(emailId, mode) {
    var email = A.emailById(emailId);
    if (!email) return;
    var cardOut = mode === 'fixture' && !email.pasted ? X.readFixture(email, S.demoCards.READINGS) : X.heuristicRead(email);
    A.replaceCard(emailId, cardOut);
  }

  // ---------------- boot ----------------
  function boot() {
    store.load();
    store.onChange(render);
    var q = new URLSearchParams(location.search);
    var hash = location.hash.replace('#', '');
    if (TABS.some(function (t) { return t[0] === hash; })) store.state.app.tab = hash;
    document.getElementById('actor').addEventListener('change', function (ev) { A.setActor(ev.target.value); });
    document.getElementById('btn-claude').addEventListener('click', function () { V.modals.key(); });
    document.getElementById('btn-story').addEventListener('click', function () { S.tour.start(); });
    document.getElementById('btn-reset').addEventListener('click', function () { if (confirm('Reset the demo? Your pasted emails and everything the companies did will be forgotten. The API key stays.')) { S.tour.exit(); store.reset(); } });
    document.getElementById('brand').addEventListener('click', function (ev) { ev.preventDefault(); A.tab('inbox'); });
    window.addEventListener('resize', publishBarHeight);
    window.addEventListener('hashchange', function () { var t = location.hash.replace('#', ''); if (TABS.some(function (x) { return x[0] === t; }) && t !== store.state.app.tab) A.tab(t); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') V.modals.close();
      var typing = /input|textarea|select/i.test((ev.target && ev.target.tagName) || '');
      if (!typing && store.state.app.storyStep != null && !document.querySelector('.modal')) {
        if (ev.key === 'ArrowRight') S.tour.next();
        if (ev.key === 'ArrowLeft') S.tour.back();
      }
    });
    // One switch stills the marquee and the blink; remembered in this browser.
    var still = false;
    try { still = localStorage.getItem('spamdeck.still') === '1'; } catch (e) { /* storage blocked */ }
    var motion = document.getElementById('motion-toggle');
    function applyStill() {
      document.body.classList.toggle('still', still);
      if (motion) motion.textContent = still ? 'start the marquee' : 'stop the marquee';
    }
    applyStill();
    if (motion) motion.addEventListener('click', function (ev) {
      ev.preventDefault();
      still = !still;
      try { localStorage.setItem('spamdeck.still', still ? '1' : '0'); } catch (e) { /* storage blocked */ }
      applyStill();
    });
    if (q.get('theme') === 'dark' || q.get('theme') === 'light') document.documentElement.dataset.theme = q.get('theme');
    var ad = document.getElementById('ad-banner');
    if (ad) ad.addEventListener('click', function (ev) { ev.preventDefault(); A.welcomed(); S.tour.start(); });
    var repo = document.getElementById('repo-link');
    if (repo && /github\.io$/.test(location.hostname)) repo.href = 'https://github.com/' + location.hostname.split('.')[0] + '/SpamDeck';
    if (q.has('story')) {
      render(store.state);
      S.tour.jumpTo(q.get('story'));
      if (q.has('tab') && TABS.some(function (t) { return t[0] === q.get('tab'); })) A.tab(q.get('tab'));
      if (q.has('bare')) document.body.classList.add('bare');
      return;
    }
    render(store.state);
  }

  S.main = { readLive: readLive, reRead: reRead, render: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
