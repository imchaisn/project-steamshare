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
