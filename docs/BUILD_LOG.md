# Build log

How SpamDeck was built, the decisions that shaped it, what is not built, and what would come next. The files record no dates or hours of work, so this log gives none.

## Who did what

- **The idea:** Michael Allen, founder. Charge spammers to pitch each other.
- **The build:** Claude Code. Claude Fable 5.1 led. It turned the idea into a design: the mechanics (consent, pay to pitch, the split, credits, open pitches, the pool), the demo cast (22 emails across three inboxes, and their hand-labeled readings), the engine, the tests and the app.
- **The helpers:** Claude Opus 5.5. They hardened the engine against odd input (consent in strict order, whole cents everywhere, senders on subdomains and free-mail addresses, the same answer in every browser), added edge-case tests and a replay of the story, wrote these documents, made the visuals, and reviewed the entry as a judge would.

## Decisions, and why

**1. No build step.** `index.html` loads twelve plain scripts; there is no bundler, no framework and no package to install ("No framework, no build.", `js/app/dom.js`). Why: a judge can open the file or the Pages link and nothing has to be installed, compiled or trusted first. The same engine files load in Node, so the tests run the code the browser runs.

**2. A deterministic, explainable matcher.** Fixed weights in `js/engine/match.js`, and a sentence for every point. Why: a company asked to pay for someone's attention, or to give its own, should be able to see why it was matched. A judge can audit any score, and the tests can demand that every score equals the sum of its reasons. The cost is stated in the app: it misses matches a human would see, and the weights were tuned by hand on this deck.

**3. Money in integer cents, splits in basis points.** Why: no floating-point drift. SpamDeck absorbs the rounding, so the parts always add up to the whole, and the tests can demand that cash is conserved to the cent.

**4. The Dealer.** One persona reads the pitches, narrates every step and signs every letter. The card-table words (deal, deck, binned, flip, booth) make the mechanics easy to follow. The persona carries the humor, and the system prompt fences it: "Observant, never cruel." Why: the joke is the reversal of power, the spammed person earning from the spam, and it has to stay on the right side of mean.

**5. Three readers.** Hand labels, an offline simple reader, and Claude with your own key. Why: the demo must work offline and without a key, a pasted pitch must work too, and the real reader must be one click away. Every card names its reader, and the hand labels say plainly that they were written by hand.

**6. Consent first.** The engine refuses any pitch to a company that has not opted in. Contact details appear only after the listener accepts and the pitcher pays. The invitation says what was read and what was not shared, and doing nothing deletes the card. A decline is final in the demo. Why: without consent this would be list selling. With it, it is a marketplace.

**7. Bring your own key, no server.** Why: nothing to host, no secrets held, no data collected. The key stays in the tab that uses it.

**8. A simulation that says so.** SpamPay calls itself a fake checkout, receipts say SIMULATED, every email says it was generated and not sent, and the Ledger is marked "no real money". Why: a judge should never have to wonder what is real.

**9. Playing as.** Why: one person at one keyboard cannot show consent between companies unless they can be each company in turn. When you accept your own invitation, the yes is something you did, not something you were told.

**10. A story with deep links.** Fourteen steps that touch every mechanism, and `?story=N` to land on any of them. Why: a judge has about two minutes.

**11. Tests in Node's own runner.** No dependencies, and the GitHub Pages workflow deploys only after they pass. Why: a test suite that needs nothing installed is one a judge will actually run.

## What is not built

- Real payments: no provider, no payouts, no real escrow. (The refund of an unanswered pitch exists as an engine action, simulated like everything else.)
- Real email: nothing sent or received, and no connected inbox. Pitches come from the demo data or are pasted.
- Accounts, sign-in, or a second person. The state lives in one browser.
- Any server.
- The 7-day answer window and the 30-day deletion, as timers. The refund is a button-sized action, not a clock; the deletion is a promise in the letter.
- A learned matcher, or any route from listeners' answers back into the weights.
- Live reading of a whole inbox in one go; Claude reads one email at a time.
- A way to change the credit bonus.

## What would come next

Plans, not commitments, and no dates.

1. Counsel on CAN-SPAM, GDPR and consent records, before any real email is read or sent.
2. A first real pool: a handful of real inboxes, to measure the two unknowns that decide everything. Will pitchers pay? Will listeners answer?
3. A payment provider for escrow and payouts, and a clock to enforce the 7-day refund and the 30-day deletion.
4. Feedback into matching. Every read already ends in interested, not now or no; those answers are the signal the matcher lacks.
5. A measurement of the live reader against the hand labels, as the simple reader is measured today.
6. A measured answer to whether equal sharing of an inbox credit between the inboxes a company pitched is the right rule (today it is equal, in order of arrival).
