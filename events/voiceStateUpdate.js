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

const db = require('../mongoDB');
module.exports = async (client, oldState, newState) => {
  const queue = client.player.getQueue(oldState.guild.id);
  if (queue || queue?.playing) {
    if (client?.config?.opt?.voiceConfig?.leaveOnEmpty?.status === true) {
      setTimeout(async () => {
        let botChannel = oldState?.guild?.channels?.cache?.get(queue?.voice?.connection?.joinConfig?.channelId);
        if (botChannel) {
          if (botChannel.id == oldState.channelId) {
            if (botChannel?.members?.find(x => x == client?.user?.id)) {
              if (botChannel?.members?.size == 1){
                await queue?.textChannel?.send({ content: '🔴 Người dùng đã rời khỏi kênh' }).catch(e => { });
                if (queue || queue?.playing) {
                  return queue?.stop(oldState.guild.id);
                }
              }
            }
          }
        }
      }, (client?.config?.opt?.voiceConfig?.leaveOnEmpty?.cooldown || 60) * 1000);
    }
    if (newState.id === client.user.id) {
      if (oldState.serverMute === false && newState.serverMute === true) {
        if (queue?.textChannel) {
          try {
            await queue?.pause();
          } catch (e) {
            return;
          }
          await queue?.textChannel?.send({ content: '🔴 Đã bị tắt tiếng' });
        }
      }
      if (oldState.serverMute === true && newState.serverMute === false) {
        if (queue?.textChannel) {
          try {
            await queue.resume();
          } catch (e) {
            return;
          }
        }
      }
    }
  }
}