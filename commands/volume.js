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
const maxVol = require('../config').opt.maxVol;
const db = require('../mongoDB');

module.exports = {
  name: 'volume',
  description: 'Cho phép bạn điều chỉnh âm lượng của nhạc',
  permissions: '0x0000000000000800',
  options: [{
    name: 'volume',
    description: 'Nhập số để điều chỉnh âm lượng',
    type: ApplicationCommandOptionType.Integer,
    required: true
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true });
      }

      const vol = parseInt(interaction.options.getInteger('volume'));

      if (!vol) {
        return interaction.reply({
          content: `Âm lượng hiện tại: **${queue.volume}** 🔊\nĐể thay đổi âm lượng, nhập số từ \`1\` đến \`${maxVol}\``,
          ephemeral: true
        });
      }

      if (queue.volume === vol) {
        return interaction.reply({ content: `Âm lượng hiện tại đã được đặt là **${vol}**`, ephemeral: true });
      }

      if (vol < 1 || vol > maxVol) {
        return interaction.reply({
          content: `Vui lòng nhập số từ \`1\` đến \`${maxVol}\``,
          ephemeral: true
        });
      }

      const success = queue.setVolume(vol);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#d291fe')
          .setAuthor({
            name: 'Nhạc của bạn! Quyết định của bạn',
            iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
            url: 'https://zenkho.top'
          })
          .setDecription(`**Điều chỉnh âm lượng: ** **${vol}/${maxVol}**`);
        return interaction.reply({ embeds: [embed] });
      } else {
        return interaction.reply({ content: '❌ Đã xảy ra lỗi khi thay đổi âm lượng', ephemeral: true });
      }
    } catch (e) {
      console.error(e);
    }
  },
};