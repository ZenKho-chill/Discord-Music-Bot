const express = require('express');
const config = require('../../../config/config');
const { fetch } = require('../middleware');
const UserSessionService = require('../../../database/services/UserSessionService');
const router = express.Router();

// Routes xác thực Discord
router.get('/discord', (req, res) => {
  // Tạo URL OAuth tùy chỉnh như Dyno
  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.dashboard.clientId);
  authUrl.searchParams.set('redirect_uri', config.dashboard.redirectUri);
  authUrl.searchParams.set('scope', config.dashboard.scopes.join(' '));
  
  // Dyno-style: ALWAYS try prompt=none first for seamless experience
  authUrl.searchParams.set('prompt', 'none');
  if (config.debug) {
    console.log('🔑 Kiểu Dyno OAuth: Luôn thử prompt=none trước để đăng nhập liền mạch');
  }
  
  if (config.debug) {
    console.log('🔗 URL OAuth đã tạo:', authUrl.toString());
  }
  res.redirect(authUrl.toString());
});

// Callback xử lý OAuth
router.get('/callback', async (req, res) => {
  try {
    const { code, error, error_description } = req.query;
    
    // Nếu có lỗi từ Discord (ví dụ: prompt=none failed)
    if (error) {
      if (config.debug) {
        console.log('⚠️ Lỗi OAuth:', error, error_description);
      }
      
      // Nếu lỗi do prompt=none (user chưa authorize), redirect về auth với consent
      if (error === 'consent_required' || error === 'login_required' || error === 'access_denied') {
        if (config.debug) {
          console.log('🔄 prompt=none thất bại, chuyển hướng đến ủy quyền đồng ý (dự phòng kiểu Dyno)');
        }
        const authUrl = new URL('https://discord.com/oauth2/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', config.dashboard.clientId);
        authUrl.searchParams.set('redirect_uri', config.dashboard.redirectUri);
        authUrl.searchParams.set('scope', config.dashboard.scopes.join(' '));
        authUrl.searchParams.set('prompt', 'consent'); // Force new authorization
        
        return res.redirect(authUrl.toString());
      }
      
      // Lỗi khác, redirect về home
      return res.redirect('/?error=' + encodeURIComponent(error_description || error));
    }
    
    if (!code) {
      return res.redirect('/?error=Không nhận được mã ủy quyền');
    }
    
    // Đổi authorization code lấy access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.dashboard.clientId,
        client_secret: config.dashboard.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.dashboard.redirectUri
      })
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Đổi token thất bại:', errorText);
      return res.redirect('/?error=Token exchange failed');
    }
    
    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token } = tokenData;
    
    // Lấy user profile từ Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    if (!userResponse.ok) {
      console.error('❌ Không thể lấy thông tin hồ sơ người dùng');
      return res.redirect('/?error=Failed to fetch user profile');
    }
    
    const profile = await userResponse.json();
    if (config.debug) {
      console.log('✅ OAuth Success for user:', profile.username + '#' + profile.discriminator);
    }
    
    // Tạo hoặc cập nhật session trong database
    const userSession = await UserSessionService.createOrUpdateSession(
      profile, 
      access_token, 
      refresh_token
    );
    
    // Login user với passport
    req.logIn({
      id: profile.id,
      username: profile.username,
      global_name: profile.global_name,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      email: profile.email,
      accessToken: access_token,
      refreshToken: refresh_token,
      sessionId: userSession._id
    }, async (err) => {
      if (err) {
        console.error('❌ Lỗi đăng nhập:', err);
        return res.redirect('/?error=Login failed');
      }
      
      try {
        // Tạo remember token để auto-login lần sau
        const rememberToken = await UserSessionService.createRememberToken(profile.id);
        
        if (rememberToken) {
          // Set cookie với thời hạn từ config
          res.cookie(config.dashboard.cookies.rememberToken.name, rememberToken, config.dashboard.cookies.rememberToken);
          if (config.debug) {
            console.log('🍪 Remember token set for user:', profile.username);
          }
        }
        
        res.redirect('/dashboard');
      } catch (error) {
        console.error('❌ Lỗi đặt remember token:', error);
        res.redirect('/dashboard'); // Vẫn redirect dù có lỗi
      }
    });
    
  } catch (error) {
    console.error('💥 Lỗi callback xác thực:', error);
    res.redirect('/?error=Authentication failed');
  }
});

// Đăng xuất
router.get('/logout', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // Xóa remember token khỏi database
    if (userId) {
      await UserSessionService.clearRememberToken(userId);
      if (config.debug) {
        console.log('🗑️ Remember token cleared for user:', userId);
      }
    }
    
    // Xóa remember token cookie
    res.clearCookie(config.dashboard.cookies.rememberToken.name);
    
    // Xóa session khỏi database  
    if (userId) {
      await UserSessionService.deleteSession(userId);
      if (config.debug) {
        console.log('🗑️ Database session deleted for user:', userId);
      }
    }
    
    req.logout((err) => {
      if (err) {
        console.error('Lỗi đăng xuất:', err);
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('❌ Lỗi trong quá trình đăng xuất:', error);
    res.clearCookie(config.dashboard.cookies.rememberToken.name);
    req.logout((err) => {
      if (err) {
        console.error('Lỗi đăng xuất:', err);
      }
      res.redirect('/');
    });
  }
});

module.exports = router;
