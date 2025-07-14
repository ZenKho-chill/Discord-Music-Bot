const express = require('express');
const { isAuthenticated, getUserGuilds, fetch } = require('../middleware');
const config = require('../../../config/config');
const router = express.Router();

// Route test để kiểm tra Discord API
router.get('/test-api', isAuthenticated, async (req, res) => {
  const user = req.user;
  
  try {
    console.log('🧪 Đang test Discord API...');
    console.log('User:', user.username);
    console.log('Access Token tồn tại:', !!user.accessToken);
    
    // Test thông tin user cơ bản trước
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Phản hồi User API:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('✅ Dữ liệu user đã được lấy thành công');
    }
    
    // Test guilds API
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Phản hồi Guilds API:', guildsResponse.status);
    
    if (!guildsResponse.ok) {
      const errorText = await guildsResponse.text();
      console.error('Lỗi Guilds API:', errorText);
    }
    
    res.json({
      success: true,
      userApiStatus: userResponse.status,
      guildsApiStatus: guildsResponse.status,
      hasAccessToken: !!user.accessToken
    });
    
  } catch (error) {
    console.error('Lỗi Test API:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
