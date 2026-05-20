// ============================================================
//  CLOSET ARCHIVE — server.js
//  Run with: node server/server.js
//  Serves the whole site + API endpoints for orders & contact.
//
//  FOLDER LAYOUT expected:
//    your-project/
//      index.html, shop.html, about.html, contact.html, ...
//      js/main.js
//      server/
//        server.js      ← this file
//        orders.json    ← auto-created
//        messages.json  ← auto-created
// ============================================================

const fs   = require('fs');
const http = require('http');
const path = require('path');

const PORT      = process.env.PORT || 3000;
const SITE_ROOT = path.join(__dirname, '..');          // parent folder = your HTML files
const DATA_DIR  = __dirname;                           // server/ folder stores JSON
const ORDERS_FILE  = path.join(DATA_DIR, 'orders.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// ── ADMIN PASSWORD (change this!) ─────────────────────────────
const ADMIN_PASS = process.env.ADMIN_PASS || 'closet2024';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp'
};

// ── JSON HELPERS ──────────────────────────────────────────────
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) || fallback; }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── READ REQUEST BODY ─────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end',  () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Bad JSON')); } });
    req.on('error', reject);
  });
}

// ── SEND JSON ─────────────────────────────────────────────────
function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(data));
}

// ── CLEAN STRING ──────────────────────────────────────────────
const clean = v => (typeof v === 'string' ? v.trim().slice(0, 500) : '');

// ── OPTIONAL: EMAIL NOTIFICATION ─────────────────────────────
// Set these env vars to get email alerts for new orders:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, OWNER_EMAIL
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.OWNER_EMAIL) {
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log('✉  Email notifications enabled →', process.env.OWNER_EMAIL);
  } catch { console.warn('nodemailer not installed — email alerts disabled.'); }
}

async function notifyOwner(subject, body) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to:   process.env.OWNER_EMAIL,
      subject,
      text: body
    });
  } catch (err) { console.warn('Email send failed:', err.message); }
}

// ── HTTP SERVER ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }

  // ── POST /api/orders  (place order) ────────────────────────
  if (method === 'POST' && url.pathname === '/api/orders') {
    try {
      const body = await readBody(req);
      const orders = readJson(ORDERS_FILE, {});
      const tn = clean(body.trackingNumber);
      if (!tn) return sendJson(res, 400, { ok: false, error: 'Missing tracking number' });

      orders[tn] = {
        trackingNumber: tn,
        status:   clean(body.status)   || 'Order Confirmed',
        fullName: clean(body.fullName),
        email:    clean(body.email),
        address:  clean(body.address),
        contact:  clean(body.contact),
        items:    Array.isArray(body.items) ? body.items : [],
        subtotal: Number(body.subtotal) || 0,
        discount: Number(body.discount) || 0,
        total:    Number(body.total)    || 0,
        placedAt: new Date().toISOString()
      };
      writeJson(ORDERS_FILE, orders);

      // Email alert
      const itemList = orders[tn].items.map(i => `  - ${i.title}  ₱${i.price}`).join('\n');
      await notifyOwner(
        `🛍 New Order — ${tn}`,
        `New order from ${orders[tn].fullName}\n\nTracking: ${tn}\nTotal: ₱${orders[tn].total}\nAddress: ${orders[tn].address}\nContact: ${orders[tn].contact}\n\nItems:\n${itemList}\n\nPlaced: ${orders[tn].placedAt}`
      );

      console.log(`[ORDER] ${tn} — ${orders[tn].fullName} — ₱${orders[tn].total}`);
      return sendJson(res, 200, { ok: true, trackingNumber: tn });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // ── GET /api/orders/:trackingNumber  (track order) ─────────
  const trackMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (method === 'GET' && trackMatch) {
    const orders = readJson(ORDERS_FILE, {});
    const order  = orders[decodeURIComponent(trackMatch[1])];
    if (!order) return sendJson(res, 404, { ok: false, error: 'Not found' });
    return sendJson(res, 200, { ok: true, order });
  }

  // ── PUT /api/orders/:trackingNumber  (update status — admin) ─
  if (method === 'PUT' && trackMatch) {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + ADMIN_PASS) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body   = await readBody(req);
      const orders = readJson(ORDERS_FILE, {});
      const tn     = decodeURIComponent(trackMatch[1]);
      if (!orders[tn]) return sendJson(res, 404, { ok: false, error: 'Order not found' });
      if (body.status) orders[tn].status = clean(body.status);
      writeJson(ORDERS_FILE, orders);
      console.log(`[STATUS] ${tn} → ${orders[tn].status}`);
      return sendJson(res, 200, { ok: true, order: orders[tn] });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // ── GET /api/orders  (list all — admin) ────────────────────
  if (method === 'GET' && url.pathname === '/api/orders') {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + ADMIN_PASS) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const orders = readJson(ORDERS_FILE, {});
    const list   = Object.values(orders).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
    return sendJson(res, 200, { ok: true, orders: list });
  }

  // ── POST /api/contact ───────────────────────────────────────
  if (method === 'POST' && url.pathname === '/api/contact') {
    try {
      const body = await readBody(req);
      const messages = readJson(MESSAGES_FILE, []);
      const entry = {
        name:     clean(body.name),
        address:  clean(body.address),
        phone:    clean(body.phone),
        facebook: clean(body.facebook),
        message:  clean(body.message),
        savedAt:  new Date().toISOString()
      };
      messages.push(entry);
      writeJson(MESSAGES_FILE, messages);
      await notifyOwner(
        `💬 Contact Message from ${entry.name}`,
        `Name: ${entry.name}\nPhone: ${entry.phone}\nFacebook: ${entry.facebook}\nAddress: ${entry.address}\n\n${entry.message}`
      );
      console.log(`[CONTACT] ${entry.name}`);
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  // ── SERVE STATIC FILES ──────────────────────────────────────
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;

  // Serve admin.html from server/ folder
  if (filePath === '/admin.html') {
    filePath = path.join(DATA_DIR, 'admin.html');
  } else {
    filePath = path.join(SITE_ROOT, filePath.replace(/\.\./g, ''));
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      return res.end('<h2>404 — Page not found</h2>');
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║    CLOSET ARCHIVE SERVER RUNNING     ║');
  console.log(`  ║    http://localhost:${PORT}              ║`);
  console.log(`  ║    Admin → http://localhost:${PORT}/admin.html ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});