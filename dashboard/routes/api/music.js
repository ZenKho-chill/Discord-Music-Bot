const express = require('express');
const { isAuthenticated } = require('../middleware');
const router = express.Router();

// Route debug để kiểm tra music stats
router.get('/debug/music-stats/:serverId', isAuthenticated, async (req, res) => {
    try {
        const serverId = req.params.serverId;
        const MusicTrackService = require('../../../database/services/MusicTrackService');
        
        console.log('🔍 Debug: Đang kiểm tra music stats cho server:', serverId);
        
        const musicStats = await MusicTrackService.getGuildStats(serverId);
        console.log('📊 Kết quả Music Stats:', musicStats);
        
        let platformStats = [];
        let contentTypeStats = [];
        
        if (musicStats && musicStats.platforms) {
            const platformCount = {};
            musicStats.platforms.forEach(platform => {
                platformCount[platform] = (platformCount[platform] || 0) + 1;
            });
            
            platformStats = Object.entries(platformCount)
                .map(([platform, count]) => ({
                    platform,
                    count,
                    percentage: ((count / musicStats.totalTracks) * 100).toFixed(1)
                }))
                .sort((a, b) => b.count - a.count);
        }
        
        if (musicStats && musicStats.contentTypes) {
            const typeCount = {};
            musicStats.contentTypes.forEach(type => {
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            
            contentTypeStats = Object.entries(typeCount)
                .map(([type, count]) => ({
                    type,
                    count,
                    percentage: ((count / musicStats.totalTracks) * 100).toFixed(1)
                }))
                .sort((a, b) => b.count - a.count);
        }
        
        res.json({
            serverId,
            musicStats,
            platformStats,
            contentTypeStats
        });
    } catch (error) {
        console.error('Lỗi debug music stats:', error);
        res.json({ error: error.message, stack: error.stack });
    }
});

module.exports = router;
