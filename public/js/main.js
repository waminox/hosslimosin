(() => {
  'use strict';

  // ---------- Inline icon library --------------------------------------------
  const ICONS = {
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    plane: '<svg viewBox="0 0 24 24"><path d="m2 13 7 1 4-9 2 1-2 8 6 1 1 2-7 1-3 5-2-1 1-5-7-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m9 9 3-5 3 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 20a7 7 0 0 1 14 0M16 11a3 3 0 1 0 0-6M22 20a6 6 0 0 0-5-5.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 6h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5 14.6 9 22 9.6l-5.6 4.6 1.8 7.3L12 17.6 5.8 21.5l1.8-7.3L2 9.6 9.4 9 12 2.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  };

  function setIcon(el, name) {
    if (!el) return;
    el.innerHTML = ICONS[name] || ICONS.star;
  }

  // ---------- Tiny dot-path getter -------------------------------------------
  function get(obj, path) {
    if (path === '.' || !path) return obj;
    return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  }

  function setText(el, value) {
    if (el == null) return;
    if (value == null || value === '') return;
    el.textContent = value;
  }

  // ---------- Bind a node tree to data ---------------------------------------
  function bindTree(root, ctx) {
    root.querySelectorAll('[data-bind]').forEach((el) => {
      const path = el.getAttribute('data-bind');
      const v = get(ctx, path);
      if (typeof v === 'string' && v) el.textContent = v;
    });
    root.querySelectorAll('[data-bind-src]').forEach((el) => {
      const path = el.getAttribute('data-bind-src');
      const v = get(ctx, path);
      if (typeof v === 'string' && v) el.setAttribute('src', v);
    });
    root.querySelectorAll('[data-bind-href]').forEach((el) => {
      const path = el.getAttribute('data-bind-href');
      const prefix = el.getAttribute('data-href-prefix') || '';
      const v = get(ctx, path);
      if (typeof v === 'string' && v) el.setAttribute('href', prefix + v);
    });
    root.querySelectorAll('[data-icon]').forEach((el) => {
      const name = ctx?.icon;
      setIcon(el, name);
    });
  }

  function fillList(host, items, tplId, contentRoot) {
    const tpl = document.getElementById(tplId);
    if (!tpl || !host) return;
    host.innerHTML = '';
    items.forEach((item) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      // Two-pass binding: first by item-relative paths, then absolute fallback for top-level.
      const ctx = typeof item === 'object' && item !== null ? item : { '.': item };
      // For string-only items, allow [data-bind="."] to render the value.
      node.querySelectorAll('[data-bind]').forEach((el) => {
        const path = el.getAttribute('data-bind');
        const v = path === '.' ? item : get(item, path);
        if (typeof v === 'string' && v) el.textContent = v;
      });
      node.querySelectorAll('[data-bind-src]').forEach((el) => {
        const path = el.getAttribute('data-bind-src');
        const v = get(item, path);
        if (typeof v === 'string' && v) el.setAttribute('src', v);
      });
      node.querySelectorAll('[data-icon]').forEach((el) => {
        if (item && item.icon) setIcon(el, item.icon);
      });
      // Per-template helpers
      const featsHost = node.querySelector('[data-features]');
      if (featsHost && Array.isArray(item?.features)) {
        item.features.forEach((f) => {
          const li = document.createElement('li');
          li.textContent = f;
          featsHost.appendChild(li);
        });
      }
      // Tag fleet items with a category bucket for filters.
      if (node.matches?.('[data-car]') && typeof item?.name === 'string') {
        const bucket = /Tesla/i.test(item.name)
          ? 'Tesla'
          : /Sprinter|V-Klasse|EQV/i.test(item.name)
          ? 'Van'
          : 'Mercedes';
        node.dataset.bucket = bucket;
      }
      host.appendChild(node);
    });
  }

  // ---------- Apply content to the page --------------------------------------
  function apply(content) {
    document.title = content.seo?.title || 'Hosslimo';
    const md = document.querySelector('meta[name="description"]');
    if (md && content.seo?.description) md.setAttribute('content', content.seo.description);

    // Top-level binds
    bindTree(document.body, content);

    // Hero background
    const heroBg = document.getElementById('heroBg');
    const img = content.hero?.backgroundImage;
    if (heroBg && img) heroBg.style.backgroundImage = `url(${JSON.stringify(img)})`;

    // Lists
    document.querySelectorAll('[data-list]').forEach((host) => {
      const path = host.getAttribute('data-list');
      const tpl = host.getAttribute('data-template');
      const items = get(content, path);
      if (Array.isArray(items)) fillList(host, items, tpl);
    });

    // Re-bind any new top-level paths exposed in cloned templates (e.g. nav phone etc.)
    bindTree(document.body, content);

    setupReveal();
    setupFleetFilters();
    setupLegalDialog(content.legal || {});
    setupContactForm();
  }

  // ---------- Reveal on scroll -----------------------------------------------
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const el = entry.target;
            setTimeout(() => el.classList.add('is-in'), Math.min(i, 6) * 70);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => io.observe(el));
  }

  // ---------- Fleet filters ---------------------------------------------------
  function setupFleetFilters() {
    const filters = document.getElementById('fleetFilters');
    const grid = document.querySelector('.fleet__grid');
    if (!filters || !grid) return;
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      filters.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === btn));
      const f = btn.dataset.filter;
      grid.querySelectorAll('[data-car]').forEach((card) => {
        const ok = f === 'all' || card.dataset.bucket === f;
        card.classList.toggle('is-hidden', !ok);
      });
    });
  }

  // ---------- Legal dialog ---------------------------------------------------
  function setupLegalDialog(legal) {
    const dialog = document.getElementById('legalDialog');
    const title = document.getElementById('legalTitle');
    const body = document.getElementById('legalBody');
    const close = dialog?.querySelector('.legal__close');
    if (!dialog || !title || !body || !close) return;
    document.querySelectorAll('[data-legal]').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const key = a.dataset.legal;
        const labels = { impressum: 'Impressum', datenschutz: 'Datenschutz', agb: 'AGB' };
        title.textContent = labels[key] || '';
        body.textContent = legal[key] || '';
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      });
    });
    close.addEventListener('click', () => dialog.close?.());
    dialog.addEventListener('click', (e) => {
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dialog.close?.();
    });
  }

  // ---------- Contact form ---------------------------------------------------
  function setupContactForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.classList.remove('is-err', 'is-ok');
      status.textContent = '';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Senden fehlgeschlagen.');
        status.textContent = 'Vielen Dank! Wir melden uns kürze bei Ihnen.';
        status.classList.add('is-ok');
        form.reset();
      } catch (err) {
        status.textContent = 'Es ist ein Fehler aufgetreten. Bitte rufen Sie uns an oder versuchen Sie es erneut.';
        status.classList.add('is-err');
      }
    });
  }

  // ---------- Nav scroll + mobile menu ---------------------------------------
  function setupNav() {
    const nav = document.getElementById('nav');
    const burger = nav?.querySelector('.nav__burger');
    const mobile = document.getElementById('mobileMenu');
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      nav.classList.toggle('is-stuck', y > 30);
      last = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (burger && mobile) {
      const toggle = (open) => {
        const willOpen = typeof open === 'boolean' ? open : mobile.hasAttribute('hidden');
        if (willOpen) {
          mobile.removeAttribute('hidden');
          burger.setAttribute('aria-expanded', 'true');
        } else {
          mobile.setAttribute('hidden', '');
          burger.setAttribute('aria-expanded', 'false');
        }
      };
      burger.addEventListener('click', () => toggle());
      mobile.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
    }
  }

  // ---------- Hero parallax (subtle) -----------------------------------------
  function setupParallax() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bg = document.getElementById('heroBg');
    if (!bg) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 800);
        bg.style.transform = `translate3d(0, ${y * 0.18}px, 0) scale(1.05)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Year footer ----------------------------------------------------
  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());

  // ---------- Boot ------------------------------------------------------------
  setupNav();
  setupParallax();

  fetch('/api/content')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then(apply)
    .catch((err) => {
      console.error('Content load failed:', err);
      // Reveal whatever default text the markup already contains.
      setupReveal();
      setupFleetFilters();
      setupContactForm();
    });
})();
