const APP_TITLE = 'The Shared Shelf';
const DATA_TAB = 'Room snapshots';
const DEFAULT_ROOM_ID = 'kyogo-kasia';
const SNAPSHOT_CHUNK_SIZE = 40000;

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  if (parameters.api === 'read') return serveJournalReadApi_(parameters);
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Accept writes from the static GitHub Pages frontend. */
function doPost(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  if (parameters.api !== 'write') return apiJson_({ ok: false, error: 'Unknown API action.' });
  try {
    const data = JSON.parse(parameters.data || '{}');
    const result = saveJournalData(parameters.roomId, data);
    return apiJson_({ ok: true, result: result });
  } catch (error) {
    return apiJson_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

/** Read-only JSONP route for GitHub Pages. Keep the callback name tightly restricted. */
function serveJournalReadApi_(parameters) {
  const data = getJournalData(parameters.roomId);
  const callback = String(parameters.callback || '');
  if (!callback) return apiJson_(data);
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return apiJson_({ ok: false, error: 'Invalid callback.' });
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return ContentService.createTextOutput(callback + '(' + json + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function apiJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Called from Index.html through google.script.run. */
function getJournalData(roomId) {
  const room = sanitizeRoomId_(roomId);
  return readSnapshot_(room) || { books: [], battleData: null, updatedAt: '', requestId: '' };
}

/** Called from Index.html through google.script.run. */
function saveJournalData(roomId, data) {
  const room = sanitizeRoomId_(roomId);
  if (!data || !Array.isArray(data.books)) throw new Error('Invalid journal data.');
  if (data.books.length > 2000) throw new Error('This room has too many books to save.');
  return writeSnapshot_(room, {
    books: data.books,
    battleData: data.battleData || null,
    requestId: String(data.requestId || ''),
    updatedAt: new Date().toISOString()
  });
}

function writeSnapshot_(roomId, snapshot) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = getDataSheet_();
    const savedAt = Date.now();
    const snapshotId = Utilities.getUuid();
    const payload = JSON.stringify({
      books: snapshot.books || [],
      battleData: snapshot.battleData || null,
      requestId: String(snapshot.requestId || ''),
      updatedAt: new Date(savedAt).toISOString()
    });
    const chunks = splitText_(payload, SNAPSHOT_CHUNK_SIZE);
    const startRow = Math.max(2, sheet.getLastRow() + 1);
    const values = chunks.map(function(chunk, index) {
      return [roomId, snapshotId, index, chunks.length, chunk, savedAt, true];
    });
    sheet.getRange(startRow, 1, values.length, 7).setValues(values);

    // Keep only the newest complete snapshot for this room after the new one is written.
    const all = sheet.getDataRange().getValues();
    for (let i = all.length - 1; i >= 1; i--) {
      if (all[i][0] === roomId && all[i][1] !== snapshotId) sheet.deleteRow(i + 1);
    }
    return { updatedAt: new Date(savedAt).toISOString(), bookCount: (snapshot.books || []).length };
  } finally {
    lock.releaseLock();
  }
}

function readSnapshot_(roomId) {
  const sheet = getDataSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const groups = {};
  values.forEach(function(row) {
    if (row[0] !== roomId || row[6] !== true) return;
    const id = String(row[1]);
    if (!groups[id]) groups[id] = { savedAt: Number(row[5]), expected: Number(row[3]), parts: [] };
    groups[id].parts[Number(row[2])] = String(row[4]);
  });
  let newest = null;
  Object.keys(groups).forEach(function(id) {
    const group = groups[id];
    if (group.parts.length !== group.expected || group.parts.some(function(part) { return part === undefined; })) return;
    if (!newest || group.savedAt > newest.savedAt) newest = group;
  });
  if (!newest) return null;
  const parsed = JSON.parse(newest.parts.join(''));
  return {
    books: Array.isArray(parsed.books) ? parsed.books : [],
    battleData: parsed.battleData || null,
    requestId: String(parsed.requestId || ''),
    updatedAt: parsed.updatedAt || new Date(newest.savedAt).toISOString()
  };
}

function getDataSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('BOOK_JOURNAL_SPREADSHEET_ID');
  if (!id) throw new Error('Set BOOK_JOURNAL_SPREADSHEET_ID in Script Properties first.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(DATA_TAB);
  if (!sheet) throw new Error('The journal data sheet is missing.');
  return sheet;
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('BOOK_JOURNAL_SPREADSHEET_ID');
  if (!id) throw new Error('Set BOOK_JOURNAL_SPREADSHEET_ID in Script Properties first.');
  return SpreadsheetApp.openById(id);
}

function sanitizeRoomId_(value) {
  const room = String(value || DEFAULT_ROOM_ID).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  return room || DEFAULT_ROOM_ID;
}

function splitText_(value, chunkSize) {
  const result = [];
  for (let i = 0; i < value.length; i += chunkSize) result.push(value.slice(i, i + chunkSize));
  return result.length ? result : [''];
}

