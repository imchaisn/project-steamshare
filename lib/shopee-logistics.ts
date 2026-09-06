/**
 * Shopee Logistics client — marks a paid, auto-delivered order as "Shipped"
 * on Shopee's own side.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 * Before this module, nothing in this codebase ever called a Shopee shipping
 * API. lib/fulfillment.ts + lib/shopee-chat.ts turn a paid order into an
 * `orders` row and a delivered chat message, and stop there. Shopee's own
 * order-status machine does not know about either of those — on Shopee's
 * side the order sits in READY_TO_SHIP until something calls
 * `v2.logistics.ship_order`. Left there, Shopee's Auto Cancellation Layer
 * eventually cancels the order FOR NON-SHIPMENT AND REFUNDS THE BUYER, who
 * by then already has working Steam login credentials from the chat message
 * — a straight, recurring revenue leak, not a rare edge case. Sourced in
 * research/2026-09-06-shopee-virtual-goods-shipping-requirement.md: Virtual
 * Goods is a "Non-SSL" shipping channel, not an auto-completing checkout, and
 * runs through the exact same READY_TO_SHIP -> ... -> COMPLETED lifecycle as
 * a physical parcel, including Days-to-Ship and Auto Cancellation.
 *
 * ── WHAT IS VERIFIED HERE, AND WHAT IS NOT ───────────────────────────────
 * VERIFIED (Shopee's own Open Platform developer guide, quoted in the
 * research file above): for a "non_integrated" logistics channel — which is
 * what Virtual Goods is — `v2.logistics.ship_order` takes
 *   { "order_sn": "...", "non_integrated": { "tracking_number": "..." } }
 * and, on success, moves the order straight to SHIPPED with no pickup/drop-
 * off wait (Shopee never touches a parcel that does not exist).
 *
 * NOT VERIFIED, and each one is a real "before this goes live" step:
 *   1. This module skips `v2.logistics.get_shipping_parameter` (the call
 *      Shopee's guide says to make FIRST, to learn what `info_needed`
 *      `ship_order` expects) because that endpoint's exact response shape for
 *      a non_integrated channel was not confirmed by the research pass — only
 *      inferred from the neighbouring ship_order example. Calling ship_order
 *      directly with the one concrete shape Shopee's own guide documents is
 *      the more defensible move than building against a second, unconfirmed
 *      contract. If the real response ever demands a field beyond
 *      tracking_number, Shopee's error message will say so and this function
 *      will surface it via ShipOrderError — it will not fail silently.
 *   2. TRACKING_NUMBER_STRATEGY below: no source gives an officially
 *      sanctioned value for `tracking_number` on a listing with no real
 *      carrier. This defaults to the order_sn itself — traceable, unique,
 *      and not a fabricated carrier code — but it is a best guess, not a
 *      confirmed one. CHECK THE FIRST REAL RESPONSE before trusting this at
 *      volume: if Shopee rejects it or a different value is later confirmed
 *      (e.g. by Shopee Seller Support), change TRACKING_NUMBER_STRATEGY, not
 *      the call sites.
 * Both are why SHOPEE_AUTO_SHIP defaults OFF (see the webhook route) even
 * once this code is deployed — the same posture lib/shopee-chat.ts took
 * before its endpoint was confirmed live, except here confirmation has to
 * come from Chaison watching a real order in Seller Centre, because there is
 * no test double for Shopee's logistics API in this repo.
 */

/**
 * Deferred rather than a static top-level import, for the same reason
 * lib/fulfillment.ts's getAdminClient() and lib/follow-up.ts's cross-module
 * imports are deferred: this repo's tests run on bare `node --test`, which
 * cannot resolve the `@/` tsconfig path alias. A static import here would
 * make this whole module — including the pure buildTrackingNumber() below,
 * which lib/shopee-logistics.test.ts covers — unloadable by the test runner.
 * tsc still type-checks this fully.
 */
async function getShopeeAuth(): Promise<typeof import("@/lib/shopee-auth")> {
  return import("@/lib/shopee-auth");
}

const IS_SANDBOX = (process.env.SHOPEE_ENV ?? "sandbox") !== "live";
const API_HOST =
  process.env.SHOPEE_API_HOST ??
  (IS_SANDBOX
    ? "https://openplatform.sandbox.test-stable.shopee.sg"
    : "https://partner.shopeemobile.com");

const SHIP_ORDER_PATH = "/api/v2/logistics/ship_order";

/** Shopee is a third party on the public internet; never hang a webhook on it. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * What to send as `non_integrated.tracking_number` when there is no real
 * carrier tracking number — see the module docblock, point 2. Isolated as its
 * own function so "Shopee told us to send X instead" is a one-line change.
 */
export function buildTrackingNumber(orderSn: string): string {
  return orderSn;
}

/** Shopee's standard response envelope — same shape lib/shopee-chat.ts and
 *  lib/shopee-api.ts already key their error handling off. */
interface ShopeeEnvelope {
  error?: string;
  message?: string;
  request_id?: string;
  response?: unknown;
}

export interface ShipOrderInput {
  orderSn: string;
  /** Omit for Steamshare's single shop; resolved from shopee_auth. */
  shopId?: number;
}

export interface ShipOrderResult {
  /** true ONLY when Shopee accepted the ship_order call. Never optimistic. */
  shipped: boolean;
  /** Reason / context. Safe to persist to orders.ship_error verbatim. */
  detail: string;
  /**
   * true when we genuinely cannot tell whether Shopee processed the call —
   * a client timeout or a 5xx. Treat as "do not auto-retry"; a human should
   * check the order's status in Seller Centre before anything resends,
   * exactly as lib/shopee-chat.ts treats an ambiguous chat send.
   */
  ambiguous?: boolean;
}

/** Redact anything credential-shaped before it can reach a log or a DB column. */
function redact(text: string): string {
  return text.replace(/(access_token|sign|partner_key)=[^&\s]+/gi, "$1=[redacted]");
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Resolve which shop_id to sign as. Identical logic to
 * lib/shopee-chat.ts's resolveShopId() — duplicated rather than imported so
 * this module has no dependency on shopee-chat.ts's internals, which are
 * free to change independently.
 */
async function resolveShopId(shopId?: number): Promise<number | null> {
  if (typeof shopId === "number" && Number.isFinite(shopId)) return shopId;

  const fromEnv = Number(process.env.SHOPEE_SHOP_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  try {
    const { getStoredShopToken } = await getShopeeAuth();
    const stored = await getStoredShopToken();
    return stored?.shopId ?? null;
  } catch {
    return null;
  }
}

/**
 * Mark one order Shipped on Shopee's side, using the non-integrated
 * (no real 3PL) logistics method that Virtual Goods listings use.
 *
 * Never throws — same contract as sendBuyerMessage() in lib/shopee-chat.ts,
 * and for the same reason: the caller (shipOnce() in the webhook route) has
 * already recorded the order and delivered credentials, so a shipping-call
 * bug must degrade to "logged, not shipped", never to a Shopee push retry
 * storm for an order that is already fulfilled.
 *
 * IDEMPOTENCY IS THE CALLER'S JOB, exactly as sendBuyerMessage's docblock
 * says. This function has no memory: call it twice and it calls Shopee
 * twice. Guard it with orders.shipped_at.
 */
export async function shipOrder({ orderSn, shopId }: ShipOrderInput): Promise<ShipOrderResult> {
  try {
    if (!orderSn || !orderSn.trim()) {
      return { shipped: false, detail: "No order_sn supplied; refusing to call ship_order." };
    }
    const sn = orderSn.trim();

    const resolvedShopId = await resolveShopId(shopId);
    if (resolvedShopId === null) {
      return fail(
        sn,
        "No authorized Shopee shop on file, so ship_order could not be signed or called. " +
          "Complete the shop authorization flow (/api/admin/shopee/auth-url) or set SHOPEE_SHOP_ID.",
      );
    }

    const { getValidAccessToken, signShopRequest } = await getShopeeAuth();

    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(resolvedShopId);
    } catch (err) {
      return fail(
        sn,
        `Could not obtain a valid Shopee access token for shop ${resolvedShopId}: ${redact(errText(err))}. ` +
          "If this persists the shop probably needs re-authorizing.",
      );
    }

    const body = {
      order_sn: sn,
      non_integrated: { tracking_number: buildTrackingNumber(sn) },
    };

    let url: string;
    try {
      const { timestamp, sign } = await signShopRequest(SHIP_ORDER_PATH, accessToken, resolvedShopId);
      const params = new URLSearchParams({
        partner_id: process.env.SHOPEE_PARTNER_ID ?? "",
        timestamp: String(timestamp),
        access_token: accessToken,
        shop_id: String(resolvedShopId),
        sign,
      });
      url = `${API_HOST}${SHIP_ORDER_PATH}?${params.toString()}`;
    } catch (err) {
      return fail(sn, `ship_order request could not be signed: ${redact(errText(err))}`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (timedOut) {
        // AMBIGUOUS ON PURPOSE — same reasoning as shopee-chat.ts: a client
        // timeout does not tell us whether Shopee processed the ship call, and
        // a second ship_order call on an order Shopee already shipped is the
        // one thing we must not risk triggering blind.
        return {
          shipped: false,
          detail: `ship_order for order ${sn} timed out after ${REQUEST_TIMEOUT_MS}ms; ship state unknown, not retried automatically`,
          ambiguous: true,
        };
      }
      return fail(sn, `ship_order network failure for order ${sn}: ${redact(errText(err))}`);
    }
    clearTimeout(timer);

    if (res.status >= 500) {
      return {
        shipped: false,
        detail: `ship_order for order ${sn} returned HTTP ${res.status}; ship state unknown, not retried automatically`,
        ambiguous: true,
      };
    }

    let bodyText: string;
    try {
      bodyText = await res.text();
    } catch (err) {
      return {
        shipped: false,
        detail: `ship_order for order ${sn} returned HTTP ${res.status} but the body could not be read: ${redact(errText(err))}`,
        ambiguous: true,
      };
    }

    let envelope: ShopeeEnvelope;
    try {
      envelope = JSON.parse(bodyText) as ShopeeEnvelope;
    } catch {
      return {
        shipped: false,
        detail: `ship_order for order ${sn} returned HTTP ${res.status} with a non-JSON body: ${redact(bodyText).slice(0, 300)}`,
        ambiguous: res.ok,
      };
    }

    // Shopee reports application errors inside a 200 with a non-empty `error`
    // string — same convention every other module in this codebase keys off.
    if (envelope.error) {
      const detail =
        `Shopee rejected ship_order for order ${sn}: ${envelope.error}` +
        `${envelope.message ? ` — ${envelope.message}` : ""}` +
        `${envelope.request_id ? ` (request_id ${envelope.request_id})` : ""}`;
      console.error(`[shopee-logistics] ${detail}`);
      return { shipped: false, detail };
    }

    if (!res.ok) {
      return fail(
        sn,
        `ship_order for order ${sn} returned HTTP ${res.status} with no error field: ${redact(bodyText).slice(0, 300)}`,
      );
    }

    const requestId = envelope.request_id ? ` (request_id ${envelope.request_id})` : "";
    return {
      shipped: true,
      detail: `Order ${sn} marked Shipped on Shopee via the non-integrated logistics channel${requestId}.`,
    };
  } catch (err) {
    // Absolute last line of defence — see the module docblock: a bug here
    // must never escalate into a Shopee push retry storm.
    return fail(orderSn, `Unexpected error in the Shopee logistics client: ${redact(errText(err))}`);
  }
}

function fail(orderSn: string, detail: string): ShipOrderResult {
  console.error(`[shopee-logistics] ship_order failed for order ${orderSn}: ${detail}`);
  return { shipped: false, detail };
}
