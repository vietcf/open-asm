// Building blocks for detail modals (window.DV), shared by every list page.
//
//   DV.section(title, DV.rows(DV.field(label, html), ...), extraHeaderHtml)
//   DV.chips(values, toLabel)   DV.urlList(values)   DV.contacts(list)
//   DV.ipLink(ip)   DV.unit(id, name)   DV.date(value)   DV.esc(text)
//   DV.enhance(rootEl)          tooltips for IP links and units inside rootEl
//   DV.load(url, el, render)    fetch JSON, render(data) -> html into el
//   DV.showPentest(type, id)    read-only pentest history (partials/ui/pentest_quick_view.ejs)
//
// Every value is escaped; labels are English i18n keys translated with t().
// Look and spacing come from the .detail-* classes in custom.css.
(function () {
  'use strict';
  const tr = (s) => (typeof window.t === 'function' ? window.t(s) : s);

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  const EMPTY = '<span class="text-secondary">—</span>';
  const toArray = (v) => (Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v]));

  // a retired option (inactive) is marked "(inactive)", like ui.optionLabel
  function optionLabel(options, value) {
    const found = (options || []).find((o) => String(o.id ?? o.value) === String(value));
    if (!found) return value;
    const label = found.text ?? found.label;
    return found.inactive ? label + ' (' + tr('inactive') + ')' : label;
  }
  function chips(values, toLabel) {
    const list = toArray(values).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (!list.length) return EMPTY;
    return '<div class="chip-list">' + list.map((v) => '<span class="badge tag">' + esc(toLabel ? toLabel(v) : v) + '</span>').join('') + '</div>';
  }
  // "label | value" row; value is HTML (already escaped by the caller)
  function field(label, valueHtml) {
    return '<div class="detail-row"><div class="detail-label">' + esc(tr(label)) + '</div><div class="detail-value">' + (valueHtml || EMPTY) + '</div></div>';
  }
  const rows = (...fields) => '<div class="detail-rows">' + fields.join('') + '</div>';
  function section(title, bodyHtml, extraHtml) {
    return '<section class="detail-card"><div class="detail-card-header">' + esc(tr(title)) + (extraHtml || '') + '</div><div class="detail-card-body">' + bodyHtml + '</div></section>';
  }
  const text = (value) => (value === null || value === undefined || String(value).trim() === '' ? '' : esc(value));
  const multiline = (value) => (text(value) ? '<span class="text-pre-wrap">' + esc(String(value).trim()) + '</span>' : '');
  function date(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return String(value);
    return d.toLocaleString(document.documentElement.lang || undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  // "https://host:port/path", a bare host or IP, optionally " [comment]";
  // only http(s) is clickable, a bare host gets http://
  function urlItem(raw) {
    const str = String(raw).trim();
    const m = str.match(/^(.+?)\s*\[(.+?)\]$/);
    const target = m ? m[1].trim() : str;
    const note = m ? ' <span class="badge tag">' + esc(m[2].trim()) + '</span>' : '';
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
    const href = hasScheme ? (/^https?:\/\//i.test(target) ? target : null) : 'http://' + target;
    return '<li>' + (href ? '<a href="' + esc(encodeURI(href)) + '" target="_blank" rel="noopener noreferrer">' + esc(target) + '</a>' : esc(target)) + note + '</li>';
  }
  const urlList = (values) => (toArray(values).length ? '<ul class="detail-list">' + toArray(values).map(urlItem).join('') + '</ul>' : '');
  function contacts(list) {
    if (!list || !list.length) return EMPTY;
    return '<ul class="detail-list">' + list.map((c) => {
      const name = c.name || c;
      const user = c.email ? String(c.email).split('@')[0] : '';
      return '<li><i class="bi bi-person text-secondary me-1"></i><a href="/organize/contact?search=' + encodeURIComponent(c.email || name) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>' +
        (user ? ' <span class="text-secondary small">(' + esc(user) + ')</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function ipLink(ip) {
    return '<a href="/network/ip-address?search=' + encodeURIComponent(ip) + '" target="_blank" rel="noopener noreferrer" class="ip-hover-link font-monospace" data-ip="' + esc(ip) + '" title="' + esc(tr('Loading IP info...')) + '">' + esc(ip) + '</a>';
  }
  const ipLinks = (list) => (toArray(list).length ? '<div class="chip-list">' + toArray(list).map((ip) => ipLink(ip.ip_address || ip.ip || ip)).join('') + '</div>' : '');
  const unit = (id, name) => (id ? '<span class="org-tooltip" data-unit-id="' + esc(id) + '" style="cursor: help;">' + esc(name || '') + '</span>' : '');
  const linkChips = (items, href) => (toArray(items).length
    ? '<div class="chip-list">' + toArray(items).map((it) => '<a href="' + esc(href(it)) + '" target="_blank" rel="noopener noreferrer" class="badge tag text-decoration-none">' + esc(it.name || it.domain || it) + '</a>').join('') + '</div>'
    : '');
  // attachments: [{ id, name, url }], viewUrl like '/system/file/:id/view'
  function files(list, viewUrl) {
    if (!toArray(list).length) return '';
    return '<ul class="detail-list detail-pad">' + toArray(list).map((f) => '<li><i class="bi bi-paperclip text-secondary me-1"></i><a href="' + esc(f.url || '#') + '" download>' + esc(f.name || f.originalname || tr('Unknown file')) + '</a>' +
      (viewUrl && f.id ? ' <a href="' + esc(viewUrl.replace(':id', encodeURIComponent(f.id))) + '" target="_blank" rel="noopener noreferrer" class="badge tag text-decoration-none ms-1">' + esc(tr('View')) + '</a>' : '') + '</li>').join('') + '</ul>';
  }
  // placeholder filled later by DV.load()
  const placeholder = (id) => '<span id="' + esc(id) + '" class="text-secondary small">' + esc(tr('Loading...')) + '</span>';
  function meta(record) {
    const parts = [];
    if (record.created_at) parts.push(esc(tr('Created')) + ' ' + esc(date(record.created_at)));
    if (record.updated_at) parts.push(esc(tr('Updated')) + ' ' + esc(date(record.updated_at)) + (record.updated_by ? ' · ' + esc(record.updated_by) : ''));
    return parts.length ? '<div class="detail-meta">' + parts.join('<span class="mx-2">|</span>') + '</div>' : '';
  }

  // ---- tooltips: IP details and unit descriptions (lazy, cached) ----------
  const ipCache = {};
  const unitCache = {};
  function ipTooltipText(ip, info) {
    if (!info) return 'IP: ' + ip + '\n' + tr('No additional information found');
    const lines = ['IP: ' + (info.ip_address || ip)];
    if (info.description) lines.push(tr('Description') + ': ' + info.description);
    if (info.status) lines.push(tr('Status') + ': ' + info.status);
    (info.servers || []).forEach((s) => lines.push(tr('Server') + ': ' + s.name + (s.role === 'vip' ? ' (VIP)' : '')));
    (info.devices || []).forEach((d) => lines.push(tr('Device') + ': ' + d.name + (d.role === 'vip' ? ' (VIP)' : '')));
    if ((info.systems || []).length) lines.push(tr('Systems') + ': ' + info.systems.map((s) => s.name || s).join(', '));
    if ((info.contacts || []).length) lines.push(tr('Contacts') + ': ' + info.contacts.map((c) => c.name || c).join(', '));
    return lines.join('\n');
  }
  function lazyTooltip(el, cache, key, url, toText) {
    if (el.dataset.tooltipInit) return;
    el.dataset.tooltipInit = '1';
    const tip = new bootstrap.Tooltip(el, { title: tr('Loading...') });
    el.addEventListener('show.bs.tooltip', () => {
      if (cache[key]) { tip.setContent({ '.tooltip-inner': cache[key] }); return; }
      fetch(url, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => { cache[key] = toText(data); tip.setContent({ '.tooltip-inner': cache[key] }); })
        .catch(() => tip.setContent({ '.tooltip-inner': tr('Error loading information') }));
    });
  }
  function enhance(root) {
    const scope = root || document;
    scope.querySelectorAll('.ip-hover-link[data-ip]').forEach((el) => {
      const ip = el.dataset.ip;
      lazyTooltip(el, ipCache, ip, '/network/api/ip-addresses/detail?search=' + encodeURIComponent(ip), (data) => ipTooltipText(ip, Array.isArray(data) ? data[0] : null));
    });
    scope.querySelectorAll('.org-tooltip[data-unit-id]').forEach((el) => {
      const id = el.dataset.unitId;
      lazyTooltip(el, unitCache, id, '/organize/api/unit/' + encodeURIComponent(id) + '/detail', (data) => (data && data.description) || tr('No description'));
    });
  }

  // fetch JSON into a placeholder element
  function load(url, el, render) {
    if (!el) return Promise.resolve();
    return fetch(url, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data) => { el.classList.remove('text-secondary', 'small'); el.innerHTML = render(data) || EMPTY; enhance(el); })
      .catch(() => { el.innerHTML = '<span class="text-danger">' + esc(tr('Error loading information')) + '</span>'; });
  }

  // ---- pentest quick view -------------------------------------------------
  function showPentest(objectType, objectId) {
    const modalEl = document.getElementById('pentestQuickViewModal');
    if (!objectId || !modalEl) return;
    const content = document.getElementById('pentestQuickViewContent');
    content.innerHTML = '<p class="text-secondary mb-0">' + esc(tr('Loading...')) + '</p>';
    document.getElementById('pentestQuickViewManageLink').href = '/pentest?object_type=' + encodeURIComponent(objectType) + '&object_id=' + encodeURIComponent(objectId);
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
    load('/pentest/api/by-object?object_type=' + encodeURIComponent(objectType) + '&object_id=' + encodeURIComponent(objectId), content, (data) => {
      const rounds = data.rounds || [];
      if (!rounds.length) return '<p class="text-secondary mb-0">' + esc(tr('No pentest rounds recorded yet.')) + '</p>';
      // a system's history also lists its components' rounds: show which target each is
      const withTarget = rounds.some((r) => r.object_type !== objectType);
      return '<div class="table-responsive"><table class="table table-sm align-middle detail-table mb-0"><thead><tr>' +
        (withTarget ? ['Target'] : []).concat(['Round Name', 'Date', 'Status', 'Participants', 'Report']).map((h) => '<th>' + esc(tr(h)) + '</th>').join('') +
        '</tr></thead><tbody>' + rounds.map((r) => '<tr>' + (withTarget ? '<td>' + esc(r.target_label || '') + '</td>' : '') + '<td>' + esc(r.name) + '</td><td>' + esc(r.test_date ? date(r.test_date).split(' ')[0] : '') + '</td><td><span class="badge tag">' + esc(tr(r.status || 'NOT_STARTED')) + '</span></td><td>' +
          (esc((r.participants || []).map((p) => p.name).join(', ')) || EMPTY) + '</td><td>' +
          (r.report ? '<a href="' + esc(r.report.url) + '" download>' + esc(r.report.original_name) + '</a> <a href="/pentest/report/' + encodeURIComponent(r.report.id) + '/view" target="_blank" rel="noopener noreferrer" class="badge tag text-decoration-none">' + esc(tr('View')) + '</a>' : EMPTY) +
          '</td></tr>').join('') + '</tbody></table></div>';
    });
  }

  // ---- detail modal (partials/ui/detail_modal.ejs) ------------------------
  // record from the clicked row: <button data-record='{json}'>
  function record(button) {
    try { return JSON.parse(button.getAttribute('data-record')); } catch (e) { return null; }
  }
  function open(modalId, { title, subtitle, body, recordId } = {}) {
    const el = document.getElementById(modalId);
    if (!el) return;
    el.querySelector('[data-detail-title]').textContent = title || '';
    el.querySelector('[data-detail-subtitle]').innerHTML = subtitle || '';
    const bodyEl = el.querySelector('[data-detail-body]');
    bodyEl.innerHTML = body || '';
    const pentest = el.querySelector('[data-detail-pentest]');
    if (pentest) pentest.onclick = () => showPentest(pentest.dataset.detailPentest, recordId);
    if (!el.dataset.cleanup) {
      el.dataset.cleanup = '1';
      el.addEventListener('hidden.bs.modal', () => { el.querySelector('[data-detail-body]').innerHTML = ''; });
    }
    enhance(bodyEl);
    bootstrap.Modal.getOrCreateInstance(el).show();
    return bodyEl;
  }

  window.DV = { esc, EMPTY, toArray, optionLabel, chips, field, rows, section, text, multiline, date, urlItem, urlList, contacts, ipLink, ipLinks, unit, linkChips, files, placeholder, meta, enhance, load, showPentest, record, open };
})();
