const express = require('express');
const router = express.Router();

// Import các route modules
const authRoutes = require('./auth');
const pageRoutes = require('./pages');
const apiMusicRoutes = require('./api/music');
const debugRoutes = require('./debug');


const config = require('../../config/config');
// Cho phép logout bằng /logout, redirect sang /auth/logout
router.get('/logout', (req, res) => {
  // Chỉ log khi debug mode bật
  if (config.debug) {
    console.log('➡️ Chuyển hướng /logout sang /auth/logout');
  }
  res.redirect('/auth/logout');
});

// Sử dụng các routes với prefix phù hợp
router.use('/auth', authRoutes);
router.use('/', pageRoutes);
router.use('/api', apiMusicRoutes);
router.use('/debug', debugRoutes);

module.exports = router;
