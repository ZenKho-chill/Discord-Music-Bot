const mongoose = require('mongoose');

const UserStatsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  guildId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  // Thống kê thời gian nghe nhạc
  totalListeningTime: {
    type: Number,
    default: 0 // Tính bằng giây
  },
  // Số bài đã phát
  tracksPlayed: {
    type: Number,
    default: 0
  },
  // Lần cuối hoạt động
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Session hiện tại (để tính thời gian nghe)
  currentSession: {
    startTime: Date,
    trackId: String,
    isListening: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Compound index để query hiệu quả
UserStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserStatsSchema.index({ guildId: 1, totalListeningTime: -1 });
UserStatsSchema.index({ guildId: 1, tracksPlayed: -1 });

module.exports = mongoose.model('UserStats', UserStatsSchema);
