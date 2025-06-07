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

module.exports = {
  name: 'previous',
  description: 'Phát lại bài hát trước đó',
  permissions: '0x0000000000000800',
  options: [],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Không có bài hát nào đang phát', ephemeral: true }).catch(e => { });

      try {
        let song = await queue.previous();
        interaction.reply({ content: '**Hãy lắng nghe giai điệu kỳ diệu của quá khứ**'}).catch(e => { });
      } catch (e) {
        return interaction.reply({ content: '❌ Không có bài hát trước đó', ephemeral: true }).catch(e => { });
      }
    } catch (e) {
      console.error(e);
    }
  },
};