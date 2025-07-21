const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
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
            // Logic cho giá trị boolean (true/false, không có dấu nháy)
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
            // Thay thế bằng giá trị boolean mới
            configContent = configContent.replace(regex, `$1${value}`);
        } else {
            // Logic cũ cho giá trị string (có dấu nháy đơn hoặc kép)
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
            // Không tìm thấy key nào để cập nhật, nhưng vẫn trả về thành công để tránh lỗi phía client
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
app.get('/api/validate-required-config', requireAuth, (req, res) => {
    delete require.cache[require.resolve('../config/config.js')];
    const currentConfig = require('../config/config.js');

    const missingFields = [];

    // Kiểm tra các trường cấp cao nhất
    if (!currentConfig.token) missingFields.push('Discord Bot Token (Discord)');
    if (!currentConfig.clientId) missingFields.push('Discord Bot Client ID (Discord)');

    // Kiểm tra trong dashboard
    if (!currentConfig.dashboard.clientId) missingFields.push('Dashboard Client ID (Discord)');
    if (!currentConfig.dashboard.clientSecret) missingFields.push('Dashboard Client Secret (Discord)');
    if (!currentConfig.dashboard.redirectUri || currentConfig.dashboard.redirectUri === 'http://example.com/auth/callback') missingFields.push('Dashboard Redirect URI (Cấu hình chung)');
    if (!currentConfig.dashboard.sessionSecret) missingFields.push('Dashboard Session Secret (Cấu hình chung)');

    // Kiểm tra trong mongodb
    if (!currentConfig.mongodb.ip) missingFields.push('Database IP (Database)');
    if (!currentConfig.mongodb.port) missingFields.push('Database Port (Database)');
    if (!currentConfig.mongodb.database) missingFields.push('Database Name (Database)');
    
    // Nếu bật xác thực, kiểm tra thêm user/pass/authSource
    if (currentConfig.mongodb.auth.enabled) {
        if (!currentConfig.mongodb.auth.username) missingFields.push('Database Username (Database)');
        if (!currentConfig.mongodb.auth.password) missingFields.push('Database Password (Database)');
        if (!currentConfig.mongodb.auth.authSource) missingFields.push('Database Auth Source (Database)');
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
