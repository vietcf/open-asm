// Small page-wide behaviours shared by every page.
//   <form data-confirm="Delete system X?">   asks before submitting (text already translated)
//   [data-bs-toggle="tooltip"]               Bootstrap tooltips
(function () {
  'use strict';
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-confirm]');
    if (form && !window.confirm(form.dataset.confirm)) e.preventDefault();
  });
  function initTooltips(root) {
    (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initTooltips());
  else initTooltips();
  window.UIKit = { initTooltips };
})();
