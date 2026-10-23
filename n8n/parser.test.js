'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseMovilidad, PARSER_VERSION } = require('./parser.js');

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');
const ALLOWED_KEYS = [
  'fecha_form',
  'costo_movilidad',
  'otros_gastos',
  'otros_detalle',
  'he_inicio',
  'he_fin',
  'workorder',
  'cliente',
  'tipo_traslado',
  'parser_version',
];

function readFixture(baseName) {
  return fs.readFileSync(path.join(FIXTURES_DIR, `${baseName}.txt`), 'utf8');
}

function readExpected(baseName) {
  return JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES_DIR, `${baseName}.expected.json`),
      'utf8',
    ),
  );
}

function discoverPairs() {
  let fileNames;

  try {
    fileNames = fs.readdirSync(FIXTURES_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return fileNames
    .map((fileName) => {
      const match = /^(\d{2}-.+)\.txt$/.exec(fileName);
      if (!match) {
        return null;
      }

      const baseName = match[1];
      const expectedName = `${baseName}.expected.json`;
      const hasExpected = fs.existsSync(path.join(FIXTURES_DIR, expectedName));

      return { baseName, fileName, hasExpected };
    })
    .filter(Boolean);
}

function replaceSection(text, startLabel, endLabel, body) {
  const start = text.indexOf(startLabel);
  assert.notEqual(start, -1, `test setup: missing start label ${startLabel}`);

  const bodyStart = start + startLabel.length;
  const end = text.indexOf(endLabel, bodyStart);
  assert.notEqual(end, -1, `test setup: missing end label ${endLabel}`);

  return `${text.slice(0, bodyStart)}\n\n${body}\n\n${text.slice(end)}`;
}

function assertErrorCode(text, expectedCode) {
  assert.throws(
    () => parseMovilidad(text),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.code, expectedCode);
      assert.ok(error.message.length > 0);
      return true;
    },
  );
}

const pairs = discoverPairs();
const orphanTextFiles = pairs
  .filter((pair) => !pair.hasExpected)
  .map((pair) => pair.fileName);
const validPairs = pairs.filter((pair) => pair.hasExpected);

test('fixtures contain at least one valid pair', () => {
  assert.ok(
    validPairs.length >= 1,
    'No valid fixture pairs found in fixtures/ (expected NN-name.txt + NN-name.expected.json)',
  );
});

test('every NN-*.txt fixture has a valid expected.json', () => {
  assert.deepEqual(
    orphanTextFiles,
    [],
    `Orphan fixture .txt files without expected.json: ${orphanTextFiles.join(', ')}`,
  );
});

for (const pair of validPairs) {
  test(`fixture ${pair.baseName}`, () => {
    const expected = readExpected(pair.baseName);
    const output = parseMovilidad(readFixture(pair.baseName));

    for (const [key, value] of Object.entries(expected)) {
      assert.deepEqual(
        output[key],
        value,
        `${pair.baseName}: unexpected ${key}`,
      );
    }
  });

  test(`contract ${pair.baseName}`, () => {
    const output = parseMovilidad(readFixture(pair.baseName));

    assert.deepEqual(
      Object.keys(output).sort(),
      [...ALLOWED_KEYS].sort(),
      `${pair.baseName}: output keys do not match the contract`,
    );
    assert.equal(output.parser_version, PARSER_VERSION);
    assert.equal(output.tipo_traslado, null);

    const serialized = JSON.stringify(output);
    const forbiddenValues = [
      'correo@example.com',
      'XXXXXXXX',
      'DIRECCION PARTIDA',
      'DIRECCION LLEGADA',
      'Sjm',
      'Pueblo Libre',
      'Chorrillos',
      'San Borja',
      'Surco',
      'Jesus María',
    ];

    for (const forbidden of forbiddenValues) {
      assert.ok(
        !serialized.includes(forbidden),
        `${pair.baseName}: output leaked personal data "${forbidden}"`,
      );
    }

    assert.ok(
      !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(serialized),
      `${pair.baseName}: output leaked an email address`,
    );
    assert.ok(
      !Object.keys(output).some((key) =>
        /legajo|correo|direccion|distrito|attachment/i.test(key),
      ),
      `${pair.baseName}: output contains a personal-data field`,
    );
  });
}

const fixturesAvailable = validPairs.length > 0;
const fixture03 = fixturesAvailable ? readFixture('03-costo-otros') : '';
const fixture02 = fixturesAvailable ? readFixture('02-costo-he') : '';
const fixture05 = fixturesAvailable ? readFixture('05-costo-hosp') : '';
const fixtureTest = fixturesAvailable ? test : test.skip;

fixtureTest('extracts the informational fields from the fixtures', () => {
  const cases = [
    {
      baseName: '01-costo',
      workorder: 'W610151086',
      cliente: 'BANCO DE CREDITO DEL PERU',
      otrosDetalle: null,
    },
    {
      baseName: '02-costo-he',
      workorder: 'W610081149',
      cliente: 'BANCO DE CREDITO DEL PERU',
      otrosDetalle: null,
    },
    {
      baseName: '03-costo-otros',
      workorder: 'W610052371',
      cliente: 'BANCO DE CREDITO DEL PERU',
      otrosDetalle: 'Isopos para mantenimiento de sensores',
    },
    {
      baseName: '04-costo-otros-he',
      workorder: 'W607311610',
      cliente: 'BANCO DE CREDITO DEL PERU',
      otrosDetalle: 'Enchufe + cable de poder',
    },
    {
      baseName: '05-costo-hosp',
      workorder: 'W607021502',
      cliente: 'BANCO DE CREDITO DEL PERU',
      otrosDetalle: null,
    },
  ];

  for (const expected of cases) {
    const output = parseMovilidad(readFixture(expected.baseName));
    assert.equal(
      output.workorder,
      expected.workorder,
      `${expected.baseName}: workorder`,
    );
    assert.equal(
      output.cliente,
      expected.cliente,
      `${expected.baseName}: cliente`,
    );
    assert.equal(
      output.otros_detalle,
      expected.otrosDetalle,
      `${expected.baseName}: otros_detalle`,
    );
  }
});

fixtureTest('handles CRLF line endings', () => {
  const output = parseMovilidad(fixture03.replace(/\n/g, '\r\n'));
  assert.deepEqual(output, parseMovilidad(fixture03));
});

fixtureTest('handles non-breaking spaces and tabs', () => {
  const withNbsp = fixture03.replace(/ /g, '\u00a0');
  const withTabs = fixture03.replace(/ {2,}/g, '\t');
  assert.deepEqual(parseMovilidad(withNbsp), parseMovilidad(fixture03));
  assert.deepEqual(parseMovilidad(withTabs), parseMovilidad(fixture03));
});

fixtureTest('accepts a decimal comma', () => {
  const text = replaceSection(
    fixture03,
    'Especificar COSTO DE MOVILIDAD',
    'Para taxi',
    '29,9',
  );
  assert.equal(parseMovilidad(text).costo_movilidad, 29.9);
});

fixtureTest('rounds half-up using decimal digits, not float toFixed', () => {
  const text = replaceSection(
    fixture03,
    'Especificar COSTO DE MOVILIDAD',
    'Para taxi',
    '12.345',
  );
  assert.equal(parseMovilidad(text).costo_movilidad, 12.35);
});

fixtureTest('blank overtime times become null', () => {
  let text = replaceSection(
    fixture02,
    'GENERACION DE HORAS H. EXTRA - Hora de inicio',
    'GENERACION DE HORAS H. EXTRA - Hora de final',
    'Hora\n\n:\n\n',
  );
  text = replaceSection(
    text,
    'GENERACION DE HORAS H. EXTRA - Hora de final',
    'MOTIVO de HORAS EXTRAS',
    'Hora\n\n:\n\n',
  );

  const output = parseMovilidad(text);
  assert.equal(output.he_inicio, null);
  assert.equal(output.he_fin, null);
});

fixtureTest('incomplete overtime (hour without minute) becomes null', () => {
  const text = replaceSection(
    fixture02,
    'GENERACION DE HORAS H. EXTRA - Hora de inicio',
    'GENERACION DE HORAS H. EXTRA - Hora de final',
    'Hora\n\n15\n\n:\n\n',
  );

  const output = parseMovilidad(text);
  assert.equal(output.he_inicio, null);
  assert.equal(output.he_fin, '16:30');
});

fixtureTest('out-of-range overtime becomes null', () => {
  const text = replaceSection(
    fixture02,
    'GENERACION DE HORAS H. EXTRA - Hora de inicio',
    'GENERACION DE HORAS H. EXTRA - Hora de final',
    'Hora\n\n25\n\n:\n\n30\n\n',
  );

  assert.equal(parseMovilidad(text).he_inicio, null);
});

fixtureTest('hospedaje amount is never read as otros_gastos', () => {
  const output = parseMovilidad(fixture05);
  assert.ok(fixture05.includes('4.5'));
  assert.equal(output.otros_gastos, 0);
  assert.equal(output.otros_detalle, null);
});

fixtureTest('absent otros_gastos becomes 0', () => {
  const text = readFixture('01-costo');
  assert.equal(parseMovilidad(text).otros_gastos, 0);
});

fixtureTest('present but empty otros_gastos becomes 0', () => {
  const text = replaceSection(
    fixture02,
    'Especificar MONTO DE OTROS GASTOS',
    'Especificar detalle de OTROS GASTOS',
    '',
  );
  assert.equal(parseMovilidad(text).otros_gastos, 0);
});

fixtureTest('absent costo_movilidad becomes 0', () => {
  const text = fixture03.replace(
    /Especificar COSTO DE MOVILIDAD[\s\S]*?(?=Para taxi)/,
    '',
  );
  assert.equal(parseMovilidad(text).costo_movilidad, 0);
});

fixtureTest('keeps a MISCELANEO workorder exactly as written', () => {
  const text = fixture05.replace('W607021502', 'MISCELANEO');
  assert.equal(parseMovilidad(text).workorder, 'MISCELANEO');
});

fixtureTest('throws MISSING_DATE when the FECHA FORMS block is absent', () => {
  const text = fixture03.replace(
    /Ingresar # FECHA FORMS \*[\s\S]*?(?=Seleccionar Legajo \*)/,
    '',
  );
  assertErrorCode(text, 'MISSING_DATE');
});

fixtureTest('throws INVALID_DATE for a real-looking but impossible date', () => {
  const text = replaceSection(
    fixture03,
    'Ingresar # FECHA FORMS *',
    'Seleccionar Legajo *',
    'DD\n\n31\n\n/\n\nMM\n\n02\n\n/\n\nAAAA\n\n2026',
  );
  assertErrorCode(text, 'INVALID_DATE');
});

fixtureTest('throws INVALID_AMOUNT for non-numeric amount content', () => {
  const text = replaceSection(
    fixture03,
    'Especificar COSTO DE MOVILIDAD',
    'Para taxi',
    'abc',
  );
  assertErrorCode(text, 'INVALID_AMOUNT');
});

fixtureTest('throws INVALID_AMOUNT for ambiguous thousands separators', () => {
  for (const value of ['1,234.50', '1.234,50']) {
    const text = replaceSection(
      fixture03,
      'Especificar COSTO DE MOVILIDAD',
      'Para taxi',
      value,
    );
    assertErrorCode(text, 'INVALID_AMOUNT');
  }
});
