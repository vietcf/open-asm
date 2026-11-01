// REST: /api/v1/tags ({ success, data, message } envelope)
import * as tagService from './tag.service.js';
import { apiHandler, apiPage, handleServiceError } from '../../shared/api.js';

const handler = (fn) => apiHandler(fn, handleServiceError);
const tagId = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) res.status(400).json({ success: false, message: 'Invalid tag ID' });
  return Number.isInteger(id) ? id : null;
};

export default {
  getAllTags: handler(async (req, res) => {
    const data = await tagService.getAllTags();
    res.json({ success: true, data, count: data.length });
  }),

  // ?name= exact (case-insensitive) match
  findTags: handler(async (req, res) => {
    if (!req.query.name) return res.status(400).json({ success: false, message: 'Search term "name" is required' });
    const data = await tagService.findTagsByName(req.query.name);
    res.json({ success: true, data, count: data.length });
  }),

  searchTags: handler(async (req, res) => {
    const { search, page, pageSize } = apiPage({ pageSize: 20, ...req.query });
    const { items, totalCount } = await tagService.listTags({ search, page, pageSize });
    const totalPages = Math.ceil(totalCount / pageSize);
    res.json({
      success: true, data: items,
      pagination: { page, pageSize, totalItems: totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      search: { query: search, sortBy: 'name', sortOrder: 'asc' },
    });
  }),

  getTagById: handler(async (req, res) => {
    const id = tagId(req, res);
    if (id !== null) res.json({ success: true, message: 'Tag retrieved successfully', data: await tagService.getTag(id) });
  }),

  createTag: handler(async (req, res) => {
    res.status(201).json({ success: true, message: 'Tag created successfully', data: await tagService.createTag(req.body || {}) });
  }),

  updateTag: handler(async (req, res) => {
    const id = tagId(req, res);
    if (id !== null) res.json({ success: true, message: 'Tag updated successfully', data: await tagService.updateTag(id, req.body || {}) });
  }),

  deleteTag: handler(async (req, res) => {
    const id = tagId(req, res);
    if (id === null) return;
    await tagService.deleteTag(id);
    res.json({ success: true, message: 'Tag deleted successfully' });
  }),
};
