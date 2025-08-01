// Model lưu cài đặt cho từng server Discord (MongoDB/Mongoose)
// Dùng tiếng Việt cho comment, dễ mở rộng, tuân thủ coding guidelines

const mongoose = require('mongoose');

// Định nghĩa schema cho server
const ServerSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    comment: 'ID server Discord',
  },
  volumeDefault: {
    type: Number,
    required: true,
    default: 50,
    min: 0,
    max: 150,
    comment: 'Âm lượng mặc định cho server',
  },
  volumePerUser: [
    {
      userId: {
        type: String,
        required: true,
        comment: 'ID người dùng Discord',
      },
      volume: {
        type: Number,
        required: true,
        min: 0,
        max: 150,
        comment: 'Âm lượng cá nhân user',
      }
    }
  ],
  // Có thể mở rộng thêm các trường khác như platform, embed, canvas...
}, {
  timestamps: true,
  collection: 'server',
});

module.exports = mongoose.model('Server', ServerSchema);
