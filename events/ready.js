const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

const DEFAULT_THUMBNAIL = 'https://cdn.discordapp.com/embed/avatars/0.png';
let nowPlayingMsg = null;
let progressInterval = null;

module.exports = async(client) => {
  console.log(`[✔] Bot đang chạy với tên ${client.user.tag}`);

  client.distube
    .on('playSong', async (queue, song) => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
    })
    .on('addSong', (queue, song) => {
      if (queue.songs.length > 1) {
        // KHÔNG gửi embed ở đây nữa
      }
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
    })
    .on('error', (channel, error) => {
      if (progressInterval) clearInterval(progressInterval);
      nowPlayingMsg = null;
      // Nếu là DisTubeError: Queue thì chỉ log message
      if (error && error.name === 'DisTubeError' && error.message && error.message.includes('Queue')) {
        console.error('DisTubeError:', error.message);
      } else {
        console.error('DisTubeError:', error);
      }
      if (channel && typeof channel.send === 'function') {
        channel.send(`❌ Có lỗi xảy ra: ${error.message || error}`);
      }
    });
};