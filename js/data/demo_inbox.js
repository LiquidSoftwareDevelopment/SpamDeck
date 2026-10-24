/* SpamDeck — the demo inbox. Every company, person and domain here is fictional (.example domains).
   Three contributors pooled their unsolicited pitches: you, Priya, and Hirewire (a company that got pitched,
   joined, and then contributed the spam IT receives — the viral loop). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpamDeck = root.SpamDeck || {};
  root.SpamDeck.demoInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CONTRIBUTORS = [
    { id: 'you', name: 'You', label: 'your inbox', possessive: 'your', blurb: 'Founder of a small software company. Receives roughly a pitch a day. Deletes all of them. Until now.' },
    { id: 'priya', name: 'Priya Natarajan', label: "Priya's inbox", possessive: "Priya's", blurb: 'Runs Linen & Lark, an online home-goods store with 14 staff. Pooled her spam into SpamDeck in week two.' },
    { id: 'hirewire', name: 'Hirewire', label: "Hirewire's inbox", possessive: "Hirewire's", blurb: 'A recruiting firm that pitched you, got invited, joined — and then contributed the pitches IT receives.' }
  ];

  var EMAILS = [
    // ---------------- Your inbox ----------------
    {
      id: 'e01', contributorId: 'you', receivedAt: '2026-09-14',
      from: { name: 'Dana Whitfield', email: 'dana@ledgerly.example' },
      subject: 'Quick question about your books',
      body: "Hi Michael — quick question: who's doing your bookkeeping right now?\n\nIf the answer is \"me, at 11pm, with a spreadsheet\", you're not alone. Ledgerly plugs into your bank and your billing tool and keeps the books clean automatically — monthly close in a day, not a fortnight.\n\nWe work with companies of 10–200 people that don't have a finance team yet. Founders tell us they get about six hours a month back.\n\nWorth a 15-minute look? I can show you on your own numbers.\n\nDana Whitfield\nHead of Growth, Ledgerly · ledgerly.example"
    },
    {
      id: 'e02', contributorId: 'you', receivedAt: '2026-09-16',
      from: { name: 'Marcus Bell', email: 'marcus@hirewire.example' },
      subject: 'Senior engineers who actually reply',
      body: "Michael, I'll keep this short.\n\nHirewire places senior and staff engineers at SaaS and fintech companies — 20 to 500 people — and we only get paid when someone starts. Average time to offer: 23 days. We've closed 14 searches this quarter for companies that look a lot like yours.\n\nIf you're hiring engineers in the next six months, can I send over two profiles this week? No retainer, no exclusivity.\n\nMarcus Bell\nPartner, Hirewire"
    },
    {
      id: 'e03', contributorId: 'you', receivedAt: '2026-09-18',
      from: { name: 'Priyanka Rao', email: 'priyanka@fortifylabs.example' },
      subject: 'The thing blocking your enterprise deals is a PDF',
      body: "Hi Michael,\n\nMost SaaS companies lose their first enterprise deal to a security questionnaire, not a competitor.\n\nFortify Labs gets software companies of 20–300 people through SOC 2 in about eight weeks — we run the audit prep, the evidence collection and the penetration test, and we hand you the report that procurement wants.\n\nIf you're selling, or want to sell, to companies with a security team, we should talk. 20 minutes?\n\nPriyanka Rao\nFounder, Fortify Labs"
    },
    {
      id: 'e04', contributorId: 'you', receivedAt: '2026-09-21',
      from: { name: 'Tom Garrity', email: 'tom@deskwell.example' },
      subject: 'Standing desks for the whole team (volume pricing inside)',
      body: "Hi Michael — Tom from Deskwell.\n\nWe make sit-stand desks and ergonomic chairs for offices, and we're running volume pricing this quarter for teams of 10 or more: 25% off, free delivery, assembled.\n\nMost office managers tell us the backs of their teams are the first thing people complain about and the last thing anyone budgets for.\n\nWant me to send a quote for your office? Just tell me the headcount.\n\nTom Garrity\nAccount Executive, Deskwell"
    },
    {
      id: 'e05', contributorId: 'you', receivedAt: '2026-09-23',
      from: { name: 'Lena Park', email: 'lena@chatterbox.example' },
      subject: 'cut support tickets 40% (not a typo)',
      body: "Michael —\n\nChatterbox is an AI support agent that answers the repetitive 40% of tickets before a human sees them. It plugs into your help desk, learns from your docs, and hands off the hard ones with a summary.\n\nWe built it for e-commerce and SaaS companies with a support team of two or more who are drowning. Pricing starts at $299/month.\n\nCan I show you a 10-minute demo on your own help docs?\n\nLena Park\nSDR, Chatterbox AI"
    },
    {
      id: 'e06', contributorId: 'you', receivedAt: '2026-09-25',
      from: { name: 'Greg Falco', email: 'greg@meridianoutbound.example' },
      subject: '20 qualified meetings a month, guaranteed',
      body: "Michael,\n\nWhat would 20 qualified sales meetings a month do for your pipeline?\n\nMeridian Outbound runs outbound for B2B companies with a sales team — we write the sequences, we send the emails (a lot of them), we book the meetings on your calendar. Our clients see a full calendar in 60 days or we work free until they do.\n\nI'd love 15 minutes to walk you through how we'd do it for you.\n\nGreg Falco\nManaging Director, Meridian Outbound"
    },
    {
      id: 'e07', contributorId: 'you', receivedAt: '2026-09-28',
      from: { name: 'Astrid Lund', email: 'astrid@nordicbean.example' },
      subject: 'Your office coffee is bad. (We checked.)',
      body: "Hi Michael,\n\nWe didn't actually check. But statistically it's bad.\n\nNordic Bean delivers freshly roasted coffee to offices of 20 or more people on a subscription — beans, machine, service, all in one price per head. Companies tell us it's the cheapest perk they have and the one people would riot over losing.\n\nWant a free trial bag for the office? I just need an address.\n\nAstrid Lund\nFounder, Nordic Bean"
    },
    {
      id: 'e08', contributorId: 'you', receivedAt: '2026-09-30',
      from: { name: 'Oliver Chen', email: 'oliver@greenpledge.example' },
      subject: 'Your carbon footprint, offset by Friday',
      body: "Hi Michael — Oliver at GreenPledge.\n\nCompanies with 50 or more staff are getting asked about their carbon footprint by customers, investors, and increasingly by new hires. GreenPledge measures it, offsets it with verified projects, and gives you a badge and a report you can put in front of anyone who asks. From $400/month.\n\nIf ESG is on your roadmap this year, I can have your baseline done by Friday.\n\nOliver Chen\nGreenPledge"
    },
    {
      id: 'e09', contributorId: 'you', receivedAt: '2026-10-02',
      from: { name: 'Jess Amara', email: 'jess@podly.example' },
      subject: 'Get you on 10 podcasts in 90 days',
      body: "Michael,\n\nFounders who appear on podcasts regularly get inbound. Podly books B2B founders on 10 relevant podcasts in 90 days — we pitch the hosts, prep you, and repurpose every episode into clips. Our founders say it replaced their paid ads.\n\nWe're a small team of 8 and take on 10 clients a quarter. Open to a quick chat about which shows your buyers actually listen to?\n\nJess Amara\nPodly"
    },
    {
      id: 'e10', contributorId: 'you', receivedAt: '2026-10-05',
      from: { name: 'Rahul Mehta', email: 'rahul@stacklinestudio.example' },
      subject: 'Senior engineers at $45/hour',
      body: "Hi Michael,\n\nStackline Studio provides dedicated engineering teams — senior engineers from $45/hour, in your time zone, managed by us. 200 engineers, mostly working with startups and SaaS companies between 5 and 200 people who need to ship faster than they can hire.\n\nTwo-week free trial, cancel anytime. Shall I send a couple of CVs?\n\nRahul Mehta\nStackline Studio"
    },
    {
      id: 'e11', contributorId: 'you', receivedAt: '2026-10-07',
      from: { name: 'Nadia Osei', email: 'nadia@brightpath.example' },
      subject: 'Loved what you’re building (can we talk?)',
      body: "Hi Michael,\n\nI'm a partner at Brightpath Ventures. We write seed cheques of $500K–$2M into software companies with 5–50 people and early revenue, and we've been following your space.\n\nNot raising? That's fine — we like to meet founders 12 months before they are. Would you have 30 minutes in the next two weeks?\n\nNadia Osei\nPartner, Brightpath Ventures"
    },
    {
      id: 'e12', contributorId: 'you', receivedAt: '2026-10-09',
      from: { name: 'Gregory Vance', email: 'g.vance@vance-estates-legal.example' },
      subject: 'CONFIDENTIAL: unclaimed estate of a client who shares your surname (USD 4.5M)',
      body: "Dear Sir or Madam,\n\nI am Gregory Vance of Vance & Partners, solicitors to a late client who shared your surname and died without next of kin, leaving USD 4,500,000 in a bank here. I propose to present you as the beneficiary. You would receive 40%.\n\nKindly reply with your full name, address and telephone number so we may proceed with the utmost confidentiality.\n\nGregory Vance\nVance & Partners"
    },
    {
      id: 'e13', contributorId: 'you', receivedAt: '2026-10-12',
      from: { name: 'SaaS Weekly', email: 'hello@saasweekly.example' },
      subject: 'SaaS Weekly #212: pricing pages, churn, and a very large round',
      body: "This week: why your pricing page has too many columns · the churn number nobody reports · a $140M Series C for a company that does invoices. Plus 11 links.\n\nReading time: 6 minutes.\n\n— You're receiving this because you signed up at a conference in 2024. Unsubscribe."
    },
    {
      id: 'e14', contributorId: 'you', receivedAt: '2026-10-14',
      from: { name: 'Marcus Bell', email: 'marcus@hirewire.example' },
      subject: 'Re: Senior engineers who actually reply',
      body: "Bumping this to the top of your inbox.\n\nNot sure if my last note got buried — see below. Even a \"no\" helps me close the loop.\n\nMarcus\n\n> Hirewire places senior and staff engineers at SaaS and fintech companies — 20 to 500 people — and we only get paid when someone starts."
    },

    // ---------------- Priya's inbox ----------------
    {
      id: 'p01', contributorId: 'priya', receivedAt: '2026-09-19',
      from: { name: 'Carlos Diaz', email: 'carlos@shipshape.example' },
      subject: 'Stop packing boxes yourself',
      body: "Hi Priya, Carlos from Shipshape.\n\nWe run fulfillment for e-commerce brands — your inventory in our warehouses, orders picked, packed and shipped same day, returns handled. Brands of 5–100 people move to us when the founder is still taping boxes at midnight.\n\nTwo-day delivery to 90% of the country, no minimums the first three months. Can I send a quote based on your order volume?\n\nCarlos Diaz\nShipshape Fulfillment"
    },
    {
      id: 'p02', contributorId: 'priya', receivedAt: '2026-09-24',
      from: { name: 'Mei Tanaka', email: 'mei@boomerangreturns.example' },
      subject: "Returns are eating your margin (here's the number)",
      body: "Priya — online stores lose 8–12% of revenue to returns and most don't know where.\n\nBoomerang is returns software for e-commerce brands: a self-serve returns portal, automatic exchanges instead of refunds, and analytics on what's coming back and why.\n\nWe also partner with the SaaS tools brands already use — help desks, shipping, loyalty — so if you're one of those, let's talk too.\n\n15 minutes?\n\nMei Tanaka\nBoomerang Returns"
    },
    {
      id: 'p03', contributorId: 'priya', receivedAt: '2026-10-01',
      from: { name: 'Hannah Byrne', email: 'hannah@pixelprose.example' },
      subject: "Your product photos vs. your competitors' (a comparison)",
      body: "Hi Priya,\n\nI pulled up your product pages next to two competitors and — honestly — your products are better and your photos are worse.\n\nPixel & Prose does product photography and copy for e-commerce brands: studio shots, lifestyle, and descriptions that actually convert. Six-person studio, two-week turnaround.\n\nWant me to send the side-by-side?\n\nHannah Byrne\nPixel & Prose"
    },
    {
      id: 'p04', contributorId: 'priya', receivedAt: '2026-10-06',
      from: { name: 'Devon Price', email: 'devon@salestaxly.example' },
      subject: 'You probably owe sales tax in 7 states',
      body: "Priya,\n\nOnce an online seller crosses the threshold in a state, it owes sales tax there — most brands find out from a letter.\n\nSalesTaxly tracks your exposure across every state, registers you where you need it, and files automatically. We work with online sellers and SaaS companies with usage or subscription billing, 10–500 people.\n\nFifteen minutes and I'll tell you where you're exposed, free.\n\nDevon Price\nSalesTaxly"
    },
    {
      id: 'p05', contributorId: 'priya', receivedAt: '2026-10-08',
      from: { name: 'Tom Garrity', email: 'tom@deskwell.example' },
      subject: 'Standing desks for your team (volume pricing)',
      body: "Hi Priya — Tom from Deskwell.\n\nWe make sit-stand desks and ergonomic chairs for offices, and we're running volume pricing this quarter for teams of 10 or more: 25% off, free delivery, assembled.\n\nWant me to send a quote for your office? Just tell me the headcount.\n\nTom Garrity\nAccount Executive, Deskwell"
    },

    // ---------------- Hirewire's inbox (the spammer brings its spam) ----------------
    {
      id: 'h01', contributorId: 'hirewire', receivedAt: '2026-10-13',
      from: { name: 'Sam Okafor', email: 'sam@vettd.example' },
      subject: 'Background checks in 48 hours, not 10 days',
      body: "Hi Marcus,\n\nVettd automates background and reference checks for recruiting agencies and HR teams — candidate consent, checks, references, all in one dashboard, 48-hour turnaround. Agencies use us to get offers out before the other agency does.\n\nIf Hirewire is running more than ten checks a month, we'll save you a person. Can I show you?\n\nSam Okafor\nVettd"
    },
    {
      id: 'h02', contributorId: 'hirewire', receivedAt: '2026-10-16',
      from: { name: 'Kyle Brandt', email: 'kyle@outreachly.example' },
      subject: 'Send 500 LinkedIn messages a day (safely)',
      body: "Marcus —\n\nOutreachly automates LinkedIn outreach for sales and recruiting teams: sequences, personalization, replies in one inbox. Users book 3x more conversations.\n\nWe're a 22-person startup and I'd love to get Hirewire on it — free for 14 days.\n\nKyle Brandt\nOutreachly"
    },
    {
      id: 'h03', contributorId: 'hirewire', receivedAt: '2026-10-20',
      from: { name: 'Rosa Martinez', email: 'rosa@hiveandco.example' },
      subject: 'A desk for every Hirewire recruiter (first month free)',
      body: "Hi Marcus,\n\nHive & Co runs coworking spaces for small companies — 2 to 50 people — who don't want a lease. Private offices, meeting rooms, coffee, month to month.\n\nIf Hirewire's team is still remote or outgrowing the kitchen table, come and see the space. First month free.\n\nRosa Martinez\nHive & Co"
    }
  ];

  return { CONTRIBUTORS: CONTRIBUTORS, EMAILS: EMAILS };
});
