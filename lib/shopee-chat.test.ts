import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOrderCardBody,
  demandsOrderContext,
  sendWithOrderContext,
  type ChatRecipient,
} from "./shopee-chat-order-context.ts";

/**
 * These cover the fix for the 2026-09-08 Batman: Arkham Knight order
 * (250101EXAMPLE1), which was allocated, shipped and then never delivered:
 * Shopee rejected the chat send six times with
 *
 *   first_chat_without_order_info — If 2 users have no existing
 *   conversation, the message must contain order information between 2 users.
 *
 * A buyer who has never chatted with the shop cannot be sent a bare text
 * message. sendWithOrderContext() takes the send call as an argument
 * precisely so this sequence is testable without a Shopee account: the
 * repo has no test double for that boundary (see lib/shopee-logistics.test.ts).
 */

const RECIPIENT: ChatRecipient = { kind: "buyer_user_id", toId: 123456 };
const ORDER_SN = "250101EXAMPLE1";

/** Shopee's real rejection string, copied verbatim from orders delivery_error. */
const FIRST_CHAT_ERROR =
  "Shopee rejected the chat call to /api/v2/sellerchat/send_message: " +
  "first_chat_without_order_info — If user send message from Open API, must satisfy " +
  "the following conditions: If 2 users have no existing conversation, the message " +
  "must contain order information between 2 users.";

const ok = () => ({ ok: true as const, data: {} });
const failure = (detail: string) => ({
  ok: false as const,
  retryable: false,
  ambiguous: false,
  detail,
});

test("demandsOrderContext recognises Shopee's first-chat rejection", () => {
  assert.equal(demandsOrderContext(FIRST_CHAT_ERROR), true);
});

test("demandsOrderContext ignores the contact-window rejection", () => {
  assert.equal(
    demandsOrderContext("Shopee rejected the chat call: user_is_forbidden — You can only message"),
    false,
  );
});

test("buildOrderCardBody addresses the buyer and carries the order_sn", () => {
  const body = buildOrderCardBody(RECIPIENT, ORDER_SN);
  assert.equal(body.to_id, 123456);
  assert.equal(body.message_type, "order");
  assert.deepEqual(body.content, { order_sn: ORDER_SN });
});

test("sends the text once and stops when Shopee accepts it", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const result = await sendWithOrderContext({
    orderSn: ORDER_SN,
    recipient: RECIPIENT,
    text: "your code is ready",
    send: async (body) => {
      sent.push(body);
      return ok();
    },
  });

  assert.equal(result.outcome.ok, true);
  assert.equal(result.usedOrderCard, false);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message_type, "text");
});

test("sends an order card and re-sends the text when Shopee demands order context", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const result = await sendWithOrderContext({
    orderSn: ORDER_SN,
    recipient: RECIPIENT,
    text: "your code is ready",
    send: async (body) => {
      sent.push(body);
      // Only the very first bare-text send is rejected, exactly as Shopee did.
      return sent.length === 1 ? failure(FIRST_CHAT_ERROR) : ok();
    },
  });

  assert.equal(result.outcome.ok, true, "the buyer should end up receiving the text");
  assert.equal(result.usedOrderCard, true);
  assert.deepEqual(
    sent.map((b) => b.message_type),
    ["text", "order", "text"],
    "order card must be sent between the failed text and the retry",
  );
  assert.deepEqual(sent[1].content, { order_sn: ORDER_SN });
});

test("does not send an order card for an unrelated rejection", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const result = await sendWithOrderContext({
    orderSn: ORDER_SN,
    recipient: RECIPIENT,
    text: "your code is ready",
    send: async (body) => {
      sent.push(body);
      return failure("Shopee rejected the chat call: user_is_forbidden — contact window");
    },
  });

  assert.equal(result.outcome.ok, false);
  assert.equal(result.usedOrderCard, false);
  assert.equal(sent.length, 1, "an unrelated failure must not trigger a second send");
});

test("reports the order card's own failure without retrying the text", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const result = await sendWithOrderContext({
    orderSn: ORDER_SN,
    recipient: RECIPIENT,
    text: "your code is ready",
    send: async (body) => {
      sent.push(body);
      return sent.length === 1
        ? failure(FIRST_CHAT_ERROR)
        : failure("Shopee rejected the chat call: param_error");
    },
  });

  assert.equal(result.outcome.ok, false);
  assert.deepEqual(sent.map((b) => b.message_type), ["text", "order"]);
  assert.match(
    result.outcome.ok === false ? result.outcome.detail : "",
    /order card/i,
    "the recorded reason must say the order card was the step that failed",
  );
});

test("never loops: a second first-chat rejection is not recovered again", async () => {
  const sent: Array<Record<string, unknown>> = [];
  const result = await sendWithOrderContext({
    orderSn: ORDER_SN,
    recipient: RECIPIENT,
    text: "your code is ready",
    // Shopee keeps demanding order context even after the card succeeded.
    send: async (body) => {
      sent.push(body);
      return body.message_type === "order" ? ok() : failure(FIRST_CHAT_ERROR);
    },
  });

  assert.equal(result.outcome.ok, false);
  assert.deepEqual(sent.map((b) => b.message_type), ["text", "order", "text"]);
});
