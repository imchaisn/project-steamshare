import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TutorialImage } from "@/components/TutorialImage";

export const metadata: Metadata = {
  title: "How to Play — Tutorial — GameShare",
};

const STEPS = [
  { id: "step-1", label: "1. Install Steam" },
  { id: "step-2", label: "2. Log in" },
  { id: "step-3", label: "3. Install the game" },
  { id: "step-4", label: "4. Disable Steam Cloud" },
  { id: "step-5", label: "5. Activate the game" },
  { id: "step-6", label: "6. Play offline" },
  { id: "step-7", label: "7. Troubleshooting" },
  { id: "step-8", label: "8. FAQ" },
] as const;

export default function TutorialPage() {
  return (
    <main className="min-h-screen bg-dopamine text-ink p-6">
      <div className="mx-auto w-full max-w-2xl space-y-8 py-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold tracking-tight">GameShare</span>
          </div>
          <h1 className="text-xl font-semibold">How to Play — Setup Tutorial</h1>
          <p className="text-sm text-ink-dim">
            Follow these steps in order the first time you set up. Steps 4 and
            6 are marked <strong className="text-ink">every session</strong> —
            do those two every time you play, not just once.
          </p>
        </div>

        {/* Sticky step nav */}
        <nav
          aria-label="Tutorial steps"
          className="sticky top-0 z-10 -mx-6 overflow-x-auto border-y border-line bg-[#1b0e2e]/95 px-6 py-2 backdrop-blur"
        >
          <ul className="flex w-max gap-2 text-xs">
            {STEPS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block whitespace-nowrap rounded border border-line px-2.5 py-1 text-ink-dim hover:border-accent hover:text-ink"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Step 1 */}
        <section id="step-1" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">1. Download &amp; install Steam</h2>
          <p className="text-sm text-ink-dim">
            Go to{" "}
            <a
              href="https://store.steampowered.com/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              store.steampowered.com
            </a>{" "}
            and download Steam for your device. Run the installer and follow
            the prompts. Skip this step if Steam is already installed.
          </p>
          <TutorialImage
            src="/tutorial/steam-download-install.png"
            filename="steam-download-install.png"
            caption="Steam's official download page / installer"
          />
        </section>

        {/* Step 2 */}
        <section id="step-2" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">2. Log in with the provided account</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-dim">
            <li>
              Open Steam and click the <strong className="text-ink">+</strong>{" "}
              button to add an account.
              <TutorialImage
                src="/tutorial/steam-open-add-account.png"
                filename="steam-open-add-account.png"
                caption="Steam login screen — click + to add an account"
              />
            </li>
            <li>
              Log in with the <strong className="text-ink">username and
              password we provided</strong> — not your own personal Steam
              account.
              <TutorialImage
                src="/tutorial/steam-login-screen.png"
                filename="steam-login-screen.png"
                caption="Enter the provided username and password"
              />
            </li>
            <li>
              Steam will ask for a Steam Guard code. Go to our{" "}
              <Link href="/" className="text-accent hover:underline">
                lookup page
              </Link>
              , enter your Shopee Order ID and Steam username, and click{" "}
              <strong className="text-ink">Get Code</strong>.
              <TutorialImage
                src="/tutorial/gameshare-code.png"
                filename="gameshare-code.png"
                caption="gameshare.space — enter your Order ID + Steam username, click Get Code"
              />
            </li>
            <li>
              Copy that code and enter it into Steam to finish logging in.
              <TutorialImage
                src="/tutorial/steam-guard-code-entry.png"
                filename="steam-guard-code-entry.png"
                caption="Enter the Steam Guard code from the lookup page"
              />
            </li>
          </ol>
          <p className="rounded border border-line bg-surface-1 p-3 text-xs text-ink-dim">
            Codes expire quickly — get a fresh one each time you log in, don&apos;t
            try to reuse an old one.
          </p>
        </section>

        {/* Step 3 */}
        <section id="step-3" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">3. Install the game</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-dim">
            <li>
              Open your Library and click the game.
              <TutorialImage
                src="/tutorial/library-find-game.png"
                filename="library-find-game.png"
                caption="Find the game in your Steam Library"
              />
            </li>
            <li>
              Click the small dropdown arrow next to the button and choose{" "}
              <strong className="text-ink">&ldquo;This device&rdquo;</strong>.
              If the button just says &ldquo;Stream&rdquo; or
              &ldquo;Connect&rdquo; and you click it directly, it will try to
              stream instead of installing — always check the dropdown first.
            </li>
            <li>
              Choose an install location and confirm. The game will start
              downloading — you can move on to step 4 while it downloads.
              <TutorialImage
                src="/tutorial/library-install-progress.png"
                filename="library-install-progress.png"
                caption="Confirm install location and start the download"
              />
            </li>
          </ol>
        </section>

        {/* Step 4 — Disable Steam Cloud (why stated inline, per session) */}
        <section id="step-4" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">
            4. Disable Steam Cloud{" "}
            <span className="text-sm font-normal text-bad">— every session</span>
          </h2>
          <p className="text-sm text-ink-dim">
            <strong className="text-ink">Why this matters:</strong> this
            account is shared with other buyers. If Steam Cloud stays on,
            whoever plays most recently has their save pushed to the cloud —
            which can silently{" "}
            <strong className="text-ink">
              overwrite another buyer&apos;s save
            </strong>
            . Turning it off before you play protects your progress and
            everyone else&apos;s.
          </p>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-dim">
            <li>
              Open Steam Settings and go to the Cloud section.
              <TutorialImage
                src="/tutorial/steam-settings-cloud-tab.png"
                filename="steam-settings-cloud-tab.png"
                caption="Steam Settings → Cloud"
              />
            </li>
            <li>
              Turn off &ldquo;Enable Steam Cloud&rdquo; for this game.
              <TutorialImage
                src="/tutorial/cloud-toggle-off.png"
                filename="cloud-toggle-off.png"
                caption="Turn off the Enable Steam Cloud toggle"
              />
            </li>
            <li>
              Confirm it worked: the &ldquo;Cloud Status&rdquo; label on the
              game should disappear from your Library.
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TutorialImage
                  src="/tutorial/cloud-status-disappeared.png"
                  filename="cloud-status-disappeared.png"
                  caption="✅ Cloud Status is gone — you're safe to play"
                />
                <TutorialImage
                  src="/tutorial/cloud-status-still-exists.png"
                  filename="cloud-status-still-exists.png"
                  caption="❌ Cloud Status still showing — repeat steps 1–2"
                />
              </div>
            </li>
          </ol>
        </section>

        {/* Step 5 */}
        <section id="step-5" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">5. Activate the game (first time only)</h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-dim">
            <li>Once installed, click Play.</li>
            <li>
              Confirm you&apos;re launching on{" "}
              <strong className="text-ink">This device</strong>.
              <TutorialImage
                src="/tutorial/this-device-confirm.png"
                filename="this-device-confirm.png"
                caption="Confirm launching on This device"
              />
            </li>
            <li>
              Wait for the game to reach its main menu — this activates it on
              the account. Then close it with{" "}
              <strong className="text-ink">Alt+F4</strong> and confirm the
              exit prompt.
            </li>
          </ol>
        </section>

        {/* Step 6 — Play offline (full click path in the main step, per session) */}
        <section id="step-6" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">
            6. Play in Offline Mode{" "}
            <span className="text-sm font-normal text-bad">— every session</span>
          </h2>
          <p className="text-sm text-ink-dim">
            Once the game has finished downloading, go offline{" "}
            <strong className="text-ink">before every session</strong> — not
            just the first time.
          </p>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-ink-dim">
            <li>
              Click <strong className="text-ink">&ldquo;Steam&rdquo;</strong>{" "}
              at the top-left corner of the Steam window.
              <TutorialImage
                src="/tutorial/steam-menu-open.png"
                filename="steam-menu-open.png"
                caption="1. Click the Steam menu (top-left)"
              />
            </li>
            <li>
              Then click <strong className="text-ink">&ldquo;Go Offline…&rdquo;</strong>.
              <TutorialImage
                src="/tutorial/steam-menu-go-offline.png"
                filename="steam-menu-go-offline.png"
                caption="2. Then click Go Offline…"
              />
            </li>
            <li>
              Confirm the offline indicator before launching anything.
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TutorialImage
                  src="/tutorial/offline-indicator-confirmed.png"
                  filename="offline-indicator-confirmed.png"
                  caption="✅ Offline Mode confirmed — safe to launch"
                />
                <TutorialImage
                  src="/tutorial/offline-indicator-still-online.png"
                  filename="offline-indicator-still-online.png"
                  caption="❌ Still online — repeat step 1, don't launch yet"
                />
              </div>
            </li>
          </ol>
          <p className="rounded border border-line bg-surface-1 p-3 text-xs text-ink-dim">
            Make sure the game isn&apos;t already open while you switch to
            offline mode — close it first, switch, then launch.
          </p>
          <div className="rounded border border-accent/40 bg-surface-1 p-4 text-center">
            <p className="text-sm font-medium text-ink">
              That&apos;s it — you&apos;re all set. Enjoy the game!
            </p>
            <TutorialImage
              src="/tutorial/play-game.png"
              filename="play-game.png"
              caption="You're ready to play"
            />
          </div>
        </section>

        {/* Step 7 — Troubleshooting (single block, not duplicated) */}
        <section id="step-7" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">7. Troubleshooting</h2>
          <p className="text-sm text-ink-dim">
            Seeing &ldquo;Library locked&rdquo; or &ldquo;In use by a family
            member&rdquo;? Open the scenario that matches what you see.{" "}
            <span className="text-ink-dim/70">
              (A screenshot of this error, and one for each scenario below,
              will be added here later.)
            </span>
          </p>

          <details className="group rounded border border-line bg-surface-1 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Scenario 1 — This is my first time activating this game
            </summary>
            <div className="mt-2 space-y-2 text-sm text-ink-dim">
              <p>
                Someone else on the account is currently playing a different
                game. Wait until the account is free, then follow step 5
                (Activate the game) again.
              </p>
              <p>
                If it&apos;s urgent, message us on Shopee chat with your Order
                ID and we&apos;ll check availability.
              </p>
            </div>
          </details>

          <details className="group rounded border border-line bg-surface-1 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Scenario 2 — I already activated this game before, and it&apos;s
              locked again
            </summary>
            <div className="mt-2 space-y-2 text-sm text-ink-dim">
              <p>
                Another buyer is using the account right now. Close Steam,
                wait a few minutes, then get a fresh code from the{" "}
                <Link href="/" className="text-accent hover:underline">
                  lookup page
                </Link>{" "}
                and log in again.
              </p>
            </div>
          </details>

          <details className="group rounded border border-line bg-surface-1 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Scenario 3 — I&apos;ve already set everything up and gone
              offline before, but it&apos;s still locked
            </summary>
            <div className="mt-2 space-y-2 text-sm text-ink-dim">
              <p>
                Make sure you actually went offline (step 6) before opening
                the game — if Steam is online, the account looks
                &ldquo;in use&rdquo; to Steam even if no one else is actively
                playing. Go offline first, then launch.
              </p>
              <p>
                Still stuck after that? Message us on Shopee chat with your
                Order ID — don&apos;t rush to leave a bad rating, we can
                usually fix this within minutes.
              </p>
            </div>
          </details>

          <details className="group rounded border border-line bg-surface-1 p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Scenario 4 — I can&apos;t log in at all
            </summary>
            <div className="mt-2 space-y-2 text-sm text-ink-dim">
              <p>
                Double-check the username and password are exactly what we
                gave you — not your own personal Steam account. If those are
                correct and it still won&apos;t log in, the account may be{" "}
                <strong className="text-ink">overloaded</strong> (too many
                buyers on it right now).
              </p>
              <p>
                Message us on Shopee chat with your Order ID. We&apos;ll
                assign you a different account for the same game — you&apos;ll
                get new login details, but your Order ID stays the same.
              </p>
            </div>
          </details>
        </section>

        {/* Step 8 — FAQ */}
        <section id="step-8" className="scroll-mt-16 space-y-3 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">8. FAQ</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-ink">
                Can I play at the same time as another buyer?
              </dt>
              <dd className="text-ink-dim">
                No — this is a shared account. If two people try to play at
                once, one gets logged out. Not a bug.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">
                My save is missing — what happened?
              </dt>
              <dd className="text-ink-dim">
                Almost always Steam Cloud was still on. See step 4 — disable
                it every session to protect your progress.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">
                Do I need a new code every time I log in?
              </dt>
              <dd className="text-ink-dim">
                Yes. Get a fresh Steam Guard code from the{" "}
                <Link href="/" className="text-accent hover:underline">
                  lookup page
                </Link>{" "}
                each time — old codes expire.
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">
                Can I change the account password or turn off Steam Guard?
              </dt>
              <dd className="text-ink-dim">
                No — that locks everyone else out, including you next time.
                See the{" "}
                <Link href="/terms" className="text-accent hover:underline">
                  Terms &amp; Refund Policy
                </Link>
                .
              </dd>
            </div>
            <div>
              <dt className="font-medium text-ink">
                The account shows banned or unavailable — now what?
              </dt>
              <dd className="text-ink-dim">
                Message us on Shopee chat with your Order ID. See the{" "}
                <Link href="/terms" className="text-accent hover:underline">
                  Refund Policy
                </Link>{" "}
                for the replacement/refund timeline.
              </dd>
            </div>
          </dl>
        </section>

        {/* TODO(i18n): a real Bahasa Malaysia version of this tutorial is a
            genuine differentiator (competitor's "steammy" link is a dead
            alias to the same English page) — but it needs a deliberate,
            native-quality translation pass, not auto-translated copy on a
            page real paying customers rely on. Not built in this pass. */}

        <div className="border-t border-line pt-6">
          <Link href="/" className="text-sm text-accent hover:underline">
            ← Back to lookup
          </Link>
        </div>
      </div>
    </main>
  );
}
