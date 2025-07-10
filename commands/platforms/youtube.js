const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const StackBlur = require('stackblur-canvas');
const ytpl = require('@distube/ytpl');
const puppeteer = require('puppeteer');
const { Playlist } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const queueManager = require('../../utils/queueManager');
const { isPlatformFeatureEnabled, getPlatformDisplayName, getTypeDisplayName, createFeatureDisabledMessage } = require('./platformDetector');

// Hàm lấy STT từ queueManager
function getSttFromQueueManager(guildId, targetSong, isNewlyAdded = false) {
  const queueManagerSongs = queueManager.getQueue(guildId);
  
  if (!queueManagerSongs || queueManagerSongs.length === 0) {
    return 1; // Mặc định là 1 nếu không có queue
  }
  
  // Nếu là bài vừa thêm vào
  if (isNewlyAdded) {
    // Ưu tiên tìm theo ID hoặc URL chính xác trước
    if (targetSong.id || targetSong.url) {
      const exactMatches = queueManagerSongs.filter(song => {
        if (targetSong.id && song.id === targetSong.id) return true;
        if (targetSong.url && song.url === targetSong.url) return true;
        return false;
      });
      
      // Nếu tìm thấy bài trùng ID/URL, trả về STT của bài cuối cùng
      if (exactMatches.length > 0) {
        return exactMatches[exactMatches.length - 1].stt;
      }
    }
    
    // Fallback: tìm theo tên + tác giả (cho trường hợp không có ID/URL)
    const targetName = targetSong.name || '';
    const targetAuthor = targetSong.uploader?.name || targetSong.artist || '';
    
    const nameMatches = queueManagerSongs.filter(song => {
      const songName = song.name || '';
      const songAuthor = song.uploader?.name || song.artist || '';
      return songName === targetName && songAuthor === targetAuthor;
    });
    
    if (nameMatches.length > 0) {
      return nameMatches[nameMatches.length - 1].stt;
    }
    
    // Nếu không tìm thấy gì, tạo STT mới
    const maxStt = Math.max(...queueManagerSongs.map(s => s.stt || 0));
    return maxStt + 1;
  }
  
  // Logic cũ cho skip (tìm bài đầu tiên khớp)
  const songMatch = queueManagerSongs.find(song => {
    // Ưu tiên tìm theo ID hoặc URL
    if (song.id && targetSong.id && song.id === targetSong.id) return true;
    if (song.url && targetSong.url && song.url === targetSong.url) return true;
    
    // Tìm theo tên bài hát và tác giả
    const songName = song.name || '';
    const targetName = targetSong.name || '';
    const songAuthor = song.uploader?.name || song.artist || '';
    const targetAuthor = targetSong.uploader?.name || targetSong.artist || '';
    
    return songName === targetName && songAuthor === targetAuthor;
  });
  
  if (songMatch && songMatch.stt) {
    return songMatch.stt;
  }
  
  // Nếu không tìm thấy, lấy STT tiếp theo từ counter
  const maxStt = Math.max(...queueManagerSongs.map(s => s.stt || 0));
  return maxStt + 1;
}

// Get current config safely (lazy load to avoid circular dependency)
function getConfig() {
  try {
    return require('../../utils/hotReload').getCurrentConfig();
  } catch (error) {
    return require('../../config/config');
  }
}

async function generatePlaylistResultImage(channel, songs, title, thumbnailUrl, type, author = '') {
  try {
    let totalSec = 0;
    for (const s of songs) {
      if (s.duration) {
        if (typeof s.duration === 'number') totalSec += s.duration;
        else if (typeof s.duration === 'string') totalSec += s.duration.split(':').reduce((a, b) => a * 60 + +b, 0);
      }
    }
    totalSec = Math.round(totalSec);
    let hours = Math.floor(totalSec / 3600);
    let minutes = Math.floor((totalSec % 3600) / 60);
    let seconds = totalSec % 60;
    let durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
    
    const width = 750, height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    let img;
    try { 
      if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) throw new Error('Invalid thumb');
      img = await loadImage(thumbnailUrl); 
    } catch (e) { 
      img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png'); 
    }

    const bgRatio = width / height;
    const imgRatio = img.width / img.height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
    if (imgRatio > bgRatio) { sWidth = img.height * bgRatio; sx = (img.width - sWidth) / 2; }
    else { sHeight = img.width / bgRatio; sy = (img.height - sHeight) / 2; }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
    StackBlur.canvasRGBA(ctx.canvas, 0, 0, width, height, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);
    const thumbSize = 160, thumbX = 20, thumbY = 20, cornerRadius = 28;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(thumbX + cornerRadius, thumbY);
    ctx.arcTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + thumbSize, cornerRadius);
    ctx.arcTo(thumbX + thumbSize, thumbY + thumbSize, thumbX, thumbY + thumbSize, cornerRadius);
    ctx.arcTo(thumbX, thumbY + thumbSize, thumbX, thumbY, cornerRadius);
    ctx.arcTo(thumbX, thumbY, thumbX + thumbSize, thumbY, cornerRadius);
    ctx.closePath();
    ctx.clip();
    const thumbImgRatio = img.width / img.height;
    let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
    if (thumbImgRatio > 1) { thumbSWidth = img.height; thumbSx = (img.width - thumbSWidth) / 2; }
    else { thumbSHeight = img.width; thumbSy = (img.height - thumbSHeight) / 2; }
    ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
    ctx.restore();
    
    const textX = thumbX + thumbSize + 30;
    ctx.font = 'bold 32px Arial'; ctx.fillStyle = '#fff'; 
    let truncatedTitle = title.length > 30 ? title.substring(0, 27) + '...' : title;
    ctx.fillText(truncatedTitle, textX, 65, width - textX - 100);
    
    ctx.font = '24px Arial'; ctx.fillStyle = '#ccc'; 
    if (author) {
      ctx.fillText('Tác giả: ' + author, textX, 100, width - textX - 100);
      ctx.font = '20px Arial'; ctx.fillStyle = '#ccc'; 
      ctx.fillText('Số lượng: ' + songs.length, textX, 130, width - textX - 100);
      ctx.font = '18px Arial'; ctx.fillStyle = '#fff'; 
      ctx.fillText('Thời lượng: ' + durationText, textX, 170);
    } else {
      ctx.fillText('Số lượng: ' + songs.length, textX, 120, width - textX - 100);
      ctx.font = '18px Arial'; ctx.fillStyle = '#fff'; 
      ctx.fillText('Thời lượng: ' + durationText, textX, 170);
    }
    
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${type}_result.png` });
    await channel.send({ files: [attachment] });
  } catch (error) {
    console.error(`[generatePlaylistResultImage] Lỗi khi tạo ảnh kết quả cho ${type}:`, error);
  }
}

async function handleYouTubePlaylist(client, interaction, query, voiceChannel, lockKey) {
  const config = getConfig();
  const MAX_QUEUE_SIZE = config.maxQueue;
  
  // Validation: Kiểm tra xem playlist YouTube có được bật không
  if (!isPlatformFeatureEnabled('youtube', 'playlist')) {
    const errorMessage = createFeatureDisabledMessage('youtube', 'playlist');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  // Set flag để tạm dừng removeFirst logic
  const { setProcessingPlaylist } = require('../../events/ready');
  setProcessingPlaylist(interaction.guildId, true);
  
  client._addLock[lockKey] = true;
  const { Playlist } = require('distube');

  const currentQueue = client.distube.getQueue(voiceChannel);
  const currentQueueSize = currentQueue?.songs?.length || 0;

  // Embed ban đầu chỉ báo đang xử lý và queue hiện tại
  let embed = new EmbedBuilder()
    .setTitle('🔄 Đang xử lý playlist YouTube...')
    .setDescription(
      `Vui lòng chờ trong khi tôi lấy thông tin và thêm bài hát.\n\n` +
      `Queue hiện tại: **${currentQueueSize}** bài`)
    .setColor(0xFF0000);
    
  // Gửi reply ephemeral đầu tiên
  if (!interaction.replied && !interaction.deferred) {
    await interaction.deferReply({ ephemeral: true });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }

  // Lưu thông tin để xử lý button
  if (!client._addInfo) client._addInfo = {};
  client._addInfo[lockKey] = {
    guildId: interaction.guildId,
    channelId: interaction.channel.id,
    messageId: interaction.id,
    type: 'playlist',
    shouldStop: false
  };

  try {
    let resolvedPlaylist;
    try {
      resolvedPlaylist = await client.distube.handler.resolve(query, { member: interaction.member });
    } catch (e) {
      throw new Error('Không thể resolve playlist: ' + e.message);
    }

    if (!(resolvedPlaylist instanceof Playlist) || !resolvedPlaylist.songs.length) {
        throw new Error('Không thể tìm thấy playlist hoặc playlist không có bài hát.');
    }

    const slotsAvailable = MAX_QUEUE_SIZE - currentQueueSize;
    const songsToAdd = resolvedPlaylist.songs.slice(0, slotsAvailable);

    const barLength = 30;
    let addedCount = 0;
    let failedCount = 0;
    let addedSongs = [];

    function getProgressBar(current, total) {
      const percent = Math.floor((current / total) * 100);
      const barCount = Math.floor(percent / (100 / barLength));
      return '█'.repeat(barCount) + '░'.repeat(barLength - barCount);
    }

    // Cập nhật lại embed sau khi đã resolve playlist
    embed = new EmbedBuilder()
      .setTitle('🔄 Đang xử lý playlist YouTube...')
      .setDescription(
        `Vui lòng chờ trong khi tôi lấy thông tin và thêm bài hát.\n\n` +
        `Queue hiện tại: **${currentQueueSize}** bài\n` +
        `Dự kiến thêm: **${songsToAdd.length}** bài từ playlist`)
      .addFields(
        { name: 'Tiến trình', value: `[${getProgressBar(0, songsToAdd.length)}] 0%`, inline: false },
        { name: 'Đã thêm', value: `0`, inline: true },
        { name: 'Queue', value: `${currentQueueSize}/${MAX_QUEUE_SIZE}`, inline: true }
      )
      .setColor(0xFF0000);

    // Thêm nút dừng
    const stopButton = new ButtonBuilder()
      .setCustomId('stop_add')
      .setLabel('⏸️ Dừng')
      .setStyle(ButtonStyle.Secondary);
    const row = new ActionRowBuilder().addComponents(stopButton);

    await interaction.editReply({ embeds: [embed], components: [row] });

    for (const song of songsToAdd) {
      // Kiểm tra flag dừng
      if (client._addInfo[lockKey]?.shouldStop) {
        break;
      }
      // Kiểm tra queue trước mỗi lần thêm
      const updatedQueueCheck = client.distube.getQueue(voiceChannel);
      const curQueueCheck = updatedQueueCheck?.songs?.length || 0;
      if (curQueueCheck >= MAX_QUEUE_SIZE) {
        break;
      }
      try {
        await client.distube.play(voiceChannel, song.url, {
          textChannel: interaction.channel,
          member: interaction.member,
          skip: false,
        });
        addedCount++;
        addedSongs.push(song);
      } catch (e) {
        failedCount++;
        continue;
      }
      // Cập nhật progress bar sau mỗi lần thêm bài
      const updatedQueue = client.distube.getQueue(voiceChannel);
      const curQueue = updatedQueue?.songs?.length || 0;
      embed.data.fields[0].value = `[${getProgressBar(addedCount, songsToAdd.length)}] ${Math.floor((addedCount / songsToAdd.length) * 100)}%`;
      embed.data.fields[1].value = `${addedCount}`;
      embed.data.fields[2].value = `${curQueue}/${MAX_QUEUE_SIZE}`;
      await interaction.editReply({ embeds: [embed], components: [row] });
    }

    const thumbnailUrl = resolvedPlaylist.thumbnail || 'https://cdn.discordapp.com/embed/avatars/0.png';

    // Sau khi thêm xong, chỉ gửi ảnh tổng kết playlist, không gửi embed danh sách bài đã thêm
    try {
      // Lấy tên tác giả đúng: uploader của playlist hoặc bài đầu tiên
      let authorName = '';
      if (resolvedPlaylist.uploader && resolvedPlaylist.uploader.name) {
        authorName = resolvedPlaylist.uploader.name;
      } else if (addedSongs[0]?.uploader?.name) {
        authorName = addedSongs[0].uploader.name;
      } else if (resolvedPlaylist.user?.username) {
        authorName = resolvedPlaylist.user.username;
      }
      await generatePlaylistResultImage(
        interaction.channel,
        addedSongs,
        resolvedPlaylist.name,
        thumbnailUrl,
        'youtube_playlist',
        authorName
      );
    } catch (error) {
      console.error('[YouTube Playlist] Lỗi khi tạo/gửi ảnh tổng kết:', error);
    }

    // Khi phát playlist mới, đồng bộ queueManager (với delay để đảm bảo DisTube đã cập nhật đầy đủ)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const queue = client.distube.getQueue(voiceChannel);
    if (queue) {
      queueManager.setQueue(interaction.guildId, queue.songs);
      if (config.debug) console.log(`[YouTube Playlist] Đồng bộ queue: ${queue.songs.length} bài trong DisTube, ${addedSongs.length} bài đã thêm`);
    }

  } catch (e) {
    console.error('[YouTube Playlist] Lỗi:', e);
    embed.setColor(0xff0000).setTitle('❌ Có lỗi xảy ra').setDescription(e.message);
    await interaction.editReply({ embeds: [embed], components: [] });
  } finally {
    // Reset flag để cho phép removeFirst hoạt động bình thường
    const { setProcessingPlaylist } = require('../../events/ready');
    setProcessingPlaylist(interaction.guildId, false);
    
    client._addLock[lockKey] = false;
    if (client._addInfo) delete client._addInfo[lockKey];
  }
}

async function handleYouTubeSingle(client, interaction, query, voiceChannel) {
  const config = getConfig();
  const MAX_QUEUE_SIZE = config.maxQueue;
  
  // Validation: Kiểm tra xem single YouTube có được bật không
  if (!isPlatformFeatureEnabled('youtube', 'single')) {
    const errorMessage = createFeatureDisabledMessage('youtube', 'single');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  // Kiểm tra queue trước khi thêm bài mới
  const queue = client.distube.getQueue(voiceChannel);
  if (queue && Array.isArray(queue.songs) && queue.songs.length >= MAX_QUEUE_SIZE) {
    return interaction.followUp({ content: `❌ Hàng đợi đã đầy (${MAX_QUEUE_SIZE} bài)!`, ephemeral: true });
  }

  // Xử lý bài hát đơn lẻ YouTube
  const startTime = Date.now();
  let playResult, playError;
  try {
    playResult = await client.distube.play(voiceChannel, query, {
      textChannel: interaction.channel,
      member: interaction.member
    });
  } catch (e) {
    playError = e;
  }
  
  if (playError) {
    let msg = `❌ Có lỗi xảy ra khi thêm bài hát: ${playError.message}`;
    await interaction.followUp({ content: msg });
    return;
  }
  
  const replyMsg = await interaction.followUp('🎵 Đã nhận yêu cầu phát nhạc!');
  await new Promise(r => setTimeout(r, 1000));
  
  const updatedQueue = client.distube.getQueue(voiceChannel);
  if (!updatedQueue || !updatedQueue.songs || updatedQueue.songs.length === 0) {
    await interaction.followUp({ content: '❌ Không thể lấy thông tin bài hát vừa thêm!' });
    return;
  }
  
  let song, currentIndex;
  if (updatedQueue.songs.length === 1) {
    song = updatedQueue.songs[0];
    currentIndex = getSttFromQueueManager(interaction.guildId, song, true);
  } else {
    song = updatedQueue.songs[updatedQueue.songs.length - 1];
    currentIndex = getSttFromQueueManager(interaction.guildId, song, true);
  }
  
  if (!song || !interaction || !interaction.channel) {
    await interaction.followUp({ content: '❌ Không thể lấy thông tin bài hát hoặc channel!' });
    return;
  }
  
  // Tạo ảnh bài hát đang phát
  try {
    const width = 750, height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
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
    
    const bgRatio = width / height;
    const imgRatio = img.width / img.height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
    if (imgRatio > bgRatio) {
      sWidth = img.height * bgRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / bgRatio;
      sy = (img.height - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
    StackBlur.canvasRGBA(ctx.canvas, 0, 0, width, height, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);
    
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
    const thumbImgRatio = img.width / img.height;
    let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
    if (thumbImgRatio > 1) { thumbSWidth = img.height; thumbSx = (img.width - thumbSWidth) / 2; }
    else { thumbSHeight = img.width; thumbSy = (img.height - thumbSHeight) / 2; }
    ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
    ctx.restore();
    
    const textX = thumbX + thumbSize + 30;
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#fff';
    const truncatedTitle = song.name.length > 40 ? song.name.substring(0, 37) + '...' : song.name;
    ctx.fillText(truncatedTitle, textX, 65, width - textX - 100);
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Tác giả: ' + (song.uploader?.name || song.artist || ''), textX, 120, width - textX - 100);
    
    const circleRadius = 26;
    const circleX = width - 60;
    const circleY = height / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 224, 189, 0.85)';
    ctx.fill();
    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (typeof currentIndex === 'number' && !isNaN(currentIndex)) {
      ctx.fillText(`${currentIndex}`, circleX, circleY);
    }
    ctx.restore();
    ctx.textAlign = 'left';
    
    ctx.font = '18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Thời lượng: ' + (song.formattedDuration || song.duration || ''), textX, 170);
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'nowplaying.png' });
    await interaction.channel.send({ files: [attachment] });
    
    if (replyMsg && replyMsg.deletable) {
      await replyMsg.delete().catch(() => {});
    }
  } catch (err) {
    console.error('[YouTube Single] Lỗi khi vẽ hoặc gửi ảnh:', err);
    await interaction.followUp({ content: '❌ Có lỗi khi tạo ảnh bài hát!' });
  }
  
  // Đồng bộ queueManager sau khi thêm bài mới
  const finalQueue = client.distube.getQueue(voiceChannel);
  if (finalQueue) {
    queueManager.syncFromDisTube(interaction.guildId, finalQueue);
  }
}

module.exports = {
  generatePlaylistResultImage,
  handleYouTubePlaylist,
  handleYouTubeSingle
}; 