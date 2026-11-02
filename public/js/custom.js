// Small page-wide behaviours (loaded on every page of the main layout).
document.addEventListener('DOMContentLoaded', function() {
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
});

// Flash alerts rendered by partials/ui/flash.ejs hide themselves after N ms.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.alert[data-autohide]').forEach(function (el) {
    setTimeout(function () {
      if (window.bootstrap && bootstrap.Alert) bootstrap.Alert.getOrCreateInstance(el).close();
      else el.remove();
    }, Number(el.dataset.autohide) || 5000);
  });
});
