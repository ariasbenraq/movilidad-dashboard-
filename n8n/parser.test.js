'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse, PARSER_VERSION } = require('./parser.js');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const cases = fs
  .readdirSync(FIXTURES)
  .filter((f) => /^\d+-.*\.txt$/.test(f))
  .map((f) => f.replace(/\.txt$/, ''));

for (const name of cases) {
  test(`fixture ${name}`, () => {
    const { parser_version, ...fields } = parse(read(`${name}.txt`));
    assert.equal(parser_version, PARSER_VERSION);
    assert.deepEqual(
      fields,
      JSON.parse(read(`${name}.expected.json`)),
    );
  });
}

const base = () => read('01-costo.txt');

test('hospedaje amount is not mistaken for otros gastos', () => {
  const r = parse(read('05-costo-hosp.txt'));
  assert.equal(r.otros_gastos, null);
  assert.equal(r.costo_movilidad, 8.2);
});

test('movilidad start time is not read as overtime', () => {
  const r = parse(read('01-costo.txt'));
  assert.equal(r.he_inicio, null);
  assert.equal(r.he_fin, null);
});

test('blank and incomplete overtime hours become null', () => {
  const r = parse(read('05-costo-hosp.txt'));
  assert.equal(r.he_inicio, null);
  const half = read('04-costo-otros-he.txt').replace(
    /(Hora de final\s+Hora\s+)18(\s+:\s+)30/,
    '$1$2',
  );
  const p = parse(half);
  assert.equal(p.he_inicio, '17:00');
  assert.equal(p.he_fin, null);
});

test('tabs, trailing spaces and CRLF do not matter', () => {
  const messy = base()
    .replace(/\r?\n/g, '\r\n')
    .replace(/^(\d+)$/gm, '\t$1  ');
  assert.equal(parse(messy).fecha_form, '2026-10-21');
  assert.equal(parse(messy).costo_movilidad, 23.9);
});

test('amount formats', () => {
  const withCost = (v) => base().replace(/^23\.9$/m, v);
  assert.equal(parse(withCost('23,90')).costo_movilidad, 23.9);
  assert.equal(parse(withCost('S/ 23.90')).costo_movilidad, 23.9);
  assert.equal(parse(withCost('1,234.50')).costo_movilidad, 1234.5);
  assert.equal(parse(withCost('23.456')).costo_movilidad, 23.46);
});

test('empty cost label gives null', () => {
  assert.equal(parse(base().replace(/^23\.9$/m, '')).costo_movilidad, null);
});

test('MISCELANEO workorder is kept as is', () => {
  assert.equal(
    parse(base().replace('W610151086', 'MISCELANEO')).workorder,
    'MISCELANEO',
  );
});

test('throws when the date is missing', () => {
  const noDate = base().replace(/DD\s+21\s+\/\s+MM\s+10\s+\/\s+AAAA\s+2026/, '');
  assert.throws(() => parse(noDate), /fecha_form/);
});

test('throws when the date does not exist', () => {
  assert.throws(() => parse(base().replace(/^21$/m, '31').replace(/^10$/m, '02')), /fecha_form/);
});

test('throws on a non-numeric amount', () => {
  assert.throws(
    () => parse(base().replace(/^23\.9$/m, 'veinte soles')),
    /costo_movilidad/,
  );
});

test('throws on an empty or non-string body', () => {
  assert.throws(() => parse(''), /body/);
  assert.throws(() => parse(undefined), /body/);
});

test('workflow.json embeds parser.js unchanged', () => {
  const wf = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'workflow.json'), 'utf8'),
  );
  const code = wf.nodes.find((n) => n.name === 'Parser').parameters.jsCode;
  assert.ok(
    code.startsWith(fs.readFileSync(path.join(__dirname, 'parser.js'), 'utf8')),
  );
});
