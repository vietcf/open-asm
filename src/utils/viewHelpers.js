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

// label of a configured option ({id, text} or {value, label}); the raw value when unknown
export function optionLabel(options, value) {
  const found = (options || []).find((o) => String(o.id ?? o.value) === String(value));
  return found ? (found.text ?? found.label) : value;
}

// monospace list (IPs, codes)
export const mono = (values) => (toArray(values).length ? `<span class="font-monospace small">${esc(toArray(values).join(', '))}</span>` : dash);

// <option> list for a select rendered with the page: options [{id, text}],
// selected = ids (or {id} objects) to mark selected
export function options(list, selected) {
  const ids = new Set(toArray(selected).map((s) => String(s && typeof s === 'object' ? s.id : s)));
  return (list || []).map((o) => `<option value="${esc(o.id)}"${ids.has(String(o.id)) ? ' selected' : ''}>${esc(o.text)}</option>`).join('');
}

// YYYY-MM-DD
export const date = (value) => {
  if (!value) return dash;
  const d = new Date(value);
  return isNaN(d) ? esc(value) : `<span class="text-nowrap small">${d.toISOString().slice(0, 10)}</span>`;
};

export default { esc, dash, toArray, text, clip, chips, optionLabel, mono, date, options };
