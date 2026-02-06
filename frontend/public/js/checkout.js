const API = `${Config.API_BASE}/api`;

function token() {
  return localStorage.getItem('token');
}

async function fetchCart() {
  const res = await fetch(`${API}/cart`, { headers: { 'Authorization': `Bearer ${token()}` } });
  return res.json();
}

function calcSubtotal(items) {
  return (items || []).reduce((sum, it) => {
    let price = Number(it.medicine?.price || 0);
    const discount = Number(it.medicine?.discount || 0);
    if (discount > 0) {
      price = price - (price * discount / 100);
    }
    return sum + price * Number(it.quantity || 0);
  }, 0);
}

function selectedPaymentMethod() {
  const el = document.querySelector('input[name="paymentMethod"]:checked');
  return el ? el.value : 'razorpay';
}

function getCodSurcharge() {
  const configured = Number(window.__COD_SURCHARGE__ || 0);
  return Number.isFinite(configured) ? configured : 0;
}

async function loadCheckoutMeta() {
  const res = await fetch(`${API}/orders/checkout-meta`, {
    headers: { 'Authorization': `Bearer ${token()}` }
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    window.__COD_SURCHARGE__ = Number(data.codSurchargeInr || 0);
    window.__DELIVERY_CHARGE__ = Number(data.deliveryChargeInr || 0);
    window.__ORDER_COUNT__ = Number(data.orderCount || 0);
  }
}

async function renderSummary() {
  const summary = document.getElementById('checkout-summary');
  const totalEl = document.getElementById('checkout-total');
  if (!summary || !totalEl) return;

  const cart = await fetchCart();
  summary.innerHTML = '';

  if (!cart.items?.length) {
    summary.innerHTML = '<div class="muted">Your cart is empty.</div>';
    totalEl.textContent = 'Rs. 0.00';
    return;
  }

  for (const item of cart.items) {
    const med = item.medicine;
    let price = Number(med?.price || 0);
    const discount = Number(med?.discount || 0);

    let line = 0;
    let priceDisplay = '';

    if (discount > 0) {
      const original = price;
      price = price - (price * discount / 100);
      line = price * Number(item.quantity || 0);
      priceDisplay = `
        <div style="text-align:right;">
          <div style="text-decoration:line-through;font-size:0.85em;color:#94a3b8;">Rs. ${(original * item.quantity).toFixed(2)}</div>
          <div>Rs. ${line.toFixed(2)}</div>
        </div>
      `;
    } else {
      line = price * Number(item.quantity || 0);
      priceDisplay = `<div class="muted">Rs. ${line.toFixed(2)}</div>`;
    }

    summary.innerHTML += `
      <div class="item" style="align-items:center;">
        <div class="meta">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
            <div><strong>${med?.name || 'Medicine'}</strong> × ${item.quantity}</div>
            ${priceDisplay}
          </div>
        </div>
      </div>
    `;
  }

  const subtotal = calcSubtotal(cart.items);

  // Delivery rule: First 3 free. Else: Free if > 500, else 40.
  const orderCount = window.__ORDER_COUNT__ || 0;
  let delivery = 0;
  if (orderCount < 3) {
    delivery = 0;
  } else {
    delivery = subtotal > 500 ? 0 : 40;
  }

  const method = selectedPaymentMethod();
  const cod = method === 'cod' ? getCodSurcharge() : 0;

  // Coupon logic removed
  const discount = 0;

  const total = Math.max(0, subtotal + delivery - discount + cod);

  summary.innerHTML += `
    <div style="border-top:1px solid rgba(255,255,255,0.1);margin-top:10px;padding-top:10px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9em;color:#94a3b8;">
        <div>Subtotal</div>
        <div>Rs. ${subtotal.toFixed(2)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9em;color:#94a3b8;">
        <div>Delivery Charge</div>
        <div>${delivery === 0 ? '<span style="color:#22c55e">Free</span>' : 'Rs. ' + delivery.toFixed(2)}</div>
      </div>
      ${cod > 0 ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9em;color:#94a3b8;">
        <div>COD Surcharge</div>
        <div>Rs. ${cod.toFixed(2)}</div>
      </div>` : ''}
    </div>
  `;

  totalEl.textContent = `Rs. ${total.toFixed(2)}`;
}

window.appliedCouponCode = '';
window.applyCoupon = function () {
  const code = String(document.getElementById('couponCode').value || '').trim().toUpperCase();
  if (!code) return;

  if (code === 'SAVE10' || code === 'FLAT50') {
    window.appliedCouponCode = code;
    renderSummary();
    alert('Coupon applied!');
  } else {
    alert('Invalid coupon code');
    window.appliedCouponCode = '';
    renderSummary();
  }
};

async function verifyRazorpayPayment(orderId, rsp) {
  const res = await fetch(`${API}/payments/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token()}`
    },
    body: JSON.stringify({
      orderId,
      razorpay_order_id: rsp.razorpay_order_id,
      razorpay_payment_id: rsp.razorpay_payment_id,
      razorpay_signature: rsp.razorpay_signature
    })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Payment verification failed');
}

window.placeOrder = async function placeOrder() {
  const address = String(document.getElementById('address')?.value || '').trim();
  const phone = String(document.getElementById('phone')?.value || '').trim();
  const couponCode = window.appliedCouponCode || '';
  const paymentMethod = selectedPaymentMethod();

  if (!address) return alert('Please enter your shipping address');
  if (!phone) return alert('Please enter your phone number');

  const res = await fetch(`${API}/orders/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token()}`
    },
    body: JSON.stringify({ address, phone, paymentMethod, couponCode })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || 'Checkout failed');

  // COD: backend already placed the order
  if (paymentMethod === 'cod') {
    alert('Order placed (COD)!');
    window.location.href = 'orders.html';
    return;
  }

  // Razorpay: open checkout
  if (!window.Razorpay) {
    alert('Razorpay SDK not loaded');
    return;
  }

  const options = {
    key: data.razorpay?.keyId,
    amount: data.razorpay?.amount,
    currency: data.razorpay?.currency || 'INR',
    name: 'MediCare',
    description: 'Order payment',
    order_id: data.razorpay?.orderId,
    handler: async function (response) {
      try {
        await verifyRazorpayPayment(data.order?._id, response);
        alert('Payment successful!');
        window.location.href = 'orders.html';
      } catch (e) {
        alert(e.message || 'Payment verification failed');
      }
    }
  };

  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function () {
    alert('Payment failed');
  });
  rzp.open();
};

// Keep summary updated when switching payment methods
document.addEventListener('change', (e) => {
  if (e.target && e.target.name === 'paymentMethod') {
    renderSummary();
  }
});

async function autoFillProfile() {
  try {
    const res = await fetch(`${API}/users/profile`, {
      headers: { 'Authorization': `Bearer ${token()}` }
    });
    if (!res.ok) return;
    const user = await res.json();

    // Only fill if empty to respect user's manual input if they reload or came back
    const addrEl = document.getElementById('address');
    if (addrEl && !addrEl.value && user.address) {
      addrEl.value = user.address;
    }

    const phoneEl = document.getElementById('phone');
    if (phoneEl && !phoneEl.value && user.phone) {
      phoneEl.value = user.phone;
    }
  } catch (e) {
    // ignore errors, just don't autofill
  }
}

window.onload = () => {
  loadCheckoutMeta().finally(() => renderSummary());
  autoFillProfile();
};