// Behaviour for Add/Edit forms (.form-card), shared by every module.
//
// <select class="js-select">            Select2, Bootstrap 5 theme
//   data-placeholder="..."              (already translated)
//   data-ajax-url="/x/api/..."          options from an endpoint ({id, text|name})
//   data-selected='[{"id":1,"text":"a"}]'  current values of an AJAX select
//   data-tags="true"                    new values can be typed (free text)
//                                       (extra fields of AJAX results reach the select2:select event)
//   data-ajax-with='{"k":"#field"}'     sends #field's value as ?k= with each AJAX search
//
// <div data-repeater>                   rows added from <template data-repeater-template>
//   [data-repeater-rows]                where rows go; [data-repeater-add] adds one,
//   [data-repeater-remove] (in a row)   removes its row; window.FormKit.addRow(box, fill)
//                                       adds one from script (fill(rowElement) sets values)
//
// <div data-attachments ...>            partials/ui/file_attachments.ejs
//   existing files + uploads through /api/upload, kept in hidden inputs
(function () {
  'use strict';
  const tr = (s) => (typeof window.t === 'function' ? window.t(s) : s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function initSelect(el) {
    const $el = $(el);
    if ($el.data('select2')) return;
    const ajaxUrl = $el.data('ajaxUrl');
    const opts = {
      theme: 'bootstrap-5', width: '100%', allowClear: true,
      placeholder: $el.data('placeholder') || '',
      dropdownParent: $el.closest('.modal').length ? $el.closest('.modal') : undefined,
    };
    if (ajaxUrl) {
      opts.ajax = {
        url: ajaxUrl, dataType: 'json', delay: 250,
        // data-ajax-with='{"subnet":"#f-address"}': also sends other fields' current values
        data: (params) => Object.assign({ search: params.term },
          ...Object.entries($el.data('ajaxWith') || {}).map(([k, sel]) => ({ [k]: $(sel).val() }))),
        processResults: (data) => ({ results: (Array.isArray(data) ? data : (data.results || [])).map((x) => ({ ...x, id: x.id, text: x.text || x.name || String(x.id) })) }),
        cache: true,
      };
      (($el.data('selected')) || []).forEach((o) => $el.append(new Option(o.text, o.id, true, true)));
    } else if (!$el.prop('multiple')) {
      opts.minimumResultsForSearch = 10;
    }
    if ($el.data('tags')) {
      opts.tags = true;
      opts.createTag = (params) => {
        const term = $.trim(params.term);
        return term ? { id: term, text: term, newTag: true } : null;
      };
    }
    $el.select2(opts);
  }

  function initAttachments(box) {
    const list = box.querySelector('[data-attachments-list]');
    const input = box.querySelector('input[type=file]');
    const uploadedInput = box.querySelector('[data-attachments-uploaded]');
    const deletedInput = box.querySelector('[data-attachments-deleted]');
    const viewUrl = box.dataset.viewUrl || '';
    let existing = JSON.parse(box.dataset.existing || '[]');
    const uploaded = [];
    const deleted = [];
    const nameOf = (f) => f.originalname || f.name || '';

    function render() {
      const items = existing.map((f) => '<li><i class="bi bi-paperclip text-secondary"></i>' +
        '<a href="' + esc(f.url) + '" download class="text-truncate">' + esc(nameOf(f)) + '</a>' +
        (viewUrl && f.id ? '<a href="' + esc(viewUrl.replace(':id', encodeURIComponent(f.id))) + '" target="_blank" rel="noopener noreferrer" class="badge tag text-decoration-none">' + esc(tr('View')) + '</a>' : '') +
        (deletedInput ? '<button type="button" class="btn btn-sm btn-link text-danger ms-auto" data-remove="existing" data-id="' + esc(f.id) + '" title="' + esc(tr('Delete')) + '"><i class="bi bi-trash"></i></button>' : '') + '</li>')
        .concat(uploaded.map((f, i) => '<li><i class="bi bi-paperclip text-secondary"></i>' +
          '<a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer" class="text-truncate">' + esc(nameOf(f)) + '</a>' +
          '<span class="badge bg-success">' + esc(tr('New')) + '</span>' +
          '<button type="button" class="btn btn-sm btn-link text-danger ms-auto" data-remove="uploaded" data-index="' + i + '" title="' + esc(tr('Remove')) + '"><i class="bi bi-x-lg"></i></button></li>'));
      list.innerHTML = items.length ? items.join('') : '<li class="text-secondary small">' + esc(tr('No files attached')) + '</li>';
      uploadedInput.value = JSON.stringify(uploaded);
      if (deletedInput) deletedInput.value = JSON.stringify(deleted);
    }

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      if (btn.dataset.remove === 'existing') {
        existing = existing.filter((f) => String(f.id) !== String(btn.dataset.id));
        deleted.push(btn.dataset.id);
      } else {
        uploaded.splice(Number(btn.dataset.index), 1);
      }
      render();
    });

    input.addEventListener('change', () => {
      Array.from(input.files).forEach((file) => {
        if (existing.concat(uploaded).some((f) => nameOf(f) === file.name)) return;
        const fd = new FormData();
        fd.append('file', file);
        fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
          .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
          .then(({ ok, body }) => {
            const f = ok && ((body.success && body.files && body.files[0]) || body.file);
            if (f) { uploaded.push(f); render(); } else { alert(tr('Upload failed!') + ' ' + file.name + (body.error ? ' - ' + body.error : '')); }
          })
          .catch(() => alert(tr('Upload failed!') + ' ' + file.name));
      });
      input.value = '';
    });
    render();
  }

  function addRow(box, fill) {
    const tpl = box.querySelector('template[data-repeater-template]');
    const row = tpl.content.firstElementChild.cloneNode(true);
    box.querySelector('[data-repeater-rows]').appendChild(row);
    if (fill) fill(row);
    row.querySelectorAll('select.js-select').forEach(initSelect);
    return row;
  }

  function initRepeater(box) {
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-repeater-add]')) addRow(box);
      const remove = e.target.closest('[data-repeater-remove]');
      if (remove) remove.closest('[data-repeater-rows] > *').remove();
    });
  }

  $(function () {
    document.querySelectorAll('select.js-select').forEach(initSelect); // template content is not in the DOM
    document.querySelectorAll('[data-attachments]').forEach(initAttachments);
    document.querySelectorAll('[data-repeater]').forEach(initRepeater);
  });

  window.FormKit = { initSelect, initAttachments, addRow };
})();
