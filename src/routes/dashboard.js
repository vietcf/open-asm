const express = require('express');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const config = require('../../config/config');
const requireLogin = require('../middlewares/requireLogin');
const Configuration = require('../models/Configuration');

const router = express.Router();

router.get('/', requireLogin, async (req, res) => {
  const siteConfig = await Configuration.findByKey('site_name');
  const siteName = siteConfig ? siteConfig.value : undefined;
  const content = ejs.render(
    fs.readFileSync(path.join(__dirname, '../../public/html/partials/dashboard_content.ejs'), 'utf8'),
    {
      cssPath: config.cssPath,
      jsPath: config.jsPath,
      imgPath: config.imgPath
    }
  );
  res.render('layouts/layout', {
    cssPath: config.cssPath,
    jsPath: config.jsPath,
    imgPath: config.imgPath,
    body: content,
    title: 'Dashboard',
    activeMenu: 'dashboard',
    user: req.session.user,
    siteName
  });
});

module.exports = router;
