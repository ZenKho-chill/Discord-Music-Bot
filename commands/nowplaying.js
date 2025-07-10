const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('baihatdangphat')
    .setDescription('Hiển thị bài hát đang phát với giao diện đẹp'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({ content: '❌ Không có bài hát nào đang phát!', ephemeral: true });
    }
    // Lấy song từ queueManager để lấy queueId và stt đồng bộ
    const queueManager = require('../utils/queueManager');
    queueManager.syncFromDisTube(guildId, queue);
    const allSongs = queueManager.getQueue(guildId);
    const song = allSongs[0] || queue.songs[0];
    const current = Math.floor(queue.currentTime || 0);
    const total = song.duration ? (typeof song.duration === 'number' ? song.duration : song.duration.split(':').reduce((a, b) => a * 60 + +b)) : 0;
    const percent = total ? Math.min(current / total, 1) : 0;

    // Tạo card nhạc
    const width = 750, height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Nền mờ từ ảnh nhạc
    let img;
    let thumbUrl = song.thumbnail;
    // DEBUG: Hiển thị queueId nếu muốn
    // console.log('Now playing queueId:', song.queueId, 'STT:', song.stt);
    // Nếu là thumbnail YouTube hoặc link YouTube, tự động thử nhiều độ phân giải
    if (song.url && song.url.includes('youtube.com')) {
      const match = song.url.match(/v=([\w-]+)/);
      if (match && match[1]) {
        const videoId = match[1];
        const resolutions = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];
        let foundImage = false;
        for (const res of resolutions) {
          try {
            thumbUrl = `https://img.youtube.com/vi/${videoId}/${res}.jpg`;
            img = await loadImage(thumbUrl);
            foundImage = true;
            break;
          } catch (e) { continue; }
        }
        if (!foundImage) {
          img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
        }
      }
    }
    if (!img) {
      try {
        if (!thumbUrl || !/^https?:\/\//.test(thumbUrl)) throw new Error('Invalid thumbnail');
        img = await loadImage(thumbUrl);
      } catch (e) {
        img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
      }
    }

    // Vẽ ảnh nền với tỷ lệ khung hình đúng
    const bgRatio = width / height;
    const imgRatio = img.width / img.height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
    
    if (imgRatio > bgRatio) {
      // Ảnh rộng hơn
      sWidth = img.height * bgRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      // Ảnh cao hơn
      sHeight = img.width / bgRatio;
      sy = (img.height - sHeight) / 2;
    }
    
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);

    // Ảnh nhạc bo góc trái
    const thumbSize = 160;
    const thumbX = 20;
    const thumbY = 20;
    const cornerRadius = 28;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(thumbX + cornerRadius, thumbY);
    ctx.arcTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + thumbSize, cornerRadius);
    ctx.arcTo(thumbX + thumbSize, thumbY + thumbSize, thumbX, thumbY + thumbSize, cornerRadius);
    ctx.arcTo(thumbX, thumbY + thumbSize, thumbX, thumbY, cornerRadius);
    ctx.arcTo(thumbX, thumbY, thumbX + thumbSize, thumbY, cornerRadius);
    ctx.closePath();
    ctx.clip();

    // Vẽ thumbnail với tỷ lệ khung hình đúng
    const thumbImgRatio = img.width / img.height;
    let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
    
    if (thumbImgRatio > 1) {
      // Ảnh rộng hơn
      thumbSWidth = img.height;
      thumbSx = (img.width - thumbSWidth) / 2;
    } else {
      // Ảnh cao hơn
      thumbSHeight = img.width;
      thumbSy = (img.height - thumbSHeight) / 2;
    }

    ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
    ctx.restore();

    // Điều chỉnh vị trí text để phù hợp với thumbnail mới
    const textX = thumbX + thumbSize + 30;

    // Tiêu đề
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(song.name, textX, 65, width - textX - 100);

    // Nghệ sĩ
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText(song.uploader?.name || song.artist || '', textX, 100, width - textX - 100);

    // Trạng thái
    ctx.font = '20px Arial';
    ctx.fillStyle = '#00ff29';
    ctx.fillText('NOW PLAYING', textX, 130);

    // Progress bar với gradient và bo góc
    const progressWidth = width - textX - 100;
    const progressHeight = 10;
    const progressY = 140;

    // Vẽ background của progress bar
    ctx.beginPath();
    ctx.roundRect(textX, progressY, progressWidth, progressHeight, progressHeight/2);
    ctx.fillStyle = '#444';
    ctx.fill();

    // Vẽ progress hiện tại với gradient
    const gradient = ctx.createLinearGradient(textX, 0, textX + progressWidth, 0);
    gradient.addColorStop(0, '#00ff29');
    gradient.addColorStop(1, '#00cc29');
    
    ctx.beginPath();
    ctx.roundRect(textX, progressY, progressWidth * percent, progressHeight, progressHeight/2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Thời gian
    ctx.font = '18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(new Date(current * 1000).toISOString().substr(14, 5), textX, 170);
    ctx.textAlign = 'right';
    ctx.fillText(new Date(total * 1000).toISOString().substr(14, 5), textX + progressWidth, 170);
    ctx.textAlign = 'left';

    // Gửi ảnh card nhạc trực tiếp
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'nowplaying.png' });
    await interaction.reply({ files: [attachment] });
  }
}; 