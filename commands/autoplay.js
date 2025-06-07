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
    name: 'autoplay',
    description: 'Bật/tắt chế độ tự động phát nhạc khi hết hàng chờ',
    options: [],
    permissions: '0x0000000000000800',
    run: async (client, interaction) => {
        try {
            const queue = client?.player?.getQueue(interaction?.guild?.id);
            if (!queue || !queue?.playing) {
                return interaction?.reply({ content: '⚠️ Hiện không có bài nhạc nào đang phát!', ephemeral: true });
            }

            queue?.toggleAutoplay();

            const embed = new EmbedBuilder()
                .setColor('#2f58fe')
                .setTitle('🎶 Phát nhạc theo ý bạn!')
                .setDescription(queue?.autoplay ? '**✅ Tự động phát: BẬT**' : '**❌ Tự động phát: TẮT**')

            interaction?.reply({ embeds: [embed] });
        } catch (e) {
            console.error(e);
        }
    },
};