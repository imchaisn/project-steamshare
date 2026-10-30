# Shopee first-chat rule — why a paid order can go undelivered

**Status:** FIXED and live 2026-09-08 (commit `64d1666`).

> No real order ids in this file. This repo is public and `/api/lookup` resolves an
> order id **alone** to Steam credentials — the username stopped being a control on
> 2026-09-06. A real order id in a public file is a live key. Use `250101EXAMPLE1`.

## The rule

Shopee will not let a shop open a conversation with a bare text message:

```
first_chat_without_order_info — If 2 users have no existing conversation,
the message must contain order information between 2 users.
```

A buyer who purchases **without ever messaging the shop** therefore cannot be sent
the delivery text. Delivery succeeds if and only if a chat thread already exists.

## What it cost

A paid Batman: Arkham Knight order on 2026-09-08 was allocated, auto-shipped, and
never delivered. Six attempts (one per Shopee push retry), all rejected. The buyer
got nothing until it was sent by hand.

It had looked healthy for three days purely by luck: every earlier buyer happened to
have opened a chat first. Confirmed against the live conversation list — every order
that delivered was to a buyer with an existing conversation; the one that failed was
not.

**Nothing raised its hand.** The rejection existed only in `order_games.delivery_error`
and a Vercel log. `scripts/reconcile-shopee-orders.mjs` would have caught it, if run.

## The fix

`lib/shopee-chat-order-context.ts` (logic + tests) → used by `sendBuyerMessage()`.

1. Send the text. **Existing conversation → this is still the only call.**
2. Only on `first_chat_without_order_info`: send an order card to open the conversation.
3. Re-send the text.

Recovers **once**, never loops, never sends a card for any other failure. If the card
is refused too, both reasons are recorded and it stops — worst case is the old
behaviour, not a regression.

Multi-game orders are safe: delivery is sequential by design, so a four-game order to
a new buyer sends **one** card then three texts.

## The order-card shape — verified, not guessed

```jsonc
{ "to_id": <buyer_user_id>, "message_type": "order", "content": { "order_sn": "..." } }
```

Accepted live 2026-09-08 (`request_id e3e3e7f35af4e3d2d0543da5730c7200`). Shopee echoed
it back and **added `shop_id` itself — do not send it**.

A throwaway-recipient probe could **not** settle this: Shopee does not structurally
validate `message_type` (an unknown value falls through to the permission gate). Only
`content` must be an object. Confirming it needed one real send to a buyer inside the
contact window.

Both values stay env-overridable — `SHOPEE_SELLERCHAT_ORDER_MESSAGE_TYPE`,
`SHOPEE_SELLERCHAT_ORDER_SN_FIELD` — so a Shopee change is a config flip, not a deploy.

## Probing Shopee chat safely

Validation order, measured 2026-09-08: `to_id` present → `content` is an object →
permission/contact-window gate → everything else. So a **throwaway `to_id` (e.g. `1`)
cannot deliver anything** and is safe for shape probes — but it also masks everything
behind the permission gate, which is why the card needed a real recipient.

Local scripts need a fresh token: the access token lasts 4h and the refresh token is
**single-use and rotates**, so refresh must be written back or production is locked
out. Reuse the proven helper in `scripts/shopee-listings.mjs`.

## Still open

- **Not yet proven end to end.** The card format is confirmed and the recovery logic is
  unit-tested, but no real new-buyer order has run through the deployed path. Check
  `order_games` after the next one: `delivered_at` set, no first-chat error.
- **`lib/follow-up.ts:212` filters on `orders.delivered_at`, which nothing sets any
  more** — post-0014 only `order_games.delivered_at` is written. The nightly sweep will
  find **zero** orders the day `SHOPEE_FOLLOW_UP=true`. Inert today; deliberately not
  fixed here because another session was editing that code.
- **No retry job.** Once Shopee's push retries stop (~3h), a failed delivery is never
  retried. Reconciliation is the only net, and it is manual.
