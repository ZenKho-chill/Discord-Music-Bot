// Service theo dõi và kiểm soát việc thêm playlist khi gần hết bài
// Tự động tạm dừng thêm playlist khi còn 5-10s, đợi auto next xong mới tiếp tục
// Tên biến, log, comment đều dùng tiếng Việt

const config = require('../config/config');

class PlaylistAddController {
  constructor(client) {
    this.client = client;
    this.guildState = {}; // { [guildId]: { interval, isPaused, continueAdd, lastSongId } }
  }

  // Bắt đầu theo dõi khi thêm playlist
  startTracking(guildId, distubeQueue, continueAddCallback, stopAddCallback) {
    if (!distubeQueue || !distubeQueue.songs || distubeQueue.songs.length === 0) return;
    if (this.guildState[guildId]) this.stopTracking(guildId);
    const self = this;
    this.guildState[guildId] = {
      isPaused: false,
      continueAdd: continueAddCallback,
      stopAdd: stopAddCallback,
      lastSongId: distubeQueue.songs[0]?.id || null,
      interval: setInterval(async function () {
        try {
          const queue = self.client.distube.getQueue(guildId);
          if (!queue || !queue.songs || queue.songs.length === 0) return;
          // Nếu chỉ còn 1 bài trong queue thì không tạm dừng (tránh bug out bot)
          if (queue.songs.length === 1) return;
          const currentSong = queue.songs[0];
          const currentTime = queue.currentTime || 0;
          const duration = currentSong.duration || 0;
          const remain = duration - currentTime;
          // Nếu còn <= 8s thì tạm dừng thêm playlist
          if (!self.guildState[guildId].isPaused && remain <= 8 && remain > 0) {
            self.guildState[guildId].isPaused = true;
            if (config.debug) console.log(`[PlaylistAddController] Tạm dừng thêm playlist cho guild ${guildId} (còn ${remain}s)`);
            if (typeof self.guildState[guildId].stopAdd === 'function') self.guildState[guildId].stopAdd();
          }
          // Nếu đã auto next sang bài mới thì tiếp tục thêm playlist
          if (self.guildState[guildId].isPaused && currentSong.id !== self.guildState[guildId].lastSongId) {
            self.guildState[guildId].isPaused = false;
            self.guildState[guildId].lastSongId = currentSong.id;
            if (config.debug) console.log(`[PlaylistAddController] Tiếp tục thêm playlist cho guild ${guildId} (đã sang bài mới)`);
            if (typeof self.guildState[guildId].continueAdd === 'function') self.guildState[guildId].continueAdd();
          }
        } catch (e) {
          if (config.debug) console.error('[PlaylistAddController] Lỗi theo dõi:', e);
        }
      }, 1000)
    };
    if (config.debug) console.log(`[PlaylistAddController] Bắt đầu theo dõi playlist cho guild ${guildId}`);
  }

  // Dừng theo dõi
  stopTracking(guildId) {
    if (this.guildState[guildId]) {
      clearInterval(this.guildState[guildId].interval);
      delete this.guildState[guildId];
      if (config.debug) console.log(`[PlaylistAddController] Dừng theo dõi playlist cho guild ${guildId}`);
    }
  }

  // Kiểm tra có đang tạm dừng không
  isPaused(guildId) {
    return !!(this.guildState[guildId] && this.guildState[guildId].isPaused);
  }
}

module.exports = PlaylistAddController;
