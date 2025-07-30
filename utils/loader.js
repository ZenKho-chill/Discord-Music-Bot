const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('./logger');

module.exports = async (client) => {
  // Lấy cấu hình hiện tại (hỗ trợ tải động)
  const getConfig = () => {
    try {
      // Xóa bộ nhớ đệm để lấy config mới nhất
      delete require.cache[require.resolve('../config/config')];
      return require('../config/config');
    } catch (error) {
      return require('../config/config');
    }
  };

  const config = getConfig();

  // Tải các lệnh Slash
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      // Xóa bộ nhớ đệm cho tải động
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);

      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        if (config.debug) {
          if (config.debug) {
            logger.debug(`[Trình tải] ✅ Đã tải lệnh: ${command.data.name}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Trình tải] ❌ Lỗi khi tải lệnh ${file}:`, error.message);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    if (config.registerCommands) {
      logger.core("[⏳] Đang đăng ký lệnh slash...");

      // Xóa tất cả lệnh cũ trước nếu registerCommands là true
      logger.debug("[🗑️] Xóa tất cả lệnh cũ...");
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: [] }
      );

      if (config.debug) {
        logger.debug(`[Trình tải] 📋 Tìm thấy ${commands.length} lệnh để đăng ký`);
      }

      // Đăng ký lệnh mới
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );

      logger.core(`[✔] Đã đăng ký ${commands.length} lệnh slash! Có thể mất vài phút để hiển thị.`);
      logger.core("Nếu không thấy, hãy thử Ctrl + R trong Discord.");
    } else {
      if (config.debug) {
        logger.debug("[Trình tải] ⏭️ Bỏ qua đăng ký lệnh (registerCommands: false)");
      }
    }
  } catch (err) {
    console.error('[❌] Lỗi khi đăng ký lệnh slash:', err);
  }

  // Tải các sự kiện
  const eventsPath = path.join(__dirname, '../events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);

    // Special handling for DisTube events
    if (file === 'distubeEvents.js') {
      const distubeEvents = require(filePath);
      distubeEvents(client);
      if (config.debug) {
        logger.debug(`[Trình tải] 🎵 Đã tải sự kiện DisTube`);
      }
      continue;
    }

    // Regular Discord events
    const event = require(filePath);
    const eventName = file.split('.')[0];
    client.on(eventName, (...args) => event(client, ...args));
    if (config.debug) {
      logger.debug(`[Trình tải] 🎯 Đã tải sự kiện: ${eventName}`);
    }
  }
};
