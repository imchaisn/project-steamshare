"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

interface LookupResult {
  username: string;
  password: string;
  code: string;
  /**
   * Whether this differs from the last code served for this order.
   * false means Steam has not issued a new one since — pressing again will
   * keep returning this same value until the buyer logs in afresh.
   * Null when the answer is not known (own-Guard accounts, or a cached read).
   */
  codeChanged?: boolean | null;
}

export default function LookupPage() {
  const [username, setUsername] = useState("");
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleSubmit(e: React.FormEvent, refresh = false) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // On a refresh, keep the current code on screen until the new one lands —
    // blanking it would leave the buyer with nothing mid-request.
    if (!refresh) setResult(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, orderId, refresh }),
      });
      // Parse defensively. A crashed route returns HTTP 500 with an EMPTY
      // body, and res.json() then throws — which used to fall through to the
      // outer catch and tell the buyer "Network error, try again". Their
      // network was fine; ours was broken, and they were sent to check their
      // wifi instead of contacting support. A real incident on 2026-09-06.
      let data: { error?: string; [k: string]: unknown } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : res.status >= 500
              ? "Something went wrong on our side, not yours. Please message us on Shopee chat and we'll sort it out."
              : "Something went wrong",
        );
        return;
      }
      setResult(data as unknown as LookupResult);
      setModalOpen(true);
    } catch {
      // Genuinely could not reach us at all — the only case where blaming the
      // connection is honest.
      setError("Could not reach GameShare. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      // Show "Copied!" briefly before dismissing, so the confirmation is
      // actually visible rather than closing the instant it's set.
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setModalOpen(false);
      }, 1200);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS). Close without claiming
      // a copy happened — the code stays visible on the page behind.
      setModalOpen(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-dopamine text-ink p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold tracking-tight">GameShare</span>
        </div>
        <h1 className="text-xl font-semibold">Get your login code</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm mb-1" htmlFor="username">
              Steam Username
            </label>
            <input
              id="username"
              className="w-full rounded border border-line bg-surface-1 px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded btn-dopamine px-3 py-2 font-medium disabled:opacity-50 text-white"
          >
            {loading ? "Checking..." : "Get code"}
          </button>
        </form>

        <p className="text-sm text-center">
          First time?{" "}
          <Link href="/tutorial" className="text-accent hover:underline">
            See the full setup tutorial
          </Link>
        </p>

        {error && (
          <p className="text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded border border-line bg-surface-1 p-4 space-y-2">
            <p className="text-sm">
              <span className="text-ink-dim">Username:</span>{" "}
              {result.username}
            </p>
            <p className="text-sm">
              <span className="text-ink-dim">Password:</span>{" "}
              {result.password}
            </p>
            <p className="text-lg font-mono tracking-widest">
              <span className="text-ink-dim text-sm block font-sans">
                Steam Guard code:
              </span>
              {result.code}
            </p>
            {copied && (
              <p className="text-sm text-good">Copied!</p>
            )}

            {/*
              Steam issues a NEW code only when someone attempts a login again.
              Until then this same value is what the site will keep returning,
              so we say so rather than letting the buyer wonder whether the
              button worked.
            */}
            {result.codeChanged === false && (
              <p className="text-xs text-ink-dim">
                Same code as before — Steam has not sent a new one yet.
              </p>
            )}

            <button
              type="button"
              disabled={refreshing || loading}
              onClick={async (e) => {
                setRefreshing(true);
                try {
                  await handleSubmit(e as unknown as React.FormEvent, true);
                } finally {
                  setRefreshing(false);
                }
              }}
              className="text-xs underline text-accent disabled:opacity-50"
            >
              {refreshing ? "Getting newest code…" : "Logged in again? Get the newest code"}
            </button>
          </div>
        )}

        <p className="text-xs text-ink-dim text-center pt-2">
          Need help? Message us on Shopee chat ·{" "}
          <Link href="/tutorial" className="text-accent hover:underline">
            How to Play
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms & Refund Policy
          </Link>
        </p>
      </div>

      {modalOpen && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1b0e2e]/85 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xs rounded border border-line bg-surface-1 p-6 space-y-4 text-center">
            <p className="text-sm text-ink-dim">Steam Guard code</p>
            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full rounded border border-line tile-dopamine px-3 py-3 text-3xl font-mono tracking-widest hover:border-accent"
            >
              {result.code}
            </button>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={copied}
              className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
