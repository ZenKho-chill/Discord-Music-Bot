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

const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const db = require('../mongoDB');

module.exports = {
  name: 'shuffle',
  description: 'Xáo trộn dang sách nhạc trong hàng chờ',
  options: [],
  permissions: '0x0000000000000800',
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);

      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc nào đang phát', ephemeral: true }).catch(e => { });
      }

      try {
        queue.shuffle();
        return interaction.reply({ content: `<@${interaction.user.id}>, Đã xáo trộn danh sách nhạc cho bạn!! 🎶` }).catch(e => { });
      } catch (err) {
        console.error('Lỗi khi xáo trộn:', err);
        return interaction.reply({ content: `❌ Lỗi xảy ra khi cố gắng xáo trộn nhạc: **${err.message}**`, ephemeral: true }).catch(e => { });
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi không xác định', ephemeral: true }).catch(e => { });
    }
  },
};