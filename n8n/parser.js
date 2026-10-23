'use strict';

const PARSER_VERSION = '1.0.0';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function parserError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ');
}

function cleanLine(line) {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*\*+\s*$/, '')
    .trim();
}

function prepareLines(text) {
  return normalizeText(text)
    .split('\n')
    .map(cleanLine)
    .filter((line) => line.length > 0);
}

function normalizeForMatch(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findLabelIndex(lines, fragment, fromIndex) {
  const needle = normalizeForMatch(fragment);
  const start = fromIndex === undefined ? 0 : fromIndex;

  for (let index = start; index < lines.length; index += 1) {
    if (normalizeForMatch(lines[index]).includes(needle)) {
      return index;
    }
  }

  return -1;
}

function blockAfterLabel(lines, labelFragment, endFragment) {
  const start = findLabelIndex(lines, labelFragment);

  if (start === -1) {
    return null;
  }

  const end = findLabelIndex(lines, endFragment, start + 1);
  return lines.slice(start + 1, end === -1 ? lines.length : end);
}

function firstValue(block) {
  if (!block || block.length === 0) {
    return null;
  }

  return block[0].trim();
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function parseDate(block) {
  if (!block) {
    throw parserError('MISSING_DATE', 'FECHA FORMS block was not found');
  }

  const dateText = block.join(' ').replace(/\b(DD|MM|AAAA)\b/gi, ' ');
  const tokens = dateText.match(/\d+/g) || [];

  if (tokens.length < 3) {
    throw parserError('MISSING_DATE', 'FECHA FORMS does not contain a date');
  }

  const [dayToken, monthToken, yearToken] = tokens;
  const day = Number(dayToken);
  const month = Number(monthToken);
  const year = Number(yearToken);

  if (
    dayToken.length > 2 ||
    monthToken.length > 2 ||
    yearToken.length !== 4 ||
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12
  ) {
    throw parserError('INVALID_DATE', 'FECHA FORMS is not a valid date');
  }

  const maxDay =
    month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];

  if (day < 1 || day > maxDay) {
    throw parserError('INVALID_DATE', 'FECHA FORMS is not a valid date');
  }

  return `${yearToken}-${pad2(month)}-${pad2(day)}`;
}

function parseAmount(rawValue, fieldName) {
  const value = rawValue.trim();
  const pattern = /^[+-]?\d+(?:[.,]\d+)?$/;

  if (!pattern.test(value)) {
    throw parserError(
      'INVALID_AMOUNT',
      `${fieldName} contains non-numeric content: "${value}"`,
    );
  }

  const sign = value.startsWith('-') ? -1 : 1;
  const unsigned = value.replace(/^[+-]/, '');
  const separators = unsigned.match(/[.,]/g) || [];

  if (separators.length > 1) {
    throw parserError(
      'INVALID_AMOUNT',
      `${fieldName} uses an ambiguous thousands separator: "${value}"`,
    );
  }

  const separator = separators[0] || '';
  const parts = separator ? unsigned.split(separator) : [unsigned, ''];
  const integerPart = parts[0];
  const fractionPart = parts[1] || '';

  if (
    separator === ',' &&
    fractionPart.length >= 3 &&
    integerPart.length <= 3
  ) {
    throw parserError(
      'INVALID_AMOUNT',
      `${fieldName} uses an ambiguous thousands separator: "${value}"`,
    );
  }

  const centsPart = `${fractionPart}00`.slice(0, 2);
  let cents = Number(integerPart) * 100 + Number(centsPart);

  if ((fractionPart[2] || '0') >= '5') {
    cents += 1;
  }

  return (sign * cents) / 100;
}

function readAmount(block, fieldName, fallback) {
  const value = firstValue(block);

  if (value === null) {
    return fallback;
  }

  return parseAmount(value, fieldName);
}

function parseTime(block) {
  if (!block) {
    return null;
  }

  const timeText = block.join(' ');
  const match = timeText.match(/(\d{1,2})\s*:\s*(\d{1,2})/);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${pad2(hours)}:${pad2(minutes)}`;
}

function parseMovilidad(text) {
  const lines = prepareLines(text);

  const fechaBlock = blockAfterLabel(
    lines,
    'FECHA FORMS',
    'Seleccionar Legajo',
  );
  const costoBlock = blockAfterLabel(
    lines,
    'Especificar COSTO DE MOVILIDAD',
    'Para taxi',
  );
  const otrosGastosBlock = blockAfterLabel(
    lines,
    'Especificar MONTO DE OTROS GASTOS',
    'Especificar detalle de OTROS GASTOS',
  );
  const otrosDetalleBlock = blockAfterLabel(
    lines,
    'Especificar detalle de OTROS GASTOS',
    'Adjuntar Boleta o factura de OTROS GASTOS',
  );
  const heInicioBlock = blockAfterLabel(
    lines,
    'GENERACION DE HORAS H. EXTRA - Hora de inicio',
    'GENERACION DE HORAS H. EXTRA - Hora de final',
  );
  const heFinBlock = blockAfterLabel(
    lines,
    'GENERACION DE HORAS H. EXTRA - Hora de final',
    'MOTIVO de HORAS EXTRAS',
  );
  const workorderBlock = blockAfterLabel(
    lines,
    'Ingresar la Workorder',
    'Descripcion del Servicio',
  );
  const clienteBlock = blockAfterLabel(
    lines,
    'Seleccionar CLIENTE',
    'Tipo de traslado',
  );

  return {
    fecha_form: parseDate(fechaBlock),
    costo_movilidad: readAmount(costoBlock, 'costo_movilidad', 0),
    otros_gastos: readAmount(otrosGastosBlock, 'otros_gastos', null),
    otros_detalle: firstValue(otrosDetalleBlock),
    he_inicio: parseTime(heInicioBlock),
    he_fin: parseTime(heFinBlock),
    workorder: firstValue(workorderBlock),
    cliente: firstValue(clienteBlock),
    tipo_traslado: null,
    parser_version: PARSER_VERSION,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseMovilidad, PARSER_VERSION };
}
