import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationReview } from "../src/services/notification-review.service.ts";
import { interpretBankNotification } from "../src/notifications/bank-notification-engine.ts";

const stamp = 1_800_000_000_000;
function fixture(text = "Pix enviado de R$ 12,34") {
  const row = { localId: "event-1", source: "com.walletai.notificationfixture", state: "received",
    postedAt: stamp, receivedAt: stamp, busy: false, readError: false, summary: null };
  let payload = JSON.stringify({ title: "TESTE", text, truncated: false });
  let owner = null;
  let completions = 0;
  let rawReads = 0;
  let failCommit = false;
  const bridge = {
    listNotificationReview: async () => [{ ...row }],
    reserveNotificationReview: async (id, readContent) => {
      if (owner || id !== row.localId) return null;
      owner = "owner-token";
      if (readContent) rawReads++;
      return { ...row, leaseToken: owner, rawPayload: readContent ? payload : null };
    },
    completeNotificationReview: async (id, token, summary) => {
      if (owner !== token || failCommit) return false;
      completions++;
      if (summary !== null) { row.summary = summary; row.state = "pending"; }
      owner = null;
      return true;
    },
    discardNotificationReview: async (id, token) => {
      if (owner !== token) return false;
      row.state = "ignored"; payload = null; owner = null;
      return true;
    },
  };
  return { bridge, row, review: createNotificationReview(bridge, interpretBankNotification),
    completions: () => completions, rawReads: () => rawReads, owner: () => owner,
    payload: (value) => { payload = value; }, failCommit: () => { failCommit = true; } };
}

test("review list interprets new events through the existing engine and stores only the summary", async () => {
  const f = fixture();
  const result = await f.review.list();
  assert.equal(result.items[0].summary.amountCents, 1234);
  assert.equal(result.items[0].summary.operation, "pix");
  assert.equal(result.items[0].summary.direction, "outgoing");
  assert.equal(f.row.state, "pending");
  assert.equal(f.owner(), null);
  assert.equal("leaseToken" in result.items[0], false);
  assert.equal("text" in result.items[0], false);
  assert.equal("description" in JSON.parse(f.row.summary), false);
});
test("review of already interpreted summaries is read-only and does not reserve or decrypt raw text", async () => {
  const f = fixture();
  await f.review.list();
  const reads = f.rawReads(), completions = f.completions();
  await f.review.list();
  assert.equal(f.rawReads(), reads);
  assert.equal(f.completions(), completions);
});
test("review detail returns raw content only after reservation and never exposes the lease token", async () => {
  const f = fixture();
  const detail = await f.review.detail("event-1");
  assert.equal(detail.text, "Pix enviado de R$ 12,34");
  assert.equal(detail.summary.amountCents, 1234);
  assert.equal("leaseToken" in detail, false);
  assert.equal(f.owner(), null);
});
test("review ambiguous and truncated notifications never invent amounts, accounts or categories", async () => {
  for (const [text, truncated] of [["Pix enviado de R$ 10,00. Saldo R$ 50,00", false], ["Pix enviado de R$ 10,00", true]]) {
    const f = fixture(text);
    f.payload(JSON.stringify({ title: "TESTE", text, truncated }));
    const result = await f.review.detail("event-1");
    assert.equal(result.summary.amountCents, null);
    assert.equal(result.summary.status, "pending");
    assert.equal("accountId" in result.summary, false);
    assert.equal("categoryId" in result.summary, false);
  }
});
test("review interpreter failure releases the lease and leaves the event available", async () => {
  const f = fixture();
  const broken = createNotificationReview(f.bridge, () => { throw new Error("parser failure"); });
  await assert.rejects(broken.detail("event-1"));
  assert.equal(f.owner(), null);
  assert.equal(f.row.summary, null);
  assert.equal((await f.review.detail("event-1")).summary.amountCents, 1234);
});
test("review failed or expired completion never reports a successful interpretation", async () => {
  const f = fixture(); f.failCommit();
  await assert.rejects(f.review.detail("event-1"));
  assert.equal(f.row.summary, null);
});
test("review discard obtains a lease without decrypting content and clears only the selected event", async () => {
  const f = fixture();
  await f.review.discard("event-1");
  assert.equal(f.row.state, "ignored");
  assert.equal(f.rawReads(), 0);
});
test("review concurrent clients cannot interpret a reserved event twice", async () => {
  const f = fixture();
  let release;
  f.bridge.completeNotificationReview = () => new Promise((resolve) => { release = resolve; });
  const first = f.review.detail("event-1");
  await new Promise((resolve) => setImmediate(resolve));
  const other = createNotificationReview(f.bridge, interpretBankNotification);
  await assert.rejects(other.detail("event-1"));
  release(true); await first;
  assert.equal(f.rawReads(), 1);
});
test("review cached interpretation remains available after raw text expires", async () => {
  const f = fixture(); await f.review.list(); f.payload(null);
  assert.equal((await f.review.detail("event-1")).summary.amountCents, 1234);
});

test("review retains malformed or unreadable events and never leaks native extra fields", async () => {
  const f = fixture();
  f.row.summary = "invalid-json";
  f.row.leaseToken = "not-for-list";
  f.row.rawPayload = "not-for-list";
  const page = await f.review.list();
  assert.equal(page.items[0].readError, true);
  assert.equal("leaseToken" in page.items[0], false);
  assert.equal("rawPayload" in page.items[0], false);
  assert.equal(f.row.summary, "invalid-json");
  assert.equal(f.rawReads(), 0);
  f.row.summary = null;
  f.payload("invalid-json");
  await assert.rejects(f.review.detail("event-1"));
  assert.equal(f.owner(), null);
  f.row.readError = true;
  await assert.rejects(f.review.detail("event-1"));
  assert.equal(f.row.state, "received");
});

test("review identifies incoming Pix, debit and credit without assigning financial accounts", async () => {
  for (const [text, operation, direction, cents] of [
    ["Pix recebido de R$ 56,78", "pix", "incoming", 5678],
    ["Compra aprovada no débito de R$ 23,45", "debit_purchase", "outgoing", 2345],
    ["Compra aprovada no cartão de crédito de R$ 67,89", "credit_purchase", "outgoing", 6789],
  ]) {
    const f = fixture(text);
    const detail = await f.review.detail("event-1");
    assert.equal(detail.summary.operation, operation);
    assert.equal(detail.summary.direction, direction);
    assert.equal(detail.summary.amountCents, cents);
    assert.equal(detail.summary.date, "2027-01-15T08:00:00.000Z");
    assert.equal("accountId" in detail, false);
  }
});

test("review old or unavailable bridges cannot read or discard events", async () => {
  for (const bridge of [null, {}, { listNotificationReview: async () => [] }]) {
    const review = createNotificationReview(bridge, interpretBankNotification);
    assert.equal(review.available, false);
    await assert.rejects(review.list());
    await assert.rejects(review.detail("event-1"));
    await assert.rejects(review.discard("event-1"));
  }
});

test("review retains explicit wallet method/channel and refunds in its encrypted structured summary", async () => {
  for (const [text, operation, method, channel] of [
    ["Compra aprovada no débito por aproximação de R$ 23,45", "debit_purchase", "debit", "contactless"],
    ["Estorno realizado de R$ 23,45", "refund", null, null],
  ]) {
    const f = fixture(text);
    const detail = await f.review.detail("event-1");
    assert.equal(detail.summary.operation, operation);
    assert.equal(detail.summary.paymentMethod, method);
    assert.equal(detail.summary.paymentChannel, channel);
    assert.equal(JSON.parse(f.row.summary).paymentChannel, channel);
    const reads = f.rawReads();
    const list = await f.review.list();
    assert.equal(list.items[0].summary.operation, operation);
    assert.equal(f.rawReads(), reads);
  }
});

test("review reads old encrypted summaries and rejects arbitrary new metadata", async () => {
  const f = fixture();
  await f.review.detail("event-1");
  const old = JSON.parse(f.row.summary);
  delete old.paymentMethod; delete old.paymentChannel;
  f.row.summary = JSON.stringify(old);
  const reads = f.rawReads();
  const legacy = await f.review.list();
  assert.equal(legacy.items[0].summary.paymentChannel, null);
  assert.equal(legacy.items[0].summary.paymentMethod, null);
  assert.equal(f.rawReads(), reads);
  f.row.summary = JSON.stringify({ ...old, paymentChannel: "invented" });
  assert.equal((await f.review.list()).items[0].readError, true);
});

test("review never re-exposes credential content from an older captured event", async () => {
  const f = fixture("Seu código de segurança é 123456. Não compartilhe.");
  const detail = await f.review.detail("event-1");
  assert.equal(detail.summary.reason, "sensitive_content");
  assert.equal(detail.title, null);
  assert.equal(detail.text, null);
});
