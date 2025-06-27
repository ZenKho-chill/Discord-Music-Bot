const config = require('../config/config');

module.exports = async (client, message) => {
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    command.execute(client, message, args);
  } catch (err) {
    console.error(err);
    message.reply('Đã xảy ra lỗi khi xử lý lệnh.');
  }
};