const fs = require('fs');
const path = require('path');
const config = require('../config/config.js');

class HotReloader {
  constructor() {
    this.configPath = path.join(__dirname, '../config/config.js');
    this.currentConfig = { ...config };
    this.watchers = new Map();
    this.isWatching = false;
    
    // Danh sách các tệp CORE không thể tải động (cần khởi động lại bot)
    this.coreFiles = [
      'index.js',
      'package.json', 
      'events/ready.js',
      'events/interactionCreate.js', 
      'events/messageCreate.js',
      'events/guildCreate.js',
      'events/voiceStateUpdate.js',
      'utils/loader.js'
    ];
    
    // Danh sách các thư mục cần theo dõi để tải động
    this.watchDirectories = [
      'commands',
      'config',
      'utils/queueManager.js',
      'dashboard'
    ];
    
    // Bộ nhớ đệm tệp cho các tệp đã tải
    this.fileCache = new Map();
  }

  // Bắt đầu theo dõi tất cả các tệp
  startWatching() {
    if (this.isWatching) return;
    
    this.isWatching = true;
    
    try {
      // Theo dõi config.js đặc biệt
      this.watchFile(this.configPath, 'config');
      
      // Theo dõi thư mục gốc để phát hiện thay đổi tệp cốt lõi
      this.watchDirectory(path.join(__dirname, '..'), '', true);
      
      // Theo dõi các thư mục
      this.watchDirectories.forEach(dir => {
        const fullPath = path.join(__dirname, '..', dir);
        if (fs.existsSync(fullPath)) {
          this.watchDirectory(fullPath, dir);
        }
      });

      if (config.debug) console.log(`[HotReload] 🔥 Hệ thống tải động đã được kích hoạt cho tất cả tệp`);
      if (this.currentConfig.debug) {
        console.log(`[HotReload] 📂 Đang theo dõi: ${this.watchers.size} tệp/thư mục`);
        console.log(`[HotReload] 🚫 Tệp cốt lõi (cần khởi động lại): ${this.coreFiles.length}`);
      }
      
    } catch (error) {
      console.error(`[HotReload] ❌ Lỗi khi bắt đầu theo dõi:`, error.message);
    }
  }

  // Theo dõi một tệp cụ thể
  watchFile(filePath, type = 'general') {
    if (this.watchers.has(filePath)) return;
    
    try {
      const watcher = fs.watch(filePath, { persistent: true }, (eventType, filename) => {
        if (eventType === 'change') {
          this.handleFileChange(filePath, type);
        }
      });
      
      this.watchers.set(filePath, { watcher, type });
      
    } catch (error) {
      console.error(`[HotReload] ❌ Không thể theo dõi tệp ${filePath}:`, error.message);
    }
  }

  // Theo dõi thư mục một cách đệ quy
  watchDirectory(dirPath, relativePath, isRootWatch = false) {
    try {
      // Theo dõi thư mục chính
      const watchRecursive = !isRootWatch; // Thư mục gốc chỉ theo dõi không đệ quy
      const watcher = fs.watch(dirPath, { persistent: true, recursive: watchRecursive }, (eventType, filename) => {
        if (eventType === 'change' && filename) {
          const fullPath = path.join(dirPath, filename);
          const relativeFilePath = relativePath ? path.join(relativePath, filename).replace(/\\/g, '/') : filename;
          
          // Nếu theo dõi thư mục gốc, chỉ quan tâm đến tệp cốt lõi
          if (isRootWatch) {
            if (this.isCoreFile(relativeFilePath)) {
              console.log(`[HotReload] ⚠️ CẢNH BÁO: Tệp cốt lõi đã thay đổi: ${relativeFilePath}`);
              console.log(`[HotReload] 🔄 Vui lòng KHỞI ĐỘNG LẠI bot để áp dụng thay đổi tệp cốt lõi!`);
              console.log(`[HotReload] 📋 Lý do: Tệp cốt lõi không thể tải động vì lý do bảo mật và ổn định.`);
            }
            return; // Không xử lý tải động cho theo dõi thư mục gốc
          }
          
          // Kiểm tra xem có phải tệp cốt lõi không
          if (this.isCoreFile(relativeFilePath)) {
            console.log(`[HotReload] ⚠️ Tệp cốt lõi đã thay đổi: ${relativeFilePath}`);
            console.log(`[HotReload] 🔄 Vui lòng khởi động lại bot để áp dụng thay đổi!`);
            return;
          }
          
          this.handleFileChange(fullPath, 'directory', relativeFilePath);
        }
      });
      
      this.watchers.set(dirPath, { watcher, type: 'directory' });
      
    } catch (error) {
      console.error(`[HotReload] ❌ Không thể theo dõi thư mục ${dirPath}:`, error.message);
    }
  }

  // Kiểm tra xem tệp có phải là tệp cốt lõi không
  isCoreFile(filePath) {
    return this.coreFiles.some(coreFile => 
      filePath.includes(coreFile) || filePath.endsWith(coreFile)
    );
  }

  // Xử lý thay đổi tệp
  async handleFileChange(filePath, type, relativePath = null) {
    try {
      // Đợi một chút để tệp được ghi hoàn toàn
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const displayPath = relativePath || path.relative(path.join(__dirname, '..'), filePath);
      
      if (type === 'config') {
        await this.handleConfigChange(filePath);
      } else {
        await this.handleGeneralFileChange(filePath, displayPath);
      }
      
    } catch (error) {
      console.error(`[HotReload] ❌ Lỗi khi xử lý tệp ${filePath}:`, error.message);
      console.log(`[HotReload] ⚠️ Vui lòng kiểm tra cú pháp trong tệp và thử lại`);
    }
  }

  // Xử lý thay đổi config.js
  async handleConfigChange(filePath) {
    try {
      // Xóa bộ nhớ đệm module config
      delete require.cache[require.resolve('../config/config.js')];
      
      // Tải config mới
      const newConfig = require('../config/config.js');
      
      // So sánh config cũ và mới
      const changes = this.compareConfigs(this.currentConfig, newConfig);
      
      if (changes.length > 0) {
        if (this.currentConfig.debug) {
          console.log(`[HotReload] 🔄 Config.js đã thay đổi:`, changes);
        }
        
        // Cập nhật config hiện tại
        this.currentConfig = { ...newConfig };
        
        // Thông báo về các thay đổi
        this.notifyConfigChanges(changes);
      }
      
    } catch (error) {
      console.error(`[HotReload] ❌ Lỗi khi tải lại cấu hình:`, error.message);
      console.log(`[HotReload] ⚠️ Vui lòng kiểm tra cú pháp trong config.js`);
    }
  }

  // Xử lý thay đổi tệp thường
  async handleGeneralFileChange(filePath, displayPath) {
    try {
      // Kiểm tra xem tệp có tồn tại không
      if (!fs.existsSync(filePath)) {
        if (this.currentConfig.debug) {
          console.log(`[HotReload] 🗑️ Tệp đã bị xóa: ${displayPath}`);
        }
        return;
      }

      // Đọc nội dung tệp để kiểm tra cú pháp
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Nếu là tệp .js, kiểm tra cú pháp
      if (path.extname(filePath) === '.js') {
        // Xóa bộ nhớ đệm module cho tệp này
        const fullPath = path.resolve(filePath);
        delete require.cache[fullPath];
        
        // Try require to check syntax
        try {
          require(fullPath);
          if (this.currentConfig.debug) {
            console.log(`[HotReload] ✅ Đã tải lại: ${displayPath}`);
          }
        } catch (syntaxError) {
          console.error(`[HotReload] ❌ Lỗi cú pháp trong ${displayPath}:`, syntaxError.message);
          return;
        }
      } else {
        if (this.currentConfig.debug) {
          console.log(`[HotReload] 📄 Tệp đã thay đổi: ${displayPath}`);
        }
      }
      
      // Notify change
      this.notifyFileChange(displayPath);
      
    } catch (error) {
      console.error(`[HotReload] ❌ Lỗi khi xử lý ${displayPath}:`, error.message);
    }
  }

  // Compare 2 configs to find changes
  compareConfigs(oldConfig, newConfig) {
    const changes = [];
    
    // Check platform changes
    if (oldConfig.platform && newConfig.platform) {
      for (const platform in newConfig.platform) {
        if (oldConfig.platform[platform]) {
          for (const feature in newConfig.platform[platform]) {
            const oldValue = oldConfig.platform[platform][feature];
            const newValue = newConfig.platform[platform][feature];
            
            if (oldValue !== newValue) {
              changes.push({
                type: 'platform',
                platform: platform,
                feature: feature,
                oldValue: oldValue,
                newValue: newValue
              });
            }
          }
        }
      }
    }
    
    // Check other configs
    const otherKeys = ['maxQueue', 'debug', 'leaveOnEmpty'];
    for (const key of otherKeys) {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
        changes.push({
          type: 'general',
          key: key,
          oldValue: oldConfig[key],
          newValue: newConfig[key]
        });
      }
    }
    
    return changes;
  }

  // Notify about config changes
  notifyConfigChanges(changes) {
    if (this.currentConfig.debug) {
      console.log(`[HotReload] 📝 Chi tiết thay đổi cấu hình:`);
      
      changes.forEach(change => {
        if (change.type === 'platform') {
          const status = change.newValue ? '✅ BẬT' : '❌ TẮT';
          console.log(`   • ${change.platform}.${change.feature}: ${change.oldValue} → ${change.newValue} (${status})`);
        } else {
          console.log(`   • ${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
        }
      });
      
      console.log(`[HotReload] ✨ Các thay đổi cấu hình đã được áp dụng ngay lập tức!`);
    }
  }

  // Notify about file changes
  notifyFileChange(filePath) {
    if (this.currentConfig.debug) {
      console.log(`[HotReload] 🔄 Tệp đã được tải động: ${filePath}`);
    }
  }

  // Stop all watching
  stopWatching() {
    this.watchers.forEach((watcherInfo, path) => {
      try {
        watcherInfo.watcher.close();
      } catch (error) {
        console.error(`[HotReload] Lỗi khi dừng theo dõi ${path}:`, error.message);
      }
    });
    
    this.watchers.clear();
    this.isWatching = false;
    if (this.currentConfig.debug) {
      console.log(`[HotReload] 🛑 Đã dừng tất cả trình theo dõi tải động`);
    }
  }

  // Get current config (hot reloaded)
  getCurrentConfig() {
    // Always return latest config from cache
    delete require.cache[require.resolve('../config/config.js')];
    return require('../config/config.js');
  }

  // Get watcher statistics
  getStats() {
    const stats = {
      watching: this.isWatching,
      totalWatchers: this.watchers.size,
      coreFiles: this.coreFiles.length,
      watchDirectories: this.watchDirectories.length
    };
    
    return stats;
  }

  // Manual reload a file
  manualReload(filePath) {
    try {
      const fullPath = path.resolve(filePath);
      delete require.cache[fullPath];
      require(fullPath);
      console.log(`[HotReload] ✅ Đã reload thủ công: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`[HotReload] ❌ Lỗi reload thủ công ${filePath}:`, error.message);
      return false;
    }
  }
}

// Singleton instance
const hotReloader = new HotReloader();

module.exports = hotReloader;
