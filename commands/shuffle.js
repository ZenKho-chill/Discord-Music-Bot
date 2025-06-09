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

const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const db = require('../mongoDB');

module.exports = {
  name: 'shuffle',
  description: 'Xáo trộn dang sách nhạc trong hàng chờ',
  options: [],
  permissions: '0x0000000000000800',
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);

      if (!queue || !queue.playing) {
        return interaction.reply({ content: '⚠️ Không có nhạc nào đang phát', ephemeral: true }).catch(e => { });
      }

      try {
        queue.shuffle();
        return interaction.reply({ content: `<@${interaction.user.id}>, Đã xáo trộn danh sách nhạc cho bạn!! 🎶` }).catch(e => { });
      } catch (err) {
        console.error('Lỗi khi xáo trộn:', err);
        return interaction.reply({ content: `❌ Lỗi xảy ra khi cố gắng xáo trộn nhạc: **${err.message}**`, ephemeral: true }).catch(e => { });
      }
    } catch (e) {
      console.error(e);
      return interaction.reply({ content: '❌ Đã xảy ra lỗi không xác định', ephemeral: true }).catch(e => { });
    }
  },
};