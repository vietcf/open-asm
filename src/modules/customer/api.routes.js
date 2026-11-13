// REST routes of the customer module, mounted at /api/v1.
import express from 'express';
import * as customerService from './customer.service.js';
import { authenticateJWT, authorizePermissionJWT } from '../../middlewares/jwtAuth.middleware.js';
import { apiHandler, apiPage, paginated, apiActor } from '../../shared/api.js';

const router = express.Router();
router.use(['/customers'], authenticateJWT);

// Fields a client may write (others are ignored); attributes: only the custom fields sent change on update
const WRITABLE = ['name', 'code', 'type', 'status', 'unit_id', 'description', 'attributes', 'owner_ids', 'contacts', 'connections'];
const input = (body) => Object.fromEntries(WRITABLE.filter((k) => Object.prototype.hasOwnProperty.call(body || {}, k)).map((k) => [k, body[k]]));
const list = (v) => [].concat(v ?? []).filter(Boolean);

/**
 * @swagger
 * tags:
 *   - name: Customer
 *     description: Customers, partners and vendors, their connections (Internet whitelist, VPN, MPLS...) and the IPs / networks (CIDR) behind each connection
 *
 * components:
 *   schemas:
 *     CustomerConnection:
 *       type: object
 *       required: [name, channel]
 *       properties:
 *         id: { type: integer, description: 'Send the id of an existing connection to keep it (and its networks); a connection left out is deleted' }
 *         name: { type: string, description: 'Unique within the customer' }
 *         channel: { type: string, description: 'A value of the System Configuration list `customer_channel` (e.g. VPN site-to-site)' }
 *         role: { type: string, enum: [primary, backup], nullable: true }
 *         device_id: { type: integer, nullable: true, description: 'Our FW / VPN gateway / router (device id)' }
 *         device_name: { type: string, readOnly: true }
 *         local_ip_id: { type: integer, nullable: true, description: 'Our IP of the connection (an existing IP address id)' }
 *         local_ip: { type: string, readOnly: true }
 *         status: { type: string, enum: [active, inactive], default: active }
 *         start_date: { type: string, format: date, nullable: true }
 *         end_date: { type: string, format: date, nullable: true }
 *         description: { type: string, nullable: true }
 *         networks:
 *           type: array
 *           description: 'IPs / networks of the customer on this connection (their VPN peer / router included): an IPv4 address or a CIDR network (host bits zero). Only entered here: nothing else creates them'
 *           items:
 *             type: object
 *             required: [network]
 *             properties:
 *               id: { type: integer, readOnly: true }
 *               network: { type: string, example: '10.20.0.0/24' }
 *               description: { type: string, nullable: true }
 *     Customer:
 *       type: object
 *       required: [name]
 *       properties:
 *         id: { type: integer, readOnly: true }
 *         name: { type: string, description: Unique }
 *         code: { type: string, nullable: true, description: Unique when set }
 *         type: { type: string, nullable: true, description: 'A value of the System Configuration list `customer_type`' }
 *         status: { type: string, nullable: true, description: 'A value of the System Configuration list `customer_status`' }
 *         unit_id: { type: integer, nullable: true, description: Unit in charge }
 *         unit: { type: object, readOnly: true, properties: { id: { type: integer }, name: { type: string } } }
 *         description: { type: string, nullable: true }
 *         attributes:
 *           type: object
 *           additionalProperties: true
 *           description: 'Values of the custom fields declared in System Configuration > Customers (`customer_custom_fields`), by key. An undeclared key is refused; on update only the keys sent change (null or "" empties one)'
 *           example: { sla_level: Gold, contract_end: '2027-12-31' }
 *         owner_ids: { type: array, writeOnly: true, items: { type: integer }, description: 'Our contacts in charge (contact ids)' }
 *         owners: { type: array, readOnly: true, items: { type: object, properties: { id: { type: integer }, name: { type: string }, email: { type: string } } } }
 *         contacts:
 *           type: array
 *           description: The customer's own people
 *           items: { type: object, required: [name], properties: { name: { type: string }, role: { type: string }, email: { type: string }, phone: { type: string } } }
 *         connections: { type: array, items: { $ref: '#/components/schemas/CustomerConnection' } }
 *         updated_by: { type: string, readOnly: true }
 *         updated_at: { type: string, format: date-time, readOnly: true }
 */

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: List customers (search, filters, pagination)
 *     tags: [Customer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: 'Name, code, description, custom field values, contacts, connections, networks' }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: pageSize, schema: { type: integer, maximum: 100 } }
 *       - { in: query, name: type, schema: { type: string }, description: Repeatable }
 *       - { in: query, name: status, schema: { type: string }, description: Repeatable }
 *       - { in: query, name: channel, schema: { type: string }, description: 'Customers with a connection of this channel (repeatable)' }
 *       - { in: query, name: unit_id, schema: { type: integer } }
 *       - { in: query, name: device_id, schema: { type: integer }, description: 'Customers connected through this device' }
 *     responses:
 *       200: { description: '{ data: [Customer], pagination }' }
 *   post:
 *     summary: Create a customer
 *     tags: [Customer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/Customer' } } } }
 *     responses:
 *       201: { description: The created customer }
 *       400: { description: Invalid data }
 *       409: { description: Name or code already used }
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Get a customer with its contacts, connections and networks
 *     tags: [Customer]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       200: { description: The customer }
 *       404: { description: Not found }
 *   put:
 *     summary: Update a customer (partial; contacts / connections / owner_ids, when sent, replace the whole list)
 *     tags: [Customer]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/Customer' } } } }
 *     responses:
 *       200: { description: The updated customer }
 *   delete:
 *     summary: Delete a customer (its contacts, connections, networks and files go with it)
 *     tags: [Customer]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: integer } }]
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/customers', authorizePermissionJWT('customer.read'), apiHandler(async (req, res) => {
  const { search, page, pageSize } = apiPage(req.query);
  const { items, totalCount } = await customerService.listCustomers({
    search, page, pageSize, type: list(req.query.type), status: list(req.query.status), channel: list(req.query.channel),
    unit_id: req.query.unit_id, device_id: req.query.device_id,
  });
  res.json(paginated(items, totalCount, page, pageSize));
}));
router.get('/customers/:id', authorizePermissionJWT('customer.read'), apiHandler(async (req, res) => res.json(await customerService.getCustomer(req.params.id))));
router.post('/customers', authorizePermissionJWT('customer.create'), apiHandler(async (req, res) => {
  res.status(201).json(await customerService.createCustomer({ ...input(req.body), updated_by: apiActor(req) }));
}));
router.put('/customers/:id', authorizePermissionJWT('customer.update'), apiHandler(async (req, res) => {
  res.json(await customerService.updateCustomer(req.params.id, { ...input(req.body), updated_by: apiActor(req) }));
}));
router.delete('/customers/:id', authorizePermissionJWT('customer.delete'), apiHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id);
  res.status(204).end();
}));

export default router;
