const express = require('express');
const path = require('path');
const fs = require('fs');
// Định nghĩa biến config, sẽ require sau khi chắc chắn file tồn tại
let config;
const { Client, GatewayIntentBits } = require('discord.js'); // Thêm discord.js
const axios = require('axios'); // Thêm axios
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

// Custom logger để phù hợp với logger trong index.js
const logger = {
  debug: console.log,
  error: console.error,
  info: console.log,
  warn: console.warn
};

// Nếu config.js không tồn tại thì tự động tải từ github và lưu lại
const configPath = path.join(__dirname, '../config/config.js');
if (!fs.existsSync(configPath)) {
  logger.info('[Easysetup] Không tìm thấy config.js, đang tải file mẫu từ Github...');
  const https = require('https');
  const exampleUrl = 'https://raw.githubusercontent.com/ZenKho-chill/Discord-Music-Bot/refs/heads/main/config/config.js.example';
  const file = fs.createWriteStream(configPath);
  https.get(exampleUrl, (response) => {
    if (response.statusCode !== 200) {
      logger.error(`[Easysetup] Không thể tải file config.js.example từ Github. Status: ${response.statusCode}`);
      process.exit(1);
    }
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      logger.info('[Easysetup] Đã tải config.js từ Github thành công. Vui lòng cấu hình lại.');
      process.exit(0);
    });
  }).on('error', (err) => {
    logger.error('[Easysetup] Lỗi khi tải file config.js.example:', err);
    process.exit(1);
  });
  // Dừng thực thi script tại đây để tránh require lỗi
  return;
}

// Chỉ require config sau khi chắc chắn file đã tồn tại
config = require('../config/config');

// Tạo mã PIN 4 số ngẫu nhiên
let currentPin = '';
function generatePin() {
  currentPin = Math.floor(1000 + Math.random() * 9000).toString();
  logger.info(`[Easysetup] Mã PIN mới: ${currentPin}`);
  return currentPin;
}

// Kiểm tra config có đầy đủ không
function isConfigComplete() {
  const requiredFields = {
    token: config.token,
    clientId: config.clientId,
    spotify: {
      clientId: config.spotify?.clientId,
      clientSecret: config.spotify?.clientSecret
    }
  };

  // Kiểm tra các trường bắt buộc
  if (!requiredFields.token || requiredFields.token === 'DISCORD_TOKEN_ID') return false;
  if (!requiredFields.clientId || requiredFields.clientId === 'DISCORD_CLIEND_ID') return false;
  if (!requiredFields.spotify.clientId || requiredFields.spotify.clientId === 'SPOTIFY_CLIENT_ID') return false;
  if (!requiredFields.spotify.clientSecret || requiredFields.spotify.clientSecret === 'SPOTIFY_CLIENT_SECRET') return false;

  return true;
}

// Nếu config đã đầy đủ, không khởi động easysetup
if (isConfigComplete()) {
  logger.info('[Easysetup] Config đã đầy đủ, không cần chạy easysetup');
  process.exit(0);
}

const app = express();

// Cấu hình view engine và middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/easysetup/public', express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);
app.set('layout', path.join(__dirname, 'views', 'layout'));
app.use(express.json());
app.use(session({
  secret: 'zk-music-setup',
  resave: false,
  saveUninitialized: true
}));

// Debug mode
const debugMode = true;
if (debugMode) {
  logger.debug('[Easysetup] Đang chạy trong chế độ debug - Config chưa đầy đủ');
}

// Middleware để kiểm tra đăng nhập
const requireAuth = (req, res, next) => {
  if (!req.session.authorized) {
    return res.redirect('/');
  }
  next();
};

// Trang chủ - Login
app.get('/', (req, res) => {
  if (req.session.authorized) {
    return res.redirect('/setup/discord');
  }

  // Tạo mã PIN mới khi vào trang login
  if (!currentPin) {
    generatePin();
  }

  res.render('pages/login', {
    layout: false,
    script: '',
    style: ''
  });
});

// Reset mã PIN
app.post('/reset-pin', (req, res) => {
  const newPin = generatePin();
  res.json({ success: true, message: 'Đã tạo mã PIN mới' });
});

// Xác thực PIN
app.post('/auth', (req, res) => {
  const { pin } = req.body;

  if (!currentPin) {
    return res.status(400).json({
      success: false,
      message: 'Chưa có mã PIN được tạo'
    });
  }

  if (pin === currentPin) {
    req.session.authorized = true;
    // Reset PIN sau khi đăng nhập thành công
    currentPin = '';
    res.json({ success: true });
  } else {
    res.status(401).json({
      success: false,
      message: 'Mã PIN không đúng'
    });
  }
});

// Routes cho các trang setup
app.get('/setup/discord', requireAuth, (req, res) => {
  res.render('pages/discord', {
    title: 'Cấu hình Discord',
    currentPage: 'discord',
    currentStep: 1,
    config: config,
    script: '',
    style: ''
  });
});

app.get('/setup/database', requireAuth, (req, res) => {
  res.render('pages/database', {
    title: 'Cấu hình Database',
    currentPage: 'database',
    currentStep: 2,
    config: config,
    script: '',
    style: ''
  });
});

app.get('/setup/general', requireAuth, (req, res) => {
  res.render('pages/general', {
    title: 'Cấu hình chung',
    currentPage: 'general',
    currentStep: 3,
    config: config,
    script: '',
    style: ''
  });
});

app.get('/setup/platforms', requireAuth, (req, res) => {
  res.render('pages/platforms', {
    title: 'Cấu hình nền tảng',
    currentPage: 'platforms',
    currentStep: 4, // Cập nhật số bước
    config: config,
    script: '',
    style: ''
  });
});

app.get('/setup/review', requireAuth, (req, res) => {
  const configPath = path.join(__dirname, '../config/config.js');
  const configContent = fs.readFileSync(configPath, 'utf8');

  res.render('pages/review', {
    title: 'Xem cấu hình',
    currentPage: 'review',
    currentStep: 5, // Cập nhật số bước
    config: config,
    configContent: configContent, // Truyền nội dung file config
    script: '',
    style: ''
  });
});

// API để kiểm tra Discord Bot Token
app.post('/api/validate-token', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const testClient = new Client({
    intents: [GatewayIntentBits.Guilds] // Chỉ cần intent tối thiểu để login
  });

  try {
    await testClient.login(token);
    const botName = testClient.user.username;
    // Đăng nhập thành công, token hợp lệ
    res.json({ success: true, message: 'Token hợp lệ', botName: botName });
  } catch (error) {
    // Đăng nhập thất bại, token không hợp lệ
    logger.error('[Easysetup] Lỗi khi xác thực token:', error.message);
    res.status(401).json({ success: false, message: 'Token không hợp lệ' });
  } finally {
    // Hủy client tạm thời để giải phóng tài nguyên
    testClient.destroy();
  }
});

// API để kiểm tra Client ID và Client Secret
app.post('/api/validate-credentials', requireAuth, async (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ success: false, message: 'Client ID and Client Secret are required' });
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('scope', 'identify');

  try {
    const response = await axios.post('https://discord.com/api/oauth2/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      }
    });

    if (response.data.access_token) {
      res.json({ success: true, message: 'Credentials hợp lệ' });
    } else {
      throw new Error('Invalid response from Discord');
    }
  } catch (error) {
    logger.error('[Easysetup] Lỗi khi xác thực credentials:', error.response?.data || error.message);
    res.status(401).json({ success: false, message: 'Credentials không hợp lệ' });
  }
});

// API để kiểm tra Spotify Client ID và Client Secret
app.post('/api/validate-spotify', requireAuth, async (req, res) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ success: false, message: 'Thiếu Client ID hoặc Client Secret' });
  }
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      timeout: 5000
    });
    if (response.data && response.data.access_token) {
      if (debugMode) {
        logger.debug('✅ Spotify: Thông tin hợp lệ');
      }
      return res.json({ success: true, message: 'Thông tin hợp lệ' });
    }
    return res.status(401).json({ success: false, message: 'Không lấy được access token' });
  } catch (error) {
    if (debugMode) {
      logger.error('❌ Spotify: Thông tin không hợp lệ hoặc lỗi mạng');
    }
    res.status(401).json({ success: false, message: 'Thông tin không hợp lệ hoặc lỗi mạng' });
  }
});

// API để lấy cấu hình hiện tại
app.get('/api/get-config', requireAuth, (req, res) => {
  // Xóa cache để luôn đọc file mới nhất
  delete require.cache[require.resolve('../config/config.js')];
  const currentConfig = require('../config/config.js');
  res.json(currentConfig);
});

// API để cập nhật một phần cấu hình
app.post('/api/update-config', requireAuth, (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, message: 'Thiếu key' });
    }

    const configPath = path.join(__dirname, '../config/config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    let originalContent = configContent;

    const keys = key.split('.');
    let regex;

    // Phân biệt logic cho kiểu dữ liệu boolean và string
    if (typeof value === 'boolean') {
      if (keys.length === 3) {
        const [p1, p2, p3] = keys;
        regex = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*{[\\s\\S]*?${p3}:\\s*)(true|false)`, 'g');
      } else if (keys.length === 2) {
        const [p1, p2] = keys;
        regex = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*)(true|false)`, 'g');
      } else {
        const [p1] = keys;
        regex = new RegExp(`(${p1}:\\s*)(true|false)`, 'g');
      }
      configContent = configContent.replace(regex, `$1${value}`);
    } else {
      let regexSingle, regexDouble;
      if (keys.length === 3) {
        const [p1, p2, p3] = keys;
        regexSingle = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*{[\\s\\S]*?${p3}:\\s*')([^']*)(')`, 'g');
        regexDouble = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*{[\\s\\S]*?${p3}:\\s*")([^"]*)(")`, 'g');
      } else if (keys.length === 2) {
        const [p1, p2] = keys;
        regexSingle = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*')([^']*)(')`, 'g');
        regexDouble = new RegExp(`(${p1}:\\s*{[\\s\\S]*?${p2}:\\s*")([^"]*)(")`, 'g');
      } else {
        const [p1] = keys;
        regexSingle = new RegExp(`(${p1}:\\s*')([^']*)(')`, 'g');
        regexDouble = new RegExp(`(${p1}:\\s*")([^"]*)(")`, 'g');
      }
      configContent = configContent.replace(regexSingle, `$1${value}$3`);
      configContent = configContent.replace(regexDouble, `$1${value}$3`);
    }

    if (originalContent !== configContent) {
      fs.writeFileSync(configPath, configContent, 'utf8');
      res.json({ success: true, message: 'Đã cập nhật cấu hình' });
    } else {
      res.json({ success: true, message: 'Không tìm thấy key trong config để cập nhật' });
    }
  } catch (error) {
    logger.error('[Easysetup] Lỗi khi cập nhật cấu hình:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
});


// API để lấy nội dung file config (cho trang review)
app.get('/api/get-config-content', requireAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, '../config/config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    res.json({ success: true, content: configContent });
  } catch (error) {
    logger.error('[Easysetup] Lỗi khi đọc file config:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đọc file config' });
  }
});

// API để lưu toàn bộ nội dung file config (từ trang review)
app.post('/api/save-config-content', requireAuth, (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung không hợp lệ' });
    }

    const configPath = path.join(__dirname, '../config/config.js');
    fs.writeFileSync(configPath, content, 'utf8');
    res.json({ success: true, message: 'Đã lưu toàn bộ cấu hình' });

  } catch (error) {
    logger.error('[Easysetup] Lỗi khi lưu toàn bộ cấu hình:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
});

// API để kiểm tra các trường bắt buộc đã được điền chưa
app.get('/api/validate-required-config', (req, res) => {
  let currentConfig;
  try {
    delete require.cache[require.resolve('../config/config.js')];
    currentConfig = require('../config/config.js');
  } catch (error) {
    logger.error('[Easysetup] Lỗi khi đọc config.js:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi cú pháp trong file config.js. Vui lòng kiểm tra lại.',
      error: error.message
    });
  }

  const missingFields = [];

  // Kiểm tra các đối tượng cha có tồn tại không
  const dashboardConf = currentConfig.dashboard || {};
  const mongodbConf = currentConfig.mongodb || {};
  const mongoAuthConf = mongodbConf.auth || {};

  // Kiểm tra các trường cấp cao nhất
  if (!currentConfig.token) missingFields.push('Discord Bot Token (Discord)');
  if (!currentConfig.clientId) missingFields.push('Discord Bot Client ID (Discord)');

  // Kiểm tra trong dashboard
  if (!dashboardConf.clientId) missingFields.push('Dashboard Client ID (Discord)');
  if (!dashboardConf.clientSecret) missingFields.push('Dashboard Client Secret (Discord)');
  if (!dashboardConf.redirectUri || dashboardConf.redirectUri === 'http://example.com/auth/callback') missingFields.push('Dashboard Redirect URI (Cấu hình chung)');
  if (!dashboardConf.sessionSecret) missingFields.push('Dashboard Session Secret (Cấu hình chung)');

  // Kiểm tra trong mongodb
  if (!mongodbConf.ip) missingFields.push('Database IP (Database)');
  if (!mongodbConf.port) missingFields.push('Database Port (Database)');
  if (!mongodbConf.database) missingFields.push('Database Name (Database)');

  // Nếu bật xác thực, kiểm tra thêm user/pass/authSource
  if (mongoAuthConf.enabled) {
    if (!mongoAuthConf.username) missingFields.push('Database Username (Database)');
    if (!mongoAuthConf.password) missingFields.push('Database Password (Database)');
    if (!mongoAuthConf.authSource) missingFields.push('Database Auth Source (Database)');
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.',
      missing: missingFields
    });
  }

  res.json({ success: true, message: 'Tất cả các trường bắt buộc đã được điền.' });
});

// API để hoàn tất setup và thông báo tắt
app.post('/api/complete-setup', requireAuth, (req, res) => {
  logger.info('[Easysetup] Cấu hình hoàn tất. Vui lòng khởi động lại bot.');
  // Chỉ gửi lại thông báo thành công, không thoát process nữa
  res.json({ success: true, message: 'Setup completed. Please restart the bot.' });
});

// Khởi động server trên port 3000
const PORT = 3000;
app.listen(PORT, () => {
  logger.info(`[Easysetup] Đang chạy tại http://localhost:${PORT}`);
});

// API cập nhật riêng cho Spotify Client ID/Secret (chỉ cho phép cập nhật spotify.clientId và spotify.clientSecret)
app.post('/api/update-spotify', requireAuth, (req, res) => {
  try {
    const { clientId, clientSecret } = req.body;
    if (typeof clientId !== 'string' || typeof clientSecret !== 'string') {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin.' });
    }
    const configPath = path.join(__dirname, '../config/config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    let originalContent = configContent;
    // Regex cập nhật clientId và clientSecret trong object spotify
    configContent = configContent.replace(/(spotify:\s*{[^}]*clientId:\s*)['\"][^'\"]*['\"]/, `$1'${clientId}'`);
    configContent = configContent.replace(/(spotify:\s*{[^}]*clientSecret:\s*)['\"][^'\"]*['\"]/, `$1'${clientSecret}'`);
    if (originalContent !== configContent) {
      fs.writeFileSync(configPath, configContent, 'utf8');
      res.json({ success: true, message: 'Đã cập nhật Spotify Client ID/Secret' });
    } else {
      res.json({ success: true, message: 'Không tìm thấy key spotify trong config để cập nhật' });
    }
  } catch (err) {
    logger.error('[Easysetup] Lỗi cập nhật Spotify:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
});

// API cập nhật riêng cho Discord (masterAdmin, token, clientId, dashboard.clientSecret)
app.post('/api/update-discord', requireAuth, (req, res) => {
  try {
    const { masterAdmin, token, clientId, clientSecret } = req.body;
    const configPath = path.join(__dirname, '../config/config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    let originalContent = configContent;
    if (typeof masterAdmin === 'string') {
      configContent = configContent.replace(/(masterAdmin:\s*)['\"][^'\"]*['\"]/, `$1'${masterAdmin}'`);
    }
    if (typeof token === 'string') {
      configContent = configContent.replace(/(token:\s*)['\"][^'\"]*['\"]/, `$1'${token}'`);
    }
    if (typeof clientId === 'string') {
      // Cập nhật clientId ở root
      configContent = configContent.replace(/(clientId:\s*)['\"][^'\"]*['\"]/, `$1'${clientId}'`);
      // Cập nhật clientId trong dashboard nếu có
      configContent = configContent.replace(/(dashboard:\s*{[^}]*clientId:\s*)['\"][^'\"]*['\"]/, `$1'${clientId}'`);
    }
    if (typeof clientSecret === 'string') {
      configContent = configContent.replace(/(dashboard:\s*{[^}]*clientSecret:\s*)['\"][^'\"]*['\"]/, `$1'${clientSecret}'`);
    }
    if (originalContent !== configContent) {
      fs.writeFileSync(configPath, configContent, 'utf8');
      res.json({ success: true, message: 'Đã cập nhật thông tin Discord' });
    } else {
      res.json({ success: true, message: 'Không có thay đổi để cập nhật' });
    }
  } catch (err) {
    logger.error('[Easysetup] Lỗi cập nhật Discord:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
});

// API cập nhật đồng thời mongodb.ip và mongodb.port
app.post('/api/update-db-ip-port', requireAuth, (req, res) => {
  try {
    const { ip, port } = req.body;
    if (typeof ip !== 'string' || typeof port !== 'number') {
      return res.status(400).json({ success: false, message: 'Thiếu ip hoặc port' });
    }
    const configPath = path.join(__dirname, '../config/config.js');
    let configContent = fs.readFileSync(configPath, 'utf8');
    let originalContent = configContent;
    configContent = configContent.replace(/(ip:\s*)['\"][^'\"]*['\"]/, `$1'${ip}'`);
    configContent = configContent.replace(/(port:\s*)[0-9]+/, `$1${port}`);
    if (originalContent !== configContent) {
      fs.writeFileSync(configPath, configContent, 'utf8');
      res.json({ success: true, message: 'Đã cập nhật ip và port' });
    } else {
      res.json({ success: true, message: 'Không có thay đổi để cập nhật' });
    }
  } catch (err) {
    logger.error('[Easysetup] Lỗi cập nhật ip/port:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ.' });
  }
});

// API kiểm tra kết nối MongoDB và xác định có cần xác thực không
app.post('/api/check-mongo', requireAuth, async (req, res) => {
  const { ip, port, dbName, username, password } = req.body;
  if (!ip || !dbName) return res.json({ success: false, message: 'Thiếu thông tin IP hoặc database' });
  let needAuth = false;
  let success = false;
  let message = '';
  const { MongoClient } = require('mongodb');
  let uri = `mongodb://${ip}:${port || 27017}`;
  if (username && password) {
    uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${ip}:${port || 27017}`;
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
    // Luôn check connect trước bằng ping
    await client.db(dbName).command({ ping: 1 });
    // Sau khi ping thành công, luôn thử listCollections để check quyền/auth
    try {
      await client.db(dbName).listCollections().toArray();
      success = true;
      needAuth = false;
      message = 'Kết nối + xác thực thành công (có quyền listCollections)';
    } catch (authErr) {
      success = false;
      needAuth = true;
    }
  } catch (err) {
    if (err.message && /Authentication failed|auth failed|requires authentication|Unauthorized/i.test(err.message)) {
      needAuth = true;
      message = 'Database yêu cầu xác thực';
    } else {
      message = err.message || 'Kết nối thất bại';
    }
  }
  try { await client.close(); } catch (e) { }
  res.json({ success, needAuth, message });
});