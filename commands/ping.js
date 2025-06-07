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
  name: 'ping',
  description: 'Kiểm tra độ trễ của bot',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const start = Date.now();
      interaction.reply('Đang ping...').then(msg => {
        const end = Date.now();
        const embed = new EmbedBuilder()
          .setColor('#6190ff')
          .setTitle('Độ trễ của bot')
          .setDescription(`**Pong** : ${end-start}ms`)
        return interaction.editReply({ embeds: [embed] }).catch(e => { });
      }).catch(err => { })
    } catch (e) {
      console.error(e);
    }
  },
};