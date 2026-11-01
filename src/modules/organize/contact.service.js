import Contact from './contact.model.js';
import Unit from './unit.model.js';
import Configuration from '../administrator/configuration.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';

export const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function getPositionOptions() {
  try {
    const config = await Configuration.findById('contact_position');
    if (config && config.value) {
      const parsed = JSON.parse(config.value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => typeof item === 'object' ? item : { value: String(item), label: String(item) });
      }
    }
  } catch (e) { /* fall through to empty */ }
  return [];
}

// No position options configured means the deployment isn't restricting
// values — treat as free text rather than rejecting everything.
async function validatePosition(position) {
  if (!position) return;
  const options = await getPositionOptions();
  if (!options.length) return;
  const allowed = options.map(o => o.value);
  if (!allowed.includes(position)) {
    throw new ValidationError('Invalid position value');
  }
}

// unit_id: '' | null | undefined all mean "no unit"; anything else must
// resolve to an existing unit.
async function resolveUnitId(rawUnitId) {
  if (rawUnitId === undefined || rawUnitId === null || rawUnitId === '') return null;
  const unitId = parseInt(rawUnitId, 10);
  if (isNaN(unitId) || !(await Unit.findById(unitId))) {
    throw new ValidationError('Invalid unit_id: unit does not exist');
  }
  return unitId;
}

export async function listContacts({ search, unit_id, position, page, pageSize }) {
  const [items, totalCount] = await Promise.all([
    Contact.findFilteredPage({ search, unit_id, position, page, pageSize }),
    Contact.countFiltered({ search, unit_id, position })
  ]);
  return { items, totalCount };
}

export async function getContact(id) {
  const contact = await Contact.findById(id);
  if (!contact) throw new NotFoundError('Contact not found');
  return contact;
}

export async function findContactsByEmail(email) {
  return Contact.findByEmailSearch(email);
}

// input: {name, email, position, unit_id?, phone?, description?}
// The old API defaulted a blank position to the literal string 'STAFF' before
// validating it against the configured position list — but the configured
// values are deployment-defined (e.g. "Staff", capitalized), so that hardcoded
// default could fail its own validation. Not carried over: position is
// required explicitly here, matching the frontend's original (correct)
// behavior — its form's <select> is `required` anyway, so this is a no-op
// change for real form submissions.
export async function createContact(input, client) {
  const name = (input.name || '').trim();
  const email = (input.email || '').trim();
  const position = (input.position || '').trim();
  const phone = (input.phone || '').trim();
  const description = (input.description || '').trim();

  if (!name || !email || !position) {
    throw new ValidationError('Name, email, and position are required');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError('Invalid email format');
  }
  await validatePosition(position);
  const unitId = await resolveUnitId(input.unit_id);

  const existing = await Contact.findByEmail(email);
  if (existing) throw new ConflictError('Contact already exists with this email');

  return Contact.create({ name, email, phone, position, unit_id: unitId, description }, client);
}

// Partial update: only fields present as own-properties of `input` are
// touched (has-key semantics, matching the API's original behavior). Email
// format + duplicate checks now apply on update too — previously the
// frontend had neither, a real validation gap.
export async function updateContact(id, input) {
  const current = await Contact.findById(id);
  if (!current) throw new NotFoundError('Contact not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const name = has('name') ? (typeof input.name === 'string' ? input.name.trim() : current.name) : current.name;
  if (has('name') && !name) throw new ValidationError('Name must not be empty if provided');

  const email = has('email') ? (typeof input.email === 'string' ? input.email.trim() : current.email) : current.email;
  if (has('email') && !email) throw new ValidationError('Email must not be empty if provided');
  if (has('email') && email && !EMAIL_REGEX.test(email)) throw new ValidationError('Invalid email format');

  const phone = has('phone') ? (typeof input.phone === 'string' ? input.phone.trim() : current.phone) : current.phone;

  const position = has('position') ? (typeof input.position === 'string' ? input.position.trim() : current.position) : current.position;
  if (has('position') && !position) throw new ValidationError('Position must not be empty if provided');
  if (has('position')) await validatePosition(position);

  const description = has('description') ? (typeof input.description === 'string' ? input.description.trim() : current.description) : current.description;

  const unitId = has('unit_id') ? await resolveUnitId(input.unit_id) : current.unit_id;

  if (has('email') && email) {
    const existing = await Contact.findByEmail(email);
    if (existing && String(existing.id) !== String(id)) {
      throw new ConflictError('Contact already exists with this email');
    }
  }

  return Contact.update(id, { name, email, phone, position, unit_id: unitId, description });
}

export async function deleteContact(id) {
  const exists = await Contact.exists(id);
  if (!exists) throw new NotFoundError('Contact not found');
  await Contact.delete(id);
}
