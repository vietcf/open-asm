import Agent from './agent.model.js';
import {
  getAgent as getAgentService,
  findAgentsByName,
  createAgent as createAgentService,
  updateAgent as updateAgentService,
  deleteAgent as deleteAgentService
} from './agent.service.js';
import { handleServiceError } from '../../shared/api.js';

const apiAgentController = {};

// List all agents
apiAgentController.listAgents = async (req, res) => {
  try {
    // Unbounded — no pagination in the original contract, so this stays a
    // direct model call rather than routing through the paginated service.
    const agents = await Agent.findAll();
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Get a single agent by id
apiAgentController.getAgent = async (req, res) => {
  try {
    const agent = await getAgentService(req.params.id);
    res.json({
      success: true,
      data: agent
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Create a new agent
apiAgentController.createAgent = async (req, res) => {
  try {
    const agent = await createAgentService(req.body || {});
    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: agent
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Update an agent
apiAgentController.updateAgent = async (req, res) => {
  try {
    const agent = await updateAgentService(req.params.id, req.body || {});
    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: agent
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Delete an agent
apiAgentController.deleteAgent = async (req, res) => {
  try {
    await deleteAgentService(req.params.id);
    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (err) {
    handleServiceError(err, res);
  }
};

// Find agents by exact name match
apiAgentController.findAgents = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    const agents = await findAgentsByName(name.trim());

    res.json({
      success: true,
      data: agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Error finding agents:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const listAgents = apiAgentController.listAgents;
export const getAgent = apiAgentController.getAgent;
export const createAgent = apiAgentController.createAgent;
export const updateAgent = apiAgentController.updateAgent;
export const deleteAgent = apiAgentController.deleteAgent;
export const findAgents = apiAgentController.findAgents;

export default apiAgentController;
