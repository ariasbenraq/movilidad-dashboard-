'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify_, buildQuery_ } = require('./Code.gs');

test('classify_ follows the spec table', () => {
  assert.equal(classify_(200), 'ok');
  assert.equal(classify_(204), 'ok');
  assert.equal(classify_(422), 'rejected');
  for (const s of [401, 403, 404]) assert.equal(classify_(s), 'fatal');
  for (const s of [500, 502, 503, 429, 408]) assert.equal(classify_(s), 'retry');
});

test('buildQuery_ excludes both labels and respects the start date', () => {
  const q = buildQuery_('2026/01/01');
  assert.match(q, /from:forms-receipts-noreply@google\.com/);
  assert.match(q, /-label:procesado/);
  assert.match(q, /-label:movilidad-error/);
  assert.match(q, /after:2026\/01\/01/);
});
