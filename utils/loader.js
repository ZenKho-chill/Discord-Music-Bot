const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

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
          console.log(`[Loader] ✅ Đã tải lệnh: ${command.data.name}`);
        }
      }
    } catch (error) {
      console.error(`[Loader] ❌ Lỗi khi tải lệnh ${file}:`, error.message);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    if (config.registerCommands) {
      console.log("[⏳] Đăng ký slash command...");
      
      // Xóa tất cả lệnh cũ trước nếu registerCommands là true
      console.log("[🗑️] Xóa tất cả lệnh cũ...");
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: [] }
      );
      
      if (config.debug) {
        console.log(`[Loader] 📋 Tìm thấy ${commands.length} lệnh để đăng ký`);
      }
      
      // Đăng ký lệnh mới
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      
      console.log(`[✔] Đã đăng ký ${commands.length} slash command! Có thể mất vài phút để hiển thị.`);
      console.log("Nếu không thấy, hãy thử Ctrl + R trong Discord.");
    } else {
      if (config.debug) {
        console.log("[Loader] ⏭️ Bỏ qua đăng ký lệnh (registerCommands: false)");
      }
    }
  } catch (err) {
    console.error('[❌] Lỗi khi đăng ký slash command:', err);
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
        console.log(`[Loader] 🎵 Đã tải DisTube events`);
      }
      continue;
    }
    
    // Regular Discord events
    const event = require(filePath);
    const eventName = file.split('.')[0];
    client.on(eventName, (...args) => event(client, ...args));
    if (config.debug) {
      console.log(`[Loader] 🎯 Đã tải event: ${eventName}`);
    }
  }
};
