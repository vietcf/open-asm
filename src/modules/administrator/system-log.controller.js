// Web pages: /administrator/log (+ export)
import ExcelJS from 'exceljs';
import SystemLog, { LOG_LEVELS } from './system-log.model.js';
import { sanitizeExcelObject } from '../../utils/excelSafe.js';

const systemLogController = {};

// Two tabs on one page: application log ('app') and security audit
// ('security'); same filters for both, see SystemLog.findFiltered().
const LOG_EXPORT_LIMIT = 50000;

function logFilterFromQuery(query) {
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '');
  return {
    category: str(query.category) === 'security' ? 'security' : 'app',
    search: str(query.search),
    dateFrom: date(query.dateFrom),
    dateTo: date(query.dateTo),
    username: str(query.username),
    action: str(query.action),
    objectType: str(query.object_type),
    status: str(query.status),
    level: str(query.level),
    ip: str(query.ip),
  };
}

systemLogController.listSystemLogs = async (req, res, next) => {
  try {
    const filter = logFilterFromQuery(req.query);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = parseInt(req.query.pageSize, 10) || res.locals.defaultPageSize || 20;
    const [logs, totalCount, usernames, actions, objectTypes, statuses] = await Promise.all([
      SystemLog.findFiltered(filter, { page, pageSize }),
      SystemLog.countFiltered(filter),
      SystemLog.distinctValues('username', filter.category),
      SystemLog.distinctValues('action', filter.category),
      SystemLog.distinctValues('object_type', filter.category),
      SystemLog.distinctValues('status', filter.category),
    ]);
    res.render('pages/administrator/system_log', {
      logs,
      filter,
      options: { usernames, actions, objectTypes, statuses, levels: LOG_LEVELS },
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      title: 'System Log',
      activeMenu: 'system-log'
    });
  } catch (err) {
    next(err);
  }
};

// Excel export of the current tab and filters (most recent first).
systemLogController.exportSystemLogs = async (req, res, next) => {
  try {
    const filter = logFilterFromQuery(req.query);
    const t = req.t || (s => s);
    const logs = await SystemLog.findFiltered(filter, { page: 1, pageSize: LOG_EXPORT_LIMIT });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(filter.category === 'security' ? 'Security audit' : 'Application log');
    sheet.columns = [
      { header: t('Time'), key: 'created_at', width: 20 },
      { header: t('User'), key: 'username', width: 18 },
      { header: t('Action'), key: 'action', width: 16 },
      { header: t('Object'), key: 'object_type', width: 18 },
      { header: 'ID', key: 'object_id', width: 10 },
      { header: t('Result'), key: 'status', width: 10 },
      { header: t('Severity'), key: 'level', width: 10 },
      { header: t('IP Address'), key: 'ip_address', width: 16 },
      { header: t('Description'), key: 'description', width: 60 },
      { header: 'User agent', key: 'user_agent', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const log of logs) {
      sheet.addRow(sanitizeExcelObject({
        ...log,
        created_at: log.created_at ? new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19) : '',
      }));
    }
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filter.category === 'security' ? 'security-audit' : 'app-log'}-${stamp}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

export default systemLogController;
