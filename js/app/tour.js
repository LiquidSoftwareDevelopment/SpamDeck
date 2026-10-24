/* SpamDeck — story mode. Fourteen steps, each one a line from the Dealer and (usually) something that happens.
   Steps run forward on a fresh demo; "Back" re-reads the previous line without undoing anything. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, A = S.actions, store = S.store, K = S.market;
  var money = K.money;
  function st() { return store.state; }
  function m() { return store.state.market; }
  function co(id) { return m().companies[id]; }
  function share(cents, key) { return Math.round(cents * m().config.splitsBp[key] / 10000); }

  var ctx = { offer1: null, pending: [], timer: null, instant: false };

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
  function sayTally() {
    var cards = m().cards, live = 0, binned = 0, merged = 0;
    Object.keys(cards).forEach(function (id) { var c = cards[id]; if (c.flags.length) binned++; else live++; if (c.sources.length > 1) merged++; });
    return { live: live, binned: binned, merged: merged };
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

  var STEPS = [
    { title: 'Your inbox', tab: 'inbox',
      say: function () { return st().emails.length + ' unsolicited pitches, pooled from three inboxes: yours, Priya’s and Hirewire’s. Nobody asked for any of them. That is the raw material.'; } },
    { title: 'The Dealer reads', tab: 'deck', run: function () { A.tab('deck'); animateDeal(); },
      say: 'One email at a time: who sent it, what they sell, who they want to reach. Watch the cards land.' },
    { title: 'Dealt, binned, merged', tab: 'deck', run: function () { flushDeal(); },
      say: function () { var t = sayTally(); return 'Dealt ' + t.live + ', binned ' + t.binned + ': one newsletter, one prince. Hirewire wrote twice and Deskwell wrote to two of you: one card each, every email kept as a witness.'; } },
    { title: 'The matches', tab: 'matches',
      say: function () { var mm = m().matches; return 'Every pair is scored both ways and every point is explained. ' + mm.mutual.length + ' pairs want each other. The desk company, the coffee company and the outbound agency turn out to be each other’s best customers, which is the whole idea.'; } },
    { title: 'The letter', tab: 'outbox',
      run: function () { A.invite(); store.commit(function (s) { s.app.mailFilter = 'invite'; var mail = s.market.outbox.filter(function (x) { return x.type === 'invite' && x.companyId === 'ledgerly'; })[0]; if (mail) s.app.openMails[mail.id] = true; }); },
      say: 'Every company gets the same letter: what we read, what we did not share, what they can do, and that doing nothing deletes the card in 30 days. Nothing else reaches anyone until they say yes.' },
    { title: 'Who said yes', tab: 'market',
      run: function () {
        [['ledgerly', 7500], ['hirewire', 7500], ['chatterbox', 7500], ['boomerangreturns', 10000], ['outreachly', 7500], ['nordicbean', 2500], ['stacklinestudio', 10000], ['vettd', 7500]]
          .forEach(function (p) { A.optIn(p[0], { listenPriceCents: p[1] }); });
        A.optIn('meridianoutbound', { listenPriceCents: 7500, payout: 'credits' });
        A.optIn('deskwell', { listenPriceCents: 4000 });
        A.optIn('brightpath', { listenPriceCents: 50000, openBooth: true });
        A.decline('podly');
      },
      say: function () { var n = Object.keys(co('ledgerly') ? m().companies : {}).filter(function (id) { return m().companies[id].status === 'opted_in'; }).length; return n + ' join and price their attention; Meridian asks to be paid in credits, Brightpath opens its booth to anyone at $500. Podly declines, and that is the end of Podly. From here everything happens between companies that opted in. You can play any of them from the menu at the top.'; } },
    { title: 'Pay to pitch', tab: 'market',
      run: function () { var o = A.propose({ from: 'hirewire', to: 'ledgerly', kind: 'read' }); if (o && !o.error) { ctx.offer1 = o.id; A.acceptOffer(o.id); } },
      say: function () { return 'Hirewire wants Ledgerly (' + K.score(m(), 'hirewire', 'ledgerly') + ' of 100: fintech, forty people, hiring engineers). It offers Ledgerly’s price, ' + money(co('ledgerly').listenPriceCents) + ', for a read. Ledgerly accepts.'; } },
    { title: 'The fake checkout', tab: 'outbox',
      run: function () { if (ctx.offer1) A.pay(ctx.offer1); store.commit(function (s) { s.app.mailFilter = 'intro'; var mail = s.market.outbox.filter(function (x) { return x.type === 'intro'; })[0]; if (mail) s.app.openMails[mail.id] = true; }); },
      say: function () { return 'SpamPay takes a fake ' + money(co('ledgerly').listenPriceCents) + ' and holds it. The introduction goes out: the first moment either side sees the other’s email address.'; } },
    { title: 'Get paid to listen', tab: 'ledger',
      run: function () { if (ctx.offer1) A.complete(ctx.offer1, { answer: 'interested' }); },
      say: function () { var p = co('ledgerly').listenPriceCents; return 'Ledgerly reads the pitch and answers “interested”. The ' + money(p) + ' splits: ' + money(share(p, 'listener')) + ' to Ledgerly for listening, ' + money(share(p, 'listenerContributor') + share(p, 'pitcherContributor')) + ' to you for supplying both sides, ' + money(share(p, 'platform')) + ' to SpamDeck. Simulated, to the cent.'; } },
    { title: 'Across the pool', tab: 'ledger',
      run: function () { flow('chatterbox', 'boomerangreturns', 'read', { response: { answer: 'not now' } }); },
      say: function () { var p = co('boomerangreturns').listenPriceCents; return 'Chatterbox, from your inbox, pays ' + money(p) + ' to pitch Boomerang, from Priya’s. Priya supplied the listener and earns ' + money(share(p, 'listenerContributor')) + '; you supplied the pitcher and earn ' + money(share(p, 'pitcherContributor')) + '.'; } },
    { title: 'Listen to earn', tab: 'ledger',
      run: function () {
        flow('outreachly', 'meridianoutbound', 'read', { response: { answer: 'interested' } });
        var credits = co('meridianoutbound').creditsCents;
        var floor = K.priceFloor(m(), 'meridianoutbound', 'deskwell', 'read');
        flow('meridianoutbound', 'deskwell', 'read', { offer: { priceCents: Math.max(floor, Math.min(credits, floor + 500)), payWith: 'credits' }, response: { answer: 'no' } });
      },
      say: 'Meridian has no budget. It reads Outreachly’s pitch and takes credits instead of cash: 25% more, spendable only on pitching. Then it spends them on Deskwell. SpamDeck funds that one from its own cut.' },
    { title: 'The swap', tab: 'ledger',
      run: function () { flow('deskwell', 'nordicbean', 'swap', {}); },
      say: 'Deskwell and Nordic Bean, desks and coffee, have been pitching the same offices for years. Now they pitch each other: each pays the other’s meeting price, the ledger nets it, and the contributors earn on both legs.' },
    { title: 'The open booth', tab: 'market',
      run: function () { flow('chatterbox', 'brightpath', 'read', { response: { answer: 'not now' } }); },
      say: 'Brightpath, a venture fund, opened its booth: anyone may pitch for $500, no match required. Chatterbox pays. Cheaper than a demo day.' },
    { title: 'Your inbox, now', tab: 'ledger',
      say: function () { var s = K.summary(m()); var mine = st().emails.filter(function (e) { return e.contributorId === 'you'; }).length; return mine + ' pitches came into your inbox. ' + money(s.contributors.you || 0) + ' went out to you, simulated. The spammers paid each other, everyone consented, and the only thing you did was forward your spam. Now paste one of your own.'; } }
  ];

  var tour = {
    STEPS: STEPS,
    active: function () { return st().app.storyStep != null; },
    start: function () {
      flushDeal();
      store.reset({ keepWelcome: true });
      A.welcomed();
      ctx.offer1 = null;
      apply(0);
    },
    next: function () {
      var i = st().app.storyStep;
      if (i == null) return tour.start();
      flushDeal();
      if (i >= STEPS.length - 1) return tour.exit();
      apply(i + 1);
    },
    back: function () {
      var i = st().app.storyStep;
      if (i == null || i === 0) return;
      flushDeal();
      store.commit(function (s) { s.app.storyStep = i - 1; s.app.tab = STEPS[i - 1].tab || s.app.tab; });
    },
    exit: function () {
      flushDeal();
      store.commit(function (s) { s.app.storyStep = null; s.app.justDealt = null; });
    },
    // Deep link: ?story=N fast-forwards a fresh demo to step N.
    jumpTo: function (n) {
      n = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0));
      ctx.instant = true;
      tour.start();
      for (var i = 1; i <= n; i++) apply(i);
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
