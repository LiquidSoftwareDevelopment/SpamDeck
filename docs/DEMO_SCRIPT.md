# Demo script

A three-minute click path for judges, then things to try. The times are a guess; the letters are worth reading and take longer. Every payment is simulated and no email is sent.

## Three minutes

**Before you start.** Open the live link, or `index.html`. **Play the story** always starts from a fresh demo, so nothing needs resetting first.

Press **Next** to move on. The table says what to try on each step and what to look for.

| When | Step | Try | Look for |
|---|---|---|---|
| 0:00 | Welcome card | **Play the story (2 minutes)**, or **Play the story** at the top right | The Dealer's bar at the bottom: the step count, its line, **Back**, **Next**, **Exit** |
| 0:05 | 1 · Inbox | Click any email | Three inboxes: yours, Priya's, Hirewire's. Nobody asked for any of it. |
| 0:15 | 2–3 · Deck | The **Binned** filter; **Flip** on any card | Cards landing one by one, then the tally. The scam and the newsletter, binned. The original email on the back of a card, and "contact hidden until both sides agree". |
| 0:35 | 4 · Matches | **Why** on Hirewire ⇄ Ledgerly | Every point as a sentence: 80 one way, 55 the other. |
| 0:55 | 5 · Outbox | Read the open letter | Ledgerly's invitation: what was read, what was not shared, four options, deletion in 30 days. |
| 1:15 | 6 · Market | Scroll | Eleven booths with their prices. Six companies still waiting. Podly, declined. |
| 1:25 | 7–9 · Market, Outbox, Ledger | Open the introduction | Hirewire's offer accepted; the introduction with both contact lines; then the split on the Ledger: $37.50, $22.50, $15.00. The story pays its offers directly, so the SpamPay checkout itself appears only when you pay an offer by hand (below). |
| 1:55 | 10–12 · Ledger | Watch the tiles | "Your inbox earned", "Priya's inbox earned" and "Credits outstanding" moving: across the pool, listen to earn, the swap. |
| 2:15 | 13 · Market | The **Pitches** table | Chatterbox's $500 read to Brightpath, with no match behind it. |
| 2:25 | 14 · Ledger | **Finish** | $250.00 to your inbox, simulated. |
| 2:30 | **What is real** tab | Scroll | The straight answer, the Live AI panel with the system prompt and schema, the honest weak spots. |
| 2:45 | Inbox | **Paste a pitch** | Below. |

**Short on time?** Each link opens a fresh demo at one step (`?story=N` counts from 0):

- `?story=3`: the matches (step 4)
- `?story=4`: Ledgerly's invitation (step 5)
- `?story=8`: the first split, on the Ledger (step 9)
- `?story=13`: the end state (step 14)

Add `&tab=ledger` (or any tab: `inbox`, `deck`, `matches`, `market`, `outbox`, `reality`) to choose the screen.

## Things to try

### Paste your own spam

1. **Inbox → Paste a pitch.**
2. **From:** `Name <name@company.com>`. The sender's domain names the company. **Subject** and **Body** as received.
3. **Add and deal.** Without a key the simple reader deals it. With Live AI on, the button reads **Add and read with Claude**.
4. The card lands in the Deck under your inbox, and the Matches tab rescores the whole deck.

The simple reader's rules were written for the demo emails, so it reads yours more crudely; that is what Live AI is for. When an email from a free-mail address (Gmail, Outlook) never names its company, the simple reader files it as "Unknown company" under the sender's address rather than inventing a company called Gmail. Your pasted email stays in this browser (`localStorage`) unless you send it to Anthropic with Live AI.

### Play as a company and decline

1. After the story, six companies are still invited. (Without the story: **Inbox → Deal all**, then **Market → Invite**.)
2. Open **Playing as** at the top and pick one still invited, such as Fortify Labs.
3. On the **Market** tab, under **Waiting**, only Fortify Labs' **Join** and **Decline** work. Every other company's buttons are disabled: you cannot say yes for someone else.
4. Press **Decline**. The Dealer: "Fortify Labs declined. Card deleted in 30 days. Nothing else happens." Fortify Labs can no longer be offered a pitch, and in this demo it cannot rejoin.
5. Pick another invited company and press **Join** instead: set a price, cash or credits, booth open or not.

### Change the house rules

1. **Ledger → House rules.** Four percentages, with their sum beside them.
2. Try 60 / 15 / 5 / 20 and **Apply**. The Dealer confirms. The new split applies to pitches completed from now on.
3. Try four numbers that do not add up to 100. The engine refuses: "The four shares must add up to 100%".
4. To see the new split at work, play as **Everyone**: **Market → Propose a pitch**, then **Accept**, **Pay** (SpamPay), **Answer the pitch**, and open the Ledger.

The credit bonus stays at 25%. The credits identity in the README balances only while SpamDeck's share is 20%.

### Turn on Live AI and re-read a card

1. Click **Live AI: off**. Paste an Anthropic API key, choose a model, **Save**. The chip now reads **Live AI: on**.
2. **Inbox**: open an email that has been dealt and press **Re-read with Claude (live)**. When the reading arrives, the card's label changes to "live AI" and the Dealer reports its confidence.
3. **Re-read with the demo label** puts the hand-labeled card back, for comparison.
4. **What is real → Test the key on one email** reads one demo email live and shows the company, the summary, the confidence and the token counts.

The key stays in this tab only. A failed call says why, in plain English. The app says a read costs "a fraction of a cent to a few cents depending on the model"; that has not been measured here.

### Also worth a click

- **Post an open pitch** (Market): not in the story. Pay a budget (simulated), then **Read as** any eligible company; **Close & refund** returns what is left.
- **Open booth** (any booth on the Market tab): anyone may then pitch that company at its price, matched or not. Rivals still may not.
- **Pay with credits**: after the story, Meridian has $1.88 of credits left. Listen to earn more, then propose a pitch with **Pay with: Credits**.
- **Matches → One-way**: companies that want someone who does not want them back, with the reverse score beside them.
- **SpamPay**: on any accepted offer, **Pay** opens the fake checkout. It is the only way to see it; the story pays directly.
