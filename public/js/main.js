(function () {
  'use strict';

  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      mainNav.classList.toggle('open');
    });
  }

  // Confirm before any destructive/administrative status change.
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('submit', function (e) {
      var message = el.getAttribute('data-confirm') || 'هل أنت متأكد؟';
      if (!window.confirm(message)) {
        e.preventDefault();
      }
    });
  });

  // Print button on certificate page.
  document.querySelectorAll('[data-print]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      window.print();
    });
  });

  // Light UX helper: auto-uppercase and normalize the verify-license input,
  // matching the 077.XXXXXX.MTAG format as the user types (non-blocking).
  var verifyInput = document.getElementById('verifyNumberInput');
  if (verifyInput) {
    verifyInput.addEventListener('input', function () {
      verifyInput.value = verifyInput.value.toUpperCase();
    });
  }
})();
