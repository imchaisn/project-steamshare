"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

interface Account {
  id: string;
  username: string;
  status: string;
  recovery_email: string | null;
  created_at: string;
  code_source: string | null;
  supplier_site: string | null;
  supplier_order_id: string | null;
}

/** Credentials pulled on demand for one account, never held in the list. */
interface RevealedAccount {
  username: string;
  password: string;
  supplierSite: string | null;
  supplierOrderId: string | null;
}

interface Game {
  id: string;
  title: string;
  steam_app_id: string;
}

interface AccountGame {
  id: string;
  account_id: string;
  game_id: string;
}

interface Order {
  id: string;
  shopee_order_id: string;
  shopee_buyer_id: string;
  account_game_id: string;
  verified: boolean;
  created_at: string;
  /** The other website this order is connected to, and its order id there. */
  supplier_site: string | null;
  supplier_order_id: string | null;
}

interface CodeAccessLog {
  id: string;
  order_id: string | null;
  ip: string | null;
  created_at: string;
}

const ACCOUNT_STATUSES = ["active", "banned", "recovering"] as const;

/**
 * Kept in step with SUPPLIER_SITES in lib/code-source/types.ts. A site with no
 * adapter there could never have its codes fetched, so it must not be
 * selectable here.
 */
const SUPPLIER_SITES = ["cyberspace.cyou", "gamersfantasy.my"] as const;

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [accountGames, setAccountGames] = useState<AccountGame[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<CodeAccessLog[]>([]);

  const [newAccount, setNewAccount] = useState({
    username: "",
    password: "",
    sharedSecret: "",
    recoveryEmail: "",
    recoveryEmailPassword: "",
    codeSource: "totp",
    supplierSite: SUPPLIER_SITES[0] as string,
    supplierOrderId: "",
  });
  // Keyed by account id so revealing one row never reveals another.
  const [revealed, setRevealed] = useState<Record<string, RevealedAccount>>({});
  // Whether the server will actually fetch supplier codes right now.
  const [supplierEnabled, setSupplierEnabled] = useState(true);
  const [newGame, setNewGame] = useState({ title: "", steamAppId: "" });
  const [linkForm, setLinkForm] = useState({ accountId: "", gameId: "" });
  const [newOrder, setNewOrder] = useState({
    supplierSite: "",
    supplierOrderId: "",
    shopeeOrderId: "",
    shopeeBuyerId: "",
    accountGameId: "",
    verified: true,
  });

  async function refresh() {
    const [accountsRes, gamesRes, accountGamesRes, ordersRes, logsRes] =
      await Promise.all([
        fetch("/api/admin/accounts").then((r) => r.json()),
        fetch("/api/admin/games").then((r) => r.json()),
        fetch("/api/admin/account-games").then((r) => r.json()),
        fetch("/api/admin/orders").then((r) => r.json()),
        fetch("/api/admin/code-access-log").then((r) => r.json()),
      ]);
    setAccounts(accountsRes.accounts ?? []);
    setSupplierEnabled(accountsRes.supplierEnabled ?? false);
    setGames(gamesRes.games ?? []);
    setAccountGames(accountGamesRes.accountGames ?? []);
    setOrders(ordersRes.orders ?? []);
    setLogs(logsRes.logs ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  function accountGameLabel(ag: AccountGame) {
    const account = accounts.find((a) => a.id === ag.account_id);
    const game = games.find((g) => g.id === ag.game_id);
    return `${account?.username ?? "?"} — ${game?.title ?? "?"}`;
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const {
      username,
      password,
      sharedSecret,
      recoveryEmail,
      recoveryEmailPassword,
      codeSource,
      supplierSite,
      supplierOrderId,
    } = newAccount;
    const isSupplier = codeSource === "supplier";
    await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        codeSource,
        // A supplier account has no seed of ours to send, and a TOTP account
        // has no supplier fields. Sending both would violate the shape the
        // API and migration 0011's CHECK constraint both enforce.
        ...(isSupplier ? { supplierSite, supplierOrderId } : { sharedSecret }),
        ...(recoveryEmail.trim() ? { recoveryEmail } : {}),
        ...(recoveryEmailPassword.trim() ? { recoveryEmailPassword } : {}),
      }),
    });
    setNewAccount({
      username: "",
      password: "",
      sharedSecret: "",
      recoveryEmail: "",
      recoveryEmailPassword: "",
      codeSource: "totp",
      supplierSite: SUPPLIER_SITES[0] as string,
      supplierOrderId: "",
    });
    refresh();
  }

  /**
   * Pull one account's plaintext credentials. Deliberately on demand and one
   * at a time — the list endpoint never carries passwords, so the fleet's
   * credentials are not shipped to the browser on every page load.
   */
  async function revealAccount(id: string) {
    const res = await fetch("/api/admin/accounts/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as RevealedAccount;
    setRevealed((prev) => ({ ...prev, [id]: data }));
  }

  function hideAccount(id: string) {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  /**
   * A supplier can rotate the order id behind an account. Correcting it in
   * place keeps the account's game links and order history intact.
   */
  async function updateSupplierOrderId(id: string, supplierOrderId: string) {
    await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, supplierOrderId }),
    });
    refresh();
  }

  /**
   * Connect this GameShare order to the matching order on another of our
   * websites, or clear that link. Both fields go together — a site with no
   * order id resolves to nothing and would fail at lookup time, so the API
   * rejects a half-filled pair.
   */
  async function updateOrderMapping(
    id: string,
    supplierSite: string,
    supplierOrderId: string,
  ) {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, supplierSite, supplierOrderId }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      alert(body.error ?? "Could not update the mapping");
    }
    refresh();
  }

  async function updateAccountStatus(id: string, status: string) {
    await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    refresh();
  }

  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGame),
    });
    setNewGame({ title: "", steamAppId: "" });
    refresh();
  }

  async function linkAccountGame(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/account-games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(linkForm),
    });
    setLinkForm({ accountId: "", gameId: "" });
    refresh();
  }

  async function addOrder(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOrder),
    });
    setNewOrder({
      supplierSite: "",
      supplierOrderId: "",
      shopeeOrderId: "",
      shopeeBuyerId: "",
      accountGameId: "",
      verified: true,
    });
    refresh();
  }

  return (
    <main className="min-h-screen bg-dopamine text-ink p-8 space-y-10">
      <div className="flex items-center gap-3">
        <Logo size={32} />
        <h1 className="text-2xl font-semibold">GameShare — Admin</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Steam Accounts</h2>
        {!supplierEnabled &&
          accounts.some((a) => a.code_source === "supplier") && (
            <p className="rounded border border-amber-500 bg-amber-500/10 p-3 text-sm">
              <strong>Supplier code fetching is OFF.</strong> Accounts below with
              code source <code>supplier</code> will return &ldquo;temporarily
              unavailable&rdquo; to every buyer. Set{" "}
              <code>SUPPLIER_CODE_SOURCE=true</code> in Vercel production{" "}
              <em>and redeploy</em> — Vercel bakes env vars into a deployment, so
              setting the value alone is not enough.
            </p>
          )}
        <table className="w-full text-sm border border-line">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-2">Username</th>
              <th className="p-2">Status</th>
              <th className="p-2">Code source</th>
              <th className="p-2">Supplier site</th>
              <th className="p-2">Supplier order ID</th>
              <th className="p-2">Credentials</th>
              <th className="p-2">Recovery email</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-line-dim">
                <td className="p-2">{a.username}</td>
                <td className="p-2">
                  <select
                    className="rounded border border-line bg-surface-1 px-2 py-1"
                    value={a.status}
                    onChange={(e) => updateAccountStatus(a.id, e.target.value)}
                  >
                    {ACCOUNT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">{a.code_source ?? "totp"}</td>
                <td className="p-2">{a.supplier_site ?? "—"}</td>
                <td className="p-2">
                  {a.code_source === "supplier" ? (
                    <input
                      className="w-40 rounded border border-line bg-surface-1 px-2 py-1 font-mono text-xs"
                      defaultValue={a.supplier_order_id ?? ""}
                      onBlur={(e) => {
                        const next = e.target.value.trim();
                        if (next && next !== (a.supplier_order_id ?? "")) {
                          updateSupplierOrderId(a.id, next);
                        }
                      }}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2">
                  {revealed[a.id] ? (
                    <div className="space-y-1">
                      <div className="font-mono text-xs">
                        {revealed[a.id].username} / {revealed[a.id].password}
                      </div>
                      <button
                        type="button"
                        className="rounded border border-line px-2 py-0.5 text-xs"
                        onClick={() => hideAccount(a.id)}
                      >
                        Hide
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="rounded border border-line px-2 py-0.5 text-xs"
                      onClick={() => revealAccount(a.id)}
                    >
                      Reveal
                    </button>
                  )}
                </td>
                <td className="p-2">{a.recovery_email ?? "—"}</td>
                <td className="p-2">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addAccount} className="flex gap-2 flex-wrap">
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Username"
            value={newAccount.username}
            onChange={(e) =>
              setNewAccount({ ...newAccount, username: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Password"
            value={newAccount.password}
            onChange={(e) =>
              setNewAccount({ ...newAccount, password: e.target.value })
            }
            required
          />
          <select
            className="rounded border border-line bg-surface-1 px-2 py-1"
            value={newAccount.codeSource}
            onChange={(e) =>
              setNewAccount({ ...newAccount, codeSource: e.target.value })
            }
          >
            <option value="totp">Own Steam Guard (TOTP)</option>
            <option value="supplier">Supplier website</option>
          </select>
          {newAccount.codeSource === "supplier" ? (
            <>
              <select
                className="rounded border border-line bg-surface-1 px-2 py-1"
                value={newAccount.supplierSite}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, supplierSite: e.target.value })
                }
              >
                {SUPPLIER_SITES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded border border-line bg-surface-1 px-2 py-1 font-mono"
                placeholder="Supplier order ID"
                value={newAccount.supplierOrderId}
                onChange={(e) =>
                  setNewAccount({
                    ...newAccount,
                    supplierOrderId: e.target.value,
                  })
                }
                required
              />
            </>
          ) : (
            <input
              className="rounded border border-line bg-surface-1 px-2 py-1"
              placeholder="Shared secret (base64)"
              value={newAccount.sharedSecret}
              onChange={(e) =>
                setNewAccount({ ...newAccount, sharedSecret: e.target.value })
              }
              required
            />
          )}
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Recovery email (optional)"
            value={newAccount.recoveryEmail}
            onChange={(e) =>
              setNewAccount({ ...newAccount, recoveryEmail: e.target.value })
            }
          />
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Recovery email password (optional)"
            value={newAccount.recoveryEmailPassword}
            onChange={(e) =>
              setNewAccount({
                ...newAccount,
                recoveryEmailPassword: e.target.value,
              })
            }
          />
          <button
            type="submit"
            className="rounded btn-dopamine px-3 py-1 font-medium text-white"
          >
            Add account
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Games</h2>
        <table className="w-full text-sm border border-line">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-2">Title</th>
              <th className="p-2">Steam App ID</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-b border-line-dim">
                <td className="p-2">{g.title}</td>
                <td className="p-2">{g.steam_app_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addGame} className="flex gap-2 flex-wrap">
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Title"
            value={newGame.title}
            onChange={(e) =>
              setNewGame({ ...newGame, title: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Steam App ID"
            value={newGame.steamAppId}
            onChange={(e) =>
              setNewGame({ ...newGame, steamAppId: e.target.value })
            }
            required
          />
          <button
            type="submit"
            className="rounded btn-dopamine px-3 py-1 font-medium text-white"
          >
            Add game
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Link account to game</h2>
        <form onSubmit={linkAccountGame} className="flex gap-2 flex-wrap">
          <select
            className="rounded border border-line bg-surface-1 px-2 py-1"
            value={linkForm.accountId}
            onChange={(e) =>
              setLinkForm({ ...linkForm, accountId: e.target.value })
            }
            required
          >
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.username}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-line bg-surface-1 px-2 py-1"
            value={linkForm.gameId}
            onChange={(e) =>
              setLinkForm({ ...linkForm, gameId: e.target.value })
            }
            required
          >
            <option value="">Select game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded btn-dopamine px-3 py-1 font-medium text-white"
          >
            Link
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Orders</h2>
        <table className="w-full text-sm border border-line">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-2">Our Order ID</th>
              <th className="p-2">Other website</th>
              <th className="p-2">Their Order ID</th>
              <th className="p-2">Buyer ID</th>
              <th className="p-2">Verified</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line-dim">
                <td className="p-2 font-mono text-xs">{o.shopee_order_id}</td>
                <td className="p-2">
                  <select
                    className="rounded border border-line bg-surface-1 px-2 py-1"
                    defaultValue={o.supplier_site ?? ""}
                    onChange={(e) =>
                      updateOrderMapping(
                        o.id,
                        e.target.value,
                        e.target.value ? (o.supplier_order_id ?? "") : "",
                      )
                    }
                  >
                    <option value="">— none (use account default) —</option>
                    {SUPPLIER_SITES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    className="w-44 rounded border border-line bg-surface-1 px-2 py-1 font-mono text-xs"
                    placeholder="their order id"
                    defaultValue={o.supplier_order_id ?? ""}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next !== (o.supplier_order_id ?? "")) {
                        updateOrderMapping(o.id, o.supplier_site ?? "", next);
                      }
                    }}
                  />
                </td>
                <td className="p-2">{o.shopee_buyer_id}</td>
                <td className="p-2">{o.verified ? "Yes" : "No"}</td>
                <td className="p-2">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addOrder} className="flex gap-2 flex-wrap items-center">
          <select
            className="rounded border border-line bg-surface-1 px-2 py-1"
            value={newOrder.supplierSite}
            onChange={(e) =>
              setNewOrder({ ...newOrder, supplierSite: e.target.value })
            }
          >
            <option value="">Other website — none</option>
            {SUPPLIER_SITES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1 font-mono"
            placeholder="Their order ID"
            value={newOrder.supplierOrderId}
            onChange={(e) =>
              setNewOrder({ ...newOrder, supplierOrderId: e.target.value })
            }
          />
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Shopee Order ID"
            value={newOrder.shopeeOrderId}
            onChange={(e) =>
              setNewOrder({ ...newOrder, shopeeOrderId: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-line bg-surface-1 px-2 py-1"
            placeholder="Shopee Buyer ID"
            value={newOrder.shopeeBuyerId}
            onChange={(e) =>
              setNewOrder({ ...newOrder, shopeeBuyerId: e.target.value })
            }
            required
          />
          <select
            className="rounded border border-line bg-surface-1 px-2 py-1"
            value={newOrder.accountGameId}
            onChange={(e) =>
              setNewOrder({ ...newOrder, accountGameId: e.target.value })
            }
            required
          >
            <option value="">Select account + game</option>
            {accountGames.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {accountGameLabel(ag)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={newOrder.verified}
              onChange={(e) =>
                setNewOrder({ ...newOrder, verified: e.target.checked })
              }
            />
            Verified
          </label>
          <button
            type="submit"
            className="rounded btn-dopamine px-3 py-1 font-medium text-white"
          >
            Add order
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Code Access Log</h2>
        <table className="w-full text-sm border border-line">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="p-2">ID</th>
              <th className="p-2">Order ID</th>
              <th className="p-2">IP</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line-dim">
                <td className="p-2">{l.id}</td>
                <td className="p-2">{l.order_id ?? "—"}</td>
                <td className="p-2">{l.ip ?? "—"}</td>
                <td className="p-2">
                  {new Date(l.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
