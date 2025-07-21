const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
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

app.get('/setup/platforms', requireAuth, (req, res) => {
    res.render('pages/platforms', {
        title: 'Cấu hình nền tảng',
        currentPage: 'platforms',
        currentStep: 3,
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
        currentStep: 4,
        config: config,
        configContent: configContent, // Truyền nội dung file config
        script: '',
        style: ''
    });
});

// API để lấy nội dung file config
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

// API để lưu cấu hình
app.post('/save-config', express.json(), (req, res) => {
    try {
        const newConfig = req.body;
        
        // Validate các trường bắt buộc
        if (!newConfig.bot?.token || !newConfig.bot?.clientId || 
            !newConfig.spotify?.clientId || !newConfig.spotify?.clientSecret) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin bắt buộc'
            });
        }

        // Đọc nội dung config hiện tại
        const configPath = path.join(__dirname, '../config/config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');

        // Cập nhật các giá trị trong config
        configContent = configContent.replace(/'DISCORD_TOKEN_ID'/g, `'${newConfig.bot.token}'`);
        configContent = configContent.replace(/'DISCORD_CLIEND_ID'/g, `'${newConfig.bot.clientId}'`);
        configContent = configContent.replace(/'SPOTIFY_CLIENT_ID'/g, `'${newConfig.spotify.clientId}'`);
        configContent = configContent.replace(/'SPOTIFY_CLIENT_SECRET'/g, `'${newConfig.spotify.clientSecret}'`);

        // Lưu config mới
        fs.writeFileSync(configPath, configContent);
        
        logger.info('[Easysetup] Đã cập nhật cấu hình thành công');
        res.json({ 
            success: true, 
            message: 'Cấu hình đã được lưu. Bot sẽ tự động khởi động lại.',
            requireRestart: true 
        });

        // Thoát process sau 2 giây để client kịp nhận response
        setTimeout(() => {
            process.exit(0);
        }, 2000);

    } catch (error) {
        logger.error('[Easysetup] Lỗi khi lưu cấu hình:', error);
        res.status(500).json({ success: false, message: 'Lỗi khi lưu cấu hình' });
    }
});

// Khởi động server trên port 3000
const PORT = 3000;
app.listen(PORT, () => {
    logger.info(`[Easysetup] Đang chạy tại http://localhost:${PORT}`);
});
