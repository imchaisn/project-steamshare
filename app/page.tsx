"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

/**
 * Staged flow added 2026-09-06 (Chaison's call): Check order -> reveal
 * username/password -> Get Code -> code revealed, hover-to-copy. Credentials
 * are shown as soon as the order resolves, before any code fetch, because a
 * buyer needs them just to reach Steam's login screen in the first place —
 * gating them behind a successful code fetch (the old all-in-one behaviour)
 * would strand a supplier-sourced buyer who can't get a code without first
 * logging in with credentials they don't have yet. No confirmation/checkbox
 * step: Get Code fires immediately, and a failure is shown as a failure with
 * what to do next, not a gate before trying.
 *
 * ── MULTI-GAME, 2026-09-06 ────────────────────────────────────────────────
 * Shopee splits a cart by SHOP, not by item, so a buyer who bought four games
 * in one checkout has ONE order id covering all four. The page therefore
 * renders one CARD PER GAME — title, username, password, its own Get Code
 * button, its own code — repeated for however many the order holds.
 *
 * Each card's code state is INDEPENDENT (see `codes`, keyed by gameId). One
 * game failing to produce a code must not blank out the other three, and a
 * buyer must be able to work through them in any order. This is why the
 * single `Stage` union that used to carry username/password/code was split:
 * order-level state (checking / found / error) is now separate from per-game
 * code state, because they no longer move together.
 */

/** One game on the order, as /api/lookup's `credentials` phase returns it. */
type GameCard = {
  gameId: string;
  title: string | null;
  username?: string;
  password?: string;
  /**
   * True when this game's Steam account is not `active` (banned or
   * recovering). The card is still SHOWN — a game the buyer paid for that
   * silently vanished would look like it was never bought — but it shows a
   * contact-support line instead of credentials.
   */
  unavailable?: boolean;
};

/** Per-game code state. Keyed by gameId in `codes`. */
type CodeState =
  | { name: "idle" }
  | { name: "loading" }
  | { name: "done"; code: string; codeChanged: boolean | null }
  | { name: "error"; message: string };

/** Order-level state. Deliberately carries no credentials — those are per game. */
type Stage =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "found"; games: GameCard[] }
  | { name: "error"; message: string };

async function parseJson(res: Response): Promise<{ error?: string; [k: string]: unknown }> {
  // Parse defensively. A crashed route returns HTTP 500 with an EMPTY body,
  // and res.json() then throws — which used to fall through to a catch that
  // told the buyer "Network error, try again". Their network was fine; ours
  // was broken, and they were sent to check their wifi instead of contacting
  // support. A real incident on 2026-09-06.
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function genericErrorFor(res: Response, data: { error?: string }): string {
  return typeof data.error === "string"
    ? data.error
    : res.status >= 500
      ? "Something went wrong on our side, not yours. Please message us on Shopee chat and we'll sort it out."
      : "Something went wrong";
}

/**
 * The clipboard button used beside a username or password.
 *
 * Rendered as the third cell of the parent's three-column grid rather than
 * with `justify-between`, which is what the single-game version used. That
 * mattered once there were two rows: `justify-between` pushes each button to
 * the end of ITS OWN row, so the username and password buttons landed at
 * different x-positions whenever the two values differed in length — which
 * they always do. The grid pins both to the same column.
 */
function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS) — value stays visible either way.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label.toLowerCase()}`}
      className="shrink-0 text-base leading-none justify-self-end"
    >
      {copied ? "✅" : "📋"}
    </button>
  );
}

export default function LookupPage() {
  const [orderId, setOrderId] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [codes, setCodes] = useState<Record<string, CodeState>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function handleCheckOrder(e: React.FormEvent) {
    e.preventDefault();
    setStage({ name: "checking" });
    setCodes({});
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phase: "credentials" }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setStage({ name: "error", message: genericErrorFor(res, data) });
        return;
      }

      // `games` is the multi-game shape. The `username`/`password` fallback
      // covers a response from a deployment that predates it — belt and
      // braces during the rollout, not a permanent second code path.
      const games = Array.isArray(data.games)
        ? (data.games as GameCard[])
        : typeof data.username === "string"
          ? [
              {
                gameId: "legacy",
                title: null,
                username: data.username as string,
                password: data.password as string,
              },
            ]
          : [];

      if (games.length === 0) {
        setStage({
          name: "error",
          message:
            "We found your order but could not load its games. Please message us on Shopee chat.",
        });
        return;
      }
      setStage({ name: "found", games });
    } catch {
      setStage({
        name: "error",
        message: "Could not reach GameShare. Check your connection and try again.",
      });
    }
  }

  async function handleGetCode(game: GameCard, refresh = false) {
    if (!game.username) return;
    setCodes((prev) => ({ ...prev, [game.gameId]: { name: "loading" } }));
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Which game this is for, and the account shown at the previous step:
        // this order may hold several games, and each may be backed by a pool
        // of accounts the buyer is logged into as ONE member of. See the
        // pinned-account note in app/api/lookup/route.ts.
        body: JSON.stringify({
          orderId,
          phase: "code",
          refresh,
          username: game.username,
          gameId: game.gameId,
        }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setCodes((prev) => ({
          ...prev,
          [game.gameId]: { name: "error", message: genericErrorFor(res, data) },
        }));
        return;
      }
      setCodes((prev) => ({
        ...prev,
        [game.gameId]: {
          name: "done",
          code: data.code as string,
          codeChanged: (data.codeChanged as boolean | null | undefined) ?? null,
        },
      }));
    } catch {
      setCodes((prev) => ({
        ...prev,
        [game.gameId]: {
          name: "error",
          message: "Could not reach GameShare. Check your connection and try again.",
        },
      }));
    }
  }

  async function handleCopyCode(gameId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(gameId);
      setTimeout(() => setCopiedCode((v) => (v === gameId ? null : v)), 1200);
    } catch {
      // ignore — code stays visible either way
    }
  }

  function reset() {
    setOrderId("");
    setStage({ name: "idle" });
    setCodes({});
    setCopiedCode(null);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-dopamine text-ink p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold tracking-tight">GameShare</span>
        </div>
        <h1 className="text-xl font-semibold">Get your login code</h1>

        {(stage.name === "idle" || stage.name === "checking") && (
          <form onSubmit={handleCheckOrder} className="space-y-4">
            <div>
              <label className="block text-sm mb-1" htmlFor="orderId">
                Shopee Order ID
              </label>
              <input
                id="orderId"
                className="w-full rounded border border-line bg-surface-1 px-3 py-2"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={stage.name === "checking"}
              className="w-full rounded btn-dopamine px-3 py-2 font-medium disabled:opacity-50 text-white"
            >
              {stage.name === "checking" ? "Checking..." : "Check my order"}
            </button>
          </form>
        )}

        {stage.name === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-bad" role="alert">
              {stage.message}
            </p>
            <button type="button" onClick={reset} className="text-xs underline text-accent-light">
              Try again
            </button>
          </div>
        )}

        {stage.name === "found" && (
          <>
            {/*
              Only say how many when there is more than one. A single-game
              buyer seeing "1 game in this order" reads as a system talking to
              itself; a four-game buyer needs to know all four are here and
              that scrolling is expected.
            */}
            {stage.games.length > 1 && (
              <p className="text-sm text-ink-dim">
                {stage.games.length} games in this order — each has its own code.
              </p>
            )}

            <div className="space-y-4">
              {stage.games.map((game) => {
                const code = codes[game.gameId] ?? { name: "idle" };
                return (
                  <div
                    key={game.gameId}
                    className="rounded border border-line bg-surface-1 p-4 space-y-3"
                  >
                    {game.title && (
                      <h2 className="font-semibold leading-snug">{game.title}</h2>
                    )}

                    {game.unavailable || !game.username || !game.password ? (
                      <p className="text-sm text-bad" role="alert">
                        This game is temporarily unavailable. Please message us on Shopee
                        chat and we&apos;ll sort it out.
                      </p>
                    ) : (
                      <>
                        {/*
                          Three columns — label, value, copy button — so the
                          username and password copy buttons sit in the same
                          column no matter how long either value is.
                        */}
                        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 text-sm">
                          <span className="text-ink-dim">Username:</span>
                          <span className="break-all">{game.username}</span>
                          <CopyButton label="Username" value={game.username} />

                          <span className="text-ink-dim">Password:</span>
                          <span className="break-all">{game.password}</span>
                          <CopyButton label="Password" value={game.password} />
                        </div>

                        {code.name === "idle" && (
                          <button
                            type="button"
                            onClick={() => handleGetCode(game)}
                            className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
                          >
                            Get Code
                          </button>
                        )}

                        {code.name === "loading" && (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white disabled:opacity-50"
                          >
                            Getting code…
                          </button>
                        )}

                        {code.name === "error" && (
                          <>
                            <p className="text-sm text-bad" role="alert">
                              {code.message}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleGetCode(game)}
                              className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
                            >
                              Try again
                            </button>
                          </>
                        )}

                        {code.name === "done" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(game.gameId, code.code)}
                              title="Click to copy"
                              className="group relative w-full rounded border border-line tile-dopamine px-3 py-3 text-center hover:border-accent"
                            >
                              <span className="text-ink-dim text-xs block mb-1">
                                Steam Guard code
                              </span>
                              <span className="text-2xl font-mono tracking-widest">
                                {code.code}
                              </span>
                              <span
                                className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-[#1b0e2e]/90 text-sm font-medium transition-opacity ${
                                  copiedCode === game.gameId
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                }`}
                              >
                                {copiedCode === game.gameId ? "Copied!" : "Click to copy"}
                              </span>
                            </button>

                            {/*
                              Steam issues a NEW code only when someone attempts a
                              login again. Until then this same value is what the
                              site will keep returning, so we say so rather than
                              letting the buyer wonder whether the button worked.
                            */}
                            {code.codeChanged === false && (
                              <p className="text-xs text-ink-dim">
                                Same code as before — Steam has not sent a new one yet.
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() => handleGetCode(game, true)}
                              className="text-xs underline text-accent-light"
                            >
                              Logged in again? Get the newest code
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(stage.name === "found" || stage.name === "error") && (
          <button type="button" onClick={reset} className="w-full text-xs underline text-accent-light">
            Start over
          </button>
        )}

        {stage.name === "idle" && (
          <p className="text-sm text-center">
            First time?{" "}
            <Link href="/tutorial" className="text-accent-light hover:underline">
              See the full setup tutorial
            </Link>
          </p>
        )}

        <p className="text-xs text-ink-dim text-center pt-2">
          Need help? Message us on Shopee chat ·{" "}
          <Link href="/tutorial" className="text-accent-light hover:underline">
            How to Play
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="text-accent-light hover:underline">
            Terms & Refund Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
