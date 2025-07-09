const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = async (client) => {
  // Get current config (support hot reload)
  const getConfig = () => {
    try {
      // Clear cache to get latest config
      delete require.cache[require.resolve('../config/config')];
      return require('../config/config');
    } catch (error) {
      return require('../config/config');
    }
  };

  const config = getConfig();

  // Load Slash Commands
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      // Clear cache for hot reload
      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);
      
      if (command.data && command.data.name) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        if (config.debug) {
          console.log(`[Loader] ✅ Loaded command: ${command.data.name}`);
        }
      }
    } catch (error) {
      console.error(`[Loader] ❌ Error loading command ${file}:`, error.message);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    if (config.registerCommands) {
      console.log("[⏳] Đăng ký slash command...");
      
      // Clear all existing commands first if registerCommands is true
      console.log("[🗑️] Xóa tất cả command cũ...");
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: [] }
      );
      
      if (config.debug) {
        console.log(`[Loader] 📋 Found ${commands.length} commands to register`);
      }
      
      // Register new commands
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      
      console.log(`[✔] Đã đăng ký ${commands.length} slash command! Có thể mất vài phút để hiển thị.`);
      console.log("Nếu không thấy, hãy thử Ctrl + R trong Discord.");
    } else {
      if (config.debug) {
        console.log("[Loader] ⏭️ Bỏ qua đăng ký command (registerCommands: false)");
      }
    }
  } catch (err) {
    console.error('[❌] Lỗi khi đăng ký slash command:', err);
  }

  // Load Events
  const eventsPath = path.join(__dirname, '../events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    const eventName = file.split('.')[0];
    client.on(eventName, (...args) => event(client, ...args));
  }
};
