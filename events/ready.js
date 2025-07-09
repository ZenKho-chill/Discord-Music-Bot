const { EmbedBuilder } = require('discord.js');
const hotReloader = require('../utils/hotReload');
const queueManager = require('../utils/queueManager');

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
      // Log link thực tế và nguồn
      const config = hotReloader.getCurrentConfig();
      if (config.debug) console.log('[DisTube] Đang phát:', song.name, '| Link:', song.url, '| Thời lượng:', song.duration, '| Nguồn:', song.source || song.streamURL || 'không xác định');
      
      // Chỉ xóa bài trước đó nếu KHÔNG đang xử lý danh sách phát
      if (currentlyPlaying[queue.id] && !processingPlaylist[queue.id]) {
        queueManager.removeFirst(queue.id);
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Đã xóa bài trước khỏi queueManager cho guild ${queue.id}`);
      } else if (processingPlaylist[queue.id]) {
        const config = hotReloader.getCurrentConfig();
        if (config.debug) console.log(`[DisTube] Bỏ qua removeFirst - đang xử lý danh sách phát cho guild ${queue.id}`);
      }
      
      // Cập nhật bài đang phát hiện tại
      currentlyPlaying[queue.id] = song.id || song.url;
    })
    .on('addSong', (queue, song) => {
      if (queue.songs.length > 1) {
        // KHÔNG gửi embed ở đây nữa
      }
      // Đồng bộ queueManager khi thêm bài mới (với độ trễ nhỏ để đảm bảo queue đã cập nhật)
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
      // Logic leave on empty
      if (config.leaveOnEmpty && config.leaveOnEmpty.enabled) {
        setTimeout(async () => {
          // Kiểm tra lại queue sau timeout
          const curQueue = queue.distube.getQueue(queue.id);
          if (!curQueue || !curQueue.songs || curQueue.songs.length === 0) {
            try {
              await queue.voice.leave();
              // await queue.textChannel.send('🎶 Hàng đợi trống quá lâu, mình xin phép rời kênh nhé!');
            } catch (e) {
              console.error('[LEAVE_ON_EMPTY] Lỗi khi rời kênh:', e);
            }
          }
        }, (config.leaveOnEmpty.timeout || 30) * 1000);
      }
      // Khi hết hàng đợi, clear toàn bộ queueManager và currentlyPlaying
      queueManager.clearQueue(queue.id);
      delete currentlyPlaying[queue.id];
    })
    .on('empty', queue => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      if (config.leaveOnEmpty && config.leaveOnEmpty.enabled) {
        try {
          queue.voice.leave();
        } catch (e) {
          console.error('[EMPTY_EVENT] Lỗi khi rời kênh:', e);
        }
      }
      // Clear tracking khi queue rỗng
      delete currentlyPlaying[queue.id];
    })
    .on('error', (channel, error) => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      
      console.error('[DisTube Error Event]', error);

      let errorMessage = 'An unknown error occurred';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && error.message) {
        errorMessage = error.message;
      }

      if (channel && typeof channel.send === 'function') {
        // Tránh gửi message trùng lặp nếu lỗi đã được xử lý ở command
        if (errorMessage.includes("No result found")) {
            const config = hotReloader.getCurrentConfig();
            if (config.debug) console.log("[DisTube Error] Bỏ qua gửi message 'No result found' để tránh trùng lặp.");
            return;
        }
        channel.send(`❌ Có lỗi từ DisTube: ${errorMessage}`);
      }
    });
};

// Export functions để các platform có thể control
module.exports.setProcessingPlaylist = (guildId, status) => {
  processingPlaylist[guildId] = status;
  const config = hotReloader.getCurrentConfig();
  if (config.debug) console.log(`[Events] Set processing playlist for guild ${guildId}: ${status}`);
};