// Service xử lý logic liên quan đến bảng server
// Dùng tiếng Việt cho comment, log, dễ bảo trì, mở rộng

const ServerModel = require('../models/Server');
const config = require('../../config/config');

// Hàm lấy volume của server (MongoDB)
async function layVolume(serverId) {
  try {
    const server = await ServerModel.findOne({ serverId });
    return server ? server.volume : 50; // Mặc định 50 nếu chưa có
  } catch (err) {
    console.error('Lỗi lấy volume server:', err);
    return 50;
  }
}

// Hàm cập nhật volume cho server (MongoDB)
async function capNhatVolume(serverId, volume) {
  try {
    let server = await ServerModel.findOne({ serverId });
    if (!server) {
      server = new ServerModel({ serverId, volume });
      await server.save();
      if (config.debug) {
        console.log(`Đã tạo server mới: ${serverId}, volume: ${volume}`);
      }
    } else {
      server.volume = volume;
      await server.save();
      if (config.debug) {
        console.log(`Đã cập nhật volume cho server ${serverId}: ${volume}`);
      }
    }
    return server;
  } catch (err) {
    console.error('Lỗi cập nhật volume server:', err);
    throw err;
  }
}

module.exports = { layVolume, capNhatVolume };
