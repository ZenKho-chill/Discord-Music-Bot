/*
 * This file is part of Discord Music Bot.
 *
 * Discord Music Bot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Discord Music Bot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Discord Music Bot.  If not, see <https://www.gnu.org/licenses/>.
 */

const config = require('../config');
const { ActivityType } = require('discord.js');
module.exports = async (client) => {
  if (config.mongodbURL || process.env.MONGO) {
    const { REST } = require("@discordjs/rest");
    const { Routes } = require("discord-api-types/v10");
    const rest = new REST({ version: '10' }).setToken(config.TOKEN || process.env.TOKEN);
    (async () => {
      try {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: await client.commands,
        });
        console.log('\x1b[36m%s\x1b[0m', '|    🚀 Đã tải lệnh ')
      } catch (err) {
        console.log('\x1b[36m%s\x1b[0m', '|     🚀 Ngưng tải lệnh');
        console.error(err);
      }
    })();
    console.log('\x1b[32m%s\x1b[0m', `|     🌼 Đăng nhập với ${client.user.username}`);
    setInterval(() => client.user.setActivity({
      name: `Nghe nhạc chill chill... Dùng '/help' nhé!`,
      type: ActivityType.Watching
    }), 10000);
  } else {
    console.log('\x1b[36m%s\x1b[0m', '|     🍔 Lỗi mongoDB')
  }
  console.log('\x1b[36m%s\x1b[0m', '|     🎯 Bot đã khởi động thành công!');

  if (client.config.voteManager.status === true && client.config.voteManager.api_key) {
    const { AutoPoster } = require('toggle-autoposter')
    const ap = AutoPoster(client.config.voteManager.api_key, client)
    ap.on('posted', () => { })
  }
}