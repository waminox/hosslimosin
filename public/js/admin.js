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

  // ─── Drag & drop reorder for admin item lists ─────────────────────────────
  // Attaches HTML5 drag-and-drop to a list of .adm-item children inside the
  // host element. The .adm-item must have draggable=true (set in the build
  // function) and the .adm-item-header is the visible grab affordance.
  // After a drop we re-read the array from the DOM (so any unsaved input
  // edits are preserved), splice the moved item to its new position, and
  // call the caller's render() to repaint with fresh closures.
  function makeListDraggable(hostId, itemSel, getArray, setArray, render) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var draggedIdx = null;

    host.addEventListener('dragstart', function (e) {
      var item = e.target.closest && e.target.closest(itemSel);
      if (!item) return;
      var items = Array.prototype.slice.call(host.querySelectorAll(itemSel));
      draggedIdx = items.indexOf(item);
      item.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(draggedIdx)); } catch (err) {}
      }
    });

    host.addEventListener('dragend', function () {
      host.querySelectorAll(itemSel).forEach(function (el) {
        el.classList.remove('is-dragging', 'is-drop-target');
      });
      draggedIdx = null;
    });

    host.addEventListener('dragover', function (e) {
      if (draggedIdx === null) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      var over = e.target.closest && e.target.closest(itemSel);
      host.querySelectorAll(itemSel).forEach(function (el) {
        el.classList.remove('is-drop-target');
      });
      if (over && !over.classList.contains('is-dragging')) over.classList.add('is-drop-target');
    });

    host.addEventListener('drop', function (e) {
      if (draggedIdx === null) return;
      e.preventDefault();
      var target = e.target.closest && e.target.closest(itemSel);
      if (!target) return;
      var items = Array.prototype.slice.call(host.querySelectorAll(itemSel));
      var newIdx = items.indexOf(target);
      if (newIdx === -1 || newIdx === draggedIdx) return;
      var arr = getArray();
      var moved = arr.splice(draggedIdx, 1)[0];
      arr.splice(newIdx, 0, moved);
      setArray(arr);
      render();
    });
  }

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
    setupPicker();
    setupReorder();
  }

  function setupReorder() {
    makeListDraggable('servicesList', '.adm-item',
      function () { return readServices(); },
      function (arr) { content.services = arr; },
      function () { renderServices(); });
    makeListDraggable('highlightsList', '.adm-item',
      function () { return readHighlights(); },
      function (arr) { content.about = content.about || {}; content.about.highlights = arr; },
      function () { renderHighlights(); });
    makeListDraggable('fleetList', '.adm-item',
      function () { return readFleet(); },
      function (arr) { content.fleet = arr; },
      function () { renderFleet(); });
    makeListDraggable('voicesList', '.adm-item',
      function () { return readVoices(); },
      function (arr) { content.testimonials = arr; },
      function () { renderVoices(); });
    makeListDraggable('cityTags', '.adm-city-tag',
      function () { return cities.slice(); },
      function (arr) { cities = arr; },
      function () { renderCityTags(); });
    makeListDraggable('certificationsList', '.adm-item',
      function () { return readCertifications(); },
      function (arr) { content.certifications = arr; },
      function () { renderCertifications(); });
  }

  // ─── Image picker (used by hero background, fleet images, SEO og) ─────────

  var pickerCallback = null;

  function openImagePicker(callback) {
    pickerCallback = callback;
    var picker = document.getElementById('admPicker');
    var body = document.getElementById('admPickerBody');
    var urlInput = document.getElementById('admPickerUrl');
    body.innerHTML = '<p class="adm-picker-empty">Lade …</p>';
    urlInput.value = '';
    picker.removeAttribute('hidden');
    fetch('/api/uploads', { headers: { 'x-csrf-token': csrfToken } })
      .then(function (r) { return r.json(); })
      .then(function (files) {
        if (!Array.isArray(files) || !files.length) {
          body.innerHTML = '<p class="adm-picker-empty">Keine Bilder vorhanden. Laden Sie zuerst Bilder im Tab „Medien" hoch.</p>';
          return;
        }
        body.innerHTML = '';
        files.forEach(function (f) {
          var item = document.createElement('div');
          item.className = 'adm-picker-item';
          item.setAttribute('role', 'button');
          item.setAttribute('tabindex', '0');
          item.setAttribute('aria-label', f.name);
          item.innerHTML =
            '<img src="' + esc(f.url) + '" alt="" loading="lazy" />' +
            '<div class="adm-picker-name">' + esc(f.name) + '</div>';
          item.addEventListener('click', function () { selectImage(f.url); });
          item.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectImage(f.url); }
          });
          body.appendChild(item);
        });
      })
      .catch(function () {
        body.innerHTML = '<p class="adm-picker-empty">Fehler beim Laden der Mediathek.</p>';
      });
  }

  function closePicker() {
    document.getElementById('admPicker').setAttribute('hidden', '');
    pickerCallback = null;
  }

  function selectImage(url) {
    var cb = pickerCallback;
    closePicker();
    if (cb) cb(url);
  }

  function setupPicker() {
    document.getElementById('admPickerClose').addEventListener('click', closePicker);
    document.getElementById('admPickerUseUrl').addEventListener('click', function () {
      var url = document.getElementById('admPickerUrl').value.trim();
      if (url) selectImage(url);
    });
    document.getElementById('admPickerUrl').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var url = e.target.value.trim();
        if (url) selectImage(url);
      }
    });
    // Click outside the card closes the picker.
    document.getElementById('admPicker').addEventListener('click', function (e) {
      if (e.target.id === 'admPicker') closePicker();
    });
    // Escape closes the picker.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('admPicker').hasAttribute('hidden')) closePicker();
    });
    // Static picker buttons (hero background, SEO og image)
    document.querySelectorAll('[data-pick-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-pick-target'));
        if (!input) return;
        openImagePicker(function (url) { input.value = url; });
      });
    });
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
    setVal('aboutImage', c.about && c.about.image);
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
    renderHighlights();
    renderFleet();
    renderVoices();
    renderCertifications();
  }

  // ─── City editor ─────────────────────────────────────────────────────────

  function renderCityTags() {
    var host = document.getElementById('cityTags');
    host.innerHTML = '';
    cities.forEach(function (city, i) {
      var span = document.createElement('span');
      span.className = 'adm-city-tag';
      span.draggable = true;
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
    div.draggable = true;
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num"><span class="adm-grip" aria-hidden="true">⋮⋮</span>Service ' + (i + 1) + '</span>' +
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

  // ─── Highlights editor (about boxes) ─────────────────────────────────────

  function renderHighlights() {
    var hs = (content.about && Array.isArray(content.about.highlights)) ? content.about.highlights : [];
    renderItemList('highlightsList', hs, buildHighlightItem);
  }

  function buildHighlightItem(item, i) {
    var div = document.createElement('div');
    div.className = 'adm-item';
    div.draggable = true;
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num"><span class="adm-grip" aria-hidden="true">⋮⋮</span>Highlight ' + (i + 1) + '</span>' +
      '<button class="adm-btn adm-btn--danger" data-remove="' + i + '">Entfernen</button></div>' +
      '<div class="adm-item-fields">' +
        '<div class="adm-grid2">' +
          '<div class="adm-field"><label class="adm-field-label">Icon</label>' +
          '<select class="adm-select adm-input" data-hl-icon>' +
          ICON_OPTIONS.map(function (ic) {
            return '<option value="' + ic + '"' + (item.icon === ic ? ' selected' : '') + '>' + ic + '</option>';
          }).join('') +
          '</select></div>' +
          '<div class="adm-field"><label class="adm-field-label">Titel</label><input class="adm-input" data-hl-title maxlength="120" value="' + esc(item.title) + '" /></div>' +
        '</div>' +
        '<div class="adm-field"><label class="adm-field-label">Beschreibung</label><textarea class="adm-textarea" data-hl-text maxlength="400" rows="2">' + esc(item.text) + '</textarea></div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.about = content.about || {};
      content.about.highlights = readHighlights();
      content.about.highlights.splice(i, 1);
      renderHighlights();
    });
    return div;
  }

  function readHighlights() {
    var host = document.getElementById('highlightsList');
    var items = [];
    host.querySelectorAll('.adm-item').forEach(function (item) {
      items.push({
        icon: item.querySelector('[data-hl-icon]').value,
        title: item.querySelector('[data-hl-title]').value,
        text: item.querySelector('[data-hl-text]').value,
      });
    });
    return items;
  }

  document.getElementById('addHighlight').addEventListener('click', function () {
    content.about = content.about || {};
    content.about.highlights = readHighlights();
    if (content.about.highlights.length >= 8) { toast('Maximal 8 Highlights erlaubt', false); return; }
    content.about.highlights.push({ icon: 'star', title: '', text: '' });
    renderHighlights();
  });

  // ─── Certifications editor (TÜV / ISO etc.) ──────────────────────────────

  function renderCertifications() {
    var certs = (content.certifications && Array.isArray(content.certifications)) ? content.certifications : [];
    renderItemList('certificationsList', certs, buildCertificationItem);
  }

  function buildCertificationItem(item, i) {
    var div = document.createElement('div');
    div.className = 'adm-item';
    div.draggable = true;
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num"><span class="adm-grip" aria-hidden="true">⋮⋮</span>Zertifikat ' + (i + 1) + '</span>' +
      '<button class="adm-btn adm-btn--danger" data-remove="' + i + '">Entfernen</button></div>' +
      '<div class="adm-item-fields">' +
        '<div class="adm-field"><label class="adm-field-label">Bezeichnung</label><input class="adm-input" data-cert-label maxlength="80" value="' + esc(item.label) + '" /></div>' +
        '<div class="adm-field"><label class="adm-field-label">Logo (optional)</label>' +
          '<div class="adm-img-field">' +
            '<input class="adm-input" data-cert-img value="' + esc(item.image) + '" placeholder="/uploads/… oder leer für Text-Badge" />' +
            '<button type="button" class="adm-btn adm-btn--ghost adm-btn--small" data-cert-pick>Auswählen</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.certifications = readCertifications();
      content.certifications.splice(i, 1);
      renderCertifications();
    });
    div.querySelector('[data-cert-pick]').addEventListener('click', function () {
      var input = div.querySelector('[data-cert-img]');
      openImagePicker(function (url) { input.value = url; });
    });
    return div;
  }

  function readCertifications() {
    var host = document.getElementById('certificationsList');
    var items = [];
    host.querySelectorAll('.adm-item').forEach(function (item) {
      items.push({
        label: item.querySelector('[data-cert-label]').value,
        image: item.querySelector('[data-cert-img]').value,
      });
    });
    return items;
  }

  document.getElementById('addCertification').addEventListener('click', function () {
    content.certifications = readCertifications();
    if (content.certifications.length >= 8) { toast('Maximal 8 Zertifikate erlaubt', false); return; }
    content.certifications.push({ label: '', image: '' });
    renderCertifications();
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
    div.draggable = true;
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num"><span class="adm-grip" aria-hidden="true">⋮⋮</span>Fahrzeug ' + (i + 1) + '</span>' +
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
        '<div class="adm-field"><label class="adm-field-label">Bild</label>' +
          '<div class="adm-img-field">' +
            '<input class="adm-input" data-fl-img value="' + esc(item.image) + '" placeholder="/uploads/… oder leer für Standard" />' +
            '<button type="button" class="adm-btn adm-btn--ghost adm-btn--small" data-fl-pick>Auswählen</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    div.querySelector('[data-remove]').addEventListener('click', function () {
      content.fleet = readFleet();
      content.fleet.splice(i, 1);
      renderFleet();
    });
    div.querySelector('[data-fl-pick]').addEventListener('click', function () {
      var input = div.querySelector('[data-fl-img]');
      openImagePicker(function (url) { input.value = url; });
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
    div.draggable = true;
    div.innerHTML =
      '<div class="adm-item-header"><span class="adm-item-num"><span class="adm-grip" aria-hidden="true">⋮⋮</span>Stimme ' + (i + 1) + '</span>' +
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
        image: val('aboutImage'),
        highlights: readHighlights(),
      });
      content.coverage = { title: val('coverageTitle'), body: val('coverageBody'), cities: cities.slice() };
      content.cta = { title: val('ctaTitle'), subtitle: val('ctaSubtitle'), button: val('ctaButton') };
      content.certifications = readCertifications();
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

  // ─── Inquiries: WhatsApp-style list + conversation modal ─────────────────

  var inquiriesCache = [];
  var currentConvId = null;

  async function loadInquiries() {
    var host = document.getElementById('inquiriesList');
    host.innerHTML = '<p class="adm-empty">Lade …</p>';
    try {
      var list = await fetch('/api/inquiries', { headers: { 'x-csrf-token': csrfToken } }).then(function (r) { return r.json(); });
      inquiriesCache = Array.isArray(list) ? list : [];
      renderConvList();
    } catch (err) {
      host.innerHTML = '<p class="adm-empty">Fehler beim Laden.</p>';
    }
  }

  function renderConvList() {
    var host = document.getElementById('inquiriesList');
    if (!inquiriesCache.length) {
      host.innerHTML = '<p class="adm-empty">Keine Anfragen vorhanden.</p>';
      return;
    }
    host.innerHTML = '<div class="adm-conv-list" id="convList"></div>';
    var listEl = document.getElementById('convList');
    inquiriesCache.forEach(function (e) { listEl.appendChild(buildConvListItem(e)); });
  }

  function buildConvListItem(e) {
    var div = document.createElement('div');
    div.className = 'adm-conv-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    var initials = (e.name || e.email || '?').trim().split(/\s+/).map(function (s) { return s.charAt(0); }).join('').slice(0, 2).toUpperCase() || '?';
    var replies = Array.isArray(e.replies) ? e.replies : [];
    var lastMsg = replies.length ? replies[replies.length - 1].body : (e.message || '');
    var lastAt = replies.length ? replies[replies.length - 1].at : e.receivedAt;
    var preview = lastMsg.replace(/\s+/g, ' ').slice(0, 110);
    var who = e.name || e.email || 'Anfrage';
    div.innerHTML =
      '<div class="adm-conv-avatar">' + esc(initials) + '</div>' +
      '<div class="adm-conv-body">' +
        '<div class="adm-conv-name">' +
          '<span>' + esc(who) + '</span>' +
          '<span class="adm-conv-time">' + esc(fmtRelTime(lastAt)) + '</span>' +
        '</div>' +
        '<div class="adm-conv-preview">' +
          '<span class="adm-conv-preview-text">' + esc(preview) + '</span>' +
          (replies.length ? '<span class="adm-conv-badge" title="Antworten">' + replies.length + '</span>' : '') +
        '</div>' +
      '</div>';
    div.addEventListener('click', function () { openConversation(e.id); });
    div.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openConversation(e.id); }
    });
    return div;
  }

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString('de-AT'); } catch (e) { return iso || ''; }
  }

  function fmtRelTime(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var now = new Date();
      var diff = now - d;
      if (diff < 60 * 1000) return 'gerade';
      if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' Min';
      if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' Std';
      if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + ' Tg';
      return d.toLocaleDateString('de-AT');
    } catch (e) { return ''; }
  }

  function bubbleHtml(text, ts, outgoing) {
    return (
      '<div class="adm-bubble ' + (outgoing ? 'adm-bubble--out' : 'adm-bubble--in') + '">' +
      esc(text) +
      '<span class="adm-bubble-time">' + esc(fmtTime(ts)) + '</span>' +
      '</div>'
    );
  }

  function openConversation(id) {
    var inq = inquiriesCache.find(function (x) { return x.id === id; });
    if (!inq) return;
    currentConvId = id;
    document.getElementById('admConvTitle').textContent = inq.name || inq.email || 'Anfrage';
    var subParts = [];
    if (inq.email) subParts.push('<a href="mailto:' + esc(inq.email) + '">' + esc(inq.email) + '</a>');
    if (inq.phone) subParts.push('<a href="tel:' + esc(inq.phone) + '">' + esc(inq.phone) + '</a>');
    document.getElementById('admConvSub').innerHTML = subParts.join(' · ');
    var meta = [inq.service, inq.vehicle, inq.datetime, inq.pickup && ('Von: ' + inq.pickup), inq.dropoff && ('Nach: ' + inq.dropoff)]
      .filter(Boolean).join(' · ');
    document.getElementById('admConvMeta').textContent = meta || 'Eingegangen ' + fmtTime(inq.receivedAt);

    var thread = document.getElementById('admConvThread');
    thread.innerHTML =
      bubbleHtml(inq.message || '', inq.receivedAt, false) +
      (Array.isArray(inq.replies) ? inq.replies : []).map(function (r) { return bubbleHtml(r.body, r.at, true); }).join('');

    var ta = document.getElementById('admConvBody');
    var msg = document.getElementById('admConvMsg');
    ta.value = '';
    msg.textContent = '';
    msg.className = 'adm-reply-msg';

    document.getElementById('admConv').removeAttribute('hidden');
    setTimeout(function () { thread.scrollTop = thread.scrollHeight; ta.focus(); }, 30);
  }

  function closeConversation() {
    document.getElementById('admConv').setAttribute('hidden', '');
    currentConvId = null;
  }

  async function sendCurrentReply() {
    if (!currentConvId) return;
    var ta = document.getElementById('admConvBody');
    var msg = document.getElementById('admConvMsg');
    var btn = document.getElementById('admConvSend');
    var body = (ta.value || '').trim();
    if (!body) { msg.textContent = 'Bitte einen Text schreiben.'; msg.className = 'adm-reply-msg is-err'; return; }
    btn.disabled = true; msg.textContent = 'Wird gesendet …'; msg.className = 'adm-reply-msg';
    try {
      var data = await api('POST', '/api/inquiries/' + currentConvId + '/reply', { body: body });
      if (!data) return;
      var inq = inquiriesCache.find(function (x) { return x.id === currentConvId; });
      if (inq) {
        inq.replies = Array.isArray(inq.replies) ? inq.replies : [];
        inq.replies.push(data.reply);
      }
      var thread = document.getElementById('admConvThread');
      thread.insertAdjacentHTML('beforeend', bubbleHtml(data.reply.body, data.reply.at, true));
      thread.scrollTop = thread.scrollHeight;
      ta.value = '';
      msg.textContent = 'Gesendet.'; msg.className = 'adm-reply-msg';
      toast('Antwort gesendet', true);
      renderConvList();
    } catch (err) {
      msg.textContent = err.message || 'Fehler beim Senden.';
      msg.className = 'adm-reply-msg is-err';
      toast('Fehler: ' + (err.message || 'unbekannt'), false);
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteCurrentConv() {
    if (!currentConvId) return;
    if (!confirm('Diese Anfrage wirklich löschen?')) return;
    try {
      await api('DELETE', '/api/inquiries/' + currentConvId);
      inquiriesCache = inquiriesCache.filter(function (x) { return x.id !== currentConvId; });
      closeConversation();
      renderConvList();
      toast('Anfrage gelöscht', true);
    } catch (err) {
      toast('Fehler: ' + (err.message || 'unbekannt'), false);
    }
  }

  function setupInquiries() {
    document.getElementById('admConvClose').addEventListener('click', closeConversation);
    document.getElementById('admConv').addEventListener('click', function (e) {
      if (e.target.id === 'admConv') closeConversation();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('admConv').hasAttribute('hidden')) closeConversation();
    });
    document.getElementById('admConvSend').addEventListener('click', sendCurrentReply);
    document.getElementById('admConvBody').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendCurrentReply(); }
    });
    document.getElementById('admConvDelete').addEventListener('click', deleteCurrentConv);
  }

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
