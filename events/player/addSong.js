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

const db = require("../../mongoDB");
const { EmbedBuilder } = require("discord.js");

module.exports = async (client, queue, song) => {
  if (queue) {
    if (!client.config.opt.loopMessage && queue?.repeatMode !== 0) return;
    if (queue?.textChannel) {
      const embed = new EmbedBuilder()
        .setAuthor({
          name: 'Đã Thêm Vào Hàng Đợi',
          iconURL: 'https://cdn.discordapp.com/attachments/1140841446228897932/1144671132948103208/giphy.gif?ex=68470d11&is=6845bb91&hm=ff4edc729f7952776b6bad94636a4f7591d9f06785b8c98dbeea886701e94387&', 
          url: 'https://zenkho.top'
        })
        .setDescription(`<@${song.user.id}>, **${song.name}**`)
        .setColor('#14bdff')
        .setFooter({ text: 'Sử dụng /queue để biết thêm thông tin' });
      queue?.textChannel?.send({ embeds: [embed] }).catch(e => { });
    }
  }
}
