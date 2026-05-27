// ============================================
// STOCK OPNAME PWA - VANILLA JAVASCRIPT
// ============================================

const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyCfyQdUj9saS8hBrVoiPM4Se-ywCQze1N4mT_aYNqkDokcyiZ8FDrfodiXGWuhUUVp/exec',
  LOGIN_PASSWORD: 'BLP123',
  STORAGE_KEY: 'stockOpnameUser'
};

let state = {
  currentUser: null,
  products: [],
  productInList: [],
  cycleCountList: [],
  currentDate: (function(){ var n=new Date(); return (n.getMonth()+1)+'/'+n.getDate()+'/'+n.getFullYear(); })(),
  editingProductInId: null,
  editingCycleCountId: null
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Initialize IndexedDB first
  try {
    await initDB();
    console.log('[App] IndexedDB initialized');
  } catch (error) {
    console.error('[App] IndexedDB init failed:', error);
    showToast('Error: Local storage tidak tersedia', 'error');
  }
  requestStoragePersistence();

  updateCurrentDate();
  updateAllDateDisplays(); // Initialize all date displays
  setupEventListeners();
  setupProductManagementForm();
  setupMasterProductSearch();
  registerServiceWorker();
  updateConnectionStatus();
  await checkLogin();
}

function initializeApp() {
  // Legacy function - now redirects to initApp
  initApp();
}

// ============================================
// LOGIN
// ============================================

async function checkLogin() {
  // Update all date displays to today
  globalSelectedDate = null; // Reset to today (null = today)
  updateAllDateDisplays();

  state.currentUser = await getSavedUser();
  if (!state.currentUser) {
    showLoginModal();
  } else {
    updateUserDisplay();
    document.getElementById('loginModal').classList.remove('show');
    loadAllData();
  }
}

function showLoginModal() {
  document.getElementById('loginModal').classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

async function logout() {
  if (confirm('Logout dari aplikasi?')) {
    await clearSavedUser();
    state.currentUser = null;
    location.reload();
  }
}

async function getSavedUser() {
  var user = null;

  try {
    user = localStorage.getItem(CONFIG.STORAGE_KEY);
  } catch (error) {
    console.warn('[App] localStorage read failed:', error);
  }

  if (!user) {
    try {
      user = await dbGetSetting(CONFIG.STORAGE_KEY);
      if (user) localStorage.setItem(CONFIG.STORAGE_KEY, user);
    } catch (error) {
      console.warn('[App] IndexedDB user read failed:', error);
    }
  }

  if (!user) {
    user = getCookie(CONFIG.STORAGE_KEY);
    if (user) await saveUser(user);
  }

  return user;
}

async function saveUser(username) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, username);
  } catch (error) {
    console.warn('[App] localStorage save failed:', error);
  }

  try {
    await dbSaveSetting(CONFIG.STORAGE_KEY, username);
  } catch (error) {
    console.warn('[App] IndexedDB user save failed:', error);
  }

  setCookie(CONFIG.STORAGE_KEY, username, 365);
}

async function clearSavedUser() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  } catch (error) {
    console.warn('[App] localStorage remove failed:', error);
  }

  try {
    await dbSaveSetting(CONFIG.STORAGE_KEY, '');
  } catch (error) {
    console.warn('[App] IndexedDB user clear failed:', error);
  }

  deleteCookie(CONFIG.STORAGE_KEY);
}

function setCookie(name, value, days) {
  var maxAge = days * 24 * 60 * 60;
  document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + maxAge + '; SameSite=Lax; Secure';
}

function getCookie(name) {
  var prefix = name + '=';
  var parts = document.cookie ? document.cookie.split('; ') : [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].indexOf(prefix) === 0) {
      return decodeURIComponent(parts[i].slice(prefix.length));
    }
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = name + '=; path=/; max-age=0; SameSite=Lax; Secure';
}

function requestStoragePersistence() {
  if (!navigator.storage || !navigator.storage.persist) return;
  navigator.storage.persist().then(function(isPersisted) {
    console.log('[App] Persistent storage:', isPersisted);
  }).catch(function(error) {
    console.warn('[App] Persistent storage request failed:', error);
  });
}

function updateUserDisplay() {
  const el = document.getElementById('userDisplay');
  if (el) el.textContent = '👤 ' + state.currentUser;
}

function updateCurrentDate() {
  const date = new Date();
  const m = String(date.getMonth() + 1); // no padding, M/D/YYYY
  const d = String(date.getDate());
  const y = date.getFullYear();
  state.currentDate = m + '/' + d + '/' + y; // format: 5/27/2026
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Login
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', handleTabClick);
  });

  // Product In
  document.getElementById('productInForm').addEventListener('submit', handleSaveProductIn);
  document.getElementById('searchProduct').addEventListener('input', handleSearchProduct);
  document.getElementById('cancelEditBtn').addEventListener('click', cancelEditProductIn);

  // Cycle Count
  document.getElementById('cycleCountForm').addEventListener('submit', handleSaveCycleCount);
  document.getElementById('searchCycle').addEventListener('input', handleSearchCycle);
  document.getElementById('cancelEditCycleBtn').addEventListener('click', cancelEditCycleCount);

  // Navbar
  document.getElementById('syncBtn').addEventListener('click', handleSync);
  document.getElementById('logoutBtn').addEventListener('click', logout);

  // FAB
  document.getElementById('fabBtn').addEventListener('click', showCreateBatchModal);

  // Calculator - Qty inputs
  var inputQty = document.getElementById('inputQty');
  var cycleQty = document.getElementById('cycleQty');
  var editQty = document.getElementById('editQty');
  if (inputQty) inputQty.addEventListener('blur', handleQtyCalculation);
  if (cycleQty) cycleQty.addEventListener('blur', handleQtyCalculation);
  if (editQty) editQty.addEventListener('blur', handleQtyCalculation);
  [inputQty, cycleQty, editQty].forEach(function(input) {
    if (!input) return;
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        calculateQtyInput(input, true);
        input.blur();
      }
    });
  });

  // Create Batch Form
  var batchForm = document.getElementById('createBatchForm');
  if (batchForm) batchForm.addEventListener('submit', handleCreateBatch);
}

// ============================================
// LOGIN HANDLER
// ============================================

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!username) {
    errorEl.textContent = 'Username tidak boleh kosong';
    return;
  }
  if (password !== CONFIG.LOGIN_PASSWORD) {
    errorEl.textContent = 'Password salah!';
    document.getElementById('loginPassword').value = '';
    return;
  }

  state.currentUser = username;
  await saveUser(username);
  closeModal('loginModal');
  updateUserDisplay();
  document.getElementById('loginForm').reset();
  errorEl.textContent = '';
  loadAllData();
}

// ============================================
// TAB HANDLER
// ============================================

function handleTabClick(e) {
  const tabName = e.target.dataset.tab;
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  e.target.classList.add('active');
  var tabEl = document.getElementById(tabName);
  if (tabEl) tabEl.classList.add('active');
}

// ============================================
// API
// ============================================

async function apiRequest(action, data) {
  data = data || {};
  try {
    const payload = Object.assign({}, data, { user: state.currentUser });
    const body = 'action=' + encodeURIComponent(action) +
                 '&data=' + encodeURIComponent(JSON.stringify(payload));

    const response = await fetch(CONFIG.SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    const text = await response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error('API Error:', error);
    showToast('Error: ' + error.message, 'error');
    return { success: false, message: error.message };
  }
}

// ============================================
// DATA LOADING
// ============================================

async function loadAllData() {
  var lb = document.getElementById('loadingBar');
  if (lb) lb.classList.add('show');

  // First, try to load from local DB (instant!)
  const localProducts = await loadProductsFromLocal();

  // If no local products, try to sync from cloud
  if (localProducts.length === 0) {
    console.log('[App] No local products, syncing from cloud...');
    await syncProductsToLocal();
  } else {
    console.log('[App] Loaded', localProducts.length, 'products from local DB (instant!)');
  }

  // Check online status
  if (navigator.onLine) {
    // In background, sync with cloud for latest data
    syncProductsToLocal().then(() => {
      // Update search data
      renderProductInList();
      renderCycleCountList();
    });
  }

  // Load data for selected date (using global date system)
  loadDataForDate(globalSelectedDate || getGlobalDate());

  var lb2 = document.getElementById('loadingBar');
  if (lb2) lb2.classList.remove('show');

  // Update sync info
  updateSyncStatus();
}

// ============================================
// PRODUCT IN
// ============================================

async function handleSaveProductIn(e) {
  e.preventDefault();

  const record = {
    barcode: document.getElementById('inputBarcode').value,
    sku: document.getElementById('inputSKU').value,
    product: document.getElementById('inputProduct').value,
    batch: document.getElementById('inputBatch').value,
    qty: calculateQtyInput(document.getElementById('inputQty'), true) || 0,
    status: 'Pending',
    date: globalSelectedDate || getGlobalDate()
  };

  if (!record.barcode || record.qty <= 0) {
    showToast('Pilih produk dan isi Qty', 'error');
    return;
  }

  let result;
  if (state.editingProductInId) {
    result = await apiRequest('updateProductIn', { rowId: state.editingProductInId, record: record });
    state.editingProductInId = null;
  } else {
    result = await apiRequest('addProductIn', { record: record });
  }

  if (result.success) {
    showToast(result.message, 'success');
    document.getElementById('productInForm').reset();
    document.getElementById('searchProduct').value = '';
    document.getElementById('searchResults').classList.remove('show');
    document.getElementById('cancelEditBtn').style.display = 'none';
    loadAllData();
  } else {
    showToast(result.message, 'error');
  }
}

function renderProductInList() {
  const container = document.getElementById('productInList');
  if (!container) return;
  container.innerHTML = '';

  if (state.productInList.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada data</div></div>';
    document.getElementById('productInCount').textContent = '0';
    return;
  }

  var piCount = state.productInList.length;
  document.getElementById('productInCount').textContent = piCount;
  var navBadgePI = document.getElementById('navBadgePI');
  if (navBadgePI) { navBadgePI.textContent = piCount; navBadgePI.style.display = piCount > 0 ? 'flex' : 'none'; }
  state.productInList.forEach(function(item) {
    var productName = (item.product && item.product.trim()) ? item.product : item.sku;
    container.innerHTML +=
      '<div class="history-item">' +
        '<div class="history-item-top">' +
          '<div class="history-item-name">' + productName + '</div>' +
          '<div class="history-item-qty">' + item.qty + '</div>' +
        '</div>' +
        '<div class="history-item-meta">' +
          '<span class="meta-chip batch">🏷 ' + item.batch + '</span>' +
          '<span class="meta-chip user">👤 ' + (item.user || 'Unknown') + '</span>' +
          '<span class="meta-chip">📅 ' + item.date + '</span>' +
        '</div>' +
        '<div class="history-item-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="editProductIn(' + item.rowId + ')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteProductIn(' + item.rowId + ')">🗑️</button>' +
        '</div>' +
      '</div>';
  });
}

let currentEditType = null; // 'product-in' or 'cycle-count'
let currentEditRowId = null;

function editProductIn(rowId) {
  const item = state.productInList.find(function(p) { return p.rowId == rowId; });
  if (!item) return;

  currentEditType = 'product-in';
  currentEditRowId = rowId;

  // Fill form
  document.getElementById('editHistoryTitle').textContent = '✏️ Edit Product In';
  document.getElementById('editBarcode').value = item.barcode;
  document.getElementById('editSKU').value = item.sku;
  document.getElementById('editProduct').value = item.product || '';
  document.getElementById('editBatch').value = item.batch || '';
  document.getElementById('editQty').value = item.qty;

  // Style for Product In
  document.getElementById('editSaveBtn').className = 'btn btn-success';
  document.getElementById('editSaveBtn').style.background = 'var(--primary)';

  // Show modal
  document.getElementById('editHistoryModal').classList.add('show');
}

function editCycleCount(rowId) {
  const item = state.cycleCountList.find(function(p) { return p.rowId == rowId; });
  if (!item) return;

  currentEditType = 'cycle-count';
  currentEditRowId = rowId;

  // Fill form
  document.getElementById('editHistoryTitle').textContent = '✏️ Edit Cycle Count';
  document.getElementById('editBarcode').value = item.barcode;
  document.getElementById('editSKU').value = item.sku;
  document.getElementById('editProduct').value = item.product || '';
  document.getElementById('editBatch').value = item.batch || '';
  document.getElementById('editQty').value = item.qty;

  // Style for Cycle Count
  document.getElementById('editSaveBtn').className = 'btn btn-success';
  document.getElementById('editSaveBtn').style.background = 'var(--success)';

  // Show modal
  document.getElementById('editHistoryModal').classList.add('show');
}

function closeEditHistoryModal() {
  document.getElementById('editHistoryModal').classList.remove('show');
  currentEditType = null;
  currentEditRowId = null;
}

function cancelEditProductIn() {
  state.editingProductInId = null;
  document.getElementById('productInForm').reset();
  document.getElementById('cancelEditBtn').style.display = 'none';
}

async function saveEditHistory(e) {
  e.preventDefault();

  const qty = calculateQtyInput(document.getElementById('editQty'), true) || 0;
  if (!qty || qty <= 0) {
    showToast('Qty harus lebih dari 0', 'error');
    return;
  }

  const record = {
    barcode: document.getElementById('editBarcode').value,
    sku: document.getElementById('editSKU').value,
    product: document.getElementById('editProduct').value,
    batch: document.getElementById('editBatch').value,
    qty: qty,
    date: globalSelectedDate || getGlobalDate()
  };

  let result;
  if (currentEditType === 'product-in') {
    result = await apiRequest('updateProductIn', { rowId: currentEditRowId, record: record });
  } else {
    result = await apiRequest('updateCycleCount', { rowId: currentEditRowId, record: record });
  }

  if (result.success) {
    showToast(result.message, 'success');
    closeEditHistoryModal();
    loadDataForDate(globalSelectedDate || getGlobalDate());
  } else {
    showToast('Error: ' + result.message, 'error');
  }
}

async function deleteEditHistory() {
  if (!confirm('Hapus data ini?')) return;

  let result;
  if (currentEditType === 'product-in') {
    result = await apiRequest('deleteProductIn', { rowId: currentEditRowId });
  } else {
    result = await apiRequest('deleteCycleCount', { rowId: currentEditRowId });
  }

  if (result.success) {
    showToast(result.message, 'success');
    closeEditHistoryModal();
    loadDataForDate(globalSelectedDate || getGlobalDate());
  } else {
    showToast('Error: ' + result.message, 'error');
  }
}

// Setup edit history form
document.addEventListener('DOMContentLoaded', function() {
  const editForm = document.getElementById('editHistoryForm');
  if (editForm) {
    editForm.addEventListener('submit', saveEditHistory);
  }

  const deleteBtn = document.getElementById('editDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', deleteEditHistory);
  }
});

async function deleteProductIn(rowId) {
  if (!confirm('Hapus data ini?')) return;
  const result = await apiRequest('deleteProductIn', { rowId: rowId });
  if (result.success) {
    showToast(result.message, 'success');
    loadDataForDate(globalSelectedDate || getGlobalDate());
  } else {
    showToast(result.message, 'error');
  }
}

// ============================================
// CYCLE COUNT
// ============================================

async function handleSaveCycleCount(e) {
  e.preventDefault();

  const record = {
    barcode: document.getElementById('cycleBarcode').value,
    sku: document.getElementById('cycleSKU').value,
    product: document.getElementById('cycleProduct').value,
    batch: document.getElementById('cycleBatch').value,
    qty: calculateQtyInput(document.getElementById('cycleQty'), true) || 0,
    date: globalSelectedDate || getGlobalDate()
  };

  if (!record.barcode || record.qty <= 0) {
    showToast('Pilih produk dan isi Qty', 'error');
    return;
  }

  let result;
  if (state.editingCycleCountId) {
    result = await apiRequest('updateCycleCount', { rowId: state.editingCycleCountId, record: record });
    state.editingCycleCountId = null;
  } else {
    result = await apiRequest('addCycleCount', { record: record });
  }

  if (result.success) {
    showToast(result.message, 'success');
    document.getElementById('cycleCountForm').reset();
    document.getElementById('searchCycle').value = '';
    document.getElementById('cycleSearchResults').classList.remove('show');
    document.getElementById('cancelEditCycleBtn').style.display = 'none';
    loadAllData();
  } else {
    showToast(result.message, 'error');
  }
}

function renderCycleCountList() {
  const container = document.getElementById('cycleCountList');
  if (!container) return;
  container.innerHTML = '';

  if (state.cycleCountList.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Belum ada data</div></div>';
    document.getElementById('cycleCountCount').textContent = '0';
    return;
  }

  var ccCount = state.cycleCountList.length;
  document.getElementById('cycleCountCount').textContent = ccCount;
  var navBadgeCC = document.getElementById('navBadgeCC');
  if (navBadgeCC) { navBadgeCC.textContent = ccCount; navBadgeCC.style.display = ccCount > 0 ? 'flex' : 'none'; }
  state.cycleCountList.forEach(function(item) {
    var masterProduct = state.products.find(function(p) { return p.sku === item.sku && p.batch === item.batch; });
    if (!masterProduct) masterProduct = state.products.find(function(p) { return p.sku === item.sku; });
    var productName = (item.product && item.product.trim()) ? item.product : (masterProduct ? masterProduct.product : item.sku);
    container.innerHTML +=
      '<div class="history-item" style="border-left-color:var(--green)">' +
        '<div class="history-item-top">' +
          '<div class="history-item-name">' + productName + '</div>' +
          '<div class="history-item-qty" style="color:var(--green)">' + item.qty + '</div>' +
        '</div>' +
        '<div class="history-item-meta">' +
          '<span class="meta-chip batch">🏷 ' + item.batch + '</span>' +
          '<span class="meta-chip user">👤 ' + (item.user || 'Unknown') + '</span>' +
          '<span class="meta-chip">📅 ' + item.date + '</span>' +
        '</div>' +
        '<div class="history-item-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="editCycleCount(' + item.rowId + ')">✏️ Edit</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteCycleCount(' + item.rowId + ')">🗑️</button>' +
        '</div>' +
      '</div>';
  });
}
// editCycleCount moved to inline edit modal
function cancelEditCycleCount() {
  state.editingCycleCountId = null;
  document.getElementById('cycleCountForm').reset();
  document.getElementById('cancelEditCycleBtn').style.display = 'none';
}

async function deleteCycleCount(rowId) {
  if (!confirm('Hapus data ini?')) return;
  const result = await apiRequest('deleteCycleCount', { rowId: rowId });
  if (result.success) {
    showToast(result.message, 'success');
    loadDataForDate(globalSelectedDate || getGlobalDate());
  } else {
    showToast(result.message, 'error');
  }
}

// ============================================
// PRODUCT MANAGEMENT (Master Products)
// ============================================

function openProductManagement() {
  document.getElementById('productManagementModal').classList.add('show');
  renderProductManagementList();
}

function showAddProductForm() {
  document.getElementById('addProductForm').style.display = 'block';
  document.getElementById('mpBarcode').focus();
}

function hideAddProductForm() {
  document.getElementById('addProductForm').style.display = 'none';
  document.getElementById('newProductForm').reset();
  document.getElementById('newProductForm').dataset.mode = 'add';
  delete document.getElementById('newProductForm').dataset.originalBarcode;
}

function renderProductManagementList() {
  const container = document.getElementById('productManagementList');
  if (!container) return;

  const products = state.products || [];
  if (products.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">Belum ada produk</div></div>';
    return;
  }

  let html = '';
  products.forEach(function(product) {
    html +=
      '<div class="product-item" style="background:white;border-radius:var(--radius);padding:14px;margin-bottom:10px;box-shadow:var(--shadow);">' +
        '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">' +
          '<div>' +
            '<div style="font-weight:700;color:var(--gray-800);">' + (product.product || '-') + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button class="btn btn-sm btn-outline" onclick="editMasterProduct(\'' + product.barcode + '\')">✏️</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteMasterProduct(\'' + product.barcode + '\')">🗑️</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<span class="meta-chip batch">🏷 ' + (product.batch || '-') + '</span>' +
        '</div>' +
      '</div>';
  });

  container.innerHTML = html;
}

async function handleAddProduct(e) {
  e.preventDefault();

  const product = {
    barcode: document.getElementById('mpBarcode').value.trim(),
    sku: document.getElementById('mpSKU').value.trim(),
    product: document.getElementById('mpProduct').value.trim(),
    batch: document.getElementById('mpBatch').value.trim()
  };

  if (!product.barcode || !product.sku || !product.product || !product.batch) {
    showToast('Semua field harus diisi!', 'error');
    return;
  }

  // Check if barcode already exists
  const existing = await dbGetProductByBarcode(product.barcode);
  if (existing) {
    showToast('Barcode sudah ada! Gunakan edit untuk mengubah.', 'error');
    return;
  }

  // Save to local DB
  try {
    await dbSaveProduct(product);
    showToast('Produk tersimpan di HP', 'success');
  } catch (err) {
    console.error('[App] Save to local DB failed:', err);
  }

  // Save to cloud (Google Apps Script)
  const result = await apiRequest('addNewBatch', { batch: product });

  if (result.success) {
    showToast('Produk berhasil ditambahkan!', 'success');
    state.products.push(product);
    hideAddProductForm();
    renderProductManagementList();
    await syncProductsToLocal();
  } else {
    showToast('Error: ' + result.message, 'error');
  }
}

function editMasterProduct(barcode) {
  const product = state.products.find(p => p.barcode === barcode);
  if (!product) {
    showToast('Produk tidak ditemukan', 'error');
    return;
  }

  showAddProductForm();
  document.getElementById('mpBarcode').value = product.barcode;
  document.getElementById('mpSKU').value = product.sku;
  document.getElementById('mpProduct').value = product.product;
  document.getElementById('mpBatch').value = product.batch;
  document.getElementById('newProductForm').dataset.mode = 'edit';
  document.getElementById('newProductForm').dataset.originalBarcode = barcode;
  showToast('Mode edit - ubah data lalu simpan', 'info');
}

async function handleEditProduct(e) {
  e.preventDefault();

  const originalBarcode = document.getElementById('newProductForm').dataset.originalBarcode;

  const product = {
    barcode: document.getElementById('mpBarcode').value.trim(),
    sku: document.getElementById('mpSKU').value.trim(),
    product: document.getElementById('mpProduct').value.trim(),
    batch: document.getElementById('mpBatch').value.trim()
  };

  if (!product.barcode || !product.sku || !product.product || !product.batch) {
    showToast('Semua field harus diisi!', 'error');
    return;
  }

  // Check if barcode changed and new barcode exists
  if (originalBarcode !== product.barcode) {
    const existing = await dbGetProductByBarcode(product.barcode);
    if (existing) {
      showToast('Barcode sudah digunakan produk lain!', 'error');
      return;
    }
    // Delete old barcode entry
    await dbDeleteProduct(originalBarcode);
  }

  // Update local DB
  await dbSaveProduct(product);

  // Update local state
  const index = state.products.findIndex(p => p.barcode === originalBarcode);
  if (index !== -1) {
    state.products[index] = product;
  }

  // Sync to cloud
  const result = await apiRequest('addNewBatch', { batch: product });

  if (result.success) {
    showToast('Produk berhasil diperbarui!', 'success');
    hideAddProductForm();
    renderProductManagementList();
    await syncProductsToLocal();
  } else {
    showToast('Error: ' + result.message, 'error');
  }
}

async function deleteMasterProduct(barcode) {
  if (!confirm('Hapus produk ini? Data yang sudah diinput tidak akan terhapus.')) return;

  await dbDeleteProduct(barcode);
  state.products = state.products.filter(p => p.barcode !== barcode);
  showToast('Produk dihapus dari HP', 'success');
  renderProductManagementList();
  await syncProductsToLocal();
}

function setupMasterProductSearch() {
  const searchInput = document.getElementById('searchMasterProduct');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      const container = document.getElementById('productManagementList');

      if (!query) {
        renderProductManagementList();
        return;
      }

      const filtered = state.products.filter(p =>
        p.barcode.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.product.toLowerCase().includes(query) ||
        p.batch.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Tidak ditemukan</div></div>';
        return;
      }

      let html = '';
      filtered.forEach(function(product) {
        html +=
          '<div style="background:white;border-radius:var(--radius);padding:14px;margin-bottom:10px;box-shadow:var(--shadow);">' +
            '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">' +
              '<div>' +
                '<div style="font-weight:700;color:var(--gray-800);">' + product.product + '</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;">' +
                '<button class="btn btn-sm btn-outline" onclick="editMasterProduct(\'' + product.barcode + '\')">✏️</button>' +
                '<button class="btn btn-sm btn-danger" onclick="deleteMasterProduct(\'' + product.barcode + '\')">🗑️</button>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '<span class="meta-chip batch">🏷 ' + product.batch + '</span>' +
            '</div>' +
          '</div>';
      });
      container.innerHTML = html;
    });
  }
}

function setupProductManagementForm() {
  const form = document.getElementById('newProductForm');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const mode = document.getElementById('newProductForm').dataset.mode;
      if (mode === 'edit') {
        handleEditProduct(e);
      } else {
        handleAddProduct(e);
      }
    });

    form.addEventListener('reset', function() {
      document.getElementById('newProductForm').dataset.mode = 'add';
      delete document.getElementById('newProductForm').dataset.originalBarcode;
    });
  }

  // Product name search in add form
  const mpProductInput = document.getElementById('mpProduct');
  const mpProductResults = document.getElementById('mpProductSearchResults');

  if (mpProductInput && mpProductResults) {
    mpProductInput.addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase().trim();

      if (query.length < 2) {
        mpProductResults.classList.remove('show');
        return;
      }

      // Search products by name or SKU
      const results = state.products.filter(p =>
        p.product.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
      ).slice(0, 10);

      if (results.length === 0) {
        mpProductResults.innerHTML = '<div class="search-item" style="color:var(--gray-400);">Produk tidak ditemukan</div>';
      } else {
        mpProductResults.innerHTML = results.map(p =>
          '<div class="search-item" onclick="selectMPProduct(\'' + p.barcode + '\')">' +
            '<div class="search-item-name" style="font-weight:600;">' + p.product + '</div>' +
            '<small>Batch: ' + p.batch + '</small>' +
          '</div>'
        ).join('');
      }

      mpProductResults.classList.add('show');
    });

    // Close dropdown on outside click
    mpProductInput.addEventListener('blur', function() {
      setTimeout(() => mpProductResults.classList.remove('show'), 200);
    });
  }
}

// Select product in add product form (to autofill from existing product)
function selectMPProduct(barcode) {
  const product = state.products.find(p => p.barcode === barcode);
  if (!product) return;

  document.getElementById('mpProduct').value = product.product;
  document.getElementById('mpSKU').value = product.sku;
  document.getElementById('mpProductSearchResults').classList.remove('show');

  showToast('Produk dipilih. Batch baru akan ditambahkan.', 'info');
}

console.log('[App] Product Management module loaded');

// ============================================
// BARCODE SCANNER
// ============================================

let scannerStream = null;
let scannerVideo = null;
let currentScannerTarget = null;
let currentScannerPage = null;
let torchTrack = null;

// Open barcode scanner
async function openBarcodeScanner(targetInput, page) {
  currentScannerTarget = targetInput;
  currentScannerPage = page;

  // Show modal
  document.getElementById('barcodeScannerModal').classList.add('show');
  document.getElementById('manualBarcodeInput').value = '';
  document.getElementById('scannerStatus').textContent = 'Meminta akses kamera...';
  document.getElementById('torchBtn').style.display = 'none';

  // Start camera
  await startCamera();
}

// Close barcode scanner
async function closeBarcodeScanner() {
  await stopCamera();
  document.getElementById('barcodeScannerModal').classList.remove('show');
}

// Start camera
async function startCamera() {
  try {
    // Stop existing stream
    if (scannerStream) {
      scannerStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
      video: {
        facingMode: 'environment', // Back camera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    scannerStream = await navigator.mediaDevices.getUserMedia(constraints);
    scannerVideo = document.getElementById('scannerVideo');
    scannerVideo.srcObject = scannerStream;

    // Check for torch support
    const videoTrack = scannerStream.getVideoTracks()[0];
    torchTrack = videoTrack;

    if (videoTrack.getCapabilities && videoTrack.getCapabilities().torch) {
      document.getElementById('torchBtn').style.display = 'block';
    }

    document.getElementById('scannerStatus').textContent = 'Arahkan barcode ke kotak...';

    // Start scanning after video plays
    scannerVideo.onloadedmetadata = function() {
      scannerVideo.play();
      startScanning();
    };

  } catch (error) {
    console.error('[Scanner] Camera error:', error);
    document.getElementById('scannerStatus').textContent = 'Error: ' + error.message;

    if (error.name === 'NotAllowedError') {
      showToast('Izinkan akses kamera untuk scan barcode', 'error');
    } else if (error.name === 'NotFoundError') {
      showToast('Kamera tidak ditemukan', 'error');
    }
  }
}

// Stop camera
async function stopCamera() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
  }
}

// Toggle torch/flash
async function toggleTorch() {
  if (!torchTrack) return;

  try {
    const capabilities = torchTrack.getCapabilities();
    const settings = torchTrack.getSettings();

    if (capabilities.torch) {
      const newTorch = !settings.torch;
      await torchTrack.applyConstraints({
        advanced: [{ torch: newTorch }]
      });

      const btn = document.getElementById('torchBtn');
      btn.textContent = newTorch ? '🔦 Matikan Flash' : '🔦 Nyalakan Flash';
    }
  } catch (error) {
    console.error('[Scanner] Torch error:', error);
  }
}

// Start scanning loop
function startScanning() {
  if (!scannerVideo) return;

  // Use BarcodeDetector API if available (Chrome 83+)
  if ('BarcodeDetector' in window) {
    scanWithBarcodeDetector();
  } else {
    // Fallback: Manual entry
    document.getElementById('scannerStatus').textContent = 'Klik input manual atau install Chrome';
  }
}

// Scan using native BarcodeDetector API
async function scanWithBarcodeDetector() {
  if (!scannerVideo || scannerVideo.paused || scannerVideo.ended) {
    setTimeout(scanWithBarcodeDetector, 100);
    return;
  }

  try {
    const barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e']
    });

    const barcodes = await barcodeDetector.detect(scannerVideo);

    if (barcodes.length > 0) {
      const barcode = barcodes[0].rawValue;
      console.log('[Scanner] Detected:', barcode, barcodes[0].format);

      // Vibrate for feedback
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      // Process barcode
      await processScannedBarcode(barcode);
      return;
    }
  } catch (error) {
    console.error('[Scanner] Detection error:', error);
  }

  // Continue scanning
  setTimeout(scanWithBarcodeDetector, 100);
}

// Process scanned barcode
async function processScannedBarcode(barcode) {
  document.getElementById('scannerStatus').textContent = '✅ Terdeteksi: ' + barcode;

  // Look up product in local DB
  const product = await dbGetProductByBarcode(barcode);

  if (product) {
    // Product found
    showToast('Produk ditemukan: ' + product.product, 'success');

    // Fill form based on page
    if (currentScannerPage === 'product-in') {
      selectProduct(product);
    } else if (currentScannerPage === 'cycle-count') {
      selectCycleProduct(product);
    }
  } else {
    // Product not found - show options
    showToast('Barcode tidak terdaftar', 'info');

    // Ask if user wants to add new product
    const addNew = confirm('Barcode "' + barcode + '" tidak ditemukan.\n\nTambah produk baru?');
    if (addNew) {
      // Open product management and prefill barcode
      closeBarcodeScanner();
      openProductManagement();
      setTimeout(() => {
        showAddProductForm();
        document.getElementById('mpBarcode').value = barcode;
        document.getElementById('mpSKU').focus();
      }, 300);
    }
  }

  // Close scanner after short delay
  setTimeout(closeBarcodeScanner, 1000);
}

// Submit manual barcode input
async function submitManualBarcode() {
  const barcode = document.getElementById('manualBarcodeInput').value.trim();
  if (!barcode) {
    showToast('Ketik barcode terlebih dahulu', 'error');
    return;
  }

  await processScannedBarcode(barcode);
}

// Also allow Enter key in manual input
document.addEventListener('DOMContentLoaded', function() {
  const manualInput = document.getElementById('manualBarcodeInput');
  if (manualInput) {
    manualInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitManualBarcode();
      }
    });
  }
});

console.log('[App] Barcode Scanner module loaded');

// ============================================
// SEARCH
// ============================================

function handleSearchProduct(e) {
  const query = e.target.value;
  const container = document.getElementById('searchResults');
  if (!query || query.length < 1) { container.classList.remove('show'); return; }

  // Use local DB search (FAST! < 50ms)
  dbSearchProducts(query).then(function(filtered) {
    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = '<div class="search-result-item">Tidak ditemukan (total produk: ' + state.products.length + ')</div>';
      container.classList.add('show');
      return;
    }

    filtered.slice(0, 20).forEach(function(product) {
      var div = document.createElement('div');
      div.className = 'search-result-item';
      div.innerHTML = '<strong>' + product.product + '</strong><small>Batch: ' + product.batch + '</small>';
      div.addEventListener('click', function() { selectProduct(product); });
      container.appendChild(div);
    });
    container.classList.add('show');
  });
}

function handleSearchCycle(e) {
  const query = e.target.value;
  const container = document.getElementById('cycleSearchResults');
  if (!query || query.length < 1) { container.classList.remove('show'); return; }

  // Use local DB search (FAST! < 50ms)
  dbSearchProducts(query).then(function(filtered) {
    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = '<div class="search-result-item">Tidak ditemukan (total produk: ' + state.products.length + ')</div>';
      container.classList.add('show');
      return;
    }

    filtered.slice(0, 20).forEach(function(product) {
      var div = document.createElement('div');
      div.className = 'search-result-item';
      div.innerHTML = '<strong>' + product.product + '</strong><small>Batch: ' + product.batch + '</small>';
      div.addEventListener('click', function() { selectCycleProduct(product); });
      container.appendChild(div);
    });
    container.classList.add('show');
  });
}

function selectProduct(product) {
  document.getElementById('inputBarcode').value = product.barcode;
  document.getElementById('inputSKU').value = product.sku;
  document.getElementById('inputProduct').value = product.product;

  // Populate batch dropdown with all batches for this SKU
  const sameSKUProducts = state.products.filter(p => p.sku === product.sku);
  populateBatchDropdown('batchDropdownPI', 'batchListPI', 'inputBatch', sameSKUProducts, product);

  document.getElementById('inputSKUBatch').value = product.sku + product.batch;
  document.getElementById('searchResults').classList.remove('show');
  document.getElementById('searchProduct').value = '';
  document.getElementById('inputQty').focus();
}

function selectCycleProduct(product) {
  document.getElementById('cycleBarcode').value = product.barcode;
  document.getElementById('cycleSKU').value = product.sku;
  document.getElementById('cycleProduct').value = product.product;

  // Populate batch dropdown with all batches for this SKU
  const sameSKUProducts = state.products.filter(p => p.sku === product.sku);
  populateBatchDropdown('batchDropdownCC', 'batchListCC', 'cycleBatch', sameSKUProducts, product);

  document.getElementById('cycleSKUBatch').value = product.sku + product.batch;
  document.getElementById('cycleSearchResults').classList.remove('show');
  document.getElementById('searchCycle').value = '';
  document.getElementById('cycleQty').focus();
}

// Populate batch dropdown for a product
function populateBatchDropdown(dropdownId, datalistId, inputId, products, selectedProduct) {
  const dropdown = document.getElementById(dropdownId);
  const datalist = document.getElementById(datalistId);
  const input = document.getElementById(inputId);

  // Clear existing
  dropdown.innerHTML = '';
  datalist.innerHTML = '';

  if (products.length <= 1) {
    // Only one batch, hide dropdown
    dropdown.classList.remove('show');
    input.readOnly = true;
    return;
  }

  // Add batch options
  products.forEach(p => {
    const option = document.createElement('option');
    option.value = p.batch;
    datalist.appendChild(option);
  });

  // Set selected batch
  input.value = selectedProduct.batch;
  input.readOnly = false;

  // Show dropdown on focus
  input.addEventListener('focus', function() {
    showBatchDropdown(dropdownId, products, inputId, selectedProduct);
  });

  // Handle selection
  input.addEventListener('change', function() {
    const newBatch = input.value;
    const newProduct = products.find(p => p.batch === newBatch);
    if (newProduct && newBatch !== selectedProduct.batch) {
      // Update barcode with new batch's barcode
      document.getElementById(inputId === 'inputBatch' ? 'inputBarcode' : 'cycleBarcode').value = newProduct.barcode;
      document.getElementById(inputId === 'inputBatch' ? 'inputSKUBatch' : 'cycleSKUBatch').value = newProduct.sku + newBatch;
    }
  });
}

// Show batch dropdown
function showBatchDropdown(dropdownId, products, inputId, selectedProduct) {
  const dropdown = document.getElementById(dropdownId);

  let html = '';
  products.forEach(p => {
    const isSelected = p.batch === selectedProduct.batch;
    html +=
      '<div class="search-item' + (isSelected ? ' selected' : '') + '" onclick="selectBatch(\'' + dropdownId + '\', \'' + inputId + '\', \'' + p.batch + '\', \'' + p.barcode + '\', \'' + p.sku + '\')">' +
        '<div class="search-item-batch">' + p.batch + '</div>' +
      '</div>';
  });

  dropdown.innerHTML = html;
  dropdown.classList.add('show');

  // Close on click outside
  document.addEventListener('click', function closeDropdown(e) {
    if (!dropdown.contains(e.target) && e.target.id !== inputId) {
      dropdown.classList.remove('show');
      document.removeEventListener('click', closeDropdown);
    }
  });
}

// Select batch from dropdown
function selectBatch(dropdownId, inputId, batch, barcode, sku) {
  const input = document.getElementById(inputId);
  input.value = batch;

  // Update barcode and skuBatch
  const barcodeId = inputId === 'inputBatch' ? 'inputBarcode' : 'cycleBarcode';
  const skubatchId = inputId === 'inputBatch' ? 'inputSKUBatch' : 'cycleSKUBatch';
  document.getElementById(barcodeId).value = barcode;
  document.getElementById(skubatchId).value = sku + batch;

  document.getElementById(dropdownId).classList.remove('show');
  showToast('Batch: ' + batch, 'info');
}

// ============================================
// CREATE BATCH
// ============================================

function showCreateBatchModal() {
  document.getElementById('createBatchModal').classList.add('show');
}

async function handleCreateBatch(e) {
  e.preventDefault();
  const newBatch = {
    barcode: document.getElementById('newBatchBarcode').value,
    sku: document.getElementById('newBatchSKU').value,
    product: document.getElementById('newBatchProduct').value,
    batch: document.getElementById('newBatchBatch').value
  };
  const result = await apiRequest('addNewBatch', { batch: newBatch });
  if (result.success) {
    showToast('Batch baru berhasil ditambahkan', 'success');
    closeModal('createBatchModal');
    document.getElementById('createBatchForm').reset();
    loadAllData();
  } else {
    showToast(result.message, 'error');
  }
}

// ============================================
// CALCULATOR
// ============================================

function handleQtyCalculation(e) {
  calculateQtyInput(e.target, true);
}

function calculateQtyInput(input, showResult) {
  if (!input) return 0;

  const value = input.value.trim();
  if (!value) return 0;

  const parsed = parseQtyValue(value);
  if (parsed === null) {
    showToast('Format perhitungan tidak valid', 'error');
    return 0;
  }

  if (parsed.expression) {
    input.value = parsed.qty;
    if (showResult) showToast(value + ' = ' + parsed.qty, 'success');
  }

  return parsed.qty;
}

function parseQtyValue(value) {
  const raw = value.trim();
  if (!raw) return { qty: 0, expression: false };

  if (/^\d+$/.test(raw)) {
    return { qty: parseInt(raw, 10) || 0, expression: false };
  }

  if (!/[+\-*\/x×÷]/.test(raw)) {
    return null;
  }

  try {
    const expr = raw
      .replace(/x|×/gi, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.');

    if (!/^[\d+\-*\/.\s()]+$/.test(expr)) return null;

    const result = new Function('return (' + expr + ')')();
    if (result === null || isNaN(result) || !isFinite(result)) return null;

    return { qty: Math.round(result), expression: true };
  } catch (err) {
    return null;
  }
}

// ============================================
// UTILITIES
// ============================================

function handleSync() {
  syncProductsToLocal().then(() => {
    loadAllData();
    showToast('Data disinkronisasi', 'success');
  });
}

function updateSyncStatus() {
  getLastSyncTime().then(lastSync => {
    if (lastSync) {
      const now = Date.now();
      const diff = now - lastSync;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);

      let syncText = '';
      if (minutes < 1) syncText = 'Baru saja';
      else if (minutes < 60) syncText = minutes + ' menit lalu';
      else if (hours < 24) syncText = hours + ' jam lalu';
      else syncText = 'lebih dari sehari';

      console.log('[App] Last sync:', syncText);
    }
  });
}

// Online/Offline detection
window.addEventListener('online', function() {
  console.log('[App] Online!');
  showToast('Koneksi kembali online', 'success');
  // Auto sync when back online
  syncProductsToLocal();
});

window.addEventListener('offline', function() {
  console.log('[App] Offline!');
  showToast('Mode offline - data disimpan lokal', 'info');
});

function showToast(message, type) {
  type = type || 'info';
  // Hapus toast lama
  var old = document.querySelector('.toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { if (toast.parentNode) toast.remove(); }, 3000);
}

// ============================================
// DATABASE - IndexedDB for Local Storage
// ============================================

const DB_NAME = 'StockOpnameDB';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_SETTINGS = 'settings';
const STORE_OFFLINE_QUEUE = 'offlineQueue';

let db = null;

// Initialize IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function(event) {
      console.error('[DB] Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = function(event) {
      db = event.target.result;
      console.log('[DB] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = function(event) {
      const database = event.target.result;
      console.log('[DB] Upgrading database...');

      // Products store - with indexes for fast search
      if (!database.objectStoreNames.contains(STORE_PRODUCTS)) {
        const productStore = database.createObjectStore(STORE_PRODUCTS, { keyPath: 'barcode' });
        productStore.createIndex('sku', 'sku', { unique: false });
        productStore.createIndex('product', 'product', { unique: false });
        productStore.createIndex('batch', 'batch', { unique: false });
        productStore.createIndex('sku_batch', 'skuBatch', { unique: false });
        console.log('[DB] Products store created');
      }

      // Settings store
      if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
        database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        console.log('[DB] Settings store created');
      }

      // Offline queue store
      if (!database.objectStoreNames.contains(STORE_OFFLINE_QUEUE)) {
        const queueStore = database.createObjectStore(STORE_OFFLINE_QUEUE, { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('type', 'type', { unique: false });
        queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[DB] Offline queue store created');
      }
    };
  });
}

// Get all products from local DB
function dbGetAllProducts() {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[DB] Database not initialized');
      resolve([]);
      return;
    }

    const transaction = db.transaction([STORE_PRODUCTS], 'readonly');
    const store = transaction.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    request.onsuccess = function(event) {
      resolve(event.target.result || []);
    };

    request.onerror = function(event) {
      console.error('[DB] Get all products error:', event.target.error);
      resolve([]);
    };
  });
}

// Get product by barcode from local DB
function dbGetProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction([STORE_PRODUCTS], 'readonly');
    const store = transaction.objectStore(STORE_PRODUCTS);
    const request = store.get(barcode);

    request.onsuccess = function(event) {
      resolve(event.target.result || null);
    };

    request.onerror = function(event) {
      console.error('[DB] Get product by barcode error:', event.target.error);
      resolve(null);
    };
  });
}

// Search products from local DB (fast!)
function dbSearchProducts(query) {
  return new Promise((resolve, reject) => {
    if (!db || !query || query.length < 1) {
      resolve([]);
      return;
    }

    const q = query.toLowerCase();
    const transaction = db.transaction([STORE_PRODUCTS], 'readonly');
    const store = transaction.objectStore(STORE_PRODUCTS);
    const request = store.getAll();

    request.onsuccess = function(event) {
      const allProducts = event.target.result || [];
      const results = allProducts.filter(p =>
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.product.toLowerCase().includes(q) ||
        (p.batch && p.batch.toLowerCase().includes(q))
      );
      resolve(results.slice(0, 20));
    };

    request.onerror = function(event) {
      console.error('[DB] Search products error:', event.target.error);
      resolve([]);
    };
  });
}

// Save products to local DB (bulk) - using put() to handle existing keys
function dbSaveProducts(products) {
  return new Promise((resolve, reject) => {
    if (!db) {
      console.error('[DB] Database not initialized');
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_PRODUCTS], 'readwrite');
    const store = transaction.objectStore(STORE_PRODUCTS);

    // Clear existing products first (in same transaction)
    store.clear();

    transaction.oncomplete = function() {
      // New transaction for adding products
      const tx2 = db.transaction([STORE_PRODUCTS], 'readwrite');
      const store2 = tx2.objectStore(STORE_PRODUCTS);
      let count = 0;

      products.forEach(product => {
        // Use put() instead of add() - will update if exists
        const request = store2.put(product);
        request.onsuccess = function() {
          count++;
        };
      });

      tx2.oncomplete = function() {
        console.log('[DB] Saved', count, 'products to local DB');
        resolve(count);
      };

      tx2.onerror = function(event) {
        console.error('[DB] Save products error:', event.target.error);
        reject(event.target.error);
      };
    };

    transaction.onerror = function(event) {
      console.error('[DB] Clear error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Save a single product to local DB
function dbSaveProduct(product) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_PRODUCTS], 'readwrite');
    const store = transaction.objectStore(STORE_PRODUCTS);
    const request = store.put(product);

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Delete product from local DB
function dbDeleteProduct(barcode) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_PRODUCTS], 'readwrite');
    const store = transaction.objectStore(STORE_PRODUCTS);
    const request = store.delete(barcode);

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Save setting to local DB
function dbSaveSetting(key, value) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.put({ key: key, value: value });

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Get setting from local DB
function dbGetSetting(key) {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve(null);
      return;
    }

    const transaction = db.transaction([STORE_SETTINGS], 'readonly');
    const store = transaction.objectStore(STORE_SETTINGS);
    const request = store.get(key);

    request.onsuccess = function(event) {
      resolve(event.target.result ? event.target.result.value : null);
    };

    request.onerror = function(event) {
      resolve(null);
    };
  });
}

// Add to offline queue
function dbAddToOfflineQueue(type, data) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_OFFLINE_QUEUE);
    const request = store.add({
      type: type,
      data: data,
      timestamp: Date.now(),
      user: state.currentUser
    });

    request.onsuccess = function(event) {
      resolve(event.target.result);
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Get all pending offline items
function dbGetOfflineQueue() {
  return new Promise((resolve, reject) => {
    if (!db) {
      resolve([]);
      return;
    }

    const transaction = db.transaction([STORE_OFFLINE_QUEUE], 'readonly');
    const store = transaction.objectStore(STORE_OFFLINE_QUEUE);
    const request = store.getAll();

    request.onsuccess = function(event) {
      resolve(event.target.result || []);
    };

    request.onerror = function(event) {
      resolve([]);
    };
  });
}

// Clear offline queue item
function dbClearOfflineQueueItem(id) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_OFFLINE_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORE_OFFLINE_QUEUE);
    const request = store.delete(id);

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

// Get last sync time
function getLastSyncTime() {
  return new Promise(async (resolve) => {
    const setting = await dbGetSetting('lastSyncTime');
    resolve(setting);
  });
}

// Update last sync time
function updateLastSyncTime() {
  return dbSaveSetting('lastSyncTime', Date.now());
}

// Sync products from cloud to local DB
async function syncProductsToLocal() {
  console.log('[DB] Syncing products to local DB...');
  try {
    const result = await apiRequest('getProducts');
    if (result.success && result.data) {
      await dbSaveProducts(result.data);
      state.products = result.data;
      await updateLastSyncTime();
      console.log('[DB] Products synced:', result.data.length);
      showToast('Produk sinkronisasi (' + result.data.length + ' item)', 'success');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[DB] Sync error:', error);
    return false;
  }
}

// Load products from local DB (for offline mode)
async function loadProductsFromLocal() {
  console.log('[DB] Loading products from local DB...');
  try {
    const products = await dbGetAllProducts();
    state.products = products;
    console.log('[DB] Products loaded from local:', products.length);
    return products;
  } catch (error) {
    console.error('[DB] Load from local error:', error);
    return [];
  }
}

// Check if local DB has products
async function hasLocalProducts() {
  const products = await dbGetAllProducts();
  return products.length > 0;
}

console.log('[App] IndexedDB module loaded');


// ============================================
// INSTALL APP FEATURE
// ============================================

let deferredPrompt = null;

// Capture install prompt
window.addEventListener('beforeinstallprompt', function(e) {
  console.log('[App] Install prompt captured');
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

// Show install button
function showInstallButton() {
  const btn = document.getElementById('installBtn');
  if (btn && deferredPrompt) {
    btn.classList.add('show');
  }
}

// Install app
async function installApp() {
  if (!deferredPrompt) {
    showToast('App sudah terinstall atau tidak didukung', 'info');
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log('[App] Install prompt outcome:', outcome);

  if (outcome === 'accepted') {
    showToast('App berhasil diinstall!', 'success');
  }

  deferredPrompt = null;
  document.getElementById('installBtn').classList.remove('show');
}

// App installed
window.addEventListener('appinstalled', function() {
  console.log('[App] App installed successfully');
  showToast('App Stock Opname berhasil diinstall!', 'success');
  document.getElementById('installBtn').classList.remove('show');
  deferredPrompt = null;
});


// ============================================
// CONNECTION STATUS
// ============================================

function updateConnectionStatus() {
  const status = document.getElementById('connectionStatus');
  if (!status) return;

  if (navigator.onLine) {
    status.textContent = '🌐 Koneksi online';
    status.className = 'connection-status online';
  } else {
    status.textContent = '📴 Mode offline';
    status.className = 'connection-status offline';
  }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);


// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(function(registration) {
        console.log('[App] Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', function() {
          console.log('[App] New service worker found!');
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('Update tersedia! Refresh halaman untuk memperbarui.', 'info');
            }
          });
        });

        // Handle controller change (after update)
        navigator.serviceWorker.addEventListener('controllerchange', function() {
          console.log('[App] Controller changed - reloading');
          window.location.reload();
        });
      })
      .catch(function(err) {
        console.log('[App] Service Worker registration failed:', err);
      });

    // Handle messages from SW
    navigator.serviceWorker.addEventListener('message', function(event) {
      console.log('[App] Message from SW:', event.data);
      if (event.data.type === 'UPDATE_AVAILABLE') {
        showToast(event.data.message, 'info');
      }
    });
  } else {
    console.log('[App] Service Worker not supported');
  }
}

function checkForAppUpdate() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ action: 'checkForUpdates' });
  }
}






// ============================================
// GLOBAL DATE STATE
// ============================================

let globalSelectedDate = null; // Will be set on init

function getGlobalDate() {
  if (globalSelectedDate) return globalSelectedDate;
  var n = new Date();
  var m = n.getMonth() + 1;
  var d = n.getDate();
  var y = n.getFullYear();
  return m + '/' + d + '/' + y;
}

function formatDateDisplay(dateStr) {
  // Keep original format M/D/YYYY but pad with zeros
  var parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  var m = parts[0].padStart(2, '0');
  var d = parts[1].padStart(2, '0');
  var y = parts[2];
  return m + '/' + d + '/' + y;
}

function formatDateLabel(dateStr) {
  // Convert to human readable
  var parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;

  var months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var m = parseInt(parts[0]);
  var d = parseInt(parts[1]);
  var y = parts[2];

  // Check if today
  var today = new Date();
  var todayStr = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear();
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = (tomorrow.getMonth() + 1) + '/' + tomorrow.getDate() + '/' + tomorrow.getFullYear();

  if (dateStr === todayStr) return 'Hari Ini';
  if (dateStr === tomorrowStr) return 'Besok';
  return d + ' ' + months[m] + ' ' + y;
}

function updateAllDateDisplays() {
  var dateStr = globalSelectedDate || getGlobalDate();
  var display = formatDateDisplay(dateStr);
  var label = formatDateLabel(dateStr);

  // Update all date displays
  var displays = ['cycleDateDisplay', 'productInDateDisplay', 'globalDateDisplay'];
  displays.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = display;
  });

  // Update history date labels
  var historyDatePI = document.getElementById('historyDatePI');
  var historyDateCC = document.getElementById('historyDateCC');
  if (historyDatePI) historyDatePI.textContent = label;
  if (historyDateCC) historyDateCC.textContent = label;

  // Update date labels in history
  updateHistoryDateLabels(label);
}

function updateHistoryDateLabels(label) {
  var piEl = document.getElementById('historyDatePI');
  var ccEl = document.getElementById('historyDateCC');
  if (piEl) piEl.textContent = label;
  if (ccEl) ccEl.textContent = label;
}


// ============================================
// DATE PICKER - PRODUCT IN
// ============================================

function openProductInDatePicker() {
  var existing = document.getElementById('datePickerPIModal');
  if (existing) existing.remove();

  var current = globalSelectedDate || getGlobalDate();
  var parts = current.split('/');
  var curM = parts[0] ? parseInt(parts[0]) : new Date().getMonth() + 1;
  var curD = parts[1] ? parseInt(parts[1]) : new Date().getDate();
  var curY = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();

  var months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var opts = '';
  for (var i = 1; i <= 12; i++) {
    opts += '<option value="' + i + '"' + (i === curM ? ' selected' : '') + '>' + months[i] + '</option>';
  }

  var modal = document.createElement('div');
  modal.id = 'datePickerPIModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:white;border-radius:16px;padding:24px;width:340px;max-width:95vw;box-shadow:0 20px 40px rgba(0,0,0,0.2);">' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:20px;color:var(--gray-800);">📅 Pilih Tanggal</div>' +
      '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Bulan</label>' +
        '<select id="dpPIMonth" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' + opts + '</select>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tanggal</label>' +
          '<input type="number" id="dpPIDay" min="1" max="31" value="' + curD + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tahun</label>' +
          '<input type="number" id="dpPIYear" min="2020" max="2099" value="' + curY + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
      '</div>' +
      '<div id="dpPIPreview" style="background:var(--primary-light);padding:12px;border-radius:10px;text-align:center;font-weight:700;color:var(--primary);margin-bottom:20px;font-size:16px;">' + curM + '/' + curD + '/' + curY + '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button onclick="confirmProductInDate()" style="flex:1;padding:14px;background:var(--primary);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Pilih</button>' +
        '<button onclick="document.getElementById(\'datePickerPIModal\').remove()" style="flex:1;padding:14px;background:var(--gray-100);color:var(--gray-600);border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Batal</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('dpPIMonth').addEventListener('change', updatePIPreview);
  document.getElementById('dpPIDay').addEventListener('input', updatePIPreview);
  document.getElementById('dpPIYear').addEventListener('input', updatePIPreview);
}

function updatePIPreview() {
  var m = document.getElementById('dpPIMonth').value;
  var d = document.getElementById('dpPIDay').value;
  var y = document.getElementById('dpPIYear').value;
  var el = document.getElementById('dpPIPreview');
  if (el) el.textContent = m + '/' + d + '/' + y;
}

function confirmProductInDate() {
  var m = document.getElementById('dpPIMonth').value;
  var d = document.getElementById('dpPIDay').value;
  var y = document.getElementById('dpPIYear').value;
  if (!d || d < 1 || d > 31) { showToast('Tanggal tidak valid', 'error'); return; }

  var dateStr = m + '/' + d + '/' + y;
  globalSelectedDate = dateStr;

  document.getElementById('datePickerPIModal').remove();
  updateAllDateDisplays();
  showToast('Tanggal diubah ke: ' + formatDateDisplay(dateStr), 'success');
  loadDataForDate(dateStr);
}

async function loadDataForDate(date) {
  // Load both Product In and Cycle Count for the selected date
  var lb = document.getElementById('loadingBar');
  if (lb) lb.classList.add('show');

  var productInResult = await apiRequest('getProductIn', { date: date });
  if (productInResult.success) {
    state.productInList = productInResult.data;
    renderProductInList();
  }

  var cycleCountResult = await apiRequest('getCycleCount', { date: date });
  if (cycleCountResult.success) {
    state.cycleCountList = cycleCountResult.data;
    renderCycleCountList();
  }

  if (lb) lb.classList.remove('show');
}


// ============================================
// DATE PICKER - CYCLE COUNT
// ============================================

function openDatePicker() {
  var existing = document.getElementById('datePickerModal');
  if (existing) existing.remove();

  var current = globalSelectedDate || getGlobalDate();
  var parts = current.split('/');
  var curM = parts[0] ? parseInt(parts[0]) : new Date().getMonth() + 1;
  var curD = parts[1] ? parseInt(parts[1]) : new Date().getDate();
  var curY = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();

  var months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var opts = '';
  for (var i = 1; i <= 12; i++) {
    opts += '<option value="' + i + '"' + (i === curM ? ' selected' : '') + '>' + months[i] + '</option>';
  }

  var modal = document.createElement('div');
  modal.id = 'datePickerModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:white;border-radius:16px;padding:24px;width:340px;max-width:95vw;box-shadow:0 20px 40px rgba(0,0,0,0.2);">' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:20px;color:var(--gray-800);">📅 Pilih Tanggal</div>' +
      '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Bulan</label>' +
        '<select id="dpMonth" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' + opts + '</select>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tanggal</label>' +
          '<input type="number" id="dpDay" min="1" max="31" value="' + curD + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tahun</label>' +
          '<input type="number" id="dpYear" min="2020" max="2099" value="' + curY + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
      '</div>' +
      '<div id="dpPreview" style="background:var(--success-light);padding:12px;border-radius:10px;text-align:center;font-weight:700;color:var(--success);margin-bottom:20px;font-size:16px;">' + curM + '/' + curD + '/' + curY + '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button onclick="confirmDatePicker()" style="flex:1;padding:14px;background:var(--success);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Pilih</button>' +
        '<button onclick="document.getElementById(\'datePickerModal\').remove()" style="flex:1;padding:14px;background:var(--gray-100);color:var(--gray-600);border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Batal</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('dpMonth').addEventListener('change', updateDatePreview);
  document.getElementById('dpDay').addEventListener('input', updateDatePreview);
  document.getElementById('dpYear').addEventListener('input', updateDatePreview);
}

function updateDatePreview() {
  var m = document.getElementById('dpMonth').value;
  var d = document.getElementById('dpDay').value;
  var y = document.getElementById('dpYear').value;
  var el = document.getElementById('dpPreview');
  if (el) el.textContent = m + '/' + d + '/' + y;
}

function confirmDatePicker() {
  var m = document.getElementById('dpMonth').value;
  var d = document.getElementById('dpDay').value;
  var y = document.getElementById('dpYear').value;
  if (!d || d < 1 || d > 31) { showToast('Tanggal tidak valid', 'error'); return; }

  var dateStr = m + '/' + d + '/' + y;
  globalSelectedDate = dateStr;

  document.getElementById('datePickerModal').remove();
  updateAllDateDisplays();
  showToast('Tanggal diubah ke: ' + formatDateDisplay(dateStr), 'success');
  loadDataForDate(dateStr);
}

async function loadCycleCountForDate(date) {
  var result = await apiRequest('getCycleCount', { date: date });
  if (result.success) {
    state.cycleCountList = result.data;
    renderCycleCountList();
  }
}


// ============================================
// DATE PICKER - GLOBAL (FOR HISTORY)
// ============================================

function openGlobalDatePicker() {
  var existing = document.getElementById('datePickerGlobalModal');
  if (existing) existing.remove();

  var current = globalSelectedDate || getGlobalDate();
  var parts = current.split('/');
  var curM = parts[0] ? parseInt(parts[0]) : new Date().getMonth() + 1;
  var curD = parts[1] ? parseInt(parts[1]) : new Date().getDate();
  var curY = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();

  var months = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var opts = '';
  for (var i = 1; i <= 12; i++) {
    opts += '<option value="' + i + '"' + (i === curM ? ' selected' : '') + '>' + months[i] + '</option>';
  }

  var modal = document.createElement('div');
  modal.id = 'datePickerGlobalModal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML =
    '<div style="background:white;border-radius:16px;padding:24px;width:340px;max-width:95vw;box-shadow:0 20px 40px rgba(0,0,0,0.2);">' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:20px;color:var(--gray-800);">📅 Pilih Tanggal</div>' +
      '<div style="margin-bottom:16px;">' +
        '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Bulan</label>' +
        '<select id="dpGlobalMonth" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' + opts + '</select>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tanggal</label>' +
          '<input type="number" id="dpGlobalDay" min="1" max="31" value="' + curD + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
        '<div>' +
          '<label style="display:block;font-size:12px;font-weight:600;color:var(--gray-500);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Tahun</label>' +
          '<input type="number" id="dpGlobalYear" min="2020" max="2099" value="' + curY + '" style="width:100%;padding:12px;border:2px solid var(--gray-200);border-radius:10px;font-size:15px;">' +
        '</div>' +
      '</div>' +
      '<div id="dpGlobalPreview" style="background:var(--gray-100);padding:12px;border-radius:10px;text-align:center;font-weight:700;color:var(--gray-700);margin-bottom:20px;font-size:16px;">' + curM + '/' + curD + '/' + curY + '</div>' +
      '<div style="display:flex;gap:10px;">' +
        '<button onclick="confirmGlobalDate()" style="flex:1;padding:14px;background:var(--primary);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Pilih</button>' +
        '<button onclick="document.getElementById(\'datePickerGlobalModal\').remove()" style="flex:1;padding:14px;background:var(--gray-100);color:var(--gray-600);border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">Batal</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('dpGlobalMonth').addEventListener('change', updateGlobalPreview);
  document.getElementById('dpGlobalDay').addEventListener('input', updateGlobalPreview);
  document.getElementById('dpGlobalYear').addEventListener('input', updateGlobalPreview);
}

function updateGlobalPreview() {
  var m = document.getElementById('dpGlobalMonth').value;
  var d = document.getElementById('dpGlobalDay').value;
  var y = document.getElementById('dpGlobalYear').value;
  var el = document.getElementById('dpGlobalPreview');
  if (el) el.textContent = m + '/' + d + '/' + y;
}

function confirmGlobalDate() {
  var m = document.getElementById('dpGlobalMonth').value;
  var d = document.getElementById('dpGlobalDay').value;
  var y = document.getElementById('dpGlobalYear').value;
  if (!d || d < 1 || d > 31) { showToast('Tanggal tidak valid', 'error'); return; }

  var dateStr = m + '/' + d + '/' + y;
  globalSelectedDate = dateStr;

  document.getElementById('datePickerGlobalModal').remove();
  updateAllDateDisplays();
  showToast('Tanggal: ' + formatDateDisplay(dateStr), 'success');
  loadDataForDate(dateStr);
}


// ============================================
// HISTORY TAB FUNCTIONS
// ============================================

let currentHistoryTab = 'product-in';

function showHistoryTab(tab) {
  currentHistoryTab = tab;

  var tabPI = document.getElementById('historyTabPI');
  var tabCC = document.getElementById('historyTabCC');
  var contentPI = document.getElementById('historyContentPI');
  var contentCC = document.getElementById('historyContentCC');

  if (tab === 'product-in') {
    tabPI.style.background = 'var(--primary)';
    tabPI.style.color = 'white';
    tabCC.style.background = 'white';
    tabCC.style.color = 'var(--gray-600)';
    contentPI.style.display = 'block';
    contentCC.style.display = 'none';
  } else {
    tabCC.style.background = 'var(--success)';
    tabCC.style.color = 'white';
    tabPI.style.background = 'white';
    tabPI.style.color = 'var(--gray-600)';
    contentPI.style.display = 'none';
    contentCC.style.display = 'block';
  }
}

// Old date picker functions - moved to global date management above
