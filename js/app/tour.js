/* SpamDeck — story mode. Fourteen steps, each one line from the Dealer and (usually) something that happens.
   Two steps hand the judge a form (join as Ledgerly; the fake checkout); pressing Next finishes them if the judge did not.
   Steps run forward on a fresh demo; "Back" re-reads the previous line without undoing anything. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, A = S.actions, store = S.store, K = S.market;
  var money = K.money;
  function st() { return store.state; }
  function m() { return store.state.market; }
  function co(id) { return m().companies[id]; }
  function share(cents, key) { return Math.round(cents * m().config.splitsBp[key] / 10000); }
  function modals() { return S.views && S.views.modals; }

  var ctx = { offer1: null, pending: [], timer: null, instant: false, finish: null };

  // Deal the undealt emails one by one so the cards visibly land; flushDeal finishes instantly.
  function animateDeal() {
    ctx.pending = st().emails.filter(function (e) { return !st().app.dealt[e.id]; }).map(function (e) { return e.id; });
    if (ctx.instant) return flushDeal();
    function tick() {
      if (!ctx.pending.length) { ctx.timer = null; store.commit(function (s) { s.app.justDealt = null; }); return; }
      var id = ctx.pending.shift();
      var card = A.dealEmail(id);
      store.commit(function (s) { s.app.justDealt = card && card.id ? card.id : null; });
      ctx.timer = setTimeout(tick, 230);
    }
    tick();
  }
  function flushDeal() {
    if (ctx.timer) { clearTimeout(ctx.timer); ctx.timer = null; }
    var ids = ctx.pending.slice(); ctx.pending = [];
    ids.forEach(function (id) { A.dealEmail(id); });
    if (ids.length || st().app.justDealt) store.commit(function (s) { s.app.justDealt = null; });
  }
  // Finish whatever the current step left to the judge (a form), then clear it.
  function settle() {
    flushDeal();
    if (modals()) modals().close();
    var f = ctx.finish; ctx.finish = null;
    if (f) f();
  }
  function tally() {
    var cards = m().cards, live = 0, binned = 0;
    Object.keys(cards).forEach(function (id) { if (cards[id].flags.length) binned++; else live++; });
    return { live: live, binned: binned };
  }
  function flow(from, to, kind, opts) {
    opts = opts || {};
    var o = A.propose(Object.assign({ from: from, to: to, kind: kind }, opts.offer || {}));
    if (!o || o.error) return o;
    A.acceptOffer(o.id);
    A.pay(o.id);
    A.complete(o.id, opts.response || {});
    return o;
  }
  var JOINERS = [['ledgerly', 7500], ['hirewire', 7500], ['chatterbox', 7500], ['boomerangreturns', 10000], ['outreachly', 7500], ['nordicbean', 2500], ['stacklinestudio', 10000], ['vettd', 7500]];
  function joinEveryone() {
    JOINERS.forEach(function (p) { if (co(p[0]) && co(p[0]).status === 'invited') A.optIn(p[0], { listenPriceCents: p[1] }); });
    if (co('meridianoutbound').status === 'invited') A.optIn('meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
    if (co('deskwell').status === 'invited') A.optIn('deskwell', { listenPriceCents: 4000 });
    if (co('brightpath').status === 'invited') A.optIn('brightpath', { listenPriceCents: 50000, openBooth: true });
    if (co('podly').status === 'invited') A.decline('podly');
    if (st().app.actor !== 'everyone') A.setActor('everyone');
  }

  var STEPS = [
    { title: 'Your inbox', tab: 'inbox',
      say: function () { return st().emails.length + ' pitches nobody asked for, pooled from three inboxes: yours, Priya’s and Hirewire’s.'; } },
    { title: 'The Dealer reads', tab: 'deck', run: function () { A.tab('deck'); animateDeal(); },
      say: 'One email at a time: who sent it, what they sell, who they want. Watch the cards land.' },
    { title: 'Dealt, binned, merged', tab: 'deck', run: function () { flushDeal(); },
      say: function () { var t = tally(); return 'Dealt ' + t.live + ', binned ' + t.binned + ': a newsletter and a scam. Two repeat senders became one card each.'; } },
    { title: 'The matches', tab: 'matches',
      say: function () { return 'Every pair scored both ways, every point explained. ' + m().matches.mutual.length + ' pairs want each other.'; } },
    { title: 'The letter', tab: 'outbox',
      run: function () {
        A.invite();
        store.commit(function (s) {
          s.app.mailFilter = 'invite';
          var invites = s.market.outbox.filter(function (x) { return x.type === 'invite'; });
          var top = invites[invites.length - 1];   // the outbox lists newest first, so the last one sent is at the top
          if (top) s.app.openMails[top.id] = true;
        });
      },
      say: 'One letter to every company: what we read, what we did not share, and that silence deletes the card.' },
    { title: 'Who said yes', tab: 'market',
      run: function () {
        if (ctx.instant || !modals()) { joinEveryone(); return; }
        A.setActor('ledgerly');
        ctx.finish = joinEveryone;
        modals().optIn('ledgerly');
      },
      say: 'You are Ledgerly now: join and name your price. Next signs up ten more; Podly declines, and that is that.' },
    { title: 'Pay to pitch', tab: 'market',
      run: function () { var o = A.propose({ from: 'hirewire', to: 'ledgerly', kind: 'read' }); if (o && !o.error) { ctx.offer1 = o.id; A.acceptOffer(o.id); } },
      say: function () { return 'Hirewire wants Ledgerly (' + K.score(m(), 'hirewire', 'ledgerly') + ' of 100) and offers its ' + money(co('ledgerly').listenPriceCents) + ' read price. Ledgerly accepts.'; } },
    { title: 'The fake checkout', tab: 'market',
      run: function () {
        var id = ctx.offer1, o = id && m().offers[id];
        if (!o) return;
        var payIt = function () { if (m().offers[id] && m().offers[id].status === 'accepted') A.pay(id); };
        if (ctx.instant || !modals()) { payIt(); return; }
        ctx.finish = payIt;
        modals().checkout(o);
      },
      say: function () { return 'Press the fake Pay button. SpamPay holds the ' + money(co('ledgerly').listenPriceCents) + '; the introduction then reveals both addresses.'; } },
    { title: 'Get paid to listen', tab: 'ledger',
      run: function () { if (ctx.offer1 && m().offers[ctx.offer1].status === 'paid') A.complete(ctx.offer1, { answer: 'interested' }); },
      say: function () { var p = co('ledgerly').listenPriceCents; return 'Ledgerly answers “interested”: ' + money(share(p, 'listener')) + ' to Ledgerly, ' + money(share(p, 'listenerContributor') + share(p, 'pitcherContributor')) + ' to you, ' + money(share(p, 'platform')) + ' to SpamDeck.'; } },
    { title: 'Across the pool', tab: 'ledger',
      run: function () { flow('chatterbox', 'boomerangreturns', 'read', { response: { answer: 'not now' } }); },
      say: function () { var p = co('boomerangreturns').listenPriceCents; return 'Chatterbox (yours) pays ' + money(p) + ' to pitch Boomerang (Priya’s). Priya earns ' + money(share(p, 'listenerContributor')) + ', you earn ' + money(share(p, 'pitcherContributor')) + '.'; } },
    { title: 'Listen to earn', tab: 'ledger',
      run: function () {
        flow('outreachly', 'meridianoutbound', 'read', { response: { answer: 'interested' } });
        var credits = co('meridianoutbound').creditsCents;
        var floor = K.priceFloor(m(), 'meridianoutbound', 'deskwell', 'read');
        flow('meridianoutbound', 'deskwell', 'read', { offer: { priceCents: Math.max(floor, Math.min(credits, floor + 500)), payWith: 'credits' }, response: { answer: 'no' } });
      },
      say: 'Meridian has no budget: it reads a pitch for credits (25% more than cash), then spends them on Deskwell.' },
    { title: 'The swap', tab: 'ledger',
      run: function () { flow('deskwell', 'nordicbean', 'swap', {}); },
      say: 'Deskwell and Nordic Bean, desks and coffee, pitch each other. Each pays the other’s price; both inboxes earn.' },
    { title: 'The open booth', tab: 'market',
      run: function () { flow('chatterbox', 'brightpath', 'read', { response: { answer: 'not now' } }); },
      say: 'Brightpath, a venture fund, hears anyone for $500, no match needed. Chatterbox pays. Cheaper than a demo day.' },
    { title: 'Your inbox, now', tab: 'ledger',
      say: function () { var s = K.summary(m()); var mine = st().emails.filter(function (e) { return e.contributorId === 'you'; }).length; return mine + ' pitches in, ' + money(s.contributors.you || 0) + ' out to you, every cent simulated. Now paste a pitch of your own.'; } }
  ];

  var tour = {
    STEPS: STEPS,
    active: function () { return st().app.storyStep != null; },
    start: function () {
      settle();
      store.reset({ keepWelcome: true });
      A.welcomed();
      ctx.offer1 = null;
      apply(0);
    },
    next: function () {
      var i = st().app.storyStep;
      if (i == null) return tour.start();
      settle();
      if (i >= STEPS.length - 1) return tour.exit();
      apply(i + 1);
    },
    back: function () {
      var i = st().app.storyStep;
      if (i == null || i === 0) return;
      settle();
      store.commit(function (s) { s.app.storyStep = i - 1; s.app.tab = STEPS[i - 1].tab || s.app.tab; });
    },
    exit: function () {
      settle();
      store.commit(function (s) { s.app.storyStep = null; s.app.justDealt = null; });
    },
    // Deep link: ?story=N fast-forwards a fresh demo to step N (counting from 0), with no forms left open.
    jumpTo: function (n) {
      n = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0));
      ctx.instant = true;
      tour.start();
      for (var i = 1; i <= n; i++) { settle(); apply(i); }
      ctx.instant = false;
    },
    line: function (i) { var s = STEPS[i]; return typeof s.say === 'function' ? s.say() : s.say; }
  };

  function apply(i) {
    var s = STEPS[i];
    store.commit(function (x) { x.app.storyStep = i; x.app.lastError = null; }, { silent: true });
    if (s.run) s.run();
    store.commit(function (x) { if (s.tab) x.app.tab = s.tab; });
  }

  S.tour = tour;
})(window);
