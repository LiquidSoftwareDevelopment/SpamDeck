# What is real

"Judges deserve a straight answer. Here it is." That is the app's own line, on its **What is real** tab (`js/app/views.js`, `reality()`). This page gives the same rows with the detail behind each, then what leaves your browser, what is not built, and how to reproduce every measured number.

## The rows

| Part | Status |
|---|---|
| Reading pitches (the AI) | Real when Live AI is on. Hand labels and an offline simple reader otherwise. |
| Matching | Real. Deterministic, explained, weights a first guess. |
| Consent and the invitations | Real logic, fictional people. Nothing is sent. |
| Payments | Simulated. No provider, no card, no money. |
| The ledger and the splits | Real arithmetic on simulated payments. |
| Credits | Real logic, simulated value. |
| The pool (three inboxes) | Fictional. |
| Traction | None. |

### Reading pitches (the AI)

- **Live AI is real.** With your Anthropic key, the request is built in `js/engine/extract.js` and sent by `js/app/claude.js` from your browser to `https://api.anthropic.com/v1/messages`. The system prompt and the JSON schema it must fit are printed on the **What is real** tab. The whole request is built in one function, `buildRequest()`, in plain view.
- **The live call is not exercised by the tests.** `tests/extract.test.js` checks the shape of the request (no key in it, strict JSON schema, Opus by default) and the handling of sample responses, including a refusal. The sample response is written by hand for the test; its token counts are made up.
- **Without a key, the 22 demo emails are read from hand labels** (`js/data/demo_cards.js`). They were written by hand for the demo by the model that built SpamDeck. They were not recorded from an API call, and the file says so at the top. Everything the story shows is built on them.
- **Anything you paste is read by the simple reader** (`heuristicRead()` in `js/engine/extract.js`): offline keyword rules. On the 22 demo emails it agrees with the hand labels on every company name (by prefix; 19 of 22 are exact) and every product category (measured, `tests/extract.test.js`). Its rules were written with those same emails in view, so that is a fit, not a test on unseen spam. Its targeting is crude: from the same emails it finds 2 mutual matches where the hand labels find 21 (below).
- **Each card names its reader:** "demo label", "simple reader" or "live AI".

### Matching

Real, and deterministic: the same deck always gives the same scores. The weights and the two thresholds (55 for a match, 70 for hot) are constants at the top of `js/engine/match.js`. Every point carries a sentence, and the tests check that every score equals the sum of its reasons (`tests/match.test.js`). The weights are, in the app's words, "a first guess, tuned by hand on this deck". They fit this deck. Nobody has measured them on real pitches.

### Consent and the invitations

Real logic, fictional people.

- The engine refuses any pitch to a company that has not opted in (`propose()` in `js/engine/market.js`), and any join or decline before the invitation (both tested).
- Contact details appear in one place: the introduction email, written after the listener accepts and the pitcher pays.
- No email is sent. Every letter lands in the Outbox and ends: "(Demo: this message was generated, not sent. No money moved.)"
- You give the yes yourself. The **Playing as** menu lets you act as any company; as that company, only its own buttons work.
- The 30-day deletion of an ignored invitation and the 7-day refund of an unanswered pitch are promises in the letters. The demo has no clock: the refund exists as an action (`refund()` in `js/engine/market.js`, tested in `tests/market_refund.test.js`), the deletion does not.

### Payments

Simulated. SpamPay is a fake checkout: "This is where a payment provider would go. There is none. Nothing is charged, ever." It shows a test card number as plain text; there is no field to type a card into. Receipts carry SIMULATED in the subject line. No payment provider is wired in anywhere.

### The ledger and the splits

Real arithmetic on simulated payments. Amounts are integer cents; shares are basis points; SpamDeck absorbs the rounding. `tests/market.test.js` asserts after every scenario that cash entries sum to zero, that escrow empties when pitches complete, and that credit entries match the credits outstanding. `tests/market_edge.test.js` adds that the ledger refuses anything but whole cents and that odd amounts split exactly, and `tests/market_property.test.js` checks every invariant after every action in 300 seeded random sequences.

### Credits

Real logic, simulated value. Credits are earned by listening, held, spent on pitches and checked against balances by the same engine. Nobody can buy them or cash them out.

### The pool (three inboxes)

Fictional. 22 emails in three inboxes: yours (14), Priya's (5) and Hirewire's (3), all in `js/data/demo_inbox.js`. Every company, person and domain is invented, and every domain ends in `.example`.

### Traction

None. No users, no revenue, no pilots, no partners. This is a competition entry.

## What leaves your browser

- **With Live AI off: nothing.** The page loads only its own files: no analytics, no web fonts, no third-party scripts. The code makes no network request.
- **With Live AI on:** each read sends one request to `api.anthropic.com` carrying your key and that email's sender, date, subject and body. That `fetch` in `js/app/claude.js` is the only network call in the code.
- **Kept in your browser:** the demo state in `localStorage` (`spamdeck.v1`), the chosen model in `localStorage` (`spamdeck.model`), and the key in `sessionStorage` (`spamdeck.key`), which the browser forgets when the tab closes. **Reset** rebuilds the demo and keeps the key; **Forget key** or **Turn off** removes it.

## What is not built

- Real payments, payouts or escrow. (Refunds exist as simulated ledger moves.)
- Real email: no sending, no receiving, no connected inbox. Pitches come from the demo data or are pasted in.
- Accounts, sign-in, or a second person. The state lives in one browser.
- A server of any kind.
- The 30-day deletion and the 7-day response window, as timers.
- A learned matcher, or any route from listeners' answers back into the weights.
- Live reading of the whole inbox at once. **Deal all** uses the demo labels or the simple reader; Claude reads one email at a time.
- Rejoining after a decline ("In this demo a declined company stays declined").

## Measured numbers, and how to reproduce them

| Number | Measured from | Reproduce |
|---|---|---|
| 109 tests in 13 files, 109 passing | `node --test`, Node 24.16.0, 2026-10-24 | `node --test` |
| Simple reader against the hand labels: names 22 of 22 (prefix), categories 22 of 22, bin decisions 22 of 22 | `tests/extract.test.js` (asserts a floor of 20) | `node --test` |
| Hand-labeled deck: 113 pairs at 55 or more, 29 hot, 21 mutual | `computeAll()` on the demo deck | first command below |
| The same emails dealt by the simple reader: 29 pairs, 0 hot, 2 mutual | `computeAll()` on that deck | second command below |
| The story on a fresh demo: $925.00 paid in (simulated), 6 pitches heard, $250.00 to your inbox, $177.50 to SpamDeck, 50 ledger entries, 50 emails in the Outbox | `tests/tour_replay.test.js`, which replays `js/app/tour.js` through the engine | `node --test`, or play the story and open the Ledger and the Outbox |

From the repository root:

```
node -e "const X=require('./js/engine/extract.js'),M=require('./js/engine/match.js'),{EMAILS}=require('./js/data/demo_inbox.js'),{READINGS}=require('./js/data/demo_cards.js');const r=M.computeAll(X.dealEmails(EMAILS,e=>X.readFixture(e,READINGS)).cards);console.log(r.pairs.length,r.pairs.filter(p=>p.tier==='hot').length,r.mutual.length)"
```

prints `113 29 21`.

```
node -e "const X=require('./js/engine/extract.js'),M=require('./js/engine/match.js'),{EMAILS}=require('./js/data/demo_inbox.js');const r=M.computeAll(X.dealEmails(EMAILS,X.heuristicRead).cards);console.log(r.pairs.length,r.pairs.filter(p=>p.tier==='hot').length,r.mutual.length)"
```

prints `29 0 2`.

```
node -e "const X=require('./js/engine/extract.js'),{EMAILS}=require('./js/data/demo_inbox.js'),{READINGS}=require('./js/data/demo_cards.js');let p=0,x=0,c=0;for(const e of EMAILS){const f=X.readFixture(e,READINGS),h=X.heuristicRead(e);if(f.company.name.toLowerCase().startsWith(h.company.name.toLowerCase()))p++;if(f.company.name===h.company.name)x++;if(f.sells.category===h.sells.category)c++;}console.log(p,x,c)"
```

prints `22 19 22`: the simple reader's company names by prefix, names exactly, and product categories, against the hand labels.

## Numbers that are guesses

- The split, 50/20/10/20: "a first guess, not a measurement" (`js/app/views.js`).
- The 25% credit bonus.
- The suggested listen prices by company size (`js/engine/match.js`).
- The match weights and the thresholds of 55 and 70.
- "Each read costs a fraction of a cent to a few cents depending on the model", in the key dialog. No live call has been measured for this repository.
- "Play the story (2 minutes)", the welcome button's estimate.
