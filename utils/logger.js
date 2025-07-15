const config = require('../config/config.js');

class Logger {
  constructor() {
    this.debugMode = config.debug || false;
  }

  // Cập nhật chế độ debug từ config - được gọi khi config thay đổi
  updateDebugMode() {
    try {
      // Xóa bộ nhớ đệm require để lấy config mới
      delete require.cache[require.resolve('../config/config.js')];
      const freshConfig = require('../config/config.js');
      this.debugMode = freshConfig.debug || false;
    } catch (error) {
      console.error('[Logger] Lỗi cập nhật chế độ debug:', error.message);
    }
  }

  // Log tin nhắn debug (chỉ hiển thị khi chế độ debug bật)
  debug(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log tin nhắn info (chỉ hiển thị khi chế độ debug bật)
  info(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log tin nhắn warning (chỉ hiển thị khi chế độ debug bật)
  warn(...args) {
    if (this.debugMode) {
      console.warn('[Cảnh báo]', ...args);
    }
  }

  // Log tin nhắn error (luôn hiển thị - tin nhắn CORE)
  error(...args) {
    console.error(...args);
  }

  // Log tin nhắn core/system (luôn hiển thị - tin nhắn CORE)
  core(...args) {
    console.log(...args);
  }

  // Log tin nhắn success (chỉ hiển thị khi chế độ debug bật)
  success(...args) {
    if (this.debugMode) {
      console.log('[Thành công]', ...args);
    }
  }

  // Ghi log có điều kiện - sử dụng cho hot reload và các tính năng khác
  conditional(condition, ...args) {
    if (condition && this.debugMode) {
      console.log(...args);
    }
  }

  // Log connection-related messages (có thể debug hoặc core tùy vào mức độ quan trọng)
  connection(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log database-related messages (debug mode)
  database(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log platform detection (debug mode)
  platform(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log queue management (debug mode)
  queue(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log music-related activities (debug mode)
  music(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log authentication and OAuth (debug mode)
  auth(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log auto-leave activities (debug mode)
  autoLeave(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log dashboard activities (debug mode)
  dashboard(...args) {
    if (this.debugMode) {
      console.log('[Bảng điều khiển]', ...args);
    }
  }
}

// Export singleton instance
module.exports = new Logger();
