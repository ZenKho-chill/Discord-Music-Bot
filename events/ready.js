const { EmbedBuilder } = require('discord.js');
const hotReloader = require('../utils/hotReload');
const queueManager = require('../utils/queueManager');
const config = require('../config/config');

const DEFAULT_THUMBNAIL = 'https://cdn.discordapp.com/embed/avatars/0.png';
let nowPlayingMsg = null;
let progressInterval = null;
let currentlyPlaying = {}; // { guildId: songId }
let processingPlaylist = {}; // { guildId: boolean } - Tạm dừng removeFirst khi đang xử lý playlist

module.exports = async(client) => {
  console.log(`[✔] Bot đang chạy với tên ${client.user.tag} - HỆ THỐNG TẢI ĐỘNG!`);
  
  // Khởi động trình tải động để theo dõi tất cả tệp
  hotReloader.startWatching();

  client.distube
    .on('playSong', async (queue, song) => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      // Ghi log liên kết thực tế và nguồn
      const config = hotReloader.getCurrentConfig();
      if (config.debug) console.log('[DisTube] Đang phát:', song.name, '| Liên kết:', song.url, '| Thời lượng:', song.duration, '| Nguồn:', song.source || song.streamURL || 'không xác định');
      
      // Chỉ xóa bài trước đó nếu KHÔNG đang xử lý danh sách phát và KHÔNG ở repeat mode
      if (currentlyPlaying[queue.id] && !processingPlaylist[queue.id] && queue.repeatMode !== 1 && queue.repeatMode !== 2) {
        queueManager.removeFirst(queue.id);
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Đã xóa bài trước khỏi quản lý hàng đợi cho máy chủ ${queue.id}`);
      } else if (processingPlaylist[queue.id]) {
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Bỏ qua removeFirst - đang xử lý danh sách phát cho máy chủ ${queue.id}`);
      } else if (queue.repeatMode === 1) {
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Bỏ qua removeFirst - đang ở chế độ lặp lại bài hát cho máy chủ ${queue.id}`);
      } else if (queue.repeatMode === 2) {
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Bỏ qua removeFirst - đang ở chế độ lặp lại hàng đợi cho máy chủ ${queue.id}`);
      }
      
      // Cập nhật bài đang phát hiện tại
      currentlyPlaying[queue.id] = song.id || song.url;
      
      // Expose currentlyPlaying qua client để các lệnh khác có thể truy cập
      if (!client.distube.currentlyPlaying) client.distube.currentlyPlaying = {};
      client.distube.currentlyPlaying[queue.id] = song.id || song.url;
    })
    .on('addSong', (queue, song) => {
      if (queue.songs.length > 1) {
        // KHÔNG gửi embed ở đây nữa
      }
      // Đồng bộ quản lý hàng đợi khi thêm bài mới (với độ trễ nhỏ để đảm bảo hàng đợi đã cập nhật)
      setTimeout(() => {
        queueManager.syncFromDisTube(queue.id, queue);
      }, 100);
    })
    .on('finish', queue => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      const botName = queue.distube.client.user.username;
      const botAvatar = queue.distube.client.user.displayAvatarURL();
      const embed = new EmbedBuilder()
        .setTitle('🎶 __**HẾT NHẠC RỒI!**__')
        .setDescription('**Tất cả bài hát trong hàng đợi đã được phát xong.**\n\n**Hãy thêm bài mới để tiếp tục tận hưởng âm nhạc!**')
        .setColor(0x8e44ad)
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/727/727245.png')
        .setFooter({ text: botName, iconURL: botAvatar });
      queue.textChannel.send({ embeds: [embed] });
      
      // Logic tự rời khi hết nhạc
      const config = hotReloader.getCurrentConfig();
      if (config.leaveOnEmpty?.finish?.enabled) {
        setTimeout(async () => {
          // Kiểm tra lại hàng đợi sau thời gian chờ
          const curQueue = queue.distube.getQueue(queue.id);
          if (!curQueue || !curQueue.songs || curQueue.songs.length === 0) {
            try {
              // Hết nhạc và thời gian chờ đã qua, rời luôn (không cần kiểm tra người dùng)
              const guild = queue.textChannel.guild;
              
              try {
                await queue.distube.voices.leave(queue.id);
                if (config.debug) console.log(`[Tự Rời-Hết Nhạc] Bot đã rời kênh thoại sau khi hết nhạc - ${guild.name}`);
                
                // Dọn dẹp bổ sung để ngăn tự động tham gia lại
                const connection = guild.client.voice?.connections?.get(guild.id);
                if (connection) {
                  connection.destroy();
                  if (config.debug) console.log(`[Tự Rời-Hết Nhạc] Đã hủy kết nối thoại - ${guild.name}`);
                }
              } catch (leaveError) {
                // Nếu DisTube rời thất bại, thử ngắt kết nối thủ công
                if (config.debug) console.log(`[Tự Rời-Hết Nhạc] DisTube rời thất bại, thử ngắt kết nối thủ công - ${guild.name}`);
                try {
                  await guild.members.me.voice.disconnect();
                  if (config.debug) console.log(`[Tự Rời-Hết Nhạc] Ngắt kết nối thủ công thành công - ${guild.name}`);
                  
                  // Ép buộc hủy kết nối
                  const connection = guild.client.voice?.connections?.get(guild.id);
                  if (connection) {
                    connection.destroy();
                    if (config.debug) console.log(`[Tự Rời-Hết Nhạc] Hủy kết nối thoại thủ công - ${guild.name}`);
                  }
                } catch (disconnectError) {
                  console.error('[Tự Rời-Hết Nhạc] Lỗi khi ngắt kết nối thủ công:', disconnectError.message);
                }
              }
            } catch (e) {
              console.error('[TỰ RỜI KHI TRỐNG] Lỗi khi rời kênh:', e);
            }
          }
        }, (config.leaveOnEmpty.finish.timeout || 10) * 1000);
      }
      // Khi hết hàng đợi, xóa toàn bộ quản lý hàng đợi và bài đang phát
      queueManager.clearQueue(queue.id);
      delete currentlyPlaying[queue.id];
      if (client.distube.currentlyPlaying) {
        delete client.distube.currentlyPlaying[queue.id];
      }
    })
    .on('empty', async queue => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      
      // Sự kiện 'empty' của DisTube kích hoạt ngay lập tức khi kênh thoại trống
      // Chúng ta sẽ để voiceStateUpdate xử lý logic thời gian chờ thay thế
      const config = hotReloader.getCurrentConfig();
      if (config.debug) {
        console.log(`[Sự Kiện DisTube Empty] Phát hiện kênh thoại trống cho máy chủ ${queue.textChannel.guild.name} - để voiceStateUpdate xử lý`);
      }
      
      // Xóa theo dõi khi hàng đợi trống
      delete currentlyPlaying[queue.id];
      if (client.distube.currentlyPlaying) {
        delete client.distube.currentlyPlaying[queue.id];
      }
    })
    .on('error', (channel, error) => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      
      console.error('[Sự Kiện Lỗi DisTube]', error);

      let errorMessage = 'Đã xảy ra lỗi không xác định';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && error.message) {
        errorMessage = error.message;
      }

      if (channel && typeof channel.send === 'function') {
        // Tránh gửi tin nhắn trùng lặp nếu lỗi đã được xử lý ở lệnh
        if (errorMessage.includes("No result found")) {
            const config = hotReloader.getCurrentConfig();
            if (config.debug) console.log("[Lỗi DisTube] Bỏ qua gửi tin nhắn 'No result found' để tránh trùng lặp.");
            return;
        }
        channel.send(`❌ Có lỗi từ DisTube: ${errorMessage}`);
      }
    });
};

// Xuất hàm để các nền tảng có thể kiểm soát
module.exports.setProcessingPlaylist = (guildId, status) => {
  processingPlaylist[guildId] = status;
  const config = hotReloader.getCurrentConfig();
  if (config.debug) console.log(`[Sự Kiện] Đặt xử lý danh sách phát cho máy chủ ${guildId}: ${status}`);
};
