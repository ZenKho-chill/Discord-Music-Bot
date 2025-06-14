/*
 * Tệp này là một phần của Discord Music Bot.
 *
 * Discord Music Bot là phần mềm miễn phí: bạn có thể phân phối lại hoặc sửa đổi
 * theo các điều khoản của Giấy phép Công cộng GNU được công bố bởi
 * Tổ chức Phần mềm Tự do, phiên bản 3 hoặc (nếu bạn muốn) bất kỳ phiên bản nào sau đó.
 *
 * Discord Music Bot được phân phối với hy vọng rằng nó sẽ hữu ích,
 * nhưng KHÔNG CÓ BẢO HÀNH; thậm chí không bao gồm cả bảo đảm
 * VỀ TÍNH THƯƠNG MẠI hoặc PHÙ HỢP CHO MỘT MỤC ĐÍCH CỤ THỂ. Xem
 * Giấy phép Công cộng GNU để biết thêm chi tiết.
 *
 * Bạn sẽ nhận được một bản sao của Giấy phép Công cộng GNU cùng với Discord Music Bot.
 * Nếu không, hãy xem <https://www.gnu.org/licenses/>.
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