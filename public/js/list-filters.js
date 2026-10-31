// Standard list toolbar behaviour (shared by every list page).
//
// Markup (see public/html/partials/ui/README in page templates):
//   <form class="list-filter-form" method="get">
//     <input name="search"> + <button type="submit">   -> search only on button / Enter
//     <select class="js-filter" ...>                    -> submits the form on change
//   </form>
//
// <select class="js-filter"> options (data-* attributes):
//   data-placeholder="..."     placeholder text (already translated)
//   data-ajax-url="/x/api"     options loaded via Select2 AJAX ({id, text} or {id, name})
//   data-ids-url="/x/api/ids"  restores the selected AJAX values by id on page load
//   data-selected='[1,2]'      selected ids for AJAX selects (JSON)
//   data-none-option="true"    adds a "(Not set)" choice (value "__none__")
// Static selects render their <option selected> server-side.
(function () {
  'use strict';
  const tr = (s) => (typeof window.t === 'function' ? window.t(s) : s);
  const NONE = { id: '__none__', text: tr('(Not set)') };

  function toResults(data) {
    return (Array.isArray(data) ? data : []).map((x) => ({ id: x.id, text: x.text || x.name || String(x.id) }));
  }

  function initSelect($el) {
    const ajaxUrl = $el.data('ajaxUrl');
    const withNone = $el.data('noneOption') === true || $el.data('noneOption') === 'true';
    const opts = {
      theme: 'bootstrap-5',
      width: '100%',
      allowClear: true,
      placeholder: $el.data('placeholder') || '',
    };
    if (ajaxUrl) {
      opts.ajax = {
        url: ajaxUrl,
        dataType: 'json',
        delay: 250,
        data: (params) => ({ search: params.term }),
        processResults: (data, params) => ({
          results: (withNone && !params.term ? [NONE] : []).concat(toResults(data)),
        }),
      };
    } else if (!$el.prop('multiple')) {
      opts.minimumResultsForSearch = 10;
    }
    $el.select2(opts);
  }

  // Re-creates the selected <option>s of an AJAX select from their ids.
  async function restoreSelected($el) {
    let selected = $el.data('selected') || [];
    if (!Array.isArray(selected)) selected = [selected];
    selected = selected.map(String).filter(Boolean);
    if (!selected.length) return;
    if (selected.includes('__none__')) $el.append(new Option(NONE.text, NONE.id, true, true));
    const ids = selected.filter((v) => v !== '__none__');
    const idsUrl = $el.data('idsUrl');
    if (ids.length && idsUrl) {
      const query = ids.map((id) => 'ids=' + encodeURIComponent(id)).join('&');
      try {
        const res = await fetch(idsUrl + (idsUrl.includes('?') ? '&' : '?') + query, { credentials: 'same-origin' });
        const items = toResults(await res.json());
        items.forEach((item) => {
          if (!$el.find('option[value="' + String(item.id).replace(/"/g, '') + '"]').length) {
            $el.append(new Option(item.text, item.id, true, true));
          }
        });
      } catch (err) {
        console.error('Could not restore filter values', err);
      }
    }
    $el.val(selected).trigger('change.select2');
  }

  $(function () {
    $('.list-filter-form').each(async function () {
      const $form = $(this);
      const $selects = $form.find('select.js-filter');
      $selects.each((_, el) => initSelect($(el)));
      await Promise.all($selects.toArray().map((el) => restoreSelected($(el))));
      // Only now: auto-submit when a filter changes (not while restoring)
      $selects.on('change', () => {
        $form.find('input[name="page"]').remove();
        $form.trigger('submit');
      });
      $form.find('[data-clear-filters]').on('click', function (e) {
        e.preventDefault();
        $selects.off('change');
        $selects.val(null).trigger('change.select2');
        $form.trigger('submit');
      });
    });
  });
})();
