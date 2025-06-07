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

const db = require('../mongoDB');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'resume',
  description: 'Tiếp tục bài hát đã tạm dừng',
  permissions: '0x0000000000000800',
  options: [],
  voiceChannel: true,
  run: async (client, interaction) => {
    const queue = client.player.getQueue(interaction.guild.id);

    try {
      if (!queue) {
        return interaction.reply({ content: '⚠️ Hàng đợi trống', ephemeral: true });
      }

      if (!queue.paused) {
        return interaction.reply({ content: '⚠️ Không có bài hát nào đang tạm dừng', ephemeral: true });
      }

      const success = queue.resume();

      const embed = new EmbedBuilder()
        .setColor('#7645fe')
        .setAuthor({
          name: 'Bài hát đã được tiếp tục',
          iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
          url: 'https://zenkho.top'
        })
        .setDescription(success ? '**Bài hát đã được tiếp tục**' : '❌ Lỗi: Không thể tiếp tục bài hát');

      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi trong khi tiếp tục bài hát', ephemeral: true });
    }
  },
};