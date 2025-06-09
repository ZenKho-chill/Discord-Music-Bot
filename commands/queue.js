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

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'queue',
  description: 'Hiển thị danh sách hàng đợi các bài hát',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Không có bài hát nào đang phát', ephemeral: true }).catch(e => { });
      if (!queue.songs[0]) return interaction.reply({ content: '⚠️ Hàng đợi trống', ephemeral: true }).catch(e => { });

      const trackl = [];
      queue.songs.map(async (track, i) => {
        trackl.push({
          title: track.name,
          author: track.uploader.name,
          user: track.user,
          url: track.url,
          duration: track.duration
        });
      });

      const backId = 'emojiBack';
      const forwardId = 'emojiForward';
      const backButton = new ButtonBuilder({
        style: ButtonStyle.Secondary,
        emoji: '⬅️',
        customId: backId
      });

      const deleteButton = new ButtonBuilder({
        style: ButtonStyle.Secondary,
        emoji: '❌',
        customId: 'close'
      });

      const forwardButton = new ButtonBuilder({
        style: ButtonStyle.Secondary,
        emoji: '➡️',
        customId: forwardId
      });

      let kactane = 8;
      let page = 1;
      let a = trackl.length / kactane;

      const generateEmbed = async (start) => {
        let say1 = page === 1 ? 1 : page * kactane - package + 1;
        const current = trackl.slice(start, start + kactane);
        if (!current || !current?.length > 0) return interaction.reply({ content: '⚠️ Hàng đợi trống', ephemeral: true }).catch(e => { });
        return new EmbedBuilder()
          .setTitle(`${interaction.guild.name} Hàng đợi`)
          .setThumbnail(interaction.guild.iconURL({ size: 2048, dynamic: true }))
          .setColor(client.config.embedColor)
          .setDescription(`▶️ Đang phát: \`${queue.songs[0].name}\`\n${current.map(data =>
            `\n\`${say1++}\` | [${data.title}](${data.url}) | (Thực hiện bởi <@${data.user.id}>)`
          ).join('')}`)
          .setFooter({ text: `Trang ${page}/${Math.floor(a + 1)}` });
      };

      const canFitOnOnePage = trackl.length <= kactane;

      await interaction.reply({
        embeds: [await generateEmbed(0)],
        components: canFitOnOnePage
          ? []
          : [new ActionRowBuilder({ components: [deleteButton, forwardButton] })],
        fetchReply: true
      }).then(async Message => {
        const filter = i => i.user.id === interaction.user.id;
        const collector = Message.createMessageComponentCollector({ filter, time: 120000 });

        let currentIndex = 0;
        collector.on('collect', async (button) => {
          if (button?.customId === 'close') {
            collector?.stop();
            return button?.reply({ content: 'Lệnh đã bị hủy', ephemeral: true }).catch(e => { });
          } else {
            if (button.customId === backId) {
              page--;
            }
            if (button.customId === forwardId) {
              page++;
            }

            button.customId === backId
              ? (currentIndex -= kactane)
              : (currentIndex += kactane);

            await interaction.editReply({
              embeds: [await generateEmbed(currentIndex)],
              components: [
                new ActionRowBuilder({
                  components: [
                    ...(currentIndex ? [backButton] : []),
                    deleteButton,
                    ...(currentIndex + kactane < trackl.length ? [forwardButton] : []),
                  ],
                }),
              ],
            }).catch(e => { });
            await button?.deferUpdate().catch(e => { });
          }
        });

        collector.on('end', async (button) => {
          button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('⬅️')
              .setCustomId(backId)
              .setDisabled(true),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('❌')
              .setCustomId('close')
              .setDisabled(true),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('➡️')
              .setCustomId(forwardId)
              .setDisabled(true));

          const embed = new EmbedBuilder()
            .setTitle('Lệnh hết thời gian')
            .setColor('#ecfc03')
            .setDescription('▶️ Thực hiện lại lệnh Queue!');
          return interaction?.editReply({ embeds: [embed], components: [button] }).catch(e => { });
        });
      }).catch(e => { });
    } catch (e) {
      console.error(e);
    }
  },
};