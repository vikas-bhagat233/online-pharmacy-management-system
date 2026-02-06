const API_BASE = Config.API_BASE;
const API = `${API_BASE}/api`;

const ORDERS_LIMIT = 30;
const MEDICINES_LIMIT = 30;

const LOW_STOCK_THRESHOLD = 10;

let ordersPage = 1;
let ordersHasMore = true;
let ordersAll = [];
let ordersSearch = '';

let medicinesPage = 1;
let medicinesHasMore = true;
let medicinesAll = [];
let medicinesSearch = '';

function debounce(fn, waitMs = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}` };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value ?? '—');
}

async function loadStats() {
  try {
    const data = await fetchJson(`${API}/admin/stats`, { headers: authHeaders() });
    setText('statTodaysOrders', data.todaysOrders);
    setText('statPendingDispatch', data.pendingDispatch);
    setText('statDeliveredToday', data.deliveredToday);
    setText('statCodPending', data.codPending);
    setText('statOverallDelivered', data.overallDelivered);
  } catch (e) {
    // keep UI usable even if stats fails
    setText('statTodaysOrders', '—');
    setText('statPendingDispatch', '—');
    setText('statDeliveredToday', '—');
    setText('statCodPending', '—');
    setText('statOverallDelivered', '—');
  }
}

async function loadLowStock() {
  const label = document.getElementById('lowStockThresholdLabel');
  if (label) label.textContent = String(LOW_STOCK_THRESHOLD);

  const container = document.getElementById('lowStockList');
  if (!container) return;
  container.textContent = 'Loading…';

  try {
    const data = await fetchJson(`${API}/admin/low-stock?threshold=${encodeURIComponent(String(LOW_STOCK_THRESHOLD))}&limit=10`, {
      headers: authHeaders()
    });

    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      container.textContent = 'All good — no low-stock medicines.';
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Category</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((m) => `
            <tr>
              <td><strong>${m.name || ''}</strong></td>
              <td>${m.category || ''}</td>
              <td>${m.stock ?? ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    container.textContent = 'Failed to load low-stock list.';
  }
}

function openCsvDownload(url) {
  // Uses Authorization header; we fetch and download as a blob.
  const token = localStorage.getItem('token');
  return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Download failed');
      }
      return res.blob();
    })
    .then((blob) => {
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = url.includes('orders.csv') ? 'orders-report.csv' : 'medicines-report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    });
}

function wireExports() {
  const ordersBtn = document.getElementById('exportOrdersBtn');
  const medsBtn = document.getElementById('exportMedicinesBtn');
  if (ordersBtn) {
    ordersBtn.addEventListener('click', async () => {
      try {
        const from = document.getElementById('exportFrom')?.value || '';
        const to = document.getElementById('exportTo')?.value || '';
        const status = document.getElementById('exportStatus')?.value || '';
        const qs = new URLSearchParams();
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);
        if (status) qs.set('status', status);
        await openCsvDownload(`${API}/admin/reports/orders.csv?${qs.toString()}`);
      } catch (e) {
        alert(e.message);
      }
    });
  }

  if (medsBtn) {
    medsBtn.addEventListener('click', async () => {
      try {
        const threshold = String(document.getElementById('exportMedThreshold')?.value || '').trim();
        const qs = new URLSearchParams();
        if (threshold) qs.set('threshold', threshold);
        await openCsvDownload(`${API}/admin/reports/medicines.csv?${qs.toString()}`);
      } catch (e) {
        alert(e.message);
      }
    });
  }
}

window.logout = function logout() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
  } catch (e) {
    // ignore
  }
  window.location.replace('login.html');
};

function escapeAttr(value) {
  return String(value ?? '').replaceAll('"', '&quot;');
}

function toMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toFixed(2);
}

// Global state for editing
let currentEditId = null;

function renderMedicines(medicines, more) {
  const container = document.getElementById('medicinesList');
  if (!container) return;

  if (!medicines.length) {
    container.textContent = 'No medicines yet.';
    return;
  }

  const rows = medicines.map((m) => {
    let img = '';
    if (m.image) {
      if (m.image.startsWith('http')) {
        img = m.image;
      } else {
        img = `${API_BASE}${m.image}`;
      }
    }
    const thumb = img
      ? `<img src="${img}" alt="${escapeAttr(m.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.12)"/>`
      : `<div style="width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06)"></div>`;

    return `
      <tr>
        <td style="width:56px">${thumb}</td>
        <td>
          <div><strong>${m.name || ''}</strong></div>
          <div class="muted">${m.category || ''}</div>
        </td>
        <td>
          <div>Rs. ${toMoney(m.price)}</div>
          ${m.discount > 0 ? `<div class="muted" style="font-size:0.85em;color:#16a34a;">-${m.discount}% off</div>` : ''}
        </td>
        <td>${m.stock ?? ''}</td>
        <td>
          <button class="secondary" type="button" style="margin-right:6px;" onclick="editMedicine('${m._id}')">Edit</button>
          <button class="secondary" type="button" onclick="deleteMedicine('${m._id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  const loadMore = more
    ? `<div class="actions" style="justify-content:center;"><button class="secondary" type="button" onclick="__loadMoreMedicines()">Load more</button></div>`
    : '';

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Medicine</th>
          <th>Price</th>
          <th>Stock</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${loadMore}
  `;
}

async function loadMedicines(reset = true) {
  const container = document.getElementById('medicinesList');
  if (!container) return;

  if (reset) {
    medicinesPage = 1;
    medicinesHasMore = true;
    medicinesAll = [];
    container.textContent = 'Loading…';
  }

  if (!medicinesHasMore) {
    renderMedicines(medicinesAll, false);
    return;
  }

  const qs = new URLSearchParams({ page: String(medicinesPage), limit: String(MEDICINES_LIMIT) });
  if (medicinesSearch) qs.set('search', medicinesSearch);
  const data = await fetchJson(`${API}/medicines?${qs.toString()}`);
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  medicinesHasMore = Boolean(data?.hasMore);
  medicinesPage += 1;
  medicinesAll = medicinesAll.concat(items);

  renderMedicines(medicinesAll, medicinesHasMore);
}

window.__loadMoreMedicines = function __loadMoreMedicines() {
  loadMedicines(false);
};

window.deleteMedicine = async function deleteMedicine(medicineId) {
  try {
    if (!confirm('Delete this medicine?')) return;
    await fetchJson(`${API}/medicines/${medicineId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    await loadMedicines(true);
  } catch (e) {
    alert(e.message);
  }
};

window.editMedicine = function editMedicine(id) {
  const m = medicinesAll.find((x) => String(x._id) === String(id));
  if (!m) return;

  currentEditId = id;
  const form = document.getElementById('medicineForm');
  if (!form) return;

  document.getElementById('mName').value = m.name || '';
  document.getElementById('mDesc').value = m.description || '';
  document.getElementById('mCategory').value = m.category || '';
  document.getElementById('mPrice').value = m.price || '';
  document.getElementById('mDiscount').value = m.discount || 0;
  document.getElementById('mStock').value = m.stock || '';
  document.getElementById('mRx').value = m.prescriptionRequired ? 'true' : 'false';

  // Update UI
  const title = document.getElementById('medicines');
  if (title) title.textContent = 'Edit Medicine';

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'Update Medicine';

  // Add cancel button if not present
  if (!document.getElementById('cancelEditBtn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'cancelEditBtn';
    btn.className = 'secondary';
    btn.textContent = 'Cancel';
    btn.style.marginLeft = '10px';
    btn.onclick = resetFormState;
    form.querySelector('.actions').appendChild(btn);
  }

  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

function resetFormState() {
  currentEditId = null;
  const form = document.getElementById('medicineForm');
  if (form) {
    form.reset();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Save Medicine';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.remove();
  }
  const title = document.getElementById('medicines');
  if (title) title.textContent = 'Add Medicine';
}

function renderOrders(orders, more) {
  const container = document.getElementById('ordersList');
  if (!container) return;

  if (!orders.length) {
    container.textContent = 'No orders yet.';
    return;
  }

  const statusOptions = [
    'pending',
    'payment_pending',
    'placed',
    'confirmed',
    'dispatched',
    'out_for_delivery',
    'delivered',
    'failed',
    'cancelled'
  ];

  const rows = orders.map((o) => {
    const user = o.user ? `${o.user.name || ''} (${o.user.email || ''})` : '';
    const items = (o.items || []).map((i) => `${i.medicine?.name || 'Item'} x ${i.quantity}`).join('<br/>');

    const currentStatus = String(o.status || 'pending');
    const select = `
      <select id="status-${o._id}">
        ${statusOptions.map((s) => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s.replaceAll('_', ' ')}</option>`).join('')}
      </select>
    `;

    const agentName = String(o.deliveryAgent?.name || o.delivery?.deliveryAgent?.name || '');
    const agentPhone = String(o.deliveryAgent?.phone || o.delivery?.deliveryAgent?.phone || '');

    return `
      <tr>
        <td>
          <div><strong>${o._id}</strong></div>
          <div class="muted">${o.createdAt ? new Date(o.createdAt).toLocaleString() : ''}</div>
        </td>
        <td>
          <div style="font-weight:600;">${user}</div>
          ${o.phone ? `<div class="muted" style="font-size:0.85em;margin-top:2px;">📞 ${o.phone}</div>` : ''}
        </td>
        <td>${o.address || ''}</td>
        <td>${items}</td>
        <td>Rs. ${toMoney(o.totalAmount)}</td>
        <td>
          <div style="display:grid;gap:8px;min-width:240px;">
            <div>
              <div class="muted" style="margin-bottom:6px;">Status</div>
              ${select}
            </div>
            <div>
              <div class="muted" style="margin-bottom:6px;">Delivery agent (required for out for delivery)</div>
              <input id="agentName-${o._id}" placeholder="Name" value="${escapeAttr(agentName)}" />
              <div style="height:8px"></div>
              <input id="agentPhone-${o._id}" placeholder="Phone" value="${escapeAttr(agentPhone)}" />
            </div>
            <div>
              <button type="button" onclick="updateOrderStatus('${o._id}')">Update</button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const loadMore = more
    ? `<div class="actions" style="justify-content:center;"><button class="secondary" type="button" onclick="__loadMoreOrders()">Load more</button></div>`
    : '';

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Address</th>
          <th>Items</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${loadMore}
  `;
}

async function loadOrders(reset = true) {
  const container = document.getElementById('ordersList');
  if (!container) return;

  if (reset) {
    ordersPage = 1;
    ordersHasMore = true;
    ordersAll = [];
    container.textContent = 'Loading…';
  }

  if (!ordersHasMore) {
    renderOrders(ordersAll, false);
    return;
  }

  const qs = new URLSearchParams({ page: String(ordersPage), limit: String(ORDERS_LIMIT) });
  if (ordersSearch) qs.set('search', ordersSearch);
  const data = await fetchJson(`${API}/admin/orders?${qs.toString()}`, { headers: authHeaders() });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);

  ordersHasMore = Boolean(data?.hasMore);
  ordersPage += 1;
  ordersAll = ordersAll.concat(items);

  renderOrders(ordersAll, ordersHasMore);
}

window.__loadMoreOrders = function __loadMoreOrders() {
  loadOrders(false);
};

window.updateOrderStatus = async function updateOrderStatus(orderId) {
  try {
    const status = document.getElementById(`status-${orderId}`)?.value;
    const deliveryAgentName = String(document.getElementById(`agentName-${orderId}`)?.value || '').trim();
    const deliveryAgentPhone = String(document.getElementById(`agentPhone-${orderId}`)?.value || '').trim();

    if (status === 'out_for_delivery' && !deliveryAgentName) {
      alert('Please enter delivery agent name before setting Out For Delivery.');
      return;
    }

    await fetchJson(`${API}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status, deliveryAgentName, deliveryAgentPhone })
    });

    await loadOrders();
    alert('Order updated');
  } catch (e) {
    alert(e.message);
  }
};

function wireForm() {
  const form = document.getElementById('medicineForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      const fd = new FormData();
      fd.append('name', document.getElementById('mName').value);
      fd.append('description', document.getElementById('mDesc').value);
      fd.append('category', document.getElementById('mCategory').value);
      fd.append('price', document.getElementById('mPrice').value);
      fd.append('discount', document.getElementById('mDiscount').value);
      fd.append('stock', document.getElementById('mStock').value);
      fd.append('prescriptionRequired', document.getElementById('mRx').value);

      const file = document.getElementById('mImage').files?.[0];
      if (file) fd.append('image', file);

      if (currentEditId) {
        await fetchJson(`${API}/medicines/${currentEditId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: fd
        });
        alert('Medicine updated');
        resetFormState();
      } else {
        await fetchJson(`${API}/medicines`, {
          method: 'POST',
          headers: authHeaders(),
          body: fd
        });
        alert('Medicine saved');
        form.reset();
      }

      await loadMedicines(true);
    } catch (err) {
      alert(err.message);
    }
  });
}

function wireSearch() {
  const medInput = document.getElementById('medicineSearch');
  const medClear = document.getElementById('medicineSearchClear');
  const ordersInput = document.getElementById('ordersSearch');
  const ordersClear = document.getElementById('ordersSearchClear');

  if (medInput) {
    const onMedChange = debounce(() => {
      medicinesSearch = String(medInput.value || '').trim();
      loadMedicines(true);
    }, 250);
    medInput.addEventListener('input', onMedChange);
  }

  if (medClear && medInput) {
    medClear.addEventListener('click', () => {
      medInput.value = '';
      medicinesSearch = '';
      loadMedicines(true);
    });
  }

  if (ordersInput) {
    const onOrdersChange = debounce(() => {
      ordersSearch = String(ordersInput.value || '').trim();
      loadOrders(true);
    }, 250);
    ordersInput.addEventListener('input', onOrdersChange);
  }

  if (ordersClear && ordersInput) {
    ordersClear.addEventListener('click', () => {
      ordersInput.value = '';
      ordersSearch = '';
      loadOrders(true);
    });
  }
}

async function loadDashboard() {
  try {
    wireForm();
    wireSearch();
    wireExports();

    // Socket.io for real-time updates
    if (window.io) {
      const socket = io(API_BASE);
      socket.on('order-cancelled', () => {
        // Refresh orders and stats without full page reload
        loadOrders(true);
        loadStats();
        alert('An order has been cancelled by the customer.');
      });
    }

    // Load all sections in parallel to reduce wait time
    await Promise.all([
      loadStats().catch(e => console.error('Stats failed', e)),
      loadLowStock().catch(e => console.error('Low stock failed', e)),
      loadMedicines().catch(e => console.error('Medicines failed', e)),
      loadOrders().catch(e => console.error('Orders failed', e))
    ]);
  } catch (e) {
    alert(e.message);
  }
}

window.switchTab = function (tabName) {
  // Update buttons
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().includes(tabName === 'orders' ? 'orders' : 'medicines')) {
      btn.classList.add('active');
    }
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const target = document.getElementById(`tab-${tabName}`);
  if (target) {
    target.classList.add('active');
  }
};

window.onload = loadDashboard;