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

  // Tạo unique ID ngẫu nhiên
  generateUniqueId() {
    return 'qm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  }

  setQueue(guildId, songs) {
    this.queues[guildId] = songs.map((song, idx) => ({ 
      ...song, 
      stt: idx + 1,
      queueId: this.generateUniqueId() // Thêm unique ID
    }));
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
    const queueId = this.generateUniqueId(); // Tạo unique ID
    this.queues[guildId].push({ ...song, stt, queueId });
  }

  // Tìm bài hát theo queueId
  findSongByQueueId(guildId, queueId) {
    const songs = this.queues[guildId] || [];
    return songs.find(song => song.queueId === queueId);
  }

  clearQueue(guildId) {
    this.queues[guildId] = [];
    this.sttCounters[guildId] = 0;
  }

  removeFirst(guildId) {
    if (this.queues[guildId] && this.queues[guildId].length > 0) {
      const removedSong = this.queues[guildId][0];
      this.queues[guildId].shift();
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Removed first song from guild ${guildId}. Remaining: ${this.queues[guildId].length}`);
      // KHÔNG cập nhật lại stt - giữ nguyên số thứ tự ban đầu
    }
  }

  // Đồng bộ queue với DisTube sau khi skip - xóa bài đã skip
  syncAfterSkip(guildId, currentDistubeQueue) {
    if (!currentDistubeQueue || !currentDistubeQueue.songs) {
      // Nếu không còn bài nào trong DisTube, clear queueManager
      this.clearQueue(guildId);
      return;
    }

    const distubeIds = currentDistubeQueue.songs.map(song => song.id || song.url);
    const currentQueue = this.queues[guildId] || [];
    
    // Lọc ra những bài còn lại trong DisTube
    this.queues[guildId] = currentQueue.filter(song => {
      const songId = song.id || song.url;
      return distubeIds.includes(songId);
    });

    const config = this.getConfig();
    if (config.debug) {
      console.log(`[QueueManager] Synced after skip: ${this.queues[guildId].length} songs remaining`);
    }
  }

  // Đồng bộ queue từ DisTube - đảm bảo sync chính xác kể cả bài trùng
  syncFromDisTube(guildId, distubeQueue) {
    if (!distubeQueue || !distubeQueue.songs) return;
    
    const currentQueue = this.queues[guildId] || [];
    
    // Nếu queue hiện tại rỗng, set lại từ đầu
    if (currentQueue.length === 0) {
      this.setQueue(guildId, distubeQueue.songs);
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Initialized queue for guild ${guildId} with ${distubeQueue.songs.length} songs`);
      return;
    }
    
    // So sánh độ dài để phát hiện bài mới
    if (distubeQueue.songs.length > currentQueue.length) {
      const newSongsCount = distubeQueue.songs.length - currentQueue.length;
      
      // Thêm các bài mới từ cuối DisTube queue
      for (let i = currentQueue.length; i < distubeQueue.songs.length; i++) {
        const newSong = distubeQueue.songs[i];
        if (!this.sttCounters[guildId]) this.sttCounters[guildId] = currentQueue.length;
        this.sttCounters[guildId]++;
        const queueId = this.generateUniqueId(); // Tạo unique ID cho bài mới
        this.queues[guildId].push({ ...newSong, stt: this.sttCounters[guildId], queueId });
      }
      
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