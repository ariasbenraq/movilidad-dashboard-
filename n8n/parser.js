'use strict';

// Pure function: plain-text body of the Google Forms receipt in, JSON out.
// No dependencies; the file is pasted unchanged into the n8n Code node.

const PARSER_VERSION = '1.0.0';

// Every label that can follow a value. A value ends at the next one of these.
const LABELS = [
  /^Formularios de Google/i,
  /^Ingresar # FECHA FORMS/i,
  /^Seleccionar Legajo/i,
  /^Tipo Transporte/i,
  /^Especificar DISTRITO/i,
  /^Especificar Direcci[oó]n/i,
  /^Especificar HORA INICIO/i,
  /^SELECCIONAR TIPOS DE GASTOS/i,
  /^GASTOS MOVILIDAD ASOCIADO/i,
  /^Ingresar la Workorder/i,
  /^Descripci[oó]n del Servicio/i,
  /^Seleccionar STATUS/i,
  /^Ingresar # INFORME/i,
  /^¿Tipo de atenci[oó]n/i,
  /^Seleccionar CLIENTE/i,
  /^Tipo de traslado/i,
  /^Especificar COSTO DE MOVILIDAD/i,
  /^Para taxi/i,
  /^Archivos enviados/i,
  /^Ning[uú]n archivo/i,
  /^SOLO PARA TRASLADO/i,
  /^TIENES OTROS GASTOS/i,
  /^GASTOS DE HOSPEDAJE/i,
  /^ESPECIFICAR MONTO DEL GASTO/i,
  /^Adjuntar Boleta/i,
  /^Especificar MONTO DE OTROS GASTOS/i,
  /^Especificar detalle de OTROS GASTOS/i,
  /^GENERACION DE HORAS H\. EXTRA/i,
  /^MOTIVO de HORAS EXTRAS/i,
  /^M[uú]ltiple Atenci[oó]n/i,
  /^Especificar las WORKORDERS/i,
  /^Crea tu propio formulario/i,
];

const L_FECHA = /^Ingresar # FECHA FORMS/i;
const L_COSTO = /^Especificar COSTO DE MOVILIDAD/i;
const L_OTROS_MONTO = /^Especificar MONTO DE OTROS GASTOS/i;
const L_OTROS_DETALLE = /^Especificar detalle de OTROS GASTOS/i;
const L_HE_INICIO = /^GENERACION DE HORAS H\. EXTRA\s*-\s*Hora de inicio/i;
const L_HE_FIN = /^GENERACION DE HORAS H\. EXTRA\s*-\s*Hora de final/i;
const L_WORKORDER = /^Ingresar la Workorder/i;
const L_CLIENTE = /^Seleccionar CLIENTE/i;

function isLabel(line) {
  return LABELS.some((re) => re.test(line));
}

// Lines of the section that follows the first line matching `label`,
// up to the next known label. Lone "*" (required marker) lines are dropped.
function section(lines, label) {
  const start = lines.findIndex((line) => label.test(line));
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (isLabel(lines[i])) break;
    if (lines[i] !== '*') out.push(lines[i]);
  }
  return out;
}

function short(text) {
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

function parseDate(lines) {
  const sec = section(lines, L_FECHA);
  if (!sec) throw new Error('fecha_form: label not found');
  const m = /DD\s+(\d{1,2})\s+\/\s+MM\s+(\d{1,2})\s+\/\s+AAAA\s+(\d{4})/.exec(
    sec.join(' '),
  );
  if (!m) throw new Error('fecha_form: day, month or year missing');
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new Error('fecha_form: not a valid calendar date');
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Missing label or empty value -> null (the backend reads null as 0).
function parseAmount(lines, label, name) {
  const sec = section(lines, label);
  if (!sec) return null;
  const raw = sec.find((line) => line !== '');
  if (raw === undefined) return null;
  const text = raw.replace(/^S\/\.?\s*/i, '').replace(/\s+/g, '');
  let normalized;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    normalized = text.replace(/,/g, '');
  } else if (/^\d+([.,]\d+)?$/.test(text)) {
    normalized = text.replace(',', '.');
  } else {
    throw new Error(`${name}: not a number ("${short(raw)}")`);
  }
  return Math.round(Number(normalized) * 100) / 100;
}

// "Hora / 17 / : / 00" -> "17:00". Blank or incomplete -> null.
function parseTime(lines, label, name) {
  const sec = section(lines, label);
  if (!sec) return null;
  const m = /Hora\s+(\d{1,2})\s*:\s*(\d{1,2})/.exec(sec.join(' '));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`${name}: time out of range`);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function parseText(lines, label) {
  const sec = section(lines, label);
  if (!sec) return null;
  const text = sec.filter((line) => line !== '').join(' ').trim();
  return text === '' ? null : text;
}

function parse(body) {
  if (typeof body !== 'string' || body.trim() === '') {
    throw new Error('body: empty or not text');
  }
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim());

  return {
    fecha_form: parseDate(lines),
    costo_movilidad: parseAmount(lines, L_COSTO, 'costo_movilidad'),
    otros_gastos: parseAmount(lines, L_OTROS_MONTO, 'otros_gastos'),
    otros_detalle: parseText(lines, L_OTROS_DETALLE),
    he_inicio: parseTime(lines, L_HE_INICIO, 'he_inicio'),
    he_fin: parseTime(lines, L_HE_FIN, 'he_fin'),
    workorder: parseText(lines, L_WORKORDER),
    cliente: parseText(lines, L_CLIENTE),
    // The receipt lists every option, not only the chosen one.
    tipo_traslado: null,
    parser_version: PARSER_VERSION,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parse, PARSER_VERSION };
}
