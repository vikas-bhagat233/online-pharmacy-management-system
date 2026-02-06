const API = `${Config.API_BASE}/api`;

function token() {
  return localStorage.getItem('token');
}

async function fetchCart() {
  const res = await fetch(`${API}/cart`, { headers: { 'Authorization': `Bearer ${token()}` } });
  return res.json();
}

function calcTotal(items) {
  return (items || []).reduce((sum, it) => {
    const price = Number(it.medicine?.price || 0);
    return sum + price * Number(it.quantity || 0);
  }, 0);
}

function renderCart(cart) {
  const container = document.getElementById('cart-items');
  if (!container) return;
  container.innerHTML = '';

  // Ensure base styling when the page uses theme.css
  container.className = 'cart-grid'; // Use grid layout

  // Calculate counts
  const itemCount = (cart.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Update badge
  const badge = document.getElementById('cart-count-badge');
  if (badge) {
    badge.textContent = `(${itemCount} item${itemCount === 1 ? '' : 's'})`;
  }

  // Handle Empty State
  const checkoutBtn = document.getElementById('checkout-btn');
  if (!cart.items?.length) {
    container.className = 'list'; // Switch back to list for simple message
    container.innerHTML = '<div class="muted">Your cart is empty.</div>';
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.classList.add('disabled'); // Ensure style reflects state
    }
    return;
  }

  // Enable button if items exist
  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.classList.remove('disabled');
  }

  cart.items.forEach((item) => {
    const med = item.medicine;
    let img = '<div style="height:180px; background:#eee; display:flex; align-items:center; justify-content:center; border-radius:4px;">No Image</div>';
    if (med?.image) {
      if (med.image.startsWith('http')) {
        img = `<img src="${med.image}" alt="${med.name}" />`;
      } else {
        img = `<img src="${Config.API_BASE}${med.image}" alt="${med.name}" />`;
      }
    }
    const lineTotal = Number(med?.price || 0) * Number(item.quantity || 0);

    container.innerHTML += `
      <div class="cart-item">
        ${img}
        <div class="meta">
          <div>
            <div style="font-weight:700; margin-bottom:4px; font-size:16px;">${med?.name || 'Medicine'}</div>
            <div style="color:#b12704; font-weight:700;">Rs. ${med?.price ?? ''}</div>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <div class="actions" style="margin:0;">
                <button type="button" class="secondary" style="padding:4px 10px;" onclick="changeQty('${med?._id}', ${Number(item.quantity) - 1})">−</button>
                <span class="badge" style="font-size:14px; margin:0 5px;">${item.quantity}</span>
                <button type="button" class="secondary" style="padding:4px 10px;" onclick="changeQty('${med?._id}', ${Number(item.quantity) + 1})">+</button>
             </div>
             <button type="button" class="danger" style="padding:4px 10px; font-size:12px; width:auto; background:#fff; border:1px solid #d5d9d9; color:#111;" onclick="removeItem('${med?._id}')">Remove</button>
          </div>
          
          <div style="margin-top:auto; font-size:13px; color:#555; border-top:1px solid #eee; padding-top:8px;">
             Subtotal: <span style="font-weight:700; color:#111;">Rs. ${lineTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    `;
  });

  const total = calcTotal(cart.items);
  container.innerHTML += `
    <div class="card pad soft" style="margin-top:12px;">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
        <div><strong>Subtotal</strong></div>
        <div><strong>Rs. ${total.toFixed(2)}</strong></div>
      </div>
      <div class="muted" style="margin-top:6px;">Shipping/COD charges shown at checkout.</div>
    </div>
  `;
}

window.changeQty = async function changeQty(medicineId, quantity) {
  if (quantity < 0) return;
  await fetch(`${API}/cart/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token()}`
    },
    body: JSON.stringify({ medicineId, quantity })
  });
  const cart = await fetchCart();
  renderCart(cart);
};

window.removeItem = async function removeItem(medicineId) {
  await fetch(`${API}/cart/remove/${medicineId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token()}` }
  });
  const cart = await fetchCart();
  renderCart(cart);
};

async function getCart() {
  const cart = await fetchCart();
  renderCart(cart);
}

window.onload = getCart;