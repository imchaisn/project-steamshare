import { NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/shopee-auth";

/**
 * Admin-only (gated by proxy.ts, not a public prefix). Returns the shop
 * authorization link to click through in a browser — this cannot be
 * automated, Shopee requires the actual shop owner to log in and confirm.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/shopee/callback`;
  const url = generateAuthUrl(redirectUri);

  return NextResponse.json({
    url,
    redirectUri,
    note:
      "Sandbox auth host is ambiguous in Shopee's own docs (see lib/shopee-auth.ts comment). " +
      "If this link 404s or errors in the Console's own sandbox, check what auth link the " +
      "Console itself displays for this app and set SHOPEE_AUTH_HOST to match. Also confirm " +
      "this redirectUri is registered as the app's Redirect URL Domain (Test Redirect URL " +
      "Domain field for sandbox) in the Console — Shopee validates it against that.",
  });
}
