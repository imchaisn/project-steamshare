/**
 * A short, non-reversible fingerprint of a Guard code.
 *
 * Split from ./log.ts for the same reason lib/rate-limit-constants.ts exists:
 * log.ts imports the Supabase client through the `@/` alias, which the
 * node:test runner cannot resolve, and that would leave this function — the
 * thing that decides whether we report "the code changed" — untestable.
 *
 * Truncated to 12 hex characters: ample to tell two 5-character codes apart,
 * and short enough to be useless for reversing. It is for EQUALITY COMPARISON
 * only, never for recovering a code. Note that the Steam Guard alphabet gives
 * only ~11.9M possible codes, so no hash of one is meaningfully secret — which
 * is the other reason the plaintext code is not stored at all.
 */
export async function fingerprintCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code.trim().toUpperCase()),
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
