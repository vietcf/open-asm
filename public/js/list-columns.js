// Column chooser for list tables (partials/ui/columns_menu.ejs).
//
// Markup (rendered by the partial):
//   <div class="dropdown" data-columns-menu data-table="systemTable" data-storage-key="...">
//     <input type="checkbox" data-col="code" data-default="1" [data-fixed="1"]>   one per column
//     <button data-columns-reset>
//   </div>
//   <style data-columns-style="systemTable">…default-hidden columns…</style>
//   <table id="systemTable"> … <th|td data-col="code"> …
//
// The visible column keys are kept per browser in localStorage (best
// effort; the defaults apply when storage is empty or blocked). Hidden
// columns use display:none !important so they also win over the layout's
// mobile table CSS.
(function () {
  'use strict';

  function init(menu) {
    const tableId = menu.dataset.table;
    const key = menu.dataset.storageKey || ('openasm.columns.' + tableId);
    const style = document.querySelector('style[data-columns-style="' + tableId + '"]');
    const boxes = Array.from(menu.querySelectorAll('input[data-col]'));
    const columns = boxes.map((b) => ({ key: b.dataset.col, def: b.dataset.default === '1', fixed: b.dataset.fixed === '1' }));
    const defaults = columns.filter((c) => c.def || c.fixed).map((c) => c.key);

    function load() {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if (Array.isArray(saved)) return saved;
      } catch (e) { /* storage unavailable */ }
      return defaults;
    }
    function apply(visible) {
      const hidden = columns.filter((c) => !c.fixed && visible.indexOf(c.key) === -1);
      if (style) {
        style.textContent = hidden.length
          ? hidden.map((c) => '#' + tableId + ' [data-col="' + c.key + '"]').join(', ') + ' { display: none !important; }'
          : '';
      }
      boxes.forEach((b) => { b.checked = b.disabled || visible.indexOf(b.dataset.col) !== -1; });
    }

    let visible = load();
    apply(visible);
    menu.addEventListener('change', (e) => {
      if (!e.target.matches('input[data-col]')) return;
      visible = boxes.filter((b) => b.checked || b.disabled).map((b) => b.dataset.col);
      try { localStorage.setItem(key, JSON.stringify(visible)); } catch (err) { /* ignore */ }
      apply(visible);
    });
    const reset = menu.querySelector('[data-columns-reset]');
    if (reset) {
      reset.addEventListener('click', () => {
        visible = defaults.slice();
        try { localStorage.removeItem(key); } catch (err) { /* ignore */ }
        apply(visible);
      });
    }
  }

  function initAll() {
    document.querySelectorAll('[data-columns-menu]').forEach(init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
