class QueueManager {
  constructor() {
    this.queues = {}; // { guildId: [bài1, bài2, ...] }
    this.sttCounters = {}; // { guildId: bộDếmSTTHiệnTại }
  }

  // Lấy cấu hình hiện tại một cách an toàn (tải lười để tránh phụ thuộc vòng tròn)
  getConfig() {
    try {
      return require('./hotReload').getCurrentConfig();
    } catch (error) {
      return require('../config/config');
    }
  }

  // Tạo ID duy nhất ngẫu nhiên
  generateUniqueId() {
    return 'qm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
  }

  setQueue(guildId, songs) {
    this.queues[guildId] = songs.map((song, idx) => ({ 
      ...song, 
      stt: idx + 1,
      queueId: this.generateUniqueId() // Thêm ID duy nhất
    }));
    // Cập nhật bộ đếm để theo dõi số thứ tự tiếp theo
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
    const queueId = this.generateUniqueId(); // Tạo ID duy nhất
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
      if (config.debug) console.log(`[QueueManager] Đã xóa bài đầu tiên khỏi guild ${guildId}. Còn lại: ${this.queues[guildId].length}`);
      // KHÔNG cập nhật lại số thứ tự - giữ nguyên số thứ tự ban đầu
    }
  }

  // Đồng bộ hàng đợi với DisTube sau khi bỏ qua - xóa bài đã bỏ qua
  syncAfterSkip(guildId, currentDistubeQueue) {
    if (!currentDistubeQueue || !currentDistubeQueue.songs) {
      // Nếu không còn bài nào trong DisTube, xóa sạch queueManager
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
      console.log(`[QueueManager] Đã đồng bộ sau khi bỏ qua: còn lại ${this.queues[guildId].length} bài`);
    }
  }

  // Đồng bộ hàng đợi từ DisTube - đảm bảo đồng bộ chính xác kể cả bài trùng
  syncFromDisTube(guildId, distubeQueue) {
    if (!distubeQueue || !distubeQueue.songs) return;
    
    const currentQueue = this.queues[guildId] || [];
    
    // Nếu hàng đợi hiện tại rỗng, thiết lập lại từ đầu
    if (currentQueue.length === 0) {
      this.setQueue(guildId, distubeQueue.songs);
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Khởi tạo hàng đợi cho guild ${guildId} với ${distubeQueue.songs.length} bài`);
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
        const queueId = this.generateUniqueId(); // Tạo ID duy nhất cho bài mới
        this.queues[guildId].push({ ...newSong, stt: this.sttCounters[guildId], queueId });
      }
      
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Đã thêm ${newSongsCount} bài mới vào guild ${guildId}. Tổng hàng đợi: ${this.queues[guildId].length}`);
    }
  }

  // Cập nhật lại tất cả số thứ tự cho hàng đợi
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