# Steam Family View — Lockdown Guide for Shared Accounts

**Researched:** 2026-08-24 · **Scope:** protective account hardening for shared-Steam-account resale
**Status of this doc:** Family View is a **legacy feature being wound down**. Read the verdict before you spend time on it.

---

## TL;DR

| Question | Answer |
|---|---|
| Is Family View worth doing per account? | **No, not as a security control.** Optional 2-minute nice-to-have on accounts that still offer it. |
| Will new accounts even have it? | **Probably not.** Multiple 2026 reports: accounts created after the Steam Families rollout don't show the option. |
| Does it stop password/email/authenticator changes? | **No.** Valve never documented it as covering account credentials. |
| Does it stop purchases? | Partially (gates the Store) — but **an empty wallet + no saved card does this better and can't be bypassed**. |
| Can a buyer bypass it? | **Yes, in minutes.** A 4-digit PIN with a public local brute-force tool (`SPPRTool`). |
| Does PIN reset need your email? | Yes — *if* a recovery email is set. That part works. But it's irrelevant given the brute-force path. |
| Does it hurt the buyer experience? | Mildly, if misconfigured. Achievements/cloud saves/controller config are unaffected. |

**Do this instead:** see [§8 What actually protects the account](#8-what-actually-protects-the-account).

---

## 1. Name disambiguation — read this first

Three different Steam features get confused constantly. Only one is relevant here.

| Feature | What it does | Applies to | Relevant to us? |
|---|---|---|---|
| **Family View** (a.k.a. "Steam parental controls", the "Family PIN") | PIN-gates parts of **the account you are logged into**. Same account, same login. | One account, itself | **Yes — this is the one.** |
| **Family Sharing / Steam Families** | Lets **other Steam accounts** borrow your library. Each borrower has their own separate account. | Multiple separate accounts | **No** |
| **Steam Families parental controls** | An adult in a family group restricts a **child's separate account**. | A different account | **No** |

Why the other two don't fit our model: our buyers log into **the same account**. Steam Families requires each buyer to own a separate Steam account, be invited into a 6-member family group, pass Valve's undocumented "same household" check, and eat a **one-year cooldown** on the family slot if they leave. It also enforces one-borrower-at-a-time concurrency. It is structurally incompatible with reselling shared access.

> Anyone who later says "just use Steam Families for this" — point them at this section.

---

## 2. Current status (as of 2026-08)

This is where most guides online are wrong. They describe the pre-2024 feature as though nothing changed.

**What changed:** Valve announced Steam Families in March 2024 (beta) and shipped it broadly in September 2024. Valve's own announcement wording: *"This update replaces both Steam Family Sharing and Steam Family View."* The Family View support FAQ now opens with a banner: *"Update: Family View has been replaced by Steam Families' parental controls."*

**What that actually means in practice — three separate facts:**

| Fact | Evidence | Confidence |
|---|---|---|
| Family View still functions on accounts that already have it | Valve's own live support wizard (issue 804) still describes it in the present tense: *"With Family View, access to the Steam Store, Library, Community, and Friends content and features may be gated by the entry of an additional PIN."* | High |
| **Newly created accounts do not get the option** | Steam forum user `rawWwRrr`, twice (Apr 2026, Jun 2026): *"After creating a new alt, I see this option is not shown in the Settings > Family menu"* / *"Accounts created prior to the implementation of the new Steam Family feature seem to have it. Those created after don't."* | Medium-high (community, not Valve — **test it yourself**) |
| Joining a Steam Family destroys the PIN | Valve FAQ: existing Family View settings transfer to Steam Families parental controls, and *"The PIN will be removed, but the settings are otherwise untouched."* | High |

**Direct consequence for us:** the business creates brand-new accounts at 1-3/week. Those are exactly the accounts reported to lack Family View. **Assume it is unavailable until you verify otherwise on a real new account.**

---

## 3. How to enable it (current client)

Try in this order. If step A shows nothing, the feature is not available on that account — stop, don't burn time.

**A. Steam desktop client (primary path)**
1. Steam client → **Steam** menu (top-left) → **Settings**
2. Left panel → **Family**
3. Look for a **Family View** section → click **Manage**
4. Wizard: choose which content stays accessible while locked
5. Set a **4-digit PIN**
6. Set a **recovery email** — use the account's own mailbox, which we control. Do not skip this; it is the only self-service unlock path.
7. Confirm. The client drops into Family View (locked) mode.

**B. Web fallback**
`store.steampowered.com/parental/set/` — if the account doesn't have the feature this silently redirects to the store front page. That redirect *is* the "not available" signal.

**C. Legacy path (pre-Families clients; may no longer exist)**
Steam → Settings → **Account** → **Account Details** → scroll to **Family Settings**. Historically, Family View only appeared under Settings → Family *after* being enabled here once. Included for completeness; older guides cite this as the only path, which is now wrong.

**Operating it day to day**
- A **Family View icon** sits in the client's top-right. Red = locked, restrictions active.
- Click it → enter PIN → unlocked for that session.
- PIN reset request: `store.steampowered.com/parental/requestrecovery`

---

## 4. What it can and cannot restrict

Valve's documented scope is exactly four areas: **Store, Library, Community, Friends**. Note what is *absent* from that list.

| Target | Blocked? | Notes |
|---|---|---|
| **Steam Store browsing** | **Yes** | Gated in client *and* in the client's browser windows. |
| **Making purchases** | **Yes, indirectly** | Via the store gate. Not a separate "no purchasing" toggle. |
| **Library — which games launch** | **Yes** | Whitelist per game. Leave the one sold title enabled. |
| **Community (hubs, forums, workshop, UGC)** | **Yes** | Also blocks in-game Workshop browsers in some titles. |
| **Friends list, chat, groups** | **Yes** | |
| **Profile, achievements page, screenshots** | **Yes** (toggleable) | Blocking the *page* — earning achievements still works. |
| **Account Settings / Account Details** | **No — not in Valve's documented scope** | See §5. This is the whole problem. |
| **Changing the password** | **No** | Not covered. |
| **Changing the contact email** | **No** | Not covered. |
| **Removing / replacing Steam Guard** | **No** | Not covered. |
| **Trading** | **Partial / unreliable** | Historically gated via Community + Inventory. Trades separately require **mobile confirmations**, which are a stronger and independent control — see §8. |
| **Launching a game outside Steam** | **No** | Known long-standing hole: running the game's `.exe` directly from `steamapps/common/` bypasses the library whitelist. |

**Precision on the ones you asked about:** it genuinely blocks Store, Community, Friends, and library scope. It genuinely does **not** block password change, email change, or Steam Guard removal — those are account-credential operations Valve never placed inside Family View's scope, and no Valve documentation claims otherwise. Any blog claiming Family View "locks account settings" is repeating marketing copy, not tested behaviour.

---

## 5. Bypass and recovery — the part that kills it

### 5a. Legitimate PIN reset (needs our email — good)
Valve: *"If you have lost or forgotten your PIN and a recovery email address has been specified, you are able to request an email containing a link to disable Family View."* The link goes to the account's registered recovery email, which we control. If no recovery email is set, it becomes a Steam Support ticket requiring proof of ownership (purchase history, payment details) that a buyer cannot produce.

**So the sanctioned reset path is genuinely gated on our email.** That much works as intended.

### 5b. The unsanctioned path (needs nothing — fatal)
The PIN is **4 digits = 10,000 combinations**, and validation happens through a **local Steam client interface** (`IClientParentalSettings`), not a rate-limited server endpoint.

- Public tool: `github.com/Ne3tCode/SPPRTool` — "Steam Parental Pin Recovery Tool", explicitly described as recovering the PIN *"without the need to use email if it is not set or not available."* Tagged `bruteforce`.
- Steam forum, 2020: *"there is a little tool that bruteforces the 10000 combinations of the steam PIN in a few minutes."*
- Steam forum, Apr 2026: *"Family PIN IS NOT A SECURITY FEATURE… Family PIN decoding is literally part of the SaaS product scammers use. There's like a dozen GitHub repos that have tools to unlock your steam Family PIN."*

A buyer who is already logged into the account on their own PC has everything the tool needs. **This is a speed bump measured in minutes, not protection.**

### 5c. The bigger hole — buyers hold a working second factor
This is specific to our model and it dwarfs the PIN question.

Buyers receive live Steam Guard TOTP codes from our own service. Steam verifies sensitive account changes with the mobile authenticator when one is active (community-reported: *"in order to change the password I had to verify via the mobile authenticator"*). A buyer therefore holds **password + a valid second factor**. Family View, present or absent, does not sit in front of that.

Our real backstop is **control of the account's email mailbox**, which drives:
- Notification on password/email/Guard changes → detection
- Steam's account recovery flow → we take the account back

Family View adds nothing to that backstop.

---

## 6. Buyer experience impact

| Area | Impact |
|---|---|
| **Launching / playing the sold game** | None, if that title is whitelisted in the wizard. Misconfigure it and the buyer can't launch — a support ticket you created for yourself. |
| **Cloud saves** | None. Unaffected. |
| **Achievements** | Still earned normally. Only the *profile/achievements page* is hidden if you toggle that off. |
| **Controller config** | No reported interference. (Not directly documented — see gaps.) |
| **Multiplayer / invites** | Degraded if Friends is locked: no friends list, no chat, no friend invites. For a co-op or social title this is a real complaint generator. |
| **In-game Workshop / mods** | Broken when Community content is blocked. Documented complaint. Matters for any modded title. |
| **General friction** | PIN prompt on every client launch. Buyers will ask what it is. |

---

## 7. Verdict — is it worth doing per account?

**No. Do not build it into the per-account setup runbook as a security measure.**

Reasoning, weighted for a business scaling from 1 to 20-50 accounts:

| Factor | Assessment |
|---|---|
| **Availability** | Likely **zero** on the new accounts we create. A step that silently doesn't exist on most of the fleet is worse than no step — it creates false confidence. |
| **Security value** | ~Zero against a motivated buyer. 4-digit PIN, public brute-forcer, local validation. It does not cover the three things you actually care about (password, email, Steam Guard). |
| **Value against the actual threat** | Our threat isn't a curious child; it's a buyer with credentials and a working 2FA code who wants the account. Family View was never designed for that adversary. |
| **Setup cost** | ~2-4 min/account *if available* — plus a permanent misconfiguration risk (locked-out buyer = refund + Shopee rating damage). |
| **Support cost** | Recurring "what's this PIN" messages, broken Workshop, missing friends list. **The support cost likely exceeds the protective value.** |

**Where it's marginally defensible:** on a legacy account that already offers it, ticking *Store* only — as a clumsy-accident guard, never as an anti-takeover control. Even then, an empty wallet with no saved card does the same job, can't be brute-forced, and costs nothing to maintain.

**Net:** cross Family View off the hardening checklist. Reallocate the effort to §8.

---

## 8. What actually protects the account

Ranked by protection-per-minute. These are what the runbook should contain instead.

| # | Control | Why it beats Family View |
|---|---|---|
| 1 | **Never save a payment method. Keep wallet balance at zero.** | Removes the purchase risk absolutely. No PIN to crack. Zero support friction. Strictly dominates Family View's store gate. |
| 2 | **Own the mailbox. Unique strong password per account. Never reuse across the fleet.** | Email control is the root of trust: it drives change notifications *and* Steam's recovery flow. One compromised account can't cascade. |
| 3 | **Withhold `identity_secret`; serve only `shared_secret`.** | The `.maFile` holds both. `shared_secret` generates the login TOTP (what buyers need). `identity_secret` signs **trade and market confirmations**. Serve only the former and buyers can log in but **cannot confirm any trade or market listing** — a hard cryptographic block on inventory theft, far stronger than any Family View toggle. **Verify the service never exposes `identity_secret`.** |
| 4 | **Keep nothing of value on the account.** | One game, no inventory, no wallet, no linked payment. Caps the blast radius of a takeover at the cost of one game key. |
| 5 | **Register the phone number to us, or leave it unset.** | Authenticator transfer can be done via SMS to the registered number. Don't hand buyers that path. |
| 6 | **Monitor the mailbox for Steam security emails.** | Password / email / Guard-removal notices are the tripwire. Detection beats prevention here — recovery via email is fast if you catch it. |
| 7 | **Have a written takeover-recovery runbook.** | Expect it to happen at 20-50 accounts. Know the recovery steps before you need them, not during. |

**Note:** removing the authenticator imposes a 15-day trade/Market hold and emails the account address — so a hostile buyer's takeover is both slow and loud. Use that window.

---

## 9. Known gaps / unknowns

Things this research could **not** verify. Test before relying on any of them.

| # | Unknown | How to resolve |
|---|---|---|
| 1 | **Whether a brand-new account gets Family View at all.** The strongest evidence is two community posts by one user (Apr + Jun 2026). Valve has published nothing definitive. | **Highest priority test.** On the next new account, check Settings → Family. One minute, settles §2. |
| 2 | **Whether Family View gates Account Settings / Account Details.** Absent from Valve's documented scope, and no source confirms it either way. This doc says "not blocked" from absence of evidence, not from a positive test. | Enable Family View on a test account, lock it, try to open Account Details and start a password change. |
| 3 | **Whether a password/email change with an active authenticator needs a typed TOTP code or an in-app mobile confirmation.** Decisive: TOTP = buyers can do it (they have codes); mobile confirmation = they cannot (needs `identity_secret`, which we withhold). | Test on a throwaway account. **This is worth more than everything else in this doc** — it determines whether withholding `identity_secret` also blocks credential changes. |
| 4 | Whether Family View applies to a session in an **external browser** (Chrome/Firefox), or only inside the Steam client. One report confirms the PIN prompt appears in *client* browser windows. | Log into `store.steampowered.com` in a normal browser on a Family-View-locked account. |
| 5 | **Controller configuration** under Family View. No documentation found either way; assumed unaffected. | Low stakes; verify only if a buyer complains. |
| 6 | Whether the `SPPRTool` brute-force still works against the current client. Repo is old (2 commits). | Not worth testing — the design flaw (4 digits, local validation) is unchanged, so treat the PIN as weak regardless. |
| 7 | Exact current wizard wording and toggle list. Valve's FAQ bodies are **login-gated** and could not be read directly; the restriction list here is assembled from Valve's live support-wizard text plus community reports. | Screenshot the wizard during test #1 and paste the real toggle list in here. |

**Explicitly out of scope:** foreign-currency / VPN / regional-pricing game purchasing. Ruled out separately as prohibited and thin-margin. Not covered here.

---

## 10. Sources

Valve (primary):
- Family View support wizard (live, present-tense description): `help.steampowered.com/en/wizard/HelpWithSteamIssue/?issueid=804`
- Family View FAQ (replacement banner; body login-gated): `help.steampowered.com/en/faqs/view/6B1A-66BE-E911-3D98`
- Steam Families User Guide & FAQ (PIN removal on migration, 6-member limit, 1-year slot cooldown; body login-gated): `help.steampowered.com/en/faqs/view/054C-3167-DD7F-49D4`
- Steam Families launch announcement, 2024-09-11: `steamcommunity.com/games/593110/announcements/detail/4605582245626919824`
- Changing the contact email: `help.steampowered.com/en/faqs/view/6FD5-F2C7-B4B9-1713`
- Steam Guard Mobile Authenticator (15-day hold, SMS transfer): `help.steampowered.com/en/faqs/view/7EFD-3CAE-64D3-1C31`

Community / technical:
- "Bring Back PIN-Based Restrictions (Family View) for Main Accounts", Apr 2026 — legacy-only reports, PIN-is-not-security: `steamcommunity.com/discussions/forum/10/797842245107604713/`
- "How can i set a family account pin?", Mar 2025 - Jun 2026 — `/parental/set/` redirect, legacy-only: `steamcommunity.com/discussions/forum/1/601897883113958988/`
- "What good is PIN parental control if it can be easily bruteforced?", 2020: `steamcommunity.com/discussions/forum/0/2577696996229992653/`
- `SPPRTool` — Steam Parental Pin Recovery Tool: `github.com/Ne3tCode/SPPRTool`
- "Kids bypass Steam View" — direct `.exe` launch bypass: `steamcommunity.com/groups/familyview/discussions/1/154645539342947768/`
- Workshop blocked under Community restriction: `reddit.com/r/ScrapMechanic/comments/9q53p2/`
- `shared_secret` vs `identity_secret` roles: `gist.github.com/mathielo/8367e464baa73941a075bae4dd5eed90`

**No credentials, account names, PINs, secrets, or `.maFile` contents belong in this repo. This repo is public.**
