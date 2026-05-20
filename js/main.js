// ============================================================
//  CLOSET ARCHIVE — main.js
//  Works offline (localStorage) AND online (Node server).
//  Deploy with server.js for a real shop experience.
// ============================================================

// ── CONFIG ──────────────────────────────────────────────────
// When running with server.js these point to your Node server.
// When opened as a plain file they fall back to localStorage.
const SERVER_ORIGIN   = '';          // leave empty → same origin
const ORDER_API_URL   = SERVER_ORIGIN + '/api/orders';
const CONTACT_API_URL = SERVER_ORIGIN + '/api/contact';
const CONTACT_EMAIL   = 'closetarchive@gmail.com'; // fallback mailto

// ── KEYS ────────────────────────────────────────────────────
const CART_KEY   = 'closetArchiveCart';
const ORDERS_KEY = 'closetArchiveOrders';

const ORDER_STATUSES = [
    'Order Confirmed',
    'Preparing Your Order',
    'Shipped',
    'Out for Delivery',
    'Delivered'
];

// ── CART STORAGE ─────────────────────────────────────────────
function getCartItems() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
}
function saveCartItems(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
}

// ── ORDER STORAGE ─────────────────────────────────────────────
function getOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || {}; }
    catch { return {}; }
}
function saveOrders(orders) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// ── HELPERS ──────────────────────────────────────────────────
function formatPeso(v) { return '₱' + Number(v).toFixed(2); }

function calculateTotals(items) {
    const subtotal = items.reduce((s, i) => s + Number(i.price), 0);
    return { subtotal, discount: 0, total: subtotal };
}

function createTrackingNumber() {
    return 'CA' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 9000 + 1000);
}

// ── CART BADGE (header icon) ─────────────────────────────────
function updateCartBadge() {
    const items = getCartItems();
    document.querySelectorAll('.cart-badge, .cart-count').forEach(el => {
        el.textContent = items.length;
        el.style.display = items.length ? 'flex' : 'none';
    });
}

// ── ADD TO CART ──────────────────────────────────────────────
function addToCart(product) {
    const items = getCartItems();
    items.push({
        entryId: Date.now() + Math.floor(Math.random() * 1000),
        productId: product.id,
        title:     product.title,
        price:     Number(product.price),
        image:     product.image
    });
    saveCartItems(items);
    showToast('✓ Added to cart — ' + product.title);
    renderCartItems();
}

// ── TOAST NOTIFICATION ────────────────────────────────────────
function showToast(msg) {
    let toast = document.getElementById('ca-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ca-toast';
        toast.style.cssText = [
            'position:fixed','bottom:24px','left:50%','transform:translateX(-50%) translateY(20px)',
            'background:#041e42','color:#FFEBAF','padding:12px 24px','border-radius:8px',
            'font-size:13px','font-weight:600','letter-spacing:.5px','z-index:9999',
            'opacity:0','transition:all .3s ease','pointer-events:none','white-space:nowrap'
        ].join(';');
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2800);
}

// ── RENDER CART TABLE ─────────────────────────────────────────
function renderCartItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    const items = getCartItems();
    container.innerHTML = '';

    if (!items.length) {
        container.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#818ea0;">Your cart is empty.</td></tr>';
        const btn = document.getElementById('checkout-button');
        if (btn) btn.disabled = true;
        updateCartSummary([]);
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');

        // Remove button
        const tdRemove = document.createElement('td');
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-item';
        removeBtn.innerHTML = '&times;';
        removeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;color:#c00;';
        removeBtn.addEventListener('click', () => {
            removeCartItem(item.entryId);
            showToast('Item removed from cart');
        });
        tdRemove.appendChild(removeBtn);

        // Image
        const tdImg = document.createElement('td');
        const img = document.createElement('img');
        img.src = item.image; img.alt = item.title; img.width = 70;
        img.style.borderRadius = '6px';
        tdImg.appendChild(img);

        // Title
        const tdTitle = document.createElement('td');
        tdTitle.textContent = item.title;

        // Price
        const tdPrice = document.createElement('td');
        tdPrice.textContent = formatPeso(item.price);
        tdPrice.style.fontWeight = '700';

        tr.append(tdRemove, tdImg, tdTitle, tdPrice);
        container.appendChild(tr);
    });

    const btn = document.getElementById('checkout-button');
    if (btn) btn.disabled = false;
    updateCartSummary(items);
}

function updateCartSummary(items) {
    const t = calculateTotals(items);
    const sub = document.getElementById('subtotal-amount');
    const tot = document.getElementById('total-amount');
    if (sub) sub.textContent = formatPeso(t.subtotal);
    if (tot) tot.textContent = formatPeso(t.total);
}

function removeCartItem(entryId) {
    saveCartItems(getCartItems().filter(i => i.entryId !== entryId));
    renderCartItems();
}

// ── CHECKOUT SUMMARY ──────────────────────────────────────────
function renderCheckoutSummary() {
    const items     = getCartItems();
    const container = document.getElementById('checkout-order-items');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const discountEl = document.getElementById('checkout-discount');
    const totalEl    = document.getElementById('checkout-total');
    const placeBtn   = document.getElementById('place-order-button');

    if (!container) return;
    container.innerHTML = '';

    if (!items.length) {
        container.innerHTML = '<p style="color:#818ea0;font-size:14px;">Your cart is empty. Add items before checking out.</p>';
        if (placeBtn) placeBtn.disabled = true;
        if (subtotalEl) subtotalEl.textContent = formatPeso(0);
        if (totalEl) totalEl.textContent = formatPeso(0);
        return;
    }

    if (placeBtn) placeBtn.disabled = false;

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item';
        row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0ede6;font-size:13px;';
        row.innerHTML = `<span style="flex:1;margin-right:12px;">${item.title}</span><span style="font-weight:700;white-space:nowrap;">${formatPeso(item.price)}</span>`;
        container.appendChild(row);
    });

    const t = calculateTotals(items);
    if (subtotalEl) subtotalEl.textContent = formatPeso(t.subtotal);
    if (discountEl) discountEl.textContent = '–₱0.00';
    if (totalEl) totalEl.textContent = formatPeso(t.total);
}

// ── SEND ORDER TO SERVER ──────────────────────────────────────
async function sendOrderToServer(order) {
    if (!window.location.protocol.startsWith('http')) return false;
    try {
        const res = await fetch(ORDER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        if (res.ok) {
            const json = await res.json();
            return json && json.ok;
        }
    } catch (err) {
        console.warn('Could not reach order server:', err.message);
    }
    return false;
}

// ── PLACE ORDER ───────────────────────────────────────────────
async function placeOrder(event) {
    event.preventDefault();

    const items = getCartItems();
    if (!items.length) {
        showCheckoutMessage('Your cart is empty.', false);
        return;
    }

    const firstName = document.getElementById('first-name')?.value.trim()        || '';
    const lastName  = document.getElementById('last-name')?.value.trim()         || '';
    const email     = document.getElementById('email')?.value.trim()             || '';
    const address   = document.getElementById('complete-address')?.value.trim()  || '';
    const contact   = document.getElementById('contact-number')?.value.trim()    || '';
    const fullName  = (firstName + ' ' + lastName).trim();

    if (!fullName || !address || !contact || !email) {
        showCheckoutMessage('Please complete all required fields.', false);
        return;
    }

    if (!/^[0-9+\-\s]{7,18}$/.test(contact)) {
        showCheckoutMessage('Please enter a valid contact number.', false);
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showCheckoutMessage('Please enter a valid email address.', false);
        return;
    }

    const btn = document.getElementById('place-order-button');
    if (btn) { btn.disabled = true; btn.textContent = 'Placing order…'; }

    const totals        = calculateTotals(items);
    const trackingNumber = createTrackingNumber();
    const order = {
        trackingNumber,
        status:    ORDER_STATUSES[0],
        fullName,
        email,
        address,
        contact,
        items,
        subtotal:  totals.subtotal,
        discount:  totals.discount,
        total:     totals.total,
        placedAt:  new Date().toISOString()
    };

    // Save locally first (always works)
    const orders = getOrders();
    orders[trackingNumber] = order;
    saveOrders(orders);

    // Try to also save on server
    const savedOnline = await sendOrderToServer(order);

    // Clear cart
    saveCartItems([]);
    renderCartItems();
    renderCheckoutSummary();

    if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }

    const msg = savedOnline
        ? `✓ Order placed! Your tracking number is ${trackingNumber}. The shop has been notified.`
        : `✓ Order placed! Your tracking number is ${trackingNumber}. Screenshot this and message us on Facebook if you have questions.`;

    showCheckoutMessage(msg, true);

    // Scroll to message
    document.getElementById('checkout-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showCheckoutMessage(msg, success) {
    const el = document.getElementById('checkout-message');
    if (!el) return;
    el.textContent = msg;
    el.style.cssText = `color:${success ? '#0c5' : '#c00'};font-weight:600;font-size:14px;padding:12px;border-radius:6px;background:${success ? '#eaf6ee' : '#fdecea'};margin-bottom:16px;`;
}

function showCartMessage(msg, success) {
    const el = document.getElementById('cart-message');
    if (!el) return;
    el.textContent = msg;
    el.style.color = success ? '#0c5' : '#c00';
}

// ── ORDER TRACKING ────────────────────────────────────────────
function initTrackingForm() {
    const form = document.getElementById('tracking-form');
    if (!form) return;

    form.addEventListener('submit', async event => {
        event.preventDefault();
        const input   = document.getElementById('tracking-number-input')?.value.trim();
        const result  = document.getElementById('tracking-result');
        if (!result || !input) return;

        result.innerHTML = '<p style="color:#818ea0;">Looking up your order…</p>';

        let order = getOrders()[input] || null;

        // Try server if not found locally
        if (!order && window.location.protocol.startsWith('http')) {
            try {
                const res = await fetch(`${ORDER_API_URL}/${encodeURIComponent(input)}`);
                if (res.ok) {
                    const json = await res.json();
                    order = json?.ok ? json.order : null;
                }
            } catch (err) {
                console.warn('Tracking API unavailable, using local only.');
            }
        }

        if (!order) {
            result.innerHTML = '<p style="color:#c00;font-weight:600;">Tracking number not found. Please check and try again.</p>';
            return;
        }

        const itemsList = order.items?.map(i =>
            `<li style="padding:4px 0;font-size:13px;">${i.title} — ${formatPeso(i.price)}</li>`
        ).join('') || '';

        const statusIndex = ORDER_STATUSES.indexOf(order.status);
        const steps = ORDER_STATUSES.map((s, i) => {
            const done = i < statusIndex;
            const active = i === statusIndex;
            const color = done || active ? '#041e42' : '#ccc';
            const icon  = done ? '✓' : active ? '●' : '○';
            return `<li style="padding:4px 0;font-size:13px;color:${color};font-weight:${active ? '700' : '400'};">${icon} ${s}</li>`;
        }).join('');

        result.innerHTML = `
            <div style="background:#f8f7f2;border-radius:10px;padding:24px;border:1px solid #e0ddd5;">
                <h3 style="color:#041e42;font-size:16px;margin-bottom:16px;">Order Status</h3>
                <p style="margin:0 0 6px;font-size:13px;"><strong>Tracking Number:</strong> ${order.trackingNumber}</p>
                <p style="margin:0 0 6px;font-size:13px;"><strong>Name:</strong> ${order.fullName}</p>
                <p style="margin:0 0 6px;font-size:13px;"><strong>Address:</strong> ${order.address}</p>
                <p style="margin:0 0 16px;font-size:13px;"><strong>Total:</strong> ${formatPeso(order.total)}</p>

                <h4 style="color:#041e42;font-size:14px;margin-bottom:10px;">Items Ordered:</h4>
                <ul style="list-style:none;padding:0;margin:0 0 16px;">${itemsList}</ul>

                <h4 style="color:#041e42;font-size:14px;margin-bottom:10px;">Delivery Progress:</h4>
                <ul style="list-style:none;padding:0;margin:0;">${steps}</ul>

                <p style="font-size:11px;color:#818ea0;margin-top:16px;">Placed: ${new Date(order.placedAt).toLocaleString()}</p>
            </div>`;
    });
}

// ── SETUP SHOP BUTTONS ────────────────────────────────────────
function setupAddToCartButtons() {
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
        // Prevent double-binding
        if (btn.dataset.cartBound) return;
        btn.dataset.cartBound = '1';

        btn.addEventListener('click', event => {
            event.preventDefault();
            addToCart({
                id:    btn.dataset.productId    || Date.now(),
                title: btn.dataset.productTitle || 'Product',
                price: parseFloat(btn.dataset.productPrice) || 0,
                image: btn.dataset.productImage || 'img/products/f1.jpg'
            });
        });
    });
}

// ── CART PAGE ─────────────────────────────────────────────────
function initCartPage() {
    const btn = document.getElementById('checkout-button');
    if (btn) btn.addEventListener('click', () => { window.location.href = 'checkout.html'; });
    renderCartItems();
}

// ── CHECKOUT PAGE ─────────────────────────────────────────────
function initCheckoutPage() {
    const form = document.getElementById('checkout-form');
    if (!form) return;
    form.addEventListener('submit', placeOrder);
    renderCheckoutSummary();
}

// ── CONTACT PAGE ──────────────────────────────────────────────
function saveOfflineContact(data) {
    try {
        const key = 'closetArchiveOfflineMessages';
        const arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.push({ ...data, savedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(arr));
        return true;
    } catch { return false; }
}

function initContactPage() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const statusEl = document.getElementById('contact-status');
        const btn = form.querySelector('button[type="submit"]');

        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        if (statusEl) { statusEl.textContent = 'Sending…'; statusEl.style.color = '#222'; }

        const data = {
            name:     form.elements['name']?.value.trim()    || '',
            address:  form.elements['address']?.value.trim() || '',
            phone:    form.elements['phone']?.value.trim()   || '',
            facebook: form.elements['facebook']?.value.trim()|| '',
            message:  form.elements['message']?.value.trim() || ''
        };

        let sent = false;
        if (CONTACT_API_URL && window.location.protocol.startsWith('http')) {
            try {
                const res = await fetch(CONTACT_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (res.ok && (await res.json())?.ok) sent = true;
            } catch (err) { console.warn('Contact API failed:', err.message); }
        }

        if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }

        if (sent) {
            if (statusEl) { statusEl.textContent = '✓ Message sent! We will reply on Messenger soon.'; statusEl.style.color = '#0c5'; }
            form.reset();
        } else {
            saveOfflineContact(data);
            if (statusEl) { statusEl.textContent = '✓ Message saved. We will get back to you on Messenger.'; statusEl.style.color = '#0c5'; }
            form.reset();
        }
    });
}

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    setupAddToCartButtons();
    initCartPage();
    initCheckoutPage();
    initTrackingForm();
    initContactPage();
});