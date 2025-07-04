const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config/config');

module.exports = async (client) => {
  // Load Slash Commands
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log("[⏳] Đăng ký slash command...");
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    console.log("[✔] Slash command đã được đăng ký! Có thể mất vài phút để hiển thị.\nNếu không thấy, hãy thử Ctrl + R trong Discord.");
  } catch (err) {
    console.error('[❌] Lỗi khi đăng ký slash command', err);
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
