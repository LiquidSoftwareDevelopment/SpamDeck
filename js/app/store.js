/* SpamDeck — app state, persistence (localStorage, per browser) and the actions the views call.
   The engine does the thinking; this file only holds state and calls the engine. */
(function (root) {
  'use strict';
  var S = root.SpamDeck, T = S.taxonomy, K = S.market, X = S.extract;
  var KEY = 'spamdeck.v1';

  function fresh() {
    var m = K.createState();
    K.addContributors(m, S.demoInbox.CONTRIBUTORS);
    return {
      app: { tab: 'inbox', selectedEmail: null, actor: 'everyone', storyStep: null, dealt: {}, reading: {}, reader: 'fixture', flipped: {}, welcomed: false, openMails: {}, openMatches: {}, matchFilter: 'mutual', deckFilter: 'all', lastError: null },
      emails: S.demoInbox.EMAILS.slice(),
      market: m
    };
  }

  var store = {
    state: null,
    listeners: [],
    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) {
          var st = JSON.parse(raw);
          if (st && st.market && st.app && st.emails) {
            st.app.reading = {}; st.app.lastError = null; st.app.storyStep = null;
            if (!st.market.matches) K.refreshMatches(st.market);
            store.state = st;
            return store.state;
          }
        }
      } catch (e) { /* storage blocked or corrupt: start fresh */ }
      store.state = fresh();
      return store.state;
    },
    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(store.state)); } catch (e) { /* private window, quota: fine */ }
    },
    reset: function (opts) {
      var keepWelcome = opts && opts.keepWelcome;
      var old = store.state;
      store.state = fresh();
      if (keepWelcome && old) store.state.app.welcomed = old.app.welcomed;
      store.save();
      store.emit();
    },
    onChange: function (fn) { store.listeners.push(fn); },
    emit: function () { store.listeners.forEach(function (fn) { fn(store.state); }); },
    // Run an action against the state; errors become a visible line instead of a crash.
    commit: function (fn, opts) {
      var st = store.state, result;
      st.app.lastError = null;
      try { result = fn(st); }
      catch (e) { st.app.lastError = e.message || String(e); result = { error: st.app.lastError }; }
      store.save();
      if (!(opts && opts.silent)) store.emit();
      return result;
    }
  };

  // ---------------- actions ----------------
  var actions = {
    tab: function (name) { store.commit(function (st) { st.app.tab = name; }); },
    select: function (emailId) { store.commit(function (st) { st.app.selectedEmail = emailId; }); },
    setReader: function (mode) { store.commit(function (st) { st.app.reader = mode; }); },
    setActor: function (id) { store.commit(function (st) { st.app.actor = id; }); },
    toggleFlip: function (id) { store.commit(function (st) { st.app.flipped[id] = !st.app.flipped[id]; }); },
    toggleMail: function (id) { store.commit(function (st) { st.app.openMails[id] = !st.app.openMails[id]; }); },
    toggleMatch: function (key) { store.commit(function (st) { st.app.openMatches[key] = !st.app.openMatches[key]; }); },
    setMatchFilter: function (f) { store.commit(function (st) { st.app.matchFilter = f; }); },
    setDeckFilter: function (f) { store.commit(function (st) { st.app.deckFilter = f; }); },
    welcomed: function () { store.commit(function (st) { st.app.welcomed = true; }); },

    emailById: function (id) { return store.state.emails.filter(function (e) { return e.id === id; })[0] || null; },
    cardForEmail: function (emailId) { var id = store.state.app.dealt[emailId]; return id ? store.state.market.cards[id] : null; },

    // Add a pasted pitch to your inbox.
    pasteEmail: function (fields) {
      return store.commit(function (st) {
        var n = st.emails.filter(function (e) { return e.id.charAt(0) === 'u'; }).length + 1;
        var m = String(fields.from || '').match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
        var from = m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: String(fields.from || '').trim() };
        if (!from.email || from.email.indexOf('@') < 0) throw new Error('Give the sender’s email address (the domain is how the Dealer names the company).');
        if (!from.name) from.name = from.email.split('@')[0];
        if (!String(fields.body || '').trim()) throw new Error('Paste the body of the email.');
        var e = { id: 'u' + String(n).padStart(2, '0'), contributorId: 'you', receivedAt: new Date().toISOString().slice(0, 10), from: from, subject: fields.subject || '(no subject)', body: fields.body, pasted: true };
        st.emails.unshift(e);
        st.app.selectedEmail = e.id;
        st.app.tab = 'inbox';
        K.say(st.market, 'A new pitch in your inbox from ' + from.email.split('@')[1] + '. Deal it and see what it becomes.');
        return e;
      });
    },

    // Deal one email with the chosen reader (fixture for demo emails, else the simple reader; Claude is async and lives in claude.js).
    dealEmail: function (emailId, readerMode) {
      return store.commit(function (st) {
        var email = actions.emailById(emailId);
        if (!email) throw new Error('No such email.');
        var mode = readerMode || st.app.reader;
        var card = null;
        if (mode === 'fixture' && !email.pasted) card = X.readFixture(email, S.demoCards.READINGS);
        if (!card) card = X.heuristicRead(email);
        return actions.placeCard(st, email, card);
      });
    },

    // Put a card in the deck (merging with an earlier card from the same company) and remember which email it came from.
    placeCard: function (st, email, card) {
      var m = st.market;
      var existing = m.cards[card.id];
      if (existing) {
        var merged = X.mergeCards([existing, card]).cards[0];
        m.cards[card.id] = merged;
        if (!T.isBinned(merged) && !m.companies[card.id]) K.addCards(m, [merged]);
        else K.refreshMatches(m);
      } else {
        K.addCards(m, [card]);
      }
      st.app.dealt[email.id] = card.id;
      delete st.app.reading[email.id];
      return card;
    },

    dealAll: function () {
      var ids = store.state.emails.filter(function (e) { return !store.state.app.dealt[e.id]; }).map(function (e) { return e.id; });
      var before = Object.keys(store.state.market.cards).length;
      ids.forEach(function (id) { actions.dealEmail(id); });
      store.commit(function (st) {
        var deck = { read: ids.length, live: [], binned: [], merged: [], errors: [] };
        Object.keys(st.market.cards).forEach(function (cid) { var c = st.market.cards[cid]; (T.isBinned(c) ? deck.binned : deck.live).push(c); if (c.sources.length > 1) deck.merged.push(cid); });
        if (ids.length) K.say(st.market, X.tally({ read: ids.length, live: deck.live, binned: deck.binned, merged: deck.merged, errors: [] }) + (Object.keys(st.market.cards).length - before < ids.length ? '' : ''));
      });
      return ids.length;
    },

    // Replace a card after a re-read (e.g. with the live reader). Refused once the company has offers.
    replaceCard: function (emailId, newCard) {
      return store.commit(function (st) {
        var m = st.market, oldId = st.app.dealt[emailId];
        if (oldId && oldId !== newCard.id) {
          var busy = Object.keys(m.offers).some(function (oid) { return m.offers[oid].from === oldId || m.offers[oid].to === oldId; }) ||
            Object.keys(m.openPitches).some(function (pid) { var p = m.openPitches[pid]; return p.from === oldId || p.reads.some(function (r) { return r.listenerId === oldId; }); });
          if (busy) throw new Error('This company already has offers; keeping the old card so nothing is orphaned.');
          delete m.cards[oldId]; delete m.companies[oldId];
        }
        if (oldId === newCard.id) { delete m.cards[oldId]; }
        var email = actions.emailById(emailId);
        var card = actions.placeCard(st, email, newCard);
        K.say(st.market, 'Re-read ' + card.company.name + ' with ' + X.READER_LABEL[card.readBy.split(':')[0]] + '. Confidence ' + Math.round(card.confidence * 100) + '%.');
        return card;
      });
    },

    // Market actions: thin wrappers so every view calls the same thing.
    invite: function (ids) { return store.commit(function (st) { return K.invite(st.market, ids); }); },
    optIn: function (id, opts) { return store.commit(function (st) { return K.optIn(st.market, id, opts); }); },
    decline: function (id) { return store.commit(function (st) { return K.decline(st.market, id); }); },
    setListenPrice: function (id, cents) { return store.commit(function (st) { return K.setListenPrice(st.market, id, cents); }); },
    setPayout: function (id, p) { return store.commit(function (st) { return K.setPayout(st.market, id, p); }); },
    setOpenBooth: function (id, v) { return store.commit(function (st) { return K.setOpenBooth(st.market, id, v); }); },
    propose: function (o) { return store.commit(function (st) { return K.propose(st.market, o); }); },
    acceptOffer: function (id) { return store.commit(function (st) { return K.acceptOffer(st.market, id); }); },
    declineOffer: function (id, note) { return store.commit(function (st) { return K.declineOffer(st.market, id, note); }); },
    pay: function (id) { return store.commit(function (st) { return K.pay(st.market, id); }); },
    complete: function (id, r) { return store.commit(function (st) { return K.complete(st.market, id, r); }); },
    refund: function (id, note) { return store.commit(function (st) { return K.refund(st.market, id, note); }); },
    postOpenPitch: function (o) { return store.commit(function (st) { return K.postOpenPitch(st.market, o); }); },
    readOpenPitch: function (o) { return store.commit(function (st) { return K.readOpenPitch(st.market, o); }); },
    closeOpenPitch: function (id) { return store.commit(function (st) { return K.closeOpenPitch(st.market, id); }); },
    setSplits: function (bp) {
      return store.commit(function (st) {
        K.validateSplits(bp);
        st.market.config.splitsBp = Object.assign({}, bp);
        K.say(st.market, 'House rules changed: listener ' + (bp.listener / 100) + '%, listener’s contributor ' + (bp.listenerContributor / 100) + '%, pitcher’s contributor ' + (bp.pitcherContributor / 100) + '%, SpamDeck ' + (bp.platform / 100) + '%. Applies to pitches completed from now on.');
      });
    },

    // Who may press which button. "everyone" is demo mode: all buttons live.
    can: function (companyId) {
      var a = store.state.app.actor;
      return a === 'everyone' || a === companyId;
    },
    actorIsCompany: function () { var a = store.state.app.actor; return !!store.state.market.companies[a]; }
  };

  S.store = store;
  S.actions = actions;
})(window);
