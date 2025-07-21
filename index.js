
// Khai báo các thư viện cần thiết
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let config;
try {
  config = require('./config/config');
} catch (err) {
  console.error('[Lỗi] Không tìm thấy file config.js, khởi động easy setup...');
  return startEasySetup();
}

// Hàm kiểm tra thông tin cấu hình bắt buộc
function thieuThongTinConfig(cfg) {
  // Kiểm tra các trường bắt buộc
  if (!cfg.token || !cfg.clientId || !cfg.masterAdmin || !cfg.spotify?.clientSecret) return true;
  if (!cfg.mongodb || !cfg.mongodb.ip || !cfg.mongodb.port || !cfg.mongodb.database) return true;
  return false;
}

if (thieuThongTinConfig(config)) {
  console.error('[Lỗi] Thiếu thông tin cấu hình quan trọng, khởi động easy setup...');
  return startEasySetup();
}


// ==== BẮT LỖI TOÀN CỤC TRƯỚC ====
process.on("uncaughtException", (err) => {
  console.error('[Lỗi toàn cục]', err);
});

// ==== KIỂM TRA INTENT BẰNG API (hiển thị ngay) ====

// ==== KHỞI ĐỘNG BOT CHÍNH ====
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');

(async () => {
  await checkIntents(config.token, config.clientId);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.commands = new Collection();

  client.distube = new DisTube(client, {
    plugins: [
      new SpotifyPlugin({
        api: {
          clientId: config.spotify.clientId,
          clientSecret: config.spotify.clientSecret,
        },
      }),
      new SoundCloudPlugin(),
      new YtDlpPlugin({
        ytdlOptions: {
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          filter: 'audioonly',
        },
      }),
    ],
  });

  client.distube.setMaxListeners(10);

  // Debug plugin và phiên bản
  if (config.debug) {
    console.log('Cấu hình truyền vào SpotifyPlugin:', config.spotify);
    console.log('DisTube plugins:', client.distube.plugins?.map(p => p && p.name));
  }

  require('./utils/loader')(client);

  client.once('ready', () => {
    require('./dashboard')(client);
  });

  client.login(config.token);
})();


// ==== HÀM KIỂM TRA INTENT ====
async function checkIntents(token, clientId) {
  const response = await fetch(`https://discord.com/api/v10/applications/${clientId}`, {
    headers: { Authorization: `Bot ${token}` }
  });

  if (!response.ok) {
    console.error('[❌] Không thể truy cập Discord API. Vui lòng kiểm tra lại token hoặc clientId.');
    process.exit(1);
  }

  const app = await response.json();
  console.log("[✔] Token hợp lệ. Bot Discord:", app.name);

  console.warn("\x1b[36m[i] Lưu ý: Discord đã ngừng cập nhật 'flags' chính xác từ 2023. Kết quả kiểm tra intents có thể sai lệch.\x1b[0m");

  const flags = app.flags ?? 0;
  const intents = {
    MESSAGE_CONTENT: (flags & (1 << 15)) !== 0,
    GUILD_PRESENCES: '⚠ Không xác định (Discord không còn cung cấp flag chính xác)',
    GUILD_MEMBERS: (flags & (1 << 1)) !== 0
  };

  for (const [intent, status] of Object.entries(intents)) {
    if (status === true) {
      console.log(`\x1b[32m[✔] ${intent} đã bật\x1b[0m`);
    } else if (status === false) {
      console.warn(`\x1b[33m[⚠] INTENT CHƯA BẬT: ${intent} — Vào Developer Portal và bật thủ công\x1b[0m`);
    } else {
      console.warn(`\x1b[36m[ℹ] ${intent}: ${status}\x1b[0m`);
    }
  }
}

// ==== EASY SETUP WEB ====
// Khởi động easy setup giao diện lấy admin ID qua Discord login
function startEasySetup() {
  require('./easysetup/index');
}