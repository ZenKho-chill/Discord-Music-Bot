class QueueManager {
  constructor() {
    this.queues = {}; // { guildId: [song1, song2, ...] }
    this.sttCounters = {}; // { guildId: currentSttCounter }
  }

  // Get current config safely (lazy load to avoid circular dependency)
  getConfig() {
    try {
      return require('./hotReload').getCurrentConfig();
    } catch (error) {
      return require('../config/config');
    }
  }

  setQueue(guildId, songs) {
    this.queues[guildId] = songs.map((song, idx) => ({ ...song, stt: idx + 1 }));
    // Cập nhật counter để theo dõi stt tiếp theo
    this.sttCounters[guildId] = songs.length;
  }

  getQueue(guildId) {
    return this.queues[guildId] || [];
  }

  addSong(guildId, song) {
    if (!this.queues[guildId]) this.queues[guildId] = [];
    if (!this.sttCounters[guildId]) this.sttCounters[guildId] = 0;
    
    this.sttCounters[guildId]++;
    const stt = this.sttCounters[guildId];
    this.queues[guildId].push({ ...song, stt });
  }

  clearQueue(guildId) {
    this.queues[guildId] = [];
    this.sttCounters[guildId] = 0;
  }

  removeFirst(guildId) {
    if (this.queues[guildId]) {
      const removedSong = this.queues[guildId][0];
      this.queues[guildId].shift();
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Removed first song from guild ${guildId}. Remaining: ${this.queues[guildId].length}`);
      // KHÔNG cập nhật lại stt - giữ nguyên số thứ tự ban đầu
    }
  }

  // Đồng bộ queue từ DisTube - chỉ thêm bài mới, không thay đổi stt của bài cũ
  syncFromDisTube(guildId, distubeQueue) {
    if (!distubeQueue || !distubeQueue.songs) return;
    
    const currentQueue = this.queues[guildId] || [];
    const distubeIds = distubeQueue.songs.map(song => song.id || song.url);
    const currentIds = currentQueue.map(song => song.id || song.url);
    
    // Nếu queue hiện tại rỗng, set lại từ đầu
    if (currentQueue.length === 0) {
      this.setQueue(guildId, distubeQueue.songs);
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Initialized queue for guild ${guildId} with ${distubeQueue.songs.length} songs`);
      return;
    }
    
    // Tìm bài hát mới trong DisTube queue
    let newSongsCount = 0;
    for (let i = 0; i < distubeQueue.songs.length; i++) {
      const distubeSong = distubeQueue.songs[i];
      const songId = distubeSong.id || distubeSong.url;
      
      if (!currentIds.includes(songId)) {
        // Bài mới - thêm vào với stt tiếp theo
        if (!this.sttCounters[guildId]) this.sttCounters[guildId] = currentQueue.length;
        this.sttCounters[guildId]++;
        this.queues[guildId].push({ ...distubeSong, stt: this.sttCounters[guildId] });
        newSongsCount++;
      }
    }
    
    if (newSongsCount > 0) {
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Added ${newSongsCount} new songs to guild ${guildId}. Total queue: ${this.queues[guildId].length}`);
    }
  }

  // Cập nhật lại tất cả stt cho queue
  updateStt(guildId) {
    if (this.queues[guildId]) {
      this.queues[guildId] = this.queues[guildId].map((song, idx) => ({ ...song, stt: idx + 1 }));
    }
  }

  // Xóa bài hát tại vị trí cụ thể
  removeSongAt(guildId, index) {
    if (this.queues[guildId] && index >= 0 && index < this.queues[guildId].length) {
      this.queues[guildId].splice(index, 1);
      this.updateStt(guildId);
    }
  }
}

module.exports = new QueueManager();