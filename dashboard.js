const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cookieParser = require('cookie-parser');
const config = require('./config/config');

// Database imports
const dbConnection = require('./database/connection');
const UserSessionService = require('./database/services/UserSessionService');

module.exports = async function (client) {
  // Kết nối MongoDB
  try {
    await dbConnection.connect();
    console.log('🍃 Database connection established');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    console.log('⚠️ Continuing without database...');
  }

  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'dashboard/public')));

  // Session configuration
  app.use(session({
    secret: config.dashboard.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to true if using HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    }
  }));

  // Passport configuration
  app.use(passport.initialize());
  app.use(passport.session());

  // Auto-login middleware (phải đặt sau passport setup)
  app.use(async (req, res, next) => {
    // Skip auto-login cho các route auth và static files
    if (req.path.startsWith('/auth/') || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/')) {
      return next();
    }
    
    // Nếu user chưa login và có remember_token cookie
    if (!req.user && req.cookies.remember_token) {
      try {
        // Tìm user session từ remember token
        const userSession = await UserSessionService.getSessionByRememberToken(req.cookies.remember_token);
        
        if (userSession && userSession.isTokenValid()) {
          // Tự động login user
          return new Promise((resolve) => {
            req.logIn({
              id: userSession.discordId,
              username: userSession.username,
              global_name: userSession.global_name,
              discriminator: userSession.discriminator,
              avatar: userSession.avatarHash, // Chỉ avatar hash
              email: userSession.email,
              accessToken: userSession.accessToken,
              refreshToken: userSession.refreshToken
            }, (err) => {
              if (err) {
                console.error('❌ Auto-login error:', err);
                res.clearCookie('remember_token');
                next();
              } else {
                console.log('✅ Auto-login successful for:', userSession.username);
                // Redirect tới dashboard nếu đang ở trang chủ
                if (req.path === '/' || req.path === '/login') {
                  res.redirect('/dashboard');
                } else {
                  next();
                }
              }
              resolve();
            });
          });
        } else {
          // Token hết hạn hoặc không hợp lệ
          res.clearCookie('remember_token');
        }
      } catch (error) {
        console.error('❌ Error during auto-login:', error);
        res.clearCookie('remember_token');
      }
    }
    next();
  });

  // Discord OAuth Strategy
  passport.use(new DiscordStrategy({
    clientID: config.dashboard.clientId,
    clientSecret: config.dashboard.clientSecret,
    callbackURL: config.dashboard.redirectUri,
    scope: config.dashboard.scopes
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Lưu user session vào database
      console.log('✅ OAuth Success for user:', profile.username + '#' + profile.discriminator);
      console.log('🔑 Access token received:', accessToken ? 'Yes' : 'No');
      console.log('🔄 Refresh token received:', refreshToken ? 'Yes' : 'No');
      
      // Tạo hoặc cập nhật session trong database
      const userSession = await UserSessionService.createOrUpdateSession(
        profile, 
        accessToken, 
        refreshToken
      );
      
      // Trả về profile với session ID
      profile.sessionId = userSession._id;
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      
      return done(null, profile);
    } catch (error) {
      console.error('❌ Error saving user session:', error);
      return done(error, null);
    }
  }));

  passport.serializeUser((user, done) => {
    // Chỉ lưu Discord ID trong session
    done(null, user.id);
  });

  passport.deserializeUser(async (discordId, done) => {
    try {
      // Lấy user session từ database
      const userSession = await UserSessionService.getSessionByDiscordId(discordId);
      
      if (!userSession) {
        console.log('⚠️ No valid session found for Discord ID:', discordId);
        return done(null, false);
      }

      // Tạo lại user object từ database
      const user = {
        id: userSession.discordId,
        username: userSession.username,
        global_name: userSession.global_name,
        discriminator: userSession.discriminator,
        avatar: userSession.avatarHash, // Chỉ avatar hash
        email: userSession.email,
        accessToken: userSession.accessToken,
        refreshToken: userSession.refreshToken
      };

      return done(null, user);
    } catch (error) {
      console.error('❌ Error deserializing user:', error);
      return done(error, null);
    }
  });

  // View engine setup
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'dashboard/views'));

  // Make client available to routes
  app.locals.client = client;
  app.locals.userSessionService = UserSessionService;

  // Routes
  const routes = require('./dashboard/routes/index');
  app.use('/', routes);

  app.listen(PORT, () => {
    console.log(`🌐 Dashboard đang chạy tại: http://localhost:${PORT}`);
    
    // Dọn dẹp session hết hạn mỗi 1 giờ
    setInterval(async () => {
      try {
        const stats = await UserSessionService.cleanExpiredSessions();
        if (stats.expiredTokens > 0 || stats.expiredCache > 0) {
          console.log('🧹 Database cleanup completed:', stats);
        }
      } catch (error) {
        console.error('❌ Error during database cleanup:', error);
      }
    }, 60 * 60 * 1000); // 1 giờ
  });
};
