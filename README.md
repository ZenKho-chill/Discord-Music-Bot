<div id="top">

<!-- HEADER STYLE: CLASSIC -->
<div align="center">

# DISCORD MUSIC BOT

<em></em>

<!-- BADGES -->
<!-- local repository, no metadata badges. -->

<em>Sử dụng những công nghệ:</em>

<img src="https://img.shields.io/badge/Express-000000.svg?style=default&logo=Express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/JSON-000000.svg?style=default&logo=JSON&logoColor=white" alt="JSON">
<img src="https://img.shields.io/badge/npm-CB3837.svg?style=default&logo=npm&logoColor=white" alt="npm">
<img src="https://img.shields.io/badge/Mongoose-F04D35.svg?style=default&logo=Mongoose&logoColor=white" alt="Mongoose">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=default&logo=JavaScript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/MongoDB-47A248.svg?style=default&logo=MongoDB&logoColor=white" alt="MongoDB">
<img src="https://img.shields.io/badge/FFmpeg-007808.svg?style=default&logo=FFmpeg&logoColor=white" alt="FFmpeg">
<img src="https://img.shields.io/badge/Discord-5865F2.svg?style=default&logo=Discord&logoColor=white" alt="Discord">

</div>
<br>

---

## Danh sách lệnh

<code>❯ /autoplay: Bật hoặc tắt tự động phát nhạc trong hàng chờ</code>

<code>❯ /clear: Xóa sạch hàng chờ nhạc</code>

<code>❯ /filter: Thêm bộ lọc âm thanh cho nhạc đang phát</code>

<code>❯ /help: Xem thông tin về bot và các lệnh có sẵn</code>

<code>❯ /loop: Bật hoặc tắt chế độ lặp lại nhạc</code>

<code>❯ /nowplaying: Bật hoặc tắt chế độ lặp lại nhạc</code>

<code>❯ /owner: Lấy thông tin của chủ bot</code>

<code>❯ /pause: Tạm dừng bài hát đang phát</code>

<code>❯ /ping: Kiểm tra độ trễ của bot</code>

<code>❯ /play: Cùng nghe một chút nhạc nào</code>

<code>❯ /playsong normal: Mở nhạc từ các nền tảng khác</code>

<code>❯ /playsong playlist: Nhập tên playlist bạn muốn phát</code>

<code>❯ /previous: Phát lại bài hát trước đó</code>

<code>❯ /queue: Hiển thị danh sách hàng đợi các bài hát</code>

<code>❯ /resume: Tiếp tục bài hát đã tạm dừng</code>

<code>❯ /seek: Tua một đoạn trong bài hát</code>

<code>❯ /shuffle: Xáo trộn danh sách nhạc trong hàng chờ</code>

<code>❯ /skip: Chuyển bài hát đang phát</code>

<code>❯ /stop: Dừng nhạc</code>

<code>❯ /time: Hiển thị vị trí phút hiện tại trong bài hát đang phát</code>

<code>❯ /volume: Điều chỉnh âm lượng của nhạc</code>

---

## Cấu trúc dự án

```sh
└── Discord Music Bot/
    ├── bot.js
    ├── commands
    │   ├── autoplay.js
    │   ├── clear.js
    │   ├── filter.js
    │   ├── help.js
    │   ├── loop.js
    │   ├── nowplaying.js
    │   ├── owner.js
    │   ├── pause.js
    │   ├── ping.js
    │   ├── play.js
    │   ├── playnormal.js
    │   ├── previous.js
    │   ├── queue.js
    │   ├── resume.js
    │   ├── seek.js
    │   ├── shuffle.js
    │   ├── skip.js
    │   ├── stop.js
    │   ├── time.js
    │   └── volume.js
    ├── config.js
    ├── events
    │   ├── interactionCreate.js
    │   ├── player
    │   ├── ready.js
    │   └── voiceStateUpdate.js
    ├── index.html
    ├── index.js
    ├── LICENSE
    ├── mongoDB.js
    ├── package.json
    ├── README.md
    └── util
        └── pw.js
```

## Hướng dẫn

### Yêu cầu

Dự án này yêu cầu các phần mềm sau:

- **Ngôn ngữ:** JavaScript
- **Quản lý module:** Npm

### Cài đặt

Tải Discord Music Bot và cài đặt:

1. **Tải dự án về:**

    ```sh
    git clone ../Discord Music Bot
    ```

2. **Đi đến nơi lưu dự án:**

    ```sh
    cd Discord Music Bot
    ```

3. **Cài các module:**

	```sh
	npm install
	```

4. **Cấu hình .env**
- Bạn có thể cấu hình theo file .env.example

5. **Cấu hình bot**
- Bạn hãy cấu hình những thứ thiết yếu tại file config.js

### Sử dụng

Khởi động bot với:

**Sử dụng [npm](https://www.npmjs.com/):**
```sh
npm start
```
**Sử dụng [docker](https://www.docker.com/):**
```sh
docker compose up -d --build
```

---

## License

Discord music bot được sử dụng bản quyền của  [GNU](https://choosealicense.com/licenses). Để biết thêm thông tin, bạn có thể truy cập [Giấy phép GNU v3.0](https://choosealicense.com/licenses/agpl-3.0/).

---

##  Góp ý
Nếu bạn gặp lỗi hoặc muốn đề xuất tính năng mới, hãy tạo issue hoặc liên hệ [ZenKho tại Discord](https://discord.com/users/917970047325077615).

[![][back-to-top]](#top)

</div>


[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square


---
