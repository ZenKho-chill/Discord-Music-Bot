const config = require('../../config/config');
const UserSessionService = require('../../database/services/UserSessionService');
const logger = require('../../utils/logger');

// Import fetch với dynamic import cho node-fetch v3
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Middleware kiểm tra người dùng đã xác thực
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

// Hàm hỗ trợ lấy guilds của user từ Discord API với database caching
async function getUserGuilds(accessToken, userId) {
  try {
    // Kiểm tra cache database trước
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
      // Rate limited, thử sử dụng dữ liệu cache cũ
      const oldCache = await UserSessionService.getGuildsFromCache(userId);
      if (oldCache) {
        console.log('⚠️ Rate limited, sử dụng dữ liệu cache cũ');
        return oldCache;
      }
      
      const retryAfter = response.headers.get('retry-after') || 1;
      console.log(`⏳ Rate limited, chờ ${retryAfter}s trước khi thử lại`);
      
      // Chờ và thử lại một lần
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return getUserGuilds(accessToken, userId); // Thử lại recursively
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Discord API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      // Sử dụng dữ liệu cache cũ nếu có khi gặp lỗi
      const oldCache = await UserSessionService.getGuildsFromCache(userId);
      if (oldCache) {
        console.log('🔄 Lỗi API, sử dụng dữ liệu cache cũ');
        return oldCache;
      }
      
      throw new Error(`Discord API Error: ${response.status} - ${response.statusText}`);
    }
    
    const guilds = await response.json();
    console.log('✅ Đã lấy thành công', guilds.length, 'guilds cho user');
    
    // Cache kết quả trong database (cache 5 phút)
    await UserSessionService.updateGuildsCache(userId, guilds, 5);
    
    return guilds;
  } catch (error) {
    console.error('💥 Lỗi lấy user guilds:', error.message);
    
    // Thử sử dụng dữ liệu cache cũ như phương án dự phòng
    const oldCache = await UserSessionService.getGuildsFromCache(userId);
    if (oldCache) {
      console.log('🚨 Có lỗi xảy ra, sử dụng dữ liệu cache cũ như phương án dự phòng');
      return oldCache;
    }
    
    // Trả về mảng rỗng như phương án cuối cùng
    return [];
  }
}

// Hàm hỗ trợ phân loại servers
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

module.exports = {
  isAuthenticated,
  getUserGuilds,
  categorizeServers,
  fetch
};
