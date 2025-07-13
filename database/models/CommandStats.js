const mongoose = require('mongoose');

const CommandStatsSchema = new mongoose.Schema({
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
  commandName: {
    type: String,
    required: true
  },
  // Số lần sử dụng lệnh
  usageCount: {
    type: Number,
    default: 1
  },
  // Lần sử dụng cuối
  lastUsed: {
    type: Date,
    default: Date.now
  },
  // Lần sử dụng đầu tiên
  firstUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index để query hiệu quả
CommandStatsSchema.index({ guildId: 1, userId: 1, commandName: 1 }, { unique: true });
CommandStatsSchema.index({ guildId: 1, commandName: 1, usageCount: -1 });
CommandStatsSchema.index({ guildId: 1, usageCount: -1 });

module.exports = mongoose.model('CommandStats', CommandStatsSchema);
