(() => {
  'use strict';

  // Escape HTML and convert *segment* markers into <em>segment</em> for safe
  // innerHTML rendering of admin-managed copy. Also escapes both quote types
  // so the same helper is safe inside HTML attributes (e.g. data-bg="…").
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function emphasize(s) {
    return String(s).split(/(\*[^*]+\*)/g).map((part) => {
      const m = part.match(/^\*([^*]+)\*$/);
      return m ? `<em>${escHtml(m[1])}</em>` : escHtml(part);
    }).join('');
  }

  // Inline SVG library matching the admin's icon options.
  const SERVICE_ICONS = {
    plane: '<svg viewBox="0 0 24 24"><path d="m2 13 7 1 4-9 2 1-2 8 6 1 1 2-7 1-3 5-2-1 1-5-7-1z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    ring: '<svg viewBox="0 0 24 24"><circle cx="12" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m9 9 3-5 3 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 20a7 7 0 0 1 14 0M16 11a3 3 0 1 0 0-6M22 20a6 6 0 0 0-5-5.9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="18" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 6h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.5 14.6 9 22 9.6l-5.6 4.6 1.8 7.3L12 17.6 5.8 21.5l1.8-7.3L2 9.6 9.4 9 12 2.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 2 4 6v6c0 5 3.4 9.3 8 10 4.6-.7 8-5 8-10V6l-8-4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  };

  const ROMAN = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.', 'ix.', 'x.', 'xi.', 'xii.', 'xiii.', 'xiv.', 'xv.', 'xvi.', 'xvii.', 'xviii.', 'xix.', 'xx.'];

  // ------- Fleet data (image keys map to :root --img-* placeholders) -------
  // Order: Mercedes-Benz first (paired ICE/EQ where available), then vans,
  // then Tesla — per the customer's pricelist.
  const FLEET = [
    { name: "Mercedes-Benz E-Klasse", category: "Business-Limousine", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Lederausstattung", "Klimakomfort", "WLAN", "Stille Kabine"], img: "--img-eclass" },
    { name: "Mercedes-Benz EQE", category: "Elektrische Business-Limousine", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Klimakomfortsitze", "WLAN", "Hyperscreen", "Emissionsfrei"], img: "--img-eqe" },
    { name: "Mercedes-Benz S-Klasse", category: "Luxus-Limousine · LongVersion", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Chauffeur-Paket", "Burmester 4D", "Massagesitze", "Executive"], img: "--img-sclass" },
    { name: "Mercedes-Benz EQS", category: "Elektrische Luxus-Limousine", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Massagesitze", "Burmester Sound", "Panoramadach", "Lautlos"], img: "--img-eqs" },
    { name: "Mercedes-Benz V-Klasse", category: "First-Class MiniVan", bucket: "Van", passengers: "6", luggage: "6",
      features: ["Konferenzbestuhlung", "Tisch", "Verdunkelung", "Großer Kofferraum"], img: "--img-vclass" },
    { name: "Mercedes-Benz EQV", category: "Elektrischer First-Class MiniVan", bucket: "Van", passengers: "6", luggage: "6",
      features: ["Konferenzbestuhlung", "Lautlos", "Emissionsfrei", "Premium"], img: "--img-eqv" },
    { name: "Mercedes-Benz Vito", category: "MiniVan", bucket: "Van", passengers: "8", luggage: "10",
      features: ["Komfortable Bestuhlung", "Klimaanlage", "Großer Stauraum", "Bis 8 Personen"], img: "--img-vito" },
    { name: "Mercedes-Benz Sprinter", category: "Gruppen-Bus", bucket: "Van", passengers: "20", luggage: "16",
      features: ["Komfortbestuhlung", "Klimaanlage", "Stauraum", "Bis 20 Personen"], img: "--img-sprinter" },
    { name: "Tesla Model S", category: "Elektrische Performance-Limousine", bucket: "Tesla", passengers: "3", luggage: "2",
      features: ["Autopilot", "Premium Audio", "Glasdach", "Emissionsfrei"], img: "--img-tesla-s" },
    { name: "Tesla Model Y", category: "Elektrischer Komfort-SUV", bucket: "Tesla", passengers: "4", luggage: "3",
      features: ["Glasdach", "Premium Audio", "Innenraum", "Emissionsfrei"], img: "--img-tesla-y" },
  ];

  // Lookup: design's CSS-variable image keyed by car name (used as a fallback
  // when admin's image URL is empty so the default Unsplash image is preserved).
  const FLEET_IMG_BY_NAME = Object.fromEntries(FLEET.map((c) => [c.name, c.img]));

  function fleetBg(name, image) {
    if (image) return `url(${JSON.stringify(image)})`;
    const cssVar = FLEET_IMG_BY_NAME[name];
    return cssVar ? `var(${cssVar})` : 'none';
  }

  function renderFleet(items) {
    const grid = document.getElementById('fleetGrid');
    if (!grid) return;
    let cars;
    if (Array.isArray(items) && items.length) {
      cars = items.filter((x) => x && x.name).map((x) => {
        const name = String(x.name);
        const bucket = /Tesla/i.test(name)
          ? 'Tesla'
          : /Sprinter|V-Klasse|EQV|Vito/i.test(name)
          ? 'Van'
          : 'Mercedes';
        return {
          name,
          category: x.category || '',
          bucket,
          passengers: x.passengers || '',
          luggage: x.luggage || '',
          features: Array.isArray(x.features) ? x.features : [],
          bgImage: fleetBg(name, x.image),
        };
      });
    } else {
      cars = FLEET.map((c) => ({
        name: c.name,
        category: c.category,
        bucket: c.bucket,
        passengers: c.passengers,
        luggage: c.luggage,
        features: c.features,
        bgImage: `var(${c.img})`,
      }));
    }
    grid.innerHTML = cars.map((c) => `
      <article class="car reveal" data-bucket="${escHtml(c.bucket)}">
        <div class="car__media" data-bg="${escHtml(c.bgImage)}">
          <span class="car__badge">${escHtml(c.bucket === 'Van' ? 'Van' : c.bucket)}</span>
        </div>
        <div class="car__body">
          <h3 class="car__name">${escHtml(c.name)}</h3>
          <span class="car__class">${escHtml(c.category)}</span>
          <div class="car__specs">
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><strong>${escHtml(c.passengers)}</strong> Pers.</span>
            <span><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><strong>${escHtml(c.luggage)}</strong> Gepäck</span>
          </div>
          <ul class="car__feats">${c.features.map((f) => `<li>${escHtml(f)}</li>`).join('')}</ul>
          <a class="car__cta" href="#contact" data-car-name="${escHtml(c.name)}">Diese Klasse anfragen →</a>
        </div>
      </article>
    `).join('');
    // Apply background-image via the DOM API so admin-uploaded URLs (which
    // would otherwise contain double quotes that break out of style="…")
    // render reliably. Doing it post-innerHTML also keeps the markup clean.
    grid.querySelectorAll('[data-bg]').forEach((el) => {
      el.style.backgroundImage = el.getAttribute('data-bg') || '';
      el.removeAttribute('data-bg');
    });
  }

  // ------- Reveal -------
  function setupReveal(host) {
    const root = host || document;
    const els = root.querySelectorAll('.reveal:not(.is-in)');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          setTimeout(() => el.classList.add('is-in'), Math.min(i, 5) * 90);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
  }

  // ------- Car-CTA → contact form vehicle pre-select -------
  // "Mercedes-Benz EQS" / "Mercedes EQS" / "Mercedes Sprinter (12+ Pers.)" all
  // normalise to the same key so the design's existing form options match the
  // admin's fleet names without an exact string match.
  function carKey(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/^mercedes(-benz)?\s+/i, '')
      .replace(/\s*\(.*\)\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function syncVehicleOptions(fleet) {
    const select = document.querySelector('#contactForm select[name="vehicle"]');
    if (!select || !Array.isArray(fleet)) return;
    const existing = new Set(
      Array.from(select.options).map((o) => carKey(o.value || o.textContent))
    );
    fleet.forEach((item) => {
      const name = item && item.name;
      if (!name) return;
      const key = carKey(name);
      if (key && !existing.has(key)) {
        const opt = document.createElement('option');
        opt.textContent = name;
        select.appendChild(opt);
        existing.add(key);
      }
    });
  }

  function selectVehicle(name) {
    const select = document.querySelector('#contactForm select[name="vehicle"]');
    if (!select || !name) return;
    const target = carKey(name);
    for (const opt of select.options) {
      if (carKey(opt.value || opt.textContent) === target) {
        select.value = opt.value || opt.textContent;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    // No matching option — add the admin-defined name as a new entry.
    const opt = document.createElement('option');
    opt.textContent = name;
    select.appendChild(opt);
    select.value = name;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setupCarCta() {
    document.addEventListener('click', (e) => {
      const cta = e.target.closest('.car__cta[data-car-name]');
      if (!cta) return;
      const name = cta.getAttribute('data-car-name');
      if (name) selectVehicle(name);
      // Default href="#contact" handles the smooth scroll.
    });
  }

  // ------- Service-CTA → contact form Anlass pre-select -------
  function syncServiceOptions(services) {
    const select = document.querySelector('#contactForm select[name="service"]');
    if (!select || !Array.isArray(services)) return;
    const norm = (s) => String(s || '').toLowerCase().trim();
    const existing = new Set(Array.from(select.options).map((o) => norm(o.value || o.textContent)));
    services.forEach((item) => {
      const title = item && item.title;
      if (!title) return;
      const key = norm(title);
      if (key && !existing.has(key)) {
        const opt = document.createElement('option');
        opt.textContent = title;
        select.appendChild(opt);
        existing.add(key);
      }
    });
  }

  function selectService(title) {
    const select = document.querySelector('#contactForm select[name="service"]');
    if (!select || !title) return;
    const norm = (s) => String(s || '').toLowerCase().trim();
    const target = norm(title);
    for (const opt of select.options) {
      if (norm(opt.value || opt.textContent) === target) {
        select.value = opt.value || opt.textContent;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
    }
    const opt = document.createElement('option');
    opt.textContent = title;
    select.appendChild(opt);
    select.value = title;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setupServiceCta() {
    document.addEventListener('click', (e) => {
      const cta = e.target.closest('.svc__more');
      if (!cta) return;
      const title = cta.closest('.svc')?.querySelector('.svc__title')?.textContent.trim();
      if (title) selectService(title);
    });
  }

  // ------- Filters -------
  function setupFilters() {
    const filters = document.getElementById('fleetFilters');
    const grid = document.getElementById('fleetGrid');
    if (!filters || !grid) return;
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      filters.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === btn));
      const f = btn.dataset.filter;
      grid.querySelectorAll('[data-bucket]').forEach(card => {
        const ok = f === 'all' || card.dataset.bucket === f;
        card.classList.toggle('is-hidden', !ok);
      });
    });
  }

  // ------- Nav -------
  function setupNav() {
    const nav = document.getElementById('nav');
    const burger = nav?.querySelector('.nav__burger');
    const mobile = document.getElementById('mobileMenu');
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (burger && mobile) {
      const toggle = (open) => {
        const willOpen = typeof open === 'boolean' ? open : !mobile.classList.contains('is-open');
        mobile.classList.toggle('is-open', willOpen);
        burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      };
      burger.addEventListener('click', () => toggle());
      mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
    }
  }

  // ------- Parallax -------
  function setupParallax() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bg = document.getElementById('heroBg');
    if (!bg) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 900);
        bg.style.transform = `translate3d(0, ${y * 0.2}px, 0) scale(1.05)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ------- Legal (text loaded from /api/content) -------
  let LEGAL = {
    impressum: 'Bitte ergänzen Sie Ihre Impressums-Angaben im Admin-Bereich.',
    datenschutz: 'Bitte ergänzen Sie Ihre Datenschutzerklärung im Admin-Bereich.',
    agb: 'Bitte ergänzen Sie Ihre AGB im Admin-Bereich.',
  };
  function setupLegal() {
    const dialog = document.getElementById('legalDialog');
    const title = document.getElementById('legalTitle');
    const body = document.getElementById('legalBody');
    const close = dialog?.querySelector('.legal__close');
    if (!dialog || !title || !body || !close) return;
    document.querySelectorAll('[data-legal]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const key = a.dataset.legal;
        const labels = { impressum: 'Impressum', datenschutz: 'Datenschutz', agb: 'AGB' };
        title.textContent = labels[key] || '';
        body.textContent = LEGAL[key] || '';
        if (typeof dialog.showModal === 'function') dialog.showModal();
      });
    });
    close.addEventListener('click', () => dialog.close?.());
    dialog.addEventListener('click', (e) => {
      const r = dialog.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dialog.close?.();
    });
  }

  // ------- reCAPTCHA v3 (optional) -------
  let _rcSiteKey = '';
  function loadRecaptcha(siteKey) {
    if (!siteKey || document.querySelector('script[data-rc]')) return;
    const s = document.createElement('script');
    s.dataset.rc = '1';
    s.async = true;
    s.src = 'https://www.google.com/recaptcha/api.js?render=' + encodeURIComponent(siteKey);
    document.head.appendChild(s);
  }
  function getRecaptchaToken(action) {
    if (!_rcSiteKey || !window.grecaptcha) return Promise.resolve('');
    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(_rcSiteKey, { action }).then(resolve).catch(() => resolve(''));
      });
    });
  }

  // ------- Contact form (real POST to /api/contact) -------
  function setupForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');
    if (!form) return;

    const REQUIRED = [
      { name: 'name', test: (v) => v.length >= 2, msg: 'Bitte geben Sie Ihren Namen an.' },
      { name: 'email', test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), msg: 'Bitte geben Sie eine gültige E-Mail-Adresse an.' },
      { name: 'message', test: (v) => v.length >= 5, msg: 'Bitte beschreiben Sie kurz Ihre Anfrage.' },
    ];

    // Clear the per-field error highlight as soon as the user types in a field.
    form.addEventListener('input', (e) => {
      const label = e.target.closest('label');
      if (label) label.classList.remove('is-invalid');
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.classList.remove('is-err', 'is-ok');
      form.querySelectorAll('label.is-invalid').forEach((l) => l.classList.remove('is-invalid'));

      // Client-side required-field validation.
      let firstInvalid = null;
      let firstError = '';
      for (const r of REQUIRED) {
        const field = form.elements[r.name];
        const value = (field?.value || '').trim();
        if (!r.test(value)) {
          field?.closest('label')?.classList.add('is-invalid');
          if (!firstInvalid) { firstInvalid = field; firstError = r.msg; }
        }
      }
      if (firstInvalid) {
        status.textContent = firstError;
        status.classList.add('is-err');
        firstInvalid.focus();
        if (typeof firstInvalid.scrollIntoView === 'function') {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      status.textContent = 'Wird gesendet …';
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        data.recaptchaToken = await getRecaptchaToken('contact');
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Senden fehlgeschlagen.');
        status.textContent = 'Vielen Dank! Wir melden uns in Kürze bei Ihnen.';
        status.classList.add('is-ok');
        form.reset();
      } catch (err) {
        status.textContent = err.message || 'Es ist ein Fehler aufgetreten. Bitte rufen Sie uns an oder versuchen Sie es erneut.';
        status.classList.add('is-err');
      }
    });
  }

  // ------- Apply admin-managed content (overrides only when set) -------
  function applyContent(c) {
    if (!c) return;
    if (c.seo?.title) document.title = c.seo.title;
    const md = document.querySelector('meta[name="description"]');
    if (md && c.seo?.description) md.setAttribute('content', c.seo.description);
    if (c.legal) {
      LEGAL = {
        impressum: c.legal.impressum || LEGAL.impressum,
        datenschutz: c.legal.datenschutz || LEGAL.datenschutz,
        agb: c.legal.agb || LEGAL.agb,
      };
    }

    // Helpers that respect the design: only override when the admin's value
    // (with asterisks stripped, for emphasised fields) differs from the markup,
    // so default copy keeps the design's existing <em> styling and any
    // invisible soft-hyphens used for German line breaking.
    const norm = (s) => String(s).replace(/­/g, '').trim();
    const setText = (el, val) => {
      if (!el || !val) return;
      if (norm(val) === norm(el.textContent)) return;
      el.textContent = val;
    };
    const setEm = (el, val) => {
      if (!el || !val) return;
      if (norm(val.replace(/\*/g, '')) === norm(el.textContent)) return;
      el.innerHTML = emphasize(val);
    };

    // ------- Hero -------
    const hero = c.hero || {};
    setEm(document.querySelector('.hero__title'), hero.title);
    setText(document.querySelector('.hero__subtitle'), hero.subtitle);
    const ctas = document.querySelectorAll('.hero__cta a');
    setText(ctas[0], hero.primaryCta);
    setText(ctas[1], hero.secondaryCta);
    const heroBg = document.getElementById('heroBg');
    if (heroBg) {
      heroBg.style.backgroundImage = hero.backgroundImage
        ? `url(${JSON.stringify(hero.backgroundImage)})`
        : '';
    }

    // ------- Brand (wordmark, tagline, footer copyright) -------
    const brand = c.brand || {};
    if (brand.logoText) {
      document.querySelectorAll('.nav__wordmark, .foot__mark').forEach((el) => setText(el, brand.logoText));
    }
    setText(document.querySelector('.foot__brand p'), brand.tagline);
    if (brand.name && brand.name !== 'Hosslimo') {
      const yearEl = document.getElementById('year');
      let n = yearEl?.nextSibling;
      while (n) {
        if (n.nodeType === 3 && /Hosslimo/.test(n.textContent)) {
          n.textContent = n.textContent.replace('Hosslimo', brand.name);
          break;
        }
        n = n.nextSibling;
      }
    }

    // ------- About -------
    const about = c.about || {};
    setText(document.querySelector('#about .section__num'), about.eyebrow);
    setEm(document.querySelector('#about .section__title'), about.title);
    setText(document.querySelector('#about .about__body'), about.body);

    // About media image (left of the text). Empty value clears the inline
    // override so the design's CSS-variable image (--img-about) stays.
    const aboutMedia = document.querySelector('.about__media');
    if (aboutMedia) {
      aboutMedia.style.backgroundImage = about.image
        ? `url(${JSON.stringify(about.image)})`
        : '';
    }

    // About highlights (Diskretion, Pünktlichkeit, …)
    const highlights = Array.isArray(about.highlights) ? about.highlights.filter((x) => x && (x.title || x.text)) : [];
    const hlList = document.querySelector('.about__highlights');
    if (hlList && highlights.length) {
      const current = Array.from(hlList.querySelectorAll('.hl')).map((li) => ({
        title: norm(li.querySelector('.hl__title')?.textContent || ''),
        text: norm(li.querySelector('.hl__text')?.textContent || ''),
      }));
      const next = highlights.map((h) => ({
        title: norm(h.title || ''),
        text: norm(h.text || ''),
        icon: String(h.icon || 'star').trim(),
        rawTitle: String(h.title || ''),
        rawText: String(h.text || ''),
      }));
      const same =
        current.length === next.length &&
        current.every((cur, i) => cur.title === next[i].title && cur.text === next[i].text);
      if (!same) {
        hlList.innerHTML = next
          .map((h) => `
            <li class="hl">
              <span class="hl__icon">${SERVICE_ICONS[h.icon] || SERVICE_ICONS.star}</span>
              <h3 class="hl__title">${escHtml(h.rawTitle)}</h3>
              <p class="hl__text">${escHtml(h.rawText)}</p>
            </li>
          `)
          .join('');
      }
    }

    // ------- Coverage -------
    const cov = c.coverage || {};
    setEm(document.querySelector('#coverage .section__title'), cov.title);
    setText(document.querySelector('#coverage .section__lead'), cov.body);
    const citiesHost = document.querySelector('#coverage .coverage__cities');
    if (citiesHost && Array.isArray(cov.cities) && cov.cities.length) {
      const next = cov.cities.map((x) => String(x).trim()).filter(Boolean);
      const current = Array.from(citiesHost.querySelectorAll('.city')).map((s) => s.textContent.trim());
      const same = current.length === next.length && current.every((v, i) => v === next[i]);
      if (!same) {
        citiesHost.innerHTML = next
          .map((name, i) => `<span class="city${i === 0 ? ' city--main' : ''}">${escHtml(name)}</span>`)
          .join('');
      }
    }

    // ------- CTA -------
    const cta = c.cta || {};
    setEm(document.querySelector('#contact .section__title'), cta.title);
    setText(document.querySelector('#contact .section__lead'), cta.subtitle);
    setText(document.querySelector('#contactForm button[type="submit"]'), cta.button);

    // ------- Kontakt -------
    const ct = c.contact || {};
    const ctaLines = document.querySelectorAll('.cta__contact .cta__line');
    if (ct.phone) {
      setText(document.querySelector('.nav__phone span'), ct.phone);
      setText(document.querySelector('.foot__cols a[href^="tel:"]'), ct.phone);
      if (ctaLines[0]) setText(ctaLines[0].querySelector('span'), ct.phone);
    }
    if (ct.phoneHref) {
      document.querySelectorAll('a[href^="tel:"]').forEach((a) => a.setAttribute('href', 'tel:' + ct.phoneHref));
    }
    if (ct.email) {
      setText(document.querySelector('.foot__cols a[href^="mailto:"]'), ct.email);
      if (ctaLines[1]) setText(ctaLines[1].querySelector('span'), ct.email);
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => a.setAttribute('href', 'mailto:' + ct.email));
    }
    if (ct.whatsapp && ctaLines[2]) setText(ctaLines[2].querySelector('span'), ct.whatsapp);
    if (ct.whatsappHref && ctaLines[2]) ctaLines[2].setAttribute('href', ct.whatsappHref);
    if (ct.address) {
      const addr = document.querySelector('.cta__address');
      if (addr) {
        const html = String(ct.address).split(/\r?\n/).map(escHtml).join('<br>');
        const currentEquiv = addr.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ').trim();
        if (currentEquiv !== ct.address.trim()) addr.innerHTML = html;
      }
      const footAddr = document.querySelector('.foot__cols div:first-child span');
      if (footAddr) {
        const single = String(ct.address).replace(/\s+/g, ' ').trim();
        if (single !== footAddr.textContent.trim()) footAddr.textContent = single;
      }
    }
    setText(document.querySelector('.cta__hours'), ct.hours);

    // ------- Services -------
    const services = Array.isArray(c.services) ? c.services.filter((x) => x && (x.title || x.text)) : [];
    const svcGrid = document.querySelector('.services__grid');
    if (svcGrid && services.length) {
      const current = Array.from(svcGrid.querySelectorAll('.svc')).map((s) => ({
        title: norm(s.querySelector('.svc__title')?.textContent || ''),
        text: norm(s.querySelector('.svc__text')?.textContent || ''),
      }));
      const next = services.map((s) => ({
        title: norm(s.title || ''),
        text: norm(s.text || ''),
        icon: String(s.icon || 'star').trim(),
        rawTitle: String(s.title || ''),
        rawText: String(s.text || ''),
      }));
      const same =
        current.length === next.length &&
        current.every((cur, i) => cur.title === next[i].title && cur.text === next[i].text);
      if (!same) {
        svcGrid.innerHTML = next
          .map((s, i) => `
            <article class="svc reveal">
              <span class="svc__num">${ROMAN[i] || i + 1 + '.'}</span>
              <span class="svc__icon">${SERVICE_ICONS[s.icon] || SERVICE_ICONS.star}</span>
              <h3 class="svc__title">${escHtml(s.rawTitle)}</h3>
              <p class="svc__text">${escHtml(s.rawText)}</p>
              <a class="svc__more" href="#contact" data-service-name="${escHtml(s.rawTitle)}">Anfragen →</a>
            </article>
          `)
          .join('');
        setupReveal(svcGrid);
      }
      syncServiceOptions(services);
    }

    // ------- Fleet -------
    const fleet = Array.isArray(c.fleet) ? c.fleet.filter((x) => x && x.name) : [];
    if (fleet.length) {
      const grid = document.getElementById('fleetGrid');
      const normBg = (s) => String(s).replace(/['"]/g, '"').replace(/\s+/g, '');
      const current = grid
        ? Array.from(grid.querySelectorAll('.car')).map((card) => ({
            name: norm(card.querySelector('.car__name')?.textContent || ''),
            category: norm(card.querySelector('.car__class')?.textContent || ''),
            passengers: norm(card.querySelector('.car__specs strong')?.textContent || ''),
            features: Array.from(card.querySelectorAll('.car__feats li')).map((li) => norm(li.textContent)).join('|'),
            bg: normBg(card.querySelector('.car__media')?.style.backgroundImage || ''),
          }))
        : [];
      const next = fleet.map((item) => ({
        name: norm(item.name || ''),
        category: norm(item.category || ''),
        passengers: norm(item.passengers || ''),
        features: (Array.isArray(item.features) ? item.features : []).map(norm).join('|'),
        bg: normBg(fleetBg(String(item.name || ''), item.image)),
      }));
      const same =
        current.length === next.length &&
        current.every((cur, i) =>
          cur.name === next[i].name &&
          cur.category === next[i].category &&
          cur.passengers === next[i].passengers &&
          cur.features === next[i].features &&
          cur.bg === next[i].bg
        );
      if (!same) {
        renderFleet(fleet);
        if (grid) setupReveal(grid);
      }
      syncVehicleOptions(fleet);
    }

    // ------- Stimmen -------
    const voices = Array.isArray(c.testimonials) ? c.testimonials.filter((x) => x && (x.author || x.quote)) : [];
    const voicesGrid = document.querySelector('.voices__grid');
    if (voicesGrid && voices.length) {
      const current = Array.from(voicesGrid.querySelectorAll('.voice')).map((v) => ({
        quote: norm(v.querySelector('.voice__text')?.textContent || ''),
        author: norm(v.querySelector('.voice__who strong')?.textContent || ''),
        role: norm(v.querySelector('.voice__who span')?.textContent || ''),
      }));
      const next = voices.map((v) => ({
        quote: norm(v.quote || ''),
        author: norm(v.author || ''),
        role: norm(v.role || ''),
        rawQuote: String(v.quote || ''),
        rawAuthor: String(v.author || ''),
        rawRole: String(v.role || ''),
      }));
      const same =
        current.length === next.length &&
        current.every((cur, i) =>
          cur.quote === next[i].quote && cur.author === next[i].author && cur.role === next[i].role
        );
      if (!same) {
        voicesGrid.innerHTML = next
          .map((v) => `
            <figure class="voice reveal">
              <span class="voice__quote">“</span>
              <blockquote class="voice__text">${escHtml(v.rawQuote)}</blockquote>
              <figcaption class="voice__who"><strong>${escHtml(v.rawAuthor)}</strong><span>${escHtml(v.rawRole)}</span></figcaption>
            </figure>
          `)
          .join('');
        setupReveal(voicesGrid);
      }
    }
  }

  // ------- Boot -------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  renderFleet();
  setupNav();
  setupParallax();
  setupReveal();
  setupFilters();
  setupLegal();
  setupForm();
  setupCarCta();
  setupServiceCta();

  // Public config (reCAPTCHA site key) — non-blocking.
  fetch('/api/config')
    .then((r) => (r.ok ? r.json() : {}))
    .then((cfg) => {
      if (cfg && cfg.recaptchaSiteKey) {
        _rcSiteKey = cfg.recaptchaSiteKey;
        loadRecaptcha(_rcSiteKey);
      }
    })
    .catch(() => {});

  // Admin-managed text (legal, SEO meta) — non-blocking.
  fetch('/api/content')
    .then((r) => (r.ok ? r.json() : null))
    .then(applyContent)
    .catch(() => {});
})();
