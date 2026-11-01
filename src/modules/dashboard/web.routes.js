// Web routes of the Dashboard, mounted at /dashboard (any signed-in user;
// each section is shown only with its read permission).
import express from 'express';
import { getDashboardStats } from './dashboard.service.js';
import { page } from '../../shared/web.js';

const router = express.Router();

router.get('/', page(async (req, res) => {
  let stats = null;
  try {
    stats = await getDashboardStats(res.locals.hasPermission);
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
  res.render('pages/dashboard/dashboard', { stats, title: 'Dashboard', activeMenu: 'dashboard' });
}));

export default router;
