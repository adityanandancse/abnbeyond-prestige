/* AB & Beyond — filter popover for the collection page.
   The theme instantiates its Popover class only for #collection-sort-popover
   (by id, in the collection section JS). This is a standalone, dependency-free
   reproduction of that behaviour for #collection-filter-popover.
   Deviations from the theme Popover (intentional): no focus trap; scroll lock
   is applied on pocket (< 1008px) only, mirroring the bottom-sheet behaviour. */
(function () {
  'use strict';

  var POPOVER_ID = 'collection-filter-popover';
  var SORT_ID    = 'collection-sort-popover';
  var OFFSET     = 20;                       // matches _position()'s `o`
  var LAP_AND_UP = '(min-width: 1008px)';    // theme $lap-and-up

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function init() {
    var popover = document.getElementById(POPOVER_ID);
    if (!popover) { return; }

    var activator = document.querySelector('[aria-controls="' + POPOVER_ID + '"]');
    if (!activator) { return; }

    var overlay       = document.querySelector('.PageOverlay');
    var sortPopover   = document.getElementById(SORT_ID);
    var sortActivator = document.querySelector('[aria-controls="' + SORT_ID + '"]');
    var isOpen = false;

    function lapAndUp() { return window.matchMedia(LAP_AND_UP).matches; }

    function position() {               // desktop: always anchor below the activator (bottom branch)
      var r = activator.getBoundingClientRect();
      var top = r.bottom + OFFSET;

      popover.classList.remove('Popover--positionBottom', 'Popover--positionTop', 'Popover--positionCenter',
                               'Popover--alignTop', 'Popover--alignCenter', 'Popover--alignBottom');
      popover.classList.add('Popover--positionBottom');
      popover.classList.add('Popover--alignRight');
      popover.setAttribute('style', 'top: ' + parseInt(top, 10) + 'px;');  // horizontal placement is CSS (ab-design.css)
    }

    function onClickOutside(e) {         // mirrors _clickOutside()
      if (e.target.closest('.Popover') || e.target.closest('.Modal') ||
          e.target === activator || activator.contains(e.target)) { return; }
      close();
    }

    function onKeydown(e) {              // Escape (bound to document for reliability)
      if (isOpen && (e.key === 'Escape' || e.keyCode === 27)) { close(); }
    }

    function open() {
      if (isOpen) { return; }
      // Hand off from the sort popover if it's open (theme closes it via click-outside
      // on lap-and-up, but not under the overlay on smaller screens).
      if (sortActivator && sortActivator.getAttribute('aria-expanded') === 'true') {
        sortActivator.click();
      }
      popover.setAttribute('aria-hidden', 'false');
      activator.setAttribute('aria-expanded', 'true');
      if (lapAndUp()) {
        document.body.addEventListener('click', onClickOutside);
        position();
      } else {
        // Pocket: bottom sheet. Lock page scroll and dim with the shared overlay.
        document.documentElement.classList.add('no-scroll');
        popover.removeAttribute('style');
        if (overlay) { overlay.classList.add('is-visible'); overlay.addEventListener('click', close); }
      }
      isOpen = true;
    }

    function close() {
      if (!isOpen) { return; }
      popover.setAttribute('aria-hidden', 'true');
      activator.setAttribute('aria-expanded', 'false');
      if (lapAndUp()) {
        document.body.removeEventListener('click', onClickOutside);
      } else {
        document.documentElement.classList.remove('no-scroll');
        if (overlay) {
          // Don't yank the shared overlay out from under a sort popover mid-handoff.
          var sortOpen = sortPopover && sortPopover.getAttribute('aria-hidden') === 'false';
          if (!sortOpen) { overlay.classList.remove('is-visible'); }
          overlay.removeEventListener('click', close);
        }
      }
      isOpen = false;
    }

    function toggle(e) { if (e) { e.preventDefault(); } if (isOpen) { close(); } else { open(); } }

    activator.addEventListener('click', toggle);

    var closers = popover.querySelectorAll('[data-action="close-popover"]');
    for (var i = 0; i < closers.length; i++) { closers[i].addEventListener('click', close); }

    document.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', function () { if (isOpen && lapAndUp()) { position(); } });

    // Close our popover when the sort popover is opened.
    if (sortActivator) { sortActivator.addEventListener('click', function () { if (isOpen) { close(); } }); }
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
  else { init(); }
})();
