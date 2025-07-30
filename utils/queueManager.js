const logger = require('./logger');

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
    // Giữ nguyên stt cho bài cũ, chỉ gán stt cho bài mới
    const currentQueue = this.queues[guildId] || [];
    const oldMap = {};
    for (const s of currentQueue) {
      const key = s.id || s.url;
      if (key) oldMap[key] = s;
    }
    let nextStt = currentQueue.length > 0 ? currentQueue[currentQueue.length - 1].stt || currentQueue.length : 0;
    const debugQueue = [];
    this.queues[guildId] = songs.map((song, idx) => {
      const key = song.id || song.url;
      if (key && oldMap[key]) {
        // Nếu là bài cũ, giữ nguyên stt và queueId
        debugQueue.push(`[CŨ] idx:${idx} stt:${oldMap[key].stt} queueId:${oldMap[key].queueId} name:${song.name}`);
        return { ...song, stt: oldMap[key].stt, queueId: oldMap[key].queueId };
      } else {
        // Bài mới, gán stt tiếp theo
        debugQueue.push(`[MỚI] idx:${idx} stt:${nextStt+1} queueId:${song.queueId || 'new'} name:${song.name}`);
        return { ...song, stt: ++nextStt, queueId: song.queueId || this.generateUniqueId() };
      }
    });
    this.sttCounters[guildId] = nextStt;
    // Log chi tiết trạng thái queue sau khi set
    const config = this.getConfig();
    if (config.debug) {
      logger.queue(`[QueueManager] setQueue - guildId: ${guildId}`);
      logger.queue(`[QueueManager] Tổng số bài: ${this.queues[guildId].length}, sttCounters: ${this.sttCounters[guildId]}`);
      debugQueue.forEach(log => logger.queue(log));
      logger.queue(`[QueueManager] Queue sau khi set: ` + this.queues[guildId].map(s => `stt:${s.stt} name:${s.name}`).join(' | '));
    }
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
      if (config.debug) logger.queue(`[QueueManager] Đã xóa bài đầu tiên khỏi guild ${guildId}. Còn lại: ${this.queues[guildId].length}`);
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
      logger.queue(`[QueueManager] Đã đồng bộ sau khi bỏ qua: còn lại ${this.queues[guildId].length} bài`);
    }
  }

  // Đồng bộ hàng đợi từ DisTube - đảm bảo đồng bộ chính xác kể cả bài trùng
  syncFromDisTube(guildId, distubeQueue) {
    if (!distubeQueue || !distubeQueue.songs) return;
    const currentQueue = this.queues[guildId] || [];
    // Nếu hàng đợi hiện tại rỗng, thiết lập lại từ đầu
    if (currentQueue.length === 0) {
      this.queues[guildId] = distubeQueue.songs.map((song, idx) => ({
        ...song,
        stt: idx + 1,
        queueId: song.queueId || this.generateUniqueId()
      }));
      this.sttCounters[guildId] = distubeQueue.songs.length;
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Khởi tạo hàng đợi cho guild ${guildId} với ${distubeQueue.songs.length} bài`);
      return;
    }
    // Nếu có bài cũ, chỉ thêm bài mới và gán stt tiếp theo
    if (distubeQueue.songs.length > currentQueue.length) {
      let nextStt = currentQueue[currentQueue.length - 1].stt || currentQueue.length;
      for (let i = currentQueue.length; i < distubeQueue.songs.length; i++) {
        const newSong = distubeQueue.songs[i];
        const queueId = newSong.queueId || this.generateUniqueId();
        this.queues[guildId].push({ ...newSong, stt: ++nextStt, queueId });
      }
      this.sttCounters[guildId] = nextStt;
      const config = this.getConfig();
      if (config.debug) console.log(`[QueueManager] Đã thêm ${distubeQueue.songs.length - currentQueue.length} bài mới vào guild ${guildId}. Tổng hàng đợi: ${this.queues[guildId].length}`);
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

  // Xóa tất cả các bài trước bài đang phát (dành cho repeat off)
  removeBeforeCurrentlyPlaying(guildId, currentlyPlayingId) {
    const config = this.getConfig();
    if (config.debug) console.log(`[QueueManager] removeBeforeCurrentlyPlaying - guildId: ${guildId}, currentlyPlayingId: ${currentlyPlayingId}`);
    
    if (!this.queues[guildId] || this.queues[guildId].length <= 1) {
      if (config.debug) console.log(`[QueueManager] Không có gì để xóa - queue trống hoặc chỉ có 1 bài`);
      return { removedCount: 0, removedSongs: [] };
    }

    const currentQueue = this.queues[guildId];
    let currentSongIndex = -1;
    
    // Tìm bài đang phát trong queue
    for (let i = 0; i < currentQueue.length; i++) {
      const song = currentQueue[i];
      const isMatch = song.id === currentlyPlayingId || 
                     song.url === currentlyPlayingId ||
                     (song.url && song.url.includes(currentlyPlayingId)) ||
                     (currentlyPlayingId && currentlyPlayingId.includes && currentlyPlayingId.includes(song.id));
      
      if (config.debug) console.log(`[QueueManager] Checking song ${i}: ${song.name} (stt: ${song.stt}), isMatch: ${isMatch}`);
      
      if (isMatch) {
        currentSongIndex = i;
        break;
      }
    }

    if (currentSongIndex <= 0) {
      if (config.debug) console.log(`[QueueManager] Bài đang phát ở vị trí đầu hoặc không tìm thấy (${currentSongIndex}), không cần xóa`);
      return { removedCount: 0, removedSongs: [] };
    }

    // Xóa các bài trước bài đang phát
    const removedSongs = this.queues[guildId].splice(0, currentSongIndex);
    const removedCount = removedSongs.length;
    
    if (config.debug) {
      console.log(`[QueueManager] Đã xóa ${removedCount} bài trước bài đang phát:`);
      removedSongs.forEach((song, i) => {
        console.log(`[QueueManager] - Bài ${i + 1}: ${song.name} (stt: ${song.stt})`);
      });
      console.log(`[QueueManager] Queue sau khi xóa:`, this.queues[guildId].map(s => `${s.name} (stt: ${s.stt})`));
    }

    return { removedCount, removedSongs };
  }
}

module.exports = new QueueManager();