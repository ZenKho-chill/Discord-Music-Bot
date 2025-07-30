const express = require('express');
const { isAuthenticated } = require('../middleware');
const config = require('../../../config/config');
const router = express.Router();

// Route debug để kiểm tra remember token
router.get('/remember-token', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user ? {
      id: req.user.id,
      username: req.user.username
    } : null,
    rememberTokenCookie: req.cookies[config.dashboard.cookies.rememberToken.name] ? 'TỒN TẠI' : 'THIẾU',
    rememberTokenPreview: req.cookies[config.dashboard.cookies.rememberToken.name] ? req.cookies[config.dashboard.cookies.rememberToken.name].substring(0, 10) + '...' : 'KHÔNG CÓ',
    allCookies: Object.keys(req.cookies),
    cookieValues: req.cookies,
    headers: {
      cookie: req.headers.cookie || 'KHÔNG CÓ COOKIE HEADER'
    }
  });
});

// Route debug để kiểm tra user data
router.get('/user', isAuthenticated, async (req, res) => {
  if (!req.user) {
    return res.json({ error: 'Chưa đăng nhập' });
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

// Route debug để kiểm tra cookies server-side
router.get('/cookies', (req, res) => {
  res.json({
    cookies: req.cookies,
    headers: req.headers.cookie,
    hasRememberToken: !!req.cookies.remember_token,
    rememberTokenValue: req.cookies.remember_token ? req.cookies.remember_token.substring(0, 10) + '...' : 'KHÔNG CÓ'
  });
});

// Route test để reset first visit flag
router.get('/reset-first-visit', isAuthenticated, async (req, res) => {
  try {
    const userSessionService = req.app.locals.userSessionService;
    const session = await userSessionService.getSessionByDiscordId(req.user.id);

    if (session) {
      session.isFirstVisit = true;
      await session.save();
      res.json({
        success: true,
        message: 'Flag lần đầu ghé thăm đã được reset thành true',
        user: req.user.username
      });
    } else {
      res.json({ error: 'Không tìm thấy session' });
    }
  } catch (error) {
    res.json({ error: error.message });
  }
});

module.exports = router;
