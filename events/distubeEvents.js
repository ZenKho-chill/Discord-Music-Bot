const MusicTrackService = require('../database/services/MusicTrackService');
const config = require('../config/config');

module.exports = (client) => {
  const distube = client.distube;
  
  // Event khi bắt đầu phát nhạc
  distube.on('playSong', async (queue, song) => {
    try {
      if (config.debug) {
        console.log('🎵 DisTube playSong event:', {
          title: song.name,
          url: song.url,
          duration: song.formattedDuration,
          platform: song.source
        });
      }

      // Log track với thông tin chi tiết từ DisTube
      await MusicTrackService.logTrack({
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

      // Embed đã bị xóa theo yêu cầu
    } catch (error) {
      console.error('❌ Error in playSong event:', error);
    }
  });

  // Event khi thêm bài vào queue
  distube.on('addSong', async (queue, song) => {
    try {
      if (config.debug) {
        console.log('➕ DisTube addSong event:', song.name);
      }

      // Embed thông báo đã bị xóa theo yêu cầu
    } catch (error) {
      console.error('❌ Error in addSong event:', error);
    }
  });

  // Event khi thêm playlist
  distube.on('addList', async (queue, playlist) => {
    try {
      if (config.debug) {
        console.log('📋 DisTube addList event:', playlist.name);
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
      console.error('❌ Error in addList event:', error);
    }
  });

  // Event khi kết thúc bài hát
  distube.on('finishSong', async (queue, song) => {
    try {
      if (config.debug) {
        console.log('🏁 DisTube finishSong event:', song.name);
      }

      // Cập nhật status thành finished
      // (Cần tìm track bằng URL và guild để update)
      // TODO: Implement update track status logic
    } catch (error) {
      console.error('❌ Error in finishSong event:', error);
    }
  });

  // Event error
  distube.on('error', (channel, error) => {
    console.error('❌ DisTube Error:', error);
    channel?.send(`❌ Đã xảy ra lỗi: ${error.message}`);
  });

  console.log('🎵 DisTube events loaded with MusicTrackService integration');
};
