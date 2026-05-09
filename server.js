'use strict';

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const nodemailer = require('nodemailer');

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const CONTACT_RECEIVER_EMAIL = process.env.CONTACT_RECEIVER_EMAIL || SMTP_USER;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY || '';

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const PUBLIC_DIR = path.join(ROOT, 'public');
const VIEWS_DIR = path.join(ROOT, 'views');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DEFAULT_CONTENT_FILE = path.join(DATA_DIR, 'content.default.json');

[DATA_DIR, SESSIONS_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Seed content.json from the shipped defaults on first boot.
if (!fs.existsSync(CONTENT_FILE) && fs.existsSync(DEFAULT_CONTENT_FILE)) {
  fs.copyFileSync(DEFAULT_CONTENT_FILE, CONTENT_FILE);
}

// Seed admin user from env on first boot.
if (!fs.existsSync(USERS_FILE)) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';
  const hash = bcrypt.hashSync(password, 12);
  fs.writeFileSync(USERS_FILE, JSON.stringify({ username, passwordHash: hash }, null, 2));
  console.log(`[init] Wrote ${USERS_FILE}. Default login: ${username} / ${password}`);
  console.log('[init] Change the password from /admin immediately.');
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://www.google.com", "https://www.gstatic.com"],
        'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        'font-src': ["'self'", "https://fonts.gstatic.com", 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'connect-src': ["'self'", "https://www.google.com"],
        'frame-src': ["https://www.google.com"],
        'frame-ancestors': ["'none'"],
        // Disabled so internal-IP HTTP dev (e.g. http://192.168.x.x:3000 from
        // a phone) works. Without this, helmet's default would force every
        // subresource (/js/*, /uploads/*) to be requested over HTTPS, which
        // silently fails because no HTTPS server is running locally.
        'upgrade-insecure-requests': null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

app.use(
  session({
    name: 'hosslimo.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new FileStore({
      path: SESSIONS_DIR,
      retries: 1,
      ttl: 60 * 60 * 8,
      logFn: () => {},
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// CSRF protection — applied to state-changing routes.
const csrfProtection = csrf();

// ----- Helpers --------------------------------------------------------------

async function readJson(file) {
  const raw = await fsp.readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

// ----- Email & reCAPTCHA helpers -------------------------------------------

function createMailer() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET_KEY) return true;  // not configured → skip check
  if (!token) {
    console.warn('[recaptcha] no token in request body — frontend may not be loading the reCAPTCHA script');
    return false;
  }
  return new Promise((resolve) => {
    const body =
      'secret=' + encodeURIComponent(RECAPTCHA_SECRET_KEY) +
      '&response=' + encodeURIComponent(String(token).slice(0, 8192));
    const req = https.request(
      {
        hostname: 'www.google.com',
        path: '/recaptcha/api/siteverify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const r = JSON.parse(data);
            const ok = r.success === true && (r.score === undefined || r.score >= 0.5);
            if (!ok) {
              console.warn('[recaptcha] verification failed:', JSON.stringify(r));
            }
            resolve(ok);
          } catch (err) {
            console.warn('[recaptcha] could not parse Google response:', err.message, '| body:', data.slice(0, 200));
            resolve(false);
          }
        });
      }
    );
    req.on('error', (err) => {
      console.warn('[recaptcha] network error reaching Google:', err.message);
      resolve(true); // network error → allow through
    });
    req.write(body);
    req.end();
  });
}

function buildPlainText(e) {
  const line = (label, val) => (val ? `${label}: ${val}` : null);
  const parts = [
    'Neue Anfrage – Hosslimo',
    '='.repeat(50),
    `Eingegangen: ${new Date(e.receivedAt).toLocaleString('de-AT')}`,
    '',
    '--- Kontakt ---',
    line('Name', e.name),
    line('E-Mail', e.email),
    line('Telefon', e.phone),
  ];
  if (e.service || e.vehicle || e.datetime || e.pickup || e.dropoff) {
    parts.push('', '--- Fahrtwunsch ---');
    parts.push(line('Anlass', e.service));
    parts.push(line('Fahrzeug', e.vehicle));
    parts.push(line('Datum / Uhrzeit', e.datetime));
    parts.push(line('Abholung', e.pickup));
    parts.push(line('Ziel', e.dropoff));
  }
  parts.push('', '--- Nachricht ---', e.message, '', '='.repeat(50), `ID: ${e.id}`);
  return parts.filter((x) => x !== null).join('\n');
}

function buildHtmlEmail(e) {
  const row = (label, val) =>
    val
      ? `<tr><td style="padding:6px 16px 6px 0;color:#888;white-space:nowrap;font-size:13px;vertical-align:top">${label}</td><td style="padding:6px 0;color:#1a1a1a;font-size:13px">${val}</td></tr>`
      : '';
  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const tripSection =
    e.service || e.vehicle || e.datetime || e.pickup || e.dropoff
      ? `<h3 style="margin:24px 0 12px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:1.5px;font-weight:600">Fahrtwunsch</h3>
         <table cellpadding="0" cellspacing="0" style="width:100%">
           ${row('Anlass', esc(e.service))}
           ${row('Fahrzeug', esc(e.vehicle))}
           ${row('Datum / Uhrzeit', esc(e.datetime))}
           ${row('Abholung', esc(e.pickup))}
           ${row('Ziel', esc(e.dropoff))}
         </table>`
      : '';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:32px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;width:100%">
  <tr><td style="background:#050505;padding:26px 36px 24px">
    <span style="font-family:'Times New Roman',serif;font-style:italic;font-size:22px;color:#f1ece2;letter-spacing:1px">Hosslimo</span>
    <span style="display:block;font-size:10px;color:#c9a86a;letter-spacing:3px;text-transform:uppercase;margin-top:5px">Neue Anfrage</span>
  </td></tr>
  <tr><td style="padding:32px 36px">
    <p style="margin:0 0 24px;font-size:12px;color:#999">Eingegangen am ${esc(new Date(e.receivedAt).toLocaleString('de-AT'))}</p>
    <h3 style="margin:0 0 12px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:1.5px;font-weight:600">Kontakt</h3>
    <table cellpadding="0" cellspacing="0" style="width:100%">
      ${row('Name', esc(e.name))}
      ${row('E-Mail', `<a href="mailto:${esc(e.email)}" style="color:#c9a86a">${esc(e.email)}</a>`)}
      ${e.phone ? row('Telefon', `<a href="tel:${esc(e.phone)}" style="color:#c9a86a">${esc(e.phone)}</a>`) : ''}
    </table>
    ${tripSection}
    <h3 style="margin:24px 0 12px;font-size:12px;color:#555;text-transform:uppercase;letter-spacing:1.5px;font-weight:600">Nachricht</h3>
    <div style="background:#f9f9f9;border-left:3px solid #c9a86a;padding:14px 18px;font-size:13px;color:#333;line-height:1.75;white-space:pre-wrap">${esc(e.message)}</div>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:14px 36px;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#bbb">ID: ${esc(e.id)} · Automatisch gesendet von der Hosslimo-Website.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildReplyPlainText(inquiry, body) {
  const greeting = inquiry.name ? `Sehr geehrte/r ${inquiry.name},` : 'Sehr geehrte/r Interessent/in,';
  return [
    greeting,
    '',
    body,
    '',
    'Mit freundlichen Grüßen',
    'Hoss Limousine Service e.U.',
    '',
    '— — — — — — — — — — — — — — — — — — — —',
    'Ihre ursprüngliche Anfrage:',
    inquiry.message || '',
  ].join('\n');
}

function buildReplyHtml(inquiry, body) {
  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const greeting = inquiry.name ? `Sehr geehrte/r ${esc(inquiry.name)},` : 'Sehr geehrte/r Interessent/in,';
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:32px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background:#fff;max-width:580px;width:100%">
  <tr><td style="background:#050505;padding:26px 36px 24px">
    <span style="font-family:'Times New Roman',serif;font-style:italic;font-size:22px;color:#f1ece2;letter-spacing:1px">Hosslimo</span>
    <span style="display:block;font-size:10px;color:#c9a86a;letter-spacing:3px;text-transform:uppercase;margin-top:5px">Antwort auf Ihre Anfrage</span>
  </td></tr>
  <tr><td style="padding:32px 36px;color:#1a1a1a;font-size:14px;line-height:1.7">
    <p style="margin:0 0 18px">${greeting}</p>
    <div style="white-space:pre-wrap">${esc(body)}</div>
    <p style="margin:24px 0 0">Mit freundlichen Grüßen<br><strong>Hoss Limousine Service e.U.</strong></p>
  </td></tr>
  ${
    inquiry.message
      ? `<tr><td style="background:#f9f9f9;padding:20px 36px;border-top:1px solid #eee;color:#666;font-size:12px;line-height:1.65">
           <p style="margin:0 0 8px;color:#999;text-transform:uppercase;letter-spacing:1.5px;font-size:10px">Ihre ursprüngliche Anfrage</p>
           <div style="white-space:pre-wrap">${esc(inquiry.message)}</div>
         </td></tr>`
      : ''
  }
</table>
</td></tr>
</table>
</body>
</html>`;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/admin/login');
}

// ----- Public static --------------------------------------------------------

// Public content endpoint — drives the one-page site.
app.get('/api/content', async (req, res, next) => {
  try {
    const content = await readJson(CONTENT_FILE);
    res.json(content);
  } catch (err) {
    next(err);
  }
});

// Public config — exposes only the reCAPTCHA site key (never the secret).
app.get('/api/config', (req, res) => {
  res.json({ recaptchaSiteKey: RECAPTCHA_SITE_KEY });
});

// Contact submission — stored as a flat JSON log file. Owner views from dashboard.
const contactLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 8, standardHeaders: true });
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, phone, message, pickup, dropoff, datetime, vehicle, service, hp, recaptchaToken } = req.body || {};

  // Honeypot — silent drop.
  if (hp) return res.json({ ok: true });

  // reCAPTCHA verification (skipped when RECAPTCHA_SECRET_KEY is not configured).
  const captchaOk = await verifyRecaptcha(recaptchaToken);
  if (!captchaOk) {
    return res.status(400).json({ error: 'Sicherheitsüberprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.' });
  }

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, E-Mail und Nachricht sind erforderlich.' });
  }
  if (String(message).length > 4000) return res.status(400).json({ error: 'Nachricht zu lang.' });

  const entry = {
    id: crypto.randomBytes(8).toString('hex'),
    receivedAt: new Date().toISOString(),
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    phone: phone ? String(phone).slice(0, 80) : '',
    service: service ? String(service).slice(0, 120) : '',
    pickup: pickup ? String(pickup).slice(0, 300) : '',
    dropoff: dropoff ? String(dropoff).slice(0, 300) : '',
    datetime: datetime ? String(datetime).slice(0, 80) : '',
    vehicle: vehicle ? String(vehicle).slice(0, 80) : '',
    message: String(message).slice(0, 4000),
    ip: req.ip,
  };

  const file = path.join(DATA_DIR, 'inquiries.json');
  let list = [];
  try { list = await readJson(file); } catch {}
  list.unshift(entry);
  await writeJsonAtomic(file, list.slice(0, 1000));

  // Send email notification — fire-and-forget; a save error must not block the response.
  const mailer = createMailer();
  if (mailer && CONTACT_RECEIVER_EMAIL) {
    mailer
      .sendMail({
        from: `"Hosslimo Anfrage" <${SMTP_USER}>`,
        to: CONTACT_RECEIVER_EMAIL,
        replyTo: entry.email,
        subject: `Neue Anfrage: ${entry.name}`,
        text: buildPlainText(entry),
        html: buildHtmlEmail(entry),
      })
      .catch((err) => console.error('[mail] send error:', err.message));
  }

  res.json({ ok: true });
});

// ----- Auth -----------------------------------------------------------------

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true });

app.get('/admin/login', csrfProtection, (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.sendFile(path.join(VIEWS_DIR, 'admin-login.html'));
});

app.get('/api/csrf', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.post('/api/login', loginLimiter, csrfProtection, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing credentials' });
  let user;
  try {
    user = await readJson(USERS_FILE);
  } catch {
    return res.status(500).json({ error: 'user store unavailable' });
  }
  const ok =
    typeof user.username === 'string' &&
    user.username === String(username) &&
    bcrypt.compareSync(String(password), user.passwordHash || '');
  if (!ok) {
    // constant-ish delay to slow down guessing
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ error: 'invalid credentials' });
  }
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'session error' });
    req.session.user = { username: user.username };
    req.session.save(() => res.json({ ok: true }));
  });
});

app.post('/api/logout', csrfProtection, requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('hosslimo.sid');
    res.json({ ok: true });
  });
});

// ----- Admin (protected) ----------------------------------------------------

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, 'admin.html'));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.put('/api/content', requireAuth, csrfProtection, async (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'invalid body' });
  }
  // Strip dangerous keys; rely on JSON shape since the dashboard is the only writer.
  const sanitized = sanitizeContent(incoming);
  await writeJsonAtomic(CONTENT_FILE, sanitized);
  res.json({ ok: true, content: sanitized });
});

app.post('/api/password', requireAuth, csrfProtection, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 10) {
    return res.status(400).json({ error: 'new password must be at least 10 characters' });
  }
  const user = await readJson(USERS_FILE);
  if (!bcrypt.compareSync(String(currentPassword), user.passwordHash)) {
    return res.status(401).json({ error: 'current password is incorrect' });
  }
  user.passwordHash = bcrypt.hashSync(String(newPassword), 12);
  await writeJsonAtomic(USERS_FILE, user);
  res.json({ ok: true });
});

app.get('/api/inquiries', requireAuth, async (req, res) => {
  const file = path.join(DATA_DIR, 'inquiries.json');
  try {
    const list = await readJson(file);
    res.json(list);
  } catch {
    res.json([]);
  }
});

app.delete('/api/inquiries/:id', requireAuth, csrfProtection, async (req, res) => {
  const file = path.join(DATA_DIR, 'inquiries.json');
  let list = [];
  try {
    list = await readJson(file);
  } catch {}
  const next = list.filter((x) => x.id !== req.params.id);
  await writeJsonAtomic(file, next);
  res.json({ ok: true });
});

// Reply to an inquiry — sends SMTP email to the original sender and persists
// the message on the inquiry so the admin sees the conversation history.
const replyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true });
app.post('/api/inquiries/:id/reply', replyLimiter, requireAuth, csrfProtection, async (req, res) => {
  const body = String((req.body && req.body.body) || '').trim();
  if (!body) return res.status(400).json({ error: 'Antworttext fehlt.' });
  if (body.length > 8000) return res.status(400).json({ error: 'Antwort zu lang.' });

  const file = path.join(DATA_DIR, 'inquiries.json');
  let list = [];
  try { list = await readJson(file); } catch {}
  const idx = list.findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
  const inquiry = list[idx];
  if (!inquiry.email) return res.status(400).json({ error: 'Keine Empfänger-E-Mail in der Anfrage.' });

  const mailer = createMailer();
  if (!mailer) return res.status(503).json({ error: 'SMTP ist nicht konfiguriert.' });

  try {
    await mailer.sendMail({
      from: `"Hosslimo" <${SMTP_USER}>`,
      to: inquiry.email,
      replyTo: CONTACT_RECEIVER_EMAIL || SMTP_USER,
      subject: `Antwort auf Ihre Anfrage – Hosslimo`,
      text: buildReplyPlainText(inquiry, body),
      html: buildReplyHtml(inquiry, body),
    });
  } catch (err) {
    console.error('[mail] reply error:', err.message);
    return res.status(502).json({ error: 'E-Mail konnte nicht gesendet werden.' });
  }

  const reply = {
    id: crypto.randomBytes(6).toString('hex'),
    at: new Date().toISOString(),
    body,
    by: (req.session.user && req.session.user.username) || 'admin',
  };
  inquiry.replies = Array.isArray(inquiry.replies) ? inquiry.replies : [];
  inquiry.replies.push(reply);
  list[idx] = inquiry;
  await writeJsonAtomic(file, list);
  res.json({ ok: true, reply, inquiry });
});

// ----- Image upload ---------------------------------------------------------

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) return cb(new Error('unsupported file type'));
      const safe = path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .slice(0, 60) || 'image';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ALLOWED_EXT.has(ext) ? null : new Error('unsupported file type'), ALLOWED_EXT.has(ext));
  },
});

app.post('/api/upload', requireAuth, csrfProtection, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    res.json({ ok: true, url: `/uploads/${req.file.filename}` });
  });
});

app.get('/api/uploads', requireAuth, async (req, res) => {
  const files = await fsp.readdir(UPLOADS_DIR);
  const items = files
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ name: f, url: `/uploads/${f}` }));
  res.json(items);
});

app.delete('/api/uploads/:name', requireAuth, csrfProtection, async (req, res) => {
  const name = path.basename(req.params.name);
  const target = path.join(UPLOADS_DIR, name);
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return res.status(400).json({ error: 'bad path' });
  try {
    await fsp.unlink(target);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: 'not found' });
  }
});

// ----- Static & fallthrough -------------------------------------------------

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (/\.(?:png|jpg|jpeg|webp|avif|gif|svg|woff2?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      } else if (/\.html$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// Index fallback for the SPA-ish single page.
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ----- Error handlers -------------------------------------------------------

app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'invalid csrf token' });
  }
  console.error('[error]', err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'internal error' });
  res.status(500).send('Internal Server Error');
});

// ----- Sanitization ---------------------------------------------------------

function asString(v, max = 2000) {
  if (v == null) return '';
  return String(v).slice(0, max);
}

function asUrl(v) {
  const s = asString(v, 1000).trim();
  if (!s) return '';
  // Allow only relative paths or http(s) URLs.
  if (s.startsWith('/') || /^https?:\/\//i.test(s)) return s;
  return '';
}

function sanitizeContent(c) {
  const out = {};
  out.brand = {
    name: asString(c?.brand?.name, 80),
    tagline: asString(c?.brand?.tagline, 160),
    logoText: asString(c?.brand?.logoText, 40),
  };
  out.contact = {
    phone: asString(c?.contact?.phone, 60),
    phoneHref: asString(c?.contact?.phoneHref, 60),
    email: asString(c?.contact?.email, 120),
    whatsapp: asString(c?.contact?.whatsapp, 60),
    whatsappHref: asString(c?.contact?.whatsappHref, 200),
    address: asString(c?.contact?.address, 240),
    hours: asString(c?.contact?.hours, 200),
  };
  out.hero = {
    eyebrow: asString(c?.hero?.eyebrow, 80),
    title: asString(c?.hero?.title, 240),
    subtitle: asString(c?.hero?.subtitle, 400),
    primaryCta: asString(c?.hero?.primaryCta, 60),
    secondaryCta: asString(c?.hero?.secondaryCta, 60),
    backgroundImage: asUrl(c?.hero?.backgroundImage),
  };
  out.about = {
    eyebrow: asString(c?.about?.eyebrow, 80),
    title: asString(c?.about?.title, 240),
    body: asString(c?.about?.body, 4000),
    image: asUrl(c?.about?.image),
    highlights: Array.isArray(c?.about?.highlights)
      ? c.about.highlights.slice(0, 8).map((h) => ({
          icon: asString(h?.icon, 40),
          title: asString(h?.title, 120),
          text: asString(h?.text, 400),
        }))
      : [],
  };
  out.services = Array.isArray(c?.services)
    ? c.services.slice(0, 24).map((s) => ({
        icon: asString(s?.icon, 40),
        title: asString(s?.title, 120),
        text: asString(s?.text, 600),
      }))
    : [];
  out.fleet = Array.isArray(c?.fleet)
    ? c.fleet.slice(0, 24).map((v) => ({
        name: asString(v?.name, 80),
        category: asString(v?.category, 60),
        passengers: asString(v?.passengers, 20),
        luggage: asString(v?.luggage, 20),
        features: Array.isArray(v?.features)
          ? v.features.slice(0, 12).map((f) => asString(f, 80))
          : [],
        image: asUrl(v?.image),
      }))
    : [];
  out.testimonials = Array.isArray(c?.testimonials)
    ? c.testimonials.slice(0, 16).map((t) => ({
        author: asString(t?.author, 120),
        role: asString(t?.role, 120),
        quote: asString(t?.quote, 800),
      }))
    : [];
  out.certifications = Array.isArray(c?.certifications)
    ? c.certifications.slice(0, 8).map((x) => ({
        label: asString(x?.label, 80),
        image: asUrl(x?.image),
      }))
    : [];
  out.coverage = {
    title: asString(c?.coverage?.title, 240),
    body: asString(c?.coverage?.body, 1200),
    cities: Array.isArray(c?.coverage?.cities)
      ? c.coverage.cities.slice(0, 50).map((x) => asString(x, 80))
      : [],
  };
  out.cta = {
    title: asString(c?.cta?.title, 240),
    subtitle: asString(c?.cta?.subtitle, 400),
    button: asString(c?.cta?.button, 60),
  };
  out.legal = {
    impressum: asString(c?.legal?.impressum, 8000),
    datenschutz: asString(c?.legal?.datenschutz, 16000),
    agb: asString(c?.legal?.agb, 16000),
  };
  out.seo = {
    title: asString(c?.seo?.title, 120),
    description: asString(c?.seo?.description, 320),
    ogImage: asUrl(c?.seo?.ogImage),
  };
  return out;
}

app.listen(PORT, () => {
  console.log(`[hosslimo] listening on http://localhost:${PORT} (${NODE_ENV})`);
});
