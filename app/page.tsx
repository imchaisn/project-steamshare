"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

interface LookupResult {
  username: string;
  password: string;
  code: string;
}

export default function LookupPage() {
  const [buyerId, setBuyerId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId, orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setResult(data);
      setModalOpen(true);
    } catch {
      setError("Network error, try again");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (e.g. non-HTTPS) — just close the modal
    } finally {
      setModalOpen(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="font-semibold tracking-tight">GameShare</span>
        </div>
        <h1 className="text-xl font-semibold">Get your login code</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1" htmlFor="buyerId">
              Shopee Buyer ID
            </label>
            <input
              id="buyerId"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1" htmlFor="orderId">
              Shopee Order ID
            </label>
            <input
              id="orderId"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-3 py-2 font-medium disabled:opacity-50"
          >
            {loading ? "Checking..." : "Get code"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded border border-neutral-700 bg-neutral-900 p-4 space-y-2">
            <p className="text-sm">
              <span className="text-neutral-400">Username:</span>{" "}
              {result.username}
            </p>
            <p className="text-sm">
              <span className="text-neutral-400">Password:</span>{" "}
              {result.password}
            </p>
            <p className="text-lg font-mono tracking-widest">
              <span className="text-neutral-400 text-sm block font-sans">
                Steam Guard code:
              </span>
              {result.code}
            </p>
            {copied && (
              <p className="text-sm text-blue-400">Copied!</p>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-500 text-center pt-2">
          Need help? [SUPPORT CONTACT — fill in] ·{" "}
          <Link href="/terms" className="text-blue-400 hover:underline">
            Terms & Refund Policy
          </Link>
        </p>
      </div>

      {modalOpen && result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xs rounded border border-neutral-700 bg-neutral-900 p-6 space-y-4 text-center">
            <p className="text-sm text-neutral-400">Steam Guard code</p>
            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-3 text-3xl font-mono tracking-widest hover:border-blue-500"
            >
              {result.code}
            </button>
            {copied && (
              <p className="text-sm text-blue-400">Copied!</p>
            )}
            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full rounded bg-blue-600 px-3 py-2 font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
