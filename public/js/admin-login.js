(function () {
  'use strict';
  var csrfToken = '';
  var form = document.getElementById('loginForm');
  var btn = document.getElementById('loginBtn');
  var errEl = document.getElementById('loginError');

  fetch('/api/csrf')
    .then(function (r) { return r.json(); })
    .then(function (d) { csrfToken = d.csrfToken || ''; })
    .catch(function () {});

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '…';
    var body = {
      username: form.username.value.trim(),
      password: form.password.value,
    };
    fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, data: d }; });
      })
      .then(function (result) {
        if (result.ok) {
          window.location.href = '/admin';
        } else {
          errEl.textContent = result.data.error || 'Anmeldung fehlgeschlagen.';
          btn.disabled = false;
          btn.textContent = 'Anmelden';
          fetch('/api/csrf')
            .then(function (r) { return r.json(); })
            .then(function (d) { csrfToken = d.csrfToken || ''; })
            .catch(function () {});
        }
      })
      .catch(function () {
        errEl.textContent = 'Verbindungsfehler. Bitte erneut versuchen.';
        btn.disabled = false;
        btn.textContent = 'Anmelden';
      });
  });
}());
