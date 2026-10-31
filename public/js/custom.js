// Custom JS for dynamic form fields, modals, etc.
document.addEventListener('DOMContentLoaded', function() {
  // Add/Remove IP fields in Add Server modal
  const ipInputGroup = document.getElementById('ipInputGroup');
  if (ipInputGroup) {
    ipInputGroup.addEventListener('click', function(e) {
      if (e.target.closest('.add-ip-btn')) {
        const newInput = document.createElement('div');
        newInput.className = 'input-group input-group-sm mb-1';
        newInput.innerHTML = `
          <input type="text" class="form-control" name="ip[]" placeholder="IP Address">
          <button type="button" class="btn btn-outline-danger btn-sm remove-ip-btn" title="Remove"><i class="bi bi-dash"></i></button>
        `;
        ipInputGroup.appendChild(newInput);
      } else if (e.target.closest('.remove-ip-btn')) {
        const group = e.target.closest('.input-group');
        if (group) group.remove();
      }
    });
  }

  // Add/Remove System fields in Add Server modal
  const systemInputGroup = document.getElementById('systemInputGroup');
  if (systemInputGroup) {
    systemInputGroup.addEventListener('click', function(e) {
      if (e.target.closest('.add-system-btn')) {
        const newInput = document.createElement('div');
        newInput.className = 'input-group input-group-sm mb-1';
        newInput.innerHTML = `
          <input type="text" class="form-control" name="system[]" placeholder="System Name or ID">
          <button type="button" class="btn btn-outline-danger btn-sm remove-system-btn" title="Remove"><i class="bi bi-dash"></i></button>
        `;
        systemInputGroup.appendChild(newInput);
      } else if (e.target.closest('.remove-system-btn')) {
        const group = e.target.closest('.input-group');
        if (group) group.remove();
      }
    });
  }

  // Listen for events on search boxes by name
  const searchInputs = document.querySelectorAll('input[name="search"]');
  if (searchInputs.length) {
    searchInputs.forEach(input => {
      const clearHandler = () => {
        if (input.value.trim() === '') {
          // Redirect to current path without query params
          window.location.href = window.location.pathname;
        }
      };
      input.addEventListener('input', clearHandler);
      input.addEventListener('search', clearHandler);
    });
  }

  // (Add more custom JS for other dynamic modals/forms if needed)
});

// Generic client-side column sort for list tables. Any <th data-sort-type="...">
// gets an asc/desc toggle that reorders the current page's <tbody> rows only —
// no backend call, so it resets on the next page/filter/reload.
document.addEventListener('DOMContentLoaded', function() {
  function ipToLong(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return -1;
    return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
  }

  document.querySelectorAll('table').forEach(function(table) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;
    const sortableThs = thead.querySelectorAll('th[data-sort-type]');
    if (!sortableThs.length) return;

    sortableThs.forEach(function(th) {
      th.classList.add('sortable-th');
      const icon = document.createElement('i');
      icon.className = 'bi bi-arrow-down-up ms-1 text-muted sort-icon';
      th.appendChild(icon);

      th.addEventListener('click', function() {
        const colIndex = Array.prototype.indexOf.call(th.parentElement.children, th);
        const newDir = th.getAttribute('data-sort-dir') === 'asc' ? 'desc' : 'asc';

        sortableThs.forEach(function(other) {
          other.removeAttribute('data-sort-dir');
          other.querySelector('.sort-icon').className = 'bi bi-arrow-down-up ms-1 text-muted sort-icon';
        });
        th.setAttribute('data-sort-dir', newDir);
        icon.className = 'bi ' + (newDir === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down') + ' ms-1 sort-icon';

        const type = th.getAttribute('data-sort-type');
        const rows = Array.prototype.slice.call(tbody.children)
          .filter(function(r) { return r.tagName === 'TR' && r.children.length > 1; });

        // A cell can override its sort key via data-sort-value (e.g. a raw
        // timestamp behind a localized date, since the displayed text isn't
        // reliably parseable/orderable on its own).
        function cellValue(row) {
          const cell = row.children[colIndex];
          if (!cell) return '';
          return (cell.dataset && cell.dataset.sortValue !== undefined ? cell.dataset.sortValue : cell.textContent).trim();
        }

        rows.sort(function(a, b) {
          const aVal = cellValue(a);
          const bVal = cellValue(b);
          let cmp;
          if (type === 'ip') {
            cmp = ipToLong(aVal) - ipToLong(bVal);
          } else if (type === 'date') {
            cmp = new Date(aVal).getTime() - new Date(bVal).getTime();
          } else {
            cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base', numeric: true });
          }
          return newDir === 'asc' ? cmp : -cmp;
        });

        rows.forEach(function(row) { tbody.appendChild(row); });
      });
    });
  });
});

// Extracts a human-readable error message from an AJAX error response.
// Import/validate endpoints set xhr.responseType = 'blob' (to receive an
// Excel file on success), so on failure the JSON error body arrives as a
// Blob too - jQuery can't parse it into responseJSON/responseText, which
// used to surface as the literal string "[object Blob]". Always resolves
// (never rejects) so callers can safely chain .then().
window.extractImportErrorMessage = function(xhr, fallback) {
  fallback = fallback || 'Import failed: the file format is invalid. Please download the template and try again.';
  const parseText = function(text) {
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return parsed.error || parsed.message || text;
    } catch (e) {
      return text;
    }
  };
  const response = xhr.response;
  if (typeof Blob !== 'undefined' && response instanceof Blob) {
    return response.text().then(parseText).catch(function() { return fallback; });
  }
  if (xhr.responseJSON && xhr.responseJSON.error) {
    return Promise.resolve(xhr.responseJSON.error);
  }
  if (typeof xhr.responseText === 'string' && xhr.responseText) {
    return Promise.resolve(parseText(xhr.responseText));
  }
  return Promise.resolve(fallback);
};

// Flash alerts rendered by partials/ui/flash.ejs hide themselves after N ms.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.alert[data-autohide]').forEach(function (el) {
    setTimeout(function () {
      if (window.bootstrap && bootstrap.Alert) bootstrap.Alert.getOrCreateInstance(el).close();
      else el.remove();
    }, Number(el.dataset.autohide) || 5000);
  });
});
