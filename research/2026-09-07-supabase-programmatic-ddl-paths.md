# Can we run DDL against Supabase Postgres with only what we hold?

Project: gameshare.space / Steamshare. Project ref `vwefthulbxqarttytvpl`. Question: is there
ANY programmatic path to run `CREATE TABLE` (specifically `supabase/migrations/0014_order_games.sql`)
using only NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, the (stale) DB_PASSWORD,
VERCEL_TOKEN, API_SECRET — no Supabase PAT, no browser.

Date of all live tests: 2026-09-07.

## Verdict

**NO.** Every programmatic route to DDL on hosted Supabase — direct Postgres connection, the
Management API, PostgREST, pg_graphql, and the Supabase CLI — terminates at one of two gates:
a Postgres password (which we hold but is confirmed stale, 28P01) or a Supabase personal access
token (which we do not hold, and which Supabase's own product design makes impossible to mint
without an authenticated browser session — a PAT is created from the dashboard, and the
Management API/CLI that would let you mint one programmatically requires... a PAT). The
service_role key is a PostgREST/project-scoped JWT; it was tested live against two Management
API endpoints and rejected outright (HTTP 401) — it carries zero Management API or DDL
authority. There is no service_role-only, no-PAT, no-working-password path to DDL.

**Shortest human action: reset the DB password in the Supabase dashboard** (not paste-into-SQL-editor,
not create-a-PAT). Reasoning in section 5.

## 1. Management API

`api.supabase.com` is a real, live API (not a 404 wall) and it does expose SQL execution:

- `POST /v1/projects/{ref}/database/query` — "[Beta] Run sql query" — **FACT-V**, confirmed to
  exist by fetching the live OpenAPI spec:
  `curl -s https://api.supabase.com/api/v1-json` → parsed `paths`, run 2026-09-07. The route is
  present (`operationId: v1-run-a-query`), takes an arbitrary `query` string, and its `security`
  block is `[{"bearer": []}]` — the **only** securityScheme defined anywhere in the spec's
  `components.securitySchemes` is `bearer` (`type: http, bearerFormat: JWT`) plus `oauth2`.
  There is **no** `apiKey`/service_role scheme defined for the Management API at all.
- `POST /v1/projects/{ref}/database/query/read-only` also exists, same `bearer`-only security.
- `PATCH /v1/projects/{ref}/database/password` — "Updates the database password" — also exists,
  also `bearer`-only security. (Relevant to section 4/5.)

**Auth requirement — FACT-V, live probe, 2026-09-07:**
```
curl -s -o /dev/null -w "%{http_code}" https://api.supabase.com/v1/projects   → 401 {"message":"Unauthorized"}
curl ... -H "Authorization: Bearer sbp_000...(fake)"                          → 401 {"message":"Unauthorized"}
curl ... -H "Authorization: Bearer <our real SUPABASE_SERVICE_ROLE_KEY>"     → 401 (on /v1/projects)
curl .../database/query/read-only -H "Authorization: Bearer <service_role>" → 401
```
The service_role key was tried directly against the Management API (read-only endpoints only,
no write attempted, value never printed — only the HTTP status was captured) and was rejected
identically to a malformed token. **This settles objective 1 and half of objective 3 by direct
test, not inference: the Management API does not accept a service_role JWT under any endpoint
tried, and a PAT is mandatory.**

Docs confirmation — **FACT-S**, `https://supabase.com/docs/reference/api/introduction` (fetched
2026-09-07): "PATs are tokens with a custom expiry that you manually generate to access the
Management API" and "All API requests require an access token to be included in the
Authorization header: `Authorization Bearer <access_token>`." No mention of service_role as a
valid credential anywhere on that page.

**Answer to "is there a `POST /v1/projects/{ref}/database/query` endpoint": YES, it exists.
"Will a service_role JWT ever be accepted": NO, tested live, rejected.**

## 2. Supabase CLI without login

CLI version installed: `2.105.0` — **FACT-V** (`npx supabase --version`, 2026-09-07).

Ran `npx supabase --help`, `npx supabase db push --help`, `npx supabase link --help`,
`npx supabase login --help`, `npx supabase migration --help` — all **FACT-V**, full output
captured 2026-09-07. Key facts from the real output:

- `supabase db push` flags: `--db-url string`, `--linked`, `--local`, `--password/-p string`.
  No login is invoked by the `--db-url` path in code — confirmed live:
  ```
  npx supabase db push --db-url "postgresql://postgres:fakepassword@localhost:5432/postgres" --yes
  → "Connecting to remote database..." → dial tcp 127.0.0.1:5432: connection refused
  ```
  The CLI went straight to a raw Postgres connection attempt with **no** access-token check and
  **no** login prompt. This proves `db push --db-url` (or `--password`) needs **only a working
  Postgres connection string** — not a PAT.
- `supabase projects list` (any command that hits the Management API, e.g. `link`, `projects`,
  most non-`db`/non-`migration` subcommands) — **FACT-V**:
  ```
  npx supabase projects list
  → "Access token not provided. Supply an access token by running `supabase login` or setting
     the SUPABASE_ACCESS_TOKEN environment variable."
  ```
  This confirms `SUPABASE_ACCESS_TOKEN` (a PAT) is accepted non-interactively as an env var —
  login itself isn't strictly required if you already hold a token — but we hold none.
- `supabase migration list --help` mirrors `db push`: `--db-url`, `--linked`, `--password`.

**Conclusion for objective 2:** the CLI has two independent, non-overlapping credential paths:
(a) `--db-url`/`--password` → needs a **working DB password only**, no PAT, no login; or
(b) anything that talks to the Management API (`link`, `projects`, `--linked` variants) → needs
a **PAT via `SUPABASE_ACCESS_TOKEN`**, no interactive login required if the token is already in
hand. We have neither a working password nor a PAT, so both CLI paths are currently closed —
but path (a) is the cheaper one to reopen (see section 5).

## 3. Does service_role grant DDL?

**NO — by both direct test and design.** service_role is a **PostgREST JWT claim**, not
Management-API credential and not, on its own, a passworded Postgres login you can open a raw
connection with:

- Direct-test result (section 1): rejected by the Management API on every endpoint tried
  (`/v1/projects`, `/v1/projects/{ref}/database/query/read-only`) — **FACT-V**.
- PostgREST: brief's own "already ruled out" list shows `/rest/v1/rpc/{exec,exec_sql,...}` all
  404 — no exposed SQL-execution RPC exists to call even with a valid service_role bearer.
  PostgREST by design only ever executes SQL that is *already defined* as a table/view/function
  in the exposed schema; service_role's power is "bypass RLS on what's exposed," not "run
  arbitrary SQL." Without a pre-existing `SECURITY DEFINER` function that does dynamic DDL
  (none exists here — that's exactly the gap `0014_order_games.sql` would close), PostgREST
  cannot be made to emit `CREATE TABLE`.
- pg_graphql: **FACT-S**, `https://supabase.com/docs/guides/database/extensions/pg_graphql`
  (fetched 2026-09-07) — "The extension reflects a GraphQL schema from the existing SQL
  schema." It is a CRUD reflector over what already exists; it has no mutation type for
  altering schema. No DDL surface.
- pg_meta (Studio's internal schema-editor API): not publicly reachable on hosted Supabase
  outside an authenticated dashboard/Studio session — **ASSUMPTION**, basis: no public
  `api.supabase.com` or project-URL route for it appears in the fetched OpenAPI spec, and
  Supabase's hosted Studio talks to it over an internal channel gated by dashboard login, not a
  documented public API. Not independently verified beyond "not in the spec" — flag as
  UNSOURCED — MUST VERIFY if this matters later.

**Bottom line:** service_role is real Postgres role but reaching it with DDL rights requires a
*direct Postgres connection* (needs DB_PASSWORD, which is stale) — the JWT itself, presented to
any HTTP API, does not carry that role's privileges into a SQL session. There is no HTTP-layer
route, with any key we hold, that turns into a DDL-capable Postgres session.

## 4. Non-interactive PAT / password reset

- **PAT creation is dashboard-only.** Supabase's documented way to obtain a PAT is
  `https://supabase.com/dashboard/account/tokens` — **FACT-S**, referenced from
  `https://supabase.com/docs/reference/api/introduction` (fetched 2026-09-07), which describes
  PATs as something you "manually generate" via account settings. There is no bootstrap
  endpoint to mint a first PAT using another credential — every Management API PAT-management
  route itself requires `bearer` auth (see section 1), so it is circular: you cannot use the
  Management API to get a PAT because getting into the Management API requires a PAT. This is
  inherent to the design, not a gap in our research. **Conclusion: strictly requires a browser.**
- **Password reset (`PATCH /v1/projects/{ref}/database/password`) also requires `bearer` auth**
  (confirmed in the live OpenAPI spec, section 1) — i.e. it too needs a PAT. So the Management
  API cannot be used to reset the DB password without a PAT either. The only non-interactive
  way to fix DB_PASSWORD would be if we already held a PAT — we don't.
- `supabase login --token <PAT>` (from `--help` output, section 2) lets you skip the interactive
  *browser* flow only if a PAT already exists in hand. It does not help mint one.

**Conclusion for objective 4: no.** Every non-interactive path to a fresh PAT or a password
reset dead-ends at needing a PAT we don't have. This step strictly requires the human's browser.

## 5. Shortest human action — recommendation

Three options, compared on click-count and downstream durability:

- **(a) Paste SQL into the Supabase SQL Editor.** Shortest single action for *this one
  migration*: log in to the dashboard → SQL Editor → paste `0014_order_games.sql` → Run. Zero
  new credentials generated. **Downside:** doesn't fix `run-migrations.mjs` or the CLI for any
  future migration — the next one hits this exact same wall, and it bypasses the migration
  history table (`supabase migration list` / `db push --include-all` may then see it as
  unapplied or conflict on replay unless the human also manually records it, e.g. via
  `supabase migration repair`).
- **(b) Reset the DB password** via dashboard → Project Settings → Database → Reset database
  password → update `DB_PASSWORD` in `.env.local` and Vercel env. Re-enables
  `run-migrations.mjs`, `supabase db push --db-url`/`--password`, and `supabase link` (with
  `--password`) — i.e. the **entire existing pipeline**, not just this one file. Slightly more
  clicks than (a) but fixes the systemic problem (a stale password is going to bite every future
  migration, not just this one).
- **(c) Create a PAT** via dashboard → Account → Access Tokens → Generate token → set
  `SUPABASE_ACCESS_TOKEN`. Unlocks Management API + `supabase link`/CLI project commands, but
  **DDL still ultimately needs a working DB connection or the `/database/query` endpoint** — a
  PAT alone doesn't run migrations, you'd still run `supabase db push` (which then also wants
  `--linked` after `supabase link`, or you use the Management API query endpoint directly). More
  moving parts than (b) for the same outcome, and a PAT is a broader-scoped, longer-lived
  credential than a DB password reset — larger blast radius if it ever leaks from a public repo
  checkout or CI log.

**Recommendation: (b), reset the DB password.** It requires about the same number of dashboard
clicks as generating a PAT, but it repairs the *existing, already-built* tooling
(`run-migrations.mjs`, `supabase db push --db-url`) rather than requiring new tooling or a new
credential class to manage going forward. (a) is fastest for this single file but leaves the
underlying breakage (stale password) unfixed and creates a migration-history bookkeeping task.
If the human wants both immediacy and durability: do (a) right now to unblock the dormant
feature, and separately do (b) afterward so the next migration doesn't repeat this whole
investigation.

Exact click-path for (b), since only Chaison can reach the dashboard — **per house rule,
console access is his, this is not independently verifiable by an agent**:
`supabase.com/dashboard/project/vwefthulbxqarttytvpl/settings/database` → "Reset database
password" → copy the new password into `.env.local`'s `DB_PASSWORD` (not committed, gitignored)
and into Vercel's project env vars → re-run `run-migrations.mjs` or
`npx supabase db push --db-url "<connection string with new password>"`.

## Sources

- Supabase Management API OpenAPI spec, fetched live: `https://api.supabase.com/api/v1-json`
  (2026-09-07) — used to enumerate real endpoints and their `security` requirements.
- `https://supabase.com/docs/reference/api/introduction` (fetched 2026-09-07) — PAT description,
  bearer-auth requirement statement.
- `https://supabase.com/docs/reference/api/v1-run-a-query` (fetched 2026-09-07) — endpoint page;
  notes it does not itself spell out DDL restrictions (flagged as a gap, not filled by
  inference).
- `https://supabase.com/docs/guides/database/extensions/pg_graphql` (fetched 2026-09-07) —
  "reflects a GraphQL schema from the existing SQL schema," no DDL mutation surface.
- Live CLI output, this machine, 2026-09-07: `npx supabase --version`, `--help`,
  `db push --help`, `link --help`, `login --help`, `migration --help`, `migration list --help`,
  `projects list`, and a live `db push --db-url` dial attempt against a deliberately fake local
  target.
- Live HTTP probes, this machine, 2026-09-07, against `api.supabase.com/v1/projects` and
  `api.supabase.com/v1/projects/vwefthulbxqarttytvpl/database/query` and
  `.../database/query/read-only` — unauthenticated, fake-PAT, and real-service_role-key
  attempts, all returning HTTP 401. No write/DDL call was made; only read-only/list endpoints
  were exercised; the service_role key value was read into a shell variable and used in a
  request header but never echoed or written to any file.
- `research/` directory, this repo, checked for pre-existing overlapping research (none found
  under this filename) — `ls research/` run 2026-09-07.

## What was NOT independently re-verified (relies on brief / prior work)

- The three "already ruled out" items (stale DB_PASSWORD on both poolers, PostgREST RPC 404s,
  `run-migrations.mjs` using the same stale password) were **not re-run** — the brief says not
  to redo them, and nothing found here contradicts them. No objection to how they were ruled
  out; the RPC-404 finding is fully consistent with the PostgREST behavior described in
  section 3 above.
