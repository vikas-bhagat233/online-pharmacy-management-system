const API_BASE = Config.API_BASE;

const API = `${API_BASE}/api`;

let socket = null;
let ordersById = new Map();

function authToken() {
  return localStorage.getItem('token');
}

function money(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(2) : String(v ?? '');
}

function fmtTime(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '';
  }
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `Request failed: ${res.status} ${res.statusText} (${url})`;
    throw new Error(msg);
  }
  return data;
}

function statusLabel(s) {
  return String(s || '').replaceAll('_', ' ');
}

function getStatusTime(order, status) {
  const hist = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  const hit = hist
    .filter((h) => String(h?.status) === String(status))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .at(-1);
  return hit?.at || null;
}

function renderTimeline(order) {
  const steps = ['placed', 'confirmed', 'dispatched', 'out_for_delivery', 'delivered'];
  const current = String(order.status || 'pending');
  const idx = steps.indexOf(current);

  const items = steps.map((s, i) => {
    const done = idx >= 0 ? i <= idx : false;
    const t = getStatusTime(order, s);
    const dot = done
      ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#6d5efc,#2dd4bf);"></span>'
      : '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.18);"></span>';
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        ${dot}
        <div>
          <div style="font-weight:800;">${escapeHtml(statusLabel(s))}</div>
          <div class="muted" style="font-size:12px;">${t ? escapeHtml(fmtTime(t)) : '—'}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<div style="display:grid;gap:10px;">${items}</div>`;
}

function renderOrderCard(order) {
  const id = String(order._id);
  const items = (order.items || []).map((it) => {
    const name = it.medicine?.name || 'Item';
    const qty = Number(it.quantity || 0);
    const price = Number(it.price ?? it.medicine?.price ?? 0);
    return `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:14px;color:#555;">
        <span>${escapeHtml(name)} <span class="muted">× ${qty}</span></span>
        <span>Rs. ${money(price * qty)}</span>
    </div>`;
  }).join('');

  const statusClass = `status-${String(order.status || 'pending').toLowerCase()}`;
  const statusText = statusLabel(order.status).toUpperCase();

  const agentName = String(order.deliveryAgent?.name || order.delivery?.deliveryAgent?.name || '').trim();
  const agentPhone = String(order.deliveryAgent?.phone || order.delivery?.deliveryAgent?.phone || '').trim();
  const agentBlock = (String(order.status) === 'out_for_delivery' || String(order.status) === 'delivered') && agentName
    ? `<div style="margin-top:12px; padding-top:12px; border-top:1px dashed #ddd; font-size:13px;">
         <span class="muted">Delivery Agent:</span> <strong>${escapeHtml(agentName)}</strong> (${escapeHtml(agentPhone)})
       </div>`
    : '';

  const cancellable = ['pending', 'payment_pending', 'placed', 'confirmed'];
  const canCancel = cancellable.includes(String(order.status).toLowerCase());

  const cancelBtn = canCancel
    ? `<button class="danger" type="button" onclick="cancelOrder('${id}')" style="font-size:12px; padding:6px 12px; width:auto; margin-top:10px; background:white; border:1px solid #dc2626; color:#dc2626; margin-right:8px;">Cancel Order</button>`
    : '';

  const invoiceBtn = String(order.status) === 'delivered'
    ? `<button class="secondary" type="button" onclick="downloadInvoice('${id}')" style="font-size:12px; padding:6px 12px; width:auto; margin-top:10px;">Download Invoice</button>`
    : '';

  return `
    <div class="order-card" id="order-${id}">
      <div class="order-header">
        <div>
           <span style="font-weight:700; color:#333;">Order #${id.slice(-6).toUpperCase()}</span>
           <div class="muted" style="font-size:12px; margin-top:2px;">${escapeHtml(fmtTime(order.createdAt))}</div>
        </div>
        <div style="text-align:right;">
           <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
           <div style="font-weight:700; color:#333; margin-top:6px;">Rs. ${money(order.totalAmount)}</div>
        </div>
      </div>
      
      <div class="order-items">
         ${items}
      </div>

      ${agentBlock}
      
      ${invoiceBtn || cancelBtn ? `<div style="text-align:right;">${cancelBtn}${invoiceBtn}</div>` : ''}
    </div>
  `;
}

function renderOrders() {
  const list = Array.from(ordersById.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const legacy = document.getElementById('orders');
  const activeEl = document.getElementById('activeOrders');
  const pastEl = document.getElementById('pastOrders');

  // Backward compatibility: if the page still has only #orders, render everything there.
  if (legacy && !activeEl && !pastEl) {
    if (!list.length) {
      legacy.innerHTML = '<div class="muted">No orders yet.</div>';
      return;
    }
    legacy.innerHTML = list.map(renderOrderCard).join('');
    return;
  }

  const isPast = (order) => {
    const s = String(order?.status || '').toLowerCase();
    return ['delivered', 'failed', 'cancelled'].includes(s);
  };

  const active = list.filter((o) => !isPast(o));
  const past = list.filter(isPast);

  if (activeEl) {
    activeEl.innerHTML = active.length
      ? active.map(renderOrderCard).join('')
      : '<div class="muted">No active orders.</div>';
  }

  if (pastEl) {
    pastEl.innerHTML = past.length
      ? past.map(renderOrderCard).join('')
      : '<div class="muted">No past orders yet.</div>';
  }
}

function ensureSocket() {
  if (socket) return;
  if (typeof window.io !== 'function') return;

  socket = window.io(API_BASE, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    // Join rooms for all current orders
    for (const id of ordersById.keys()) {
      socket.emit('join-order', id);
    }
  });

  socket.on('orderUpdate', (payload) => {
    const updated = payload?.order;
    if (!updated?._id) return;
    ordersById.set(String(updated._id), updated);
    renderOrders();
  });
}

async function loadOrders() {
  const token = authToken();
  const legacy = document.getElementById('orders');
  const activeEl = document.getElementById('activeOrders');
  const pastEl = document.getElementById('pastOrders');

  const setLoading = (el) => { if (el) el.innerHTML = '<div class="muted">Loading…</div>'; };
  setLoading(legacy);
  setLoading(activeEl);
  setLoading(pastEl);

  try {
    const orders = await fetchJson(`${API}/orders/my-orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Orders loaded:', orders);
    ordersById = new Map((Array.isArray(orders) ? orders : []).map((o) => [String(o._id), o]));
    renderOrders();
    ensureSocket();

    // Join rooms now (in case socket already connected)
    if (socket?.connected) {
      for (const id of ordersById.keys()) socket.emit('join-order', id);
    }
  } catch (e) {
    console.error('Load Error:', e);
    const errHtml = `<div class="error" style="color:red; padding:20px; border:1px solid red; background:#fff5f5;">
      <strong>Error loading orders:</strong> ${e.message}<br/>
      <small>API: ${API}/orders/my-orders</small>
    </div>`;

    if (activeEl) activeEl.innerHTML = errHtml;
    else if (legacy) legacy.innerHTML = errHtml;

    if (pastEl) pastEl.innerHTML = '';
  }
}

window.cancelOrder = async function cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) return;
  try {
    const token = authToken();
    await fetchJson(`${API}/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    alert('Order cancelled successfully.');
    loadOrders(); // Refresh list
  } catch (e) {
    alert(e.message);
  }
};

window.downloadInvoice = async function downloadInvoice(orderId) {
  try {
    const token = authToken();
    const requestUrl = `${API}/orders/${encodeURIComponent(orderId)}/invoice?format=pdf`;
    const res = await fetch(requestUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();

    // If server returned JSON/HTML, show it instead of saving a broken PDF.
    if (!res.ok || !contentType.includes('application/pdf')) {
      const text = await res.text().catch(() => '');
      let message = 'Failed to download invoice.';
      try {
        const maybeJson = JSON.parse(text);
        message = maybeJson?.error || message;
      } catch {
        if (text) message = text;
      }
      throw new Error(message);
    }

    const buf = await res.arrayBuffer();
    const sig = new Uint8Array(buf.slice(0, 4));
    const isPdf = sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46; // %PDF
    if (!isPdf) {
      throw new Error('Invoice response is not a valid PDF.');
    }

    const blob = new Blob([buf], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `invoice-${orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    alert(e.message);
  }
};

window.onload = () => {
  loadOrders().catch((e) => alert(e.message));
};