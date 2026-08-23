import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Terms & Refund Policy — Steamshare",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <div className="mx-auto w-full max-w-2xl space-y-8 py-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold tracking-tight">GameShare</span>
          </div>
          <h1 className="text-xl font-semibold">Steamshare Policies</h1>
          <p className="text-sm text-neutral-400">
            Plain-language policy for buyers of shared Steam account access.
            Applies to all purchases made via Shopee.
          </p>
        </div>

        <section className="space-y-3 border-t border-neutral-700 pt-6">
          <h2 className="text-lg font-semibold">1. Terms of Service</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
            <li>
              You are buying <strong className="text-neutral-100">shared access to a Steam account</strong>,
              not the account itself. You do not own it and never take it over.
            </li>
            <li>
              The account&apos;s login credentials and Steam Guard authenticator
              secret stay with the seller at all times. You are not given the
              authenticator — you get a fresh login code on demand via the
              lookup page.
            </li>
            <li>
              Each time you want to log in, use the lookup page (with your
              Shopee Buyer ID + Order ID) to get a{" "}
              <strong className="text-neutral-100">current</strong> Steam
              Guard code. Codes are time-limited — get a new one each
              session, don&apos;t try to reuse an old one.
            </li>
            <li>
              You agree <strong className="text-neutral-100">not to</strong>:
              <ul className="list-disc space-y-1 pl-5 pt-2">
                <li>Change the account password, email, or Steam Guard/2FA settings</li>
                <li>Attempt to remove or replace the authenticator</li>
                <li>Share your Order ID / Buyer ID or the resulting login code with anyone else</li>
              </ul>
            </li>
            <li>
              The account may be shared with other buyers of the same game.
              There&apos;s no guaranteed exclusive play window — if you and
              another buyer want to play at the same time, one of you will
              be logged out. This is a known limitation of the shared-access
              model, not a malfunction.
            </li>
            <li>
              Because access depends on Steam&apos;s platform and the account
              remaining in good standing, availability is not 100%
              guaranteed. See the Refund Policy below for what happens if
              the account becomes unavailable.
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-neutral-700 pt-6">
          <h2 className="text-lg font-semibold">2. Refund Policy</h2>

          <p className="text-sm font-medium text-neutral-200">
            If the account is banned, suspended, or otherwise unavailable:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
            <li>
              The lookup page will show &ldquo;temporarily unavailable,
              contact support&rdquo; instead of a code. This is expected
              behavior when an account&apos;s status is marked{" "}
              <code className="rounded bg-neutral-900 px-1 py-0.5 text-xs">banned</code>{" "}
              or{" "}
              <code className="rounded bg-neutral-900 px-1 py-0.5 text-xs">recovering</code>{" "}
              — you are not doing anything wrong.
            </li>
            <li>
              Contact support (see Section 3) with your Order ID and Buyer
              ID as soon as you see this message.
            </li>
          </ul>

          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
            <li>
              <strong className="text-neutral-100">Replacement first:</strong>{" "}
              if a working alternate account with the same game is
              available, you&apos;ll be switched to it within{" "}
              <strong className="text-neutral-100">48 hours</strong> of
              contacting support.
            </li>
            <li>
              <strong className="text-neutral-100">Refund if no replacement:</strong>{" "}
              if no replacement account is available within{" "}
              <strong className="text-neutral-100">7 days</strong> of the
              account going unavailable, you&apos;re entitled to a full
              refund of that order.
            </li>
            <li>
              Refunds are processed through Shopee&apos;s standard
              refund/return flow for the order.
            </li>
          </ul>

          <p className="text-sm font-medium text-neutral-200 pt-2">
            Not covered by refund:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-300">
            <li>
              Change of mind after successfully receiving a working login
              code and playing.
            </li>
            <li>
              Issues caused by the buyer changing account settings in
              violation of the Terms of Service above.
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-t border-neutral-700 pt-6">
          <h2 className="text-lg font-semibold">3. Support Contact</h2>
          <p className="text-sm text-neutral-300">
            Need help with a lookup, a banned account, or a refund?
          </p>
          <p className="rounded border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-100">
            [SUPPORT CONTACT — fill in your WhatsApp number or support email here]
          </p>
          <p className="text-sm text-neutral-400">
            Include your Shopee Order ID and Buyer ID when you reach out — it
            speeds up resolution.
          </p>
        </section>

        <div className="border-t border-neutral-700 pt-6">
          <Link href="/" className="text-sm text-blue-400 hover:underline">
            ← Back to lookup
          </Link>
        </div>
      </div>
    </main>
  );
}
