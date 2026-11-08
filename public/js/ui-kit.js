// Small page-wide behaviours shared by every page.
//   <form data-confirm="Delete system X?">   asks before submitting (text already translated)
//   <form data-delete-ip="server-01">        asks what to do with the record's IPs
//                                            (partials/ui/delete_ip_modal.ejs, fills input[name=delete_ip])
//   <form data-delete-system="CRM" data-component-count="3">
//                                            asks whether to delete the system's components too
//                                            (partials/ui/delete_system_modal.ejs, fills input[name=delete_components])
//   <a data-export-link> in a list filter form   exports with the search / filters on screen,
//                                            even when they were not submitted yet
//   [data-bs-toggle="tooltip"]               Bootstrap tooltips
(function () {
  'use strict';
  let pendingIpForm = null;
  let pendingSystemForm = null;

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
    const systemModal = document.getElementById('deleteSystemModal');
    if (form.matches('form[data-delete-system]') && systemModal && !form.dataset.systemChoiceDone) {
      e.preventDefault();
      pendingSystemForm = form;
      systemModal.querySelector('[data-delete-system-name]').textContent = form.dataset.deleteSystem;
      systemModal.querySelector('[data-delete-system-count]').textContent = form.dataset.componentCount;
      systemModal.querySelector('#deleteSystemComponents').checked = false;
      bootstrap.Modal.getOrCreateInstance(systemModal).show();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-delete-system-confirm]') || !pendingSystemForm) return;
    const modal = document.getElementById('deleteSystemModal');
    pendingSystemForm.querySelector('input[name="delete_components"]').value = String(modal.querySelector('#deleteSystemComponents').checked);
    pendingSystemForm.dataset.systemChoiceDone = '1';
    bootstrap.Modal.getInstance(modal).hide();
    pendingSystemForm.submit();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-delete-ip-confirm]') || !pendingIpForm) return;
    const modal = document.getElementById('deleteIpModal');
    pendingIpForm.querySelector('input[name="delete_ip"]').value = modal.querySelector('input[name="deleteIpChoice"]:checked').value;
    pendingIpForm.dataset.ipChoiceDone = '1';
    bootstrap.Modal.getInstance(modal).hide();
    pendingIpForm.submit();
  });

  // Export link: its own query, with every field of the filter form replacing
  // the value it had when the page was rendered (blank fields are dropped)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-export-link]');
    const form = link && link.closest('form');
    if (!form || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const url = new URL(link.href, window.location.origin);
    const data = new FormData(form);
    for (const key of new Set(data.keys())) url.searchParams.delete(key);
    for (const [key, value] of data.entries()) if (String(value).trim() !== '') url.searchParams.append(key, value);
    url.searchParams.delete('page');
    window.location.href = url.pathname + url.search;
  });

  function initTooltips(root) {
    (root || document).querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getOrCreateInstance(el));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initTooltips());
  else initTooltips();
  window.UIKit = { initTooltips };
})();
