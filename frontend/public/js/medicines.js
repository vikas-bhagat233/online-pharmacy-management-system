function renderMedicines(list) {
  const container = document.getElementById('medicines');
  if (!container) return;

  container.innerHTML = '';
  // Ensure the container has the grid class
  container.className = 'product-grid';
  container.style.display = 'grid'; // Force display grid just in case inline styles messed it up

  list.forEach((med) => {
    let imgUrl = 'https://placehold.co/300x300?text=No+Image';
    if (med.image) {
      if (med.image.startsWith('http')) {
        imgUrl = med.image;
      } else {
        imgUrl = `http://localhost:5000${med.image}`;
      }
    }

    // safe null checks
    const stock = med.stock ?? 0;
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 10;

    // Stock Badge
    let stockBadge = '';
    if (isOutOfStock) {
      stockBadge = `<span class="badge out-of-stock">Out of stock</span>`;
    } else if (isLowStock) {
      stockBadge = `<span class="badge low-stock">Low stock</span>`;
    }

    // Button
    const addBtn = isOutOfStock
      ? `<button type="button" class="btn-primary disabled" disabled>Out of Stock</button>`
      : `<button type="button" class="btn-primary" onclick="addToCart('${med._id}')">Add to Cart</button>`;

    // Price determination
    const originalPrice = Number(med.price || 0);
    const discount = Number(med.discount || 0);
    let finalPrice = originalPrice;
    let priceHtml = '';

    if (discount > 0) {
      finalPrice = originalPrice - (originalPrice * discount / 100);
      priceHtml = `
        <div style="display:flex;flex-direction:column;align-items:flex-start;">
           <div style="font-size:0.85em;text-decoration:line-through;color:#94a3b8;">Rs. ${originalPrice.toFixed(2)}</div>
           <div style="color:#0f172a;font-weight:700;">Rs. ${finalPrice.toFixed(2)} <span style="font-size:0.8em;color:#16a34a;font-weight:400;">(${discount}% off)</span></div>
        </div>
      `;
    } else {
      priceHtml = `<span class="currency">Rs. </span><span class="price">${originalPrice.toFixed(2)}</span>`;
    }

    container.innerHTML += `
      <div class="product-card">
        <div class="product-image-wrapper">
          <img src="${imgUrl}" alt="${med.name}" loading="lazy" />
        </div>
        <div class="product-content">
          <h3 class="product-title" title="${med.name}">${med.name}</h3>
          
          <div class="product-meta">
             <span class="product-category">${med.category || 'General'}</span>
             ${stockBadge}
          </div>

          <div class="product-price-row">
            ${priceHtml}
          </div>

          <p class="product-description" title="${med.description || ''}">
            ${med.description || 'No description available.'}
          </p>

          <div class="product-actions">
            ${addBtn}
          </div>
        </div>
      </div>
    `;
  });
}

const API = `${Config.API_BASE}/api`;
let allMedicines = [];
let currentPage = 1;
let hasMore = true;
let currentSearch = '';
let currentCategory = '';

async function fetchCategories() {
  try {
    const res = await fetch(`${API}/medicines/categories`);
    if (!res.ok) return;
    const categories = await res.json();

    const container = document.getElementById('categoryFilters');
    if (!container) return;
    container.innerHTML = '';

    // Add 'All' chip
    const allChip = document.createElement('button');
    allChip.className = 'secondary';
    allChip.textContent = 'All';
    allChip.style.borderRadius = '20px';
    allChip.style.padding = '6px 16px';
    allChip.style.fontSize = '14px';
    if (currentCategory === '') {
      allChip.style.background = '#007185';
      allChip.style.color = 'white';
      allChip.style.borderColor = '#007185';
    }
    allChip.onclick = () => setCategory('');
    container.appendChild(allChip);

    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'secondary';
      chip.textContent = cat;
      chip.style.borderRadius = '20px';
      chip.style.padding = '6px 16px';
      chip.style.fontSize = '14px';

      if (currentCategory === cat) {
        chip.style.background = '#007185';
        chip.style.color = 'white';
        chip.style.borderColor = '#007185';
      }

      chip.onclick = () => setCategory(cat);
      container.appendChild(chip);
    });
  } catch (e) {
    // ignore
  }
}

function setCategory(cat) {
  currentCategory = cat;
  const container = document.getElementById('categoryFilters');
  if (container) {
    Array.from(container.children).forEach(btn => {
      if (btn.textContent === (cat || 'All')) {
        btn.style.background = '#007185';
        btn.style.color = 'white';
        btn.style.borderColor = '#007185';
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }
    });
  }
  fetchMedicines({ reset: true });
}

function ensureLoadMoreButton() {
  const container = document.getElementById('medicines');
  if (!container) return;
  if (document.getElementById('loadMore')) return;

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'center';
  wrap.style.marginTop = '14px';

  const btn = document.createElement('button');
  btn.id = 'loadMore';
  btn.type = 'button';
  btn.className = 'secondary';
  btn.textContent = 'Load more';
  btn.onclick = () => fetchMedicines();

  wrap.appendChild(btn);
  container.parentElement?.appendChild(wrap);
}

async function fetchMedicines({ reset = false } = {}) {
  if (reset) {
    currentPage = 1;
    hasMore = true;
    allMedicines = [];
  }
  if (!hasMore) return;

  const qs = new URLSearchParams({
    page: String(currentPage),
    limit: '30',
    search: currentSearch
  });
  if (currentCategory) qs.set('category', currentCategory);

  const res = await fetch(`${API}/medicines?${qs.toString()}`);
  const data = await res.json().catch(() => ({}));

  const items = Array.isArray(data?.items)
    ? data.items
    : (Array.isArray(data) ? data : []);

  hasMore = Boolean(data?.hasMore);
  currentPage += 1;
  allMedicines = allMedicines.concat(items);
  renderMedicines(allMedicines);

  const loadMoreBtn = document.getElementById('loadMore');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
  }
}

function wireSearch() {
  const searchInput = document.getElementById('search');
  if (!searchInput) return;

  let t = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      currentSearch = String(searchInput.value || '').trim();
      fetchMedicines({ reset: true });
    }, 250);
  });
}

window.addToCart = async function addToCart(medicineId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please login first');
    return;
  }

  const res = await fetch(`${API}/cart/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ medicineId, quantity: 1 })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(data.error || 'Failed to add to cart');
    return;
  }

  alert('Added to cart');
};

window.onload = async () => {
  ensureLoadMoreButton();
  wireSearch();
  await fetchCategories();
  await fetchMedicines({ reset: true });
};