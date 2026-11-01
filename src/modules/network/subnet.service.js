// Subnets: validation and persistence shared by the web pages and the REST API.
import Subnet from './subnet.model.js';
import Tag from '../organize/tag.model.js';
import IpAddress from './ip-address.model.js';
import { ValidationError, NotFoundError, ConflictError } from '../../shared/errors.js';
import { withTransaction } from '../../shared/transaction.js';
import { hasKey, toNullableString, resolveRelations, saveRelations } from '../../shared/service.js';

const CIDR_REGEX = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

const RELATIONS = {
  tags: { label: 'tag', exists: (id) => Tag.exists(id), save: (id, ids, c) => Subnet.setTags(id, ids, c) },
};

// ===== Queries =====
export async function listSubnets(filter) {
  const [items, totalCount] = await Promise.all([Subnet.findFilteredList(filter), Subnet.countFiltered(filter)]);
  return { items, totalCount };
}

export async function getSubnet(id) {
  const subnet = await Subnet.findById(id);
  if (!subnet) throw new NotFoundError('Subnet not found');
  return subnet;
}

// ===== Commands =====
// Optional gateway: an existing IP inside the subnet
async function gatewayOf(value, subnetAddress) {
  const id = value ? Number(value) : null;
  if (!id) return null;
  if (!(await IpAddress.exists(id))) throw new ValidationError('Selected gateway IP no longer exists. Please refresh and select again.');
  if (!(await Subnet.isIpInSubnet(subnetAddress, id))) throw new ValidationError('Gateway IP must belong to this subnet.');
  return id;
}

// input: {address, description, zone, environment, gateway_ip_id, tags, updated_by}
export async function createSubnet(input, client) {
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  if (!address) throw new ValidationError('Subnet address is required');
  if (!CIDR_REGEX.test(address)) throw new ValidationError('Invalid subnet address format. Please enter a valid subnet, e.g. 192.168.1.0/24');
  if (await Subnet.findByAddress(address)) throw new ConflictError('Subnet already exists with this address');
  const gateway_ip_id = await gatewayOf(input.gateway_ip_id, address);
  const relations = await resolveRelations(input, RELATIONS);

  try {
    const id = await withTransaction(client, async (c) => {
      const subnet = await Subnet.create({
        address, description: toNullableString(input.description), zone: toNullableString(input.zone),
        environment: toNullableString(input.environment), gateway_ip_id, updated_by: input.updated_by,
      }, c);
      await saveRelations(subnet.id, relations, RELATIONS, c);
      return subnet.id;
    });
    return Subnet.findById(id);
  } catch (err) {
    if (err.code === '23505') throw new ConflictError('Subnet already exists with this address');
    if (err.code === '22P02') throw new ValidationError('Invalid subnet address format. Please enter a valid subnet, e.g. 192.168.1.0/24');
    throw err;
  }
}

// Partial update: missing keys keep their value. The address is immutable.
export async function updateSubnet(id, input, client) {
  const current = await Subnet.findById(id);
  if (!current) throw new NotFoundError('Subnet not found');
  const pick = (key) => (hasKey(input, key) ? toNullableString(input[key]) : current[key]);
  const gateway_ip_id = hasKey(input, 'gateway_ip_id') ? await gatewayOf(input.gateway_ip_id, current.address) : current.gateway_ip_id;
  const relations = await resolveRelations(input, RELATIONS, { partial: true });

  await withTransaction(client, async (c) => {
    await Subnet.update(id, {
      description: pick('description'), zone: pick('zone'), environment: pick('environment'), gateway_ip_id, updated_by: input.updated_by,
    }, c);
    await saveRelations(id, relations, RELATIONS, c);
  });
  return Subnet.findById(id);
}

export async function deleteSubnet(id) {
  if (!(await Subnet.exists(id))) throw new NotFoundError('Subnet not found');
  await Subnet.remove(id);
}
