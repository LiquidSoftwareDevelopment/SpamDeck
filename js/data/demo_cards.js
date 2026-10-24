/* SpamDeck — pre-labelled readings of the demo inbox.
   HONESTY NOTE: these were written by hand for the demo (by the model that built SpamDeck), not recorded from a live
   API call. The live reader (Claude, bring-your-own-key) produces the same shape from the same prompt; the offline
   "simple reader" produces a cruder version. Each card in the app says which reader made it. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpamDeck = root.SpamDeck || {};
  root.SpamDeck.demoCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var READINGS = {
    e01: {
      company: { name: 'Ledgerly', domain: 'ledgerly.example', contact: { name: 'Dana Whitfield', title: 'Head of Growth', email: 'dana@ledgerly.example' } },
      sells: { summary: 'Bookkeeping automation for small companies without a finance team', category: 'bookkeeping-software', tags: ['bookkeeping', 'accounting', 'finance', 'automation'] },
      profile: { industry: 'fintech', size: 40, hasOffice: true, teams: ['engineering', 'sales', 'support'], hiring: true, stage: 'startup', tags: ['subscription-billing'] },
      targets: { summary: 'Companies of 10–200 people with no finance team', industries: ['any'], sizeBands: ['11-50', '51-200'], roles: ['founder', 'ops'], tags: ['no-finance-team', 'startup'] },
      confidence: 0.92,
      dealerNote: 'Wants to do your books. Forty people, hiring engineers, runs a support desk — which makes it somebody else’s customer.'
    },
    e02: {
      company: { name: 'Hirewire', domain: 'hirewire.example', contact: { name: 'Marcus Bell', title: 'Partner', email: 'marcus@hirewire.example' } },
      sells: { summary: 'Engineering recruitment for SaaS and fintech companies, paid on placement', category: 'recruiting-services', tags: ['recruiting', 'engineers', 'hiring', 'placement'] },
      profile: { industry: 'recruiting', size: 25, hasOffice: true, teams: ['sales', 'ops', 'recruiting'], hiring: false, stage: 'growth', tags: [] },
      targets: { summary: 'SaaS and fintech companies of 20–500 people hiring engineers', industries: ['saas', 'fintech'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['cto', 'hiring manager'], tags: ['hiring'] },
      confidence: 0.95,
      dealerNote: 'Emailed twice. Second time to say the first time didn’t work. Twenty-five people, no finance team, pays on results.'
    },
    e14: { sameAs: 'e02' },
    e03: {
      company: { name: 'Fortify Labs', domain: 'fortifylabs.example', contact: { name: 'Priyanka Rao', title: 'Founder', email: 'priyanka@fortifylabs.example' } },
      sells: { summary: 'SOC 2 audit preparation and penetration testing in about eight weeks', category: 'security-services', tags: ['security', 'soc2', 'compliance', 'pentest'] },
      profile: { industry: 'security', size: 15, hasOffice: false, teams: ['engineering', 'sales'], hiring: true, stage: 'startup', tags: [] },
      targets: { summary: 'Software companies of 20–300 people selling to enterprises', industries: ['saas', 'fintech', 'hr-tech', 'sales-tools'], sizeBands: ['11-50', '51-200'], roles: ['cto', 'founder'], tags: ['sells-to-enterprise'] },
      confidence: 0.9,
      dealerNote: 'Sells the PDF that unblocks enterprise deals. Fifteen people, remote, hiring.'
    },
    e04: {
      company: { name: 'Deskwell', domain: 'deskwell.example', contact: { name: 'Tom Garrity', title: 'Account Executive', email: 'tom@deskwell.example' } },
      sells: { summary: 'Sit-stand desks and ergonomic chairs for offices, volume pricing', category: 'office-furniture', tags: ['furniture', 'desks', 'chairs', 'office'] },
      profile: { industry: 'furniture', size: 80, hasOffice: true, teams: ['sales', 'ops', 'support'], hiring: false, stage: 'established', tags: ['b2b'] },
      targets: { summary: 'Any company of 10 or more people with an office', industries: ['any'], sizeBands: ['11-50', '51-200', '201-1000', '1000+'], roles: ['office manager', 'ops'], tags: ['has-office'] },
      confidence: 0.88,
      dealerNote: 'Pitched two inboxes in this pool with the same email. One card, two witnesses.'
    },
    p05: { sameAs: 'e04' },
    e05: {
      company: { name: 'Chatterbox AI', domain: 'chatterbox.example', contact: { name: 'Lena Park', title: 'SDR', email: 'lena@chatterbox.example' } },
      sells: { summary: 'AI support agent that answers the repetitive 40% of tickets', category: 'support-software', tags: ['ai', 'support', 'chatbot', 'helpdesk'] },
      profile: { industry: 'saas', size: 30, hasOffice: false, teams: ['engineering', 'sales', 'support'], hiring: true, stage: 'startup', tags: ['subscription-billing'] },
      targets: { summary: 'E-commerce and SaaS companies with a support team of two or more', industries: ['ecommerce', 'saas', 'retail'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['support'], tags: ['support-team'] },
      confidence: 0.93,
      dealerNote: 'Promises to answer 40% of your tickets. Has a support team of its own, so the promise cuts both ways.'
    },
    e06: {
      company: { name: 'Meridian Outbound', domain: 'meridianoutbound.example', contact: { name: 'Greg Falco', title: 'Managing Director', email: 'greg@meridianoutbound.example' } },
      sells: { summary: 'Outsourced outbound sales: sequences, sending and meeting booking', category: 'lead-generation', tags: ['outbound', 'lead-gen', 'sales', 'meetings'] },
      profile: { industry: 'agency', size: 50, hasOffice: true, teams: ['sales', 'ops'], hiring: false, stage: 'growth', tags: ['b2b'] },
      targets: { summary: 'B2B companies with a sales team', industries: ['any'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['sales', 'ceo'], tags: ['sales-team', 'b2b'] },
      confidence: 0.9,
      dealerNote: 'Sells the thing this email is.'
    },
    e07: {
      company: { name: 'Nordic Bean', domain: 'nordicbean.example', contact: { name: 'Astrid Lund', title: 'Founder', email: 'astrid@nordicbean.example' } },
      sells: { summary: 'Office coffee subscription: beans, machine and service per head', category: 'office-supplies', tags: ['coffee', 'office', 'subscription', 'perks'] },
      profile: { industry: 'food-beverage', size: 12, hasOffice: true, teams: ['ops', 'sales'], hiring: false, stage: 'startup', tags: ['b2b'] },
      targets: { summary: 'Offices of 20 or more people', industries: ['any'], sizeBands: ['11-50', '51-200', '201-1000', '1000+'], roles: ['office manager', 'ops'], tags: ['has-office'] },
      confidence: 0.85,
      dealerNote: 'Opened with an insult about your coffee, then admitted it was a guess. Twelve people and a roastery.'
    },
    e08: {
      company: { name: 'GreenPledge', domain: 'greenpledge.example', contact: { name: 'Oliver Chen', title: '', email: 'oliver@greenpledge.example' } },
      sells: { summary: 'Carbon measurement and verified offsets, with a report and a badge', category: 'sustainability-services', tags: ['carbon', 'esg', 'offsets', 'reporting'] },
      profile: { industry: 'climate', size: 20, hasOffice: false, teams: ['sales', 'ops'], hiring: false, stage: 'startup', tags: ['b2b'] },
      targets: { summary: 'Companies of 50 or more with ESG on the roadmap', industries: ['any'], sizeBands: ['51-200', '201-1000', '1000+'], roles: ['ceo', 'ops'], tags: ['esg', 'sells-to-enterprise'] },
      confidence: 0.86,
      dealerNote: 'Will offset your footprint by Friday. Wants companies of fifty or more; most of this deck is smaller.'
    },
    e09: {
      company: { name: 'Podly', domain: 'podly.example', contact: { name: 'Jess Amara', title: '', email: 'jess@podly.example' } },
      sells: { summary: 'Podcast booking and clip production for B2B founders', category: 'media-services', tags: ['podcast', 'pr', 'content', 'founders'] },
      profile: { industry: 'media', size: 8, hasOffice: false, teams: ['marketing', 'sales'], hiring: false, stage: 'startup', tags: ['b2b'] },
      targets: { summary: 'Founders of B2B companies', industries: ['any'], sizeBands: ['1-10', '11-50', '51-200'], roles: ['founder', 'marketing'], tags: ['b2b'] },
      confidence: 0.84,
      dealerNote: 'Will put you on ten podcasts. Eight people. Wants founders, which is everyone, which is the problem.'
    },
    e10: {
      company: { name: 'Stackline Studio', domain: 'stacklinestudio.example', contact: { name: 'Rahul Mehta', title: '', email: 'rahul@stacklinestudio.example' } },
      sells: { summary: 'Dedicated outsourced engineering teams from $45 an hour', category: 'dev-services', tags: ['engineering', 'outsourcing', 'developers', 'teams'] },
      profile: { industry: 'dev-services', size: 200, hasOffice: true, teams: ['engineering', 'sales', 'ops'], hiring: true, stage: 'established', tags: ['b2b'] },
      targets: { summary: 'Startups and SaaS companies of 5–200 that need to ship faster than they can hire', industries: ['saas', 'fintech', 'ecommerce', 'hr-tech', 'sales-tools'], sizeBands: ['1-10', '11-50', '51-200'], roles: ['cto', 'founder'], tags: ['hiring', 'startup'] },
      confidence: 0.9,
      dealerNote: 'Two hundred engineers for rent. Competes with Hirewire for the same budget line, which the deck will notice.'
    },
    e11: {
      company: { name: 'Brightpath Ventures', domain: 'brightpath.example', contact: { name: 'Nadia Osei', title: 'Partner', email: 'nadia@brightpath.example' } },
      sells: { summary: 'Seed investment of $500K–$2M in software companies with early revenue', category: 'venture-capital', tags: ['investment', 'seed', 'capital', 'funding'] },
      profile: { industry: 'venture-capital', size: 9, hasOffice: true, teams: ['finance'], hiring: false, stage: 'established', tags: [] },
      targets: { summary: 'Software companies of 5–50 people with early revenue', industries: ['saas', 'fintech', 'hr-tech', 'sales-tools', 'ecommerce'], sizeBands: ['1-10', '11-50'], roles: ['founder'], tags: ['startup'] },
      confidence: 0.9,
      dealerNote: 'The politest spam in the deck. Sells money, terms attached. Nobody in the pool targets a VC — but several would pay to pitch one.'
    },
    e12: {
      isPitch: false, binReason: 'scam',
      company: { name: 'Gregory Vance', domain: 'vance-estates-legal.example', contact: { name: 'Gregory Vance', title: '', email: 'g.vance@vance-estates-legal.example' } },
      sells: { summary: 'Nothing. An advance-fee fraud dressed as an estate.', category: 'fraud', tags: [] },
      confidence: 0.99,
      dealerNote: 'Not a company. Not a pitch. Just crime in a nice suit. Binned.'
    },
    e13: {
      isPitch: false, binReason: 'newsletter',
      company: { name: 'SaaS Weekly', domain: 'saasweekly.example', contact: { name: '', title: '', email: 'hello@saasweekly.example' } },
      sells: { summary: 'A newsletter; sells nothing in this email', category: 'newsletter', tags: [] },
      confidence: 0.95,
      dealerNote: 'A newsletter you apparently signed up for in 2024. Sells nothing. Binned, not blamed.'
    },

    p01: {
      company: { name: 'Shipshape Fulfillment', domain: 'shipshape.example', contact: { name: 'Carlos Diaz', title: '', email: 'carlos@shipshape.example' } },
      sells: { summary: 'Warehousing, pick-pack-ship and returns handling for online brands', category: 'logistics-services', tags: ['fulfillment', '3pl', 'shipping', 'warehouse'] },
      profile: { industry: 'logistics', size: 120, hasOffice: true, teams: ['ops', 'sales', 'support'], hiring: true, stage: 'growth', tags: ['b2b'] },
      targets: { summary: 'E-commerce brands of 5–100 people', industries: ['ecommerce', 'retail'], sizeBands: ['1-10', '11-50', '51-200'], roles: ['founder', 'ops'], tags: ['online-seller'] },
      confidence: 0.92,
      dealerNote: 'Will tape your boxes. 120 people, warehouses, a support desk — a buyer of software it did not come here to buy.'
    },
    p02: {
      company: { name: 'Boomerang Returns', domain: 'boomerangreturns.example', contact: { name: 'Mei Tanaka', title: '', email: 'mei@boomerangreturns.example' } },
      sells: { summary: 'Returns portal, automatic exchanges and returns analytics for online stores', category: 'ecommerce-software', tags: ['returns', 'ecommerce', 'analytics', 'exchanges'] },
      profile: { industry: 'saas', size: 35, hasOffice: false, teams: ['engineering', 'sales', 'support'], hiring: true, stage: 'startup', tags: ['sells-to-enterprise', 'subscription-billing'] },
      targets: { summary: 'E-commerce brands, and the SaaS tools those brands already use (partnerships)', industries: ['ecommerce', 'retail', 'saas'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['ops', 'cto'], tags: ['online-seller', 'support-team'] },
      confidence: 0.9,
      dealerNote: 'Pitched a store and, in the same breath, every software company the store uses. Two audiences, one email.'
    },
    p03: {
      company: { name: 'Pixel & Prose', domain: 'pixelprose.example', contact: { name: 'Hannah Byrne', title: '', email: 'hannah@pixelprose.example' } },
      sells: { summary: 'Product photography and copywriting for online stores', category: 'creative-services', tags: ['photography', 'copywriting', 'ecommerce', 'content'] },
      profile: { industry: 'creative', size: 6, hasOffice: true, teams: ['marketing'], hiring: false, stage: 'startup', tags: ['b2b'] },
      targets: { summary: 'E-commerce brands of 1–50 people', industries: ['ecommerce', 'retail'], sizeBands: ['1-10', '11-50'], roles: ['founder', 'marketing'], tags: ['online-seller'] },
      confidence: 0.88,
      dealerNote: 'Said the photos were worse than the products. Six people and a studio.'
    },
    p04: {
      company: { name: 'SalesTaxly', domain: 'salestaxly.example', contact: { name: 'Devon Price', title: '', email: 'devon@salestaxly.example' } },
      sells: { summary: 'Sales-tax exposure tracking, registration and automatic filing', category: 'tax-software', tags: ['sales-tax', 'compliance', 'finance', 'filing'] },
      profile: { industry: 'fintech', size: 60, hasOffice: true, teams: ['engineering', 'sales', 'support', 'finance'], hiring: true, stage: 'growth', tags: ['subscription-billing'] },
      targets: { summary: 'Online sellers and SaaS companies with usage or subscription billing, 10–500 people', industries: ['ecommerce', 'retail', 'saas'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['cfo', 'finance', 'ops'], tags: ['online-seller', 'subscription-billing'] },
      confidence: 0.91,
      dealerNote: 'Knows which states you owe. Sixty people, has a finance team, which rules out one bookkeeper in this deck and not the other way round.'
    },

    h01: {
      company: { name: 'Vettd', domain: 'vettd.example', contact: { name: 'Sam Okafor', title: '', email: 'sam@vettd.example' } },
      sells: { summary: 'Automated background and reference checks, 48-hour turnaround', category: 'hr-services', tags: ['background-checks', 'references', 'hiring', 'compliance'] },
      profile: { industry: 'hr-tech', size: 45, hasOffice: true, teams: ['engineering', 'sales', 'support'], hiring: true, stage: 'startup', tags: ['subscription-billing'] },
      targets: { summary: 'Recruiting agencies and HR teams running ten or more checks a month', industries: ['recruiting'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['hr', 'recruiting'], tags: [] },
      confidence: 0.9,
      dealerNote: 'Pitched Hirewire. Hirewire brought it here. Hirewire is exactly who it wants. The spammer monetised its own spam.'
    },
    h02: {
      company: { name: 'Outreachly', domain: 'outreachly.example', contact: { name: 'Kyle Brandt', title: '', email: 'kyle@outreachly.example' } },
      sells: { summary: 'LinkedIn outreach automation for sales and recruiting teams', category: 'sales-tools', tags: ['linkedin', 'outreach', 'automation', 'sales'] },
      profile: { industry: 'sales-tools', size: 22, hasOffice: false, teams: ['engineering', 'sales'], hiring: true, stage: 'startup', tags: ['subscription-billing'] },
      targets: { summary: 'Sales and recruiting teams', industries: ['any'], sizeBands: ['11-50', '51-200', '201-1000'], roles: ['sales', 'recruiting'], tags: ['sales-team'] },
      confidence: 0.88,
      dealerNote: 'Sends 500 LinkedIn messages a day, safely, it says. Twenty-two people. Will get on well with Meridian.'
    },
    h03: {
      company: { name: 'Hive & Co', domain: 'hiveandco.example', contact: { name: 'Rosa Martinez', title: '', email: 'rosa@hiveandco.example' } },
      sells: { summary: 'Coworking memberships and private offices, month to month', category: 'office-space', tags: ['coworking', 'office', 'real-estate', 'membership'] },
      profile: { industry: 'real-estate', size: 30, hasOffice: true, teams: ['ops', 'sales'], hiring: false, stage: 'growth', tags: ['b2b'] },
      targets: { summary: 'Companies of 2–50 people without a lease', industries: ['any'], sizeBands: ['1-10', '11-50'], roles: ['founder', 'ops'], tags: ['no-office', 'remote'] },
      confidence: 0.85,
      dealerNote: 'Wants the remote companies in the deck, and there are several. Offered Hirewire a desk; Hirewire already has desks.'
    }
  };

  return { READINGS: READINGS };
});
