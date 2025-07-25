
// API quản lý cài đặt server (volume mặc định, volume từng user...)
// Dùng tiếng Việt cho comment, log, tuân thủ coding guidelines

const express = require('express');
const { isAuthenticated } = require('../middleware');
const config = require('../../../config/config');
const ServerService = require('../../../database/services/ServerService');
const router = express.Router();

// API cập nhật volume cá nhân user (dùng cho dashboard, nhận body guildId, userId, volume)
router.post('/volume-user', isAuthenticated, async (req, res) => {
  try {
    const { guildId, userId, volume } = req.body;
    if (!guildId || !userId || typeof volume !== 'number' || volume < 0 || volume > 150) {
      return res.status(400).json({ error: 'Dữ liệu truyền lên không hợp lệ' });
    }
    const server = await ServerService.capNhatVolumeUser(guildId, userId, volume);
    res.json({ success: true, volume });
  } catch (err) {
    console.error('Lỗi cập nhật volume user (dashboard):', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lấy volume mặc định của server
router.get('/volume-default/:serverId', isAuthenticated, async (req, res) => {
  try {
    const serverId = req.params.serverId;
    const server = await ServerService.layServer(serverId);
    res.json({
      serverId,
      volumeDefault: server ? server.volumeDefault : 50
    });
  } catch (err) {
    console.error('Lỗi lấy volume mặc định server:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Cập nhật volume mặc định server (chỉ admin mới được phép, kiểm tra ở middleware hoặc frontend)
router.post('/volume-default/:serverId', isAuthenticated, async (req, res) => {
  try {
    const serverId = req.params.serverId;
    const { volumeDefault } = req.body;
    if (typeof volumeDefault !== 'number' || volumeDefault < 0 || volumeDefault > 150) {
      return res.status(400).json({ error: 'Giá trị volume không hợp lệ' });
    }
    const server = await ServerService.capNhatVolumeDefault(serverId, volumeDefault);
    res.json({ success: true, volumeDefault: server.volumeDefault });
  } catch (err) {
    console.error('Lỗi cập nhật volume mặc định server:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lấy volume cá nhân user trong server
router.get('/volume-user/:serverId/:userId', isAuthenticated, async (req, res) => {
  try {
    const { serverId, userId } = req.params;
    const volume = await ServerService.layVolumeUser(serverId, userId);
    res.json({ serverId, userId, volume });
  } catch (err) {
    console.error('Lỗi lấy volume user:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Cập nhật volume cá nhân user trong server
router.post('/volume-user/:serverId/:userId', isAuthenticated, async (req, res) => {
  try {
    const { serverId, userId } = req.params;
    const { volume } = req.body;
    if (typeof volume !== 'number' || volume < 0 || volume > 150) {
      return res.status(400).json({ error: 'Giá trị volume không hợp lệ' });
    }
    const server = await ServerService.capNhatVolumeUser(serverId, userId, volume);
    res.json({ success: true, volume });
  } catch (err) {
    console.error('Lỗi cập nhật volume user:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

module.exports = router;
