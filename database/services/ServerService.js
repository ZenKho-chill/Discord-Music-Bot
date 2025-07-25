// Lưu hoặc cập nhật volume cá nhân cho user trong server
// Nếu user chưa có thì thêm mới, có rồi thì cập nhật
async function luuHoacCapNhatVolumeUser(serverId, userId, volume) {
  if (!serverId || !userId || typeof volume !== 'number') throw new Error('Thiếu tham số khi lưu volume user');
  let server = await ServerModel.findOne({ serverId });
  if (!server) {
    server = new ServerModel({ serverId, volumePerUser: [{ userId, volume }] });
    await server.save();
    if (config.debug) console.log(`[ServerService] Đã tạo mới server và lưu volume user: ${userId} - ${volume}`);
    return;
  }
  let found = false;
  if (!Array.isArray(server.volumePerUser)) server.volumePerUser = [];
  for (let i = 0; i < server.volumePerUser.length; i++) {
    if (server.volumePerUser[i].userId === userId) {
      server.volumePerUser[i].volume = volume;
      found = true;
      break;
    }
  }
  if (!found) {
    server.volumePerUser.push({ userId, volume });
  }
  await server.save();
  if (config.debug) console.log(`[ServerService] Đã lưu/cập nhật volume user: ${userId} - ${volume}`);
}
// Service xử lý logic liên quan đến bảng server
// Dùng tiếng Việt cho comment, log, dễ bảo trì, mở rộng

const ServerModel = require('../models/Server');
const config = require('../../config/config');


// Lấy toàn bộ object server
async function layServer(serverId) {
  try {
    return await ServerModel.findOne({ serverId });
  } catch (err) {
    console.error('Lỗi lấy server:', err);
    return null;
  }
}

// Cập nhật volume mặc định cho server
async function capNhatVolumeDefault(serverId, volumeDefault) {
  try {
    let server = await ServerModel.findOne({ serverId });
    if (!server) {
      server = new ServerModel({ serverId, volumeDefault });
    } else {
      server.volumeDefault = volumeDefault;
    }
    await server.save();
    if (config.debug) {
      console.log(`Đã cập nhật volumeDefault cho server ${serverId}: ${volumeDefault}`);
    }
    return server;
  } catch (err) {
    console.error('Lỗi cập nhật volumeDefault server:', err);
    throw err;
  }
}

// Lấy volume cá nhân user trong server
async function layVolumeUser(serverId, userId) {
  try {
    const server = await ServerModel.findOne({ serverId });
    if (!server) return null;
    const user = Array.isArray(server.volumePerUser) ? server.volumePerUser.find(u => u.userId === userId) : null;
    if (user && typeof user.volume === 'number') {
      return user.volume;
    }
    return null;
  } catch (err) {
    console.error('Lỗi lấy volume user:', err);
    return null;
  }
}

// Cập nhật volume cá nhân user trong server
async function capNhatVolumeUser(serverId, userId, volume) {
  try {
    let server = await ServerModel.findOne({ serverId });
    if (!server) {
      server = new ServerModel({ serverId, volumePerUser: [{ userId, volume }] });
    } else {
      let user = server.volumePerUser.find(u => u.userId === userId);
      if (user) {
        user.volume = volume;
      } else {
        server.volumePerUser.push({ userId, volume });
      }
    }
    await server.save();
    if (config.debug) {
      console.log(`Đã cập nhật volume user ${userId} cho server ${serverId}: ${volume}`);
    }
    return server;
  } catch (err) {
    console.error('Lỗi cập nhật volume user:', err);
    throw err;
  }
}

module.exports = {
  layServer,
  capNhatVolumeDefault,
  layVolumeUser,
  capNhatVolumeUser,
  luuHoacCapNhatVolumeUser
};
