const UserStats = require('../models/UserStats');
const CommandStats = require('../models/CommandStats');
const MusicTrack = require('../models/MusicTrack');
const logger = require('../../utils/logger');
const dbConnection = require('../connection');

class ServerStatsService {
  // Cập nhật thống kê người dùng khi bắt đầu nghe nhạc
  static async startListeningSession(userId, guildId, username, trackId) {
    try {
      // Kiểm tra tình trạng khả dụng của cơ sở dữ liệu
      if (!dbConnection.isAvailable) {
        logger.database('⚠️ [ServerStatsService] Cơ sở dữ liệu không khả dụng, bỏ qua bắt đầu phiên nghe');
        return null;
      }

      const userStats = await UserStats.findOneAndUpdate(
        { userId, guildId },
        {
          $set: {
            username,
            'currentSession.startTime': new Date(),
            'currentSession.trackId': trackId,
            'currentSession.isListening': true,
            lastActivity: new Date()
          }
        },
        { upsert: true, new: true }
      );

      logger.debug('[ServerStats] Bắt đầu phiên nghe cho người dùng:', username);
      return userStats;
    } catch (error) {
      logger.error('[ServerStats] Lỗi bắt đầu phiên nghe:', error);

      // Xử lý các lỗi cơ sở dữ liệu cụ thể
      if (error.code === 13 || error.message.includes('authentication')) {
        logger.error('❌ [ServerStatsService] Lỗi xác thực cơ sở dữ liệu:', error.message);
        logger.info('💡 Hãy xem xét kiểm tra cài đặt xác thực MongoDB trong config');
        dbConnection.isAvailable = false; // Đánh dấu là không khả dụng
      }

      return null;
    }
  }

  // Kết thúc session nghe nhạc và cập nhật thời gian
  static async endListeningSession(userId, guildId) {
    try {
      // Kiểm tra tình trạng khả dụng của cơ sở dữ liệu
      if (!dbConnection.isAvailable) {
        logger.database('⚠️ [ServerStatsService] Cơ sở dữ liệu không khả dụng, bỏ qua kết thúc phiên nghe');
        return null;
      }

      const userStats = await UserStats.findOne({ userId, guildId });

      if (userStats && userStats.currentSession && userStats.currentSession.isListening) {
        const sessionDuration = Math.floor((new Date() - userStats.currentSession.startTime) / 1000);

        await UserStats.findOneAndUpdate(
          { userId, guildId },
          {
            $inc: {
              totalListeningTime: sessionDuration,
              tracksPlayed: 1
            },
            $set: {
              'currentSession.isListening': false,
              lastActivity: new Date()
            }
          }
        );

        logger.debug(`[ServerStats] Kết thúc phiên nghe cho người dùng ${userId}, thời gian: ${sessionDuration}s`);
        return sessionDuration;
      }
    } catch (error) {
      logger.error('[ServerStats] Lỗi kết thúc phiên nghe:', error);

      // Xử lý các lỗi cơ sở dữ liệu cụ thể
      if (error.code === 13 || error.message.includes('authentication')) {
        logger.error('❌ [ServerStatsService] Lỗi xác thực cơ sở dữ liệu:', error.message);
        logger.info('💡 Hãy xem xét kiểm tra cài đặt xác thực MongoDB trong config');
        dbConnection.isAvailable = false; // Đánh dấu là không khả dụng
      }

      return null;
    }
  }

  // Ghi lại việc sử dụng lệnh
  static async logCommandUsage(userId, guildId, username, commandName) {
    try {
      // Kiểm tra tình trạng khả dụng của cơ sở dữ liệu
      if (!dbConnection.isAvailable) {
        logger.database('⚠️ [ServerStatsService] Cơ sở dữ liệu không khả dụng, bỏ qua ghi log sử dụng lệnh');
        return null;
      }

      await CommandStats.findOneAndUpdate(
        { userId, guildId, commandName },
        {
          $inc: { usageCount: 1 },
          $set: {
            username,
            lastUsed: new Date()
          },
          $setOnInsert: { firstUsed: new Date() }
        },
        { upsert: true }
      );

      logger.debug(`[ServerStats] Đã ghi log sử dụng lệnh: ${commandName} bởi ${username}`);
    } catch (error) {
      logger.error('[ServerStats] Lỗi ghi log sử dụng lệnh:', error);

      // Xử lý các lỗi cơ sở dữ liệu cụ thể
      if (error.code === 13 || error.message.includes('authentication')) {
        logger.error('❌ [ServerStatsService] Lỗi xác thực cơ sở dữ liệu:', error.message);
        logger.info('💡 Hãy xem xét kiểm tra cài đặt xác thực MongoDB trong config');
        dbConnection.isAvailable = false; // Đánh dấu là không khả dụng
      }
    }
  }

  // Lấy thống kê tổng quan của server
  static async getServerStats(guildId) {
    try {
      const [
        totalUsers,
        totalCommands,
        totalTracks,
        topListeners,
        topCommanders,
        recentTracks,
        commandUsageStats
      ] = await Promise.all([
        // Tổng số người dùng đã tương tác
        UserStats.countDocuments({ guildId }),

        // Tổng số lệnh đã sử dụng
        CommandStats.aggregate([
          { $match: { guildId } },
          { $group: { _id: null, total: { $sum: '$usageCount' } } }
        ]),

        // Tổng số bài đã phát
        MusicTrack.countDocuments({ guildId }),

        // Top 5 người nghe nhiều nhất
        UserStats.find({ guildId })
          .sort({ totalListeningTime: -1 })
          .limit(5)
          .select('userId username totalListeningTime tracksPlayed lastActivity'),

        // Top 5 người sử dụng lệnh nhiều nhất
        CommandStats.aggregate([
          { $match: { guildId } },
          {
            $group: {
              _id: { userId: '$userId', username: '$username' },
              totalCommands: { $sum: '$usageCount' },
              lastUsed: { $max: '$lastUsed' }
            }
          },
          { $sort: { totalCommands: -1 } },
          { $limit: 5 }
        ]),

        // 10 bài gần nhất
        MusicTrack.find({ guildId })
          .sort({ playedAt: -1 })
          .limit(10)
          .select('title platform contentType username playedAt duration'),

        // Thống kê sử dụng lệnh theo loại
        CommandStats.aggregate([
          { $match: { guildId } },
          {
            $group: {
              _id: '$commandName',
              totalUsage: { $sum: '$usageCount' },
              uniqueUsers: { $addToSet: '$userId' }
            }
          },
          { $addFields: { uniqueUserCount: { $size: '$uniqueUsers' } } },
          { $project: { uniqueUsers: 0 } },
          { $sort: { totalUsage: -1 } }
        ])
      ]);

      return {
        overview: {
          totalUsers,
          totalCommands: totalCommands[0]?.total || 0,
          totalTracks
        },
        topListeners: topListeners.map(user => ({
          userId: user.userId,
          username: user.username,
          totalListeningTime: user.totalListeningTime,
          tracksPlayed: user.tracksPlayed,
          lastActivity: user.lastActivity,
          listeningHours: Math.round((user.totalListeningTime / 3600) * 10) / 10
        })),
        topCommanders: topCommanders.map(cmd => ({
          userId: cmd._id.userId,
          username: cmd._id.username,
          totalCommands: cmd.totalCommands,
          lastUsed: cmd.lastUsed
        })),
        recentTracks: recentTracks.map(track => ({
          title: track.title,
          platform: track.platform,
          contentType: track.contentType,
          username: track.username,
          playedAt: track.playedAt,
          duration: track.duration
        })),
        commandStats: commandUsageStats.map(cmd => ({
          commandName: cmd._id,
          totalUsage: cmd.totalUsage,
          uniqueUsers: cmd.uniqueUserCount
        }))
      };
    } catch (error) {
      logger.error('[ServerStats] Error getting server stats:', error);
      return null;
    }
  }

  // Lấy thống kê chi tiết của một người dùng
  static async getUserStats(userId, guildId) {
    try {
      const [userStats, userCommands, userTracks] = await Promise.all([
        UserStats.findOne({ userId, guildId }),
        CommandStats.find({ userId, guildId }).sort({ usageCount: -1 }),
        MusicTrack.find({ userId, guildId }).sort({ playedAt: -1 }).limit(20)
      ]);

      return {
        listeningStats: userStats ? {
          totalListeningTime: userStats.totalListeningTime,
          listeningHours: Math.round((userStats.totalListeningTime / 3600) * 10) / 10,
          tracksPlayed: userStats.tracksPlayed,
          lastActivity: userStats.lastActivity
        } : null,
        commandStats: userCommands.map(cmd => ({
          commandName: cmd.commandName,
          usageCount: cmd.usageCount,
          lastUsed: cmd.lastUsed,
          firstUsed: cmd.firstUsed
        })),
        recentTracks: userTracks.map(track => ({
          title: track.title,
          platform: track.platform,
          playedAt: track.playedAt,
          duration: track.duration
        }))
      };
    } catch (error) {
      logger.error('[ServerStats] Error getting user stats:', error);
      return null;
    }
  }
}

module.exports = ServerStatsService;
