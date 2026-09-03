# Order Fulfillment SOP (Local-Verification Mode)

Steamshare doesn't have live Shopee API integration yet (`lib/shopee.ts` is in local-verification mode — see README "Known Risks #4"). Every sale needs a manual link before the buyer's first lookup will work. This is that procedure.

## Per-sale checklist

1. **Check Shopee Seller Center → Orders** for new paid orders on a Steamshare listing.
2. **Note the Order ID and Buyer ID** from the order details.
3. **Confirm inventory exists** for the game sold:
   - `/admin` → Steam Accounts: is there an account with that game already linked (Games section + the account/game link)?
   - If not, onboard the account first (Add Account form — encrypts password + Guard secret automatically) and link it to the game.
4. **Create the order link**: `/admin` → Orders tab → enter Shopee Order ID + Buyer ID, select the linked account/game, leave "verified" checked, submit.
5. **Buyer can now look up their code** at the public lookup page using the same Order ID + Buyer ID they used at checkout.

## Test order IDs — naming convention (standing rule, 2026-08-26)

Every account gets a **test order** seeded alongside it, so the account can be verified end-to-end
against production before it is ever sold. The order id is derived from the username so it is
guessable-by-us and never collides:

> **First 3 letters of the username + `123`.**

Letters only — skip digits, underscores and other punctuation when counting the three.

| Username | Test order id |
|---|---|
| `gscal1` | `gsc123` |
| `dubust22` | `dub123` |
| `ss_schedule11` | `sss123` (underscore skipped) |
| `ssp266` | `ssp123` |
| `ghjjK458` | `ghj123` |
| `Fishy790` | `fis123` |

Seed these with `scripts/seed-fleet.mjs`, which reads the local (never-committed) fleet file and
takes the Guard `shared_secret` from the SDA `.maFile`. It is idempotent — safe to re-run.

**Verification after seeding** — a build check is not enough, do all three against production:
1. Lookup returns a code for each test order id + its username.
2. The returned password matches the tracker (proves the encrypt/decrypt round-trip and that the
   right `ACCOUNTS_ENCRYPTION_KEY` was used — this has silently broken before).
3. Two lookups ~35s apart return **different** codes (proves live TOTP, not a cached value).

> **One order id must map to exactly one row.** `verifyShopeeOrder()` queries on `shopee_order_id`
> alone with `.maybeSingle()`, which **errors** when two rows share an order id — so a duplicate
> makes the lookup 404 for *everyone* on that id, not just the newer buyer. This actually happened on
> 2026-08-26 (`ssp123` existed twice with different `shopee_buyer_id`s; the older row was renamed to
> `ssp123-legacy` to resolve it). The table's unique constraint is on
> `(shopee_order_id, shopee_buyer_id)`, which does **not** prevent this. See the known-gaps section.

## When something goes wrong

| Symptom | Check |
|---|---|
| Buyer says lookup fails | `/admin` → Orders tab — does the order exist, is it marked verified, is it linked to the right account/game? |
| Buyer says login/code doesn't work | `/admin` → Steam Accounts — is that account's status still `active`? If banned/recovering, the lookup API already returns "temporarily unavailable, contact support" instead of a code |
| Suspicious repeat lookups on one order | `/admin` → Code Access Log — filter by order, check IP/frequency |
| Account gets banned | Mark it `recovering` or `banned` in the Steam Accounts status dropdown immediately so buyers get the "unavailable" message instead of a dead code. There's currently no automated buyer notification — that's a manual message you'd need to send (via Shopee chat) to affected buyers until this is automated |

## Not yet handled (known gaps)

- No live Shopee order verification — this whole doc exists *because* of that gap. Closing it (Shopee Open API integration) removes step 2-4 entirely.
- No rate-limiting on the lookup endpoint.
- No automated ban detection — you find out when a buyer complains or you happen to check.
