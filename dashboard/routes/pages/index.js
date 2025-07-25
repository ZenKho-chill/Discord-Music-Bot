const express = require('express');
const config = require('../../../config/config');
const { isAuthenticated, getUserGuilds, categorizeServers } = require('../middleware');
const ServerStatsService = require('../../../database/services/ServerStatsService');
const router = express.Router();

// Trang chủ (trang login nếu chưa xác thực)
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    const error = req.query.error;
    res.render('login', { 
      title: 'ZK Music Bot - Đăng nhập',
      error: error || null,
      debugMode: config.debug
    });
  }
});

// Trang thông tin setup
router.get('/setup', (req, res) => {
  res.render('setup', {
    title: 'Cài đặt Dashboard cần thiết',
    clientId: '1381461005158191185',
    redirectUri: 'http://localhost:3000/auth/callback'
  });
});

// Dashboard (route được bảo vệ)
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const userSessionService = req.app.locals.userSessionService;
    const user = req.user;
    
    if (config.debug) {
      console.log('🏠 Dashboard access by user:', user.username + '#' + user.discriminator);
      console.log('🔑 Token truy cập có sẵn:', user.accessToken ? 'Có' : 'Không');
    }
    
    // Lấy user session để kiểm tra có phải lần đầu ghé thăm
    const userSession = await userSessionService.getSessionByDiscordId(user.id);
    const isFirstVisit = userSession ? userSession.isFirstVisit : false;
    
    // Kiểm tra user có remember token (auto-login enabled)
    const hasRememberToken = !!req.cookies[config.dashboard.cookies.rememberToken.name];
    
    // Kiểm tra có phải session mới (auto-login vừa xảy ra)
    const showAutoLoginMessage = hasRememberToken && userSession && userSession.lastAutoLogin;
    
    // Xóa auto-login flag sau khi hiển thị thông báo một lần
    if (showAutoLoginMessage && userSession.lastAutoLogin) {
      userSession.lastAutoLogin = false;
      await userSession.save();
    }
    
    // Đánh dấu user đã ghé thăm sau lần truy cập đầu tiên
    if (isFirstVisit) {
      await userSessionService.markUserVisited(user.id);
    }
    
    // Lấy Discord guilds của user với caching
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    
    // Lấy guilds của bot
    const botGuilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL()
    }));
    
    // Phân loại servers
    const { serversWithBot, serversWithoutBot, allServers } = categorizeServers(userGuilds, botGuilds);
    
    res.render('dashboard', {
      title: 'Dashboard - ZK Music Bot',
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name, // Display name/nickname từ Discord
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email,
        accessToken: user.accessToken,
        refreshToken: user.refreshToken,
        sessionId: user.sessionId
      },
      servers: allServers, // Để tương thích ngược
      serversWithBot,
      serversWithoutBot,
      isFirstVisit: isFirstVisit, // Truyền flag cho view
      hasRememberToken: hasRememberToken, // Truyền trạng thái auto-login
      showAutoLoginMessage: showAutoLoginMessage, // Truyền flag thông báo auto-login
      debugMode: config.debug
    });
  } catch (error) {
    console.error('💥 Lỗi Dashboard:', error);
    
    // Kiểm tra có phải lỗi Discord API cụ thể
    if (error.message.includes('Discord API Error')) {
      res.render('dashboard', {
        title: 'Dashboard - ZK Music Bot',
        user: {
          id: user.id,
          username: user.username,
          global_name: user.global_name,
          discriminator: user.discriminator,
          avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
        },
        servers: [], // Servers rỗng do lỗi API
        serversWithBot: [],
        serversWithoutBot: [],
        isFirstVisit: false, // Đặt false khi có lỗi
        hasRememberToken: !!req.cookies[config.dashboard.cookies.rememberToken.name], // Truyền trạng thái auto-login
        showAutoLoginMessage: false, // Không hiển thị thông báo khi có lỗi
        apiError: 'Không thể tải danh sách server từ Discord. Vui lòng thử lại sau.',
        debugMode: config.debug
      });
    } else {
      res.status(500).render('error', { 
        title: 'Lỗi Dashboard',
        error: 'Không thể tải dashboard. Vui lòng thử lại sau.' 
      });
    }
  }
});

// Trang quản lý server
router.get('/server/:serverId', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const serverId = req.params.serverId;
    const user = req.user;
    
    // Kiểm tra user có quyền truy cập server này
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    const userGuild = userGuilds.find(guild => guild.id === serverId);
    const hasAccess = !!userGuild;
    if (!hasAccess) {
      return res.status(403).render('error', {
        title: 'Không có quyền truy cập',
        error: 'Bạn không có quyền truy cập server này'
      });
    }
    // Lấy thông tin server từ bot
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy server',
        error: 'Bot không có trong server này'
      });
    }
    // Kiểm tra quyền admin: ADMINISTRATOR (0x8) hoặc MANAGE_GUILD (0x20)
    let isAdmin = false;
    if (userGuild && userGuild.permissions) {
      const perm = typeof userGuild.permissions === 'string' ? parseInt(userGuild.permissions) : userGuild.permissions;
      isAdmin = (perm & 0x8) === 0x8 || (perm & 0x20) === 0x20;
    }
    
    // Lấy thống kê nhạc cho server này
    const MusicTrackService = require('../../../database/services/MusicTrackService');
    let musicStats = null;
    let platformStats = [];
    let contentTypeStats = [];
    let serverStats = null;
    
    try {
      // Lấy thống kê server toàn diện
      serverStats = await ServerStatsService.getServerStats(serverId);
      
      // Lấy thống kê tổng quan
      musicStats = await MusicTrackService.getGuildStats(serverId);
      if (config.debug) {
        console.log('🎵 [DEBUG] Raw musicStats from database:', JSON.stringify(musicStats, null, 2));
      }
      
      // Tính toán platform statistics
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
        
        if (config.debug) {
          console.log('📊 [DEBUG] Platform stats calculated:', platformStats);
        }
      }
      
      // Tính toán content type statistics  
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
        
        if (config.debug) {
          console.log('📊 [DEBUG] Content type stats calculated:', contentTypeStats);
        }
      }
      
      if (config.debug) {
        console.log('🎵 [DEBUG] Final musicStats object:', {
          totalTracks: musicStats ? musicStats.totalTracks : 'undefined',
          hasPlatforms: musicStats && musicStats.platforms ? musicStats.platforms.length : 0,
          hasContentTypes: musicStats && musicStats.contentTypes ? musicStats.contentTypes.length : 0
        });
      }
    } catch (error) {
      console.error('Lỗi lấy thống kê nhạc:', error);
    }
    
    res.render('server', {
      title: `${guild.name} - Quản lý`,
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL()
      },
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        discriminator: user.discriminator,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
      },
      musicStats,
      serverStats,
      platformStats,
      contentTypeStats,
      debugMode: config.debug,
      isAdmin
    });
  } catch (error) {
    console.error('Lỗi quản lý server:', error);
    res.status(500).render('error', {
      title: 'Lỗi',
      error: 'Không thể tải thông tin server'
    });
  }
});

// Route Trang Thống Kê Server
router.get('/server/:guildId/stats', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const { guildId } = req.params;
    const user = req.user;

    // Xác minh user có quyền truy cập guild này
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    const guild = userGuilds.find(g => g.id === guildId);
    
    if (!guild) {
      return res.status(403).render('error', {
        title: 'Không có quyền truy cập',
        error: 'Bạn không có quyền truy cập server này'
      });
    }

    // Lấy thông tin bot guild
    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) {
      return res.status(404).render('error', {
        title: 'Server không tìm thấy',
        error: 'Bot chưa tham gia server này'
      });
    }

    // Lấy thống kê server toàn diện
    const serverStats = await ServerStatsService.getServerStats(guildId);

    if (!serverStats) {
      return res.status(500).render('error', {
        title: 'Lỗi',
        error: 'Không thể tải thống kê server'
      });
    }

    res.render('serverStats', {
      title: `${botGuild.name} - Thống Kê Server`,
      guild: {
        id: botGuild.id,
        name: botGuild.name,
        memberCount: botGuild.memberCount,
        icon: botGuild.iconURL()
      },
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        discriminator: user.discriminator,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
      },
      serverStats,
      debugMode: config.debug
    });
  } catch (error) {
    console.error('Lỗi thống kê server:', error);
    res.status(500).render('error', {
      title: 'Lỗi',
      error: 'Không thể tải thống kê server'
    });
  }
});

// Trang Thống Kê Nhạc
router.get('/music-stats', isAuthenticated, async (req, res) => {
    try {
        const user = req.user;
        const MusicTrackService = require('../../../database/services/MusicTrackService');
        
        // Lấy danh sách guilds của user
        const userGuilds = await getUserGuilds(user.accessToken, user.id);
        const managedGuilds = userGuilds.filter(guild => (guild.permissions & 0x20) === 0x20); // Quyền MANAGE_GUILD
        
        // Lấy guild được chọn (mặc định là guild đầu tiên)
        const selectedGuildId = req.query.guild || (managedGuilds.length > 0 ? managedGuilds[0].id : null);
        const selectedGuild = managedGuilds.find(g => g.id === selectedGuildId);
        
        let musicStats = null;
        let platformStats = [];
        let contentTypeStats = [];
        let popularTracks = [];
        let recentTracks = [];
        
        if (selectedGuildId) {
            // Lấy thống kê tổng quan
            musicStats = await MusicTrackService.getGuildStats(selectedGuildId);
            
            // Lấy top tracks
            popularTracks = await MusicTrackService.getPopularTracks(selectedGuildId, 10);
            
            // Lấy lịch sử gần đây
            recentTracks = await MusicTrackService.getPlayHistory(selectedGuildId, 20);
            
            // Tính toán platform statistics
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
            
            // Tính toán content type statistics
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
        }
        
        res.render('music-stats', {
            user: {
                id: user.id,
                username: user.username,
                global_name: user.global_name,
                discriminator: user.discriminator,
                avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
            },
            guilds: managedGuilds,
            selectedGuild,
            musicStats,
            platformStats,
            contentTypeStats,
            popularTracks,
            recentTracks,
            title: 'Music Statistics'
        });
    } catch (error) {
        console.error('[Dashboard] Lỗi trong route music-stats:', error);
        res.status(500).render('error', { 
            message: 'Lỗi máy chủ nội bộ',
            error: error
        });
    }
});

// API: Lấy quyền admin và thông tin server cho frontend
router.get('/api/server/:serverId', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const serverId = req.params.serverId;
    const user = req.user;
    // Kiểm tra user có quyền truy cập server này
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    const userGuild = userGuilds.find(guild => guild.id === serverId);
    const hasAccess = !!userGuild;
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập server này' });
    }
    // Lấy thông tin server từ bot
    const guild = client.guilds.cache.get(serverId);
    if (!guild) {
      return res.status(404).json({ success: false, message: 'Bot không có trong server này' });
    }
    // Kiểm tra quyền admin: ADMINISTRATOR (0x8) hoặc MANAGE_GUILD (0x20)
    let isAdmin = false;
    if (userGuild && userGuild.permissions) {
      const perm = typeof userGuild.permissions === 'string' ? parseInt(userGuild.permissions) : userGuild.permissions;
      isAdmin = (perm & 0x8) === 0x8 || (perm & 0x20) === 0x20;
    }
    return res.json({
      success: true,
      isAdmin,
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL()
      }
    });
  } catch (error) {
    console.error('Lỗi API lấy quyền admin server:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy quyền admin server' });
  }
});

module.exports = router;
