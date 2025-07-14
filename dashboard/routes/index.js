const express = require('express');
const router = express.Router();

// Import các route modules
const authRoutes = require('./auth');
const pageRoutes = require('./pages');
const apiTestRoutes = require('./api/test');
const apiMusicRoutes = require('./api/music');
const debugRoutes = require('./debug');

// Sử dụng các routes với prefix phù hợp
router.use('/auth', authRoutes);
router.use('/', pageRoutes);
router.use('/api', apiTestRoutes);
router.use('/api', apiMusicRoutes);
router.use('/debug', debugRoutes);

module.exports = router;
