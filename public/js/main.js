(() => {
  'use strict';

  // ------- Fleet data (image keys map to :root --img-* placeholders) -------
  const FLEET = [
    { name: "Mercedes-Benz EQS", category: "Vollelektrische Luxus-Limousine", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Massagesitze", "Burmester Sound", "Panoramadach", "Lautlos"], img: "--img-eqs" },
    { name: "Mercedes-Benz EQE", category: "Elektrische Business-Limousine", bucket: "Mercedes", passengers: "3", luggage: "2",
      features: ["Klimakomfortsitze", "WLAN", "Hyperscreen", "Emissionsfrei"], img: "--img-eqe" },
    { name: "Mercedes-Benz S-Klasse", category: "Klassische Luxus-Limousine", bucket: "Mercedes", passengers: "3", luggage: "3",
      features: ["Chauffeur-Paket", "Burmester 4D", "Massagesitze", "Executive"], img: "--img-sclass" },
    { name: "Mercedes-Benz E-Klasse", category: "Business-Limousine", bucket: "Mercedes", passengers: "3", luggage: "3",
      features: ["Lederausstattung", "Klimakomfort", "WLAN", "Stille Kabine"], img: "--img-eclass" },
    { name: "Mercedes-Benz V-Klasse", category: "First-Class-Van", bucket: "Van", passengers: "6", luggage: "6",
      features: ["Konferenzbestuhlung", "Tisch", "Verdunkelung", "Großer Kofferraum"], img: "--img-vclass" },
    { name: "Mercedes-Benz EQV", category: "Elektrischer First-Class-Van", bucket: "Van", passengers: "6", luggage: "6",
      features: ["Konferenzbestuhlung", "Lautlos", "Emissionsfrei", "Premium"], img: "--img-eqv" },
    { name: "Mercedes-Benz Sprinter", category: "Gruppen-Van ab 12 Personen", bucket: "Van", passengers: "12+", luggage: "12+",
      features: ["Komfortbestuhlung", "Klimaanlage", "Stauraum", "Für Gruppen"], img: "--img-sprinter" },
    { name: "Tesla Model S", category: "Elektrische Performance-Limousine", bucket: "Tesla", passengers: "3", luggage: "2",
      features: ["Autopilot", "Premium Audio", "Glasdach", "Emissionsfrei"], img: "--img-tesla-s" },
    { name: "Tesla Model X", category: "Elektrischer Premium-SUV", bucket: "Tesla", passengers: "5", luggage: "4",
      features: ["Falcon-Wing-Türen", "Glasdach", "HEPA-Filter", "Emissionsfrei"], img: "--img-tesla-x" },
    { name: "Tesla Model Y", category: "Elektrischer Komfort-SUV", bucket: "Tesla", passengers: "4", luggage: "3",
      features: ["Glasdach", "Premium Audio", "Innenraum", "Emissionsfrei"], img: "--img-tesla-y" },
    { name: "Tesla Model 3", category: "Elektrische Business-Limousine", bucket: "Tesla", passengers: "3", luggage: "2",
      features: ["Premium Audio", "Glasdach", "Schnellladen", "Emissionsfrei"], img: "--img-tesla-3" },
  ];

  function renderFleet() {
    const grid = document.getElementById('fleetGrid');
    if (!grid) return;
    grid.innerHTML = FLEET.map(c => `
      <article class="car reveal" data-bucket="${c.bucket}">
        <div class="car__media" style="background-image: var(${c.img});">
          <span class="car__badge">${c.bucket === 'Van' ? 'Van' : c.bucket}</span>
        </div>
        <div class="car__body">
          <h3 class="car__name">${c.name}</h3>
          <span class="car__class">${c.category}</span>
          <div class="car__specs">
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><strong>${c.passengers}</strong> Pers.</span>
            <span><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><strong>${c.luggage}</strong> Gepäck</span>
          </div>
          <ul class="car__feats">${c.features.map(f => `<li>${f}</li>`).join('')}</ul>
          <a class="car__cta" href="#contact">Diese Klasse anfragen →</a>
        </div>
      </article>
    `).join('');
  }

  // ------- Reveal -------
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-in'));
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
    els.forEach(el => io.observe(el));
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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.classList.remove('is-err', 'is-ok');
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

    // Hero title: only override when the admin's value actually differs from
    // the markup default; preserves the design's <em> styling for unchanged copy.
    const hero = c.hero || {};
    const titleEl = document.querySelector('.hero__title');
    if (titleEl && hero.title && hero.title.trim() !== titleEl.textContent.trim()) {
      titleEl.textContent = hero.title;
    }
    const subtitleEl = document.querySelector('.hero__subtitle');
    if (subtitleEl && hero.subtitle) {
      subtitleEl.textContent = hero.subtitle;
    }
    const ctas = document.querySelectorAll('.hero__cta a');
    if (ctas[0] && hero.primaryCta) ctas[0].textContent = hero.primaryCta;
    if (ctas[1] && hero.secondaryCta) ctas[1].textContent = hero.secondaryCta;

    const heroBg = document.getElementById('heroBg');
    if (heroBg) {
      heroBg.style.backgroundImage = hero.backgroundImage ? `url(${JSON.stringify(hero.backgroundImage)})` : '';
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
