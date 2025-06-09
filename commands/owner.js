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


module.exports = {
  name: 'owner',
  description: 'Lấy thông tin của người chủ sở hữu bot',
  permissions: '0x0000000000000800',
  options: [],
  run: async (client, interaction) => {
    try {
      const { EmbedBuilder } = require('discord.js')
      const embed = new EmbedBuilder()
        .setColor('#da2a41')
        .setAuthor({
          name: 'Chủ sở hữu',
          iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
          url: 'https://zenkho.top'
        })
        .setDescription('__**About me**__:\n\n ▶️ Tôi là Bot âm nhạc được làm bởi ZenKho')
        .setTimestamp();
      interaction.reply({ embeds: [embed] }).catch(e => {});
    } catch (e) {
      console.error(e);
    }
  },
};