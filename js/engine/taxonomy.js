/* SpamDeck — shared vocabulary and card normalisation.
   Pure data + pure functions. Loads in the browser (window.SpamDeck.taxonomy) and in Node (require). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpamDeck = root.SpamDeck || {};
  root.SpamDeck.taxonomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- Controlled vocabulary. The Dealer (AI or heuristic) must pick from these so cards compare. ---
  var SIZE_BANDS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

  var INDUSTRIES = ['saas', 'fintech', 'hr-tech', 'sales-tools', 'ecommerce', 'retail', 'logistics',
    'recruiting', 'security', 'agency', 'media', 'furniture', 'food-beverage', 'climate', 'dev-services',
    'venture-capital', 'real-estate', 'creative', 'consulting', 'healthcare', 'manufacturing', 'education', 'other'];

  var INDUSTRY_SECTOR = {
    'saas': 'software', 'fintech': 'software', 'hr-tech': 'software', 'sales-tools': 'software',
    'ecommerce': 'commerce', 'retail': 'commerce',
    'logistics': 'services', 'recruiting': 'services', 'security': 'services', 'agency': 'services',
    'media': 'services', 'climate': 'services', 'dev-services': 'services', 'real-estate': 'services',
    'creative': 'services', 'consulting': 'services',
    'furniture': 'physical-goods', 'food-beverage': 'physical-goods', 'manufacturing': 'physical-goods',
    'venture-capital': 'finance',
    'healthcare': 'other', 'education': 'other', 'other': 'other'
  };
  // Sectors broad enough that "I target SaaS" fairly covers an hr-tech company, or "e-commerce" covers retail.
  var UMBRELLA_SECTORS = { software: true, commerce: true };

  var INDUSTRY_LABEL = {
    'saas': 'SaaS', 'fintech': 'fintech', 'hr-tech': 'HR tech', 'sales-tools': 'sales tools',
    'ecommerce': 'e-commerce', 'retail': 'retail', 'logistics': 'logistics', 'recruiting': 'recruiting',
    'security': 'security', 'agency': 'agency', 'media': 'media', 'furniture': 'furniture',
    'food-beverage': 'food & beverage', 'climate': 'climate', 'dev-services': 'dev services',
    'venture-capital': 'venture capital', 'real-estate': 'real estate', 'creative': 'creative',
    'consulting': 'consulting', 'healthcare': 'healthcare', 'manufacturing': 'manufacturing',
    'education': 'education', 'other': 'other', 'any': 'any industry'
  };

  var TEAMS = ['engineering', 'sales', 'support', 'marketing', 'finance', 'hr', 'recruiting', 'ops'];

  var ROLES = ['founder', 'ceo', 'ops', 'office manager', 'cfo', 'finance', 'cto', 'engineering',
    'hiring manager', 'hr', 'recruiting', 'sales', 'marketing', 'support'];

  // Situations: what a company IS (for the matcher's "B is ..." side) and what a pitcher LOOKS FOR.
  var SITUATIONS = ['startup', 'hiring', 'has-office', 'no-office', 'remote', 'sales-team', 'support-team',
    'engineering-team', 'marketing-team', 'finance-team', 'no-finance-team', 'hr-team',
    'sells-to-enterprise', 'b2b', 'esg', 'online-seller', 'subscription-billing'];

  var SITUATION_LABEL = {
    'startup': 'is a startup', 'hiring': 'is hiring', 'has-office': 'has an office', 'no-office': 'has no office',
    'remote': 'is remote', 'sales-team': 'has a sales team', 'support-team': 'has a support team',
    'engineering-team': 'has engineers', 'marketing-team': 'has a marketing team', 'finance-team': 'has a finance team',
    'no-finance-team': 'has no finance team', 'hr-team': 'has an HR team', 'sells-to-enterprise': 'sells to enterprises',
    'b2b': 'sells to businesses', 'esg': 'has ESG goals', 'online-seller': 'sells online',
    'subscription-billing': 'bills by subscription'
  };

  var STAGES = ['startup', 'growth', 'established'];

  // What a target role needs on the other side, in plain words (used for match reasons).
  var ROLE_NEEDS = {
    'founder': { weak: true, label: 'a founder' },
    'ceo': { weak: true, label: 'a CEO' },
    'ops': { weak: true, label: 'someone running operations' },
    'office manager': { team: null, needs: 'office', label: 'an office' },
    'cfo': { team: 'finance', label: 'a finance team' },
    'finance': { team: 'finance', label: 'a finance team' },
    'cto': { team: 'engineering', label: 'an engineering team' },
    'engineering': { team: 'engineering', label: 'an engineering team' },
    'hiring manager': { needs: 'hiring', label: 'open roles' },
    'hr': { team: 'hr', altTeam: 'recruiting', label: 'an HR team' },
    'recruiting': { team: 'recruiting', altTeam: 'hr', label: 'recruiters' },
    'sales': { team: 'sales', label: 'a sales team' },
    'marketing': { team: 'marketing', label: 'a marketing team' },
    'support': { team: 'support', label: 'a support team' }
  };

  // How each role reads in a sentence, in the plural ("pitches to CTOs").
  var ROLE_PLURAL = {
    'founder': 'founders', 'ceo': 'CEOs', 'ops': 'ops leads', 'office manager': 'office managers', 'cfo': 'CFOs',
    'finance': 'finance teams', 'cto': 'CTOs', 'engineering': 'engineers', 'hiring manager': 'hiring managers', 'hr': 'HR',
    'recruiting': 'recruiters', 'sales': 'sales teams', 'marketing': 'marketing teams', 'support': 'support teams'
  };

  function bandOf(size) {
    var n = Number(size) || 1;
    if (n <= 10) return '1-10';
    if (n <= 50) return '11-50';
    if (n <= 200) return '51-200';
    if (n <= 1000) return '201-1000';
    return '1000+';
  }

  function bandIndex(band) { return SIZE_BANDS.indexOf(band); }

  function slugify(s) {
    return String(s || '').toLowerCase().replace(/\.example$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company';
  }

  // A list without repeats, in first-seen order. Compared with indexOf, not a lookup object: with a plain object,
  // "constructor" and "toString" looked already seen and were silently dropped.
  function uniq(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (x) { if (x != null && out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  function has(arr, x) { return Array.isArray(arr) && arr.indexOf(x) >= 0; }

  // ---------------- Reading odd input ----------------
  // Readings come from hand labels, keyword rules, an AI and people pasting things. A list may arrive as a list,
  // one word, or "a, b"; a yes/no as a word; a number as text.
  function str(x) { return x == null ? '' : String(x); }
  function word(x) { return str(x).trim().toLowerCase(); }
  function list(x) {
    if (Array.isArray(x)) return x.slice();
    if (typeof x === 'string') return x.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }
  // Only the words of the controlled vocabulary survive, matched without regard to case or stray spaces.
  function vocab(x, allowed) { return uniq(list(x).map(word).filter(function (w) { return has(allowed, w); })); }
  function yes(v) { return typeof v === 'string' ? /^(true|yes|y|1)$/i.test(v.trim()) : !!v; }
  function yesNoUnknown(v) {
    if (v === true || v === false) return v;
    if (typeof v === 'string') {
      if (/^(true|yes|y|1)$/i.test(v.trim())) return true;
      if (/^(false|no|n|0)$/i.test(v.trim())) return false;
    }
    return null;
  }
  // A headcount is a whole number of people, at least one. "1,200" and "40 people" are read; nonsense becomes the default.
  function toSize(v) {
    var n = typeof v === 'number' ? v : (typeof v === 'string' ? Number((v.replace(/[,_]/g, '').match(/-?\d+(\.\d+)?/) || [''])[0] || NaN) : NaN);
    n = Math.round(n);
    return isFinite(n) && n >= 1 ? n : 10;
  }
  function toConfidence(v) {
    var n = (v == null || v === '') ? 0.5 : Number(v);
    if (!isFinite(n)) n = 0.5;
    return Math.max(0, Math.min(1, n));
  }
  function kebab(s) { return word(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function titleWords(s) { return str(s).split(/[-_\s]+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' '); }

  // ---------------- Domains ----------------
  // "https://www.Acme.io/about" -> "acme.io". Kept as sent otherwise (a subdomain stays on the card).
  function cleanDomain(d) {
    return word(d).replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.+$/, '');
  }
  // The domain of an address is what follows the LAST @ ("a@b@acme.io" is acme.io), up to a closing bracket or space.
  function emailDomain(email) {
    var e = word(email), at = e.lastIndexOf('@');
    return at >= 0 ? cleanDomain(e.slice(at + 1).replace(/[>\s].*$/, '')) : '';
  }
  // The part of a domain that names the company: mail.bigcorp-sales.com -> bigcorp-sales.com, shop.acme.co.uk -> acme.co.uk.
  var SECOND_LEVEL = /^(co|com|org|net|ac|gov|edu|ne|or|ltd|plc)$/;
  function companyDomain(domain) {
    var labels = cleanDomain(domain).split('.').filter(Boolean), n = labels.length;
    if (n <= 2) return labels.join('.');
    return labels.slice(labels[n - 1].length === 2 && SECOND_LEVEL.test(labels[n - 2]) ? -3 : -2).join('.');
  }
  // Addresses anyone can get. The domain says nothing about the company, so it never names or files a card.
  var FREE_MAIL_DOMAINS = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'yahoo.com', 'ymail.com',
    'rocketmail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de',
    'web.de', 'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com', 'naver.com',
    'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'btinternet.com', 'orange.fr', 'free.fr', 'laposte.net', 'libero.it',
    'seznam.cz', 'wp.pl', 'o2.pl', 't-online.de', 'mailbox.org', 'tutanota.com', 'tuta.io', 'inbox.com', 'rediffmail.com'];
  var FREE_MAIL_NAMES = /^(gmail|googlemail|hotmail|outlook|yahoo|ymail|protonmail|icloud)$/;  // any country ending: hotmail.fr, yahoo.co.jp
  function isFreeMail(domain) {
    var d = companyDomain(domain);
    return !!d && (has(FREE_MAIL_DOMAINS, d) || FREE_MAIL_NAMES.test(d.split('.')[0]));
  }

  // Product categories that say nothing about the product. Two companies that share one are not rivals.
  var GENERIC_CATEGORIES = { other: true, software: true };
  function isGenericCategory(cat) { return !cat || Object.prototype.hasOwnProperty.call(GENERIC_CATEGORIES, cat); }

  // Derive the situations a company is in from its profile (so fixtures and the AI stay short).
  function deriveSituations(profile) {
    var p = profile || {};
    var out = [];
    var teams = p.teams || [];
    if (has(teams, 'sales')) out.push('sales-team');
    if (has(teams, 'support')) out.push('support-team');
    if (has(teams, 'engineering')) out.push('engineering-team');
    if (has(teams, 'marketing')) out.push('marketing-team');
    if (has(teams, 'hr') || has(teams, 'recruiting')) out.push('hr-team');
    if (has(teams, 'finance')) out.push('finance-team');
    else if ((Number(p.size) || 0) < 200) out.push('no-finance-team');
    if (p.hasOffice === true) out.push('has-office');
    if (p.hasOffice === false) { out.push('no-office'); out.push('remote'); }
    if (p.hiring) out.push('hiring');
    if (p.stage === 'startup' || ((Number(p.size) || 0) <= 50 && INDUSTRY_SECTOR[p.industry] === 'software')) out.push('startup');
    if (p.industry === 'ecommerce' || p.industry === 'retail') out.push('online-seller');
    return uniq(out.concat(p.tags || []));
  }

  // Turn a raw reading (fixture, heuristic, or AI JSON) into a card the matcher and market understand.
  // Never throws on odd input: unknown words are dropped, odd numbers become defaults, and a non-pitch is always binned.
  function normalizeCard(raw, source) {
    raw = raw || {};
    var company = raw.company || {};
    var contact = Object.assign({ name: '', title: '', email: '' }, company.contact || {});
    var domain = cleanDomain(company.domain) || emailDomain(contact.email);
    var free = isFreeMail(domain);
    var given = str(company.name).trim();
    var name = given || (domain && !free ? titleWords(companyDomain(domain).split('.')[0]) : '') || 'Unknown company';
    // One company, one card: filed under the company's own domain, never a mail server's subdomain or a free-mail provider.
    var fileUnder = domain && !free ? companyDomain(domain) : (given || (free ? word(contact.email) : '') || name);

    var p = raw.profile || {};
    var profile = Object.assign({ industry: 'other', size: 10, hasOffice: null, teams: [], hiring: false, stage: 'growth', tags: [] }, p);
    profile.industry = has(INDUSTRIES, word(p.industry)) ? word(p.industry) : 'other';
    profile.size = toSize(p.size);
    profile.hasOffice = yesNoUnknown(p.hasOffice);
    profile.hiring = yes(p.hiring);
    profile.stage = has(STAGES, word(p.stage)) ? word(p.stage) : 'growth';
    profile.sector = INDUSTRY_SECTOR[profile.industry] || 'other';
    profile.sizeBand = bandOf(profile.size);
    profile.teams = vocab(p.teams, TEAMS);
    profile.tags = vocab(p.tags, SITUATIONS);

    var t = raw.targets || {};
    var targets = Object.assign({ summary: '', industries: ['any'], sizeBands: [], roles: [], tags: [] }, t);
    targets.summary = str(t.summary);
    targets.industries = vocab(t.industries, INDUSTRIES.concat(['any']));
    if (!targets.industries.length) targets.industries = ['any'];
    targets.sizeBands = vocab(t.sizeBands, SIZE_BANDS);
    targets.roles = vocab(t.roles, ROLES);
    targets.tags = vocab(t.tags, SITUATIONS);

    var s = raw.sells || {};
    var sells = Object.assign({ summary: '', category: 'other', tags: [] }, s);
    sells.summary = str(s.summary);
    sells.category = kebab(s.category) || 'other';
    sells.tags = uniq(list(s.tags).map(word).filter(Boolean));

    var flags = uniq(list(raw.flags).map(function (f) { return str(f).trim(); }).filter(Boolean));
    var binReason = raw.binReason ? str(raw.binReason).trim() || null : null;
    if (yesNoUnknown(raw.isPitch) === false) {   // not a pitch: always binned, with a reason
      binReason = binReason || 'other';
      if (!has(flags, binReason)) flags.push(binReason);
    }
    var src = source ? [source] : [];
    if (Array.isArray(raw.sources)) src = raw.sources.concat(src);
    return {
      id: raw.id || slugify(fileUnder),
      company: {
        name: name,
        domain: domain,
        contact: contact
      },
      sells: sells,
      profile: profile,
      situations: deriveSituations(profile),
      targets: targets,
      confidence: toConfidence(raw.confidence),
      flags: flags,
      binReason: binReason,
      dealerNote: str(raw.dealerNote),
      sources: src,
      readBy: raw.readBy || 'unknown'
    };
  }

  function isBinned(card) { return !!(card && card.flags && card.flags.length); }

  return {
    SIZE_BANDS: SIZE_BANDS, INDUSTRIES: INDUSTRIES, INDUSTRY_SECTOR: INDUSTRY_SECTOR, UMBRELLA_SECTORS: UMBRELLA_SECTORS,
    INDUSTRY_LABEL: INDUSTRY_LABEL, TEAMS: TEAMS, ROLES: ROLES, ROLE_NEEDS: ROLE_NEEDS, ROLE_PLURAL: ROLE_PLURAL, SITUATIONS: SITUATIONS,
    SITUATION_LABEL: SITUATION_LABEL, STAGES: STAGES,
    bandOf: bandOf, bandIndex: bandIndex, slugify: slugify, uniq: uniq, has: has,
    deriveSituations: deriveSituations, normalizeCard: normalizeCard, isBinned: isBinned,
    FREE_MAIL_DOMAINS: FREE_MAIL_DOMAINS, GENERIC_CATEGORIES: GENERIC_CATEGORIES,
    companyDomain: companyDomain, isFreeMail: isFreeMail, isGenericCategory: isGenericCategory
  };
});
