# Zoho mailbox provisioning — parked, not built

**Status: PARKED 2026-09-05.** Research done, setup script written and unrun. Nothing depends on
this. Pick it up only if the Cloudflare catch-all below stops being good enough.

## Read this before doing anything

`CHECKPOINT.md` → "Email at scale — **solved**" already chose a different answer: **Cloudflare Email
Routing catch-all** on a custom domain, ~RM60/yr, unlimited addresses at zero marginal cost, zero
phone numbers consumed. That decision stands. This document is the alternative, not a replacement.

**Do not start this work just because the script is sitting in `scripts/`.**

### What Zoho buys that Cloudflare doesn't

| | Cloudflare Email Routing | Zoho Mail |
|---|---|---|
| Cost per address | free | ~$1/user/mo (Mail Lite); free plan caps at 5 users |
| Receives mail | yes | yes |
| **Sends** mail | no — forwarding only | yes |
| Real mailbox you can log into | no | yes |
| Blast radius of one compromise | **every account** — all mail lands in one destination inbox | one mailbox |
| Provisioning | catch-all, no per-address setup at all | API call per mailbox |

The only genuinely load-bearing row is the fourth. `CHECKPOINT.md` flags the shared destination inbox
as "the single point of failure for every account's password reset" — that is the weakness Zoho
fixes, and it is the one reason to revisit this.

**The trigger to un-park this:** the destination inbox becomes an unacceptable single point of
failure — because the fleet got big enough, or because it actually got compromised once.

Receiving Steam recovery mail is all the business needs today, and Cloudflare does that for free.
Sending and per-mailbox login are conveniences we are not currently short of.

## Known unknown that must be resolved first

**Does the Zoho org-accounts admin API work on your plan?** Zoho gates some admin surfaces by
edition and the docs do not state the requirement. The Forever Free plan also has **no IMAP/POP**,
so on free you could create mailboxes but not programmatically read the Steam verification mail
out of them — which would defeat most of the point.

Resolve it cheaply: after auth works, make a read-only `GET .../accounts` call. If that 403s, the
plan does not permit this and the rest is moot. **Do not build the provisioning script before that
call succeeds.**

## Setup, if we do proceed

Verified against Zoho's docs 2026-09-05. `scripts/zoho-auth.mjs` automates step 4.

### 1. Identify the data center

The domain you log into Zoho Mail with decides every hostname. A mismatch returns `invalid_client`,
which reads as a bad secret and sends you looking in the wrong place.

| Zoho domain | API base | Accounts server | API console |
|---|---|---|---|
| zoho.com | `mail.zoho.com` | `accounts.zoho.com` | `api-console.zoho.com` |
| zoho.eu | `mail.zoho.eu` | `accounts.zoho.eu` | `api-console.zoho.eu` |
| zoho.in | `mail.zoho.in` | `accounts.zoho.in` | `api-console.zoho.in` |
| zoho.com.au | `mail.zoho.com.au` | `accounts.zoho.com.au` | `api-console.zoho.com.au` |

Also valid: `jp`, `ca` (`zohocloud.ca`), `sa`.

### 2. Create a Self Client

API console → **GET STARTED** → hover **Self Client** → **CREATE NOW** → **CREATE** → **OK**.
Client ID and secret appear under the **Client Secret** tab.

### 3. Generate a grant code

**Generate Code** tab. Scopes, comma-separated, no spaces:

```
ZohoMail.organization.accounts.ALL,ZohoMail.organization.READ,ZohoMail.accounts.READ
```

Set duration to **10 minutes**, not the 3-minute default. Add `ZohoMail.messages.READ` as well if
reading verification mail via the REST API is wanted — widening scope later means redoing steps 3-4.

### 4. Exchange the code for a refresh token

Put these in `.env.local` (gitignored), then run the script — the grant code expires in minutes, so
fill in everything else *first* and generate the code last:

```
ZOHO_DC=com
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_GRANT_CODE=
ZOHO_REFRESH_TOKEN=
```

```
node --env-file=.env.local scripts/zoho-auth.mjs
```

It writes `ZOHO_REFRESH_TOKEN` back into the file and blanks the spent grant code. Refresh tokens do
not expire unless revoked; access tokens last 1 hour and are minted from the refresh token per run.

**The script's guard clauses are tested. The exchange path itself has never run** — it was written
and parked before anyone had credentials. Expect to debug it on first use.

### 5. The API surface, once authenticated

```
POST https://mail.zoho.com/api/organization/{zoid}/accounts
Authorization: Zoho-oauthtoken {access_token}

{ "primaryEmailAddress": "...", "password": "...", "role": "member" }
```

`zoid` comes from the Get Organization Details endpoint. Required body fields are
`primaryEmailAddress` and `password`; `firstName`, `lastName`, `displayName`, `role`, `userExpiry`
and `oneTimePassword` are optional. Returns 201 with the new user object.

A provisioning wrapper (`scripts/zoho-mail.mjs` — create/list/update/delete, writing
`recovery_email` and `recovery_email_password_enc` into `steam_accounts` using the crypto in
`app/api/admin/accounts/route.ts`) was scoped but **not written**.

## What this does not change

Mailbox supply was never the bottleneck. `CHECKPOINT.md` → "Hard ceilings on account creation" puts
the real limits at Steam fraud detection (1-3 accounts/week), the MCMC prepaid SIM cap, and 30-45
minutes of manual setup per account. **Scripted Steam account creation stays explicitly rejected**
— it is what fraud detection is built to catch, and it fails as a linked ban wave across the fleet.
Steam registration also gates on CAPTCHA, and Valve's SSA prohibits automated account creation.

Cheaper email does not move any of those numbers.

## Sources

- [Add user to organization](https://www.zoho.com/mail/help/api/post-add-user-to-org.html)
- [Self Client authorization code flow](https://www.zoho.com/accounts/protocol/oauth/self-client/authorization-code-flow.html)
- [Mail API getting started — data centers](https://www.zoho.com/mail/help/api/getting-started-with-api.html)
