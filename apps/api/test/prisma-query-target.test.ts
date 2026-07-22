/**
 * Regression test for a real bug found live during Batch 4's load test:
 * see the docstring on parseQueryTarget in prisma.service.ts for the full
 * story (EXTRACT(EPOCH FROM ...) was mislabeling the db_query_duration
 * metric as model="respondedat" instead of the real table, or "unknown").
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseQueryTarget } from '../src/infra/prisma/prisma.service';

test('a normal Prisma-generated SELECT extracts the schema-qualified table', () => {
  const [model, action] = parseQueryTarget('SELECT "orders"."id" FROM "public"."orders" WHERE 1=1');
  assert.equal(model, 'orders');
  assert.equal(action, 'select');
});

test('an EXTRACT(EPOCH FROM ...) aggregate does not mistake EXTRACT\'s FROM for the table clause', () => {
  const [model] = parseQueryTarget(
    'SELECT AVG(EXTRACT(EPOCH FROM "respondedAt" - "offeredAt"))::float AS "avgSeconds" FROM order_dispatches',
  );
  assert.equal(model, 'order_dispatches', 'must find the real FROM clause, not EXTRACT\'s own FROM keyword');
});

test('a second EXTRACT(...) call in the same query is also stripped correctly', () => {
  const [model] = parseQueryTarget(
    'SELECT AVG(EXTRACT(EPOCH FROM h."createdAt" - o."createdAt"))::float AS "avgSeconds" FROM order_status_history h JOIN orders o ON o.id = h."orderId"',
  );
  assert.equal(model, 'order_status_history');
});

test('an INSERT statement is recognized', () => {
  const [model, action] = parseQueryTarget('INSERT INTO "public"."users" ("id") VALUES ($1)');
  assert.equal(model, 'users');
  assert.equal(action, 'insert');
});

test('an unparseable query falls back to "unknown" rather than guessing', () => {
  const [model, action] = parseQueryTarget('BEGIN');
  assert.equal(model, 'unknown');
  assert.equal(action, 'unknown');
});
