# How SpamDeck works

The engine, end to end. Every number below is a constant in the named file or a result you can reproduce with the commands at the end. All money is simulated.

## 1. The shape of the code

`index.html` loads twelve classic scripts, in this order, with no build step:

| Layer | Files | Job |
|---|---|---|
| Engine | `js/engine/taxonomy.js`, `match.js`, `market.js`, `extract.js` | Vocabulary and card shape, matching, the marketplace, the three readers. Pure: no DOM, no storage, no network. |
| Data | `js/data/demo_inbox.js`, `demo_cards.js` | 22 fictional emails from three inboxes, and their hand-labeled readings. |
| App | `js/app/dom.js`, `store.js`, `claude.js`, `views.js`, `tour.js`, `main.js` | DOM helper, state and actions, the live reader, the screens, story mode, wiring. |

Each engine and data file attaches itself to `window.SpamDeck` in the browser and to `module.exports` in Node, so `node --test` runs the same engine the browser runs. Money is integer cents throughout. Market functions mutate the state they are given and throw plain-English errors; the tests check that a refused action changes nothing (`tests/market_edge.test.js`, and 300 seeded random sequences of actions in `tests/market_property.test.js`), and the app's `store.commit()` turns the error into a visible line instead of a crash.

## 2. The card

Every reader's output passes through `normalizeCard()` in `taxonomy.js`, which returns one shape:

```
{
  id,                    // slug of the company's own domain, ".example" removed: "ledgerly"
  company:  { name, domain, contact: { name, title, email } },
  sells:    { summary, category, tags },        // category: kebab-case, free text
  profile:  { industry, size, hasOffice, teams, hiring, stage, tags,
              sector, sizeBand },               // the sender itself
  situations,                                   // derived from profile, see below
  targets:  { summary, industries, sizeBands, roles, tags },   // whom the sender wants
  confidence,            // 0..1
  flags, binReason,      // any flag means binned: "scam", "newsletter", ...
  dealerNote,            // one dry sentence
  sources: [ { emailId, contributorId, receivedAt, subject, from } ],
  readBy                 // "fixture", "heuristic" or "claude:<model>"
}
```

Rules applied on the way in:

- Odd input is repaired, not fatal. A list may arrive as a list, one word or "a, b". Vocabulary words match regardless of case and stray spaces; anything outside the vocabulary is dropped, and an unknown industry becomes `other`. Yes and no may arrive as words. A headcount may arrive as text ("1,200", "40 people") and becomes a whole number of at least 1, else 10. Confidence becomes a number from 0 to 1, or 0.5 when missing (tested in `tests/taxonomy.test.js` and `tests/taxonomy_edge.test.js`).
- The domain is cleaned (`https://www.Acme.io/about` becomes `acme.io`), an address's domain is whatever follows its last @, and the card is filed under the company's own domain, so a sender on `mail.bigcorp-sales.com` files under `bigcorp-sales.com`.
- A free-mail domain (48 listed providers such as gmail.com, plus any country ending of the biggest names) never names or files a card by itself: two companies writing from Gmail are two cards, not one called "gmail". With no name given, such a card is "Unknown company", filed under the sender's address.
- A reading that says it is not a pitch is always binned, with `other` as the reason when none is given.
- An empty list of target industries means `any`. `sector` and `sizeBand` are computed from `industry` and `size`.
- `sells.category` is free text, put into kebab-case, and `other` when missing. It decides rivalry (section 6), so two readers that name the same product differently will miss a rivalry.
- Live readings also carry `usage`: input and output tokens.

**Situations** are derived, so readers can stay short (`deriveSituations()`):

| Profile fact | Situations added |
|---|---|
| Teams | `sales-team`, `support-team`, `engineering-team`, `marketing-team`, `finance-team`; `hr-team` for an hr or recruiting team |
| No finance team and under 200 people | `no-finance-team` |
| `hasOffice` true / false | `has-office` / `no-office` and `remote` |
| `hiring` | `hiring` |
| Stage `startup`, or 50 people or fewer in a software industry | `startup` |
| Industry `ecommerce` or `retail` | `online-seller` |
| Anything in `profile.tags` | kept as is |

## 3. The vocabulary

All in `js/engine/taxonomy.js`.

- **Size bands (5):** `1-10`, `11-50`, `51-200`, `201-1000`, `1000+`. `bandOf()` splits at 10, 50, 200 and 1000.
- **Industries (23):** saas, fintech, hr-tech, sales-tools, ecommerce, retail, logistics, recruiting, security, agency, media, furniture, food-beverage, climate, dev-services, venture-capital, real-estate, creative, consulting, healthcare, manufacturing, education, other. Targets may also say `any`.
- **Sectors:** software (saas, fintech, hr-tech, sales-tools), commerce (ecommerce, retail), services (logistics, recruiting, security, agency, media, climate, dev-services, real-estate, creative, consulting), physical-goods (furniture, food-beverage, manufacturing), finance (venture-capital), other (healthcare, education, other). Software and commerce are umbrella sectors: targeting SaaS fairly covers an HR-tech company.
- **Teams (8):** engineering, sales, support, marketing, finance, hr, recruiting, ops.
- **Roles (14):** founder, ceo, ops, office manager, cfo, finance, cto, engineering, hiring manager, hr, recruiting, sales, marketing, support.
- **Situations (17):** startup, hiring, has-office, no-office, remote, sales-team, support-team, engineering-team, marketing-team, finance-team, no-finance-team, hr-team, sells-to-enterprise, b2b, esg, online-seller, subscription-billing.
- **Stages (3):** startup, growth, established.

**What a role needs on the other side** (`ROLE_NEEDS`): founder, ceo and ops are weak, because every company has one. An office manager needs an office. A hiring manager needs open roles (hiring, or an engineering team). cfo and finance need a finance team; cto and engineering an engineering team; hr an HR team (or recruiters); recruiting recruiters (or an HR team); sales, marketing and support need that team.

## 4. The three readers

`js/engine/extract.js`. Three readers, one card shape. Every card shows which one made it.

### Demo labels (fixture)

`readFixture()` looks the email up in `js/data/demo_cards.js`. Two entries point at another: Hirewire's follow-up (`e14` → `e02`) and Deskwell's second email, sent to Priya (`p05` → `e04`). A missing or circular link is no reading, not a crash. The readings were written by hand by the model that built SpamDeck, not recorded from an API call; the file says so at the top. They are the default reader for the 22 demo emails. A pasted email never uses them.

### The simple reader (offline)

`heuristicRead()`: keyword rules, "crude on purpose, never confident."

1. **Bin first.** Scam cues (beneficiary, next of kin, a "USD" amount, wire transfer, utmost confidentiality, barrister, inheritance, lottery, dear friend), unless the email also says "we help", "we build" or "we provide". Then newsletters: two or more of five cues (unsubscribe, "this week:", an issue number, reading time, "you're receiving this").
2. **Company name.** One to three capitalized words that spell the sender's domain; else the last line of the signature, after its last comma; else, for a company domain, its first word. A free-mail sender (Gmail, Outlook and the like) is never named after the domain: the name comes from the signature or from a self-introduction in the body ("I run Patel Digital"), and failing both the card is "Unknown company (<the address's local part>)" at 20% confidence, filed under the sender's address so two such senders never merge (`tests/extract_edge.test.js`).
3. **Product.** The first of 18 category rules that matches: returns software, outreach tool, coworking, sales tax, bookkeeping, background checks, recruiting, security, furniture, support software, lead generation, coffee, carbon, podcasts, dev shop, investor, fulfillment, photography. The rule also sets the sender's industry and teams.
4. **Summary.** A sentence with a pitch verb ("we help", "provides", "plugs into" and so on), preferring one that names the company.
5. **Targets.** Keyword patterns for industries, roles and situations. Ranges such as "10–200 people" or "20 or more" become size bands.
6. **The sender.** Headcount from phrases such as "a 22-person startup" or "team of 8", else 30 for software and 20 otherwise. An office from studio, roastery or warehouse words. Hiring from "we're hiring".
7. **Confidence** starts at 0.3 and adds 0.15 for a name found in the text (0.1 from the signature), 0.15 for a product rule, 0.1 for any target, 0.1 for a size band. It is capped at 0.8 (tested: it never claims to be sure).

Measured against the hand labels on all 22 demo emails (`tests/extract.test.js`): company name 22 of 22 (a prefix match, so "Chatterbox" counts for "Chatterbox AI"; 19 of 22 are exact), product category 22 of 22, and the bin decision agrees on every email. The test asserts a floor of 20 so later edits cannot quietly regress. The rules were written with these emails in view, so this is a fit, not evidence about anyone else's spam. Targeting is where the simple reader is crude: a deck dealt by it alone has 29 pairs over the match bar, none of them hot, and 2 mutual matches, against 113, 29 and 21 for the hand labels (commands in section 16).

### The live reader (Claude, your key)

`buildRequest()` builds the request without the key. `js/app/claude.js` adds `x-api-key` and sends it with `fetch` from the browser. Nothing passes through a SpamDeck server; there is none.

- `POST https://api.anthropic.com/v1/messages`
- Headers: `content-type: application/json`, `anthropic-version: 2026-10-21`, `anthropic-dangerous-direct-browser-access: true` (the opt-in for a browser calling the API with the user's own key). For Opus and Sonnet models, also `anthropic-beta: server-side-fallback-2026-07-01`.
- Body: `model` (default `claude-opus-5-5`; also `claude-sonnet-5-5` and `claude-haiku-5-5`), `max_tokens: 2048`, the system prompt below, `output_config: { effort: "low", format: { type: "json_schema", schema } }`, and one user message: "Read this unsolicited email and deal the card", then From, Received, Subject and the body. For Opus and Sonnet, `fallbacks: "default"`: if a safety classifier declines, the API re-runs the request on a fallback model in the same call. Haiku requests carry neither (tested).

The system prompt, verbatim from `extract.js`:

```
You are the Dealer at SpamDeck, a marketplace where companies pay to pitch each other with everyone’s consent.
You read one unsolicited sales email and deal one card: who sent it, what they sell, and who they want to reach.
Rules:
- Use only what the email says or clearly implies. Never invent facts. When the email does not say, pick the most likely value and lower your confidence.
- isPitch is false for scams, newsletters, personal mail, receipts and anything that is not a company selling something. Then set binReason (scam | newsletter | personal | other) and keep the rest minimal.
- profile describes the SENDER (the company behind the email): industry, approximate headcount, whether it has an office, which teams it plainly has, whether it is hiring.
- targets describes WHO THE SENDER WANTS TO REACH: industries (use "any" if they pitch everyone), size bands, the roles they pitch to, and the situations they look for.
- Use the controlled vocabulary exactly; it is what makes cards comparable.
- dealerNote is one dry, specific sentence about this card. Observant, never cruel.
- Contact details come from the email itself only.
```

The schema (`SCHEMA`) is strict: `additionalProperties: false` at every level, every field required, and enums taken from the vocabulary above. It uses only what structured outputs accept, so `confidence` states its 0-to-1 range in a description rather than as bounds, and `normalizeCard()` clamps it (tested in `tests/extract_edge.test.js`). The app shows the prompt and the schema on the **What is real** tab.

`parseReading()` refuses to invent a card. An API error, a `refusal` stop reason (with its category when given), a `max_tokens` cut-off, text that is not JSON, or JSON that is not a card each become a plain-English error (tested). HTTP 401, 403, 429, 400 and 5xx get their own sentences in `claude.js`. A good reading becomes a card with `readBy: "claude:<model>"`. Re-reading replaces the card and keeps the company's market record. If the new reading gives the company a different id while the old one already has offers, the old card stays, "so nothing is orphaned" (`store.js`, `replaceCard`).

## 5. Dedupe and the tally

`mergeCards()`: cards with the same id (the same company domain) become one card that keeps every source; the more confident reading wins, and a tie keeps the first. The same email read twice is one source, not a repeat sender, and the cards passed in are left unchanged (tested in `tests/extract_edge.test.js`). In the demo, Hirewire's two emails to you merge, and so do Deskwell's emails to you and to Priya. `tally()` writes the Dealer's line, which the tests assert: "Read 22. Dealt 18. Binned 2 (1 scam, 1 newsletter). Merged 2 repeat senders into one card each."

## 6. The matcher

`js/engine/match.js`. `scorePair(A, B)` asks how much pitcher A would want to pitch listener B. Every point arrives with a sentence (shown under **Why** on the Matches tab) and a second-person version used in letters ("you are a fintech company, exactly who they sell to").

| Facet | Rule | Points |
|---|---|---|
| Industry | A targets B's industry exactly | +25 |
| | otherwise A targets another industry in B's umbrella sector (software or commerce) | +15 |
| | otherwise A targets `any` | +10 |
| Size | B's band is one A asked for | +20 |
| | B is one band off | +10 |
| | A never named a size | +5 |
| Role | the best single role A pitches that B can answer: strong (B has the team, office or open roles it needs) | +15 |
| | weak (founder, CEO, ops) | +5 |
| Situations | each situation A looks for that B is in | +20 each |
| | `startup`, `b2b` and `remote`, being generic | +5 each |
| | cap on the facet | 35 |
| Rival | same `sells.category`, unless the category is generic (`other`, `software`) | −40 |
| Near-rival | two or more shared product tags, when not rivals | −10 |

The score is the sum, rounded and clamped to 0..100. `THRESHOLDS = { match: 55, hot: 70 }`: 70 or more is hot, 55 or more is a match (shown as warm), below 55 is none. The most a pair can score is 95 (25 + 20 + 15 + 35); the best pair in the demo scores 85.

A worked pair, as the app shows it:

```
Hirewire → Ledgerly: 80, hot
  +25 targets fintech companies and Ledgerly is one
  +20 wants companies of 11-50 people and Ledgerly has about 40
  +15 pitches to CTOs and Ledgerly has an engineering team
  +20 looks for companies that are hiring — Ledgerly is hiring

Ledgerly → Hirewire: 55, a match
  +10 pitches any industry
  +20 wants companies of 11-50 people and Hirewire has about 25
   +5 pitches to founders and Hirewire has a founder
  +20 looks for companies that have no finance team — Hirewire has no finance team
```

`computeAll()` scores every ordered pair of live cards; binned cards are never scored. A pair at or above the threshold is a want. A mutual match is a pair where both directions clear it, scored as the rounded average of the two. Lists are sorted best first, and each company records its rivals. On the demo deck: 18 live cards, 306 ordered pairs, 113 over the bar, 29 hot, 21 mutual, 10 of those across inboxes. No demo pair triggers the rival or near-rival penalty; the rival rule is exercised by synthetic pairs in `tests/match.test.js` and `tests/match_edge.test.js`. The tests also check that every score equals the sum of its reasons. A card listed twice counts once, and every list is sorted by score and then by id, so neither the order of the deck nor the browser changes any answer, ties included (tested in `tests/match_edge.test.js`, which also checks that the demo's scores are unchanged by the hardening).

`suggestListenPrice()` proposes a price for a company's attention by size (`LISTEN_PRICE_BY_BAND`, cents): 1-10 people $25, 11-50 $75, 51-200 $100, 201-1000 $200, 1000+ $400. Companies set their own when they join.

## 7. The market

`js/engine/market.js`. `DEFAULT_CONFIG`:

| Setting | Default | Meaning |
|---|---|---|
| `splitsBp` | listener 5000, listenerContributor 2000, pitcherContributor 1000, platform 2000 | Basis points of each paid pitch. Must sum to 10,000 or `createState()` and the House rules refuse them. |
| `creditBonusBp` | 2500 | A listener paid in credits gets 25% more. |
| `meetingMultiplier` | 2 | A meeting costs twice the listen price. |
| `cardTtlDays` | 30 | An invited company that never answers is deleted after this, per the letter. |
| `responseDays` | 7 | A paid pitch must be answered within this, per the letter. |
| `matchThreshold` | 55 | Taken from `match.js`. |

`createState()` checks every setting: whole basis points that sum to 10,000, a positive meeting multiplier, a credit bonus from 0 to 10,000 basis points, a threshold from 0 to 100, and days above zero. The largest amount the market accepts is $4,503,599,627.37 (`MAX_CENTS`), the most that stays exact to the cent through every multiplication (tested).

The state holds the config, the contributors (the three inboxes), the cards, one market record per live company, offers, open pitches, the ledger, the outbox, the Dealer's log and the current matches. Ids come from one counter: `offer-001`, `led-002`, `mail-003`. Tests freeze the clock with `fixedNow`.

A company's market record: `status` (starts `dealt`), `listenPriceCents` (the suggested price), `payout` (`cash` or `credits`), `openBooth` (false), credit and cash balances, and `contributorId`: the inbox of the card's first email. Deskwell emailed you first and Priya second, so only your inbox is credited for Deskwell.

## 8. Consent

```
dealt ──invite()──▶ invited ──optIn()───▶ opted_in
                       └─────decline()──▶ declined
```

- `invite()` moves every dealt company (or the ones named) to invited and puts one letter per company in the outbox. Inviting twice sends nothing (tested).
- `optIn()` records the price, the payout and the booth. A declined company cannot join: "In this demo a declined company stays declined."
- `decline()` refuses a company that already joined, and the Dealer says: "Card deleted in 30 days. Nothing else happens."
- `propose()` refuses unless both companies have opted in: "No pitch reaches a company that has not opted in" (tested).
- Consent runs in order. A company can join or decline only after it has been invited ("A company can join only after it has had the invitation letter"). A second decline changes nothing, so the 30-day clock does not restart. Inviting a list that names an unknown company invites nobody. A failed join leaves the company exactly as it was (all tested in `tests/market_edge.test.js`).
- Neither the 30-day deletion nor the 7-day refund runs on a timer. The demo has no clock. The refund itself exists as an action, `refund()`: a paid, unanswered pitch returns the money (or the credits) to the pitcher and pays nobody (`tests/market_refund.test.js`); a person presses it, not a clock.

**The letter** (`inviteEmail()`), subject "You pitched your inbox. Here's a better pitch.", in four parts: when the company emailed whom; what was done ("we read your email and wrote a one-line card"; "We did not share your email address, or this message, with anyone"); what is on the table (how many companies in the pool look like its targets, and how many of those want it back: 12 and 8 for Ledgerly on a fresh demo); and four options: join and set a price, keeping 50%; pay to pitch a matched company that has agreed to listen; read pitches to earn credits; or do nothing and be deleted in 30 days. Every email ends: "(Demo: this message was generated, not sent. No money moved.)"

## 9. Offers: pay to pitch

| Kind | What happens (`KINDS`) | Price floor (`priceFloor()`) |
|---|---|---|
| Read | The listener reads a one-page pitch and must answer interested, not now, or no. | The listener's listen price |
| Meeting | A 20-minute video call. | 2 × the listen price, rounded up to a whole cent |
| Swap | A 30-minute call; both sides pitch each other. Cash only. | The proposer pays 2 × the listener's listen price; the listener pays 2 × the proposer's back |

`canPitch()` is the gate, in order: rivals never, even into an open booth; an open booth hears anyone; otherwise the score must reach 55.

`propose()` also checks that a company is not pitching itself ("Tempting, though."), that the price is a number at or above the floor, and that a swap is not paid in credits. The Dealer drafts a pitch from the card if the pitcher leaves it blank. The listener receives a request email: who, why ("Why they want you: ..."), what accepting means, and its share: 50% in cash, or that plus 25% in credits.

```
proposed ──acceptOffer()──▶ accepted ──pay()──▶ paid ──complete()──▶ completed
    └──────declineOffer()──▶ declined   (no money moves)
```

`pay()` (simulated) works only after acceptance. Cash: a `payment` from the pitcher and an `escrow_in`. Credits: the balance is checked first ("has $46.88 in credits and needs $60.00. Listen to a pitch or two first."), then `credits_spent` and a credits-flagged `escrow_in`. A swap adds the back leg. Then the introduction goes to both sides with both contact lines, "the first time either side sees them", and the pitcher gets a receipt marked SIMULATED.

`complete()` works only on a paid offer, and a read needs its answer. It releases escrow through `distribute()`, twice for a swap, and sends a statement to every inbox that earned.

## 10. The split

`distribute()`, for one gross payment:

```
listener            = round(gross × 5000 / 10000)
listenerContributor = round(gross × 2000 / 10000)
pitcherContributor  = round(gross × 1000 / 10000)
platform            = gross − the three above          (SpamDeck absorbs rounding)
```

- `escrow_out` releases the gross.
- The listener is paid in cash (`payout`). If it takes credits instead, it gets `round(listener × 1.25)` as `credits_earned`; when the pitch was paid in cash, SpamDeck records `platform_holds` for the cash it keeps against those credits.
- The inbox that supplied the listener and the inbox that supplied the pitcher each get a `payout`. One inbox can be both. A share with no inbox behind it goes to SpamDeck.
- SpamDeck records its `platform_fee`. When the pitch was paid in credits, no cash came in: SpamDeck records `platform_funds`, a negative entry for the cash it pays out, and takes no fee.

Example from `tests/market.test.js`: Hirewire pays $75 to pitch Ledgerly; Ledgerly gets $37.50, your inbox $15.00 + $7.50 = $22.50 (you supplied both), SpamDeck $15.00.

## 11. Credits

The test "listen to earn" in `tests/market.test.js`, step by step:

1. Outreachly pays $75 in cash to pitch Meridian, which takes credits: 50% of $75 is $37.50, plus 25% is $46.88 in credits. SpamDeck holds $37.50 against them and takes its $15.00 fee.
2. Meridian offers Deskwell $60 in credits and is refused at payment: it has $46.88.
3. Meridian spends $45.00 of credits on Deskwell. Deskwell is paid $22.50 in cash; the inboxes $9.00 and $4.50. SpamDeck pays that $36.00 from what it held and takes no fee. $1.88 of credits remain.

The identity behind it: SpamDeck keeps 50 cents in cash for every 62.5 cents of credits it issues, which is 80 cents per credit dollar. Honoring a credit dollar costs it the 80 cents that go to the listener and both inboxes, plus the 20-cent fee it forgoes. (1 + 0.25) × (1 − 0.20) = 1, so the held cash covers the credits exactly and the 25% sweetener is paid for by the fee. It holds only at the default split: the bonus is fixed at 25%, and the House rules change the shares.

## 12. Open pitches: listen to earn

- `postOpenPitch()`: an opted-in pitcher sets a price per read and a number of readers. The whole budget (price × readers) is charged up front, simulated, into escrow. The minimum match score defaults to 55. A price or a number of reads that is not a finite number is refused (tested). The app's form starts at $20 a read and 5 readers (`views.js`).
- `eligibleReaders()`: opted in, not the pitcher, not already a reader, not a rival, and either an open booth or a score from the pitcher of at least the minimum. A closed pitch has no eligible readers (tested).
- `readOpenPitch()`: the reader must answer interested, not now, or no. Each read is split like any paid pitch, so a reader that takes credits gets 25% more. The pitch closes when the last reader answers.
- `closeOpenPitch()`: refunds what is left (`escrow_out` and `refund`).

Tested: Stackline posts 3 reads at $20; Chatterbox, on credits, earns $12.50; Nordic Bean is not eligible; closing early refunds $40.

## 13. The ledger

Every entry has an id, a time, a type, a party (company, contributor, platform or escrow), a signed amount in cents, a credits flag and a memo.

| Type | Party | Sign | When |
|---|---|---|---|
| `payment` | company | − | A pitcher pays cash (simulated); also a swap's back leg and an open pitch's budget |
| `credits_spent` | company | − (credits) | A pitcher pays with credits |
| `escrow_in` | escrow | + | Money or credits held |
| `escrow_out` | escrow | − | Released on completion, or unused budget returned |
| `payout` | company or contributor | + | The listener's cash share; each inbox's share |
| `credits_earned` | company | + (credits) | A listener took credits |
| `platform_holds` | platform | + | Cash kept against credits owed |
| `platform_fee` | platform | + | SpamDeck's share, plus any unclaimed inbox share |
| `platform_funds` | platform | − | Cash SpamDeck pays out on a credits-paid pitch |
| `refund` | company | + | Unused open-pitch budget returned, or a paid pitch nobody answered (simulated) |
| `credits_refund` | company | + | Credits returned for an unanswered pitch bought with credits |

Invariants, asserted in `tests/market.test.js` and `tests/market_edge.test.js`: every entry is a whole number of cents, and anything else is refused at the door; cash entries sum to zero after every scenario; escrow empties when pitches complete; credit entries sum to the credits still outstanding; odd amounts (0, 1, 3, 7 and 333 cents, and every amount up to $1,000) split exactly. `tests/market_property.test.js` runs 300 seeded random sequences of market actions under six different house rules and checks every invariant after every action.

`summary()` totals the ledger for the Ledger tab: each inbox's earnings; each company's cash earned, credits and amount paid (refunds subtracted); SpamDeck's total; escrow; credits outstanding; volume paid in (payments plus credits spent, less refunds); and pitches heard (completed offers plus open-pitch reads).

After the full story, asserted by `tests/tour_replay.test.js`, which replays `js/app/tour.js` through the engine: 50 ledger entries; cash sums to zero; $925.00 paid in across 6 pitches heard; $250.00 to your inbox, $20.00 to Priya's, $7.50 to Hirewire's; $177.50 kept by SpamDeck, $1.50 of it held against the $1.88 of credits still outstanding. All simulated.

## 14. The outbox

Five kinds of email, none sent: invitations, pitch requests, introductions, receipts and statements. They land in the Outbox tab. After the full story there are 50 (`tests/tour_replay.test.js`): 18 invitations, 6 requests, 6 introductions, 6 receipts, 14 statements. A statement tells an inbox its share and running total, then: "You did nothing. That was the point."

## 15. The app

- **`store.js`** holds `{ app, emails, market }`, saves it to `localStorage` (key `spamdeck.v1`) after every action, and restores it on load. Reset rebuilds the demo; the API key survives. Pasting a pitch needs a sender address with an @, because the domain names the company; it is filed under your inbox. Dealing uses the demo labels for demo emails and the simple reader for everything else.
- **Playing as.** The menu at the top holds "Everyone (demo mode)", in which every button works, and each company with its status. Playing as a company, only its own buttons work: only the listener accepts, declines and answers; only the pitcher pays; only an invited company can join or decline its invitation. That is how consent is demonstrated: you accept your own invitation.
- **`views.js`** draws seven screens (Inbox, Deck, Matches, Market, Ledger, Outbox, What is real) and the dialogs: paste a pitch, join, propose, the SpamPay checkout, answer, open pitch, read an open pitch, and the key. Each screen is a function of the state, redrawn whole on every change.
- **`tour.js`** runs the 14 story steps forward on a fresh demo. Back re-reads the previous line without undoing anything.
- **`main.js`** draws the tabs with their counts, the stats strip, the Dealer's bar (the last log line, or the story line) and the actor menu, and handles live reading. It also reads the deep links: `?story=N` fast-forwards a fresh demo to step N + 1 (N from 0 to 13), `&tab=` picks the tab, and `&bare` hides the Dealer's bar and the footer. Arrow keys move the story; Escape closes a dialog.
- **`claude.js`** keeps the key in `sessionStorage` (`spamdeck.key`) and the model in `localStorage` (`spamdeck.model`).

## 16. Reproduce the numbers

From the repository root:

```
node --test
```

109 tests, 109 passing (measured 2026-10-24 on Node 24.16.0), in 13 files: `extract.test.js`, `extract_edge.test.js`, `market.test.js`, `market_edge.test.js`, `market_property.test.js`, `market_refund.test.js`, `market_split.test.js`, `match.test.js`, `match_edge.test.js`, `reader_extra.test.js`, `taxonomy.test.js`, `taxonomy_edge.test.js` and `tour_replay.test.js`.

Matcher counts on the hand-labeled deck (prints `113 29 21`: pairs over the bar, hot pairs, mutual pairs):

```
node -e "const X=require('./js/engine/extract.js'),M=require('./js/engine/match.js'),{EMAILS}=require('./js/data/demo_inbox.js'),{READINGS}=require('./js/data/demo_cards.js');const r=M.computeAll(X.dealEmails(EMAILS,e=>X.readFixture(e,READINGS)).cards);console.log(r.pairs.length,r.pairs.filter(p=>p.tier==='hot').length,r.mutual.length)"
```

The same deck dealt by the simple reader (prints `29 0 2`):

```
node -e "const X=require('./js/engine/extract.js'),M=require('./js/engine/match.js'),{EMAILS}=require('./js/data/demo_inbox.js');const r=M.computeAll(X.dealEmails(EMAILS,X.heuristicRead).cards);console.log(r.pairs.length,r.pairs.filter(p=>p.tier==='hot').length,r.mutual.length)"
```

The story's totals in sections 13 and 14 are asserted by `tests/tour_replay.test.js`. The amounts at each step of the README's walkthrough come from the same replay of `js/app/tour.js`.
