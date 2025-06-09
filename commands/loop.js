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
    name: 'loop',
    description: 'Bật hoặc tắt chế độ lặp lại nhạc',
    permissions: '0x0000000000000800',
    options: [],
    voiceChannel: true,
    run: async (client, interaction) => {
        try {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const queue = client.player.getQueue(interaction.guild.id);
            if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })

            let button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setLabel('Lặp toàn bộ')
                  .setStyle(ButtonStyle.Secondary)
                  .setCustomId('queue'),
                new ButtonBuilder()
                  .setLabel('Lặp 1 bài')
                  .setStyle(ButtonStyle.Secondary)
                  .setCustomId('nowplaying'),
                new ButtonBuilder()
                  .setLabel('Tắt lặp')
                  .setStyle(ButtonStyle.Danger)
                  .setCustomId('close')
            )

            const embed = new EmbedBuilder()
              .setColor('#fc4e03')
              .setAuthor({
                name: 'Chế độ lặp nhạc',
                iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
                url: 'https://zenkho.top'
              })
              .setDescription('**Đang lặp lại nhạc! Cùng quẩy tới bến nào! 🎶**')

            interaction?.reply({ embeds: [embed], components: [button], fetchReply: true }).then(async Message => {

              const filter = i => i.user.id === interaction.user.id
              let col = await Message.createMessageComponentCollector({ filter, time: '120000' });

              col.on('collect', async (button) => {
                if (button.user.id !== interaction.user.id) return
                const queue1 = client.player.getQueue(interaction.guild.id);
                if (!queue1 || !queue1.playing) {
                  await interaction?.editReply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })
                  await button?.deferUpdate().catch(e => { })
                }
                switch (button.customId) {
                  case 'queue':
                    queue.setRepeatMode(2);
                    interaction?.editReply({ content: '✅ Đã bật chế độ **Lặp Toàn Bộ**! 🔄' }).catch(e => { })
                    await button?.deferUpdate().catch(e => { })
                    break
                  case 'nowplaying':
                    queue.setRepeatMode(1);
                    interaction?.editReply({ content: '✅ Đã bật chế độ **Lặp 1 bài**! 🔄' }).catch(e => { })
                    await button?.deferUpdate().catch(e => { })
                    break
                  case 'close':
                    if (queue.repeatMode === 0) {
                      await button?.deferUpdate().catch(e => { })
                      return interaction?.editReply({ content: '⚠️ Chế độ lặp lại tắt sẵn rồi!', ephemeral: true }). catch(e => { })
                    }
                    queue.setRepeatMode(0);
                    interaction?.editReply({ content: '▶️ Đã tắt chế độ lặp!' }).catch(e => { })
                    await button?.deferUpdate().catch(e => { })
                    break
                }
              })
              col.on('end', async () => {
                let timeoutButton = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel('Hết thời gian')
                    .setCustomId('timeend')
                    .setDisabled(true))

                const embed = new EmbedBuilder()
                  .setColor('#fc5203')
                  .setTitle('▶️ Đã tắt chế độ lặp!')
                  .setTimestamp()

                await interaction?.editReply({ content: '', embeds: [embed], components: [timeoutButton] }).catch(e => { });
              })
            }).catch(e => {console.error(e)})
        } catch (e) {
          console.error(e);
        }
    }
}