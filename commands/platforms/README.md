# Platform Handlers System

Hệ thống xử lý platform được tách ra thành các module riêng biệt để dễ bảo trì và mở rộng.

## Cấu trúc thư mục

```
commands/platforms/
├── index.js              # Export tất cả handlers
├── platformDetector.js   # Phát hiện platform và điều hướng
├── youtube.js           # Xử lý YouTube (playlist, mix, single)
├── spotify.js           # Xử lý Spotify (playlist, album, single)
├── soundcloud.js        # Xử lý SoundCloud (playlist, single)
└── README.md            # Tài liệu này
```

## Cách hoạt động

### 1. Platform Detection (`platformDetector.js`)
- Phát hiện loại platform từ URL hoặc từ khóa
- Hỗ trợ các platform: YouTube, Spotify, SoundCloud
- Phân loại content type: playlist, album, mix, single, search
- Resolve shortlinks (on.soundcloud.com)

### 2. Routing System
- `routeToPlatform()`: Điều hướng logic đến handler tương ứng
- Tự động chọn handler dựa trên platform và content type
- Fallback về YouTube search nếu không nhận diện được

### 3. Platform Handlers

#### YouTube Handler (`youtube.js`)
- **Playlist**: Xử lý playlist YouTube với progress tracking
- **Mix**: Crawl và thêm bài từ YouTube Mix với progress bar
- **Single**: Phát bài hát đơn lẻ với ảnh nowplaying
- **Search**: Tìm kiếm và hiển thị select menu

#### Spotify Handler (`spotify.js`)
- **Playlist/Album**: Xử lý playlist và album Spotify
- **Single**: Phát bài hát đơn lẻ với oEmbed thumbnail
- Tích hợp với Spotify API để lấy metadata

#### SoundCloud Handler (`soundcloud.js`)
- **Playlist**: Xử lý playlist SoundCloud
- **Single**: Phát bài hát đơn lẻ
- Hỗ trợ shortlinks và oEmbed

## Cách sử dụng

### Trong file chính (play.js)
```javascript
const { routeToPlatform } = require('./platforms/platformDetector');

// Thay thế logic cũ bằng:
await routeToPlatform(client, interaction, query, voiceChannel, lockKey);
```

### Thêm platform mới
1. Tạo file handler mới (ví dụ: `deezer.js`)
2. Thêm logic detection trong `platformDetector.js`
3. Thêm case trong `routeToPlatform()`
4. Export trong `index.js`

## Lợi ích

- **Modular**: Mỗi platform có logic riêng, dễ bảo trì
- **Scalable**: Dễ dàng thêm platform mới
- **Maintainable**: Code được tổ chức rõ ràng
- **Reusable**: Các function có thể tái sử dụng
- **Testable**: Dễ dàng test từng module riêng biệt

## Features

### Tự động phát hiện
- YouTube: playlist, mix, video
- Spotify: playlist, album, track
- SoundCloud: playlist, track
- Shortlinks: on.soundcloud.com

### Progress Tracking
- YouTube Mix: Progress bar với button dừng
- Playlist: Embed với thông tin tiến trình
- Lock system: Tránh conflict khi thêm nhiều playlist

### Rich UI
- Ảnh nowplaying cho bài hát đơn lẻ
- Ảnh kết quả cho playlist
- Select menu cho tìm kiếm
- Embed với thông tin chi tiết 