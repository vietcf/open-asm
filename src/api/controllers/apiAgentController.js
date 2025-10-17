import Agent from '../../models/Agent.js';

const apiAgentController = {};

// List all agents
apiAgentController.listAgents = async (req, res) => {
  try {
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
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    res.json({
      success: true,
      data: agent
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Create a new agent
apiAgentController.createAgent = async (req, res) => {
  try {
    const { name, version, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Agent name is required'
      });
    }
    
    const agent = await Agent.create({
      name: name.trim(),
      version: version ? version.trim() : null,
      description: description ? description.trim() : null
    });
    
    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: agent
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        message: 'Agent name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Update an agent
apiAgentController.updateAgent = async (req, res) => {
  try {
    const { name, version, description } = req.body;
    
    // Check if agent exists first
    const existingAgent = await Agent.findById(req.params.id);
    if (!existingAgent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    // Prepare update data - only update fields that are provided
    const updateData = {};
    
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Agent name cannot be empty'
        });
      }
      updateData.name = name.trim();
    }
    
    if (version !== undefined) {
      updateData.version = version ? version.trim() : null;
    }
    
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }
    
    // If no fields to update, return current agent
    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'No changes made',
        data: existingAgent
      });
    }
    
    const agent = await Agent.update(req.params.id, updateData);
    res.json({
      success: true,
      message: 'Agent updated successfully',
      data: agent
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        message: 'Agent name already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Delete an agent
apiAgentController.deleteAgent = async (req, res) => {
  try {
    // Check if agent exists
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    await Agent.delete(req.params.id);
    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (err) {
    if (err.message && err.message.includes('in use')) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete: This agent is in use'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

// Find agents by exact name match
apiAgentController.findAgents = async (req, res) => {
  try {
    const { name } = req.query;

    // Require search term
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search term "name" is required'
      });
    }

    // Use exact name matching
    const agents = await Agent.findByNameExact(name.trim());

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
