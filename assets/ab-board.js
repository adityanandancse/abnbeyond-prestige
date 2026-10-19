/* ============================================================================
   ab-board.js — personal "wedding board" saved to the browser (localStorage).
   No login, no network. Loaded (defer) on product, collection and board pages.

   Store shape, key "ab_board_v1":
     { "v":1, "items":[ { "id","handle","fn","who","added" } ] }

   Public API (window.AbBoard) is used by sections/my-board.liquid.
   Every storage access is wrapped in try/catch; if storage is unavailable the
   save buttons surface an inline note instead of opening the panel.
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'ab_board_v1';
  var EVENT = 'ab-board:change';
  var FN_ORDER = ['mehendi', 'haldi', 'sangeet', 'wedding', 'reception', 'other'];
  var MAX_WHO = 30;

  /* ---- labels (from the config script printed by ab-board-runtime) -------- */
  var LABELS = {};
  try {
    var cfgEl = document.getElementById('ab-board-config');
    if (cfgEl) { LABELS = (JSON.parse(cfgEl.textContent) || {}).functions || {}; }
  } catch (e) { LABELS = {}; }
  FN_ORDER.forEach(function (k) {
    if (!LABELS[k]) { LABELS[k] = k.charAt(0).toUpperCase() + k.slice(1); }
  });

  /* ---- storage availability --------------------------------------------- */
  var STORAGE_OK = (function () {
    try {
      var t = '__ab_board_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  function read() {
    if (!STORAGE_OK) { return { v: 1, items: [] }; }
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) { return { v: 1, items: [] }; }
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) { return { v: 1, items: [] }; }
      return { v: 1, items: data.items };
    } catch (e) { return { v: 1, items: [] }; }
  }

  function write(data) {
    if (!STORAGE_OK) { return false; }
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ v: 1, items: data.items }));
      return true;
    } catch (e) { return false; }
  }

  function uuid() {
    try { if (window.crypto && window.crypto.randomUUID) { return window.crypto.randomUUID(); } } catch (e) {}
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function cleanWho(who) {
    who = (who == null ? '' : String(who)).trim().slice(0, MAX_WHO);
    return who || 'Me';
  }

  function emit() {
    try { document.dispatchEvent(new CustomEvent(EVENT)); }
    catch (e) {
      var ev = document.createEvent('CustomEvent');
      ev.initCustomEvent(EVENT, false, false, null);
      document.dispatchEvent(ev);
    }
  }

  /* ---- public API ------------------------------------------------------- */
  var API = {
    STORAGE_OK: STORAGE_OK,
    FN_ORDER: FN_ORDER,
    labels: LABELS,
    labelFor: function (fn) { return LABELS[fn] || fn; },
    items: function () { return read().items; },
    itemsForHandle: function (handle) {
      return read().items.filter(function (it) { return it.handle === handle; });
    },
    isSaved: function (handle) {
      return read().items.some(function (it) { return it.handle === handle; });
    },
    count: function () { return read().items.length; },
    add: function (handle, fn, who) {
      who = cleanWho(who);
      if (FN_ORDER.indexOf(fn) < 0) { fn = 'other'; }
      var data = read();
      var dup = data.items.some(function (it) {
        return it.handle === handle && it.fn === fn && it.who.toLowerCase() === who.toLowerCase();
      });
      if (dup) { return false; }
      data.items.push({ id: uuid(), handle: handle, fn: fn, who: who, added: Date.now() });
      if (write(data)) { emit(); return true; }
      return false;
    },
    remove: function (id) {
      var data = read();
      var before = data.items.length;
      data.items = data.items.filter(function (it) { return it.id !== id; });
      if (data.items.length === before) { return false; }
      if (write(data)) { emit(); return true; }
      return false;
    },
    update: function (id, changes) {
      var data = read(), changed = false;
      data.items.forEach(function (it) {
        if (it.id !== id) { return; }
        if (changes.fn && FN_ORDER.indexOf(changes.fn) >= 0) { it.fn = changes.fn; changed = true; }
        if (typeof changes.who === 'string') { it.who = cleanWho(changes.who); changed = true; }
      });
      if (changed && write(data)) { emit(); return true; }
      return false;
    },
    recentNames: function () {
      var seen = {}, names = [];
      read().items.slice().sort(function (a, b) { return b.added - a.added; }).forEach(function (it) {
        var key = (it.who || '').toLowerCase();
        if (key && !seen[key]) { seen[key] = 1; names.push(it.who); }
      });
      return names.slice(0, 5);
    },
    on: function (cb) { document.addEventListener(EVENT, cb); }
  };
  window.AbBoard = API;

  /* ---- DOM wiring (run after parse; script is deferred) ----------------- */
  var live = null, panel = null, overlay = null, lastFocus = null,
      curHandle = '', curTitle = '';

  function announce(msg) { if (live) { live.textContent = ''; live.textContent = msg; } }

  function syncButtons() {
    var data = read();
    var btns = document.querySelectorAll('[data-ab-save]');
    Array.prototype.forEach.call(btns, function (btn) {
      var handle = btn.getAttribute('data-handle');
      var saved = data.items.some(function (it) { return it.handle === handle; });
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.classList.toggle('is-saved', saved);
      var labelEl = btn.querySelector('[data-ab-save-label]');
      if (labelEl) {
        labelEl.textContent = saved
          ? (btn.getAttribute('data-label-saved') || 'Saved')
          : (btn.getAttribute('data-label-default') || 'Save');
      }
      var glyph = btn.querySelector('[data-ab-save-glyph]');
      if (glyph) { glyph.innerHTML = saved ? '&#9829;' : '&#9825;'; }
    });
  }

  function syncCount() {
    var n = read().items.length;
    var els = document.querySelectorAll('[data-ab-board-count]');
    Array.prototype.forEach.call(els, function (el) {
      el.textContent = n;
      if (n > 0) { el.removeAttribute('hidden'); el.classList.add('is-visible'); }
      else { el.setAttribute('hidden', ''); el.classList.remove('is-visible'); }
    });
  }

  function showInlineNote(btn) {
    var note = btn.parentNode ? btn.parentNode.querySelector('[data-ab-note]') : null;
    if (!note) {
      note = document.createElement('span');
      note.className = 'AbSave__Note Text--subdued';
      note.setAttribute('data-ab-note', '');
      note.setAttribute('role', 'status');
      if (btn.nextSibling) { btn.parentNode.insertBefore(note, btn.nextSibling); }
      else if (btn.parentNode) { btn.parentNode.appendChild(note); }
    }
    note.textContent = "Saving isn't available in this browser";
  }

  /* ---- panel (dialog) --------------------------------------------------- */
  function focusables() {
    return Array.prototype.filter.call(
      panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null; }
    );
  }
  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key !== 'Tab') { return; }
    var f = focusables(); if (!f.length) { return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function buildPanel() {
    overlay = document.createElement('div');
    overlay.className = 'AbBoard__Overlay';
    overlay.hidden = true;

    panel = document.createElement('div');
    panel.className = 'AbBoard__Panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-labelledby', 'AbBoard__Title');

    var chips = FN_ORDER.map(function (fn, i) {
      return '<label class="AbBoard__Chip">' +
        '<input type="radio" name="ab-fn" value="' + fn + '"' + (fn === 'wedding' ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(LABELS[fn]) + '</span></label>';
    }).join('');

    panel.innerHTML =
      '<div class="AbBoard__Head">' +
        '<span class="AbBoard__Title Heading u-h5" id="AbBoard__Title">Save to board</span>' +
        '<button type="button" class="AbBoard__Close" data-ab-close aria-label="Close">&times;</button>' +
      '</div>' +
      '<p class="AbBoard__Product Text--subdued" data-ab-product></p>' +
      '<div class="AbBoard__Existing" data-ab-existing hidden></div>' +
      '<form class="AbBoard__Form" data-ab-form>' +
        '<fieldset class="AbBoard__Field">' +
          '<legend class="AbBoard__Legend">Function</legend>' +
          '<div class="AbBoard__Chips" role="radiogroup" aria-label="Function">' + chips + '</div>' +
        '</fieldset>' +
        '<div class="AbBoard__Field">' +
          '<label class="AbBoard__Legend" for="ab-who">For whom</label>' +
          '<input type="text" id="ab-who" class="AbBoard__Input" maxlength="' + MAX_WHO + '" value="Me" autocomplete="off">' +
          '<div class="AbBoard__Names" data-ab-names></div>' +
        '</div>' +
        '<div class="AbBoard__Actions">' +
          '<button type="button" class="Button Button--secondary" data-ab-cancel>Cancel</button>' +
          '<button type="submit" class="Button Button--primary" data-ab-save-submit>Save</button>' +
        '</div>' +
      '</form>';

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    overlay.addEventListener('click', closePanel);
    panel.querySelector('[data-ab-close]').addEventListener('click', closePanel);
    panel.querySelector('[data-ab-cancel]').addEventListener('click', closePanel);
    panel.querySelector('[data-ab-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var fn = (panel.querySelector('input[name="ab-fn"]:checked') || {}).value || 'wedding';
      var who = cleanWho(panel.querySelector('#ab-who').value);
      if (API.add(curHandle, fn, who)) {
        announce('Saved to ' + LABELS[fn] + ' for ' + who);
        renderExisting();
        panel.querySelector('#ab-who').value = 'Me';
        renderNameChips();
      } else {
        announce('Already saved to ' + LABELS[fn] + ' for ' + who);
      }
    });
  }

  function renderNameChips() {
    var wrap = panel.querySelector('[data-ab-names]');
    var names = API.recentNames();
    wrap.innerHTML = names.map(function (n) {
      return '<button type="button" class="AbBoard__NameChip" data-ab-name="' + escapeAttr(n) + '">' + escapeHtml(n) + '</button>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-ab-name]'), function (b) {
      b.addEventListener('click', function () { panel.querySelector('#ab-who').value = b.getAttribute('data-ab-name'); });
    });
  }

  function renderExisting() {
    var box = panel.querySelector('[data-ab-existing]');
    var entries = API.itemsForHandle(curHandle).slice().sort(function (a, b) { return a.added - b.added; });
    if (!entries.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<p class="AbBoard__Legend">Already on your board</p>' +
      '<ul class="AbBoard__EntryList">' + entries.map(function (it) {
        return '<li class="AbBoard__Entry">' +
          '<span>' + escapeHtml(LABELS[it.fn] || it.fn) + ' &middot; ' + escapeHtml(it.who) + '</span>' +
          '<button type="button" class="AbBoard__Remove Link Link--underline" data-ab-remove="' + escapeAttr(it.id) + '">Remove</button>' +
        '</li>';
      }).join('') + '</ul>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-ab-remove]'), function (b) {
      b.addEventListener('click', function () {
        if (API.remove(b.getAttribute('data-ab-remove'))) { announce('Removed'); renderExisting(); renderNameChips(); }
      });
    });
  }

  function openPanel(handle, title) {
    if (!panel) { buildPanel(); }
    curHandle = handle; curTitle = title || '';
    panel.querySelector('[data-ab-product]').textContent = curTitle;
    var checked = panel.querySelector('input[name="ab-fn"][value="wedding"]');
    if (checked) { checked.checked = true; }
    panel.querySelector('#ab-who').value = 'Me';
    renderExisting();
    renderNameChips();

    lastFocus = document.activeElement;
    overlay.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(function () {
      overlay.classList.add('is-visible');
      panel.classList.add('is-visible');
      var f = focusables(); if (f.length) { f[0].focus(); }
    });
    document.addEventListener('keydown', onKeydown, true);
  }

  function closePanel() {
    if (!panel) { return; }
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-visible');
    overlay.classList.remove('is-visible');
    overlay.hidden = true;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeydown, true);
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---- delegated save-button clicks ------------------------------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-ab-save]') : null;
    if (!btn) { return; }
    e.preventDefault();
    if (!STORAGE_OK) { showInlineNote(btn); return; }
    openPanel(btn.getAttribute('data-handle'), btn.getAttribute('data-title'));
  });

  /* ---- live region + initial sync + cross-tab --------------------------- */
  live = document.createElement('div');
  live.className = 'u-visually-hidden';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('role', 'status');
  document.body.appendChild(live);

  document.addEventListener(EVENT, function () { syncButtons(); syncCount(); });
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { syncButtons(); syncCount(); emit(); }
  });

  syncButtons();
  syncCount();
})();
