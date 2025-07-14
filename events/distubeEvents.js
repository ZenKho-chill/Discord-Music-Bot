const MusicTrackService = require('../database/services/MusicTrackService');
const ServerStatsService = require('../database/services/ServerStatsService');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = (client) => {
  const distube = client.distube;
  
  // Event khi bắt đầu phát nhạc
  distube.on('playSong', async (queue, song) => {
    try {
      if (config.debug) {
        logger.debug('🎵 DisTube playSong event:', {
          title: song.name,
          url: song.url,
          duration: song.formattedDuration,
          platform: song.source
        });
      }

      // Log track với thông tin chi tiết từ DisTube
      const trackId = await MusicTrackService.logTrack({
        url: song.url,
        title: song.name,
        guild: queue.textChannel?.guild,
        user: song.user,
        metadata: {
          duration: song.formattedDuration,
          thumbnail: song.thumbnail,
          artist: song.uploader?.name,
          views: song.views,
          likes: song.likes
        }
      });

      // Bắt đầu tracking listening session cho user
      if (song.user && queue.textChannel?.guild) {
        await ServerStatsService.startListeningSession(
          song.user.id,
          queue.textChannel.guild.id,
          song.user.username,
          trackId
        );
      }

      // Embed đã bị xóa theo yêu cầu
    } catch (error) {
      console.error('❌ Lỗi trong sự kiện playSong:', error);
    }
  });

  // Event khi thêm bài vào queue
  distube.on('addSong', async (queue, song) => {
    try {
      if (config.debug) {
        logger.debug('➕ DisTube addSong event:', song.name);
      }

      // Embed thông báo đã bị xóa theo yêu cầu
    } catch (error) {
      console.error('❌ Lỗi trong sự kiện addSong:', error);
    }
  });

  // Event khi thêm playlist
  distube.on('addList', async (queue, playlist) => {
    try {
      if (config.debug) {
        logger.debug('📋 DisTube addList event:', playlist.name);
      }

      // Log từng bài trong playlist
      for (const song of playlist.songs) {
        await MusicTrackService.logTrack({
          url: song.url,
          title: song.name,
          guild: queue.textChannel?.guild,
          user: playlist.user,
          metadata: {
            duration: song.formattedDuration,
            thumbnail: song.thumbnail,
            artist: song.uploader?.name,
            views: song.views,
            likes: song.likes
          }
        });
      }

      // Embed thông báo playlist đã bị xóa theo yêu cầu
    } catch (error) {
      console.error('❌ Lỗi trong sự kiện addList:', error);
    }
  });

  // Event khi kết thúc bài hát
  distube.on('finishSong', async (queue, song) => {
    try {
      if (config.debug) {
        logger.debug('🏁 DisTube finishSong event:', song.name);
      }

      // Kết thúc listening session cho user
      if (song.user && queue.textChannel?.guild) {
        await ServerStatsService.endListeningSession(
          song.user.id,
          queue.textChannel.guild.id
        );
      }

      // Cập nhật status thành finished
      // (Cần tìm track bằng URL và guild để update)
      // TODO: Implement update track status logic
    } catch (error) {
      console.error('❌ Lỗi trong sự kiện finishSong:', error);
    }
  });

  // Event error
  distube.on('error', (channel, error) => {
    console.error('❌ Lỗi DisTube:', error);
    channel?.send(`❌ Đã xảy ra lỗi: ${error.message}`);
  });

  logger.core('🎵 Đã tải các sự kiện DisTube với tích hợp MusicTrackService và ServerStatsService');
};
