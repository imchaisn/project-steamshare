/**
 * Shopee first-chat recovery — the message-body builders and the send
 * sequence that gets a delivery message to a buyer who has NEVER chatted
 * with the shop.
 *
 * ── WHY THIS MODULE EXISTS AT ALL ────────────────────────────────────────
 * On 2026-09-08 a paid Batman: Arkham Knight order (250101EXAMPLE1) was
 * allocated, auto-shipped, and then silently never delivered. Shopee
 * rejected the chat send six times — once per push retry — with:
 *
 *   first_chat_without_order_info — If user send message from Open API,
 *   must satisfy the following conditions: If 2 users have no existing
 *   conversation, the message must contain order information between 2 users.
 *
 * Shopee will not let a shop open a conversation with a bare text message.
 * The first message to a stranger has to carry order information. Every
 * earlier order happened to be from a buyer who had already opened a chat,
 * which is why automated delivery looked fine for three days.
 *
 * So: send the text; if and only if Shopee raises that specific rejection,
 * send an ORDER CARD first (which is order information, and creates the
 * conversation) and then re-send the text. A buyer who already has a
 * conversation is completely unaffected — they never hit the branch, and
 * never see a second message.
 *
 * ── WHY IT IS A SEPARATE FILE FROM lib/shopee-chat.ts ────────────────────
 * lib/shopee-chat.ts reaches Supabase (transitively, via shopee-auth), so
 * `node --test` cannot import it — the same boundary lib/fulfillment.test.ts
 * and lib/shopee-logistics.test.ts both document. Keeping the decision logic
 * here, with ZERO imports, is what makes the sequence testable at all. Same
 * reasoning as lib/order-games-compat.ts.
 *
 * ── WHAT IS AND IS NOT VERIFIED ──────────────────────────────────────────
 * VERIFIED live 2026-09-08 by probing the production shop:
 *   - Shopee validates in this order: to_id presence -> `content` must be an
 *     object -> the permission/contact-window gate -> everything else. A
 *     `content` of a bare string answers "param_error" even for a recipient
 *     that would be refused, while an unknown `message_type` does NOT — it
 *     falls through to "user_is_forbidden".
 *   - `message_type` is NOT structurally validated, so a probe with a
 *     throwaway recipient could not confirm the order card — it needed a
 *     send to a real buyer inside the contact window.
 *
 *   - THE ORDER CARD ITSELF, confirmed by exactly that send (request_id
 *     e3e3e7f35af4e3d2d0543da5730c7200, 2026-09-08). Sending
 *
 *         { to_id, message_type: "order", content: { order_sn } }
 *
 *     was accepted, and Shopee echoed the stored message back as
 *     message_type "order" with content { order_sn, shop_id } — it fills in
 *     shop_id itself, so we must not send it. This is measured, not assumed.
 *
 * Both field values stay env-overridable (SHOPEE_SELLERCHAT_ORDER_MESSAGE_TYPE
 * / SHOPEE_SELLERCHAT_ORDER_SN_FIELD) so a future Shopee change is a config
 * flip rather than a deploy.
 *
 * THE FAILURE MODE IS THE STATUS QUO, NOT A REGRESSION: the order card is
 * only ever attempted on an order Shopee has ALREADY refused, and if the card
 * is refused too we record both reasons and stop. Nothing that delivers today
 * can start failing because of this file.
 */

/**
 * How a Shopee chat message is addressed. Kept as a discriminated union
 * because the two addressing strategies produce different address types,
 * and the body builders handle both without changing shape.
 */
export type ChatRecipient =
  | { kind: "conversation"; conversationId: string }
  | { kind: "buyer_user_id"; toId: number };

/**
 * Request-body field names for /api/v2/sellerchat/send_message.
 *
 * All of these are CONFIRMED against the live API — the text fields on
 * 2026-09-05 (see lib/shopee-chat.ts's header) and the order-card fields on
 * 2026-09-08 (see above).
 */
export const SELLERCHAT_SEND_FIELDS = {
  conversationIdField: "conversation_id",
  toIdField: "to_id",
  messageTypeField: "message_type",
  /** Confirmed: live messages carry message_type "text". */
  textMessageType: "text",
  contentField: "content",
  textField: "text",
  /** Confirmed nested: a flat string content is rejected as "param_error". */
  nestTextUnderContent: true,
  /** Confirmed live 2026-09-08: an order card is message_type "order". */
  orderMessageType: process.env.SHOPEE_SELLERCHAT_ORDER_MESSAGE_TYPE ?? "order",
  /**
   * Confirmed live 2026-09-08: content is { order_sn }. Shopee adds shop_id
   * to the stored message itself — do not send it.
   */
  orderSnField: process.env.SHOPEE_SELLERCHAT_ORDER_SN_FIELD ?? "order_sn",
} as const;

/**
 * The minimum shape this module needs from a send call. Structurally
 * compatible with lib/shopee-chat.ts's CallOutcome, so the real transport
 * can be passed straight in and a test can pass a plain function.
 */
export type SendOutcome =
  | { ok: true; data?: { request_id?: string } }
  | {
      ok: false;
      retryable?: boolean;
      ambiguous?: boolean;
      detail: string;
      retryAfterMs?: number;
    };

/**
 * Shopee's marker for "you may not open a conversation with a bare message".
 *
 * Matched on the error CODE only. The human-readable half of the message is
 * long, localised, and arrives padded with tab characters (see the real
 * string recorded in order_games.delivery_error), so anything that keyed off
 * the prose would be brittle.
 */
const FIRST_CHAT_ERROR_CODE = "first_chat_without_order_info";

/** True when Shopee refused because no conversation exists yet. */
export function demandsOrderContext(detail: string | undefined): boolean {
  if (!detail) return false;
  return detail.toLowerCase().includes(FIRST_CHAT_ERROR_CODE);
}

/** Address a body to either a conversation or a buyer user id. */
function addressTo(body: Record<string, unknown>, recipient: ChatRecipient): Record<string, unknown> {
  if (recipient.kind === "conversation") {
    body[SELLERCHAT_SEND_FIELDS.conversationIdField] = recipient.conversationId;
  } else {
    body[SELLERCHAT_SEND_FIELDS.toIdField] = recipient.toId;
  }
  return body;
}

/** The ordinary delivery message — unchanged from what has always been sent. */
export function buildTextBody(recipient: ChatRecipient, text: string): Record<string, unknown> {
  const f = SELLERCHAT_SEND_FIELDS;
  return addressTo(
    {
      [f.messageTypeField]: f.textMessageType,
      [f.contentField]: f.nestTextUnderContent ? { [f.textField]: text } : text,
    },
    recipient,
  );
}

/**
 * An order card: the "order information between 2 users" Shopee asks for.
 * Sent ONLY to open a conversation that does not exist yet.
 */
export function buildOrderCardBody(
  recipient: ChatRecipient,
  orderSn: string,
): Record<string, unknown> {
  const f = SELLERCHAT_SEND_FIELDS;
  return addressTo(
    {
      [f.messageTypeField]: f.orderMessageType,
      [f.contentField]: { [f.orderSnField]: orderSn },
    },
    recipient,
  );
}

export interface SendWithOrderContextParams<T extends SendOutcome> {
  orderSn: string;
  recipient: ChatRecipient;
  text: string;
  /** Performs one send. Injected so the sequence is testable without Shopee. */
  send: (body: Record<string, unknown>) => Promise<T>;
}

export interface SendWithOrderContextResult {
  outcome: SendOutcome;
  /** True when the first-chat recovery branch was taken. For logging. */
  usedOrderCard: boolean;
}

/**
 * Send the delivery text, recovering once from Shopee's first-chat rule.
 *
 * At most THREE sends, and only ever on the unhappy path:
 *   1. the text                        (the only send for an existing chat)
 *   2. an order card                   (only after a first-chat rejection)
 *   3. the text again                  (only after the card was accepted)
 *
 * It deliberately does NOT recover twice. If Shopee still refuses the text
 * after accepting the order card, that is a rule we do not understand, and
 * looping would just burn the webhook's time budget and risk duplicates.
 */
export async function sendWithOrderContext<T extends SendOutcome>({
  orderSn,
  recipient,
  text,
  send,
}: SendWithOrderContextParams<T>): Promise<SendWithOrderContextResult> {
  const first = await send(buildTextBody(recipient, text));
  if (first.ok || !demandsOrderContext(first.detail)) {
    return { outcome: first, usedOrderCard: false };
  }

  // No conversation exists. Open one with order information, then retry.
  const card = await send(buildOrderCardBody(recipient, orderSn));
  if (!card.ok) {
    return {
      usedOrderCard: true,
      outcome: {
        ok: false,
        retryable: false,
        ambiguous: false,
        detail:
          `Buyer of order ${orderSn} has no existing Shopee conversation, and the order card ` +
          `sent to open one was rejected too, so NOTHING was delivered. Order card failure: ` +
          `${card.detail} | Original text rejection: ${first.detail} | ` +
          `The buyer can still redeem at gameshare.space with their Order ID. If this repeats, ` +
          `the order-card shape is the thing to check — see lib/shopee-chat-order-context.ts.`,
      },
    };
  }

  const retry = await send(buildTextBody(recipient, text));
  return { outcome: retry, usedOrderCard: true };
}
