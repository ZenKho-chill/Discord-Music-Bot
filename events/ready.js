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

const config = require('../config');
const { ActivityType } = require('discord.js');
module.exports = async (client) => {
  if (config.mongodbURL || process.env.MONGO) {
    const { REST } = require("@discordjs/rest");
    const { Routes } = require("discord-api-types/v10");
    const rest = new REST({ version: '10' }).setToken(config.TOKEN || process.env.TOKEN);
    (async () => {
      try {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: await client.commands,
        });
        console.log('\x1b[36m%s\x1b[0m', '|    🚀 Đã tải lệnh ')
      } catch (err) {
        console.log('\x1b[36m%s\x1b[0m', '|     🚀 Ngưng tải lệnh');
        console.error(err);
      }
    })();
    console.log('\x1b[32m%s\x1b[0m', `|     🌼 Đăng nhập với ${client.user.username}`);
    setInterval(() => client.user.setActivity({
      name: `Nghe nhạc chill chill... Dùng '/help' nhé!`,
      type: ActivityType.Watching
    }), 10000);
  } else {
    console.log('\x1b[36m%s\x1b[0m', '|     🍔 Lỗi mongoDB')
  }
  console.log('\x1b[36m%s\x1b[0m', '|     🎯 Bot đã khởi động thành công!');

  if (client.config.voteManager.status === true && client.config.voteManager.api_key) {
    const { AutoPoster } = require('toggle-autoposter')
    const ap = AutoPoster(client.config.voteManager.api_key, client)
    ap.on('posted', () => { })
  }
}