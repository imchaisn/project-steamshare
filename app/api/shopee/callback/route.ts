import { NextResponse } from "next/server";
import { exchangeCodeForToken, saveShopToken } from "@/lib/shopee-auth";

/**
 * OAuth-style redirect target Shopee sends the browser to after a seller
 * completes shop authorization: `?code=...&shop_id=...`. Public route — no
 * session cookie exists on this request, Shopee is redirecting the seller's
 * own browser here directly. See proxy.ts PUBLIC_PREFIXES.
 *
 * This domain (or its Test Redirect URL Domain equivalent in sandbox) must
 * match what's configured in the Console's App settings, or Shopee will
 * reject redirect_uri per spec §1.2.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const shopIdRaw = searchParams.get("shop_id");

  if (!code || !shopIdRaw) {
    return htmlResponse(
      "Authorization failed",
      `Missing ${!code ? "code" : "shop_id"} in the redirect. Shopee's own error, if any, would normally appear as extra query params — check the URL this page was reached at.`,
      400,
    );
  }

  const shopId = Number(shopIdRaw);

  try {
    const { accessToken, refreshToken, expireIn } = await exchangeCodeForToken(code, shopId);
    await saveShopToken(shopId, accessToken, refreshToken, expireIn);
    return htmlResponse(
      "Shopee shop authorized",
      `shop_id ${shopId} is now connected. Access token stored, expires in ${Math.round(expireIn / 60)} minutes — it will auto-refresh on future API calls.`,
      200,
    );
  } catch (err) {
    return htmlResponse(
      "Token exchange failed",
      err instanceof Error ? err.message : "Unknown error",
      500,
    );
  }
}

function htmlResponse(title: string, message: string, status: number) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:40rem;margin:0 auto">
      <h1>${title}</h1><p>${message}</p>
    </body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  );
}
