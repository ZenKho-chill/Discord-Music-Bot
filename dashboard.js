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
    if (config.debug) {
      console.log('🍃 Đã thiết lập kết nối cơ sở dữ liệu');
    }
  } catch (error) {
    console.error('❌ Không thể kết nối cơ sở dữ liệu:', error);
    if (config.debug) {
      console.log('⚠️ Tiếp tục mà không có cơ sở dữ liệu...');
    }
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
    cookie: config.dashboard.cookies.session
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
    if (!req.user && req.cookies[config.dashboard.cookies.rememberToken.name]) {
      try {
        // Tìm user session từ remember token
        const userSession = await UserSessionService.getSessionByRememberToken(req.cookies[config.dashboard.cookies.rememberToken.name]);
        
        if (userSession && userSession.isTokenValid()) {
          // Tự động login user
          return new Promise(async (resolve) => {
            req.logIn({
              id: userSession.discordId,
              username: userSession.username,
              global_name: userSession.global_name,
              discriminator: userSession.discriminator,
              avatar: userSession.avatarHash, // Chỉ avatar hash
              email: userSession.email,
              accessToken: userSession.accessToken,
              refreshToken: userSession.refreshToken
            }, async (err) => {
              if (err) {
                console.error('❌ Lỗi tự động đăng nhập:', err);
                res.clearCookie(config.dashboard.cookies.rememberToken.name);
                next();
              } else {
                if (config.debug) {
                  console.log('✅ Tự động đăng nhập thành công cho:', userSession.username);
                }
                
                // Đặt cờ để hiển thị thông báo tự động đăng nhập
                try {
                  userSession.lastAutoLogin = true;
                  await userSession.save();
                } catch (saveError) {
                  console.error('❌ Lỗi lưu cờ tự động đăng nhập:', saveError);
                }
                
                // Chuyển hướng tới dashboard nếu đang ở trang chủ
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
          res.clearCookie(config.dashboard.cookies.rememberToken.name);
        }
      } catch (error) {
        console.error('❌ Lỗi trong quá trình tự động đăng nhập:', error);
        res.clearCookie(config.dashboard.cookies.rememberToken.name);
      }
    }
    next();
  });

  // Discord OAuth Strategy
  passport.use(new DiscordStrategy({
    clientID: config.dashboard.clientId,
    clientSecret: config.dashboard.clientSecret,
    callbackURL: config.dashboard.redirectUri,
    scope: config.dashboard.scopes,
    prompt: 'none' // Không hiển thị prompt nếu user đã authorize trước đó
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Lưu user session vào database
      if (config.debug) {
        console.log('✅ OAuth thành công cho người dùng:', profile.username + '#' + profile.discriminator);
        console.log('🔑 Đã nhận access token:', accessToken ? 'Có' : 'Không');
        console.log('🔄 Đã nhận refresh token:', refreshToken ? 'Có' : 'Không');
      }
      
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
      console.error('❌ Lỗi lưu phiên người dùng:', error);
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
        if (config.debug) {
          console.log('⚠️ Không tìm thấy phiên hợp lệ cho Discord ID:', discordId);
        }
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
      console.error('❌ Lỗi deserializing user:', error);
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
          if (config.debug) {
            console.log('🧹 Hoàn thành dọn dẹp cơ sở dữ liệu:', stats);
          }
        }
      } catch (error) {
        console.error('❌ Lỗi trong quá trình dọn dẹp cơ sở dữ liệu:', error);
      }
    }, 60 * 60 * 1000); // 1 giờ
  });
};
