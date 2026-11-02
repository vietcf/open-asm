// Services (the server catalog entry): shared by the web pages and the REST API.
import Service from './service.model.js';
import { catalogService } from '../../shared/catalog.js';

const services = catalogService(Service, { entity: 'Service', columns: ['name', 'description'], usedBy: 'server(s)' });

export const listServices = services.list;
export const getService = services.get;
export const findServicesByName = services.findByName;
export const createService = services.create;
export const updateService = services.update;
export const deleteService = services.remove;
export default services;
