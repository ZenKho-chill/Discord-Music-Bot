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

const config = require('../../config');
const db = require('../../mongoDB');
module.exports = async (client, queue) => {
  if (!config.opt.voiceConfig.leaveOnFinish.status) return;

  const cooldown = (config.opt.voiceConfig.leaveOnFinish.cooldown || 100) * 1000;

  console.log(`[leaveOnFinish] Hàng đợi đã hết, sẽ rời kênh sau ${cooldown / 1000} giây`);

  leaveTimeout = setTimeout(() => {
    console.log(`[leaveOnFinish] Không có bài mới, bot rời kênh`);
    queue.voice.leave();
  }, cooldown);
  
  client.player.on("playSong", () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveOnFinish = null;
      console.log(`[leaveOnFinish] Phát bài mới, hủy đếm ngược rời kênh`);
    }
  });
};