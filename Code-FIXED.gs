// ============================================
// STOCK OPNAME PWA - Google Apps Script Backend
// Version 3.0 - POST form-urlencoded (CORS-safe)
// ============================================

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const SHEET_MASTER = 'Daftar Product';
const SHEET_PRODUCT_IN = 'Product In';
const SHEET_CYCLE_COUNT = 'Cycle Count';

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    message: 'Stock Opname API is running',
    version: '3.0',
    note: 'Use POST with application/x-www-form-urlencoded'
  });
}

function doPost(e) {
  try {
    // Support dua format: JSON dan form-urlencoded
    let action, data;

    if (e.postData.type === 'application/x-www-form-urlencoded') {
      // Form urlencoded - tidak trigger CORS preflight
      action = e.parameter.action;
      data = e.parameter.data ? JSON.parse(decodeURIComponent(e.parameter.data)) : {};
    } else {
      // JSON fallback
      const body = JSON.parse(e.postData.contents);
      action = body.action;
      data = body;
    }

    switch (action) {
      case 'getProducts':
        return jsonResponse(getProducts());
      case 'searchProduct':
        return jsonResponse(searchProduct(data.query));
      case 'addProductIn':
        return jsonResponse(addProductIn(data.record));
      case 'addCycleCount':
        return jsonResponse(addCycleCount(data.record));
      case 'getProductIn':
        return jsonResponse(getProductIn(data.date));
      case 'getCycleCount':
        return jsonResponse(getCycleCount(data.date));
      case 'deleteProductIn':
        return jsonResponse(deleteProductIn(data.rowId));
      case 'deleteCycleCount':
        return jsonResponse(deleteCycleCount(data.rowId));
      case 'updateProductIn':
        return jsonResponse(updateProductIn(data.rowId, data.record));
      case 'updateCycleCount':
        return jsonResponse(updateCycleCount(data.rowId, data.record));
      case 'addNewBatch':
        return jsonResponse(addNewBatch(data.batch));
      default:
        return jsonResponse({ success: false, message: 'Action tidak dikenal: ' + action });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: 'Error: ' + error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Helper: format tanggal ke M/D/YYYY (sesuai format spreadsheet)
function formatDateMDY(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const y = date.getFullYear();
  return m + '/' + d + '/' + y;
}

// ============================================
// MASTER DATA
// ============================================

function getProducts() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_MASTER);
  const data = sheet.getDataRange().getValues();
  const products = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    products.push({
      barcode: data[i][0].toString(),
      sku: data[i][1].toString(),
      product: data[i][2].toString(),
      batch: data[i][3].toString()
    });
  }
  return { success: true, data: products };
}

function searchProduct(query) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_MASTER);
  const data = sheet.getDataRange().getValues();
  const results = [];
  const q = (query || '').toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (data[i][0].toString().toLowerCase().includes(q) ||
        data[i][1].toString().toLowerCase().includes(q) ||
        data[i][2].toString().toLowerCase().includes(q)) {
      results.push({
        barcode: data[i][0].toString(),
        sku: data[i][1].toString(),
        product: data[i][2].toString(),
        batch: data[i][3].toString()
      });
    }
  }
  return { success: true, data: results };
}

function withDocumentLock(callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function addNewBatch(batch) {
  return withDocumentLock(function() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_MASTER);
    sheet.appendRow([batch.barcode, batch.sku, batch.product, batch.batch]);
    return { success: true, message: 'Batch baru berhasil ditambahkan' };
  });
}

// ============================================
// PRODUCT IN
// ============================================

function addProductIn(record) {
  return withDocumentLock(function() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_PRODUCT_IN);
    const rowId = sheet.getLastRow();
    const date = record.date || formatDateMDY(new Date());
    sheet.appendRow([rowId, date, record.barcode, record.sku, record.product,
      record.batch, record.sku + record.batch, record.qty, record.status || 'Pending', record.user || '']);
    return { success: true, message: 'Product In berhasil ditambahkan', rowId: rowId };
  });
}

function updateProductIn(rowId, record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PRODUCT_IN);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == rowId) {
      sheet.getRange(i+1, 3).setValue(record.barcode);
      sheet.getRange(i+1, 4).setValue(record.sku);
      sheet.getRange(i+1, 5).setValue(record.product);
      sheet.getRange(i+1, 6).setValue(record.batch);
      sheet.getRange(i+1, 7).setValue(record.sku + record.batch);
      sheet.getRange(i+1, 8).setValue(record.qty);
      sheet.getRange(i+1, 9).setValue(record.status);
      return { success: true, message: 'Product In berhasil diupdate' };
    }
  }
  return { success: false, message: 'Data tidak ditemukan' };
}

function getProductIn(date) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PRODUCT_IN);
  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    let rowDate = '';
    try { rowDate = formatDateMDY(new Date(data[i][1])); }
    catch(e) { rowDate = data[i][1] ? data[i][1].toString() : ''; }
    if (date && rowDate !== date) continue;
    results.push({
      rowId: data[i][0], date: rowDate,
      barcode: data[i][2].toString(), sku: data[i][3].toString(),
      product: data[i][4].toString(), batch: data[i][5].toString(),
      skuBatch: data[i][6].toString(), qty: data[i][7],
      status: data[i][8].toString(),
      user: data[i][9] ? data[i][9].toString() : 'Unknown'
    });
  }
  return { success: true, data: results };
}

function deleteProductIn(rowId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PRODUCT_IN);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == rowId) { sheet.deleteRow(i+1); return { success: true, message: 'Data berhasil dihapus' }; }
  }
  return { success: false, message: 'Data tidak ditemukan' };
}

// ============================================
// CYCLE COUNT
// ============================================

function addCycleCount(record) {
  return withDocumentLock(function() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_CYCLE_COUNT);
    const rowId = sheet.getLastRow();
    const date = record.date || formatDateMDY(new Date());
    sheet.appendRow([rowId, date, record.barcode, record.sku, record.product || '',
      record.batch, record.sku + record.batch, record.qty, record.user || '']);
    return { success: true, message: 'Cycle Count berhasil ditambahkan', rowId: rowId };
  });
}

function updateCycleCount(rowId, record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CYCLE_COUNT);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == rowId) {
      sheet.getRange(i+1, 3).setValue(record.barcode);
      sheet.getRange(i+1, 4).setValue(record.sku);
      sheet.getRange(i+1, 5).setValue(record.product || '');
      sheet.getRange(i+1, 6).setValue(record.batch);
      sheet.getRange(i+1, 7).setValue(record.sku + record.batch);
      sheet.getRange(i+1, 8).setValue(record.qty);
      return { success: true, message: 'Cycle Count berhasil diupdate' };
    }
  }
  return { success: false, message: 'Data tidak ditemukan' };
}

function getCycleCount(date) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CYCLE_COUNT);
  const data = sheet.getDataRange().getValues();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    let rowDate = '';
    try { rowDate = formatDateMDY(new Date(data[i][1])); }
    catch(e) { rowDate = data[i][1] ? data[i][1].toString() : ''; }
    if (date && rowDate !== date) continue;
    results.push({
      rowId: data[i][0], date: rowDate,
      barcode: data[i][2].toString(), sku: data[i][3].toString(),
      product: data[i][4].toString(),
      batch: data[i][5].toString(), skuBatch: data[i][6].toString(),
      qty: data[i][7],
      user: data[i][8] ? data[i][8].toString() : 'Unknown'
    });
  }
  return { success: true, data: results };
}

function deleteCycleCount(rowId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CYCLE_COUNT);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == rowId) { sheet.deleteRow(i+1); return { success: true, message: 'Data berhasil dihapus' }; }
  }
  return { success: false, message: 'Data tidak ditemukan' };
}


