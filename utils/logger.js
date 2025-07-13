const config = require('../config/config.js');

class Logger {
  constructor() {
    this.debugMode = config.debug || false;
  }

  // Cập nhật debug mode từ config - được gọi khi config thay đổi
  updateDebugMode() {
    try {
      // Clear require cache to get fresh config
      delete require.cache[require.resolve('../config/config.js')];
      const freshConfig = require('../config/config.js');
      this.debugMode = freshConfig.debug || false;
    } catch (error) {
      console.error('[Logger] Error updating debug mode:', error.message);
    }
  }

  // Log debug messages (chỉ hiển thị khi debug mode bật)
  debug(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log info messages (chỉ hiển thị khi debug mode bật)
  info(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Log warning messages (chỉ hiển thị khi debug mode bật)
  warn(...args) {
    if (this.debugMode) {
      console.warn(...args);
    }
  }

  // Log error messages (luôn hiển thị - CORE messages)
  error(...args) {
    console.error(...args);
  }

  // Log core/system messages (luôn hiển thị - CORE messages)
  core(...args) {
    console.log(...args);
  }

  // Log success messages (chỉ hiển thị khi debug mode bật)
  success(...args) {
    if (this.debugMode) {
      console.log(...args);
    }
  }

  // Conditional logging - sử dụng cho hot reload và các tính năng khác
  conditional(condition, ...args) {
    if (condition && this.debugMode) {
      console.log(...args);
    }
  }
}

// Export singleton instance
module.exports = new Logger();
