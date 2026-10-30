// Transport only: finds Google Forms receipts in Gmail and POSTs them to the
// n8n webhook. Parsing and business rules live elsewhere.
//
// Script properties (Project settings > Script properties):
//   WEBHOOK_URL     https://n8n.example.com/webhook/movilidad
//   WEBHOOK_SECRET  value of the n8n credential header x-webhook-secret
//   DESDE           optional, YYYY/MM/DD, oldest email to process (default 2026/01/01)

const FROM = 'forms-receipts-noreply@google.com';
const SUBJECT = 'FORMULARIO GASTOS DE MOVILIDAD';
const LABEL_OK = 'procesado';
const LABEL_ERROR = 'movilidad-error';
const DEFAULT_DESDE = '2026/01/01';
const TIMEZONE = 'America/Lima';
const MAX_RUNTIME_MS = 4 * 60 * 1000;
const MAX_CONSECUTIVE_RETRIES = 3;

/** Outcome of a webhook response: ok | rejected | fatal | retry. */
function classify_(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 422) return 'rejected';
  // Bad secret or wrong URL: retrying every minute will not fix it.
  if (status === 401 || status === 403 || status === 404) return 'fatal';
  return 'retry';
}

/** First text/plain part of a Gmail API payload, or null. */
function pickPlainText_(payload, decode) {
  if (!payload) return null;
  if (payload.mimeType === 'text/plain' && payload.body && payload.body.data) {
    return decode(payload.body.data);
  }
  for (const part of payload.parts || []) {
    const text = pickPlainText_(part, decode);
    if (text !== null) return text;
  }
  return null;
}

function buildQuery_(desde) {
  return (
    'from:' + FROM +
    ' subject:"' + SUBJECT + '"' +
    ' -label:' + LABEL_OK +
    ' -label:' + LABEL_ERROR +
    ' after:' + desde
  );
}

function decode_(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');
}

function config_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');
  const desde = props.getProperty('DESDE') || DEFAULT_DESDE;
  if (!url || !secret) {
    throw new Error('Faltan las propiedades WEBHOOK_URL y/o WEBHOOK_SECRET');
  }
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(desde)) {
    throw new Error('DESDE debe tener el formato YYYY/MM/DD');
  }
  return { url: url, secret: secret, desde: desde };
}

function ensureLabel_(name) {
  const existing = Gmail.Users.Labels.list('me').labels.find(function (l) {
    return l.name === name;
  });
  if (existing) return existing.id;
  return Gmail.Users.Labels.create({ name: name }, 'me').id;
}

function post_(cfg, messageId, receivedAt, body) {
  const response = UrlFetchApp.fetch(cfg.url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': cfg.secret },
    payload: JSON.stringify({ messageId: messageId, receivedAt: receivedAt, body: body }),
    muteHttpExceptions: true,
  });
  return response.getResponseCode();
}

/** Returns 'ok' | 'rejected' | 'fatal' | 'retry' and labels the message. */
function handleMessage_(id, cfg, labelIds) {
  const message = Gmail.Users.Messages.get('me', id, { format: 'full' });
  const body = pickPlainText_(message.payload, decode_);
  const receivedAt = Utilities.formatDate(
    new Date(Number(message.internalDate)),
    TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ssXXX"
  );

  let outcome;
  let status = 'sin-respuesta';
  if (body === null) {
    outcome = 'rejected'; // nothing to parse; do not retry forever
    status = 'sin-texto';
  } else {
    try {
      status = post_(cfg, id, receivedAt, body);
      outcome = classify_(status);
    } catch (e) {
      outcome = 'retry'; // network error
    }
  }
  console.log(id + ' -> ' + status + ' (' + outcome + ')');

  const label = outcome === 'ok' ? labelIds.ok : outcome === 'rejected' ? labelIds.error : null;
  if (label) {
    Gmail.Users.Messages.modify({ addLabelIds: [label] }, 'me', id);
  }
  return outcome;
}

function run_() {
  const cfg = config_();
  const labelIds = { ok: ensureLabel_(LABEL_OK), error: ensureLabel_(LABEL_ERROR) };
  const query = buildQuery_(cfg.desde);
  const started = Date.now();
  const seen = {};
  let retries = 0;

  while (Date.now() - started < MAX_RUNTIME_MS) {
    // Labeled messages drop out of the search, so always read the first page.
    const page = Gmail.Users.Messages.list('me', { q: query, maxResults: 50 }).messages || [];
    const fresh = page.filter(function (m) { return !seen[m.id]; });
    if (fresh.length === 0) return;

    for (const ref of fresh) {
      if (Date.now() - started >= MAX_RUNTIME_MS) return;
      seen[ref.id] = true;
      const outcome = handleMessage_(ref.id, cfg, labelIds);
      if (outcome === 'fatal') {
        throw new Error('El webhook rechazo la peticion (401/403/404). Revisa WEBHOOK_URL y WEBHOOK_SECRET.');
      }
      retries = outcome === 'retry' ? retries + 1 : 0;
      if (retries >= MAX_CONSECUTIVE_RETRIES) return; // n8n or backend down; next run retries
    }
  }
}

/** Entry point of the 1-minute trigger. */
function procesar() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // previous run still going
  try {
    run_();
  } finally {
    lock.releaseLock();
  }
}

/** Run once by hand to (re)create the 1-minute trigger. */
function instalarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'procesar') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('procesar').timeBased().everyMinutes(1).create();
}

/** Run by hand: processes at most the first pending email, to check the setup. */
function probarUno() {
  const cfg = config_();
  const labelIds = { ok: ensureLabel_(LABEL_OK), error: ensureLabel_(LABEL_ERROR) };
  const page = Gmail.Users.Messages.list('me', { q: buildQuery_(cfg.desde), maxResults: 1 }).messages || [];
  if (page.length === 0) {
    console.log('No hay correos pendientes.');
    return;
  }
  handleMessage_(page[0].id, cfg, labelIds);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classify_, pickPlainText_, buildQuery_ };
}
