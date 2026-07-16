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
