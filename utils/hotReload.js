const fs = require('fs');
const path = require('path');
const config = require('../config/config.js');

class HotReloader {
  constructor() {
    this.configPath = path.join(__dirname, '../config/config.js');
    this.currentConfig = { ...config };
    this.watchers = new Map();
    this.isWatching = false;
    
    // List of CORE files that cannot be hot reloaded (require bot restart)
    this.coreFiles = [
      'index.js',
      'package.json', 
      'events/ready.js',
      'events/interactionCreate.js', 
      'events/messageCreate.js',
      'events/guildCreate.js',
      'utils/loader.js'
    ];
    
    // List of directories to watch for hot reloading
    this.watchDirectories = [
      'commands',
      'config',
      'utils/queueManager.js',
      'dashboard'
    ];
    
    // File cache for loaded files
    this.fileCache = new Map();
  }

  // Start watching all files
  startWatching() {
    if (this.isWatching) return;
    
    this.isWatching = true;
    
    try {
      // Watch config.js specially
      this.watchFile(this.configPath, 'config');
      
      // Watch root directory to detect core file changes
      this.watchDirectory(path.join(__dirname, '..'), '', true);
      
      // Watch directories
      this.watchDirectories.forEach(dir => {
        const fullPath = path.join(__dirname, '..', dir);
        if (fs.existsSync(fullPath)) {
          this.watchDirectory(fullPath, dir);
        }
      });

      console.log(`[TaiDong] 🔥 Hệ thống tải động đã được kích hoạt cho tất cả tệp`);
      if (this.currentConfig.debug) {
        console.log(`[TaiDong] 📂 Đang theo dõi: ${this.watchers.size} tệp/thư mục`);
        console.log(`[TaiDong] 🚫 Tệp cốt lõi (cần khởi động lại): ${this.coreFiles.length}`);
      }
      
    } catch (error) {
      console.error(`[TaiDong] ❌ Lỗi khi bắt đầu theo dõi:`, error.message);
    }
  }

  // Watch a specific file
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
      console.error(`[TaiDong] ❌ Không thể theo dõi tệp ${filePath}:`, error.message);
    }
  }

  // Watch directory recursively
  watchDirectory(dirPath, relativePath, isRootWatch = false) {
    try {
      // Watch main directory
      const watchRecursive = !isRootWatch; // Root only watches non-recursively
      const watcher = fs.watch(dirPath, { persistent: true, recursive: watchRecursive }, (eventType, filename) => {
        if (eventType === 'change' && filename) {
          const fullPath = path.join(dirPath, filename);
          const relativeFilePath = relativePath ? path.join(relativePath, filename).replace(/\\/g, '/') : filename;
          
          // If root watch, only care about core files
          if (isRootWatch) {
            if (this.isCoreFile(relativeFilePath)) {
              console.log(`[TaiDong] ⚠️ CẢNH BÁO: Tệp cốt lõi đã thay đổi: ${relativeFilePath}`);
              console.log(`[TaiDong] 🔄 Vui lòng KHỞI ĐỘNG LẠI bot để áp dụng thay đổi tệp cốt lõi!`);
              console.log(`[TaiDong] 📋 Lý do: Tệp cốt lõi không thể tải động vì lý do bảo mật và ổn định.`);
            }
            return; // Don't process hot reload for root watch
          }
          
          // Check if it's a core file
          if (this.isCoreFile(relativeFilePath)) {
            console.log(`[TaiDong] ⚠️ Tệp cốt lõi đã thay đổi: ${relativeFilePath}`);
            console.log(`[TaiDong] 🔄 Vui lòng khởi động lại bot để áp dụng thay đổi!`);
            return;
          }
          
          this.handleFileChange(fullPath, 'directory', relativeFilePath);
        }
      });
      
      this.watchers.set(dirPath, { watcher, type: 'directory' });
      
    } catch (error) {
      console.error(`[TaiDong] ❌ Không thể theo dõi thư mục ${dirPath}:`, error.message);
    }
  }

  // Check if file is a core file
  isCoreFile(filePath) {
    return this.coreFiles.some(coreFile => 
      filePath.includes(coreFile) || filePath.endsWith(coreFile)
    );
  }

  // Handle file changes
  async handleFileChange(filePath, type, relativePath = null) {
    try {
      // Wait a bit for file to be written completely
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const displayPath = relativePath || path.relative(path.join(__dirname, '..'), filePath);
      
      if (type === 'config') {
        await this.handleConfigChange(filePath);
      } else {
        await this.handleGeneralFileChange(filePath, displayPath);
      }
      
    } catch (error) {
      console.error(`[TaiDong] ❌ Lỗi khi xử lý tệp ${filePath}:`, error.message);
      console.log(`[TaiDong] ⚠️ Vui lòng kiểm tra cú pháp trong tệp và thử lại`);
    }
  }

  // Handle config.js changes
  async handleConfigChange(filePath) {
    try {
      // Clear config module cache
      delete require.cache[require.resolve('../config/config.js')];
      
      // Load new config
      const newConfig = require('../config/config.js');
      
      // Compare old and new config
      const changes = this.compareConfigs(this.currentConfig, newConfig);
      
      if (changes.length > 0) {
        if (this.currentConfig.debug) {
          console.log(`[TaiDong] 🔄 Config.js đã thay đổi:`, changes);
        }
        
        // Update current config
        this.currentConfig = { ...newConfig };
        
        // Notify about changes
        this.notifyConfigChanges(changes);
      }
      
    } catch (error) {
      console.error(`[TaiDong] ❌ Lỗi khi tải lại cấu hình:`, error.message);
      console.log(`[TaiDong] ⚠️ Vui lòng kiểm tra cú pháp trong config.js`);
    }
  }

  // Handle general file changes
  async handleGeneralFileChange(filePath, displayPath) {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        if (this.currentConfig.debug) {
          console.log(`[TaiDong] 🗑️ Tệp đã bị xóa: ${displayPath}`);
        }
        return;
      }

      // Read file content to check syntax
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      // If it's a .js file, check syntax
      if (path.extname(filePath) === '.js') {
        // Clear module cache for this file
        const fullPath = path.resolve(filePath);
        delete require.cache[fullPath];
        
        // Try require to check syntax
        try {
          require(fullPath);
          if (this.currentConfig.debug) {
            console.log(`[TaiDong] ✅ Đã tải lại: ${displayPath}`);
          }
        } catch (syntaxError) {
          console.error(`[TaiDong] ❌ Lỗi cú pháp trong ${displayPath}:`, syntaxError.message);
          return;
        }
      } else {
        if (this.currentConfig.debug) {
          console.log(`[TaiDong] 📄 Tệp đã thay đổi: ${displayPath}`);
        }
      }
      
      // Notify change
      this.notifyFileChange(displayPath);
      
    } catch (error) {
      console.error(`[TaiDong] ❌ Lỗi khi xử lý ${displayPath}:`, error.message);
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
      console.log(`[TaiDong] 📝 Chi tiết thay đổi cấu hình:`);
      
      changes.forEach(change => {
        if (change.type === 'platform') {
          const status = change.newValue ? '✅ BẬT' : '❌ TẮT';
          console.log(`   • ${change.platform}.${change.feature}: ${change.oldValue} → ${change.newValue} (${status})`);
        } else {
          console.log(`   • ${change.key}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`);
        }
      });
      
      console.log(`[TaiDong] ✨ Các thay đổi cấu hình đã được áp dụng ngay lập tức!`);
    }
  }

  // Notify about file changes
  notifyFileChange(filePath) {
    if (this.currentConfig.debug) {
      console.log(`[TaiDong] 🔄 Tệp đã được tải động: ${filePath}`);
    }
  }

  // Stop all watching
  stopWatching() {
    this.watchers.forEach((watcherInfo, path) => {
      try {
        watcherInfo.watcher.close();
      } catch (error) {
        console.error(`[TaiDong] Lỗi khi dừng theo dõi ${path}:`, error.message);
      }
    });
    
    this.watchers.clear();
    this.isWatching = false;
    if (this.currentConfig.debug) {
      console.log(`[TaiDong] 🛑 Đã dừng tất cả trình theo dõi tải động`);
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
      console.log(`[TaiDong] ✅ Đã reload thủ công: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`[TaiDong] ❌ Lỗi reload thủ công ${filePath}:`, error.message);
      return false;
    }
  }
}

// Singleton instance
const hotReloader = new HotReloader();

module.exports = hotReloader;
