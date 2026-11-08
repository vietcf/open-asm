// HTML helpers for list cells, available in every template as `ui`
// (app.locals.ui). They return escaped HTML: output with <%- %>.
//   <td><%- ui.chips(system.tags.map(t => t.name)) %></td>
// Client-side counterparts for detail modals: public/js/detail-view.js (DV).

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const dash = '<span class="text-secondary">—</span>';
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
export const toArray = (v) => (Array.isArray(v) ? v : (isBlank(v) ? [] : [v]));

// plain text or "—"
export const text = (value) => (isBlank(value) ? dash : esc(value));

// long text clipped to two lines, full text in the tooltip
export const clip = (value) => (isBlank(value) ? dash : `<span class="cell-clip" title="${esc(String(value).trim())}">${esc(String(value).trim())}</span>`);

// neutral chips
export function chips(values) {
  const list = toArray(values).filter((v) => !isBlank(v));
  return list.length ? `<div class="chip-list">${list.map((v) => `<span class="badge tag">${esc(v)}</span>`).join('')}</div>` : dash;
}

// label of a configured option ({id, text} or {value, label}); the raw value when
// unknown; a retired option (inactive, see loadOptions) is marked "(inactive)"
export function optionLabel(options, value, t = (s) => s) {
  const found = (options || []).find((o) => String(o.id ?? o.value) === String(value));
  if (!found) return value;
  const label = found.text ?? found.label;
  return found.inactive ? `${label} (${t('inactive')})` : label;
}

// monospace list (IPs, codes)
export const mono = (values) => (toArray(values).length ? `<span class="font-monospace small">${esc(toArray(values).join(', '))}</span>` : dash);

// <option> list for a select rendered with the page: options [{id, text, inactive?}],
// selected = ids (or {id} objects) to mark selected.
// Retired options (inactive) are left out unless selected, so a record keeps
// its value when its form is saved; a selected value missing from the list is
// added too. Hidden options (hidden: e.g. units that have sub-units) are left
// out the same way, without the "(inactive)" mark. { all: true } (list filters): every option, retired ones last,
// nothing added (filters have their own extra choices such as "(Not set)").
export function options(list, selected, { all = false, t = (s) => s } = {}) {
  const ids = new Set(toArray(selected).map((s) => String(s && typeof s === 'object' ? s.id : s)));
  const items = (list || []).filter((o) => (all ? !o.hidden : !o.inactive && !o.hidden) || ids.has(String(o.id)));
  if (all) items.sort((a, b) => Number(Boolean(a.inactive)) - Number(Boolean(b.inactive)));
  if (!all) {
    const known = new Set(items.map((o) => String(o.id)));
    for (const id of ids) if (!known.has(id)) items.push({ id, text: id, inactive: true });
  }
  return items.map((o) => `<option value="${esc(o.id)}"${ids.has(String(o.id)) ? ' selected' : ''}>${esc(o.inactive ? `${o.text} (${t('inactive')})` : o.text)}</option>`).join('');
}

// YYYY-MM-DD
export const date = (value) => {
  if (!value) return dash;
  const d = new Date(value);
  return isNaN(d) ? esc(value) : `<span class="text-nowrap small">${d.toISOString().slice(0, 10)}</span>`;
};

const helpers = { esc, dash, toArray, text, clip, chips, optionLabel, mono, date, options };
export default helpers;

// Same helpers with the request's translator for the "(inactive)" marker
// (res.locals.ui, set by the i18n middleware)
export const withTranslator = (t) => ({
  ...helpers,
  optionLabel: (list, value) => optionLabel(list, value, t),
  options: (list, selected, opts = {}) => options(list, selected, { t, ...opts }),
});
