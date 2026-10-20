import assert from "node:assert/strict";
import test from "node:test";
import { parseFinancialNotification } from "../src/services/notification-import.service.ts";

const notification = (title, text) => ({
  key: "test-notification",
  title,
  text,
  packageName: "com.example.bank",
  postedAt: 1_800_000_000_000,
});

test("recognizes one explicit Brazilian-real expense amount", () => {
  const result = parseFinancialNotification(
    notification("Compra aprovada", "Compra aprovada no valor de R$ 25,90"),
  );

  assert.equal(result.amount, 25.9);
  assert.equal(result.type, "expense");
  assert.equal(result.reason, null);
});

test("recognizes a received Pix as income", () => {
  const result = parseFinancialNotification(
    notification("Pix recebido", "Você recebeu um Pix de R$ 150,00"),
  );

  assert.equal(result.amount, 150);
  assert.equal(result.type, "income");
  assert.equal(result.reason, null);
});

test("rejects a declined transaction even when it contains an amount", () => {
  const result = parseFinancialNotification(
    notification("Compra recusada", "Compra recusada de R$ 25,00"),
  );

  assert.equal(result.amount, null);
  assert.equal(result.isRejected, true);
  assert.equal(result.reason, "rejected");
});

test("marks notifications with multiple currency values as ambiguous", () => {
  const result = parseFinancialNotification(
    notification("Compra", "Compra de R$ 25,00. Saldo: R$ 120,00"),
  );

  assert.equal(result.amount, null);
  assert.equal(result.reason, "ambiguous");
});

test("marks an unlabelled balance amount as ambiguous", () => {
  const result = parseFinancialNotification(
    notification("Compra aprovada", "Compra de R$ 25,00. Saldo disponível 120,00"),
  );

  assert.equal(result.amount, null);
  assert.equal(result.reason, "ambiguous");
});

test("does not invent an amount when the notification has no currency value", () => {
  const result = parseFinancialNotification(
    notification("Compra aprovada", "Sua compra foi aprovada"),
  );

  assert.equal(result.amount, null);
  assert.equal(result.reason, "missing_amount");
});
