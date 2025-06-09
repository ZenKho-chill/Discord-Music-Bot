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

const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'seek',
  description: 'Nhảy đến một timestamp cụ thế trong bài hát',
  permissions: '0x0000000000000800',
  options: [{
    name: 'time',
    description: 'Nhập timestamp để nhảy đến (ví dụ: 2:40)',
    type: ApplicationCommandOptionType.String,
    required: true
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true }).catch(e => { });
      }

      let time = interaction.options.getString('time');
      let position = getSeconds(time);

      if (isNaN(position)) {
        return interaction.reply({ content: '⚠️ Lỗi cú pháp: Vui lòng nhập thời gian theo định dạng đúng (ví dụ 2:40)', ephemeral: true }).catch(e => { });
      }

      queue.seek(position);

      return interaction.reply({ content: `▶️ **Đang nhảy đến timestamp ${time} trong bài hát**` }).catch(e => { });
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi', ephemeral: true });
    }
  },
};

function getSeconds(str) {
  if (!str) {
    return 0;
  }

  var parts = str.split(':');
  var seconds = 0;
  var factor = 1;

  while (parts.length > 0) {
    seconds += factor * parseInt(parts.pop(), 10);
    factor *= 60;
  }

  return seconds;
}