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
 */

type Stage =
  | { name: "idle" }
  | { name: "checking" }
  | { name: "found"; username: string; password: string }
  | { name: "gettingCode"; username: string; password: string }
  | {
      name: "done";
      username: string;
      password: string;
      code: string;
      codeChanged: boolean | null;
    }
  | { name: "codeError"; username: string; password: string; message: string }
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

/** Small clipboard button used next to the username and password values. */
function CopyField({ label, value }: { label: string; value: string }) {
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
    <p className="text-sm flex items-center justify-between gap-2">
      <span>
        <span className="text-ink-dim">{label}:</span> {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="shrink-0 text-base leading-none"
      >
        {copied ? "✅" : "📋"}
      </button>
    </p>
  );
}

export default function LookupPage() {
  const [orderId, setOrderId] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [codeCopied, setCodeCopied] = useState(false);

  async function handleCheckOrder(e: React.FormEvent) {
    e.preventDefault();
    setStage({ name: "checking" });
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
      setStage({
        name: "found",
        username: data.username as string,
        password: data.password as string,
      });
    } catch {
      setStage({
        name: "error",
        message: "Could not reach GameShare. Check your connection and try again.",
      });
    }
  }

  async function handleGetCode(refresh = false) {
    if (stage.name !== "found" && stage.name !== "codeError" && stage.name !== "done") return;
    const { username, password } = stage;
    setStage({ name: "gettingCode", username, password });
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, phase: "code", refresh }),
      });
      const data = await parseJson(res);
      if (!res.ok) {
        setStage({
          name: "codeError",
          username,
          password,
          message: genericErrorFor(res, data),
        });
        return;
      }
      setStage({
        name: "done",
        username,
        password,
        code: data.code as string,
        codeChanged: (data.codeChanged as boolean | null | undefined) ?? null,
      });
    } catch {
      setStage({
        name: "codeError",
        username,
        password,
        message: "Could not reach GameShare. Check your connection and try again.",
      });
    }
  }

  async function handleCopyCode() {
    if (stage.name !== "done") return;
    try {
      await navigator.clipboard.writeText(stage.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1200);
    } catch {
      // ignore — code stays visible either way
    }
  }

  function reset() {
    setOrderId("");
    setStage({ name: "idle" });
    setCodeCopied(false);
  }

  const credentials =
    stage.name === "found" ||
    stage.name === "gettingCode" ||
    stage.name === "done" ||
    stage.name === "codeError"
      ? stage
      : null;

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
            <button type="button" onClick={reset} className="text-xs underline text-accent">
              Try again
            </button>
          </div>
        )}

        {credentials && (
          <div className="rounded border border-line bg-surface-1 p-4 space-y-2">
            <CopyField label="Username" value={credentials.username} />
            <CopyField label="Password" value={credentials.password} />

            {stage.name === "found" && (
              <button
                type="button"
                onClick={() => handleGetCode()}
                className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
              >
                Get Code
              </button>
            )}

            {stage.name === "gettingCode" && (
              <button
                type="button"
                disabled
                className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white disabled:opacity-50"
              >
                Getting code…
              </button>
            )}

            {stage.name === "codeError" && (
              <>
                <p className="text-sm text-bad" role="alert">
                  {stage.message}
                </p>
                <button
                  type="button"
                  onClick={() => handleGetCode()}
                  className="w-full rounded btn-dopamine px-3 py-2 font-medium text-white"
                >
                  Try again
                </button>
              </>
            )}

            {stage.name === "done" && (
              <>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy"
                  className="group relative w-full rounded border border-line tile-dopamine px-3 py-3 text-center hover:border-accent"
                >
                  <span className="text-ink-dim text-xs block mb-1">
                    Steam Guard code
                  </span>
                  <span className="text-2xl font-mono tracking-widest">
                    {stage.code}
                  </span>
                  <span
                    className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-[#1b0e2e]/90 text-sm font-medium transition-opacity ${
                      codeCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {codeCopied ? "Copied!" : "Click to copy"}
                  </span>
                </button>

                {/*
                  Steam issues a NEW code only when someone attempts a login
                  again. Until then this same value is what the site will
                  keep returning, so we say so rather than letting the buyer
                  wonder whether the button worked.
                */}
                {stage.codeChanged === false && (
                  <p className="text-xs text-ink-dim">
                    Same code as before — Steam has not sent a new one yet.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleGetCode(true)}
                  className="text-xs underline text-accent"
                >
                  Logged in again? Get the newest code
                </button>
              </>
            )}
          </div>
        )}

        {(credentials || stage.name === "error") && (
          <button type="button" onClick={reset} className="w-full text-xs underline text-accent">
            Start over
          </button>
        )}

        {stage.name === "idle" && (
          <p className="text-sm text-center">
            First time?{" "}
            <Link href="/tutorial" className="text-accent hover:underline">
              See the full setup tutorial
            </Link>
          </p>
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
    </main>
  );
}
