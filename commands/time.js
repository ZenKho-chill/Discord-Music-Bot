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

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'time',
  description: 'Hiển thị thời gian hiện dại trong bài hát đang phát',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true }).catch(e => { });
      let music_percent = queue.duration / 100;
      let music_percent2 = queue.currentTime / music_percent;
      let music_percent3 = Math.round(music_percent2);

      const embed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setTitle(queue.songs[0].name)
        .setThumbnail(queue.songs[0].thumbnail)
        .setDescription(`**${queue.formattedCurrentTime} / ${queue.formattedDuration} (${music_percent3}%)**`);

      interaction.reply({ embeds: [embed] }).catch(e => { });
    } catch (e) {
      console.error(e);
    }
  },
};