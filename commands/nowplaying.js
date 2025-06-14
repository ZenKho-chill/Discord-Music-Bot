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
const db = require('../mongoDB');
module.exports = {
  name: 'nowplaying',
  description: 'Lấy thông tin bài hát đang phát.',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const queue = client.player.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })

      const track = queue.songs[0];
      if (!track) return interaction.reply({ content: '⚠️ Hiện không có bài nào đang phát!', ephemeral: true }).catch(e => { })

      const embed = new EmbedBuilder();
      embed.setColor(client.config.embedColor);
      embed.setThumbnail(track.thumbnail);
      embed.setTitle(track.name)
      embed.setDescription(`
        > **Âm lượng** \`${queue.volume}\`
        > **Thời gian:** \`${track.formattedDuration}\`
        > **URL** [Link bài hát](${track.url})
        > **Chế độ lặp:** \`${queue.repeatMode ? (queue.repeatMode === 2 ? 'Lặp tất cả' : 'Lặp bài này') : 'Tắt'}\`
        > **Lọc âm thanh** \`${queue.filters.names.join(', ') || 'Tắt'}\`
        > **Người yêu cầu:** <@${track.user.id}>
        `);

      interaction.reply({ embeds: [embed] }).catch(e => {console.error(e)})
    } catch (E) {
      console.error(e);
    }
  },
};