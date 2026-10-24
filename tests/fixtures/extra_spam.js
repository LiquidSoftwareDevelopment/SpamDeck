/* SpamDeck test fixtures: eleven unsolicited pitches of awkward shapes, for measuring the offline simple reader.
   Written 2026-10-24 for the engine review. Same email shape as js/data/demo_inbox.js. People and companies are fictional;
   most domains are .example, three are real-looking on purpose (acme-widgets.co, mail.bigcorp-sales.com, cloudcost.io).

   LABELS hold the hand answer for each email, written before the reader was measured:
     name     the company the card should carry
     category one of the simple reader's rule categories, or "software" (a software product no rule covers), or "other"
     isPitch  false would mean the card belongs in the bin
     shape    what makes the email awkward
   Decision on x09 (a vendor's webinar invite): a pitch. A company is selling its product to a named audience (finance teams
   at growing SaaS companies) and uses a live demo as the hook; that is who SpamDeck wants to charge, not a newsletter. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SpamDeck = root.SpamDeck || {};
  root.SpamDeck.extraSpam = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EMAILS = [
    {
      id: 'x01', contributorId: 'you', receivedAt: '2026-10-15',
      from: { name: 'Kara Lindqvist', email: 'kara@tickettamer.example' },
      subject: 'Your support inbox, tamed',
      body: '<p>Hi Michael,</p><p>I noticed you&rsquo;re hiring for support &mdash; congrats on the growth!</p>\n<p>TicketTamer is a help desk built for small support teams: one shared inbox for email, chat and WhatsApp, with AI replies for the repetitive tickets.&nbsp; Teams of 3&ndash;20 agents set it up in an afternoon.</p>\n<p>Would a 15-minute walkthrough next week be useful?</p>\n<p>Best,<br>\nKara Lindqvist<br>\nAccount Executive&nbsp;|&nbsp;TicketTamer<br>\n<a href="https://tickettamer.example/demo">Book a demo</a></p>'
    },
    {
      id: 'x02', contributorId: 'you', receivedAt: '2026-10-16',
      from: { name: 'Parcelhouse', email: 'hello@parcelhouse.example' },
      subject: 'Still packing orders yourself?',
      body: "Hi Michael,\n\nIf you sell physical products online, Parcelhouse can take packing off your plate. We store your stock in our warehouse in Leicester, pick and pack every order the day it comes in, and ship it with tracked delivery. No minimum order volume, and you only pay per order shipped.\n\nMost of the brands we work with are teams of 2 to 30 people who have outgrown the spare room.\n\nReply with your monthly order count and we'll send a quote within a day."
    },
    {
      id: 'x03', contributorId: 'you', receivedAt: '2026-10-17',
      from: { name: 'Dev Patel', email: 'dev.patel.builds@gmail.com' },
      subject: 'quick q',
      body: "hey Michael - saw your launch on Product Hunt, looks great.\n\ni run Patel Digital, a 4-person dev studio in Pune. we build MVPs and internal tools for early-stage startups, $38/hr, usually 6-8 weeks from kickoff to launch.\n\nwould you be open to a short call this week?\n\nDev\n\nSent from my iPhone"
    },
    {
      id: 'x04', contributorId: 'you', receivedAt: '2026-10-18',
      from: { name: 'Jordan Wells', email: 'jordan.wells@mail.bigcorp-sales.com' },
      subject: 'Fwd: 40 qualified meetings for your sales team',
      body: "Michael - forwarding this in case it got buried. Happy to adjust the numbers to your market.\n\n---------- Forwarded message ---------\nFrom: Jordan Wells <jordan.wells@mail.bigcorp-sales.com>\nDate: Tue, Oct 6, 2026 at 10:02 AM\nSubject: 40 qualified meetings for your sales team\nTo: <michael@yourcompany.example>\n\nHi Michael,\n\nBigCorp Sales books qualified meetings for B2B software companies. Our SDR team does the research, writes the sequences and runs the outbound; your account executives just show up to the calls. Clients with a sales team of 3 or more typically see 40 qualified meetings in the first 90 days.\n\nOpen to a 20-minute intro?\n\nJordan Wells | Senior Account Executive | BigCorp Sales\n+1 (415) 555-0142"
    },
    {
      id: 'x05', contributorId: 'you', receivedAt: '2026-10-19',
      from: { name: 'Lisa Moreau', email: 'lisa@redlinesec.example' },
      subject: 'Re: Re: External pen test before your SOC 2 audit',
      body: "Hi Michael,\n\nCircling back one last time on the below. The free external scan offer stands until Friday.\n\nLisa\n\nOn Tue, Oct 13, 2026 at 9:14 AM Lisa Moreau <lisa@redlinesec.example> wrote:\n> Hi Michael, just bumping this up in case it slipped past.\n>\n> On Mon, Oct 5, 2026 at 8:40 AM Lisa Moreau <lisa@redlinesec.example> wrote:\n>> Hi Michael,\n>>\n>> Redline Security runs penetration tests for SaaS companies that are heading into a SOC 2 or ISO 27001 audit. We test your web app, API and cloud setup, and hand you a report your auditor will accept, in two weeks.\n>>\n>> Would a free external scan be a useful first step?\n>>\n>> Lisa Moreau\n>> Founder, Redline Security"
    },
    {
      id: 'x06', contributorId: 'you', receivedAt: '2026-10-20',
      from: { name: 'Pat Okoye', email: 'pat@acme-widgets.co' },
      subject: 'Branded swag your team will actually keep',
      body: "Hi Michael,\n\nAcme Widgets makes custom-branded merch for companies that are tired of cheap pens nobody uses: recycled-cotton hoodies, insulated bottles, notebooks and desk kits, printed with your logo and shipped to each employee's home.\n\nWe work with remote teams of 10 to 500 people, and onboarding kits are our bestseller. Minimum order is 25 units.\n\nWant me to put together a sample box for your team?\n\nPat Okoye\nPartnerships, Acme Widgets\nacme-widgets.co"
    },
    {
      id: 'x07', contributorId: 'you', receivedAt: '2026-10-21',
      from: { name: 'Sam Achebe', email: 'sam@beanandbarrow.example' },
      subject: 'Free bag of beans for the office?',
      body: 'Hi Michael, Bean & Barrow delivers freshly roasted coffee to offices every week; can I send your team a free bag to try? Sam'
    },
    {
      id: 'x08', contributorId: 'you', receivedAt: '2026-10-21',
      from: { name: 'Ines Carvalho', email: 'ines@studiolumen.example' },
      subject: 'Your product pages, reshot (and why it matters more than ads)',
      body: "Hi Michael,\n\nI hope you're well. I'll be upfront: this is a long email, because I'd rather give you the whole picture once than send you five follow-ups.\n\n" +
        "Studio Lumen is a product photography and copywriting studio for e-commerce brands. I started it eight years ago after running photography for a fashion marketplace, where I watched the same thing happen again and again: two shops selling nearly identical products, and the one with the better pictures and the clearer descriptions winning almost every sale.\n\n" +
        "Shoppers can't touch your product, so the photos and the words do all of the selling. When they're vague, people either leave or buy the wrong size and send it back. When they're right, the page answers the questions a shop assistant would have answered in person.\n\n" +
        "Here is how a project with us works:\n\n" +
        "• A 30-minute call to understand your brand, your best sellers and the questions your customers keep asking.\n" +
        "• We send you a prepaid box; you post us the products; we return them within three weeks.\n" +
        "• Studio shots on white, lifestyle scenes in a real home, detail close-ups, and short vertical videos for social.\n" +
        "• Every product description rewritten: what it is, who it's for, what it's made of, and how it fits.\n" +
        "• Files delivered sized and named for Shopify, Amazon and your ad accounts, so nobody on your side has to resize anything.\n\n" +
        "Two recent examples. A ceramics brand with 40 products saw its conversion rate go from 1.9% to 2.4% in the six weeks after the new pages went live, with no change in ad spend. A small outdoor-clothing label cut size-related returns by 11% after we added fit notes and on-body photos for every item.\n\n" +
        "Packages start at USD 1,200 for up to 15 products, including copy. Most brands start with their top ten sellers, see what happens to those pages, and then do the rest of the catalogue.\n\n" +
        "I know this lands in a busy inbox, so here's the simplest next step: reply with a link to the product page you're least happy with, and I'll send back three specific changes we would make, free, whether or not we ever work together. If you're at ShopTalk in March, I'd also be happy to buy you a coffee and look at your pages together.\n\n" +
        "P.S. Not the right person? I'd be grateful if you could point me to whoever looks after your online store.\n\n" +
        "Ines Carvalho\nFounder & Creative Director, Studio Lumen\nRua das Flores 28, 1200-195 Lisboa, Portugal\n+351 21 555 0199\nstudiolumen.example · Instagram · LinkedIn · Behance"
    },
    {
      id: 'x09', contributorId: 'you', receivedAt: '2026-10-22',
      from: { name: 'ClosePilot Events', email: 'events@closepilot.example' },
      subject: 'Live demo Thursday: close your books in 2 days, not 10',
      body: "Hi Michael,\n\nMonth-end shouldn't take two weeks. Join our live demo this Thursday, October 29 at 11:00 AM ET, and see how ClosePilot automates the monthly close for finance teams at growing SaaS companies: bank reconciliations, accruals, and a close checklist that runs itself.\n\nWhat you'll see in 30 minutes:\n- Reconciling 1,200 transactions in under five minutes\n- Flux analysis your CFO will actually read\n- How Northbeam's two-person finance team closes in two days\n\nSave my seat: https://closepilot.example/live\n\nCan't make it? Register anyway and we'll send you the recording.\n\nThe ClosePilot team\n\nYou're receiving this because we think month-end matters to you. Unsubscribe | Manage preferences\nClosePilot Inc., 500 Market St, San Francisco, CA"
    },
    {
      id: 'x10', contributorId: 'you', receivedAt: '2026-10-23',
      from: { name: 'Owen Hart', email: 'owen@keystonetalent.example' },
      subject: 'Senior backend engineer, open to early-stage SaaS (anonymized profile)',
      body: "Hi Michael,\n\nI'm representing a senior backend engineer who is quietly looking and asked me to approach a short list of early-stage SaaS companies. Yours is on it.\n\nThe short version: 9 years of Go and Postgres, led the payments platform at a Series C fintech, has hired and managed a team of five, based in Austin and happy to work remotely.\n\nShe is interviewing now, so timing matters. Keystone Talent works on contingency: 18% of first-year salary, payable only if you hire her, with a 90-day guarantee.\n\nShall I send over her anonymized resume?\n\nOwen Hart\nTalent Partner, Keystone Talent"
    },
    {
      // Supplied by the coordinator 2026-10-24 from a paste into the app: the summary fell back to the subject line.
      id: 'x11', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Priya Shah', email: 'priya@cloudcost.io' },
      subject: 'Your AWS bill is 30% too high',
      body: 'CloudCost finds the waste in your AWS bill and turns it off. We work with SaaS companies of 20-500 people and typically cut the bill 30% in the first month, no engineering time needed.'
    }
  ];

  var LABELS = {
    x01: { name: 'TicketTamer', category: 'support-software', isPitch: true, shape: 'HTML tags and &nbsp; left in the body' },
    x02: { name: 'Parcelhouse', category: 'logistics-services', isPitch: true, shape: 'no signature at all; sender is the company' },
    x03: { name: 'Patel Digital', category: 'dev-services', isPitch: true, shape: 'Gmail address, all lower case, "Sent from my iPhone"' },
    x04: { name: 'BigCorp Sales', category: 'lead-generation', isPitch: true, shape: '"Fwd:" with quoted headers; sent from a mail subdomain' },
    x05: { name: 'Redline Security', category: 'security-services', isPitch: true, shape: 'reply chain; the pitch is only in ">" quoted lines; domain abbreviates the name' },
    x06: { name: 'Acme Widgets', category: 'other', isPitch: true, shape: 'real-looking .co domain; product no rule covers' },
    x07: { name: 'Bean & Barrow', category: 'office-supplies', isPitch: true, shape: 'one line' },
    x08: { name: 'Studio Lumen', category: 'creative-services', isPitch: true, shape: 'very long; USD price; LinkedIn and coffee mentioned in passing' },
    x09: { name: 'ClosePilot', category: 'bookkeeping-software', isPitch: true, shape: 'webinar invite with a marketing footer (unsubscribe)' },
    x10: { name: 'Keystone Talent', category: 'recruiting-services', isPitch: true, shape: 'recruiter pitching a candidate, never says "recruit"' },
    x11: { name: 'CloudCost', category: 'software', isPitch: true, shape: 'two sentences; verbs the reader did not know ("finds", "cut")' }
  };

  // HELD OUT: six more emails, written and labelled after the simple reader had been tuned on the eleven above, and
  // measured once without tuning on them, so their score says how the reader does on mail it has not seen. h04 is a
  // personal note, not a pitch; only its bin decision is scored (name and category are null).
  var HELDOUT = [
    {
      id: 'h01', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Greta Holm', email: 'greta@taxpilot.example' },
      subject: 'Sales tax nexus check for your Shopify store',
      body: "Hi Michael,\n\nTaxPilot watches your sales in every US state and tells you the day\nyou cross an economic nexus threshold, then registers you and files\nthe returns automatically. Most of our customers are Shopify and\nWooCommerce brands with 5 to 50 people and no in-house tax person.\n\nCould I run a free nexus check on your last 12 months of orders?\n\nGreta Holm\nCustomer Success, TaxPilot"
    },
    {
      id: 'h02', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Nina Kovacs', email: 'nina@tryhelio.example' },
      subject: 'Scope 3 without the spreadsheet',
      body: "Hello Michael,\n\nYour enterprise customers are starting to ask suppliers for emissions data. Helio connects to your accounting and cloud bills, calculates your carbon footprint across scopes 1 to 3, and produces the supplier questionnaire answers in a click.\n\nWe'd love to show you a sample report.\n\nNina Kovacs\nHelio"
    },
    {
      id: 'h03', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Tomás Ruiz', email: 'tomas.ruiz@deskhaus.example' },
      subject: 'Team room for 8, month to month',
      body: "Hi Michael,\n\nDeskhaus has a private team room for up to 8 people opening on the 4th floor of our Market Street building next month: 24/7 access, meeting rooms, fast wifi, and month to month terms.\n\nIf your team is outgrowing home offices, I can hold it for you for a week while you decide.\n\nTomás Ruiz\nMembership Manager | Deskhaus\n\nCONFIDENTIALITY NOTICE: This e-mail message, including any attachments, is for the sole use of the intended recipient(s) and may contain confidential and privileged information. Any unauthorized review, use, disclosure or distribution is prohibited. If you are not the intended recipient, please contact the sender by reply e-mail and destroy all copies of the original message."
    },
    {
      id: 'h04', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Alex Romero', email: 'alex.romero88@gmail.com' },
      subject: 'lunch thursday?',
      body: "hey! are we still on for lunch thursday? I can do 12:30 near your office. also I finally read that book you lent me, it was great.\n\nalex"
    },
    {
      id: 'h05', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Rachel Kim', email: 'rachel@northstarvc.example' },
      subject: 'Pre-seed for B2B SaaS — 15 minutes?',
      body: "Hi Michael,\n\nI lead pre-seed investments at Northstar Capital. We write first cheques of $250K to $750K into B2B SaaS companies with fewer than 10 people, and we like to meet founders early.\n\nWould you be up for a 15-minute intro call next week?\n\nRachel Kim\nPrincipal, Northstar Capital"
    },
    {
      id: 'h06', contributorId: 'you', receivedAt: '2026-10-24',
      from: { name: 'Ben Ortiz', email: 'ben@saasfounderssummit.example' },
      subject: 'Sponsor a booth at SaaS Founders Summit (Austin, March 12-13)',
      body: "Hi Michael,\n\nSaaS Founders Summit brings 1,200 B2B SaaS founders and operators to Austin for two days of talks and workshops. We have four exhibitor booths left, starting at $4,500, and a speaking slot for one sponsor.\n\nLast year's sponsors met an average of 60 qualified leads each.\n\nCan I send you the sponsorship deck?\n\nBen Ortiz\nPartnerships, SaaS Founders Summit"
    }
  ];

  var HELDOUT_LABELS = {
    h01: { name: 'TaxPilot', category: 'tax-software', isPitch: true, shape: 'plain text hard-wrapped at 70 characters' },
    h02: { name: 'Helio', category: 'sustainability-services', isPitch: true, shape: 'domain is "try" + the name' },
    h03: { name: 'Deskhaus', category: 'office-space', isPitch: true, shape: 'signature followed by a legal disclaimer' },
    h04: { name: null, category: null, isPitch: false, shape: 'a personal note from a friend, not a pitch' },
    h05: { name: 'Northstar Capital', category: 'venture-capital', isPitch: true, shape: 'domain abbreviates the name differently (northstarvc)' },
    h06: { name: 'SaaS Founders Summit', category: 'other', isPitch: true, shape: 'conference sponsorship; no rule covers events' }
  };

  return { EMAILS: EMAILS, LABELS: LABELS, HELDOUT: HELDOUT, HELDOUT_LABELS: HELDOUT_LABELS };
});
