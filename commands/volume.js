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
const maxVol = require('../config').opt.maxVol;
const db = require('../mongoDB');

module.exports = {
  name: 'volume',
  description: 'Cho phép bạn điều chỉnh âm lượng của nhạc',
  permissions: '0x0000000000000800',
  options: [{
    name: 'volume',
    description: 'Nhập số để điều chỉnh âm lượng',
    type: ApplicationCommandOptionType.Integer,
    required: true
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true });
      }

      const vol = parseInt(interaction.options.getInteger('volume'));

      if (!vol) {
        return interaction.reply({
          content: `Âm lượng hiện tại: **${queue.volume}** 🔊\nĐể thay đổi âm lượng, nhập số từ \`1\` đến \`${maxVol}\``,
          ephemeral: true
        });
      }

      if (queue.volume === vol) {
        return interaction.reply({ content: `Âm lượng hiện tại đã được đặt là **${vol}**`, ephemeral: true });
      }

      if (vol < 1 || vol > maxVol) {
        return interaction.reply({
          content: `Vui lòng nhập số từ \`1\` đến \`${maxVol}\``,
          ephemeral: true
        });
      }

      const success = queue.setVolume(vol);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#d291fe')
          .setAuthor({
            name: 'Nhạc của bạn! Quyết định của bạn',
            iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
            url: 'https://zenkho.top'
          })
          .setDescription(`**Điều chỉnh âm lượng: ** **${vol}/${maxVol}**`);
        return interaction.reply({ embeds: [embed] });
      } else {
        return interaction.reply({ content: '❌ Đã xảy ra lỗi khi thay đổi âm lượng', ephemeral: true });
      }
    } catch (e) {
      console.error(e);
    }
  },
};