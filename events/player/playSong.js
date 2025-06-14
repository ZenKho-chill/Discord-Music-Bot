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

const db = require("../../mongoDB");
const { EmbedBuilder } = require("discord.js");

module.exports = async (client, queue, song) => {
  if (queue) {
    if (!client.config.opt.loopMessage && queue?.repeatMode !== 0) return;
    if (queue?.textChannel) {
      const embed = new EmbedBuilder()
        .setAuthor({
          name: 'Đang phát nhạc',
          iconURL: 'https://cdn.discordapp.com/attachments/1140841446228897932/1144671132948103208/giphy.gif?ex=68470d11&is=6845bb91&hm=ff4edc729f7952776b6bad94636a4f7591d9f06785b8c98dbeea886701e94387&', 
          url: 'https://zenkho.top'
        })
        .setDescription(`\n ‎ \n▶️ **Chi tiết :** **${song?.name}**\n▶️ **Tận hưởng trải nghiệm âm nhạc tuyệt vời.**\n▶️ **Nếu link bị hỏng, thử nhập lại truy vấn.**`)
        .setImage(queue.songs[0].thumbnail)
        .setColor('#FF0000')

      queue?.textChannel?.send({ embeds: [embed] }).catch(e => { });
    }
  }
}
