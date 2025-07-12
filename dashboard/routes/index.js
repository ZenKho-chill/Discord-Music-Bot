const express = require('express');
const passport = require('passport');
const config = require('../../config/config');
const router = express.Router();

// Import fetch with dynamic import for node-fetch v3
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Database services
const UserSessionService = require('../../database/services/UserSessionService');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Helper function to get user's guilds from Discord API with database caching
async function getUserGuilds(accessToken, userId) {
  try {
    // Check database cache first
    const cachedGuilds = await UserSessionService.getGuildsFromCache(userId);
    
    if (cachedGuilds) {
      console.log('📋 Using cached guilds from database for user:', userId);
      return cachedGuilds;
    }
    
    console.log('🔍 Fetching user guilds from Discord API for user:', userId);
    
    const response = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📡 Discord API Response status:', response.status, response.statusText);
    
    if (response.status === 429) {
      // Rate limited, try to use old cached data
      const oldCache = await UserSessionService.getGuildsFromCache(userId);
      if (oldCache) {
        console.log('⚠️ Rate limited, using old cached data');
        return oldCache;
      }
      
      const retryAfter = response.headers.get('retry-after') || 1;
      console.log(`⏳ Rate limited, waiting ${retryAfter}s before retry`);
      
      // Wait and retry once
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return getUserGuilds(accessToken, userId); // Recursive retry
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Discord API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Use old cached data if available during error
      const oldCache = await UserSessionService.getGuildsFromCache(userId);
      if (oldCache) {
        console.log('🔄 API error, using old cached data');
        return oldCache;
      }
      
      throw new Error(`Discord API Error: ${response.status} - ${response.statusText}`);
    }
    
    const guilds = await response.json();
    console.log('✅ Successfully fetched', guilds.length, 'guilds for user');
    
    // Cache the result in database (5 minutes cache)
    await UserSessionService.updateGuildsCache(userId, guilds, 5);
    
    return guilds;
  } catch (error) {
    console.error('💥 Error fetching user guilds:', error.message);
    
    // Try to use old cached data as fallback
    const oldCache = await UserSessionService.getGuildsFromCache(userId);
    if (oldCache) {
      console.log('🚨 Error occurred, using old cached data as fallback');
      return oldCache;
    }
    
    // Return empty array as last resort
    return [];
  }
}

// Helper function to categorize servers
function categorizeServers(userGuilds, botGuilds) {
  const serversWithBot = [];
  const serversWithoutBot = [];
  
  userGuilds.forEach(guild => {
    const hasBot = botGuilds.some(botGuild => botGuild.id === guild.id);
    const serverData = {
      ...guild,
      hasBot
    };
    
    if (hasBot) {
      serversWithBot.push(serverData);
    } else {
      serversWithoutBot.push(serverData);
    }
  });
  
  return {
    serversWithBot: serversWithBot.sort((a, b) => a.name.localeCompare(b.name)),
    serversWithoutBot: serversWithoutBot.sort((a, b) => a.name.localeCompare(b.name)),
    allServers: [...serversWithBot, ...serversWithoutBot]
  };
}

// Home page (login page if not authenticated)
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/dashboard');
  } else {
    res.render('login', { 
      title: 'Discord Music Bot - Đăng nhập' 
    });
  }
});

// Setup info page
router.get('/setup', (req, res) => {
  res.render('setup', {
    title: 'Dashboard Setup Required',
    clientId: '1381461005158191185',
    redirectUri: 'http://localhost:3000/auth/callback'
  });
});

// Auth routes
router.get('/auth/discord', passport.authenticate('discord'));

router.get('/auth/callback', 
  passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      console.log('🔑 Auth callback - User logged in:', req.user.username);
      
      // Tạo remember token để auto-login lần sau
      const rememberToken = await UserSessionService.createRememberToken(req.user.id);
      
      if (rememberToken) {
        // Set cookie với thời hạn từ config
        res.cookie(config.dashboard.cookies.rememberToken.name, rememberToken, config.dashboard.cookies.rememberToken);
        console.log('🍪 Remember token set for user:', req.user.username);
      }
      
      res.redirect('/dashboard');
    } catch (error) {
      console.error('❌ Error setting remember token:', error);
      res.redirect('/dashboard'); // Vẫn redirect dù có lỗi
    }
  }
);

// Dashboard (protected route)
router.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const userSessionService = req.app.locals.userSessionService;
    const user = req.user;
    
    console.log('🏠 Dashboard access by user:', user.username + '#' + user.discriminator);
    console.log('🔑 Access token available:', user.accessToken ? 'Yes' : 'No');
    
    // Get user session to check if it's first visit
    const userSession = await userSessionService.getSessionByDiscordId(user.id);
    const isFirstVisit = userSession ? userSession.isFirstVisit : false;
    
    // Mark user as visited after first access
    if (isFirstVisit) {
      await userSessionService.markUserVisited(user.id);
    }
    
    // Get user's Discord guilds with caching
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    
    // Get bot's guilds
    const botGuilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL()
    }));
    
    // Categorize servers
    const { serversWithBot, serversWithoutBot, allServers } = categorizeServers(userGuilds, botGuilds);
    
    res.render('dashboard', {
      title: 'Dashboard - Discord Music Bot',
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name, // Display name/nickname từ Discord
        discriminator: user.discriminator,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
      },
      servers: allServers, // For backward compatibility
      serversWithBot,
      serversWithoutBot,
      isFirstVisit: isFirstVisit, // Pass flag to view
      hasRememberToken: !!req.cookies[config.dashboard.cookies.rememberToken.name] // Pass auto-login status
    });
  } catch (error) {
    console.error('💥 Dashboard error:', error);
    
    // Check if it's a specific Discord API error
    if (error.message.includes('Discord API Error')) {
      res.render('dashboard', {
        title: 'Dashboard - Discord Music Bot',
        user: {
          id: user.id,
          username: user.username,
          global_name: user.global_name,
          discriminator: user.discriminator,
          avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null
        },
        servers: [], // Empty servers due to API error
        serversWithBot: [],
        serversWithoutBot: [],
        isFirstVisit: false, // Set to false on error
        hasRememberToken: !!req.cookies[config.dashboard.cookies.rememberToken.name], // Pass auto-login status
        apiError: 'Không thể tải danh sách server từ Discord. Vui lòng thử lại sau.'
      });
    } else {
      res.status(500).render('error', { 
        title: 'Lỗi Dashboard',
        error: 'Không thể tải dashboard. Vui lòng thử lại sau.' 
      });
    }
  }
});

// Server management page
router.get('/server/:serverId', isAuthenticated, async (req, res) => {
  try {
    const client = req.app.locals.client;
    const serverId = req.params.serverId;
    const user = req.user;
    
    // Check if user has access to this server
    const userGuilds = await getUserGuilds(user.accessToken, user.id);
    const hasAccess = userGuilds.some(guild => guild.id === serverId);
    
    if (!hasAccess) {
      return res.status(403).render('error', {
        title: 'Không có quyền truy cập',
        error: 'Bạn không có quyền truy cập server này'
      });
    }
    
    // Get server info from bot
    const guild = client.guilds.cache.get(serverId);
    
    if (!guild) {
      return res.status(404).render('error', {
        title: 'Không tìm thấy server',
        error: 'Bot không có trong server này'
      });
    }
    
    res.render('server', {
      title: `${guild.name} - Quản lý`,
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL()
      },
      user
    });
  } catch (error) {
    console.error('Server management error:', error);
    res.status(500).render('error', {
      title: 'Lỗi',
      error: 'Không thể tải thông tin server'
    });
  }
});

// Logout
router.get('/logout', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Xóa remember token khỏi database
    if (userId) {
      await UserSessionService.clearRememberToken(userId);
      console.log('🗑️ Remember token cleared for user:', userId);
    }
    
    // Xóa remember token cookie
    res.clearCookie(config.dashboard.cookies.rememberToken.name);
    
    // Xóa session khỏi database  
    if (userId) {
      await UserSessionService.deleteSession(userId);
      console.log('🗑️ Database session deleted for user:', userId);
    }
    
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('❌ Error during logout:', error);
    res.clearCookie(config.dashboard.cookies.rememberToken.name);
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.redirect('/');
    });
  }
});

// Test route to check Discord API
router.get('/test-api', isAuthenticated, async (req, res) => {
  const user = req.user;
  
  try {
    console.log('🧪 Testing Discord API...');
    console.log('User:', user.username);
    console.log('Access Token exists:', !!user.accessToken);
    
    // Test basic user info first
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('User API Response:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ User data fetched successfully');
    }
    
    // Test guilds API
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Guilds API Response:', guildsResponse.status);
    
    if (!guildsResponse.ok) {
      const errorText = await guildsResponse.text();
      console.error('Guilds API Error:', errorText);
    }
    
    res.json({
      success: true,
      userApiStatus: userResponse.status,
      guildsApiStatus: guildsResponse.status,
      hasAccessToken: !!user.accessToken
    });
    
  } catch (error) {
    console.error('Test API Error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Test route để debug remember token
router.get('/debug/remember-token', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user ? {
      id: req.user.id,
      username: req.user.username
    } : null,
    rememberTokenCookie: req.cookies[config.dashboard.cookies.rememberToken.name] ? 'EXISTS' : 'MISSING',
    rememberTokenPreview: req.cookies[config.dashboard.cookies.rememberToken.name] ? req.cookies[config.dashboard.cookies.rememberToken.name].substring(0, 10) + '...' : 'N/A',
    allCookies: Object.keys(req.cookies),
    cookieValues: req.cookies,
    headers: {
      cookie: req.headers.cookie || 'NO COOKIE HEADER'
    }
  });
});

// Debug route để check user data
router.get('/debug', async (req, res) => {
    if (!req.user) {
        return res.json({ error: 'Not logged in' });
    }
    
    const userSessionService = req.app.locals.userSessionService;
    const session = await userSessionService.getSessionByDiscordId(req.user.id);
    
    const avatarUrl = req.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
    
    res.json({
        user: {
            id: req.user.id,
            username: req.user.username,
            displayName: req.user.global_name || req.user.username,
            avatar: req.user.avatar,
            avatarUrl: avatarUrl
        },
        session: session ? {
            avatarHash: session.avatarHash,
            hasRememberToken: !!session.rememberToken,
            isFirstVisit: session.isFirstVisit,
            createdAt: session.createdAt
        } : null
    });
});

// Debug route để check cookies server-side
router.get('/debug/cookies', (req, res) => {
    res.json({
        cookies: req.cookies,
        headers: req.headers.cookie,
        hasRememberToken: !!req.cookies.remember_token,
        rememberTokenValue: req.cookies.remember_token ? req.cookies.remember_token.substring(0, 10) + '...' : 'NONE'
    });
});

// Test route để reset first visit flag
router.get('/test/reset-first-visit', isAuthenticated, async (req, res) => {
    try {
        const userSessionService = req.app.locals.userSessionService;
        const session = await userSessionService.getSessionByDiscordId(req.user.id);
        
        if (session) {
            session.isFirstVisit = true;
            await session.save();
            res.json({ 
                success: true, 
                message: 'First visit flag reset to true',
                user: req.user.username
            });
        } else {
            res.json({ error: 'No session found' });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

module.exports = router;
