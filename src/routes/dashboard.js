
import express from 'express';

const router = express.Router();


router.get('/', (req, res) => {
  res.render('partials/dashboard_content', {
    title: 'Dashboard',
    activeMenu: 'dashboard'
  });
});

export default router;
