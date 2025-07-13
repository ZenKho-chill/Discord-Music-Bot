const MusicTrack = require('../models/MusicTrack');
const { detectPlatformSimple, extractIds } = require('../../commands/platforms/platformDetector');

class MusicTrackService {
    /**
     * Lưu thông tin track được phát
     */
    static async logTrack(trackData) {
        try {
            const { url, title, guild, user, metadata = {} } = trackData;
            
            console.log('🔍 [MusicTrackService] Starting logTrack with:', {
                title,
                url,
                guildId: guild?.id,
                userId: user?.id
            });
            
            // Detect platform và content type
            const platformInfo = await this.analyzePlatformAndContent(url, title);
            console.log('🔍 [MusicTrackService] Platform analysis result:', platformInfo);
            
            const trackDocument = {
                title: title,
                url: url,
                duration: metadata.duration || null,
                platform: platformInfo.platform,
                contentType: platformInfo.contentType,
                platformData: platformInfo.platformData,
                guildId: guild.id,
                guildName: guild.name,
                userId: user.id,
                username: user.username || user.displayName,
                metadata: {
                    thumbnail: metadata.thumbnail || null,
                    artist: metadata.artist || null,
                    views: metadata.views || null,
                    likes: metadata.likes || null
                },
                playlistInfo: platformInfo.playlistInfo || {},
                playedAt: new Date(),
                status: 'playing'
            };
            
            console.log('🔍 [MusicTrackService] Creating track document:', trackDocument);
            
            const track = new MusicTrack(trackDocument);
            
            console.log('🔍 [MusicTrackService] Saving track to database...');
            const savedTrack = await track.save();
            console.log('✅ [MusicTrackService] Track saved successfully:', savedTrack._id);
            
            console.log('🎵 Logged track:', title, '| Platform:', platformInfo.platform, '| Type:', platformInfo.contentType);
            return savedTrack;
        } catch (error) {
            console.error('❌ [MusicTrackService] Error logging track:', error);
            console.error('❌ [MusicTrackService] Error stack:', error.stack);
            return null;
        }
    }
    
    /**
     * Phân tích platform và content type từ URL
     */
    static async analyzePlatformAndContent(url, title = '') {
        try {
            // Detect platform
            const platform = detectPlatformSimple(url);
            let contentType = 'single';
            let platformData = {};
            let playlistInfo = {};
            
            // Extract IDs dựa trên platform
            const ids = extractIds(url);
            
            switch (platform) {
                case 'youtube':
                    platformData.youtubeId = ids.videoId;
                    if (ids.playlistId) {
                        platformData.playlistId = ids.playlistId;
                        contentType = 'playlist';
                        // Có thể fetch thêm thông tin playlist nếu cần
                        playlistInfo = await this.getYouTubePlaylistInfo(ids.playlistId);
                    }
                    break;
                    
                case 'spotify':
                    if (url.includes('/playlist/')) {
                        contentType = 'playlist';
                        platformData.playlistId = ids.playlistId;
                        playlistInfo = await this.getSpotifyPlaylistInfo(ids.playlistId);
                    } else if (url.includes('/album/')) {
                        contentType = 'album';
                        platformData.spotifyId = ids.albumId;
                    } else {
                        platformData.spotifyId = ids.trackId;
                    }
                    break;
                    
                case 'soundcloud':
                    platformData.soundcloudId = ids.trackId;
                    if (url.includes('/sets/')) {
                        contentType = 'playlist';
                        platformData.playlistId = ids.playlistId;
                    }
                    break;
                    
                default:
                    // Fallback detection từ title hoặc URL pattern
                    if (title.toLowerCase().includes('playlist') || 
                        url.includes('list=') || 
                        url.includes('/sets/')) {
                        contentType = 'playlist';
                    }
            }
            
            return {
                platform,
                contentType,
                platformData,
                playlistInfo
            };
        } catch (error) {
            console.error('❌ Error analyzing platform:', error);
            return {
                platform: 'other',
                contentType: 'single',
                platformData: {},
                playlistInfo: {}
            };
        }
    }
    
    /**
     * Lấy thông tin YouTube playlist
     */
    static async getYouTubePlaylistInfo(playlistId) {
        try {
            const ytpl = require('@distube/ytpl');
            const playlist = await ytpl(playlistId, { limit: 1 });
            return {
                totalTracks: playlist.estimatedItemCount,
                playlistTitle: playlist.title,
                playlistAuthor: playlist.author?.name || 'Unknown'
            };
        } catch (error) {
            console.error('❌ Error fetching YouTube playlist info:', error);
            return {};
        }
    }
    
    /**
     * Lấy thông tin Spotify playlist (cần API key)
     */
    static async getSpotifyPlaylistInfo(playlistId) {
        try {
            // TODO: Implement Spotify API call nếu có API key
            return {
                playlistTitle: 'Spotify Playlist',
                playlistAuthor: 'Unknown'
            };
        } catch (error) {
            console.error('❌ Error fetching Spotify playlist info:', error);
            return {};
        }
    }
    
    /**
     * Cập nhật trạng thái track
     */
    static async updateTrackStatus(trackId, status, completedAt = null) {
        try {
            const updateData = { status };
            if (completedAt) {
                updateData.completedAt = completedAt;
            }
            
            await MusicTrack.findByIdAndUpdate(trackId, updateData);
            console.log('🔄 Updated track status:', status);
        } catch (error) {
            console.error('❌ Error updating track status:', error);
        }
    }
    
    /**
     * Lấy thống kê guild
     */
    static async getGuildStats(guildId) {
        try {
            const stats = await MusicTrack.getGuildStats(guildId);
            return stats[0] || {
                totalTracks: 0,
                platforms: [],
                contentTypes: []
            };
        } catch (error) {
            console.error('❌ Error getting guild stats:', error);
            return null;
        }
    }
    
    /**
     * Lấy thống kê cá nhân của user
     */
    static async getUserStats(userId) {
        try {
            const stats = await MusicTrack.aggregate([
                { $match: { userId } },
                {
                    $group: {
                        _id: '$userId',
                        totalTracks: { $sum: 1 },
                        platforms: { $push: '$platform' }
                    }
                }
            ]);

            if (!stats || stats.length === 0) {
                return null;
            }

            const userStats = stats[0];
            
            // Tìm platform yêu thích
            const platformCount = {};
            userStats.platforms.forEach(platform => {
                platformCount[platform] = (platformCount[platform] || 0) + 1;
            });

            const favoritePlatform = Object.entries(platformCount)
                .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

            return {
                totalTracks: userStats.totalTracks,
                favoritePlatform
            };
        } catch (error) {
            console.error('❌ Error getting user stats:', error);
            return null;
        }
    }

    /**
     * Lấy top tracks của guild
     */
    static async getPopularTracks(guildId, limit = 10) {
        try {
            return await MusicTrack.getPopularTracks(guildId, limit);
        } catch (error) {
            console.error('❌ Error getting popular tracks:', error);
            return [];
        }
    }
    
    /**
     * Lấy lịch sử phát nhạc của guild
     */
    static async getPlayHistory(guildId, limit = 20) {
        try {
            return await MusicTrack.find({ guildId })
                .sort({ playedAt: -1 })
                .limit(limit)
                .lean();
        } catch (error) {
            console.error('❌ Error getting play history:', error);
            return [];
        }
    }
}

module.exports = MusicTrackService;
