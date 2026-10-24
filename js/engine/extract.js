/* SpamDeck — the Dealer reads a pitch and deals a card.
   Three readers share one card shape:
     fixture   — hand-labelled readings of the demo inbox (see js/data/demo_cards.js)
     heuristic — the offline "simple reader": keyword rules, crude on purpose, never confident
     claude    — the live reader: a Claude API request built here, sent by the app with the user's own key
   Also: dedupe (one company, many emails -> one card) and the Dealer's tally line.
   Browser: window.SpamDeck.extract · Node: require('./extract.js') */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./taxonomy.js'));
  } else {
    root.SpamDeck = root.SpamDeck || {};
    root.SpamDeck.extract = factory(root.SpamDeck.taxonomy);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T) {
  'use strict';

  var READER_LABEL = {
    fixture: 'demo fixture (hand-labelled)',
    heuristic: 'simple reader (offline keyword rules)',
    claude: 'Claude (live, your key)'
  };

  function sourceOf(email) {
    return { emailId: email.id, contributorId: email.contributorId, receivedAt: email.receivedAt, subject: email.subject, from: email.from };
  }

  // ---------------- 1. Fixture reader ----------------
  function readFixture(email, readings) {
    var r = readings && email && Object.prototype.hasOwnProperty.call(readings, email.id) ? readings[email.id] : null;
    // Follow "sameAs" links (an email that repeats another); a missing or circular link is no reading, not a crash.
    for (var hops = 0; r && r.sameAs && hops < 10; hops++) r = Object.prototype.hasOwnProperty.call(readings, r.sameAs) ? readings[r.sameAs] : null;
    if (!r || r.sameAs) return null;
    var raw = JSON.parse(JSON.stringify(r));
    raw.readBy = 'fixture';
    return T.normalizeCard(raw, sourceOf(email));
  }

  // ---------------- 2. The simple reader (offline) ----------------
  // Keyword rules, crude on purpose; the live reader exists for a reason. The product is decided by the first rule that
  // matches the sentence saying what the company does, then the subject, then the body without its signature and footer.
  var CATEGORY_RULES = [
    { name: 'returns software', re: /returns (software|portal|management)|returns are eating/i, category: 'ecommerce-software', industry: 'saas', teams: ['engineering', 'sales', 'support'] },
    { name: 'outreach tool', re: /linkedin (outreach|messages?|automation|prospecting|connection requests?)|outreach automation|sequences, personali/i, category: 'sales-tools', industry: 'sales-tools', teams: ['engineering', 'sales'] },
    { name: 'coworking', re: /cowork|private offices|month to month|don't want a lease/i, category: 'office-space', industry: 'real-estate', teams: ['ops', 'sales'] },
    { name: 'sales tax', re: /sales tax|tax (compliance|filing|exposure)/i, category: 'tax-software', industry: 'fintech', teams: ['engineering', 'sales', 'support', 'finance'] },
    { name: 'bookkeeping', re: /bookkeep|accounting|monthly close|your books/i, category: 'bookkeeping-software', industry: 'fintech', teams: ['engineering', 'sales', 'support'] },
    { name: 'background checks', re: /background (and reference )?checks?|reference checks?/i, category: 'hr-services', industry: 'hr-tech', teams: ['engineering', 'sales', 'support'] },
    { name: 'recruiting', re: /recruit|places? (senior|staff|engineers)|headhunt|searches this quarter|on contingency|placement fee|first-year salary|representing an? (senior|staff|lead|principal|experienced)\b/i, category: 'recruiting-services', industry: 'recruiting', teams: ['sales', 'ops', 'recruiting'] },
    { name: 'security', re: /soc ?2|penetration test|pen ?test|security (audit|questionnaire|team)/i, category: 'security-services', industry: 'security', teams: ['engineering', 'sales'] },
    { name: 'furniture', re: /sit-stand|standing desks?|ergonomic|furniture/i, category: 'office-furniture', industry: 'furniture', teams: ['sales', 'ops', 'support'] },
    { name: 'support software', re: /support (agent|tickets?)|help ?desk|chatbot/i, category: 'support-software', industry: 'saas', teams: ['engineering', 'sales', 'support'] },
    { name: 'lead generation', re: /qualified (sales )?meetings|outbound|lead gen|appointment setting/i, category: 'lead-generation', industry: 'agency', teams: ['sales', 'ops'] },
    { name: 'coffee', re: /roast(ed|ery|ers?)\b|coffee (subscription|delivery|service|machines?|beans)|office coffee|\bbeans\b/i, category: 'office-supplies', industry: 'food-beverage', teams: ['ops', 'sales'] },
    { name: 'carbon', re: /carbon|offsets?\b|footprint|\besg\b/i, category: 'sustainability-services', industry: 'climate', teams: ['sales', 'ops'] },
    { name: 'podcasts', re: /podcast/i, category: 'media-services', industry: 'media', teams: ['marketing', 'sales'] },
    { name: 'dev shop', re: /engineers? (at|from) \$|dedicated (engineering|dev)|outsourc|\$\d+\s*\/\s*h/i, category: 'dev-services', industry: 'dev-services', teams: ['engineering', 'sales', 'ops'] },
    { name: 'investor', re: /seed (cheques?|checks?|round)|we invest|venture|partner at .* ventures/i, category: 'venture-capital', industry: 'venture-capital', teams: ['finance'] },
    { name: 'fulfillment', re: /fulfil+ment|warehouses?|pick(ed)?, packed|\b3pl\b/i, category: 'logistics-services', industry: 'logistics', teams: ['ops', 'sales', 'support'] },
    { name: 'photography', re: /photograph|product photos|copywrit/i, category: 'creative-services', industry: 'creative', teams: ['marketing'] }
  ];
  // When no rule matches but the email plainly sells software, the card says "software": a product, not a category.
  // Two "software" cards are never rivals (taxonomy.GENERIC_CATEGORIES).
  var SOFTWARE_CUES = /\b(our|the|a|an|this) (platform|dashboard|app|software|tool|plugin|extension|api)\b|\bplugs? (in)?to\b|\bintegrates? with\b|\bno[- ]code\b/i;
  var SOFTWARE_RULE = { name: 'software', category: 'software', industry: 'saas', teams: ['engineering', 'sales', 'support'] };

  // A scam needs two cues (or one strong one): a lone "USD 1,200" is a price, not a prince.
  var SCAM_STRONG = [/next of kin/i, /utmost confidentiality/i, /beneficiary of|as the beneficiary/i, /inheritance (fund|claim)/i, /lottery (win|winner|prize)|you have (won|been selected)/i];
  var SCAM_WEAK = [/beneficiary/i, /\bUSD [\d,.]+/i, /wire transfer/i, /\bbarrister\b/i, /inheritance/i, /lottery/i, /dear friend/i, /\blate client\b|\bdeceased\b/i];
  // A newsletter has editorial cues; a marketing footer alone ("Unsubscribe") is on half the pitches in the world.
  var NEWSLETTER_EDITORIAL = [/this week:/i, /issue ?#\s?\d+|#\d{2,}:/i, /reading time/i, /in this (issue|edition)/i, /\bplus \d+ links\b|links? of the week/i, /read (it|this) (online|in your browser)/i];
  var NEWSLETTER_FOOTER = [/unsubscribe/i, /you'?re receiving this/i, /manage (your )?(email )?preferences/i, /view (this email )?in (your )?browser/i];
  var FOOTER_LINE = /unsubscribe|you'?re receiving this|manage (your )?(email )?preferences|view (this email )?in (your )?browser|all rights reserved/i;
  // Lines that are never a company: sign-offs, device footers, social links.
  var NOT_A_NAME = /^(sent from my|sent via|sent with|get outlook|thanks|thank you|many thanks|best|cheers|regards|kind regards|warm regards|sincerely|talk soon|all the best|unsubscribe|manage preferences|view in browser|p\.?s\.?\b)/i;
  var SOCIAL = /^(instagram|linkedin|twitter|x|facebook|behance|dribbble|youtube|tiktok|github|medium|website|web|blog)$/i;

  function titleCase(s) { return String(s).replace(/(^|[\s&-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  function domainOf(email) { var e = (email.from && email.from.email) || ''; var at = e.lastIndexOf('@'); return at > 0 ? e.slice(at + 1).trim().toLowerCase() : ''; }
  // The letters of the company's own domain: mail.bigcorp-sales.com -> "bigcorpsales".
  function domainLabel(domain) { return T.companyDomain(domain || '').split('.')[0].replace(/[^a-z0-9]/g, ''); }

  // HTML left in a pasted email: tags out, entities decoded, so "TicketTamer<br>" and "&nbsp;" read as words.
  var ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    mdash: '—', ndash: '–', hellip: '…', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£' };
  // Known HTML tags only, so an address in angle brackets ("<lisa@redlinesec.example>") is left alone. Two copies:
  // a global regex's .test() remembers where it stopped, so the test uses one without "g".
  var HAS_TAG = /<\/?(p|br|div|span|a|b|i|u|strong|em|ul|ol|li|table|tbody|thead|tr|td|th|h[1-6]|img|font|center|hr|blockquote|html|body|head|meta|title|section|header|footer|small|sup|sub)\b[^>]*>/i;
  var TAGS = /<\/?(p|br|div|span|a|b|i|u|strong|em|ul|ol|li|table|tbody|thead|tr|td|th|h[1-6]|img|font|center|hr|blockquote|html|body|head|meta|title|section|header|footer|small|sup|sub)\b[^>]*>/gi;
  function plainText(s) {
    s = String(s || '');
    if (!HAS_TAG.test(s) && !/&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(s)) return s;
    return s.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<li\b[^>]*>/gi, '\n• ')
      .replace(TAGS, '')
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); })
      .replace(/&#x([0-9a-f]+);/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
      .replace(/&([a-z]+);/gi, function (m, n) { var k = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(ENTITIES, k) ? ENTITIES[k] : m; })
      .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // Quoted replies keep their words but lose their "> " markers; "On ... wrote:" and forwarded-header lines go.
  function cleanBody(body) {
    return plainText(body).split('\n').map(function (l) { return l.replace(/^\s*(>\s?)+/, ''); }).filter(function (l) {
      return !/^\s*on .{6,160} wrote:\s*$/i.test(l) && !/^\s*-{2,}\s*(forwarded|original) message\s*-*\s*$/i.test(l) && !/^\s*(from|to|cc|date|sent|subject):\s/i.test(l);
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // The body without its sign-off block and marketing footer (where "LinkedIn" and street addresses live).
  function withoutSignature(body) {
    var paras = body.split(/\n\s*\n/);
    while (paras.length > 1) {
      var lines = paras[paras.length - 1].split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var tail = lines.length <= 6 && lines.every(function (l) { return FOOTER_LINE.test(l) || NOT_A_NAME.test(l) || (l.length <= 70 && !/[.!?]$/.test(l)); });
      if (!tail) break;
      paras.pop();
    }
    return paras.join('\n\n');
  }

  // Find the company name: a run of 1-3 capitalised words in the text whose letters spell the email domain.
  function nameFromDomainWindow(text, domain) {
    var label = domainLabel(domain);
    if (!label) return null;
    var words = String(text).split(/[\s,.:;!?()"—–]+/).filter(Boolean);
    var squash = function (ws) { return ws.join('').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    for (var w = 1; w <= 3; w++) {
      for (var i = 0; i + w <= words.length; i++) {
        var slice = words.slice(i, i + w);
        if (!/^[A-Z]/.test(slice[0])) continue;
        var joined = squash(slice);
        if (joined === label || joined.replace(/and/g, '') === label.replace(/and/g, '')) return slice.join(' ');
      }
    }
    // A domain that shortens the name (redlinesec.example for "Redline Security"): capitalised words that begin with the
    // whole label, where the words before the last one are still a beginning of it.
    if (label.length >= 6) {
      for (var w2 = 2; w2 <= 3; w2++) {
        for (var j = 0; j + w2 <= words.length; j++) {
          var s2 = words.slice(j, j + w2);
          if (!s2.every(function (x) { return /^[A-Z]/.test(x); })) continue;
          var full = squash(s2), head = squash(s2.slice(0, -1));
          if (full.indexOf(label) === 0 && head.length < label.length && label.indexOf(head) === 0) return s2.join(' ');
        }
      }
    }
    return null;
  }

  // Or the signature: the last lines, after the last comma ("Partner, Hirewire" -> "Hirewire"), or the last part of
  // "Name | Title | Company". Sign-offs, device footers, phone numbers, addresses and social links are skipped.
  function nameFromSignature(body, fromName) {
    var lines = String(body).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var nameWords = String(fromName || '').toLowerCase().split(/\s+/).filter(Boolean);
    for (var i = lines.length - 1; i >= Math.max(0, lines.length - 6); i--) {
      if (/^>/.test(lines[i])) continue;
      var parts = lines[i].split(/\s+[|·•]\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (parts.some(function (x) { return SOCIAL.test(x); })) continue;
      var line = (parts.length > 1 ? parts[parts.length - 1] : lines[i]).replace(/\s*[·|]\s*\S+\.\S+.*$/, '');  // drop " · site.example"
      if (NOT_A_NAME.test(line) || FOOTER_LINE.test(line) || /\(.*\)/.test(line) || line.length > 60 || /^\+?[\d\s().-]{7,}$/.test(line) || /\d.*,|,.*\d/.test(line) || /\S+\.\S+\/?$/.test(line) && !/\s/.test(line)) continue;
      if (fromName && line.toLowerCase() === String(fromName).toLowerCase()) continue;
      if (nameWords.indexOf(line.toLowerCase()) >= 0) continue;  // "Dev", "Lisa": the sender's first name
      if (line.indexOf(',') > 0) { var tail = line.split(',').pop().trim(); if (/^[A-Z]/.test(tail) && tail.split(' ').length <= 4) return tail; }
      else if (/^[A-Z][A-Za-z&' ]{1,30}$/.test(line) && line.split(' ').length <= 4 && !/^(thanks|best|cheers|regards)/i.test(line)) return line;
    }
    return null;
  }

  // Or the sender introducing the company in the body: "i run Patel Digital, a 4-person dev studio".
  var INTRO = /\b(?:i run|i own|i founded|i(?:['’]m| am| work) (?:a |an |the )?(?:founder|co-founder|ceo|owner|partner|head of \w+)? ?(?:of|at|with)|(?:founder|co-founder|ceo|owner) of|here at|on behalf of)\s+/gi;
  function nameFromIntro(text) {
    var re = new RegExp(INTRO.source, 'gi'), m;
    while ((m = re.exec(text))) {
      var n = text.slice(m.index + m[0].length).match(/^([A-Z][\w'’&-]*(?:\s+(?:&\s+)?[A-Z][\w'’&-]*){0,3})/);  // stops at a full stop
      if (n) return n[1].replace(/['’]+$/, '');
    }
    return null;
  }

  // Sentences, by paragraph: a line break inside a paragraph is a wrap, not an end; bullets start a new sentence.
  function sentences(text) {
    return String(text).replace(/\n(?=\s*[•*·-]\s)/g, '\n\n').split(/\n\s*\n/)
      .map(function (p) { return p.replace(/\s*\n\s*/g, ' ').replace(/^\s*[•*·-]\s+/, '').trim(); })
      .reduce(function (out, p) { return out.concat(p.split(/(?<=[.!?])\s+/)); }, [])
      .map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function stripGreeting(s) { return s.replace(/^(hi|hello|hey|dear|good (morning|afternoon))\b[^,—–]{0,30}[,—–]\s*/i, ''); }

  // Verbs that say what a company does. Words that are also nouns ("stores", "books" as in bookings) only count right
  // after the company's own name (namedVerb), so "online stores lose 8%" is not mistaken for a pitch.
  var PITCH_VERB = /\b(we('re| are)? (help|build|provide|run|make|deliver|place|get|do|write|track|automate|measure|book|offset|work with|cut|save|find|fix|handle|manage|ship|store|offer|sell|design|shoot|create|monitor|reduce|turn|take|connect|match|represent|specialize|specialise)s?|i (run|own|founded)|is an?\b|helps? (you|teams|companies|brands|founders|businesses|startups)|provides|plugs into|does|delivers|automates|places|runs|tracks|books|works with|integrates with)\b/i;
  var AFTER_NAME = /^\s+(?:[a-z]+ly\s+)?(?:is|are|has|have|helps?|does|can|will|[a-z]{3,}s)\b/;
  // "CloudCost finds ...", "Parcelhouse can take ...": the company's own name followed by a verb.
  function namedVerb(sentence, name) {
    var i = name ? sentence.indexOf(name) : -1;
    return i >= 0 && AFTER_NAME.test(sentence.slice(i + name.length));
  }
  // The short form of a two-word name opening a sentence: "Boomerang is returns software" for "Boomerang Returns".
  function shortNamedVerb(sentence, name) {
    var first = String(name || '').split(' ')[0];
    return first !== name && first.length >= 6 && sentence.indexOf(first) === 0 && AFTER_NAME.test(sentence.slice(first.length));
  }

  function bandsCovering(lo, hi) {
    var out = [];
    T.SIZE_BANDS.forEach(function (b) {
      var parts = b.replace('+', '-100000').split('-').map(Number);
      if (parts[1] > lo && parts[0] <= hi) out.push(b);        // a band whose top IS the lower bound ("10–200") is not meant
      else if (parts[0] === lo && parts[0] <= hi) out.push(b); // but "1–10" is
    });
    return out;
  }

  function parseSizeBands(text) {
    var m = text.match(/(\d{1,4})\s*(?:–|-|to)\s*(\d{1,4})\s*(?:people|staff|employees|person|-person)/i);
    if (m) return bandsCovering(Number(m[1]), Number(m[2]));
    m = text.match(/(\d{1,4}) or more(?: people| staff)?/i) || text.match(/of (\d{1,4}) or more/i) || text.match(/(\d{1,4})\+ (?:people|staff)/i);
    if (m) return bandsCovering(Number(m[1]), 100000);
    return [];
  }

  function ruleFor(s) { for (var i = 0; i < CATEGORY_RULES.length; i++) { if (CATEGORY_RULES[i].re.test(s)) return CATEGORY_RULES[i]; } return null; }
  function countCues(list, text) { return list.filter(function (re) { return re.test(text); }).length; }

  function heuristicRead(email) {
    var body = cleanBody(email.body);
    var text = (email.subject || '') + '\n' + body;
    var domain = domainOf(email);
    var free = T.isFreeMail(domain);   // gmail.com and friends say nothing about the company
    var address = ((email.from && email.from.email) || '').trim().toLowerCase();
    var local = address.split('@')[0];
    var fromName = email.from && email.from.name;
    var raw = { readBy: 'heuristic', company: { domain: domain, contact: { name: fromName || '', title: '', email: (email.from && email.from.email) || '' } } };
    var confidence = 0.3;
    var unnamed = function () { return free ? 'Unknown sender (' + local + ')' : titleCase(domainLabel(domain)) || 'Unknown sender'; };

    // Bin first.
    if (SCAM_STRONG.filter(function (re) { return re.test(text); }).length * 2 + countCues(SCAM_WEAK, text) >= 2 && !/\bwe (help|build|provide)\b/i.test(text)) {
      raw.isPitch = false; raw.binReason = 'scam';
      raw.company.name = fromName || unnamed();
      if (free) raw.id = T.slugify(address);
      raw.sells = { summary: 'Nothing. Reads like an advance-fee fraud.', category: 'fraud', tags: [] };
      raw.confidence = 0.8; raw.dealerNote = 'Simple reader: scam cues found. Binned.';
      return T.normalizeCard(raw, sourceOf(email));
    }
    var editorial = countCues(NEWSLETTER_EDITORIAL, text);
    if (editorial >= 1 && editorial + countCues(NEWSLETTER_FOOTER, text) >= 2) {
      raw.isPitch = false; raw.binReason = 'newsletter';
      raw.company.name = fromName || unnamed();
      if (free) raw.id = T.slugify(address);
      raw.sells = { summary: 'A newsletter; sells nothing in this email', category: 'newsletter', tags: [] };
      raw.confidence = 0.7; raw.dealerNote = 'Simple reader: looks like a newsletter, not a pitch. Binned.';
      return T.normalizeCard(raw, sourceOf(email));
    }

    // Company name: the domain spelled out in the text (never a free-mail provider's), else the signature, else the
    // sender introducing the company. A free-mail sender who never names one is an unknown company, filed by address.
    var name = free ? null : nameFromDomainWindow(text, domain);
    if (name) confidence += 0.15;
    else { name = nameFromSignature(body, fromName) || nameFromIntro(text); if (name) confidence += 0.1; }
    var known = !!name;
    if (!name) name = free ? 'Unknown company (' + local + ')' : titleCase(domainLabel(domain) || 'Unknown company');
    raw.company.name = name;
    if (free && !known) raw.id = T.slugify(address);  // unique per sender address: two such pitches never merge

    // What it sells: the sentences that say what the company does, best first (its own name with a verb).
    var main = withoutSignature(body);
    var sents = sentences(main).map(stripGreeting).filter(function (x) { return x.length >= 12 && x.length < 240; });
    var rank = function (x) {
      return (known && x.indexOf(name) >= 0 ? 4 : (known && shortNamedVerb(x, name) ? 3 : 0)) + (known && (namedVerb(x, name) || shortNamedVerb(x, name)) ? 2 : 0) +
        (PITCH_VERB.test(x) ? 2 : 0) - (/\?$/.test(x) ? 1 : 0);
    };
    var candidates = sents.filter(function (x) { return (known && (namedVerb(x, name) || shortNamedVerb(x, name))) || PITCH_VERB.test(x); })
      .map(function (x, i) { return { s: x, r: rank(x), i: i }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; })
      .map(function (c) { return c.s; });
    var rule = null;
    for (var k = 0; k < candidates.length && !rule; k++) rule = ruleFor(candidates[k]);
    if (!rule) rule = ruleFor(email.subject || '') || ruleFor(main);
    if (!rule && SOFTWARE_CUES.test(main)) rule = SOFTWARE_RULE;
    var pitchSentence = candidates[0];
    var summary = pitchSentence ? pitchSentence.replace(/\s+/g, ' ').replace(/[.!]$/, '') : (email.subject || 'Unclear');
    if (summary.length > 140) summary = summary.slice(0, 137).replace(/\s+\S*$/, '') + '…';
    raw.sells = { summary: summary, category: rule ? rule.category : 'other', tags: rule ? rule.name.split(' ') : [] };
    if (rule) confidence += 0.15;

    // Who it wants (targets)
    var industries = [];
    if (/e-?commerce|online (store|seller|brand)s?|retail/i.test(text)) industries.push('ecommerce');
    if (/\bsaas\b|software compan/i.test(text)) industries.push('saas');
    if (/fintech/i.test(text)) industries.push('fintech');
    if (/recruiting agenc|hr teams?/i.test(text)) industries.push('recruiting');
    var roles = [];
    if (/founders?/i.test(text)) roles.push('founder');
    if (/\bcfos?\b|finance team/i.test(text)) roles.push('cfo');
    if (/\bctos?\b|hiring engineers|engineering (lead|manager)/i.test(text)) roles.push('cto');
    if (/office managers?/i.test(text)) roles.push('office manager');
    if (/support team/i.test(text)) roles.push('support');
    if (/sales team/i.test(text)) roles.push('sales');
    if (/hr teams?|recruiters|recruiting (agencies|teams)/i.test(text)) roles.push('recruiting');
    if (/marketing/i.test(text)) roles.push('marketing');
    var tags = [];
    if (/(no|without|don't have an?) finance team/i.test(text)) tags.push('no-finance-team');
    if (/for offices|offices of|your office|with an office/i.test(text)) tags.push('has-office');
    if (/still remote|without a lease|don't want a lease/i.test(text)) tags.push('no-office');
    if (/support team/i.test(text)) tags.push('support-team');
    if (/sales team/i.test(text)) tags.push('sales-team');
    if (/hiring|\bhire\b/i.test(text)) tags.push('hiring');
    if (/enterprise/i.test(text)) tags.push('sells-to-enterprise');
    if (/\besg\b|carbon/i.test(text)) tags.push('esg');
    if (/online sellers?|e-?commerce brands?/i.test(text)) tags.push('online-seller');
    if (/subscription (billing|or usage)|usage or subscription/i.test(text)) tags.push('subscription-billing');
    if (/startups?/i.test(text)) tags.push('startup');
    if (/\bb2b\b/i.test(text)) tags.push('b2b');
    var sizeBands = parseSizeBands(text);
    if (industries.length || roles.length || tags.length) confidence += 0.1;
    if (sizeBands.length) confidence += 0.1;
    var tSummary = (industries.length ? industries.map(function (i) { return T.INDUSTRY_LABEL[i]; }).join(' and ') + ' companies' : 'companies') +
      (sizeBands.length ? ' of ' + sizeBands[0].split('-')[0] + '–' + sizeBands[sizeBands.length - 1].replace('1000+', '1000+').split('-').pop() + ' people' : '') +
      (roles.length ? ', pitching ' + roles.join(' / ') : '');
    raw.targets = { summary: tSummary, industries: industries.length ? industries : ['any'], sizeBands: sizeBands, roles: roles, tags: T.uniq(tags) };

    // About the sender
    var sizeM = body.match(/(\d{1,4})[- ]person (team|studio|startup|company)|team of (\d{1,4})|(\d{1,4}) engineers,/i);
    var size = sizeM ? Number(sizeM[1] || sizeM[3] || sizeM[4]) : (rule && T.INDUSTRY_SECTOR[rule.industry] === 'software' ? 30 : 20);
    var hasOffice = /\b(studio|roastery|warehouses?|our office|private offices)\b/i.test(body) ? true : (/\bremote\b/i.test(body) ? false : null);
    raw.profile = { industry: rule ? rule.industry : 'other', size: size, hasOffice: hasOffice, teams: rule ? rule.teams : ['sales'], hiring: /we'?re hiring|join (us|our team)/i.test(text), stage: size <= 50 ? 'startup' : 'growth', tags: [] };
    raw.confidence = known ? Math.min(0.8, confidence) : Math.min(free ? 0.2 : 0.3, confidence);
    raw.dealerNote = 'Read offline by keyword rules' + (rule ? ' (matched "' + rule.name + '")' : ' (no product rule matched)') + '.' +
      (free && !known ? ' Sent from a free-mail address and never names its company.' : '') + ' Treat as a sketch; the live reader does this properly.';
    return T.normalizeCard(raw, sourceOf(email));
  }

  // ---------------- 3. The live reader: a Claude API request ----------------
  var DEFAULT_MODEL = 'claude-opus-5-5';
  var MODELS = [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (default)' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (cheaper)' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (cheapest)' }
  ];

  var SYSTEM_PROMPT = [
    'You are the Dealer at SpamDeck, a marketplace where companies pay to pitch each other with everyone’s consent.',
    'You read one unsolicited sales email and deal one card: who sent it, what they sell, and who they want to reach.',
    'Rules:',
    '- Use only what the email says or clearly implies. Never invent facts. When the email does not say, pick the most likely value and lower your confidence.',
    '- isPitch is false for scams, newsletters, personal mail, receipts and anything that is not a company selling something. Then set binReason (scam | newsletter | personal | other) and keep the rest minimal.',
    '- profile describes the SENDER (the company behind the email): industry, approximate headcount, whether it has an office, which teams it plainly has, whether it is hiring.',
    '- targets describes WHO THE SENDER WANTS TO REACH: industries (use "any" if they pitch everyone), size bands, the roles they pitch to, and the situations they look for.',
    '- Use the controlled vocabulary exactly; it is what makes cards comparable.',
    '- dealerNote is one dry, specific sentence about this card. Observant, never cruel.',
    '- Contact details come from the email itself only.'
  ].join('\n');

  function enumOf(list) { return { type: 'string', enum: list }; }
  var SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['isPitch', 'binReason', 'company', 'sells', 'profile', 'targets', 'confidence', 'dealerNote'],
    properties: {
      isPitch: { type: 'boolean' },
      binReason: { type: ['string', 'null'], enum: ['scam', 'newsletter', 'personal', 'other', null] },
      company: {
        type: 'object', additionalProperties: false, required: ['name', 'domain', 'contact'],
        properties: {
          name: { type: 'string' }, domain: { type: 'string' },
          contact: { type: 'object', additionalProperties: false, required: ['name', 'title', 'email'], properties: { name: { type: 'string' }, title: { type: 'string' }, email: { type: 'string' } } }
        }
      },
      sells: {
        type: 'object', additionalProperties: false, required: ['summary', 'category', 'tags'],
        properties: { summary: { type: 'string', description: 'One line, under 90 characters, e.g. "Bookkeeping automation for small companies"' }, category: { type: 'string', description: 'kebab-case product category, e.g. bookkeeping-software, recruiting-services' }, tags: { type: 'array', items: { type: 'string' } } }
      },
      profile: {
        type: 'object', additionalProperties: false, required: ['industry', 'size', 'hasOffice', 'teams', 'hiring', 'stage', 'tags'],
        properties: {
          industry: enumOf(T.INDUSTRIES), size: { type: 'integer', description: 'best-guess headcount' },
          hasOffice: { type: ['boolean', 'null'] }, teams: { type: 'array', items: enumOf(T.TEAMS) }, hiring: { type: 'boolean' },
          stage: enumOf(T.STAGES), tags: { type: 'array', items: enumOf(T.SITUATIONS) }
        }
      },
      targets: {
        type: 'object', additionalProperties: false, required: ['summary', 'industries', 'sizeBands', 'roles', 'tags'],
        properties: {
          summary: { type: 'string' }, industries: { type: 'array', items: enumOf(T.INDUSTRIES.concat(['any'])) },
          sizeBands: { type: 'array', items: enumOf(T.SIZE_BANDS) }, roles: { type: 'array', items: enumOf(T.ROLES) },
          tags: { type: 'array', items: enumOf(T.SITUATIONS) }
        }
      },
      // No minimum/maximum: structured outputs reject numerical constraints with a 400, and this schema is sent with fetch,
      // not through an SDK that would strip them. The range is stated here and enforced by normalizeCard (clamped to 0..1).
      confidence: { type: 'number', description: 'How sure you are of this card, from 0 (a guess) to 1 (certain)' },
      dealerNote: { type: 'string' }
    }
  };

  function userPromptFor(email) {
    return 'Read this unsolicited email and deal the card.\n\n' +
      'From: ' + (email.from ? ((email.from.name ? email.from.name + ' ' : '') + '<' + (email.from.email || '') + '>') : 'unknown') + '\n' +
      'Received: ' + (email.receivedAt || 'unknown') + '\n' +
      'Subject: ' + (email.subject || '') + '\n\n' + (email.body || '');
  }

  // The request, minus the key. The app adds `x-api-key` and sends it straight from the browser.
  function buildRequest(email, opts) {
    opts = opts || {};
    var model = opts.model || DEFAULT_MODEL;
    var headers = {
      'content-type': 'application/json',
      'anthropic-version': '2026-10-21',
      // The key is the user's own and the call goes straight to Anthropic from their browser; this header opts in to that.
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    var body = {
      model: model,
      max_tokens: 16000, // thinking counts against this on Opus 5.5; a card needs far less, the cap just must not bite
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: userPromptFor(email) }]
    };
    if (/opus|sonnet|fable/.test(model)) {
      // If a safety classifier declines, let the API re-run the request on a fallback model in the same call.
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    return { url: 'https://api.anthropic.com/v1/messages', method: 'POST', headers: headers, body: body };
  }

  // Turn the API's JSON response into a card.
  function parseReading(response, email, model) {
    if (!response || typeof response !== 'object') throw new Error('Empty response from the API.');
    if (response.type === 'error') throw new Error('API error: ' + ((response.error && response.error.message) || 'unknown'));
    if (response.stop_reason === 'refusal') {
      var cat = response.stop_details && response.stop_details.category;
      throw new Error('Claude declined to read this email' + (cat ? ' (' + cat + ')' : '') + '.');
    }
    if (response.stop_reason === 'max_tokens') throw new Error('The reading was cut off (max_tokens). Try again.');
    var text = (Array.isArray(response.content) ? response.content : []).filter(function (b) { return b && b.type === 'text'; }).map(function (b) { return b.text; }).join('');
    var raw;
    try { raw = JSON.parse(text); } catch (e) { throw new Error('Claude returned something that is not JSON: ' + text.slice(0, 120)); }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Claude returned JSON that is not a card: ' + text.slice(0, 120));
    raw.readBy = 'claude:' + (response.model || model || DEFAULT_MODEL);
    var card = T.normalizeCard(raw, sourceOf(email));
    card.usage = response.usage ? { input: response.usage.input_tokens, output: response.usage.output_tokens } : null;
    return card;
  }

  // ---------------- 4. Dedupe and tally ----------------
  // One company that emailed three inboxes is one card with three sources.
  // The cards passed in are not changed: the result holds copies. A source already on the card (same email) is not added
  // twice, and only a card that gained a new source counts as a merged repeat sender.
  function mergeCards(cards) {
    var byId = {}, order = [], merged = [];
    function sameEmail(a, b) { return a && b && a.emailId != null && a.emailId === b.emailId; }
    (cards || []).forEach(function (c) {
      if (!c) return;
      var incoming = Array.isArray(c.sources) ? c.sources.filter(Boolean) : [];
      if (!Object.prototype.hasOwnProperty.call(byId, c.id)) { byId[c.id] = Object.assign({}, c, { sources: incoming.slice() }); order.push(c.id); return; }
      var keep = byId[c.id];
      var sources = keep.sources.slice(), added = 0;
      incoming.forEach(function (src) { if (!sources.some(function (x) { return sameEmail(x, src); })) { sources.push(src); added++; } });
      byId[c.id] = c.confidence > keep.confidence ? Object.assign({}, c, { sources: sources }) : Object.assign({}, keep, { sources: sources }); // the better reading, all the sources
      if (added && merged.indexOf(c.id) < 0) merged.push(c.id);
    });
    return { cards: order.map(function (id) { return byId[id]; }), merged: merged };
  }

  // Synchronous dealing (fixture or heuristic). The live reader is async and handled by the app, card by card.
  function dealEmails(emails, readFn) {
    var cards = [], errors = [];
    (emails || []).forEach(function (e) {
      if (!e) { errors.push({ emailId: null, error: 'no email' }); return; }
      try { var c = readFn(e); if (c) cards.push(c); else errors.push({ emailId: e.id, error: 'no reading' }); }
      catch (err) { errors.push({ emailId: e.id, error: err && err.message ? err.message : String(err) }); }
    });
    var m = mergeCards(cards);
    var binned = m.cards.filter(T.isBinned);
    return { cards: m.cards, live: m.cards.filter(function (c) { return !T.isBinned(c); }), binned: binned, merged: m.merged, errors: errors, read: (emails || []).length };
  }

  function tally(result) {
    var bins = {};
    result.binned.forEach(function (c) { var r = c.binReason || 'other'; bins[r] = (bins[r] || 0) + 1; });
    var binText = Object.keys(bins).map(function (k) { return bins[k] + ' ' + k; }).join(', ');
    var s = 'Read ' + result.read + '. Dealt ' + result.live.length + '.';
    if (result.binned.length) s += ' Binned ' + result.binned.length + ' (' + binText + ').';
    if (result.merged.length) s += ' Merged ' + result.merged.length + ' repeat sender' + (result.merged.length === 1 ? '' : 's') + ' into one card each.';
    if (result.errors.length) s += ' ' + result.errors.length + ' could not be read.';
    return s;
  }

  return {
    READER_LABEL: READER_LABEL, CATEGORY_RULES: CATEGORY_RULES, SYSTEM_PROMPT: SYSTEM_PROMPT, SCHEMA: SCHEMA, DEFAULT_MODEL: DEFAULT_MODEL, MODELS: MODELS,
    sourceOf: sourceOf, readFixture: readFixture, heuristicRead: heuristicRead, buildRequest: buildRequest, userPromptFor: userPromptFor, parseReading: parseReading,
    mergeCards: mergeCards, dealEmails: dealEmails, tally: tally
  };
});
