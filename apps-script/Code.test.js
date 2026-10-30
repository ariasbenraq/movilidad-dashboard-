'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify_, pickPlainText_, buildQuery_, padBase64_ } = require('./Code.gs');

test('classify_ follows the spec table', () => {
  assert.equal(classify_(200), 'ok');
  assert.equal(classify_(204), 'ok');
  assert.equal(classify_(422), 'rejected');
  for (const s of [401, 403, 404]) assert.equal(classify_(s), 'fatal');
  for (const s of [500, 502, 503, 429, 408]) assert.equal(classify_(s), 'retry');
});

test('pickPlainText_ finds the text part in nested multiparts', () => {
  const payload = {
    mimeType: 'multipart/alternative',
    parts: [
      { mimeType: 'text/html', body: { data: 'html' } },
      {
        mimeType: 'multipart/mixed',
        parts: [{ mimeType: 'text/plain', body: { data: 'abc' } }],
      },
    ],
  };
  assert.equal(pickPlainText_(payload, (d) => d.toUpperCase()), 'ABC');
});

test('pickPlainText_ returns null without a text part', () => {
  assert.equal(pickPlainText_({ mimeType: 'text/html', body: { data: 'x' } }, String), null);
  assert.equal(pickPlainText_(null, String), null);
});

test('buildQuery_ excludes both labels and respects the start date', () => {
  const q = buildQuery_('2026/01/01');
  assert.match(q, /from:forms-receipts-noreply@google\.com/);
  assert.match(q, /-label:procesado/);
  assert.match(q, /-label:movilidad-error/);
  assert.match(q, /after:2026\/01\/01/);
});

test('padBase64_ restores the padding Gmail strips', () => {
  for (const text of ['a', 'ab', 'abc', 'abcd', 'Gracias por rellenar este formulario: ñandú']) {
    const b64 = Buffer.from(text, 'utf8').toString('base64url'); // no padding
    const padded = padBase64_(b64);
    assert.equal(padded.length % 4, 0);
    assert.equal(Buffer.from(padded, 'base64url').toString('utf8'), text);
  }
});
