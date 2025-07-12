# 🎵 Discord Music Bot

Bot nhạc Discord đa nền tảng hỗ trợ YouTube, Spotify và SoundCloud với giao diện đẹp và tính năng quản lý hàng đợi thông minh.

## 📋 Mục lục

- [Tính năng chính](#-tính-năng-chính)
- [Cài đặt](#-cài-đặt)
- [Cấu hình](#-cấu-hình)
- [Lệnh hỗ trợ](#-lệnh-hỗ-trợ)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Dashboard](#-dashboard)
- [Troubleshooting](#-troubleshooting)

## 🚀 Tính năng chính

### Phát nhạc đa nền tảng
- **YouTube**: Bài hát đơn lẻ, playlist, mix/radio
- **Spotify**: Bài hát, album, playlist (chuyển đổi sang SoundCloud để phát)
- **SoundCloud**: Bài hát đơn lẻ và playlist

### Giao diện đẹp
- Tạo ảnh canvas với hiệu ứng blur cho mọi bài hát
- Hiển thị hàng đợi với thumbnail và thông tin chi tiết
- Thanh tiến trình cho bài hát đang phát
- Icon và số thứ tự trực quan

### Quản lý hàng đợi thông minh
- Hệ thống `QueueManager` riêng biệt để đồng bộ với DisTube
- Giữ nguyên số thứ tự bài hát khi bỏ qua
- Giới hạn hàng đợi có thể cấu hình (mặc định: 30 bài)
- Auto-sync khi thêm/xóa bài

### Tính năng nâng cao
- **Hot Reload**: Tự động tải lại code khi có thay đổi (không cần restart bot)
- **Auto Leave**: Tự động rời voice channel khi hết nhạc hoặc không có người
- **Platform Detection**: Tự động phát hiện loại link và xử lý phù hợp
- **Autocomplete**: Gợi ý tìm kiếm YouTube real-time
- **Lock System**: Ngăn spam khi đang xử lý playlist lớn

## 🛠 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 20.0.0
- FFmpeg
- Canvas dependencies (cho tạo ảnh)

### Dependencies chính
```json
{
  "discord.js": "^14.21.0",
  "distube": "^5.0.7",
  "@distube/spotify": "^2.0.2",
  "@distube/soundcloud": "^2.0.4",
  "@distube/yt-dlp": "^2.0.1",
  "canvas": "^3.1.2",
  "puppeteer": "^24.11.1"
}
```

### Bước cài đặt

1. **Clone repository**
```bash
git clone https://github.com/ZenKho-chill/Discord-Music-Bot.git
cd Discord-Music-Bot
```

2. **Cài đặt dependencies**
```bash
npm install
```

3. **Cấu hình bot**
```bash
cp config/config.js.example config/config.js
```

4. **Chỉnh sửa config.js**
```javascript
module.exports = {
  token: 'YOUR_DISCORD_BOT_TOKEN',
  clientId: 'YOUR_CLIENT_ID',
  spotify: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID',
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET'
  }
  // ... các cài đặt khác
}
```

5. **Chạy bot**
```bash
npm start
# hoặc
node index.js
```

## ⚙️ Cấu hình

### config.js
```javascript
module.exports = {
  // Bot Discord
  token: 'Discord Token',
  clientId: 'Discord Client ID',
  
  // Giới hạn
  maxQueue: 30,          // Số bài tối đa trong hàng đợi
  maxVolume: 150,        // Âm lượng tối đa (%)
  
  // Debug & Development
  debug: false,          // Bật log chi tiết
  registerCommands: true, // Tự động đăng ký slash commands
  
  // Spotify API
  spotify: {
    clientId: 'SPOTIFY_CLIENT_ID',
    clientSecret: 'SPOTIFY_CLIENT_SECRET'
  },
  
  // Bật/tắt tính năng theo nền tảng
  platform: {
    youtube: {
      single: true,      // Bài hát đơn lẻ
      playlist: true     // Playlist
    },
    spotify: {
      single: true,      // Bài hát đơn lẻ
      album: true,       // Album
      playlist: true     // Playlist
    },
    soundcloud: {
      single: true,      // Bài hát đơn lẻ
      playlist: true     // Playlist
    }
  },
  
  // Auto Leave Settings
  leaveOnEmpty: {
    finish: {
      enabled: true,     // Rời khi hết nhạc
      timeout: 10        // Thời gian chờ (giây)
    },
    empty: {
      enabled: true,     // Rời khi phòng trống
      timeout: 30,       // Thời gian chờ (giây)
      pauseOnEmpty: false // true: tạm dừng, false: dừng và rời
    }
  },
  
  leaveOnStop: {
    enabled: true,       // Rời khi dừng nhạc
    timeout: 0           // 0 = ngay lập tức
  }
}
```

## 🎛 Lệnh hỗ trợ

### Lệnh chính
| Lệnh | Mô tả | Cách dùng |
|------|-------|-----------|
| `/phatnhac` | Phát nhạc từ link hoặc tìm kiếm | `/phatnhac name-link: despacito` |
| `/hangdoi` | Hiển thị hàng đợi với giao diện đẹp | `/hangdoi` |
| `/baihatdangphat` | Hiển thị bài hát đang phát | `/baihatdangphat` |
| `/boqua` | Bỏ qua đến bài được chọn | `/boqua target: 5` |

### Lệnh điều khiển
| Lệnh | Mô tả |
|------|-------|
| `/tamdung` | Tạm dừng bài hát |
| `/tieptuc` | Tiếp tục phát nhạc |
| `/dungnhac` | Dừng nhạc và xóa hàng đợi |
| `/amluong` | Điều chỉnh âm lượng (0-150) |
| `/laplai` | Chế độ lặp lại (off/song/queue) |

### Autocomplete
- Lệnh `/phatnhac` hỗ trợ autocomplete với tìm kiếm YouTube real-time
- Lệnh `/boqua` hiển thị danh sách bài hát trong hàng đợi
- Lệnh `/laplai` có menu chọn chế độ lặp

## 🏗 Kiến trúc hệ thống

### Cấu trúc thư mục
```
Discord-Music-Bot/
├── index.js                 # Entry point
├── package.json             # Dependencies
├── config/
│   ├── config.js           # Cấu hình chính
│   └── config.js.example   # Template cấu hình
├── commands/
│   ├── play.js             # Lệnh phát nhạc chính
│   ├── queue.js            # Hiển thị hàng đợi
│   ├── skip.js             # Bỏ qua bài hát
│   ├── nowplaying.js       # Bài hát đang phát
│   ├── pause.js            # Tạm dừng
│   ├── resume.js           # Tiếp tục
│   ├── stop.js             # Dừng nhạc
│   ├── volume.js           # Điều chỉnh âm lượng
│   ├── repeat.js           # Chế độ lặp lại
│   └── platforms/          # Xử lý từng nền tảng
│       ├── index.js        # Export tất cả platforms
│       ├── platformDetector.js # Phát hiện loại link
│       ├── youtube.js      # Xử lý YouTube
│       ├── spotify.js      # Xử lý Spotify
│       └── soundcloud.js   # Xử lý SoundCloud
├── events/
│   ├── ready.js            # Bot khởi động + DisTube events
│   ├── interactionCreate.js # Xử lý slash commands
│   ├── messageCreate.js    # Xử lý prefix commands
│   ├── guildCreate.js      # Bot join server mới
│   └── voiceStateUpdate.js # Auto leave logic
├── utils/
│   ├── loader.js           # Load commands & events
│   ├── queueManager.js     # Quản lý hàng đợi riêng
│   ├── autoLeaveManager.js # Quản lý auto leave
│   ├── hotReload.js        # Hot reload system
│   └── soundcloudUtils.js  # Utilities cho SoundCloud
└── dashboard/              # Web dashboard (optional)
    ├── routes/index.js
    └── views/index.ejs
```

### Luồng xử lý phát nhạc

1. **User gọi `/phatnhac`**
2. **platformDetector.js** phát hiện loại link (YouTube/Spotify/SoundCloud/Search)
3. **routeToPlatform()** chuyển đến handler phù hợp:
   - `youtube.js` - Xử lý YouTube single/playlist/mix
   - `spotify.js` - Xử lý Spotify, chuyển đổi sang SoundCloud
   - `soundcloud.js` - Xử lý SoundCloud direct
4. **DisTube** thực hiện phát nhạc
5. **QueueManager** đồng bộ và quản lý số thứ tự
6. **Canvas** tạo ảnh kết quả đẹp
7. **AutoLeaveManager** theo dõi và tự động rời khi cần

### Hệ thống Platform

#### Platform Detector
```javascript
// Tự động phát hiện loại link
const result = await detectPlatform(query);
// result: { platform: 'youtube', type: 'playlist', query: 'processed_url' }

// Kiểm tra tính năng có được bật không
const enabled = isPlatformFeatureEnabled('spotify', 'playlist');

// Tạo thông báo lỗi thân thiện
const message = createFeatureDisabledMessage('youtube', 'single');
```

#### Xử lý từng Platform

**YouTube** (`youtube.js`):
- Single: Phát trực tiếp qua DisTube
- Playlist: Dùng `@distube/ytpl` để parse, thêm từng bài
- Mix/Radio: Xử lý như playlist với validation đặc biệt

**Spotify** (`spotify.js`):
- Dùng Spotify Plugin để lấy metadata
- Chuyển đổi sang SoundCloud để phát nhạc thực tế
- Giữ nguyên thông tin Spotify trong giao diện

**SoundCloud** (`soundcloud.js`):
- Single: Phát trực tiếp
- Playlist: Parse và thêm từng bài
- Hỗ trợ shortlink resolution (`on.soundcloud.com`)

### Queue Management System

**QueueManager** (`queueManager.js`) hoạt động song song với DisTube:

```javascript
// Đồng bộ từ DisTube
queueManager.syncFromDisTube(guildId, distubeQueue);

// Thêm bài mới với số thứ tự unique
queueManager.addSong(guildId, song);

// Lấy STT cho bài hát
const stt = getSttFromQueueManager(guildId, song, isNewlyAdded);

// Xử lý skip với đồng bộ
queueManager.syncAfterSkip(guildId, currentDistubeQueue);
```

**Tính năng chính:**
- Mỗi bài có `queueId` unique để tránh trùng lặp
- Giữ nguyên số thứ tự ban đầu khi skip
- Auto-sync khi DisTube thay đổi
- Hỗ trợ verification và debugging

### Hot Reload System

**HotReloader** (`hotReload.js`) cho phép dev không cần restart:

```javascript
// Theo dõi tự động tất cả file
hotReloader.startWatching();

// File core cần restart
const coreFiles = ['index.js', 'events/*.js', 'utils/loader.js'];

// File có thể hot reload
const hotReloadableFiles = ['commands/*.js', 'config/config.js', 'utils/queueManager.js'];
```

**Tính năng:**
- Tự động reload commands khi thay đổi
- Reload config real-time
- Cảnh báo khi thay đổi file core
- File cache để tránh conflict

### Auto Leave System

**AutoLeaveManager** (`autoLeaveManager.js`) quản lý việc rời voice:

```javascript
// Block guild tạm thời khi rời do empty
autoLeaveManager.blockGuild(guildId);

// Unblock khi user join lại
autoLeaveManager.unblockGuild(guildId);

// Check trạng thái
const isBlocked = autoLeaveManager.isGuildBlocked(guildId);
```

**Logic trong `voiceStateUpdate.js`:**
1. Theo dõi user rời/join voice channel
2. Đếm số user thực (loại trừ bot)
3. Tạm dừng hoặc dừng nhạc khi empty
4. Set timeout để rời channel
5. Block guild để tránh auto-join lại

## 📊 Dashboard

Bot có web dashboard đơn giản tại `http://localhost:3000`:

**Cấu trúc:**
- `dashboard.js` - Express server setup
- `dashboard/routes/index.js` - Routes definition
- `dashboard/views/index.ejs` - Template

**Tính năng hiện tại:**
- Hiển thị trạng thái bot cơ bản
- Có thể mở rộng thêm controls, statistics, etc.

## 🎨 Canvas Image Generation

Bot tạo ảnh đẹp cho mọi thao tác:

### Tính năng Canvas
- **Background blur**: Dùng StackBlur để tạo hiệu ứng mờ từ thumbnail
- **Rounded corners**: Bo góc cho thumbnail và elements
- **Gradient overlays**: Lớp phủ trong suốt cho text dễ đọc
- **Text truncation**: Cắt text dài với "..."
- **Progress bars**: Thanh tiến trình cho nowplaying
- **Queue numbering**: Số thứ tự trong circle đẹp

### Image Types
1. **Single song result**: Khi phát 1 bài
2. **Playlist result**: Tổng kết khi thêm playlist
3. **Queue display**: Hiển thị hàng đợi paged
4. **Now playing**: Bài đang phát với progress
5. **Skip result**: Kết quả sau khi skip

### Canvas Pipeline
```javascript
// 1. Load thumbnail image
const img = await loadImage(thumbnailUrl);

// 2. Create canvas với kích thước cố định
const canvas = createCanvas(750, 200);

// 3. Draw blurred background
ctx.drawImage(img, 0, 0, width, height);
StackBlur.canvasRGBA(ctx.canvas, 0, 0, width, height, 10);

// 4. Add overlay và rounded thumbnail
ctx.fillStyle = 'rgba(0,0,0,0.55)';
ctx.fillRect(0, 0, width, height);

// 5. Add text với proper positioning
ctx.font = 'bold 32px Arial';
ctx.fillStyle = '#fff';
ctx.fillText(title, x, y);

// 6. Export as Discord attachment
const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'result.png' });
```

## 🔧 Troubleshooting

### Lỗi thường gặp

**1. Bot không phản hồi slash commands**
```bash
# Kiểm tra registerCommands trong config
registerCommands: true

# Check bot permissions
UseApplicationCommands, SendMessages, Connect, Speak
```

**2. Canvas/Image errors**
```bash
# Ubuntu/Debian
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Windows: Cài Visual Studio Build Tools
npm install --global --production windows-build-tools
```

**3. FFmpeg not found**
```bash
# Windows: Download FFmpeg binary
# Linux: sudo apt install ffmpeg
# macOS: brew install ffmpeg
```

**4. Spotify không hoạt động**
- Kiểm tra Spotify Client ID/Secret
- Đảm bảo SoundCloud plugin hoạt động (fallback)
- Check regional restrictions

**5. Queue không đồng bộ**
```javascript
// Force sync trong debug mode
queueManager.syncFromDisTube(guildId, queue);
queueManager.clearQueue(guildId); // Reset nếu cần
```

### Debug Mode

Bật debug trong `config.js`:
```javascript
debug: true
```

**Debug logs gồm:**
- Platform detection details
- Queue sync operations  
- Canvas generation steps
- File change notifications (hot reload)
- Auto leave decisions
- API call results

### Performance Tips

**1. Giảm Canvas generation**
```javascript
// Cache images khi có thể
if (cache[cacheKey] && !needRender) {
  return cachedBuffer;
}
```

**2. Optimize Playlist loading**
```javascript
// Batch thêm bài thay vì từng bài một
const MAX_BATCH_SIZE = 10;
```

**3. Memory management**
```javascript
// Clear timeouts và intervals
if (leaveTimeouts.has(guildId)) {
  clearTimeout(leaveTimeouts.get(guildId));
}
```

## 📈 Tính năng nâng cao

### Custom Platform Handler

Tạo platform mới trong `commands/platforms/`:

```javascript
// newplatform.js
async function handleNewPlatform(client, interaction, query, voiceChannel, lockKey) {
  // 1. Validate platform feature
  if (!isPlatformFeatureEnabled('newplatform', 'single')) {
    return await interaction.followUp({
      content: createFeatureDisabledMessage('newplatform', 'single'),
      ephemeral: true
    });
  }
  
  // 2. Process query
  const result = await processNewPlatformQuery(query);
  
  // 3. Play via DisTube
  await client.distube.play(voiceChannel, result.url, {
    textChannel: interaction.channel,
    member: interaction.member
  });
  
  // 4. Generate result image
  await generateResultImage(interaction.channel, result);
}
```

### Lock System cho Heavy Operations

```javascript
// Set lock trước khi xử lý playlist lớn
client._addLock[lockKey] = true;

try {
  // Heavy operation
  await processLargePlaylist();
} finally {
  // Always cleanup
  delete client._addLock[lockKey];
}
```

### Custom Canvas Themes

```javascript
// theme.js
const themes = {
  dark: { bg: '#1a1a1a', text: '#ffffff', accent: '#ff6b6b' },
  light: { bg: '#ffffff', text: '#333333', accent: '#4dabf7' },
  neon: { bg: '#0f0f23', text: '#00ff41', accent: '#ff00ff' }
};

function applyTheme(ctx, themeName) {
  const theme = themes[themeName] || themes.dark;
  ctx.fillStyle = theme.bg;
  // Apply theme colors...
}
```

---

## 👨‍💻 Tác giả

**ZenKho** - Developer chính

- GitHub: [@ZenKho-chill](https://github.com/ZenKho-chill)
- Discord Music Bot với kiến trúc hiện đại và tính năng đầy đủ

## 📄 License

Dự án này được phát hành dưới giấy phép [LGPL-3.0](LICENSE).

## 🤝 Contributing

Chúng tôi hoan nghênh mọi đóng góp! Vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

**Cảm ơn bạn đã sử dụng Discord Music Bot! 🎵**
