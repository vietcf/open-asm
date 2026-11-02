// Agents: shared by the web pages and the REST API.
import Agent from './agent.model.js';
import { catalogService } from '../../shared/catalog.js';

const agents = catalogService(Agent, { entity: 'Agent', columns: ['name', 'version', 'description'], usedBy: 'server(s)' });

export const listAgents = agents.list;
export const getAgent = agents.get;
export const findAgentsByName = agents.findByName;
export const createAgent = agents.create;
export const updateAgent = agents.update;
export const deleteAgent = agents.remove;
export default agents;
