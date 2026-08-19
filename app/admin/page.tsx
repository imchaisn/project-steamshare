"use client";

import { useEffect, useState } from "react";

interface Account {
  id: string;
  username: string;
  status: string;
  created_at: string;
}

interface Game {
  id: string;
  title: string;
  steam_app_id: string;
}

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [games, setGames] = useState<Game[]>([]);

  const [newAccount, setNewAccount] = useState({
    username: "",
    password: "",
    sharedSecret: "",
  });
  const [newGame, setNewGame] = useState({ title: "", steamAppId: "" });
  const [linkForm, setLinkForm] = useState({ accountId: "", gameId: "" });

  async function refresh() {
    const [accountsRes, gamesRes] = await Promise.all([
      fetch("/api/admin/accounts").then((r) => r.json()),
      fetch("/api/admin/games").then((r) => r.json()),
    ]);
    setAccounts(accountsRes.accounts ?? []);
    setGames(gamesRes.games ?? []);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAccount),
    });
    setNewAccount({ username: "", password: "", sharedSecret: "" });
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

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8 space-y-10">
      <h1 className="text-2xl font-semibold">Project Steamshare — Admin</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Steam Accounts</h2>
        <table className="w-full text-sm border border-neutral-800">
          <thead>
            <tr className="text-left border-b border-neutral-800">
              <th className="p-2">Username</th>
              <th className="p-2">Status</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-neutral-900">
                <td className="p-2">{a.username}</td>
                <td className="p-2">{a.status}</td>
                <td className="p-2">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addAccount} className="flex gap-2 flex-wrap">
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Username"
            value={newAccount.username}
            onChange={(e) =>
              setNewAccount({ ...newAccount, username: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Password"
            value={newAccount.password}
            onChange={(e) =>
              setNewAccount({ ...newAccount, password: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Shared secret (base64)"
            value={newAccount.sharedSecret}
            onChange={(e) =>
              setNewAccount({ ...newAccount, sharedSecret: e.target.value })
            }
            required
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 font-medium"
          >
            Add account
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Games</h2>
        <table className="w-full text-sm border border-neutral-800">
          <thead>
            <tr className="text-left border-b border-neutral-800">
              <th className="p-2">Title</th>
              <th className="p-2">Steam App ID</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-b border-neutral-900">
                <td className="p-2">{g.title}</td>
                <td className="p-2">{g.steam_app_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={addGame} className="flex gap-2 flex-wrap">
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Title"
            value={newGame.title}
            onChange={(e) =>
              setNewGame({ ...newGame, title: e.target.value })
            }
            required
          />
          <input
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
            placeholder="Steam App ID"
            value={newGame.steamAppId}
            onChange={(e) =>
              setNewGame({ ...newGame, steamAppId: e.target.value })
            }
            required
          />
          <button
            type="submit"
            className="rounded bg-blue-600 px-3 py-1 font-medium"
          >
            Add game
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Link account to game</h2>
        <form onSubmit={linkAccountGame} className="flex gap-2 flex-wrap">
          <select
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
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
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
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
            className="rounded bg-blue-600 px-3 py-1 font-medium"
          >
            Link
          </button>
        </form>
      </section>
    </main>
  );
}
