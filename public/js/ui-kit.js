// Small page-wide behaviours shared by every page.
//   <form data-confirm="Delete system X?">   asks before submitting (text already translated)
//   <form data-delete-ip="server-01">        asks what to do with the record's IPs
//                                            (partials/ui/delete_ip_modal.ejs, fills input[name=delete_ip])
//   [data-bs-toggle="tooltip"]               Bootstrap tooltips
(function () {
  'use strict';
  let pendingIpForm = null;

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.matches('form[data-confirm]') && !window.confirm(form.dataset.confirm)) {
      e.preventDefault();
      return;
    }
    const modal = document.getElementById('deleteIpModal');
    if (form.matches('form[data-delete-ip]') && modal && !form.dataset.ipChoiceDone) {
      e.preventDefault();
      pendingIpForm = form;
      modal.querySelector('[data-delete-ip-name]').textContent = form.dataset.deleteIp;
      modal.querySelector('#deleteIpReserve').checked = true;
      bootstrap.Modal.getOrCreateInstance(modal).show();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-delete-ip-confirm]') || !pendingIpForm) return;
    const modal = document.getElementById('deleteIpModal');
    pendingIpForm.querySelector('input[name="delete_ip"]').value = modal.querySelector('input[name="deleteIpChoice"]:checked').value;
    pendingIpForm.dataset.ipChoiceDone = '1';
    bootstrap.Modal.getInstance(modal).hide();
    pendingIpForm.submit();
  });

  function initTooltips(root) {
    (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initTooltips());
  else initTooltips();
  window.UIKit = { initTooltips };
})();
