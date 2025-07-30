const mongoose = require('mongoose');
const logger = require('../utils/logger');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.isAvailable = true; // Cờ hiệu để biết MongoDB có sẵn không
    this.config = null;
  }

  async connect() {
    try {
      if (this.isConnected) {
        logger.database('📊 Cơ sở dữ liệu đã được kết nối');
        return;
      }

      // Tải cấu hình
      this.config = require('../config/config').mongodb;

      // Xây dựng MongoDB URI từ các thành phần cấu hình
      let mongoURI;
      if (this.config.auth.enabled && this.config.auth.username && this.config.auth.password) {
        // URI với xác thực
        const authString = `${encodeURIComponent(this.config.auth.username)}:${encodeURIComponent(this.config.auth.password)}`;
        mongoURI = `mongodb://${authString}@${this.config.ip}:${this.config.port}/${this.config.database}`;
        logger.connection('🔐 Đã bật xác thực MongoDB');
      } else {
        // URI không có xác thực
        mongoURI = `mongodb://${this.config.ip}:${this.config.port}/${this.config.database}`;
      }

      // Sử dụng cấu hình kết nối từ config
      let connectOptions = {
        ...this.config.connection,
        authSource: this.config.auth.authSource
      };

      logger.connection('🔌 Đang kết nối tới MongoDB...');
      logger.connection('🔗 URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Ẩn thông tin xác thực trong log

      await mongoose.connect(mongoURI, connectOptions);

      this.isConnected = true;
      this.isAvailable = true;
      logger.core('🍃 Kết nối MongoDB thành công');
      logger.database('🔗 Cơ sở dữ liệu:', mongoose.connection.name);
      logger.database('🏠 Máy chủ:', mongoose.connection.host + ':' + mongoose.connection.port);

      // Thực hiện kiểm tra sức khỏe
      await this.performHealthChecks();

      // Kiểm tra và khởi tạo cơ sở dữ liệu nếu cần
      await this.checkAndInitializeDatabase();

      // Xử lý các sự kiện kết nối
      mongoose.connection.on('error', (err) => {
        console.error('❌ Lỗi kết nối MongoDB:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.connection('📊 Đã ngắt kết nối MongoDB');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.connection('🔄 Đã kết nối lại MongoDB');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ Kết nối MongoDB thất bại:', error.message);
      console.log('⚠️ Chạy mà không có cơ sở dữ liệu - phiên làm việc chỉ lưu trong bộ nhớ');
      console.log('💡 Để bật tính năng cơ sở dữ liệu, vui lòng cài đặt và khởi động MongoDB');

      this.isConnected = false;
      this.isAvailable = false;

      // Không throw error để app vẫn chạy được
      return false;
    }
  }

  /**
   * Kiểm tra và khởi tạo cơ sở dữ liệu nếu yêu cầu xác thực
   * Xử lý dọn dẹp nguồn xác thực và thiết lập cơ sở dữ liệu
   */
  async checkAndInitializeDatabase() {
    try {
      logger.database('\n🔍 Đang kiểm tra khởi tạo cơ sở dữ liệu...');

      if (!this.config.auth.enabled) {
        logger.database('✅ Không yêu cầu xác thực, bỏ qua khởi tạo cơ sở dữ liệu');
        return;
      }

      // Trích xuất tên cơ sở dữ liệu từ cấu hình hoặc URI
      const dbName = this.config.database || this.extractDatabaseFromURI(mongoURI);
      const authSource = this.config.auth.authSource;

      logger.database(`🔐 Đã bật xác thực cho cơ sở dữ liệu: ${dbName}`);
      logger.database(`🔐 Nguồn xác thực: ${authSource}`);

      // Kiểm tra xem chúng ta có đang sử dụng nguồn xác thực khác không
      if (authSource && authSource !== dbName) {
        logger.database(`⚠️ Đang sử dụng nguồn xác thực bên ngoài: ${authSource}`);
        logger.database('💡 Điều này cho thấy MongoDB đã được cấu hình thủ công với xác thực');

        // Kiểm tra các bộ sưu tập bắt buộc trong nguồn xác thực có thể cần dọn dẹp
        await this.checkAuthSourceCleanup();
      }

      // Đảm bảo cơ sở dữ liệu đích tồn tại và có cấu trúc yêu cầu
      await this.initializeAppDatabase();

    } catch (error) {
      console.error('❌ Lỗi khởi tạo cơ sở dữ liệu:', error.message);
      // Không làm thất bại kết nối, chỉ cảnh báo
      console.warn('⚠️ Tiếp tục với chức năng cơ sở dữ liệu cơ bản...');
    }
  }

  /**
   * Trích xuất tên cơ sở dữ liệu từ MongoDB URI hoặc sử dụng từ cấu hình
   */
  extractDatabaseFromURI(uri) {
    try {
      // Nếu có cấu hình database rõ ràng, sử dụng nó
      if (this.config && this.config.database) {
        return this.config.database;
      }

      // Nếu không, cố gắng trích xuất từ URI
      const match = uri.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : 'discord-music-bot';
    } catch (error) {
      console.warn('⚠️ Không thể trích xuất tên cơ sở dữ liệu từ URI, sử dụng mặc định');
      return 'discord-music-bot';
    }
  }

  /**
   * Kiểm tra nguồn xác thực cho các bộ sưu tập bắt buộc cần được dọn dẹp
   */
  async checkAuthSourceCleanup() {
    try {
      // Kiểm tra xem việc dọn dẹp có được bật không
      if (!this.config.initialization || !this.config.initialization.cleanupAuthSource) {
        logger.database('🔧 Dọn dẹp nguồn xác thực đã bị tắt trong cấu hình');
        return;
      }

      const authSource = this.config.auth.authSource;
      const currentDb = mongoose.connection.name;

      // Chỉ tiếp tục nếu nguồn xác thực khác với cơ sở dữ liệu hiện tại
      if (authSource === currentDb) {
        return;
      }

      logger.database(`🧹 Đang kiểm tra nguồn xác thực '${authSource}' để dọn dẹp...`);

      // Kết nối tới cơ sở dữ liệu nguồn xác thực để kiểm tra các bộ sưu tập bắt buộc
      const authDb = mongoose.connection.client.db(authSource);
      const collections = await authDb.listCollections().toArray();

      // Lấy các mẫu dọn dẹp từ cấu hình
      const cleanupPatterns = this.config.initialization.cleanupPatterns || [
        'temp_',
        'setup_',
        'initial_',
        'auth_temp',
        'bootstrap_'
      ];

      const collectionsToCleanup = collections.filter(col =>
        cleanupPatterns.some(pattern =>
          col.name.includes(pattern)
        ) && !col.name.startsWith('system.')  // Không chạm vào các bộ sưu tập hệ thống
      );

      if (collectionsToCleanup.length > 0) {
        logger.database(`🗑️ Tìm thấy ${collectionsToCleanup.length} bộ sưu tập cần dọn dẹp trong nguồn xác thực:`);

        for (const collection of collectionsToCleanup) {
          try {
            logger.database(`   - Đang xóa bộ sưu tập tạm thời: ${collection.name}`);
            await authDb.collection(collection.name).drop();
            logger.database(`   ✅ Đã dọn dẹp: ${collection.name}`);
          } catch (dropError) {
            // Bộ sưu tập có thể không tồn tại hoặc không có quyền, tiếp tục
            logger.database(`   ⚠️ Không thể xóa ${collection.name}: ${dropError.message}`);
          }
        }
      } else {
        logger.database('✅ Không tìm thấy bộ sưu tập tạm thời nào trong nguồn xác thực');
      }

    } catch (error) {
      logger.warn('⚠️ Kiểm tra dọn dẹp nguồn xác thực thất bại:', error.message);
      logger.database('💡 Điều này bình thường nếu nguồn xác thực được quản lý bên ngoài');
    }
  }

  /**
   * Khởi tạo cơ sở dữ liệu ứng dụng với các bộ sưu tập và chỉ mục cần thiết
   */
  async initializeAppDatabase() {
    try {
      logger.database('\n🏗️ Đang khởi tạo cơ sở dữ liệu ứng dụng...');

      // Kiểm tra xem việc khởi tạo có được bật không
      if (!this.config.initialization || !this.config.initialization.enabled) {
        logger.database('🔧 Khởi tạo cơ sở dữ liệu đã bị tắt trong cấu hình');
        return;
      }

      const db = mongoose.connection.db;

      // Tạo các bộ sưu tập cần thiết nếu được bật
      if (this.config.initialization.createRequiredCollections) {
        const existingCollections = await db.listCollections().toArray();
        const existingNames = existingCollections.map(col => col.name);

        // Các bộ sưu tập cần thiết cho bot nhạc
        const requiredCollections = [
          'musictracks',
          'userstats',
          'commandstats',
          'usersessions',
          'server'
        ];

        logger.database('📋 Đang kiểm tra các bộ sưu tập cần thiết...');
        for (const collectionName of requiredCollections) {
          if (!existingNames.includes(collectionName)) {
            logger.database(`   📁 Đang tạo bộ sưu tập: ${collectionName}`);
            await db.createCollection(collectionName);
            logger.database(`   ✅ Đã tạo: ${collectionName}`);
          } else {
            logger.database(`   ✅ Đã tồn tại: ${collectionName}`);
          }
        }
      }

      // Tạo chỉ mục nếu được bật
      if (this.config.initialization.createIndexes) {
        await this.createRequiredIndexes();
      }

      logger.database('✅ Hoàn thành khởi tạo cơ sở dữ liệu');

    } catch (error) {
      console.error('❌ Khởi tạo cơ sở dữ liệu thất bại:', error.message);
      throw error;
    }
  }

  /**
   * Tạo các chỉ mục cần thiết để tối ưu hiệu suất
   */
  async createRequiredIndexes() {
    try {
      logger.database('🔍 Đang tạo chỉ mục cơ sở dữ liệu...');

      const db = mongoose.connection.db;

      // Chỉ mục MusicTracks
      const musicTracks = db.collection('musictracks');
      await musicTracks.createIndex({ "url": 1 });
      await musicTracks.createIndex({ "guildId": 1, "timestamp": -1 });
      await musicTracks.createIndex({ "platform.platform": 1 });

      // Chỉ mục UserStats  
      const userStats = db.collection('userstats');
      await userStats.createIndex({ "userId": 1, "guildId": 1 }, { unique: true });
      await userStats.createIndex({ "lastActivity": -1 });

      // Chỉ mục CommandStats
      const commandStats = db.collection('commandstats');
      await commandStats.createIndex({ "userId": 1, "guildId": 1, "commandName": 1 }, { unique: true });
      await commandStats.createIndex({ "lastUsed": -1 });

      // Chỉ mục UserSessions
      const userSessions = db.collection('usersessions');
      await userSessions.createIndex({ "userId": 1, "guildId": 1 });
      await userSessions.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // TTL 7 ngày

      logger.database('✅ Tạo chỉ mục cơ sở dữ liệu thành công');

    } catch (error) {
      logger.warn('⚠️ Cảnh báo tạo chỉ mục:', error.message);
      logger.database('💡 Một số chỉ mục có thể đã tồn tại, tiếp tục...');
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.connection('📊 Đã ngắt kết nối MongoDB');
    } catch (error) {
      console.error('❌ Lỗi ngắt kết nối MongoDB:', error);
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isAvailable: this.isAvailable,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  // Helper method để check nếu có thể dùng database
  canUseDatabase() {
    return this.isAvailable && this.isConnected;
  }

  // Thực hiện kiểm tra sức khỏe để xác minh các hoạt động cơ sở dữ liệu
  async performHealthChecks() {
    if (!this.config?.healthCheck?.enabled) {
      logger.database('🔍 Kiểm tra sức khỏe cơ sở dữ liệu đã bị tắt');
      return true;
    }

    try {
      logger.database('🔍 Đang thực hiện kiểm tra sức khỏe cơ sở dữ liệu...');

      // Kiểm tra kết nối cơ sở dữ liệu
      const adminDb = mongoose.connection.db.admin();
      const pingResult = await adminDb.ping();
      logger.database('✅ Ping cơ sở dữ liệu thành công:', pingResult);

      // Kiểm tra các hoạt động đọc/ghi
      const testCollectionName = this.config.healthCheck.testCollection;
      const testCollection = mongoose.connection.db.collection(testCollectionName);

      // Kiểm tra hoạt động ghi
      const testDoc = {
        ...this.config.healthCheck.testDocument,
        timestamp: new Date()
      };

      logger.database('🔍 Đang kiểm tra hoạt động ghi...');
      const writeResult = await testCollection.insertOne(testDoc);
      logger.database('✅ Kiểm tra ghi thành công:', writeResult.insertedId);

      // Kiểm tra hoạt động đọc
      logger.database('🔍 Đang kiểm tra hoạt động đọc...');
      const readResult = await testCollection.findOne({ _id: writeResult.insertedId });
      logger.database('✅ Kiểm tra đọc thành công:', !!readResult);

      // Kiểm tra hoạt động cập nhật
      logger.database('🔍 Đang kiểm tra hoạt động cập nhật...');
      const updateResult = await testCollection.updateOne(
        { _id: writeResult.insertedId },
        { $set: { updated: true, updatedAt: new Date() } }
      );
      logger.database('✅ Kiểm tra cập nhật thành công:', updateResult.modifiedCount);

      // Kiểm tra hoạt động xóa
      logger.database('🔍 Đang kiểm tra hoạt động xóa...');
      const deleteResult = await testCollection.deleteOne({ _id: writeResult.insertedId });
      logger.database('✅ Kiểm tra xóa thành công:', deleteResult.deletedCount);

      // Kiểm tra quyền người dùng
      await this.testUserPermissions();

      logger.database('✅ Tất cả kiểm tra sức khỏe cơ sở dữ liệu đã thành công!');
      return true;

    } catch (error) {
      console.error('❌ Kiểm tra sức khỏe cơ sở dữ liệu thất bại:', error.message);
      console.error('❌ Lỗi đầy đủ:', error);

      // Xác định xem có phải lỗi xác thực không
      if (error.code === 13 || error.message.includes('authentication') || error.message.includes('unauthorized')) {
        console.error('🔐 Phát hiện lỗi xác thực. Hãy xem xét:');
        console.error('   1. Bật xác thực trong config.mongodb.auth');
        console.error('   2. Thiết lập biến môi trường MONGO_USERNAME và MONGO_PASSWORD');
        console.error('   3. Kiểm tra xem MongoDB có yêu cầu xác thực không');
      }

      return false;
    }
  }

  // Kiểm tra quyền người dùng
  async testUserPermissions() {
    try {
      logger.database('🔍 Đang kiểm tra quyền người dùng...');

      // Kiểm tra liệt kê các bộ sưu tập
      const collections = await mongoose.connection.db.listCollections().toArray();
      logger.database('✅ Có thể liệt kê bộ sưu tập:', collections.length, 'bộ sưu tập được tìm thấy');

      // Kiểm tra tạo bộ sưu tập nếu cần
      const testCollectionName = 'permission_test_' + Date.now();
      const testCollection = mongoose.connection.db.collection(testCollectionName);

      await testCollection.insertOne({ test: true });
      await testCollection.drop();
      logger.database('✅ Có thể tạo/xóa bộ sưu tập');

    } catch (error) {
      logger.warn('⚠️ Phát hiện quyền hạn chế:', error.message);

      if (error.code === 13) {
        logger.warn('   - Người dùng có thể không có quyền quản trị đầy đủ');
        logger.warn('   - Đọc/ghi cơ bản vẫn sẽ hoạt động');
      }
    }
  }
}

module.exports = new DatabaseConnection();
