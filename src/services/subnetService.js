import Subnet from '../models/Subnet.js';
import Tag from '../models/Tag.js';
import { ValidationError, NotFoundError, ConflictError } from './errors.js';
import { withTransaction } from './transaction.js';

// Anchored CIDR check — the only format validation that existed anywhere was
// the frontend's unanchored regex (`\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$`, missing
// a leading `^`), and the API had no format validation at all. Adopted here,
// properly anchored, for both consumers.
const CIDR_REGEX = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

const toIdArray = v => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
};

// Two-step validation (blank-filter, then existence) with the frontend's
// original, more specific messages — applied for both consumers.
export async function validateTagIds(tagIds) {
  const validTagIds = tagIds.filter(tagId => tagId && tagId.toString().trim() !== '');
  if (validTagIds.length !== tagIds.length) {
    throw new ValidationError('Some selected tags are invalid. Please refresh the page and try again.');
  }
  for (const tagId of validTagIds) {
    if (!(await Tag.exists(tagId))) {
      throw new ValidationError('One or more selected tags no longer exist. Please refresh the page and select tags again.');
    }
  }
  return validTagIds;
}

export async function listSubnets(filter) {
  const { search, tags, zone, environment, page, pageSize } = filter;
  if (search || (tags && tags.length) || zone || environment) {
    const [items, totalCount] = await Promise.all([
      Subnet.findFilteredList({ search, tags, zone, environment, page, pageSize }),
      Subnet.countFiltered({ search, tags, zone, environment })
    ]);
    return { items, totalCount };
  }
  const [items, totalCount] = await Promise.all([
    Subnet.findPage(page, pageSize),
    Subnet.countAll()
  ]);
  return { items, totalCount };
}

export async function getSubnet(id) {
  const subnet = await Subnet.findById(id);
  if (!subnet) throw new NotFoundError('Subnet not found');
  return subnet;
}

export async function assertAddressAvailable(address) {
  const existing = await Subnet.findByAddress(address);
  if (existing) throw new ConflictError('Subnet already exists with this address');
}

// input: {address, description, zone, environment, tags, updated_by}
export async function createSubnet(input, client) {
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  if (!address) throw new ValidationError('Subnet address is required');
  if (!CIDR_REGEX.test(address)) {
    throw new ValidationError('Invalid subnet address format. Please enter a valid subnet, e.g. 192.168.1.0/24');
  }
  await assertAddressAvailable(address);

  const tags = await validateTagIds(toIdArray(input.tags));

  const description = typeof input.description === 'string' ? input.description.trim() : (input.description || '');
  const zone = typeof input.zone === 'string' ? input.zone.trim() : (input.zone || '');
  const environment = typeof input.environment === 'string' ? input.environment.trim() : (input.environment || '');

  const subnet = await withTransaction(client, async (c) => {
    const created = await Subnet.create({ address, description, zone, environment, updated_by: input.updated_by || '' }, c);
    await Subnet.setTags(created.id, tags, c);
    return created;
  });
  return Subnet.findById(subnet.id);
}

// Partial update. description/zone/environment are always written together
// (Subnet.update has no partial-column form), so missing keys fall back to
// the current row's values. `tags` key present (even as []) replaces the
// association; key absent leaves it untouched. Address is immutable.
export async function updateSubnet(id, input, client) {
  const current = await Subnet.findById(id);
  if (!current) throw new NotFoundError('Subnet not found');

  const has = key => Object.prototype.hasOwnProperty.call(input, key);

  const description = has('description')
    ? (typeof input.description === 'string' ? input.description.trim() : '')
    : current.description;
  const zone = has('zone')
    ? (typeof input.zone === 'string' ? input.zone.trim() : '')
    : current.zone;
  const environment = has('environment')
    ? (typeof input.environment === 'string' ? input.environment.trim() : '')
    : current.environment;

  let tags = null;
  if (has('tags')) {
    tags = await validateTagIds(toIdArray(input.tags));
  }

  if (!has('description') && !has('zone') && !has('environment') && !has('tags')) {
    throw new ValidationError('No fields to update');
  }

  await withTransaction(client, async (c) => {
    if (has('description') || has('zone') || has('environment')) {
      await Subnet.update(id, { description, zone, environment, updated_by: input.updated_by || '' }, c);
    }
    if (tags) await Subnet.setTags(id, tags, c);
  });
  return Subnet.findById(id);
}

export async function deleteSubnet(id) {
  const subnet = await Subnet.findById(id);
  if (!subnet) throw new NotFoundError('Subnet not found');
  await Subnet.delete(id);
}
