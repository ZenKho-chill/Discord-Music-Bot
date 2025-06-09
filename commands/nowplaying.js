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
const db = require('../mongoDB');
module.exports = {
  name: 'nowplaying',
  description: 'Lấy thông tin bài hát đang phát.',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })

      const track = queue.songs[0];
      if (!track) return interaction.reply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })

      const embed = new EmbedBuilder();
      embed.setColor(client.config.embedColor);
      embed.setThumbnail(track.thumbnail);
      embed.setTitle(track.name)
      embed.setDescription(`
        > **Âm lượng** \`${queue.volume}\`
        > **Thời gian:** \`${track.formattedDuration}\`
        > **URL** [Link bài hát](${track.url})
        > **Chế độ lặp:** \`${queue.repeatMode ? (queue.repeatMode === 2 ? 'Lặp tất cả' : 'Lặp bài này') : 'Tắt'}\`
        > **Lọc âm thanh** \`${queue.filters.names.join(', ') || 'Tắt'}\`
        > **Người yêu cầu:** <@${track.user.id}>
        `);

      interaction.reply({ embeds: [embed] }).catch(e => {console.error(e)})
    } catch (E) {
      console.error(e);
    }
  },
};