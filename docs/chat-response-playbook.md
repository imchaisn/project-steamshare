# Chat response playbook — protecting the Shopee CRR

**Owner:** Chaison (sole operator) · **Written:** 2026-09-08 · **Updated:** 2026-09-13
**Problem:** one human cannot watch Shopee chat around the clock, and Chat Response Rate (CRR)
feeds shop standing and Preferred Seller eligibility.

> **2026-09-13 — the automated responder now exists, in two modes.** `lib/chat-sweep.ts` +
> `app/api/cron/chat-sweep/route.ts` + `.github/workflows/chat-sweep.yml` answer threads where the
> buyer spoke last. Default mode sends the fixed templates below. With `ANTHROPIC_API_KEY` +
> `SHOPEE_CHAT_AI=true`, `lib/chat-ai.ts` has Claude write the reply instead, gated by a
> deterministic `validateReply()` (claim rules + credential + off-platform + length), with refunds
> and complaints always getting a fixed acknowledgement plus a human — never generated text. Both
> modes append a **⭐⭐⭐⭐⭐ rating ask** to a helpful reply to a buyer with a delivered order (Chaison's
> ask, 2026-09-13), de-duped against the receipt nudge / 24h follow-up by scanning the thread for an
> existing ⭐ ask. The §5 open question below is UNCHANGED — whether an API send counts toward CRR is
> still unproven; the build is measured, not believed. Preview drafts with the Actions workflow's
> dryRun✔ + ai✔ before switching `SHOPEE_CHAT_AI` on. **BUILT, NOT DEPLOYED, uncommitted; no live
> send has happened.**

**Read `research/2026-09-08-shopee-chat-response-rate.md` before trusting any number here.**
Every CRR figure below is `UNSOURCED — MUST VERIFY`: Shopee's Seller Education pages are
client-rendered and return an empty shell to any fetch, so none of them could be read. The
figures are convergent across three independent seller-tool vendors, which is suggestive, not
proof. The feature limits in §1 are different — those come from a real Shopee PDF and are
`FACT-S`.

---

## 0. The one thing to understand first

> **An automated reply probably does NOT count toward CRR. Only a manual send does** — a typed
> message, a **Shortcut Message**, or a sticker.

`UNSOURCED — MUST VERIFY`, but it is the most consistent claim in the research and it has one
narrow first-party corroboration (Shopee's own `[MY] Web Chat Broadcast User Guide` states a
shop-side Auto-Reply triggered by a broadcast does not affect either party's CRR).

**If it is true, the Auto-Reply already switched on is doing nothing for the metric.** It keeps
buyers from meeting silence, which is worth having, but it does not move the number.

Two consequences drive this whole playbook:

1. **Deflect first.** A question never asked cannot be answered late. Deflection shrinks the
   denominator and is the only lever that works no matter how CRR is calculated.
2. **A Shortcut Message is the cheapest thing that counts.** It is a *manual* send, so it
   counts, but it costs two taps. §2 is therefore the highest-value section in this file.

**Settle the question before building anything expensive** — see §5.

---

## 1. Native Shopee features, with their real limits

`FACT-S`, from the official `[MY] Chat Settings` and `FAQ Assistant` guides (URLs in the
research file).

| Feature | Where | Limit | Counts toward CRR? |
|---|---|---|---|
| **Auto Reply** | My Settings → Chat Settings → Auto Reply | **500 characters** | **Probably not** |
| **FAQ Assistant** | My Settings → FAQ Assistant | **3 categories × 3 sub-questions**; needs ≥1 FAQ before it can be switched on | **Probably not** |
| **Shortcut Messages** | Chat window, seller side | **20 per shop** | **YES — manual send** |

The FAQ Assistant is worth switching on despite not counting: it answers the buyer *without a
thread ever needing a human*, which is deflection, not response.

---

## 2. Shortcut Messages — build all 20 (highest value, do this first)

These count toward CRR and take two taps. Aim to answer the common cases without typing.

Claim rules enforced throughout (see `.claude/skills/ss-market/SKILL.md` §1): **no online /
multiplayer claims** (buyers play in Steam Offline Mode), **no "instant"** — say 24-hour,
**no lifetime or refund guarantee**, and **nothing offered in exchange for a review**.
A `gameshare.space` URL is fine *in chat* — the URL ban applies only to listing descriptions
and images.

### Where's my code / how do I use this

**S1 — Delivered, buyer can't find it**

```
Hi! Your account details are already in this chat — please scroll up for the
[Auto Delivery] message.

Password + Steam Guard code: https://www.gameshare.space
Enter your Shopee Order ID only (nothing else needed).

Full guide: https://www.gameshare.space/tutorial
```

**S2 — "It says wrong password" / login fails**

```
Two things fix almost every login issue:

1) Use the password from https://www.gameshare.space (enter your Order ID) —
   copy it, don't retype it.
2) The Steam Guard code changes every 30 seconds. Get a fresh one and enter it
   straight away.

Still stuck? Send me a screenshot of the error and I'll sort it out.
```

**S3 — The two steps buyers skip (the real cause of most trouble)**

```
Please make sure of these EVERY time you play:

- Step 4 — turn Steam Cloud OFF
- Step 6 — go into Offline Mode

Guide with pictures: https://www.gameshare.space/tutorial

Langkah 4 (Steam Cloud OFF) + Langkah 6 (Offline Mode) — setiap kali main ya.
```

**S4 — "Someone kicked me out of the game"**

```
Sorry about that! That happens when the account is used online instead of in
Offline Mode.

Please follow Step 6 (Go Offline):
https://www.gameshare.space/tutorial#step-6

If it keeps happening, tell me your Order ID and I'll move you to another
account.
```

### Pre-purchase

**S5 — "Do you have &lt;game&gt;?"**

```
Hi! Tell me which game you're after and I'll confirm whether we have it in
stock and the price.

You can also see everything we sell on our Shopee shop page - just tap our
shop name above.
```

> ⚠️ **Do not use a `/games` link here yet** — it 307-redirects to the admin login page
> (`FACT-V` 2026-09-08). Once §7's deploy lands and the URL returns 200, swap the second
> paragraph for `Everything in stock: https://www.gameshare.space/games`, which is a much
> stronger answer.

**S6 — "Is it original / legit?"**

```
Yes — these are real Steam accounts with the game fully owned on them, not
cracked copies. You install through Steam as normal.

You play in Steam Offline Mode (single-player). Delivery is automatic, within
24 hours of payment, straight into this chat.
```

**S7 — "Can I play online / with friends?"**

```
This is for single-player in Steam Offline Mode, so online multiplayer isn't
available on these accounts.

Everything you need to know before buying:
https://www.gameshare.space/tutorial
```

**S8 — "How does it work?"**

```
Simple:
1) You order here on Shopee
2) Within 24 hours we send the Steam account details into this chat
   automatically
3) Password + Steam Guard code at https://www.gameshare.space — enter your
   Shopee Order ID
4) Install via Steam, then play in Offline Mode

Guide: https://www.gameshare.space/tutorial
```

**S9 — Holding reply (use when you need time; still a manual send)**

```
Hi! Got your message. Looking into it now and I'll come back to you shortly.

Meanwhile, if it's about getting your code:
https://www.gameshare.space — enter your Shopee Order ID.
```

> **S9 is the CRR workhorse.** Fired at any thread you cannot properly answer yet, it is a
> manual send inside the window, and it buys time without misleading anyone.

---

## 3. Auto Reply — replacement copy (**436 characters**, limit 500)

Keeps buyers moving while you are asleep. Assume it does **not** count toward CRR; it exists to
deflect, not to score.

```
Hi! Thanks for messaging GameShare.

ALREADY ORDERED? Your details are in this chat - scroll up for the [Auto Delivery] message. Password + Steam Guard code: https://www.gameshare.space (enter your Shopee Order ID only). Guide: https://www.gameshare.space/tutorial

NOT ORDERED YET? Just send the game name and we'll confirm availability and price.

Delivery is automatic within 24 hours. We'll reply personally as soon as we're online.
```

> ⚠️ **The stock-list link is deliberately absent.** `https://www.gameshare.space/games`
> currently **307-redirects to the admin login page** (`FACT-V` 2026-09-08) — a buyer clicking
> it lands on a staff login form, which is worse than a dead link. Add the line back only after
> §7's deploy is done and the URL returns 200.

Re-count with `node -p "s.length"` after any edit — 500 is a hard cap and Shopee truncates
silently.

---

## 4. FAQ Assistant — 3 categories × 3 questions (exactly at the cap)

Deflects without a human.

**Category 1 — Getting my game**
- Where are my account details? → S1
- How long does delivery take? → *Automatic, within 24 hours of payment, into this chat.*
- What do I enter on the website? → *Your Shopee Order ID only.*

**Category 2 — Problems**
- Wrong password / can't log in → S2
- I got kicked out of the game → S4
- Steam Guard code not working → *Codes change every 30 seconds — take a fresh one and enter
  it immediately.*

**Category 3 — Before you buy**
- What games do you have? → S5
- Is it original? → S6
- Can I play online? → S7

---

## 5. Settle the open question before building anything expensive

The whole design hinges on whether an **Open Platform `send_message` API call** counts as a
manual send. Shopee excludes its *own* Auto-Reply because Shopee generated it and knows it is
automated; a message sent through the API carries no such flag, and the API is the same channel
seller CRM tools use. **Nobody outside Shopee can know this from documentation.**

It is cheap to settle:

1. **Seller Centre → Business Insights → Chat** — read the current CRR and note the date. This
   is the baseline, and it is `FACT-C`: only Chaison can see it.
2. Run §2 and §3 for a week.
3. Read CRR again.

- **Rate improves** → manual/shortcut sends are working. Build the automated responder (the API
  surface is proven — `research/2026-09-08-shopee-chat-api-probe.md`) and use the same
  measurement to test whether API sends count.
- **Rate flat** → automation cannot save it. The lever is escalation: get alerted fast and send
  a real reply. See §6.

---

## 6. Escalation — the part that works regardless

Whatever CRR counts, a reply inside the window from a human always counts. So the durable
defence is *knowing early*, not *answering automatically*.

- The reply window is ~12 hours (`UNSOURCED — MUST VERIFY`). Treat **6 hours** as the internal
  deadline so there is margin.
- `get_conversation_list` exposes everything needed to find threads awaiting a reply without
  opening the app: the buyer spoke last exactly when
  `latest_message_from_id === to_id`, and `last_message_timestamp` is in **nanoseconds**. Both
  conventions are `FACT-V` — see the probe file. Do **not** compare against `shop_id`; the
  shop's chat user id is a different number, and that mistake marks every thread as unanswered,
  including ones our own delivery bot spoke in last.
- A scheduled sweep can therefore alert on any thread approaching the deadline. It cannot run
  on Vercel cron: the team plan is **`hobby`** (`FACT-V` 2026-09-08), which caps cron at once
  per day. Use GitHub Actions against the `x-api-secret` auth that
  `app/api/cron/follow-up/route.ts` already accepts.

---

## 7. Reduce the denominator — chats that should never happen

- **The delivery message told every buyer to enter "Order ID + Username".** There has been no
  username field since 2026-09-06. Fixed in the working tree, **not yet committed or
  deployed** — so production is still sending buyers to hunt for a field that does not exist,
  on every order. This is the single largest self-inflicted source of "where's my code?" chats.
- **`/games` is written but untracked**, so S5's stock link 404s until it ships. Publish it
  before putting S5 into rotation, or replace that link with a plain list of titles.
