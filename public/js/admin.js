(function () {
  'use strict';

  var csrfToken = '';
  var content = {};
  var cities = [];

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function toast(msg, ok) {
    var el = document.getElementById('admToast');
    el.textContent = msg;
    el.className = 'adm-toast is-visible ' + (ok === false ? 'is-err' : 'is-ok');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = 'adm-toast'; }, 3200);
  }

  function setMsg(id, msg, err) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'adm-save-msg' + (err ? ' is-err' : '');
    if (msg) {
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.textContent = ''; el.className = 'adm-save-msg'; }, 4000);
    }
  }

  async function api(method, path, body) {
    var opts = {
      method: method,
      headers: { 'x-csrf-token': csrfToken },
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var r = await fetch(path, opts);
    if (r.status === 401) { window.location.href = '/admin/login'; return null; }
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || r.statusText);
    if (data.csrfToken) csrfToken = data.csrfToken; // refresh if server rotates
    return data;
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    try {
      var csrfData = await fetch('/api/csrf').then(function (r) { return r.json(); });
      csrfToken = csrfData.csrfToken || '';

      var me = await fetch('/api/me').then(function (r) {
        if (!r.ok) { window.location.href = '/admin/login'; return null; }
        return r.json();
      });
      if (!me) return;
      document.getElementById('admUserName').textContent = me.user.username;

      content = await fetch('/api/content').then(function (r) { return r.json(); });
      populateForms();
    } catch (err) {
      console.error('Init error:', err);
    }

    setupNav();
    setupSaveHandlers();
    setupCityEditor();
    setupArrayEditors();
    setupInquiries();
    setupMedia();
    setupAccount();
    setupLogout();
  }

  // ─── Tab navigation ──────────────────────────────────────────────────────

  function setupNav() {
    var nav = document.getElementById('admNav');
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-panel]');
      if (!btn) return;
      var panelId = btn.dataset.panel;
      // Update active button
      nav.querySelectorAll('.adm-nav-item').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
      // Show panel
      document.querySelectorAll('.adm-panel').forEach(function (p) {
        p.classList.toggle('is-active', p.id === 'panel-' + panelId);
      });
      // Lazy-load inquiries and media when their tab is opened
      if (panelId === 'inquiries') loadInquiries();
      if (panelId === 'media') loadMedia();
    });
  }

  // ─── Populate forms ──────────────────────────────────────────────────────

  function populateForms() {
    var c = content;
    // Brand
    setVal('brandName', c.brand && c.brand.name);
    setVal('brandTagline', c.brand && c.brand.tagline);
    setVal('brandLogoText', c.brand && c.brand.logoText);
    // Hero
    setVal('heroEyebrow', c.hero && c.hero.eyebrow);
    setVal('heroTitle', c.hero && c.hero.title);
    setVal('heroSubtitle', c.hero && c.hero.subtitle);
    setVal('heroPrimaryCta', c.hero && c.hero.primaryCta);
    setVal('heroSecondaryCta', c.hero && c.hero.secondaryCta);
    setVal('heroBackground', c.hero && c.hero.backgroundImage);
    // About
    setVal('aboutEyebrow', c.about && c.about.eyebrow);
    setVal('aboutTitle', c.about && c.about.title);
    setVal('aboutBody', c.about && c.about.body);
    // Coverage
    setVal('coverageTitle', c.coverage && c.coverage.title);
    setVal('coverageBody', c.coverage && c.coverage.body);
    cities = (c.coverage && Array.isArray(c.coverage.cities)) ? c.coverage.cities.slice() : [];
    renderCityTags();
    // CTA
    setVal('ctaTitle', c.cta && c.cta.title);
    setVal('ctaSubtitle', c.cta && c.cta.subtitle);
    setVal('ctaButton', c.cta && c.cta.button);
    // Contact
    setVal('contactPhone', c.contact && c.contact.phone);
    setVal('contactPhoneHref', c.contact && c.contact.phoneHref);
    setVal('contactEmail', c.contact && c.contact.email);
    setVal('contactWhatsapp', c.contact && c.contact.whatsapp);
    setVal('contactWhatsappHref', c.contact && c.contact.whatsappHref);
    setVal('contactAddress', c.contact && c.contact.address);
    setVal('contactHours', c.contact && c.contact.hours);
    // Legal
    setVal('legalImpressum', c.legal && c.legal.impressum);
    setVal('legalDatenschutz', c.legal && c.legal.datenschutz);
    setVal('legalAgb', c.legal && c.legal.agb);
    // SEO
    setVal('seoTitle', c.seo && c.seo.title);
    setVal('seoDescription', c.seo && c.seo.description);
    setVal('seoOgImage', c.seo && c.seo.ogImage);
    // Array editors
    renderServices();
    renderFleet();
    renderVoices();
  }

  // ─── City editor ─────────────────────────────────────────────────────────

  function renderCityTags() {
    var host = document.getElementById('cityTags');
    host.innerHTML = '';
    cities.forEach(function (city, i) {
      var span = document.createElement('span');
      span.className = 'adm-city-tag';
      span.textContent = city;
      var btn = document.createElement('button');
      btn.className = 'adm-city-remove';
      btn.textContent = '×';
      btn.setAttribute('aria-label', city + ' entfernen');
      btn.addEventListener('click', function () {
        cities.splice(i, 1);
        renderCityTags();
      });
      span.appendChild(btn);
      host.appendChild(span);
    });
  }

  function setupCityEditor() {
    var input = document.getElementById('cityInput');
    var btn = document.getElementById('cityAddBtn');
    function addCity() {
      var v = input.value.trim();
      if (v && !cities.includes(v)) { cities.push(v); renderCityTags(); }
      input.value = '';
      input.focus();
    }
    btn.addEventListener('click', addCity);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addCity(); } });
  }

  // ─── Services editor ──────────────────────────────────────────────────────

  var ICON_OPTIONS = ['plane','briefcase','ring','users','route','star','shield','clock','sparkle','globe'];

  function renderServices() {
    var services = (content.services && Array.isArray(content.services)) ? content.services : [];
    renderItemList('servicesList', services, buildServiceItem);
  }

  function buildServiceItem(item, i) {
    var div = document.createElement('div');
    div.className = 'adm-item';
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num">Service ' + (i + 1) + '</span>' +
      '<button class="adm-btn adm-btn--danger" data-remove="' + i + '">Entfernen</button></div>' +
      '<div class="adm-item-fields">' +
        '<div class="adm-grid2">' +
          '<div class="adm-field"><label class="adm-field-label">Icon</label>' +
          '<select class="adm-select adm-input" data-svc-icon>' +
          ICON_OPTIONS.map(function (ic) {
            return '<option value="' + ic + '"' + (item.icon === ic ? ' selected' : '') + '>' + ic + '</option>';
          }).join('') +
          '</select></div>' +
          '<div class="adm-field"><label class="adm-field-label">Titel</label><input class="adm-input" data-svc-title maxlength="120" value="' + esc(item.title) + '" /></div>' +
        '</div>' +
        '<div class="adm-field"><label class="adm-field-label">Beschreibung</label><textarea class="adm-textarea" data-svc-text maxlength="600" rows="3">' + esc(item.text) + '</textarea></div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.services = readServices();
      content.services.splice(i, 1);
      renderServices();
    });
    return div;
  }

  function readServices() {
    var host = document.getElementById('servicesList');
    var items = [];
    host.querySelectorAll('.adm-item').forEach(function (item) {
      items.push({
        icon: item.querySelector('[data-svc-icon]').value,
        title: item.querySelector('[data-svc-title]').value,
        text: item.querySelector('[data-svc-text]').value,
      });
    });
    return items;
  }

  document.getElementById('addService').addEventListener('click', function () {
    content.services = readServices();
    content.services.push({ icon: 'star', title: '', text: '' });
    renderServices();
  });

  // ─── Fleet editor ─────────────────────────────────────────────────────────

  function renderFleet() {
    var fleet = (content.fleet && Array.isArray(content.fleet)) ? content.fleet : [];
    renderItemList('fleetList', fleet, buildFleetItem);
  }

  function buildFleetItem(item, i) {
    var feats = Array.isArray(item.features) ? item.features.join(', ') : '';
    var div = document.createElement('div');
    div.className = 'adm-item';
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num">Fahrzeug ' + (i + 1) + '</span>' +
      '<button class="adm-btn adm-btn--danger" data-remove="' + i + '">Entfernen</button></div>' +
      '<div class="adm-item-fields">' +
        '<div class="adm-grid2">' +
          '<div class="adm-field"><label class="adm-field-label">Name</label><input class="adm-input" data-fl-name maxlength="80" value="' + esc(item.name) + '" /></div>' +
          '<div class="adm-field"><label class="adm-field-label">Kategorie</label><input class="adm-input" data-fl-cat maxlength="60" value="' + esc(item.category) + '" /></div>' +
        '</div>' +
        '<div class="adm-grid2">' +
          '<div class="adm-field"><label class="adm-field-label">Passagiere</label><input class="adm-input" data-fl-pax maxlength="20" value="' + esc(item.passengers) + '" /></div>' +
          '<div class="adm-field"><label class="adm-field-label">Gepäck</label><input class="adm-input" data-fl-lug maxlength="20" value="' + esc(item.luggage) + '" /></div>' +
        '</div>' +
        '<div class="adm-field"><label class="adm-field-label">Features (kommagetrennt)</label><input class="adm-input" data-fl-feats maxlength="800" value="' + esc(feats) + '" /></div>' +
        '<div class="adm-field"><label class="adm-field-label">Bild (URL)</label><input class="adm-input" data-fl-img value="' + esc(item.image) + '" /></div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.fleet = readFleet();
      content.fleet.splice(i, 1);
      renderFleet();
    });
    return div;
  }

  function readFleet() {
    var host = document.getElementById('fleetList');
    var items = [];
    host.querySelectorAll('.adm-item').forEach(function (item) {
      var featsRaw = item.querySelector('[data-fl-feats]').value;
      items.push({
        name: item.querySelector('[data-fl-name]').value,
        category: item.querySelector('[data-fl-cat]').value,
        passengers: item.querySelector('[data-fl-pax]').value,
        luggage: item.querySelector('[data-fl-lug]').value,
        features: featsRaw.split(',').map(function (f) { return f.trim(); }).filter(Boolean),
        image: item.querySelector('[data-fl-img]').value,
      });
    });
    return items;
  }

  document.getElementById('addFleet').addEventListener('click', function () {
    content.fleet = readFleet();
    content.fleet.push({ name: '', category: '', passengers: '', luggage: '', features: [], image: '' });
    renderFleet();
  });

  // ─── Voices editor ────────────────────────────────────────────────────────

  function renderVoices() {
    var voices = (content.testimonials && Array.isArray(content.testimonials)) ? content.testimonials : [];
    renderItemList('voicesList', voices, buildVoiceItem);
  }

  function buildVoiceItem(item, i) {
    var div = document.createElement('div');
    div.className = 'adm-item';
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num">Stimme ' + (i + 1) + '</span>' +
      '<button class="adm-btn adm-btn--danger" data-remove="' + i + '">Entfernen</button></div>' +
      '<div class="adm-item-fields">' +
        '<div class="adm-grid2">' +
          '<div class="adm-field"><label class="adm-field-label">Name</label><input class="adm-input" data-vc-author maxlength="120" value="' + esc(item.author) + '" /></div>' +
          '<div class="adm-field"><label class="adm-field-label">Rolle</label><input class="adm-input" data-vc-role maxlength="120" value="' + esc(item.role) + '" /></div>' +
        '</div>' +
        '<div class="adm-field"><label class="adm-field-label">Zitat</label><textarea class="adm-textarea" data-vc-quote maxlength="800" rows="3">' + esc(item.quote) + '</textarea></div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.testimonials = readVoices();
      content.testimonials.splice(i, 1);
      renderVoices();
    });
    return div;
  }

  function readVoices() {
    var host = document.getElementById('voicesList');
    var items = [];
    host.querySelectorAll('.adm-item').forEach(function (item) {
      items.push({
        author: item.querySelector('[data-vc-author]').value,
        role: item.querySelector('[data-vc-role]').value,
        quote: item.querySelector('[data-vc-quote]').value,
      });
    });
    return items;
  }

  document.getElementById('addVoice').addEventListener('click', function () {
    content.testimonials = readVoices();
    content.testimonials.push({ author: '', role: '', quote: '' });
    renderVoices();
  });

  // ─── Generic item list renderer ───────────────────────────────────────────

  function renderItemList(hostId, items, buildFn) {
    var host = document.getElementById(hostId);
    host.innerHTML = '';
    items.forEach(function (item, i) {
      host.appendChild(buildFn(item, i));
    });
  }

  // ─── Save handlers ────────────────────────────────────────────────────────

  function setupSaveHandlers() {
    document.getElementById('saveGeneral').addEventListener('click', saveGeneral);
    document.getElementById('saveServices').addEventListener('click', saveServices);
    document.getElementById('saveFleet').addEventListener('click', saveFleet);
    document.getElementById('saveVoices').addEventListener('click', saveVoices);
    document.getElementById('saveContact').addEventListener('click', saveContact);
    document.getElementById('saveLegal').addEventListener('click', saveLegal);
    document.getElementById('saveSeo').addEventListener('click', saveSeo);
  }

  function setupArrayEditors() {}

  async function saveSection(msgId, patchFn) {
    var btn = document.querySelector('[id="save' + msgId.replace('msg','') + '"]');
    try {
      setMsg(msgId, '');
      patchFn();
      var result = await api('PUT', '/api/content', content);
      if (result) {
        content = result.content || content;
        populateForms();
        setMsg(msgId, 'Gespeichert.');
        toast('Gespeichert', true);
      }
    } catch (err) {
      setMsg(msgId, err.message || 'Fehler beim Speichern.', true);
    }
  }

  function saveGeneral() {
    saveSection('msgGeneral', function () {
      content.brand = { name: val('brandName'), tagline: val('brandTagline'), logoText: val('brandLogoText') };
      content.hero = {
        eyebrow: val('heroEyebrow'), title: val('heroTitle'),
        subtitle: val('heroSubtitle'), primaryCta: val('heroPrimaryCta'),
        secondaryCta: val('heroSecondaryCta'), backgroundImage: val('heroBackground'),
      };
      content.about = Object.assign({}, content.about, {
        eyebrow: val('aboutEyebrow'), title: val('aboutTitle'), body: val('aboutBody'),
      });
      content.coverage = { title: val('coverageTitle'), body: val('coverageBody'), cities: cities.slice() };
      content.cta = { title: val('ctaTitle'), subtitle: val('ctaSubtitle'), button: val('ctaButton') };
    });
  }

  function saveServices() {
    saveSection('msgServices', function () { content.services = readServices(); });
  }
  function saveFleet() {
    saveSection('msgFleet', function () { content.fleet = readFleet(); });
  }
  function saveVoices() {
    saveSection('msgVoices', function () { content.testimonials = readVoices(); });
  }

  function saveContact() {
    saveSection('msgContact', function () {
      content.contact = {
        phone: val('contactPhone'), phoneHref: val('contactPhoneHref'),
        email: val('contactEmail'), whatsapp: val('contactWhatsapp'),
        whatsappHref: val('contactWhatsappHref'), address: val('contactAddress'),
        hours: val('contactHours'),
      };
    });
  }

  function saveLegal() {
    saveSection('msgLegal', function () {
      content.legal = { impressum: val('legalImpressum'), datenschutz: val('legalDatenschutz'), agb: val('legalAgb') };
    });
  }

  function saveSeo() {
    saveSection('msgSeo', function () {
      content.seo = { title: val('seoTitle'), description: val('seoDescription'), ogImage: val('seoOgImage') };
    });
  }

  // ─── Inquiries ────────────────────────────────────────────────────────────

  async function loadInquiries() {
    var host = document.getElementById('inquiriesList');
    host.innerHTML = '<p class="adm-empty">Lade …</p>';
    try {
      var list = await fetch('/api/inquiries', { headers: { 'x-csrf-token': csrfToken } }).then(function (r) { return r.json(); });
      host.innerHTML = '';
      if (!list.length) { host.innerHTML = '<p class="adm-empty">Keine Anfragen vorhanden.</p>'; return; }
      list.forEach(function (entry) {
        host.appendChild(buildInquiryCard(entry));
      });
    } catch (err) {
      host.innerHTML = '<p class="adm-empty">Fehler beim Laden.</p>';
    }
  }

  function buildInquiryCard(e) {
    var div = document.createElement('div');
    div.className = 'adm-inquiry';
    div.id = 'inq-' + e.id;
    var meta = [e.vehicle, e.datetime, e.pickup && ('Von: ' + e.pickup), e.dropoff && ('Nach: ' + e.dropoff)]
      .filter(Boolean).join(' · ');
    div.innerHTML =
      '<div class="adm-inquiry-header">' +
        '<div><div class="adm-inquiry-who">' + esc(e.name) + '</div>' +
        '<div class="adm-inquiry-meta"><a href="mailto:' + esc(e.email) + '" style="color:#c9a86a">' + esc(e.email) + '</a>' + (e.phone ? ' · ' + esc(e.phone) : '') + '</div>' +
        (meta ? '<div class="adm-inquiry-meta">' + esc(meta) + '</div>' : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
          '<span class="adm-inquiry-time">' + new Date(e.receivedAt).toLocaleString('de-AT') + '</span>' +
          '<button class="adm-btn adm-btn--danger" data-inq-del="' + esc(e.id) + '">Löschen</button>' +
        '</div>' +
      '</div>' +
      '<div class="adm-inquiry-msg">' + esc(e.message) + '</div>';
    div.querySelector('[data-inq-del]').addEventListener('click', function () { deleteInquiry(e.id); });
    return div;
  }

  async function deleteInquiry(id) {
    if (!confirm('Anfrage löschen?')) return;
    try {
      await api('DELETE', '/api/inquiries/' + id);
      var el = document.getElementById('inq-' + id);
      if (el) el.remove();
      toast('Anfrage gelöscht', true);
    } catch (err) {
      toast('Fehler: ' + err.message, false);
    }
  }

  function setupInquiries() {}

  // ─── Media ────────────────────────────────────────────────────────────────

  async function loadMedia() {
    var grid = document.getElementById('mediaGrid');
    grid.innerHTML = '';
    try {
      var files = await fetch('/api/uploads', { headers: { 'x-csrf-token': csrfToken } }).then(function (r) { return r.json(); });
      if (!files.length) { grid.innerHTML = '<p class="adm-empty" style="width:100%">Noch keine Bilder hochgeladen.</p>'; return; }
      files.forEach(function (f) { grid.appendChild(buildMediaItem(f)); });
    } catch (err) {
      grid.innerHTML = '<p class="adm-empty">Fehler beim Laden.</p>';
    }
  }

  function buildMediaItem(f) {
    var div = document.createElement('div');
    div.className = 'adm-media-item';
    div.id = 'media-' + CSS.escape(f.name);
    var img = document.createElement('img');
    img.src = f.url; img.alt = f.name; img.loading = 'lazy';
    var nameEl = document.createElement('div');
    nameEl.className = 'adm-media-name'; nameEl.textContent = f.name;
    var delBtn = document.createElement('button');
    delBtn.className = 'adm-media-del'; delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', 'Löschen');
    delBtn.addEventListener('click', function () { deleteMedia(f.name); });
    div.appendChild(img); div.appendChild(nameEl); div.appendChild(delBtn);
    return div;
  }

  async function deleteMedia(name) {
    if (!confirm('Bild "' + name + '" löschen?')) return;
    try {
      await api('DELETE', '/api/uploads/' + encodeURIComponent(name));
      var el = document.getElementById('media-' + CSS.escape(name));
      if (el) el.remove();
      toast('Bild gelöscht', true);
    } catch (err) {
      toast('Fehler: ' + err.message, false);
    }
  }

  function setupMedia() {
    var zone = document.getElementById('uploadZone');
    var input = document.getElementById('uploadInput');
    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); uploadFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) uploadFile(input.files[0]); input.value = ''; });
  }

  async function uploadFile(file) {
    if (!file) return;
    var msg = document.getElementById('msgMedia');
    setMsg('msgMedia', 'Hochladen …');
    var form = new FormData();
    form.append('image', file);
    try {
      var r = await fetch('/api/upload', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: form });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
      setMsg('msgMedia', 'Hochgeladen: ' + data.url);
      loadMedia();
    } catch (err) {
      setMsg('msgMedia', err.message, true);
    }
  }

  // ─── Account ──────────────────────────────────────────────────────────────

  function setupAccount() {
    document.getElementById('changePw').addEventListener('click', async function () {
      var current = document.getElementById('pwCurrent').value;
      var next = document.getElementById('pwNew').value;
      var confirm2 = document.getElementById('pwConfirm').value;
      if (!current || !next) { setMsg('msgPw', 'Bitte alle Felder ausfüllen.', true); return; }
      if (next !== confirm2) { setMsg('msgPw', 'Die neuen Passwörter stimmen nicht überein.', true); return; }
      if (next.length < 10) { setMsg('msgPw', 'Mindestens 10 Zeichen erforderlich.', true); return; }
      try {
        await api('POST', '/api/password', { currentPassword: current, newPassword: next });
        setMsg('msgPw', 'Passwort erfolgreich geändert.');
        document.getElementById('pwCurrent').value = '';
        document.getElementById('pwNew').value = '';
        document.getElementById('pwConfirm').value = '';
      } catch (err) {
        setMsg('msgPw', err.message || 'Fehler.', true);
      }
    });
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  function setupLogout() {
    document.getElementById('admLogout').addEventListener('click', async function () {
      try {
        await api('POST', '/api/logout');
        window.location.href = '/admin/login';
      } catch {
        window.location.href = '/admin/login';
      }
    });
  }

  // ─── Escape HTML ──────────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  init();
}());
