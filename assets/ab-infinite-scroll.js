/* AB & Beyond — collection infinite scroll.
   Server-rendered pagination stays in the DOM (SEO / no-JS); JS hides it and
   loads the next page as the shopper nears the end of the grid. Plain ES5, no
   deps. Re-initialises after the theme's AJAX sort, which replaces
   .CollectionInner__Products innerHTML. */
(function () {
  'use strict';

  if (!('IntersectionObserver' in window) ||
      typeof window.fetch !== 'function' ||
      typeof window.DOMParser !== 'function') { return; }   // keep real pagination for old browsers

  var PRODUCTS_SEL   = '.CollectionInner__Products';
  var WRAPPER_SEL    = '.ProductListWrapper';
  var GRID_SEL       = '.ProductList';
  var CELL_SEL       = '.Grid__Cell';
  var PAGINATION_SEL = '.Pagination';
  var NEXT_SEL       = '.Pagination__NavItem[rel="next"]';
  var BOTTOM_MARGIN  = '600px';   // fire ~600px before the end

  var productsEl = document.querySelector(PRODUCTS_SEL);
  if (!productsEl) { return; }

  var grid, loader, sentinel, observer, nextUrl, loading;

  function withAjax(url) {                      // insert view=ajax into the query, before any #hash
    var a = document.createElement('a');
    a.href = url;
    var q = a.search.replace(/&$/, '');          // pagination's `remove: 'view=ajax'` can leave a trailing &
    a.search = (q ? q + '&' : '?') + 'view=ajax';
    return a.href;
  }

  function removeHelpers() {
    if (observer) { observer.disconnect(); observer = null; }
    if (sentinel && sentinel.parentNode) { sentinel.parentNode.removeChild(sentinel); }
    if (loader && loader.parentNode) { loader.parentNode.removeChild(loader); }
    sentinel = loader = null;
  }

  function init() {
    removeHelpers();
    loading = false;

    grid = productsEl.querySelector(GRID_SEL);
    var wrapper = productsEl.querySelector(WRAPPER_SEL);
    var pagination = productsEl.querySelector(PAGINATION_SEL);
    if (!grid || !wrapper) { return; }           // empty state / no products

    var next = pagination ? pagination.querySelector(NEXT_SEL) : null;
    nextUrl = next ? next.getAttribute('href') : null;

    if (pagination) { pagination.classList.add('ab-is-pagination-hidden'); }  // keep in DOM, hide visually
    if (!nextUrl) { return; }                    // single page

    loader = document.createElement('div');
    loader.className = 'ab-is-loader';
    loader.setAttribute('aria-hidden', 'true');
    loader.textContent = 'Loading…';
    wrapper.appendChild(loader);                 // descendant of .CollectionInner__Products

    sentinel = document.createElement('div');
    sentinel.className = 'ab-is-sentinel';
    wrapper.appendChild(sentinel);

    observer = new IntersectionObserver(onIntersect, { rootMargin: '0px 0px ' + BOTTOM_MARGIN + ' 0px' });
    observer.observe(sentinel);
  }

  function onIntersect(entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) { loadNext(); break; }
    }
  }

  function loadNext() {
    if (loading || !nextUrl) { return; }         // double-fetch guard
    loading = true;
    loader.classList.add('is-visible');

    fetch(withAjax(nextUrl), { credentials: 'same-origin', method: 'GET' })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newGrid = doc.querySelector(GRID_SEL);
        if (newGrid) {
          var cells = newGrid.querySelectorAll(CELL_SEL);
          for (var i = 0; i < cells.length; i++) {
            var cell = document.importNode(cells[i], true);
            cell.style.setProperty('--ab-i', i);   // stagger index within this batch
            cell.classList.add('ab-in');           // reveal immediately (CSS fade)
            grid.appendChild(cell);
          }
        }
        var next = doc.querySelector(NEXT_SEL);
        nextUrl = next ? next.getAttribute('href') : null;

        afterAppend();
        loading = false;
        loader.classList.remove('is-visible');
        if (!nextUrl) { removeHelpers(); }        // reached the last page; pagination stays hidden
      })
      ['catch'](function () {
        loading = false;
        loader.classList.remove('is-visible');    // leave observer in place to retry on next scroll
      });
  }

  function afterAppend() {
    // lazysizes auto-detects new .Image--lazyLoad nodes; swatches/hover are delegated/CSS.
    // Currency: theme converter doesn't watch the DOM — nudge the selector only if a
    // non-base currency is active, so appended prices match.
    if (!(window.theme && window.theme.currencyConversionEnabled)) { return; }
    var sel = document.querySelector('.CurrencySelector__Select');
    if (!sel) { return; }

    var active;
    if (window.Currency && window.Currency.currentCurrency && window.Currency.shopCurrency) {
      active = window.Currency.currentCurrency !== window.Currency.shopCurrency;
    } else {
      active = sel.options.length && sel.value !== sel.options[0].value;
    }
    if (active) { sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }

  // Re-init after the theme's AJAX sort replaces .CollectionInner__Products innerHTML.
  new MutationObserver(function () { init(); }).observe(productsEl, { childList: true }); // direct children only

  init();
})();
