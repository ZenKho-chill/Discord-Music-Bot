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
  name: 'seek',
  description: 'Nhảy đến một timestamp cụ thế trong bài hát',
  permissions: '0x0000000000000800',
  options: [{
    name: 'time',
    description: 'Nhập timestamp để nhảy đến (ví dụ: 2:40)',
    type: ApplicationCommandOptionType.String,
    required: true
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc đang phát', ephemeral: true }).catch(e => { });
      }

      let time = interaction.options.getString('time');
      let position = getSeconds(time);

      if (isNaN(position)) {
        return interaction.reply({ content: '⚠️ Lỗi cú pháp: Vui lòng nhập thời gian theo định dạng đúng (ví dụ 2:40)', ephemeral: true }).catch(e => { });
      }

      queue.seek(position);

      return interaction.reply({ content: `▶️ **Đang nhảy đến timestamp ${time} trong bài hát**` }).catch(e => { });
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi', ephemeral: true });
    }
  },
};

function getSeconds(str) {
  if (!str) {
    return 0;
  }

  var parts = str.split(':');
  var seconds = 0;
  var factor = 1;

  while (parts.length > 0) {
    seconds += factor * parseInt(parts.pop(), 10);
    factor *= 60;
  }

  return seconds;
}