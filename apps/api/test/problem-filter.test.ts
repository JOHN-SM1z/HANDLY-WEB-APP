/**
 * Regression test for a real bug found during Batch 4's rate-limiting work:
 * @fastify/rate-limit throws a plain `Error` with a `statusCode` property
 * (not a NestJS HttpException) when a client is throttled. Before this fix,
 * ProblemExceptionFilter only read status off HttpException instances, so a
 * 429 was flattened into a misleading 500 (and wrongly sent to error
 * monitoring as an "unexpected" server error). Confirmed live via curl
 * against a real rate-limited request before applying the fix.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ProblemExceptionFilter } from '../src/common/http/problem.filter';

function makeHost() {
  const state = { status: 0, headers: {} as Record<string, string>, body: undefined as unknown };
  const reply = {
    status(code: number) {
      state.status = code;
      return this;
    },
    header(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    send(body: unknown) {
      state.body = body;
      return this;
    },
  };
  const request = { method: 'GET', url: '/api/v1/categories' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, state };
}

test('a plain Error with a numeric statusCode (e.g. @fastify/rate-limit) maps to that status, not 500', () => {
  const filter = new ProblemExceptionFilter();
  const { host, state } = makeHost();
  const err = new Error('Rate limit exceeded, retry in 42 seconds') as Error & { statusCode: number };
  err.statusCode = 429;

  filter.catch(err, host);

  assert.equal(state.status, 429);
  const body = state.body as { status: number; detail?: string; title: string };
  assert.equal(body.status, 429);
  assert.equal(body.detail, 'Rate limit exceeded, retry in 42 seconds');
  assert.equal(body.title, 'TOO MANY REQUESTS');
});

test('a plain Error with no statusCode still defaults to 500 and redacts detail', () => {
  const filter = new ProblemExceptionFilter();
  const { host, state } = makeHost();
  const err = new Error('some internal detail that must not leak');

  filter.catch(err, host);

  assert.equal(state.status, 500);
  const body = state.body as { status: number; detail?: string; title: string };
  assert.equal(body.status, 500);
  assert.equal(body.detail, undefined, 'internal error details must never reach the client');
  assert.equal(body.title, 'Internal Server Error');
});

test('an out-of-range statusCode value (e.g. 0 or 700) is ignored, not trusted blindly', () => {
  const filter = new ProblemExceptionFilter();
  const { host, state } = makeHost();
  const err = new Error('weird') as Error & { statusCode: number };
  err.statusCode = 999;

  filter.catch(err, host);

  assert.equal(state.status, 500, 'an implausible statusCode must not be passed through verbatim');
});

test('a real NestJS HttpException still maps to its own status (unaffected by the fix)', () => {
  const filter = new ProblemExceptionFilter();
  const { host, state } = makeHost();
  filter.catch(new BadRequestException('bad input'), host);

  assert.equal(state.status, 400);
  const body = state.body as { status: number; detail?: string };
  assert.equal(body.detail, 'bad input');
});
