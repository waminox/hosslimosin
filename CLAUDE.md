# Hosslimo — project memory

> Long-lived notes about this project so any future Claude session can pick up
> exactly where the last one left off. Update this file whenever a major
> decision is made, an architectural change lands, or a customer sensitivity
> needs to survive context window boundaries.

## What this project is

A single-page production website for **Hosslimo (Hoss Limousine Service e.U.)**, a
Vienna-based premium chauffeur / limousine business owned by Hossein Gharemani.
The brand voice is German, Aman-Hotels-meets-Blacklane aesthetic: deep black
+ champagne gold + warm ivory, serif Cormorant Garamond display, Inter UI sans.

Stack: **Node 20 + Express + vanilla JS, JSON-file storage, no DB, no
framework**. Customer-managed via a built-in admin panel; deploys on every push
to `main`.

## Stack & file layout

```
/server.js              Express app — admin auth, /api/content, /api/contact,
                        /api/inquiries/:id/reply, /api/upload, helmet CSP,
                        nodemailer, session-file-store, csurf, multer, bcryptjs.
                        Reads everything from /etc/hosslimo/env on the server.

/public/index.html      The customer's actual designed page. Self-contained:
                        inline <style>, no external CSS. ~1100 lines.
                        DO NOT regenerate or "rewrite from scratch" — this is
                        the *original delivery* the customer is attached to.
/public/js/main.js      Client logic — fleet renderer, applyContent (admin
                        text → DOM), contact form, toast, parallax, reveal-
                        on-scroll, car-CTA pre-select, service-CTA pre-select,
                        legal dialog, reCAPTCHA v3.
/public/css/styles.css  *Largely unused* — the design's CSS lives inline in
                        public/index.html. Don't add new rules here.
/public/uploads/        Runtime media library, gitignored. Admin uploads land
                        here via /api/upload.

/views/admin.html       Admin dashboard SPA-ish page (single HTML, single JS).
                        Scoped under .adm-* class prefix so nothing leaks to
                        the public CSS. Inline <style> only.
/views/admin-login.html Tiny login page; submits to /api/login.
/public/js/admin.js     All admin logic — content editor, image picker,
                        media library, inquiry chat list + modal, password
                        change, drag-and-drop reorder.
/public/js/admin-login.js  Login form submit.

/data/content.default.json   Seed for content.json on first boot only.
                              Updates here only affect FRESH installs.
/data/content.json           Admin-managed live content (gitignored).
/data/inquiries.json         Form submissions + admin reply threads (gitignored).
/data/users.json             Admin username + bcrypt password hash (gitignored).
/data/sessions/              session-file-store data (gitignored).

/.env.example                Template; real values live in /etc/hosslimo/env
                              on the server, NOT in the repo.

/.github/workflows/deploy.yml   On push to main: ssh into the server as
                                 `deploy`, git fetch + reset --hard,
                                 npm ci --omit=dev, systemctl restart
                                 hosslimo. ~15s. Pinned host keys.
```

The repo root also contains a leftover `index.html` (51 KB) from the original
handoff. **Not used in production** (express only serves `public/`). Don't
edit it; don't delete it without checking with the customer.

## Hosting & deployment

- **Production server**: Ubuntu 24 VPS at `31.70.80.72`. Caddy on :443 reverse-
  proxies to Node on :3000. Caddy auto-renews Let's Encrypt for hosslimo.com +
  www.hosslimo.com (Caddyfile at `/etc/caddy/Caddyfile`, www→non-www redirect).
- **systemd unit**: `/etc/systemd/system/hosslimo.service` runs `node server.js`
  as the unprivileged `deploy` user, `WorkingDirectory=/var/www/hosslimo`,
  `EnvironmentFile=/etc/hosslimo/env`, hardened with NoNewPrivileges,
  ProtectSystem=full, ProtectHome=true, ReadWritePaths to data/ and
  public/uploads/, PrivateTmp.
- **Deploy user**: `deploy` (uid created via `useradd`). Has passwordless
  sudo *only* for `/bin/systemctl restart hosslimo` and `/bin/systemctl
  reload caddy` (`/etc/sudoers.d/deploy`).
- **GitHub Actions deploys via SSH**:
  - Repo Secrets: `SSH_HOST=31.70.80.72`, `SSH_USERNAME=deploy`, `SSH_PORT=22`,
    `SSH_PRIVATE_KEY` (ed25519, generated as /root/gha_deploy_key on server),
    `SSH_KNOWN_HOSTS` (3 lines from ssh-keyscan).
  - Server has GitHub deploy key in /home/deploy/.ssh/id_ed25519, registered
    at https://github.com/waminox/hosslimosin/settings/keys (READ-ONLY).
  - Server's ~/.ssh/config maps `Host github.com / User git / IdentityFile`
    so `git clone github.com:waminox/hosslimosin.git` works (we avoid the
    `git@github.com` form because the chat interface obfuscates literal
    email-looking strings — see "Markdown gotcha" below).
- **Previous host (deprecated)**: world4you shared hosting at 212.132.97.131,
  ftpuser/sftp - moved off because no Node.js feature + ECONNRESET on plain
  FTP data sockets.

### How to deploy manually if Actions is broken
SSH to 31.70.80.72 as root, `su - deploy`, then:
```
cd /var/www/hosslimo
git fetch origin main && git reset --hard origin/main
npm ci --omit=dev
sudo /bin/systemctl restart hosslimo
```

## Environment variables (live: /etc/hosslimo/env)

```
NODE_ENV=production
PORT=3000
SESSION_SECRET=<64 random hex bytes>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<seeded only on first boot; rotate via /admin → Konto>
SMTP_HOST=smtp.world4you.com
SMTP_PORT=587
SMTP_USER=info@hosslimo.com          ← outgoing FROM address
SMTP_PASSWORD="..."                  ← world4you mailbox password
CONTACT_RECEIVER_EMAIL=...@hosslimo.com  ← where contact forms LAND (currently office@)
RECAPTCHA_SITE_KEY=6LcZi-As...       ← public, embedded into /api/config
RECAPTCHA_SECRET_KEY=6LcZi-As...     ← server-side only
```

`createMailer()` skips silently if SMTP_* are blank. `verifyRecaptcha()` skips
if `RECAPTCHA_SECRET_KEY` is blank (dev fallback).

## CSP (helmet)

```
default-src 'self'
script-src 'self' https://cdn.jsdelivr.net https://unpkg.com
           https://www.google.com https://www.gstatic.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com data:
img-src 'self' data: blob: https:
connect-src 'self' https://www.google.com
frame-src https://www.google.com
frame-ancestors 'none'
upgrade-insecure-requests: null   ← intentionally disabled
```

The `upgrade-insecure-requests` directive is explicitly removed so dev
servers reachable over plain HTTP via internal IPs (e.g. testing on a phone
against a laptop) can fetch their own `/js/*` assets. In production behind
Caddy/Let's Encrypt this is harmless. **Don't re-add it** unless DNS-pinned
HTTPS is guaranteed for every entry point.

## Content schema (/api/content shape)

```js
{
  brand:           {name, tagline, logoText},
  hero:            {eyebrow, title, subtitle, primaryCta, secondaryCta, backgroundImage},
  about:           {eyebrow, title, body, image,
                    highlights: [{icon, title, text}]},
  services:        [{icon, title, text}],   // icon ∈ SERVICE_ICONS
  fleet:           [{name, category, passengers, luggage,
                     features:[string], image}],
  testimonials:    [{author, role, quote}],
  coverage:        {title, body, cities:[string]},
  cta:             {title, subtitle, button},
  certifications:  [{label, image}],        // TÜV / ISO band + footer
  contact:         {phone, phoneHref, email, whatsapp, whatsappHref,
                    address, hours},
  legal:           {impressum, datenschutz, agb},
  seo:             {title, description, ogImage},
}
```

A `*emphasis*` markdown-like convention is used in titles (hero, about,
coverage, cta section titles) → converted to `<em>` (gold italic) at render
time via `emphasize()`. Strip asterisks for comparison so default text keeps
its original `<em>` markup when admin's value matches.

Fleet image URLs are *optional* — empty falls back to a per-car CSS variable
(`--img-eqs`, `--img-tesla-y`, etc.) so cards always show a placeholder.
This is fixed via `FLEET_IMG_BY_NAME` lookup in `renderFleet()`.

## Admin UX conventions

- All admin pages namespaced under **`.adm-*`** classes / IDs — never bleeds
  to public CSS.
- Drag-and-drop reorder on every list (services, fleet, voices, highlights,
  cities, certifications) via `makeListDraggable()` in admin.js. Items have
  a ⋮⋮ grip in the header; the whole card is draggable.
- Image picker modal: `openImagePicker(cb)` — opens, lists /api/uploads,
  click thumb → cb(url). Used by fleet, hero background, SEO og, about
  media, certifications.
- Inquiries are a WhatsApp-style chat list. Click row → modal with thread
  (left grey bubble for customer, right gold bubble for admin replies) +
  composer. Sends via `POST /api/inquiries/:id/reply`, also persists to
  data/inquiries.json.
- A small `.adm-conv-note` explains that customer replies don't show in the
  admin (they land in the email inbox CONTACT_RECEIVER_EMAIL).

## Public-page conventions

- The mobile nav uses `.is-open` class with `display: flex`; the burger
  toggles via JS. Stagger-fade-in animation on each link (0.06s steps),
  bordered-gold (not filled) CTA.
- The fixed nav is always opaque + blurred from the first paint (no
  is-stuck-only background). The customer reported overlap before.
- Hero uses `align-items: safe flex-end` so on short viewports the content
  falls back to flex-start instead of overflowing behind the nav.
- Contact-form success/error feedback is a **centred toast** at the top
  of the page (`.toast`), serif italic title + Inter sans body, gold
  border on success, red on error. Inline `cta__status` exists for
  backwards compatibility but is cleared on submit.
- A small certifications band sits between hero and about: "Zertifiziert ·
  TÜV-geprüfte Chauffeur-Ausbildung · ISO 9001 zertifiziert". The same
  labels appear as gold-bordered chips in the footer (same chip style as
  the top band — they must look identical).

## Real company details (currently in default + live env)

```
Owner:    Hossein Gharemani
Company:  Hoss Limousine Service e.U.
Address:  Feitsingergasse 12/1/5, 1220 Wien, Austria
Phone:    +43 676 4121075   (phoneHref: +436764121075)
Mail:     office@hosslimo.com (contact receiver)
          info@hosslimo.com   (outgoing SMTP user)
UID:      ATU73262514
FN:       488514d (HG Wien)
IBAN:     AT86 2011 1295 6897 1403
BIC:      GIBAATWWXXX
```

## Certifications — wording rule

The owner holds a **Chauffeur Training Expert** certificate from **seculearn**,
which is itself **DIN-certified by TÜV SÜD under ISO 9001**. The course was
completed at SIXT Vienna in April 2017.

**Defensible claim**: *"TÜV-geprüfte Chauffeur-Ausbildung · ISO 9001"* —
i.e. the *training* is TÜV/ISO certified.

**NEVER claim**: "Hosslimo ist TÜV-zertifiziert" / "ISO-9001-zertifiziertes
Unternehmen". That would imply the *business* holds those certifications —
not what the PDFs prove — and would expose the customer to UWG /
Wettbewerbsrecht complaints in Austria.

Logos: the customer must upload the official TÜV / ISO logos provided by
seculearn (their use is bound by the certifying body's branding rules)
via `/admin → Medien` and pick them in `/admin → Allgemein → Zertifizierungen`.
Don't ship pre-bundled TÜV / ISO logo images in the repo.

## Customer hard rules (from the original brief, still active)

1. **DO NOT rewrite the frontend from scratch.** The design at
   `public/index.html` is the customer's actual delivery — preserve it.
2. **DO NOT change the existing visual design, layout, header, nav,
   animations, dashboard behaviour, popups, or styling** unless the task
   strictly requires it.
3. **DO NOT introduce global JS** that could break the homepage.
4. **DO NOT change existing class names / IDs / layout wrappers / component
   structure** unless necessary.
5. **DO NOT replace existing components** because "it looks cleaner".
6. **DO NOT remove existing scripts / styles / imports / event handlers**
   unless their purpose is fully understood.
7. **Admin is not linked from the homepage** — no `/admin` link anywhere
   public. URL access only.
8. **Modals start hidden** by default (`hidden` attr or `display: none`).
9. **Hands-off list**: 24/7 claim is OK (customer has it in their content);
   no claims about specific years of experience, licenses, partners, or
   guarantees we can't prove.

## Conventions I've been following

- Branches named `claude/<thing>`. One PR per logical change. PRs are short-
  lived — usually merged within minutes.
- Commit messages are detailed: problem statement, root cause if relevant,
  what changed, why. Use HEREDOC for the body to keep formatting intact.
  Always end with `https://claude.ai/code/session_…` link.
- Smoke-test every change locally before pushing: boot server, curl key
  endpoints, grep critical markup is present, syntax-check JS via `node -c`.
- Prefer **JS-only wiring** over HTML changes when adding admin
  controllability (so the design markup stays untouched).
- For paste-into-PuTTY commands, single-line them — line-continuation `\`
  breaks on copy through some chat renderers.
- Never put `email@domain` literals in copy-pasteable commands — the chat
  layer obfuscates them as `[email&#xa0;protected]`. Use shell-var
  concatenation: `ADDR=foo; DOMAIN=bar.com; ...${ADDR}@${DOMAIN}...`. Same
  for SSH user — write `-l git github.com` not `git@github.com`.

## Recently shipped (high-level history)

| PR | What |
|----|------|
| #1 | Initial admin dashboard, contact form, reCAPTCHA, content model |
| #2 | (didn't happen — branched directly to PRs below from main) |
| #3 | First polish pass — copy refresh, footer admin link removed, plain-text email cleanup |
| #4 | Mobile fix — disabled `upgrade-insecure-requests`, opaque mobile nav, noscript reveal fallback |
| #5 | Fleet aligned to customer's pricelist (Mercedes-first, EQ-paired, Vito, dropped Tesla X/3 by request) |
| #6 | Contact-form required-field markers, Anlass select, GitHub Actions deploy via FTP+lftp at world4you |
| #7 | FTP → FTPS attempt (still world4you era) |
| #8 | SFTP via lftp on world4you |
| #9 | New Ubuntu VPS — SSH-based deploy (current workflow) |
| #10 | Nav always opaque |
| #11 | Hero `safe flex-end` so content can't go behind nav |
| #12–14 | reCAPTCHA debugging chain → root cause was server truncating new "0cAF…" v3 tokens at 2048 chars (Google rolled out longer format); now capped at 8192 |
| #15 | Contact-form **toast** for success/error, admin chat note explaining customer replies go to inbox |
| #16 | Admin **drag-and-drop reorder** on every list; **TÜV/ISO certifications band** + footer chips |
| #17 | Footer cert chip rendered as logo + label (was logo-only), styling matched to top band |
| #18 | Mobile menu polish (stagger fade-in, refined CTA, gold dash accents); Tesla Y "Juniper 2026" + re-added Tesla 3 "Highland 2026"; 4 new services (Chauffeur-Miete, Disponent, Hostessen, Zertifizierte Tourguides) |

## Active work — i18n DE/EN translation (next PR)

**Status**: design agreed with customer, code NOT yet written. Branch to
create: `claude/i18n-de-en`.

### Customer requirements
- A small **floating button** with English flag, well-placed,
  luxuriously designed.
- Click → all texts on the page become English, **no page reload**, no URL
  change.
- The same toggle in the **admin panel** lets the owner edit English
  translations using the same input fields they already know.
- Preserve the luxurious look and feel.

### Agreed architecture
- **Hybrid schema**: each translatable text field accepts either a plain
  string (DE only / language-agnostic) OR `{ de: "...", en: "..." }`. No
  migration required — existing strings keep rendering as DE.
- **`localizable(v, max)` server helper** in `sanitizeContent` for
  translatable fields. Collapses to plain string when only one locale
  non-empty.
- **Frontend reader**: `pick(v)` returns `_locale` → `de` → `en` → `""`.
- **`_locale`** initialised from `localStorage.hosslimo.lang` (try/catch
  for private browsing), default `de`.
- **Floating button**: bottom-right `24px`, dark + gold border, shows
  *opposite* locale (flag + 2-letter label). Hover lifts 2 px.
  z-index 50 (below toast at 200).
- On click: toggle locale, save to localStorage, **re-run `applyContent`**
  on the cached content object. Re-renders all sections.
- **Admin top-bar toggle**. `populateForms` reads via `pick()`. On save,
  `localMerge(existing, newInput, currentLocale)` keeps the OTHER locale
  intact.
- Each array-editor item card stores its original i18n object in
  `data-original` (JSON) so save-time merging works.

### Fields translated in MVP
hero, about + highlights, services title/text, fleet category, testimonials
role+quote, coverage title+body, cta, certifications labels, contact
hours/address/whatsapp display, legal docs, SEO title+description.

### Fields explicitly NOT translated in MVP
City names (Wien/Vienna spelled differently — separate admin work), fleet
features bullets (brand terms), phone/email/URLs/images/icons, brand
wordmark, car names, customer testimonial names.

### Bug-class checklist (the "review twice" the customer asked for)
1. `localStorage` unavailable → try/catch, fall back to `de`.
2. Existing `content.json` keeps rendering (no forced migration).
3. Empty EN slot falls back via `pick()`.
4. Admin saves while in EN mode never clobber existing DE.
5. Toggle uses cached `content` snapshot to avoid race with /api/content.
6. `norm()` skip-when-equal still works on `pick()` output.
7. Hard-coded German strings in main.js (toast titles + validation
   messages) need a tiny `T()` lookup dictionary.
8. Pre-paint flicker on first EN visit is acceptable (~50 ms).
9. `data-car-name` selector / form-pre-select unchanged (car names not
   translated).
10. Drag-and-drop reorder preserves full bilingual objects.

## Known follow-ups / nice-to-haves (after i18n)

- Custom city translations (Wien → Vienna) — small admin field per city.
- Move admin password change to a forced-rotate flow on first login.
- Add SMTP-replyer test command in admin so the customer can verify
  outbound mail without writing a fake inquiry first.
- Replace the unused root `index.html` (original handoff) with a clean
  redirect or delete it after customer sign-off.
- Trim out the unused `public/css/styles.css` (everything's inline in
  `public/index.html`).
- Generate AI-driven car photos for the fleet (the customer mentioned
  this — provided AI-prompt template earlier; left as customer task).

## Markdown / chat gotchas to remember

- **Email obfuscation**: anything that looks like `name@domain.tld`
  gets replaced with `[email&nbsp;protected]` when copied out of the
  chat. NEVER put literal emails in user-paste-able shell commands.
  Use shell-variable concatenation (`ADDR=`, `DOMAIN=`) or `nano`.
- **`git@github.com`** is auto-linked as an email and breaks ssh.
  Use `-l git github.com` or the `Host github.com / User git` SSH
  config we set up on the server.
- **`[email protected]`** inside code fences was rendered with literal
  brackets in PuTTY's clipboard for one user during setup; assume the
  obfuscator runs everywhere.
