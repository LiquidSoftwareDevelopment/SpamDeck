# The business model

SpamDeck turns sales pitches nobody asked for into paid, consented introductions between the companies that sent them. Every number on this page carries a label:

- **default**: a setting in the code. It can be changed.
- **a guess**: nothing measured stands behind it.
- **measured**: read from a named file or test.
- **reasoned**: worked out from the code's rules, with no measurement behind it.

All money is simulated. There are no users, no revenue and no pilots.

## The incentives

One for each party, as built.

1. **Pay to pitch.** A company pays another company's listen price for a read, twice that for a 20-minute meeting (default: `meetingMultiplier` 2, `js/engine/market.js`), or both pay each other's meeting price in a swap. It can pitch only a company that matches it (a score of 55 or more out of 100, default, `js/engine/match.js`) or has opened its booth, and never a rival. It pays only after the listener accepts, and the money is held until the listener answers (simulated escrow). Why it would pay: it already buys leads and meetings, and this one is matched, consented and answered (reasoned, not measured).
2. **Get paid to listen.** The listener keeps 50% of every pitch it hears (default) and sets its own price. A read ends with an answer (interested, not now, or no), so the pitcher buys a response, not an open rate.
3. **Listen to earn.** A company with no budget can take credits instead of cash, worth 25% more (default: `creditBonusBp` 2500), and spend them on its own pitches. Pitchers can also post open pitches that any matched company may read for a price per read.
4. **Pool everyone's spam.** An inbox that contributes its pitches earns on every paid pitch involving a company it brought: 20% when that company is the listener, 10% when it is the pitcher (defaults). A wider pool means more matches (reasoned).
5. **Earn across the pool.** An inbox earns even when the other side came from someone else's inbox. Chatterbox, from your inbox, pays $100 to pitch Boomerang Returns, from Priya's: Priya earns $20, you earn $10 (measured: the cross-pool test, `tests/market.test.js`).
6. **Invite the spammers to monetize their own spam.** Every invited company receives spam too. Once it joins, it can contribute its own inbox and earn on the pitches it receives. Hirewire pitched you, joined, and contributed its inbox; Vettd's pitch to Hirewire turns out to match Hirewire (measured: the viral-loop test, `tests/match.test.js`). That is the growth loop on paper. Nothing has measured it in the world.

## The split

| Share of each paid pitch | Default | The reason the app gives |
|---|---|---|
| The listener | 50% | The listener's time is the scarce good. |
| The inbox that supplied the listener | 20% | It did the real work. |
| The inbox that supplied the pitcher | 10% | It found the buyer. |
| SpamDeck | 20% | It runs the market. |

All four are defaults (`DEFAULT_CONFIG.splitsBp` in `js/engine/market.js`, in basis points that must sum to 10,000), and the app calls them "a first guess, not a measurement" (`js/app/views.js`). They can be changed under **Ledger → House rules**; a change applies to pitches completed after it.

Rules that come with the split, from `distribute()`:

- SpamDeck absorbs the rounding, so the four parts always add up to the payment (measured: cash conserved to the cent in every scenario in `tests/market.test.js`, and every amount up to $1,000 split exactly in `tests/market_edge.test.js`).
- A share with no inbox behind it goes to SpamDeck. Every company in the demo came from an inbox, so this never fires in the demo (reasoned from the data).
- One company has one supplying inbox: the inbox of its first email. Deskwell pitched you first and Priya second, so only your inbox earns on Deskwell (reasoned from `addCards()`).

Worked examples (measured: `tests/market.test.js`; all simulated):

| Pitch | Paid | To the listener | To the inboxes | To SpamDeck |
|---|---|---|---|---|
| Hirewire → Ledgerly, a read | $75.00 | $37.50 | yours $22.50 (you supplied both) | $15.00 |
| Chatterbox → Boomerang Returns, a read | $100.00 | $50.00 | Priya's $20.00, yours $10.00 | $20.00 |
| Deskwell ⇄ Nordic Bean, a swap (listen prices $100 and $25) | $50.00 + $200.00 | Nordic Bean $25.00, Deskwell $100.00 | yours $75.00 (both legs) | $50.00 |

## Credits

The bonus is 25% (default). The app does not let you change it.

| Step | Amount | Label |
|---|---|---|
| Outreachly pays $75 to pitch Meridian, which takes credits | 50% of $75 = $37.50, plus 25% = $46.88 in credits | measured: the listen-to-earn test, `tests/market.test.js` |
| What SpamDeck keeps | $37.50 in cash against the credits, plus its $15.00 fee | measured: same test |
| Meridian spends $45.00 of credits pitching Deskwell | Deskwell gets $22.50 in cash; the inboxes $9.00 and $4.50 | measured: same test |
| What that costs SpamDeck | $36.00 paid out, no fee | measured: same test |

**The identity** (reasoned from `distribute()`): for every dollar of credits it issues, SpamDeck holds 50 / 62.5 = 80 cents in cash. For every dollar of credits spent, it pays out 80 cents (50 to the listener, 30 to the inboxes) and forgoes its 20-cent fee. So (1 + 0.25) × (1 − 0.20) = 1. The cash held covers the credits exactly, SpamDeck nets zero on the credit flow, and the sweetener costs exactly the fee forgone: 0.25 × 0.5 = 0.2 × 1.25 × 0.5 = 0.125 of the original payment.

The conditions, each reasoned from the code:

- It holds at the default split only. The House rules can move SpamDeck's share; the 25% bonus does not move with it. Below 20%, honoring a credit costs SpamDeck more than the cash it held; above 20%, less.
- It assumes both inboxes are claimed. An unclaimed share is simply not paid out on a credits-paid pitch, so SpamDeck spends less.
- Rounding to the cent can move it by a cent.

## Prices

What SpamDeck suggests a company charge for its attention, by headcount (`LISTEN_PRICE_BY_BAND` in `js/engine/match.js`). These are defaults, and the bands and prices are a guess: the code's only reasoning is that bigger companies' attention costs more.

| Company size | Read | Meeting (2×) |
|---|---|---|
| 1–10 people | $25 | $50 |
| 11–50 | $75 | $150 |
| 51–200 | $100 | $200 |
| 201–1,000 | $200 | $400 |
| 1,000+ | $400 | $800 |

- In a swap, each side pays the other's meeting price (default).
- Companies set their own price when they join. In the story (`js/app/tour.js`), Deskwell asks $40 against a suggested $100, Nordic Bean $25 against $75, and Brightpath Ventures $500 against $25, with its booth open to anyone.
- Open pitches: the form starts at $20 per read, 5 readers and a minimum match of 55 (defaults, `js/app/views.js`).
- Timers: a paid pitch is answered within 7 days or the pitcher is refunded, and an ignored invitation is deleted after 30 days (defaults, `js/engine/market.js`). The demo has no clock: the refund exists as an action a person takes (`refund()`), the deletion only as a promise in the letter.

## What one story produces

The 14-step story on a fresh demo (measured: `tests/tour_replay.test.js`, which replays `js/app/tour.js` through the engine): $925.00 paid in across 6 pitches heard; your inbox $235.00, Priya's $35.00, Hirewire's $7.50; SpamDeck $177.50, of which $1.50 is held against the $1.88 of credits still outstanding. Priya's share includes half of Deskwell's inbox credit: Deskwell pitched both inboxes, so both earn on it. This is the arithmetic of a scripted demo with fictional companies. It is not a forecast.

## Can it be gamed?

Reasoned, not measured. A ring that controls both companies and both inboxes in a pitch gets back 80 cents of every dollar it cycles; the other 20 is SpamDeck's fee. Routing the money through credits changes nothing at the default split, by the identity above. Paying yourself loses 20% a lap.

The cheaper attack is a fake inbox: a contributor earns 20% or 10% for forwarding an email. Nothing in the demo checks that a contributed or pasted email is real.

## Open questions

None of these has been tested with a real company.

- **Will spammers pay?** Reasoned: they already pay for leads and meetings, and one card in the demo deck, Meridian Outbound, sells exactly that. Not measured.
- **Will anyone listen for money?** The listener sets the price, and the suggested prices are a guess. Untested.
- **Is 50/20/10/20 right?** A guess. The case for the inbox shares: inboxes are the supply. The case against: the statement email itself says "You did nothing."
- **Does it reward spam?** A company enters the deck by spamming a contributor. It then pays for every pitch it makes, and the letter it receives answers an email it sent first. Whether that deters spam or invites more is unknown.
- **Shared supply.** When a company pitched several inboxes in the pool (Deskwell pitched two), each inbox share is split equally among those inboxes, in order of arrival, and the cents that do not divide go to SpamDeck (`tests/market_split.test.js`). Whether equal is the right split, or the first inbox deserves more, is untested.
- **Price discovery.** Listeners set prices with only a size-based suggestion to go on. Whether prices settle, and where, is unknown.
- **Cold start.** Three inboxes and 18 companies yield 21 pairs that want each other (measured: the matcher on the demo deck, reproducible from [WHAT_IS_REAL.md](WHAT_IS_REAL.md#measured-numbers-and-how-to-reproduce-them)). How many inboxes a real pool needs is unknown.
- **Legal.** No contact details are sold, and the invitation replies to an email the company sent first. CAN-SPAM, GDPR and consent records still need counsel before launch.
- **Credits are a liability.** Outstanding credits are owed in pitches, backed by held cash at the default split. Credits spent on a pitch nobody answers come back as credits (`refund()`); expiry is undecided and the demo has none.
