// Web pages: /administrator/configuration/:group
import Configuration from './configuration.model.js';
import { CONFIG_GROUPS, findGroup, parseOptions, validateField } from '../../utils/configRegistry.js';
import { withTransaction } from '../../shared/transaction.js';
import { siteConfig } from '../../utils/siteConfig.js';
import { reschedule } from '../backup/backup.scheduler.js';
import { usageCounts, replaceValue } from '../../utils/optionUsage.js';
import { writeLog } from '../../utils/logHelper.js';

const configurationController = {};

// One tab per group of src/utils/configRegistry.js, each key with its own
// editor (option lists as a grid). This is the only way the app writes
// configuration, so every value goes through validateField().
configurationController.configurationHome = (req, res) => {
  res.redirect(`/administrator/configuration/${CONFIG_GROUPS[0].id}`);
};

configurationController.showConfigurationGroup = async (req, res, next) => {
  try {
    const group = findGroup(req.params.group);
    if (!group) return next();
    const rows = await Configuration.findByKeys(group.fields.map(f => f.key));
    const byKey = new Map(rows.map(r => [r.key, r]));
    const fields = await Promise.all(group.fields.map(async f => {
      const row = byKey.get(f.key);
      const stored = row ? row.value : null;
      return {
        ...f,
        exists: Boolean(row),
        value: f.type === 'options' ? parseOptions(stored) : (stored ?? ''),
        // option lists: value -> number of records using it
        usage: f.type === 'options' ? Object.fromEntries(await usageCounts(f.key)) : null,
        updated_by: row ? row.updated_by : null,
        updated_at: row ? row.updated_at : null,
      };
    }));
    res.render('pages/administrator/configuration_group', {
      group,
      fields,
      groups: CONFIG_GROUPS,
      success: (req.flash('success') || [])[0],
      error: (req.flash('error') || [])[0],
      title: 'System Configuration',
      activeMenu: 'system-configuration'
    });
  } catch (err) {
    next(err);
  }
};

configurationController.saveConfigurationGroup = async (req, res, next) => {
  const group = findGroup(req.params.group);
  if (!group) return next();
  const back = `/administrator/configuration/${group.id}`;
  const submitted = req.body.fields || {};
  const t = req.t || (s => s);
  try {
    const stored = new Map((await Configuration.findByKeys(group.fields.map(f => f.key))).map(r => [r.key, r.value]));
    const changes = [];
    for (const field of group.fields) {
      if (!(field.key in submitted)) continue;
      const storedValues = field.type === 'options'
        ? new Set(parseOptions(stored.get(field.key)).map(o => o.value))
        : undefined;
      const result = validateField(field, submitted[field.key], storedValues);
      if (result.error) {
        req.flash('error', t(result.error, { field: t(field.label), ...result.params }));
        return res.redirect(back);
      }
      if (field.type === 'options') {
        const planned = await planOptionRemovals(field, parseOptions(stored.get(field.key)), JSON.parse(result.value), replaceRequests(req, field.key), t);
        if (planned.error) {
          req.flash('error', planned.error);
          return res.redirect(back);
        }
        changes.push({ field, value: JSON.stringify(planned.items), replacements: planned.replacements, retired: planned.retired });
      } else {
        changes.push({ field, value: result.value });
      }
    }
    const user = req.session.user ? req.session.user.username : null;
    const notes = [];
    await withTransaction(null, async client => {
      for (const { field, value, replacements = [], retired = [] } of changes) {
        for (const { from, to } of replacements) {
          const n = await replaceValue(field.key, from, to, client);
          notes.push(t('{field}: "{from}" replaced by "{to}" in {count} record(s)', { field: t(field.label), from, to, count: n }));
        }
        for (const value of retired) notes.push(t('{field}: "{value}" is still in use, kept as inactive', { field: t(field.label), value }));
        if (value === null) await Configuration.remove(field.key, client);
        else await Configuration.upsert(field.key, { value, description: field.help || field.label, updatedBy: user }, client);
      }
    });
    for (const note of notes) {
      await writeLog({ req, action: 'update', object_type: 'configuration', category: 'security', status: 'success', description: note }).catch(() => {});
    }
    await siteConfig.initialize();
    if (group.id === 'backup') await reschedule();
    req.flash('success', [t('{group} settings saved', { group: t(group.label) }), ...notes].join(' · '));
    res.redirect(back);
  } catch (err) {
    req.flash('error', t('Failed to save configuration: {message}', { message: err.message }));
    res.redirect(back);
  }
};

// replace[<key>] posted by the editor: JSON {"<removed value>": "<value that takes its place>"}
function replaceRequests(req, key) {
  try {
    const map = JSON.parse((req.body.replace || {})[key] || '{}');
    return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  } catch {
    return {};
  }
}

// An option list may lose a value only when no record uses it. A removed value
// still in use is either replaced (every record gets the chosen value, which
// must be an active option of the new list) or, without a replacement, kept as
// an inactive option, so no record ever holds a value missing from its list.
async function planOptionRemovals(field, before, items, requested, t) {
  const kept = new Set(items.map(o => o.value));
  const removed = before.filter(o => !kept.has(o.value));
  if (!removed.length) return { items, replacements: [], retired: [] };
  const counts = await usageCounts(field.key);
  const replacements = [];
  const retired = [];
  for (const option of removed) {
    if (!counts.get(option.value)) continue;
    const to = requested[option.value];
    if (to !== undefined && to !== '') {
      const target = items.find(o => o.value === String(to));
      if (!target || target.active === false) {
        return { error: t('{field}: "{value}" cannot replace "{from}", it must be an active option of the list', { field: t(field.label), value: to, from: option.value }) };
      }
      replacements.push({ from: option.value, to: target.value });
    } else {
      items.push({ value: option.value, label: option.label, active: false });
      retired.push(option.value);
    }
  }
  return { items, replacements, retired };
}

export default configurationController;
