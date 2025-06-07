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

const { url } = require('inspector');
const db = require('../mongoDB');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    description: 'Xóa sạch hàng chờ nhạc.',
    permissions: '0x0000000000000800',
    options: [],
    voiceChannel: true,
    run: async (client, interaction) => {
        const queue = client.player.getQueue(interaction.guild.id);

        try {
            if (!queue || !queue.playing) {
                return interaction.reply({ content: '⚠️ Hiện không có bài nhạc nào đang phát!', ephemeral: true });
            }

            if (!queue.songs[0]) {
                return interaction.reply({ content: '❌ Hàng chờ đang trống!', ephemeral: true });
            }

            await queue.stop(interaction.guild.id);

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({
                    name: '🔄 Đã xóa hàng chờ',
                    iconUR: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
                    url: 'https://zenkho.top'
                })
                .setDescription('**✅ Hàng chờ đã được xóa! Sẵn sàng cho hành trình âm nhạc mới.**')

            interaction.reply({ embeds: [embed] });
        } catch (e) {
            console.error(e);
        }
    },
};