const UserStats = require('../models/UserStats');
const CommandStats = require('../models/CommandStats');
const MusicTrack = require('../models/MusicTrack');
const logger = require('../../utils/logger');

class ServerStatsService {
  // Cập nhật thống kê người dùng khi bắt đầu nghe nhạc
  static async startListeningSession(userId, guildId, username, trackId) {
    try {
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
      
      logger.debug('[ServerStats] Started listening session for user:', username);
      return userStats;
    } catch (error) {
      logger.error('[ServerStats] Error starting listening session:', error);
    }
  }

  // Kết thúc session nghe nhạc và cập nhật thời gian
  static async endListeningSession(userId, guildId) {
    try {
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
        
        logger.debug(`[ServerStats] Ended listening session for user ${userId}, duration: ${sessionDuration}s`);
        return sessionDuration;
      }
    } catch (error) {
      logger.error('[ServerStats] Error ending listening session:', error);
    }
  }

  // Ghi lại việc sử dụng lệnh
  static async logCommandUsage(userId, guildId, username, commandName) {
    try {
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
      
      logger.debug(`[ServerStats] Logged command usage: ${commandName} by ${username}`);
    } catch (error) {
      logger.error('[ServerStats] Error logging command usage:', error);
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
          { $group: { 
            _id: { userId: '$userId', username: '$username' },
            totalCommands: { $sum: '$usageCount' },
            lastUsed: { $max: '$lastUsed' }
          }},
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
          { $group: { 
            _id: '$commandName',
            totalUsage: { $sum: '$usageCount' },
            uniqueUsers: { $addToSet: '$userId' }
          }},
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
