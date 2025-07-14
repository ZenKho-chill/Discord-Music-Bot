const UserSession = require('../models/UserSession');
const dbConnection = require('../connection');
const logger = require('../../utils/logger');

// Memory fallback khi không có database
const memoryCache = new Map();

class UserSessionService {
    
    // Helper để check có thể dùng database không
    canUseDatabase() {
        return dbConnection.canUseDatabase();
    }

    // Tạo hoặc cập nhật user session
    async createOrUpdateSession(profile, accessToken, refreshToken) {
        try {
            const sessionData = {
                discordId: profile.id,
                username: profile.username,
                global_name: profile.global_name || null,
                discriminator: profile.discriminator || '0',
                avatarHash: profile.avatar, // Lưu avatar hash thuần, không phải URL
                email: profile.email || null,
                accessToken: accessToken,
                refreshToken: refreshToken,
                tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
                lastLogin: new Date()
            };

            if (this.canUseDatabase()) {
                // Dùng database
                const existingSession = await UserSession.findByDiscordId(profile.id);
                
                if (existingSession) {
                    // Existing user - preserve isFirstVisit flag
                    Object.assign(existingSession, sessionData);
                    // Don't change isFirstVisit for existing users
                    await existingSession.save();
                    logger.database('🔄 Updated user session in DB for:', profile.username);
                    return existingSession;
                } else {
                    // New user - isFirstVisit will be true by default
                    const newSession = new UserSession(sessionData);
                    await newSession.save();
                    logger.database('✨ Created new user session in DB for:', profile.username);
                    return newSession;
                }
            } else {
                // Fallback to memory
                const existingData = memoryCache.get(profile.id);
                if (existingData) {
                    // Preserve isFirstVisit for existing users
                    sessionData.isFirstVisit = existingData.isFirstVisit || false;
                } else {
                    // New user
                    sessionData.isFirstVisit = true;
                }
                memoryCache.set(profile.id, sessionData);
                logger.database('💾 Saved user session in memory for:', profile.username);
                return sessionData;
            }
        } catch (error) {
            console.error('❌ Error creating/updating user session:', error);
            
            // Fallback to memory khi database lỗi
            const sessionData = {
                discordId: profile.id,
                username: profile.username,
                global_name: profile.global_name || null,
                discriminator: profile.discriminator || '0',
                avatar: profile.avatar, // Lưu avatar hash thuần
                accessToken: accessToken,
                refreshToken: refreshToken,
                tokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                lastLogin: new Date()
            };
            memoryCache.set(profile.id, sessionData);
            logger.database('🚨 Fallback: Saved user session in memory for:', profile.username);
            return sessionData;
        }
    }

    // Lấy user session bằng Discord ID
    async getSessionByDiscordId(discordId) {
        try {
            if (this.canUseDatabase()) {
                // Dùng database
                const session = await UserSession.findByDiscordId(discordId);
                
                if (!session) {
                    return null;
                }

                // Kiểm tra token có còn hợp lệ không
                if (!session.isTokenValid()) {
                    logger.auth('⚠️ Token expired for user:', session.username);
                    await session.deleteOne();
                    return null;
                }

                // Cập nhật last activity
                await session.updateActivity();
                return session;
            } else {
                // Fallback to memory
                const session = memoryCache.get(discordId);
                if (!session) {
                    return null;
                }

                // Kiểm tra token có còn hợp lệ không
                if (session.tokenExpiry && session.tokenExpiry < new Date()) {
                    logger.auth('⚠️ Token expired in memory for user:', session.username);
                    memoryCache.delete(discordId);
                    return null;
                }

                return session;
            }
        } catch (error) {
            console.error('❌ Error getting user session:', error);
            
            // Fallback to memory
            const session = memoryCache.get(discordId);
            if (session && session.tokenExpiry > new Date()) {
                return session;
            }
            return null;
        }
    }

    // Lấy user session bằng remember token
    async getSessionByRememberToken(rememberToken) {
        try {
            if (this.canUseDatabase()) {
                const session = await UserSession.findByRememberToken(rememberToken);
                
                if (!session) {
                    return null;
                }

                // Kiểm tra token có còn hợp lệ không
                if (!session.isTokenValid()) {
                    logger.auth('⚠️ Remember token expired for user:', session.username);
                    await session.deleteOne();
                    return null;
                }

                // Cập nhật last activity
                await session.updateActivity();
                return session;
            } else {
                // Memory fallback không support remember token
                return null;
            }
        } catch (error) {
            logger.error('❌ Error getting session by remember token:', error);
            return null;
        }
    }

    // Tạo remember token cho user
    async createRememberToken(discordId) {
        try {
            if (!this.canUseDatabase()) {
                logger.auth('⚠️ Remember token requires database');
                return null;
            }

            const session = await UserSession.findByDiscordId(discordId);
            if (!session) {
                logger.error('❌ User session not found for Discord ID:', discordId);
                throw new Error('User session not found');
            }

            const rememberToken = session.generateRememberToken();
            await session.save();
            
            logger.auth('🔑 Generated remember token for:', session.username);
            return rememberToken;
        } catch (error) {
            logger.error('❌ Error creating remember token:', error);
            return null;
        }
    }

    // Xóa remember token
    async clearRememberToken(discordId) {
        try {
            if (!this.canUseDatabase()) {
                return;
            }

            const session = await UserSession.findByDiscordId(discordId);
            if (session && session.rememberToken) {
                await session.clearRememberToken();
                logger.auth('🗑️ Cleared remember token for:', session.username);
            }
        } catch (error) {
            logger.error('❌ Error clearing remember token:', error);
        }
    }

    // Cập nhật guilds cache
    async updateGuildsCache(discordId, guildsData, cacheMinutes = 5) {
        try {
            if (this.canUseDatabase()) {
                const session = await UserSession.findByDiscordId(discordId);
                if (!session) {
                    throw new Error('User session not found');
                }

                await session.updateGuildsCache(guildsData, cacheMinutes);
                logger.database('💾 Updated guilds cache in DB for:', session.username);
                return session;
            } else {
                // Fallback to memory
                const session = memoryCache.get(discordId);
                if (!session) {
                    throw new Error('User session not found in memory');
                }

                session.guildsCache = {
                    data: guildsData,
                    lastFetch: new Date(),
                    expiresAt: new Date(Date.now() + cacheMinutes * 60 * 1000)
                };
                memoryCache.set(discordId, session);
                logger.database('💾 Updated guilds cache in memory for:', session.username);
                return session;
            }
        } catch (error) {
            logger.error('❌ Error updating guilds cache:', error);
            throw error;
        }
    }

    // Lấy guilds từ cache hoặc API
    async getGuildsFromCache(discordId) {
        try {
            if (this.canUseDatabase()) {
                const session = await UserSession.findByDiscordId(discordId);
                if (!session) {
                    return null;
                }

                // Kiểm tra cache có còn hợp lệ không
                if (session.isGuildsCacheValid()) {
                    logger.database('📋 Using cached guilds from DB for:', session.username);
                    return session.guildsCache.data;
                }

                logger.database('🔄 Guilds cache expired in DB for:', session.username);
                return null;
            } else {
                // Fallback to memory
                const session = memoryCache.get(discordId);
                if (!session || !session.guildsCache) {
                    return null;
                }

                // Kiểm tra cache có còn hợp lệ không
                if (session.guildsCache.expiresAt && session.guildsCache.expiresAt > new Date()) {
                    logger.database('📋 Using cached guilds from memory for:', session.username);
                    return session.guildsCache.data;
                }

                logger.database('🔄 Guilds cache expired in memory for:', session.username);
                return null;
            }
        } catch (error) {
            logger.error('❌ Error getting guilds from cache:', error);
            return null;
        }
    }

    // Xóa session (logout)
    async deleteSession(discordId) {
        try {
            const result = await UserSession.deleteOne({ discordId });
            logger.auth('🗑️ Deleted session for Discord ID:', discordId);
            return result;
        } catch (error) {
            logger.error('❌ Error deleting session:', error);
            throw error;
        }
    }

    // Dọn dẹp các token hết hạn (chạy định kỳ)
    async cleanExpiredSessions() {
        try {
            const expiredTokens = await UserSession.cleanExpiredTokens();
            const expiredCache = await UserSession.cleanExpiredCache();
            
            logger.database(`🧹 Cleaned ${expiredTokens.deletedCount} expired tokens and ${expiredCache.modifiedCount} expired caches`);
            return {
                expiredTokens: expiredTokens.deletedCount,
                expiredCache: expiredCache.modifiedCount
            };
        } catch (error) {
            logger.error('❌ Error cleaning expired sessions:', error);
            throw error;
        }
    }

    // Lấy thống kê
    async getStats() {
        try {
            const totalSessions = await UserSession.countDocuments();
            const activeSessions = await UserSession.countDocuments({
                tokenExpiry: { $gt: new Date() }
            });
            const expiredSessions = totalSessions - activeSessions;

            return {
                total: totalSessions,
                active: activeSessions,
                expired: expiredSessions
            };
        } catch (error) {
            logger.error('❌ Error getting session stats:', error);
            return { total: 0, active: 0, expired: 0 };
        }
    }

    // Mark user as no longer first visit
    async markUserVisited(userId) {
        try {
            if (this.canUseDatabase()) {
                const session = await UserSession.findByDiscordId(userId);
                if (session && session.isFirstVisit) {
                    session.isFirstVisit = false;
                    await session.save();
                    logger.auth('🎯 Marked user as visited:', session.username);
                }
            } else {
                const sessionData = memoryCache.get(userId);
                if (sessionData && sessionData.isFirstVisit) {
                    sessionData.isFirstVisit = false;
                    memoryCache.set(userId, sessionData);
                    logger.auth('🎯 Marked user as visited (memory):', sessionData.username);
                }
            }
        } catch (error) {
            logger.error('❌ Error marking user as visited:', error);
        }
    }
}

module.exports = new UserSessionService();
