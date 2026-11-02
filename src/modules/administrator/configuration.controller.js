// Web pages: /administrator/configuration/:group
import Configuration from './configuration.model.js';
import { CONFIG_GROUPS, findGroup, parseOptions, validateField } from '../../utils/configRegistry.js';
import { withTransaction } from '../../shared/transaction.js';
import { siteConfig } from '../../utils/siteConfig.js';
import { reschedule } from '../backup/backup.scheduler.js';

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
    const fields = group.fields.map(f => {
      const row = byKey.get(f.key);
      const stored = row ? row.value : null;
      return {
        ...f,
        exists: Boolean(row),
        value: f.type === 'options' ? parseOptions(stored) : (stored ?? ''),
        updated_by: row ? row.updated_by : null,
        updated_at: row ? row.updated_at : null,
      };
    });
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
      changes.push({ field, value: result.value });
    }
    const user = req.session.user ? req.session.user.username : null;
    await withTransaction(null, async client => {
      for (const { field, value } of changes) {
        if (value === null) await Configuration.remove(field.key, client);
        else await Configuration.upsert(field.key, { value, description: field.help || field.label, updatedBy: user }, client);
      }
    });
    await siteConfig.initialize();
    if (group.id === 'backup') await reschedule();
    req.flash('success', t('{group} settings saved', { group: t(group.label) }));
    res.redirect(back);
  } catch (err) {
    req.flash('error', t('Failed to save configuration: {message}', { message: err.message }));
    res.redirect(back);
  }
};

export default configurationController;
