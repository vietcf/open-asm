// REST: /api/v1/agents
import Agent from './agent.model.js';
import agents from './agent.service.js';
import { catalogApi } from '../../shared/catalog.js';

export default catalogApi(Agent, agents, { entity: 'Agent' });
