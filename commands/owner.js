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

const { ApplicationCommandOptionType } = rquire('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'owner',
  description: 'Lấy thông tin của người chủ sở hữu bot',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const { EmbedBuilder } = require('discord.js')
      const embed = new EmbedBuilder()
        .setColor('#da2a41')
        .setAuthor({
          name: 'Chủ sở hữu',
          iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
          url: 'https://zenkho.top'
        })
        .setDescription('__**About me**__:\n\n ▶️ Tôi là Bot âm nhạc được làm bởi ZenKho')
        .setTimestamp();
      interaction.reply({ embeds: [embed] }).catch(e => {});
    } catch (e) {
      console.error(e);
    }
  },
};