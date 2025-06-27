const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config/config');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ==== BẮT LỖI TOÀN CỤC TRƯỚC ====
process.on("uncaughtException", (err) => {
  if (err.message.includes("Used disallowed intents")) {
    console.error("\x1b[31m[❌] Bot đang dùng intents chưa được bật trong Developer Portal.");
    console.log("→ Truy cập: https://discord.com/developers/applications");
    console.log("→ Bật Message Content Intent, Presence Intent, Server Members Intent");
    console.log("→ Nhấn Save Changes và chạy lại bot.\x1b[0m");
    process.exit(1);
  } else {
    console.error(err);
  }
});

// ==== KIỂM TRA INTENT BẰNG API (hiển thị ngay) ====
(async () => {
  await checkIntents(config.token, config.clientId);

  // === Tạo bot sau khi kiểm tra intent ===
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
          clientId: config.spotifyClientId,
          clientSecret: config.spotifyClientSecret,
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

  require('./utils/loader')(client);
  require('./dashboard')();
  client.login(config.token);
})();

// ==== HÀM KIỂM TRA INTENT ====
async function checkIntents(token, clientId) {
  const response = await fetch(`https://discord.com/api/v10/applications/${clientId}`, {
    headers: { Authorization: `Bot ${token}` }
  });

  if (!response.ok) {
    console.error('[❌] Không thể truy cập Discord API. Kiểm tra token hoặc clientId.');
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