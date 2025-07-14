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
  console.log('🔑 Dyno-style OAuth: Always attempting prompt=none for seamless login');
  
  console.log('🔗 Generated OAuth URL:', authUrl.toString());
  res.redirect(authUrl.toString());
});

// Callback xử lý OAuth
router.get('/callback', async (req, res) => {
  try {
    const { code, error, error_description } = req.query;
    
    // Nếu có lỗi từ Discord (ví dụ: prompt=none failed)
    if (error) {
      console.log('⚠️ OAuth error:', error, error_description);
      
      // Nếu lỗi do prompt=none (user chưa authorize), redirect về auth với consent
      if (error === 'consent_required' || error === 'login_required' || error === 'access_denied') {
        console.log('🔄 prompt=none failed, redirecting to consent authorization (Dyno-style fallback)');
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
      return res.redirect('/?error=No authorization code received');
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
      console.error('❌ Token exchange failed:', errorText);
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
      console.error('❌ Failed to fetch user profile');
      return res.redirect('/?error=Failed to fetch user profile');
    }
    
    const profile = await userResponse.json();
    console.log('✅ OAuth Success for user:', profile.username + '#' + profile.discriminator);
    
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
        console.error('❌ Login error:', err);
        return res.redirect('/?error=Login failed');
      }
      
      try {
        // Tạo remember token để auto-login lần sau
        const rememberToken = await UserSessionService.createRememberToken(profile.id);
        
        if (rememberToken) {
          // Set cookie với thời hạn từ config
          res.cookie(config.dashboard.cookies.rememberToken.name, rememberToken, config.dashboard.cookies.rememberToken);
          console.log('🍪 Remember token set for user:', profile.username);
        }
        
        res.redirect('/dashboard');
      } catch (error) {
        console.error('❌ Error setting remember token:', error);
        res.redirect('/dashboard'); // Vẫn redirect dù có lỗi
      }
    });
    
  } catch (error) {
    console.error('💥 Auth callback error:', error);
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
