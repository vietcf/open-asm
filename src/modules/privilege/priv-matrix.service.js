// Permission matrix (role x permission) of a system, its versions (snapshot
// -> Word document to sign -> signed PDF) and the changes since the last
// signed version.
//
// Matrix of a system:
//   roles        the system's roles, plus the "All systems" roles given to
//                one of its accounts
//   permissions  the system's permissions, plus the "All systems" ones held
//                by one of those roles
//   granted      [roleId, permissionId] pairs
// access = { scope } (priv-scope.js): only systems of the user's unit.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType,
  PageOrientation, VerticalAlign, ShadingType,
} from 'docx';
import { pool } from '../../../config/config.js';
import PrivMatrixVersion from './priv-matrix.model.js';
import { managedSystemIds } from './priv-scope.js';
import { siteConfig } from '../../utils/siteConfig.js';
import { ValidationError, NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors.js';

const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'public/uploads');
const SIGNED_DIR = path.join(UPLOADS_DIR, 'priv-matrix'); // not served by /uploads: only by the download route
const MAX_PDF = 25 * 1024 * 1024;

async function assertSystemInScope(systemId, scope) {
  const managed = await managedSystemIds(scope);
  if (managed && !managed.includes(Number(systemId))) throw new NotFoundError('System not found');
}

// ===== Matrix =====
export async function buildMatrix(systemId, scope = null) {
  await assertSystemInScope(systemId, scope);
  const { rows: [system] } = await pool.query(
    `SELECT s.id, s.system_id AS code, s.name, uo.name AS ops_department, ud.name AS department
       FROM systems s LEFT JOIN units uo ON uo.id = s.ops_department_id LEFT JOIN units ud ON ud.id = s.department_id
      WHERE s.id = $1`, [systemId]);
  if (!system) throw new NotFoundError('System not found');

  const { rows: roles } = await pool.query(
    `SELECT r.id, r.name, r.description, r.all_systems,
            (SELECT COUNT(DISTINCT pu.id)::int FROM priv_users pu JOIN priv_user_systems pus ON pus.user_id = pu.id
              WHERE pu.role_id = r.id AND pus.system_id = $1) AS account_count
       FROM priv_roles r
      WHERE r.system_id = $1
         OR (r.all_systems AND EXISTS (SELECT 1 FROM priv_users pu JOIN priv_user_systems pus ON pus.user_id = pu.id
                                        WHERE pu.role_id = r.id AND pus.system_id = $1))
      ORDER BY r.all_systems, LOWER(r.name)`, [systemId]);
  const roleIds = roles.map((r) => r.id);
  const { rows: grants } = roleIds.length
    ? await pool.query('SELECT role_id, permission_id FROM priv_role_permissions WHERE role_id = ANY($1::int[])', [roleIds])
    : { rows: [] };
  const { rows: permissions } = await pool.query(
    `SELECT p.id, p.name, p.description, p.all_systems FROM priv_permissions p
      WHERE p.system_id = $1 OR (p.all_systems AND p.id IN (SELECT permission_id FROM priv_role_permissions WHERE role_id = ANY($2::int[])))
      ORDER BY p.all_systems, p.name`, [systemId, roleIds]);
  const permissionIds = new Set(permissions.map((p) => p.id));
  return {
    system, roles, permissions,
    granted: grants.filter((g) => permissionIds.has(g.permission_id)).map((g) => [g.role_id, g.permission_id]),
  };
}

// What changed from a (signed) snapshot to a matrix, by name:
// { roles: {added, removed}, permissions: {added, removed}, grants: {added, removed: [[role, permission]]}, count }
export function diffMatrix(from, to) {
  const names = (m) => {
    const role = new Map(m.roles.map((r) => [r.id, r.name]));
    const perm = new Map(m.permissions.map((p) => [p.id, p.name]));
    return {
      roles: new Set(m.roles.map((r) => r.name)),
      permissions: new Set(m.permissions.map((p) => p.name)),
      grants: new Set(m.granted.map(([r, p]) => `${role.get(r)}\u0000${perm.get(p)}`)),
    };
  };
  const a = names(from);
  const b = names(to);
  const minus = (x, y) => [...x].filter((v) => !y.has(v)).sort();
  const pair = (v) => v.split('\u0000');
  const diff = {
    roles: { added: minus(b.roles, a.roles), removed: minus(a.roles, b.roles) },
    permissions: { added: minus(b.permissions, a.permissions), removed: minus(a.permissions, b.permissions) },
    grants: { added: minus(b.grants, a.grants).map(pair), removed: minus(a.grants, b.grants).map(pair) },
  };
  diff.count = diff.roles.added.length + diff.roles.removed.length + diff.permissions.added.length
    + diff.permissions.removed.length + diff.grants.added.length + diff.grants.removed.length;
  return diff;
}

// ===== Versions =====
async function getVersion(id, scope) {
  const version = await PrivMatrixVersion.findById(id);
  if (!version) throw new NotFoundError('Version not found');
  await assertSystemInScope(version.system_id, scope);
  return version;
}

export async function listVersions(systemId, scope = null) {
  await assertSystemInScope(systemId, scope);
  return PrivMatrixVersion.listBySystem(systemId);
}

// Current matrix, its versions and what changed since the last signed one
export async function getMatrixPage(systemId, scope = null) {
  const [matrix, versions, signed] = await Promise.all([buildMatrix(systemId, scope), PrivMatrixVersion.listBySystem(systemId), PrivMatrixVersion.latestSigned(systemId)]);
  return { matrix, versions, lastSigned: signed ? { version: signed.version, signed_at: signed.signed_at } : null, diff: signed ? diffMatrix(signed.snapshot, matrix) : null };
}

export async function createVersion(systemId, { note, createdBy }, scope = null) {
  const matrix = await buildMatrix(systemId, scope);
  return PrivMatrixVersion.create({ system_id: matrix.system.id, snapshot: { ...matrix, created_by: createdBy, created_at: new Date().toISOString() }, note, created_by: createdBy });
}

// Drafts can be deleted; a signed version only by superadmin (kept for audits)
export async function deleteVersion(id, { scope = null, superadmin = false } = {}) {
  const version = await getVersion(id, scope);
  if (version.status === 'signed' && !superadmin) throw new ForbiddenError('A signed version cannot be deleted');
  await PrivMatrixVersion.remove(id);
  if (version.signed_file_path) fs.rmSync(path.join(SIGNED_DIR, path.basename(version.signed_file_path)), { force: true });
}

// Uploaded PDF (multer temp file) -> the version's signed copy
export async function attachSigned(id, file, { signedAt, note, uploadedBy }, scope = null) {
  try {
    const version = await getVersion(id, scope);
    if (version.status === 'signed') throw new ConflictError('This version is already signed');
    if (!file) throw new ValidationError('Choose the signed PDF file');
    if (file.size > MAX_PDF) throw new ValidationError('The file is too large');
    const head = Buffer.alloc(5);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, head, 0, 5, 0);
    fs.closeSync(fd);
    if (head.toString('latin1') !== '%PDF-') throw new ValidationError('The signed copy must be a PDF file');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(signedAt || '')) ? signedAt : null;
    if (!date) throw new ValidationError('Signing date is required');
    fs.mkdirSync(SIGNED_DIR, { recursive: true });
    const stored = `${version.system_id}-v${version.version}-${crypto.randomBytes(8).toString('hex')}.pdf`;
    fs.copyFileSync(file.path, path.join(SIGNED_DIR, stored));
    const name = String(file.originalname || 'signed.pdf').replace(/[\r\n"]/g, '').slice(0, 255);
    await PrivMatrixVersion.markSigned(id, { signed_at: date, file_path: stored, file_name: name, uploaded_by: uploadedBy, note: typeof note === 'string' ? note.trim() : null });
  } finally {
    if (file?.path) fs.rmSync(file.path, { force: true });
  }
}

// -> { path, name } of the signed PDF
export async function signedFile(id, scope = null) {
  const version = await getVersion(id, scope);
  if (version.status !== 'signed' || !version.signed_file_path) throw new NotFoundError('This version has no signed copy yet');
  const file = path.join(SIGNED_DIR, path.basename(version.signed_file_path));
  if (!fs.existsSync(file)) throw new NotFoundError('File not found');
  return { path: file, name: version.signed_file_name || `matrix-v${version.version}.pdf` };
}

// ===== Word document (to be signed), always built from the version's snapshot =====
const FONT = 'Times New Roman';
const run = (text, opts = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: opts.size || 24, bold: opts.bold, italics: opts.italics });
const para = (children, opts = {}) => new Paragraph({ children: [].concat(children), alignment: opts.align, spacing: { after: opts.after ?? 80, before: opts.before ?? 0 } });
const cell = (children, opts = {}) => new TableCell({
  children: [].concat(children), verticalAlign: VerticalAlign.CENTER, width: opts.width,
  shading: opts.header ? { type: ShadingType.CLEAR, fill: 'D9E2F3', color: 'auto' } : undefined,
  margins: { top: 40, bottom: 40, left: 80, right: 80 },
});
const date = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// -> { buffer, fileName }
export async function versionDocument(id, t, scope = null) {
  const version = await getVersion(id, scope);
  const { system, roles, permissions, granted, created_by: createdBy, created_at: createdAt } = version.snapshot;
  const has = new Set(granted.map(([r, p]) => `${r}:${p}`));
  const allMark = ' (*)';
  const anyGlobal = roles.some((r) => r.all_systems) || permissions.some((p) => p.all_systems);

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell(para(run(t('No.'), { bold: true, size: 20 }), { align: AlignmentType.CENTER, after: 0 }), { header: true, width: { size: 600, type: WidthType.DXA } }),
      cell(para(run(t('Permission'), { bold: true, size: 20 }), { after: 0 }), { header: true }),
      cell(para(run(t('Description'), { bold: true, size: 20 }), { after: 0 }), { header: true }),
      ...roles.map((r) => cell(para(run(r.name + (r.all_systems ? allMark : ''), { bold: true, size: 20 }), { align: AlignmentType.CENTER, after: 0 }), { header: true })),
    ],
  });
  const body = permissions.map((p, i) => new TableRow({
    children: [
      cell(para(run(i + 1, { size: 20 }), { align: AlignmentType.CENTER, after: 0 })),
      cell(para(run(p.name + (p.all_systems ? allMark : ''), { size: 20 }), { after: 0 })),
      cell(para(run(p.description || '', { size: 20 }), { after: 0 })),
      ...roles.map((r) => cell(para(run(has.has(`${r.id}:${p.id}`) ? 'X' : '', { bold: true, size: 20 }), { align: AlignmentType.CENTER, after: 0 }))),
    ],
  }));
  const matrix = permissions.length && roles.length
    ? new Table({ rows: [header, ...body], width: { size: 100, type: WidthType.PERCENTAGE } })
    : para(run(t('No roles or permissions recorded for this system.'), { italics: true }));

  const sign = (title) => cell([
    para(run(title, { bold: true }), { align: AlignmentType.CENTER, after: 0 }),
    para(run(t('(Signature, full name)'), { italics: true, size: 20 }), { align: AlignmentType.CENTER, after: 1600 }),
  ]);
  const noBorders = { top: { style: 'none' }, bottom: { style: 'none' }, left: { style: 'none' }, right: { style: 'none' }, insideHorizontal: { style: 'none' }, insideVertical: { style: 'none' } };

  const doc = new Document({
    creator: siteConfig.getSiteName(),
    title: `${t('Permission matrix')} - ${system.name} - v${version.version}`,
    sections: [{
      properties: roles.length > 5 ? { page: { size: { orientation: PageOrientation.LANDSCAPE } } } : {},
      children: [
        para(run(siteConfig.getSiteName().toUpperCase(), { bold: true, size: 22 }), { align: AlignmentType.LEFT }),
        para(run(t('PERMISSION MATRIX').toUpperCase(), { bold: true, size: 32 }), { align: AlignmentType.CENTER, before: 200, after: 60 }),
        para(run(`${system.name}${system.code ? ` (${system.code})` : ''}`, { bold: true, size: 26 }), { align: AlignmentType.CENTER, after: 240 }),
        para([run(`${t('Operations department (L2)')}: `, { bold: true }), run(system.ops_department || '—')]),
        para([run(`${t('Development department (L3)')}: `, { bold: true }), run(system.department || '—')]),
        para([run(`${t('Version')}: `, { bold: true }), run(`v${version.version}`), run(`    ${t('Created')}: `, { bold: true }), run(`${date(createdAt || version.created_at)}${createdBy ? ` - ${createdBy}` : ''}`)], { after: 200 }),
        matrix,
        para(run(`X: ${t('the role has the permission')}.${anyGlobal ? `  (*): ${t('for all systems')}.` : ''}`, { italics: true, size: 20 }), { before: 120, after: 400 }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
          rows: [new TableRow({ children: [sign(t('Prepared by')), sign(t('Reviewed by')), sign(t('Approved by'))] })],
        }),
      ],
    }],
  });
  const safe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9._-]+/g, '_');
  return { buffer: await Packer.toBuffer(doc), fileName: `ma-tran-phan-quyen_${safe(system.code || system.name)}_v${version.version}.docx` };
}
