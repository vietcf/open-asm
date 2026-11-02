// Excel import dialogs: partials/ui/import_modal.ejs (<div data-import="<baseUrl>">).
// Validate posts the file to <base>/validate-import; when every row passes,
// Import posts it to <base>/import and the page reloads when the dialog closes.
(function () {
  'use strict';
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const tr = (s) => esc(window.t ? window.t(s) : s);

  async function post(url, file) {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data.error || data.message || res.statusText);
    return data;
  }

  function setup(modal) {
    const base = modal.dataset.import;
    const fileInput = modal.querySelector('[data-import-file]');
    const result = modal.querySelector('[data-import-result]');
    const validateBtn = modal.querySelector('[data-import-validate]');
    const runBtn = modal.querySelector('[data-import-run]');
    const show = (kind, html) => { result.className = 'alert mt-3 mb-0 alert-' + kind; result.innerHTML = html; };
    const link = (url, label) => (url ? '<br><a href="' + esc(url) + '" target="_blank" rel="noopener">' + tr(label) + '</a>' : '');
    const counts = (pairs) => '<small>' + pairs.map(([label, n]) => tr(label) + ': ' + Number(n || 0)).join(', ') + '</small>';

    fileInput.addEventListener('change', () => {
      validateBtn.disabled = !fileInput.files.length;
      runBtn.classList.add('d-none');
      result.classList.add('d-none');
    });

    validateBtn.addEventListener('click', async () => {
      validateBtn.disabled = true;
      show('secondary', tr('Validating file...'));
      try {
        const data = await post(base + '/validate-import', fileInput.files[0]);
        const s = data.summary || {};
        show(s.allPassed ? 'success' : 'danger',
          '<strong>' + tr(s.allPassed ? 'Validation Complete!' : 'Validation Failed!') + '</strong><br>' +
          counts([['Total', s.totalRows], ['Passed', s.passedRows], ['Failed', s.failedRows]]) +
          link(data.validation_file, 'Download validation results'));
        runBtn.classList.toggle('d-none', !s.allPassed);
      } catch (err) {
        show('danger', '<strong>' + tr('Validation Error!') + '</strong><br>' + esc(err.message));
      } finally {
        validateBtn.disabled = false;
      }
    });

    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      show('secondary', tr('Importing...'));
      try {
        const data = await post(base + '/import', fileInput.files[0]);
        const s = data.summary || {};
        show(s.failedRows ? 'warning' : 'success',
          '<strong>' + tr(s.failedRows ? 'Import Completed with Errors!' : 'Import Completed!') + '</strong><br>' +
          counts([['Total', s.totalRows], ['Success', s.successRows], ['Skipped', s.skippedRows], ['Failed', s.failedRows]]) +
          link(data.import_file, 'Download import results'));
        runBtn.classList.add('d-none');
        modal.addEventListener('hidden.bs.modal', () => window.location.reload(), { once: true });
      } catch (err) {
        show('danger', '<strong>' + tr('Import Error!') + '</strong><br>' + esc(err.message));
      } finally {
        runBtn.disabled = false;
      }
    });

    modal.addEventListener('hidden.bs.modal', () => {
      fileInput.value = '';
      validateBtn.disabled = true;
      runBtn.classList.add('d-none');
      result.classList.add('d-none');
    });
  }

  function init() { document.querySelectorAll('[data-import]').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
