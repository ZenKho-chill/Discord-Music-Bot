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

const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'skip',
  description: 'Chuyển bài hát đang phát',
  permissions: '0x0000000000000800',
  options: [{
    name: 'number',
    description: 'Nhập số lượng bài hát bạn muốn bỏ qua',
    type: ApplicationCommandOptionType.Integer,
    required: false
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true }).catch(e => { });
      }

      const number = interaction.options.getNumber('number');

      if (number) {
        if (isNaN(number) || number < 1) {
          return interaction.reply({ content: '⚠️ Số không hợp lệ. Vui lòng nhập số lượng bài hát hợp lệ để bỏ qua', ephemeral: true }).catch(e => { });
        }

        if (queue.songs.length - 1 < number) {
          return interaction.reply({ content: '⚠️ Số lượng bài hát bạn yêu cầu vượt số bài hát hiện có trong hàng chờ', ephemeral: true }).catch(e => { });
        }

        let oldSong = queue.songs[0];
        await client.player.jump(interaction, number).then(() => {
          return interaction.reply({ content: `⏯️ Đã bỏ qua **${number}** bài hát: **${oldSong.name}**`  }).catch(e => { });
        }).catch(err => {
          return interaction.reply({ content: `❌ Đã xảy ra lỗi: ${err.message}`, ephemeral: true }).catch(e => { });
        });
      } else {
        let oldSong = queue.songs[0];
        const success = await queue.skip();

        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setAuthor({
            name: 'Bài hát đã bị bỏ qua',
            iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
            url: 'https://zenkho.top'
          })
          .setDescription(success ? `**Đã bỏ qua**: **${oldSong.name}**` : '❌ Hàng chờ rỗng')
          .setTimestamp();

        return interaction.reply({ embeds: [embed] }).catch(e => { });
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi khi xử lý yêu cầu của bạn', ephemeral: true }).catch(e => { });
    }
  },
};