const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Hiển thị hàng đợi nhạc với giao diện đẹp'),

  async execute(client, interaction) {
    const queue = client.distube.getQueue(interaction.guildId);
    if (!queue || !queue.songs || queue.songs.length === 0) {
      return interaction.reply({ content: '❌ Hàng đợi trống!', ephemeral: true });
    }
    // Giới hạn queue tối đa 30 bài
    const maxQueue = 30;
    const allSongs = queue.songs.slice(0, maxQueue);
    const chunkSize = 10;
    // Cache queue: lưu vào interaction.client._queueCache
    if (!interaction.client._queueCache) interaction.client._queueCache = {};
    const cache = interaction.client._queueCache;
    const cacheKey = `${interaction.guildId}`;
    const firstSongId = allSongs[0]?.id || '';
    const queueLength = allSongs.length;
    let needRender = true;
    if (cache[cacheKey] && cache[cacheKey].firstSongId === firstSongId && cache[cacheKey].queueLength === queueLength) {
      // Không đổi queue, dùng lại buffer ảnh cũ
      needRender = false;
    }
    let imageBuffers = [];
    if (!needRender) {
      imageBuffers = cache[cacheKey].buffers;
    } else {
      // Render lại toàn bộ
      imageBuffers = [];
      for (let chunkIdx = 0; chunkIdx < allSongs.length; chunkIdx += chunkSize) {
        const songs = allSongs.slice(chunkIdx, chunkIdx + chunkSize);
        const width = 750;
        const itemHeight = 80;
        const padding = 30;
        const headerHeight = 70;
        const height = headerHeight + songs.length * itemHeight + padding * 2;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        const isFirstImage = chunkIdx === 0;
        // Nếu không phải ảnh đầu, bỏ header và giảm chiều cao
        let realHeaderHeight = isFirstImage ? headerHeight : 0;
        let realPadding = padding;
        const heightChunk = realHeaderHeight + songs.length * itemHeight + realPadding * 2;
        const canvasChunk = createCanvas(width, heightChunk);
        const ctxChunk = canvasChunk.getContext('2d');
        // Nền với gradient
        const bgGradient = ctxChunk.createLinearGradient(0, 0, 0, heightChunk);
        bgGradient.addColorStop(0, '#2c2f33');
        bgGradient.addColorStop(1, '#23272A');
        ctxChunk.fillStyle = bgGradient;
        ctxChunk.fillRect(0, 0, width, heightChunk);
        // Header
        if (isFirstImage) {
          ctxChunk.font = 'bold 32px Arial';
          ctxChunk.fillStyle = '#fff';
          ctxChunk.fillText('Hàng đợi', padding, padding + 30);
          let totalDuration = 0;
          allSongs.forEach(song => {
            if (song.duration) {
              totalDuration += (typeof song.duration === 'number' ? song.duration : song.duration.split(':').reduce((a, b) => a * 60 + +b));
            }
          });
          const hours = Math.floor(totalDuration / 3600);
          const minutes = Math.floor((totalDuration % 3600) / 60);
          const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          ctxChunk.font = '20px Arial';
          ctxChunk.fillStyle = '#aaa';
          ctxChunk.textAlign = 'right';
          ctxChunk.fillText(`${allSongs.length} bài • ${durationText}`, width - padding, padding + 30);
          ctxChunk.textAlign = 'left';
          ctxChunk.strokeStyle = '#ffffff33';
          ctxChunk.lineWidth = 2;
          ctxChunk.beginPath();
          ctxChunk.moveTo(padding, headerHeight);
          ctxChunk.lineTo(width - padding, headerHeight);
          ctxChunk.stroke();
        }
        for (let i = 0; i < songs.length; i++) {
          const song = songs[i];
          const y = realHeaderHeight + i * itemHeight + realPadding;
          ctxChunk.fillStyle = i % 2 === 0 ? '#ffffff08' : '#ffffff04';
          ctxChunk.fillRect(padding, y, width - padding * 2, itemHeight - 10);
          let img;
          let thumbUrl = song.thumbnail;
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
          const thumbSize = 60;
          const thumbX = padding + 10;
          const thumbY = y + 10;
          const cornerRadius = 10;
          ctxChunk.save();
          ctxChunk.beginPath();
          ctxChunk.moveTo(thumbX + cornerRadius, thumbY);
          ctxChunk.arcTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + thumbSize, cornerRadius);
          ctxChunk.arcTo(thumbX + thumbSize, thumbY + thumbSize, thumbX, thumbY + thumbSize, cornerRadius);
          ctxChunk.arcTo(thumbX, thumbY + thumbSize, thumbX, thumbY, cornerRadius);
          ctxChunk.arcTo(thumbX, thumbY, thumbX + thumbSize, thumbY, cornerRadius);
          ctxChunk.closePath();
          ctxChunk.clip();
          const thumbImgRatio = img.width / img.height;
          let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
          if (thumbImgRatio > 1) {
            thumbSWidth = img.height;
            thumbSx = (img.width - thumbSWidth) / 2;
          } else {
            thumbSHeight = img.width;
            thumbSy = (img.height - thumbSHeight) / 2;
          }
          ctxChunk.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
          ctxChunk.restore();
          const circleX = thumbX + thumbSize + 25;
          const circleY = y + itemHeight/2;
          const circleRadius = 15;
          ctxChunk.beginPath();
          ctxChunk.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
          const circleGradient = ctxChunk.createLinearGradient(circleX - circleRadius, circleY, circleX + circleRadius, circleY);
          circleGradient.addColorStop(0, '#00ff29');
          circleGradient.addColorStop(1, '#00cc29');
          ctxChunk.fillStyle = circleGradient;
          ctxChunk.fill();
          ctxChunk.font = 'bold 16px Arial';
          ctxChunk.fillStyle = '#111';
          ctxChunk.textAlign = 'center';
          ctxChunk.textBaseline = 'middle';
          ctxChunk.fillText(`${chunkIdx + i + 1}`, circleX, circleY);
          ctxChunk.textAlign = 'left';
          ctxChunk.textBaseline = 'alphabetic';
          const textX = circleX + circleRadius + 15;
          const maxTextWidth = width - textX - padding - 100;
          ctxChunk.font = 'bold 20px Arial';
          ctxChunk.fillStyle = (chunkIdx + i === 0) ? '#00ff29' : '#fff';
          const truncatedTitle = song.name.length > 40 ? song.name.substring(0, 37) + '...' : song.name;
          ctxChunk.fillText(truncatedTitle, textX, y + 35, maxTextWidth);
          ctxChunk.font = '16px Arial';
          ctxChunk.fillStyle = '#aaa';
          ctxChunk.fillText(song.uploader?.name || song.artist || '', textX, y + 60, maxTextWidth);
          ctxChunk.textAlign = 'right';
          ctxChunk.font = '18px Arial';
          ctxChunk.fillStyle = '#fff';
          ctxChunk.textBaseline = 'middle';
          const timeX = width - padding - 15;
          const timeY = y + itemHeight / 2;
          ctxChunk.fillText(song.formattedDuration || song.duration || '', timeX, timeY);
          ctxChunk.textAlign = 'left';
          ctxChunk.textBaseline = 'alphabetic';
        }
        imageBuffers.push(canvasChunk.toBuffer());
      }
      // Cập nhật cache
      cache[cacheKey] = {
        firstSongId,
        queueLength,
        buffers: imageBuffers
      };
    }
    // Lưu lại id tin nhắn queue cũ để xóa
    if (!interaction.client._queueMsgCache) interaction.client._queueMsgCache = {};
    const msgCache = interaction.client._queueMsgCache;
    const msgCacheKey = `${interaction.guildId}`;
    let oldMsg = msgCache[msgCacheKey];
    // Gửi toàn bộ ảnh vào một tin nhắn mới
    const attachments = imageBuffers.map((buf, i) => new AttachmentBuilder(buf, { name: `queue_${i+1}.png` }));
    const newMsg = await interaction.reply({ files: attachments });
    // Xóa tin nhắn cũ nếu có
    if (oldMsg && oldMsg.delete) {
      try { await oldMsg.delete(); } catch {}
    }
    // Lưu lại tin nhắn mới vào cache
    msgCache[msgCacheKey] = newMsg;
  }
}; 