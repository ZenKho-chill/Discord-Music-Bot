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

const db = require('../../mongoDB');
const { EmbedBuilder } = require('discord.js');

module.exports = async (client, queue, song) => {
  if (queue) {
    if (!client.config.opt.loopMessage && queue?.repeatMode !== 0) return;
    if (queue?.textChannel) {
      const embed = new EmbedBuilder()
        .setAuthor({
          name: 'Đang phát nhạc',
          iconURL: 'https://cdn.discordapp.com/attachments/1140841446228897932/1144671132948103208/giphy.gif?ex=6845bb91&is=68446a11&hm=1a8b5d3a57f87560587f0ee8b06df017079574da2e949728683543b9457a973f&',
          url: 'https://zenkho.top'
        })
        .setDescription(`\n ‎ \n▶️ ** Chi tiết :** **${song?.name}**\n▶️ **Tận hưởng trải nghiệm âm nhạc tuyệt vời.**\n▶️ **Nếu link bị hỏng, thử nhập lại truy vấn.**`)
        .setImage(queue.songs[0].thumbnail)
        .setColor('#FF0000')

      queue?.textChannel?.send({ embeds: [embed] }).catch(e => { });
    }
  }
}