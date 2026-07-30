
import express from 'express';
import { getDashboardStats } from '../services/dashboardService.js';

const router = express.Router();


router.get('/', async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.render('partials/dashboard_content', {
      title: 'Dashboard',
      activeMenu: 'dashboard',
      stats
    });
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
    res.render('partials/dashboard_content', {
      title: 'Dashboard',
      activeMenu: 'dashboard',
      stats: null
    });
  }
});

export default router;
