(() => {
  'use strict';

  // ------- Locale -------
  // _locale is initialised from localStorage so the user's last choice survives
  // a page reload. Wrapped in try/catch because some private-browsing modes
  // throw on access. On a fresh visit with no saved value we sniff the
  // browser's preferred language: an English browser sees the EN copy first
  // rather than landing on German and having to toggle.
  let _locale = 'de';
  try {
    const saved = window.localStorage && window.localStorage.getItem('hosslimo.lang');
    if (saved === 'en' || saved === 'de') {
      _locale = saved;
    } else if (typeof navigator !== 'undefined' && navigator.language && /^en\b/i.test(navigator.language)) {
      _locale = 'en';
    }
  } catch (_) {}

  // pick() reads a translatable value. Admin-managed text fields accept either
  // a plain string (legacy / DE-only) or a `{de, en}` object. Falls back across
  // locales so an empty EN slot still shows the DE text rather than going blank.
  function pick(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v !== 'object') return '';
    return v[_locale] || v.de || v.en || '';
  }

  // Cached snapshot of the last /api/content payload — so the locale toggle can
  // re-run applyContent() without re-fetching (avoids a flicker and a race).
  let _content = null;

  // Hard-coded UI strings that don't live in /api/content. Keeping them here
  // lets the language toggle update the static markup of the original design
  // without re-templating it.
  const T_STRINGS = {
    // Nav
    navAbout:     { de: 'Über uns',          en: 'About' },
    navService:   { de: 'Service',           en: 'Services' },
    navFleet:     { de: 'Flotte',            en: 'Fleet' },
    navCoverage:  { de: 'Reichweite',        en: 'Coverage' },
    navVoices:    { de: 'Stimmen',           en: 'Voices' },
    navContact:   { de: 'Kontakt',           en: 'Contact' },
    navCta:       { de: 'Anfragen',          en: 'Enquire' },
    navMenuLabel: { de: 'Menü',              en: 'Menu' },
    navHauptnav:  { de: 'Hauptnavigation',   en: 'Main navigation' },
    mobileSend:   { de: 'Anfrage senden',    en: 'Send enquiry' },
    // Hero
    heroEyebrow:  { de: 'Wien · Österreich · Europa', en: 'Vienna · Austria · Europe' },
    heroScroll:   { de: 'Scroll',            en: 'Scroll' },
    heroScrollAria: { de: 'Weiter scrollen', en: 'Continue scrolling' },
    heroMeta1L:   { de: 'Rasch',             en: 'Swift' },
    heroMeta1V:   { de: 'Verfügbar',         en: 'Available' },
    heroMeta2L:   { de: '10+',               en: '10+' },
    heroMeta2V:   { de: 'Jahre Erfahrung',   en: 'Years of experience' },
    heroMeta3L:   { de: 'EU',                en: 'EU' },
    heroMeta3V:   { de: 'Auch Europaweit',   en: 'Across Europe too' },
    // Cert band
    certLabel:    { de: 'Zertifiziert',      en: 'Certified' },
    certBandAria: { de: 'Zertifizierungen',  en: 'Certifications' },
    // Section eyebrows (kept stable across re-renders)
    eyebrowAbout:    { de: '01 — Über Hosslimo',  en: '01 — About Hosslimo' },
    eyebrowServices: { de: '02 — Was wir bieten', en: '02 — What we offer' },
    eyebrowFleet:    { de: '03 — Unsere Flotte',  en: '03 — Our fleet' },
    eyebrowCoverage: { de: '04 — Reichweite',     en: '04 — Coverage' },
    eyebrowVoices:   { de: '05 — Stimmen',        en: '05 — Testimonials' },
    eyebrowContact:  { de: '06 — Anfrage',        en: '06 — Enquiry' },
    // Services / Fleet / Voices section heads (only those NOT in content)
    servicesTitle:   { de: 'Service auf *höchstem* Niveau.',
                       en: 'Service at the *highest* level.' },
    servicesLead:    { de: 'Sechs Anlässe, ein Anspruch: höchste Qualität, individuell auf Ihre Reise zugeschnitten.',
                       en: 'Six occasions, one standard: the highest quality, tailored to your journey.' },
    fleetTitle:      { de: 'Schwarz. Geräuschlos. *Eindrucksvoll.*',
                       en: 'Black. Silent. *Striking.*' },
    fleetLead:       { de: 'Mercedes-Benz im Mittelpunkt, ergänzt durch eine kompakte Tesla-Auswahl — gepflegt, geprüft und immer einsatzbereit. Andere Fahrzeugklassen auf Anfrage.',
                       en: 'Mercedes-Benz at the centre, complemented by a compact Tesla selection — maintained, inspected and always ready. Other vehicle classes on request.' },
    voicesTitle:     { de: 'Was unsere *Gäste* sagen.',
                       en: 'What our *guests* say.' },
    // Fleet filters + cards
    chipAll:      { de: 'Alle',                  en: 'All' },
    chipMercedes: { de: 'Mercedes-Benz',         en: 'Mercedes-Benz' },
    chipTesla:    { de: 'Tesla',                 en: 'Tesla' },
    chipVan:      { de: 'Vans & Sprinter',       en: 'Vans & Sprinter' },
    fleetPers:    { de: 'Pers.',                 en: 'Pax' },
    fleetLug:     { de: 'Gepäck',                en: 'Luggage' },
    carCta:       { de: 'Diese Klasse anfragen →', en: 'Enquire about this class →' },
    svcCta:       { de: 'Anfragen →',            en: 'Enquire →' },
    // CTA / contact aside
    ctaReachTitle: { de: 'Direkt erreichbar.',   en: 'Reach us directly.' },
    // Form
    fldName:      { de: 'Name',                  en: 'Name' },
    fldEmail:     { de: 'E-Mail',                en: 'Email' },
    fldPhone:     { de: 'Telefon',               en: 'Phone' },
    fldDatetime:  { de: 'Datum & Uhrzeit',       en: 'Date & time' },
    fldPickup:    { de: 'Abholung',              en: 'Pick-up' },
    fldDropoff:   { de: 'Ziel',                  en: 'Destination' },
    fldService:   { de: 'Anlass',                en: 'Occasion' },
    fldVehicle:   { de: 'Fahrzeug',              en: 'Vehicle' },
    fldMessage:   { de: 'Nachricht',             en: 'Message' },
    phName:       { de: 'Ihr Name',              en: 'Your name' },
    phEmail:      { de: 'ihre@email.com',        en: 'your@email.com' },
    phPhone:      { de: '+43 …',                 en: '+43 …' },
    phAddress:    { de: 'Adresse, Hotel, Flughafen…', en: 'Address, hotel, airport…' },
    phMessage:    { de: 'Anzahl Personen, Sonderwünsche …',
                    en: 'Number of passengers, special requests …' },
    optService0:  { de: 'Allgemeine Anfrage',    en: 'General enquiry' },
    optService1:  { de: 'Flughafentransfer',     en: 'Airport transfer' },
    optService2:  { de: 'Business-Chauffeur',    en: 'Business chauffeur' },
    optService3:  { de: 'Hochzeiten & Events',   en: 'Weddings & events' },
    optService4:  { de: 'Gruppen- & VIP-Transfer', en: 'Group & VIP transfer' },
    optService5:  { de: 'Langstrecken',          en: 'Long-distance' },
    optService6:  { de: 'Roadshows & Premieren', en: 'Roadshows & premieres' },
    optService7:  { de: 'Andere — auf Anfrage',  en: 'Other — on request' },
    optVehicleAny: { de: 'Beliebig',             en: 'Any' },
    optVehicleOther: { de: 'Andere Klasse — auf Anfrage', en: 'Other class — on request' },
    formReqNote:  { de: 'Mit * markierte Felder sind Pflichtfelder.',
                    en: 'Fields marked with * are required.' },
    formSubmit:   { de: 'Anfrage senden',        en: 'Send enquiry' },
    formHint:     { de: 'Wir antworten persönlich — keine Auto-Mails, kein Spam.',
                    en: 'We reply personally — no auto-mails, no spam.' },
    sendingStatus: { de: 'Wird gesendet …',      en: 'Sending …' },
    toastOkTitle: { de: 'Vielen Dank für Ihre Anfrage',
                    en: 'Thank you for your enquiry' },
    toastOkMsg:   { de: 'Wir haben Ihre Nachricht erhalten und melden uns persönlich bei Ihnen — meist noch am selben Tag.',
                    en: "We've received your message and will get back to you personally — usually the same day." },
    toastErrTitle: { de: 'Senden nicht möglich', en: 'Unable to send' },
    toastErrMsg:   { de: 'Bitte versuchen Sie es erneut oder rufen Sie uns direkt an.',
                    en: 'Please try again or call us directly.' },
    sendFailed:   { de: 'Senden fehlgeschlagen.', en: 'Send failed.' },
    valName:      { de: 'Bitte geben Sie Ihren Namen an.',
                    en: 'Please enter your name.' },
    valEmail:     { de: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
                    en: 'Please enter a valid email address.' },
    valMessage:   { de: 'Bitte beschreiben Sie kurz Ihre Anfrage.',
                    en: 'Please describe your enquiry briefly.' },
    // Footer
    footColContact: { de: 'Kontakt',           en: 'Contact' },
    footColService: { de: 'Service',           en: 'Services' },
    footColLegal:   { de: 'Rechtliches',       en: 'Legal' },
    footLnk1:     { de: 'Flughafentransfer',   en: 'Airport transfer' },
    footLnk2:     { de: 'Business-Chauffeur',  en: 'Business chauffeur' },
    footLnk3:     { de: 'Hochzeiten & Events', en: 'Weddings & events' },
    footLnk4:     { de: 'Gruppen-Transfer',    en: 'Group transfer' },
    footImpressum:  { de: 'Impressum',         en: 'Legal notice' },
    footDatenschutz:{ de: 'Datenschutz',       en: 'Privacy' },
    footAgb:        { de: 'AGB',               en: 'Terms' },
    footRights:   { de: 'Alle Rechte vorbehalten.', en: 'All rights reserved.' },
    // Legal modal headings
    legalImpressum:   { de: 'Impressum',          en: 'Legal notice' },
    legalDatenschutz: { de: 'Datenschutz',        en: 'Privacy policy' },
    legalAgb:         { de: 'AGB',                en: 'Terms & conditions' },
    legalPlaceholderImpr:   { de: 'Bitte ergänzen Sie Ihre Impressums-Angaben im Admin-Bereich.',
                              en: 'Please add your legal notice in the admin area.' },
    legalPlaceholderDs:     { de: 'Bitte ergänzen Sie Ihre Datenschutzerklärung im Admin-Bereich.',
                              en: 'Please add your privacy policy in the admin area.' },
    legalPlaceholderAgb:    { de: 'Bitte ergänzen Sie Ihre AGB im Admin-Bereich.',
                              en: 'Please add your terms & conditions in the admin area.' },
    // Language button (shows the OPPOSITE locale)
    langToBtn:    { de: 'EN',                  en: 'DE' },
    langToAria:   { de: 'Switch to English',   en: 'Auf Deutsch wechseln' },
    // Cookie consent
    consentTitle: { de: 'Cookies & Datenschutz', en: 'Cookies & privacy' },
    // The {link}…{/link} markers are replaced with a real anchor that opens
    // the Datenschutz modal (data-legal="datenschutz" — wired by setupLegal).
    consentBody:  {
      de: 'Wir verwenden ausschließlich technisch notwendige Cookies sowie Google reCAPTCHA, um unsere Website sicher und funktional zu halten. Wir setzen keine Tracking- oder Werbe-Cookies ein. Mehr Informationen finden Sie in unserer {link}Datenschutzerklärung{/link}.',
      en: "We use only technically necessary cookies and Google reCAPTCHA to keep our website secure and functional. We don't set any tracking or advertising cookies. More information is available in our {link}privacy policy{/link}.",
    },
    consentAccept:  { de: 'Akzeptieren',      en: 'Accept' },
    consentDecline: { de: 'Ablehnen',         en: 'Decline' },
    consentPrivacy: { de: 'Datenschutzerklärung', en: 'privacy policy' },
  };

  function T(key) {
    const entry = T_STRINGS[key];
    if (!entry) return '';
    return entry[_locale] || entry.de || entry.en || '';
  }

  // Reflect the active locale on the <html lang> attribute for screen readers
  // and CSS hyphenation. Kept idempotent so toggling is cheap.
  function setHtmlLang(loc) {
    try { document.documentElement.setAttribute('lang', loc); } catch (_) {}
  }
  setHtmlLang(_locale);

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
    { name: "Tesla Model Y", category: "Juniper 2026 · Elektrischer Komfort-SUV", bucket: "Tesla", passengers: "4", luggage: "3",
      features: ["Juniper-Refresh 2026", "Glasdach", "Premium Audio", "Emissionsfrei"], img: "--img-tesla-y" },
    { name: "Tesla Model 3", category: "Highland 2026 · Elektrische Business-Limousine", bucket: "Tesla", passengers: "3", luggage: "2",
      features: ["Highland-Refresh 2026", "Premium Audio", "Glasdach", "Emissionsfrei"], img: "--img-tesla-3" },
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
    const pers = T('fleetPers');
    const lug = T('fleetLug');
    const carCta = T('carCta');
    grid.innerHTML = cars.map((c) => `
      <article class="car reveal" data-bucket="${escHtml(c.bucket)}">
        <div class="car__media" data-bg="${escHtml(c.bgImage)}">
          <span class="car__badge">${escHtml(c.bucket === 'Van' ? 'Van' : c.bucket)}</span>
        </div>
        <div class="car__body">
          <h3 class="car__name">${escHtml(c.name)}</h3>
          <span class="car__class">${escHtml(c.category)}</span>
          <div class="car__specs">
            <span><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg><strong>${escHtml(c.passengers)}</strong> ${escHtml(pers)}</span>
            <span><svg viewBox="0 0 24 24"><rect x="4" y="7" width="16" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg><strong>${escHtml(c.luggage)}</strong> ${escHtml(lug)}</span>
          </div>
          <ul class="car__feats">${c.features.map((f) => `<li>${escHtml(f)}</li>`).join('')}</ul>
          <a class="car__cta" href="#contact" data-car-name="${escHtml(c.name)}">${escHtml(carCta)}</a>
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
      const title = item && pick(item.title);
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
    const backdrop = document.getElementById('navBackdrop');
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    if (burger && mobile) {
      const toggle = (open) => {
        const willOpen = typeof open === 'boolean' ? open : !mobile.classList.contains('is-open');
        mobile.classList.toggle('is-open', willOpen);
        burger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (backdrop) backdrop.classList.toggle('is-open', willOpen);
        // Lock body scroll while the menu is open so the blurred page
        // doesn't scroll behind the focused menu.
        document.body.classList.toggle('is-nav-open', willOpen);
      };
      burger.addEventListener('click', () => toggle());
      mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggle(false)));
      if (backdrop) backdrop.addEventListener('click', () => toggle(false));
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

  // ------- Legal (text loaded from /api/content; values are localizable) -------
  // LEGAL holds the admin-managed value for each key, which may be a plain
  // string OR a {de, en} object. pick() resolves at open time so the dialog
  // always shows the active locale.
  let LEGAL = { impressum: '', datenschutz: '', agb: '' };
  function setupLegal() {
    const dialog = document.getElementById('legalDialog');
    const title = document.getElementById('legalTitle');
    const body = document.getElementById('legalBody');
    const close = dialog?.querySelector('.legal__close');
    if (!dialog || !title || !body || !close) return;
    const labelKey = { impressum: 'legalImpressum', datenschutz: 'legalDatenschutz', agb: 'legalAgb' };
    const placeholderKey = { impressum: 'legalPlaceholderImpr', datenschutz: 'legalPlaceholderDs', agb: 'legalPlaceholderAgb' };
    // Document-level delegation so anchors added later (e.g. the link inside
    // the cookie-consent banner, which gets its href re-rendered on every
    // locale toggle) trigger the modal without needing per-anchor binding.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('[data-legal]');
      if (!a) return;
      e.preventDefault();
      const key = a.dataset.legal;
      title.textContent = T(labelKey[key] || '');
      body.textContent = pick(LEGAL[key]) || T(placeholderKey[key] || '');
      if (typeof dialog.showModal === 'function') dialog.showModal();
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

  // ------- Toast for contact-form feedback -------
  const TOAST_ICONS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5 12-13"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };
  let _toastTimer = 0;
  function showToast(title, msg, kind, autoHideMs) {
    const toast = document.getElementById('contactToast');
    if (!toast) return;
    toast.querySelector('.toast__title').textContent = title;
    toast.querySelector('.toast__msg').textContent = msg;
    toast.querySelector('.toast__icon').innerHTML = TOAST_ICONS[kind] || TOAST_ICONS.ok;
    toast.classList.toggle('is-err', kind === 'err');
    toast.removeAttribute('hidden');
    // force reflow so the transition runs even on fast successive shows
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    clearTimeout(_toastTimer);
    if (autoHideMs && autoHideMs > 0) _toastTimer = setTimeout(hideToast, autoHideMs);
  }
  function hideToast() {
    const toast = document.getElementById('contactToast');
    if (!toast) return;
    toast.classList.remove('is-visible');
    setTimeout(() => toast.setAttribute('hidden', ''), 400);
  }
  function setupToast() {
    const toast = document.getElementById('contactToast');
    if (!toast) return;
    const closeBtn = toast.querySelector('.toast__close');
    if (closeBtn) closeBtn.addEventListener('click', hideToast);
  }

  // ------- Contact form (real POST to /api/contact) -------
  function setupForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');
    if (!form) return;

    const REQUIRED = [
      { name: 'name', test: (v) => v.length >= 2, msgKey: 'valName' },
      { name: 'email', test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), msgKey: 'valEmail' },
      { name: 'message', test: (v) => v.length >= 5, msgKey: 'valMessage' },
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
          if (!firstInvalid) { firstInvalid = field; firstError = T(r.msgKey); }
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

      status.textContent = T('sendingStatus');
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        data.recaptchaToken = await getRecaptchaToken('contact');
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || T('sendFailed'));
        status.textContent = '';
        showToast(T('toastOkTitle'), T('toastOkMsg'), 'ok', 8000);
        form.reset();
      } catch (err) {
        status.textContent = '';
        showToast(T('toastErrTitle'), err.message || T('toastErrMsg'), 'err', 0);
      }
    });
  }

  // ------- Apply admin-managed content (overrides only when set) -------
  function applyContent(c) {
    if (!c) return;
    _content = c;
    const seoTitle = pick(c.seo && c.seo.title);
    if (seoTitle) document.title = seoTitle;
    const md = document.querySelector('meta[name="description"]');
    const seoDesc = pick(c.seo && c.seo.description);
    if (md && seoDesc) md.setAttribute('content', seoDesc);
    if (c.legal) {
      // Store the raw values (string or {de,en}); pick() resolves at open time
      // so toggling locale immediately updates an already-open dialog re-open.
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
    setEm(document.querySelector('.hero__title'), pick(hero.title));
    setText(document.querySelector('.hero__subtitle'), pick(hero.subtitle));
    const ctas = document.querySelectorAll('.hero__cta a');
    setText(ctas[0], pick(hero.primaryCta));
    setText(ctas[1], pick(hero.secondaryCta));
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
    setText(document.querySelector('.foot__brand p'), pick(brand.tagline));
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
    setText(document.querySelector('#about .section__num'), pick(about.eyebrow));
    setEm(document.querySelector('#about .section__title'), pick(about.title));
    setText(document.querySelector('#about .about__body'), pick(about.body));

    // About media image (left of the text). Empty value clears the inline
    // override so the design's CSS-variable image (--img-about) stays.
    const aboutMedia = document.querySelector('.about__media');
    if (aboutMedia) {
      aboutMedia.style.backgroundImage = about.image
        ? `url(${JSON.stringify(about.image)})`
        : '';
    }

    // About highlights (Diskretion, Pünktlichkeit, …)
    const highlights = Array.isArray(about.highlights) ? about.highlights.filter((x) => x && (pick(x.title) || pick(x.text))) : [];
    const hlList = document.querySelector('.about__highlights');
    if (hlList && highlights.length) {
      const current = Array.from(hlList.querySelectorAll('.hl')).map((li) => ({
        title: norm(li.querySelector('.hl__title')?.textContent || ''),
        text: norm(li.querySelector('.hl__text')?.textContent || ''),
      }));
      const next = highlights.map((h) => {
        const t = pick(h.title);
        const x = pick(h.text);
        return {
          title: norm(t),
          text: norm(x),
          icon: String(h.icon || 'star').trim(),
          rawTitle: String(t),
          rawText: String(x),
        };
      });
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
    setEm(document.querySelector('#coverage .section__title'), pick(cov.title));
    setText(document.querySelector('#coverage .section__lead'), pick(cov.body));
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
    setEm(document.querySelector('#contact .section__title'), pick(cta.title));
    setText(document.querySelector('#contact .section__lead'), pick(cta.subtitle));
    setText(document.querySelector('#contactForm button[type="submit"]'), pick(cta.button));

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
    const waLabel = pick(ct.whatsapp);
    if (waLabel && ctaLines[2]) setText(ctaLines[2].querySelector('span'), waLabel);
    if (ct.whatsappHref && ctaLines[2]) ctaLines[2].setAttribute('href', ct.whatsappHref);
    const addrText = pick(ct.address);
    if (addrText) {
      const addr = document.querySelector('.cta__address');
      if (addr) {
        const html = String(addrText).split(/\r?\n/).map(escHtml).join('<br>');
        const currentEquiv = addr.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ').trim();
        if (currentEquiv !== addrText.trim()) addr.innerHTML = html;
      }
      const footAddr = document.querySelector('.foot__cols div:first-child span');
      if (footAddr) {
        const single = String(addrText).replace(/\s+/g, ' ').trim();
        if (single !== footAddr.textContent.trim()) footAddr.textContent = single;
      }
    }
    setText(document.querySelector('.cta__hours'), pick(ct.hours));

    // ------- Services -------
    const services = Array.isArray(c.services) ? c.services.filter((x) => x && (pick(x.title) || pick(x.text))) : [];
    const svcGrid = document.querySelector('.services__grid');
    if (svcGrid && services.length) {
      const current = Array.from(svcGrid.querySelectorAll('.svc')).map((s) => ({
        title: norm(s.querySelector('.svc__title')?.textContent || ''),
        text: norm(s.querySelector('.svc__text')?.textContent || ''),
      }));
      const next = services.map((s) => {
        const t = pick(s.title);
        const x = pick(s.text);
        return {
          title: norm(t),
          text: norm(x),
          icon: String(s.icon || 'star').trim(),
          rawTitle: String(t),
          rawText: String(x),
        };
      });
      const same =
        current.length === next.length &&
        current.every((cur, i) => cur.title === next[i].title && cur.text === next[i].text);
      if (!same) {
        const svcCta = T('svcCta');
        svcGrid.innerHTML = next
          .map((s, i) => `
            <article class="svc reveal">
              <span class="svc__num">${ROMAN[i] || i + 1 + '.'}</span>
              <span class="svc__icon">${SERVICE_ICONS[s.icon] || SERVICE_ICONS.star}</span>
              <h3 class="svc__title">${escHtml(s.rawTitle)}</h3>
              <p class="svc__text">${escHtml(s.rawText)}</p>
              <a class="svc__more" href="#contact" data-service-name="${escHtml(s.rawTitle)}">${escHtml(svcCta)}</a>
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
      // Resolve translatable fields once, then keep them on the item so
      // renderFleet receives plain strings — the renderer itself stays
      // locale-agnostic.
      const resolved = fleet.map((item) => ({
        name: item.name,
        category: pick(item.category),
        passengers: item.passengers,
        luggage: item.luggage,
        features: item.features,
        image: item.image,
      }));
      const next = resolved.map((item) => ({
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
        renderFleet(resolved);
        if (grid) setupReveal(grid);
      }
      syncVehicleOptions(fleet);
    }

    // ------- Stimmen -------
    const voices = Array.isArray(c.testimonials) ? c.testimonials.filter((x) => x && (x.author || pick(x.quote))) : [];
    const voicesGrid = document.querySelector('.voices__grid');
    if (voicesGrid && voices.length) {
      const current = Array.from(voicesGrid.querySelectorAll('.voice')).map((v) => ({
        quote: norm(v.querySelector('.voice__text')?.textContent || ''),
        author: norm(v.querySelector('.voice__who strong')?.textContent || ''),
        role: norm(v.querySelector('.voice__who span')?.textContent || ''),
      }));
      const next = voices.map((v) => {
        const q = pick(v.quote);
        const r = pick(v.role);
        return {
          quote: norm(q),
          author: norm(v.author || ''),
          role: norm(r),
          rawQuote: String(q),
          rawAuthor: String(v.author || ''),
          rawRole: String(r),
        };
      });
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

    // ------- Certifications (top band + footer) -------
    const certs = Array.isArray(c.certifications) ? c.certifications.filter((x) => x && (pick(x.label) || x.image)) : [];
    if (certs.length) {
      const certList = document.querySelector('.cert__list');
      if (certList) {
        certList.innerHTML = certs
          .map((x) => {
            const label = String(pick(x.label) || '');
            const img = String(x.image || '');
            const inner = img
              ? `<img src="${escHtml(img)}" alt="${escHtml(label)}" loading="lazy"><span>${escHtml(label)}</span>`
              : `<span>${escHtml(label)}</span>`;
            return `<li class="cert__item${img ? ' cert__item--has-img' : ''}">${inner}</li>`;
          })
          .join('');
      }
      const footCerts = document.querySelector('.foot__certs');
      if (footCerts) {
        footCerts.innerHTML = certs
          .map((x) => {
            const label = String(pick(x.label) || '');
            const img = String(x.image || '');
            const parts = [];
            if (img) parts.push(`<img src="${escHtml(img)}" alt="${escHtml(label)}" loading="lazy">`);
            if (label) parts.push(`<span>${escHtml(label)}</span>`);
            return `<li class="foot__cert${img ? ' foot__cert--has-img' : ''}">${parts.join('')}</li>`;
          })
          .join('');
      }
    }
  }

  // ------- Static UI translation (non-content labels) -------
  // Translates the parts of the original design markup that are NOT driven by
  // /api/content. Targets only stable selectors that applyContent() does not
  // also touch, so both functions can run in either order without fighting.
  function setEmInline(el, val) {
    if (!el || !val) return;
    el.innerHTML = emphasize(val);
  }
  function translateStaticUi() {
    const navKeys = ['navAbout', 'navService', 'navFleet', 'navCoverage', 'navVoices', 'navContact'];

    // Top nav
    document.querySelectorAll('.nav__menu a').forEach((a, i) => {
      if (navKeys[i]) a.textContent = T(navKeys[i]);
    });
    const navMenuEl = document.querySelector('.nav__menu');
    if (navMenuEl) navMenuEl.setAttribute('aria-label', T('navHauptnav'));
    const navCta = document.querySelector('.nav__cta');
    if (navCta) navCta.textContent = T('navCta');
    const burger = document.querySelector('.nav__burger');
    if (burger) burger.setAttribute('aria-label', T('navMenuLabel'));

    // Mobile menu (6 nav links + 1 send-enquiry CTA)
    const mobLinks = document.querySelectorAll('.nav__mobile a');
    mobLinks.forEach((a, i) => {
      if (i < navKeys.length) a.textContent = T(navKeys[i]);
      else if (i === navKeys.length) a.textContent = T('mobileSend');
    });

    // Hero static parts
    const heroEyeb = document.querySelector('.hero__content .eyebrow');
    if (heroEyeb) heroEyeb.textContent = T('heroEyebrow');
    const heroMeta = document.querySelectorAll('.hero__meta > div');
    const metaPairs = [['heroMeta1L', 'heroMeta1V'], ['heroMeta2L', 'heroMeta2V'], ['heroMeta3L', 'heroMeta3V']];
    metaPairs.forEach((pair, i) => {
      if (!heroMeta[i]) return;
      const s = heroMeta[i].querySelector('strong');
      const v = heroMeta[i].querySelector('span');
      if (s) s.textContent = T(pair[0]);
      if (v) v.textContent = T(pair[1]);
    });
    const heroScroll = document.querySelector('.hero__scroll');
    if (heroScroll) {
      heroScroll.textContent = T('heroScroll');
      heroScroll.setAttribute('aria-label', T('heroScrollAria'));
    }

    // Certifications band (only the static eyebrow; items are content-driven)
    const certBand = document.querySelector('.cert');
    if (certBand) certBand.setAttribute('aria-label', T('certBandAria'));
    const certLabel = document.querySelector('.cert__label');
    if (certLabel) certLabel.textContent = T('certLabel');

    // Section eyebrows that have no content-field counterpart
    const setEb = (sel, key) => { const el = document.querySelector(sel); if (el) el.textContent = T(key); };
    setEb('#services .section__num', 'eyebrowServices');
    setEb('#fleet .section__num', 'eyebrowFleet');
    setEb('#coverage .section__num', 'eyebrowCoverage');
    setEb('#voices .section__num', 'eyebrowVoices');
    setEb('#contact .section__num', 'eyebrowContact');

    // Static section titles + leads (no content-field counterpart)
    setEmInline(document.querySelector('#services .section__title'), T('servicesTitle'));
    const svcLead = document.querySelector('#services .section__lead');
    if (svcLead) svcLead.textContent = T('servicesLead');
    setEmInline(document.querySelector('#fleet .section__title'), T('fleetTitle'));
    const fleetLead = document.querySelector('#fleet .section__lead');
    if (fleetLead) fleetLead.textContent = T('fleetLead');
    setEmInline(document.querySelector('#voices .section__title'), T('voicesTitle'));

    // Fleet filter chips
    const chips = document.querySelectorAll('.fleet__filters .chip');
    const chipKeys = ['chipAll', 'chipMercedes', 'chipTesla', 'chipVan'];
    chips.forEach((c, i) => { if (chipKeys[i]) c.textContent = T(chipKeys[i]); });

    // CTA aside heading
    const reachH3 = document.querySelector('.cta__contact h3');
    if (reachH3) reachH3.textContent = T('ctaReachTitle');

    // Form labels (preserve the gold * marker on required fields)
    const setLabel = (name, key, required) => {
      const fld = document.querySelector(`#contactForm [name="${name}"]`);
      if (!fld) return;
      const span = fld.closest('label')?.querySelector(':scope > span');
      if (!span) return;
      if (required) span.innerHTML = `${escHtml(T(key))} <em class="req">*</em>`;
      else span.textContent = T(key);
    };
    setLabel('name', 'fldName', true);
    setLabel('email', 'fldEmail', true);
    setLabel('phone', 'fldPhone', false);
    setLabel('datetime', 'fldDatetime', false);
    setLabel('pickup', 'fldPickup', false);
    setLabel('dropoff', 'fldDropoff', false);
    setLabel('service', 'fldService', false);
    setLabel('vehicle', 'fldVehicle', false);
    setLabel('message', 'fldMessage', true);

    // Form placeholders
    const setPh = (name, key) => {
      const el = document.querySelector(`#contactForm [name="${name}"]`);
      if (el) el.setAttribute('placeholder', T(key));
    };
    setPh('name', 'phName');
    setPh('email', 'phEmail');
    setPh('phone', 'phPhone');
    setPh('pickup', 'phAddress');
    setPh('dropoff', 'phAddress');
    setPh('message', 'phMessage');

    // Select options tagged at boot (skip admin-appended options without tag)
    document.querySelectorAll('#contactForm option[data-i18n-key]').forEach((o) => {
      o.textContent = T(o.dataset.i18nKey);
    });

    // Required-fields note + submit-area hint
    const hints = document.querySelectorAll('#contactForm .cta__hint');
    if (hints[0]) {
      hints[0].innerHTML =
        _locale === 'en'
          ? 'Fields marked with <em class="req">*</em> are required.'
          : 'Mit <em class="req">*</em> markierte Felder sind Pflichtfelder.';
    }
    if (hints.length >= 2) hints[hints.length - 1].textContent = T('formHint');

    // Footer column headings + links
    const footCols = document.querySelectorAll('.foot__cols > div');
    if (footCols[0]) {
      const h = footCols[0].querySelector('h4');
      if (h) h.textContent = T('footColContact');
    }
    if (footCols[1]) {
      const h = footCols[1].querySelector('h4');
      if (h) h.textContent = T('footColService');
      const lks = footCols[1].querySelectorAll('a');
      const k = ['footLnk1', 'footLnk2', 'footLnk3', 'footLnk4'];
      lks.forEach((a, i) => { if (k[i]) a.textContent = T(k[i]); });
    }
    if (footCols[2]) {
      const h = footCols[2].querySelector('h4');
      if (h) h.textContent = T('footColLegal');
      const impr = footCols[2].querySelector('[data-legal="impressum"]');
      const ds = footCols[2].querySelector('[data-legal="datenschutz"]');
      const agb = footCols[2].querySelector('[data-legal="agb"]');
      if (impr) impr.textContent = T('footImpressum');
      if (ds) ds.textContent = T('footDatenschutz');
      if (agb) agb.textContent = T('footAgb');
    }

    // Footer copyright suffix — rebuilt so the year span stays a child node.
    const footBottomSpan = document.querySelector('.foot__bottom > span');
    if (footBottomSpan) {
      const inlineYear = footBottomSpan.querySelector('#year');
      const year = (inlineYear && inlineYear.textContent) || String(new Date().getFullYear());
      const brandName = (_content && _content.brand && _content.brand.name) || 'Hosslimo';
      footBottomSpan.innerHTML =
        `© <span id="year">${escHtml(year)}</span> ${escHtml(brandName)}. ${escHtml(T('footRights'))}`;
    }
  }

  // ------- Floating language toggle -------
  // The button always shows the OPPOSITE locale (so a German visitor sees "EN
  // + UK cross" inviting them to switch). Persists to localStorage and re-runs
  // applyContent + translateStaticUi on every click.
  const FLAG_GB = '<svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="60" height="36" fill="#ffffff"/><rect x="26" y="0" width="8" height="36" fill="#CE1124"/><rect x="0" y="14" width="60" height="8" fill="#CE1124"/></svg>';
  const FLAG_DE = '<svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="60" height="12" fill="#000000"/><rect y="12" width="60" height="12" fill="#DD0000"/><rect y="24" width="60" height="12" fill="#FFCE00"/></svg>';

  function refreshLocaleButton() {
    const btn = document.getElementById('langToggle');
    if (!btn) return;
    const label = btn.querySelector('.lang-toggle__label');
    const flag = btn.querySelector('.lang-toggle__flag');
    if (label) label.textContent = T('langToBtn');
    if (flag) flag.innerHTML = _locale === 'de' ? FLAG_GB : FLAG_DE;
    btn.setAttribute('aria-label', T('langToAria'));
    btn.setAttribute('data-locale', _locale);
  }

  function setupLocaleToggle() {
    const btn = document.getElementById('langToggle');
    if (!btn) return;
    refreshLocaleButton();
    btn.addEventListener('click', () => {
      _locale = _locale === 'de' ? 'en' : 'de';
      try {
        if (window.localStorage) window.localStorage.setItem('hosslimo.lang', _locale);
      } catch (_) {}
      setHtmlLang(_locale);
      refreshLocaleButton();
      // Static labels first so any flicker happens before the content re-render.
      translateStaticUi();
      if (_content) applyContent(_content);
      refreshConsentText();
    });
  }

  // ------- Cookie consent -------
  // Renders the consent body for the current locale, replacing the
  // {link}…{/link} marker with an inline anchor that triggers the
  // existing Datenschutz modal (setupLegal listens for data-legal clicks).
  function refreshConsentText() {
    const title = document.getElementById('consentTitle');
    if (title) title.textContent = T('consentTitle');
    const body = document.getElementById('consentText');
    if (body) {
      const tmpl = T('consentBody');
      const linkLabel = T('consentPrivacy');
      // Split on {link}…{/link} so the static segments are HTML-escaped
      // and only the anchor itself is injected as markup.
      const m = tmpl.match(/^([\s\S]*?)\{link\}([\s\S]*?)\{\/link\}([\s\S]*)$/);
      if (m) {
        body.innerHTML =
          escHtml(m[1]) +
          `<a href="#" data-legal="datenschutz">${escHtml(m[2] || linkLabel)}</a>` +
          escHtml(m[3]);
      } else {
        body.textContent = tmpl;
      }
    }
    const acc = document.getElementById('consentAccept');
    if (acc) acc.textContent = T('consentAccept');
    const dec = document.getElementById('consentDecline');
    if (dec) dec.textContent = T('consentDecline');
  }

  function setupConsent() {
    const el = document.getElementById('cookieConsent');
    if (!el) return;
    let saved = '';
    try { saved = (window.localStorage && window.localStorage.getItem('hosslimo.consent')) || ''; } catch (_) {}
    refreshConsentText();
    if (saved === 'accepted' || saved === 'declined') return; // already answered — stay hidden

    el.removeAttribute('hidden');
    // requestAnimationFrame so the transition runs from the off-screen state
    // even though we just toggled `hidden` and re-flowed in the same tick.
    requestAnimationFrame(() => el.classList.add('is-visible'));

    function dismiss(value) {
      try { if (window.localStorage) window.localStorage.setItem('hosslimo.consent', value); } catch (_) {}
      el.classList.remove('is-visible');
      // Match the CSS transition duration before hiding from layout.
      setTimeout(() => el.setAttribute('hidden', ''), 600);
    }
    document.getElementById('consentAccept')?.addEventListener('click', () => dismiss('accepted'));
    document.getElementById('consentDecline')?.addEventListener('click', () => dismiss('declined'));
  }

  // Tag the markup's known select options so translateStaticUi can find them
  // after syncServiceOptions / syncVehicleOptions append admin-defined entries
  // (which we deliberately do NOT translate — they're already locale-aware).
  function tagMarkupOptions() {
    const svc = document.querySelector('#contactForm select[name="service"]');
    if (svc) {
      Array.from(svc.options).forEach((o, i) => { o.dataset.i18nKey = `optService${i}`; });
    }
    const veh = document.querySelector('#contactForm select[name="vehicle"]');
    if (veh) {
      const opts = veh.options;
      if (opts.length) {
        opts[0].dataset.i18nKey = 'optVehicleAny';
        opts[opts.length - 1].dataset.i18nKey = 'optVehicleOther';
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
  setupToast();
  setupCarCta();
  setupServiceCta();
  tagMarkupOptions();
  translateStaticUi();
  setupLocaleToggle();
  setupConsent();

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
    .then((c) => {
      if (c) applyContent(c);
      // Re-run static translations after applyContent so dynamically rendered
      // grids (fleet, services) get their CTA labels too.
      translateStaticUi();
    })
    .catch(() => {});
})();
