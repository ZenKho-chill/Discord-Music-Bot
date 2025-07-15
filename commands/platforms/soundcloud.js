const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const StackBlur = require('stackblur-canvas');
const https = require('https');
const queueManager = require('../../utils/queueManager');
const { resolveSoundCloudShortlink } = require('../../utils/soundcloudUtils');
const { isPlatformFeatureEnabled, getPlatformDisplayName, getTypeDisplayName, createFeatureDisabledMessage } = require('./platformDetector');

// Hàm lấy STT từ queueManager
function getSttFromQueueManager(guildId, targetSong, isNewlyAdded = false) {
  const queueManagerSongs = queueManager.getQueue(guildId);
  
  if (!queueManagerSongs || queueManagerSongs.length === 0) {
    return 1; // Mặc định là 1 nếu không có hàng đợi
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

async function getSoundCloudPlaylistInfo(url) {
  return new Promise((resolve, reject) => {
    https.get(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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

async function handleSoundCloudPlaylist(client, interaction, query, voiceChannel, lockKey) {
  const config = getConfig();
  const MAX_QUEUE_SIZE = config.maxQueue;
  
  // Validation: Kiểm tra xem playlist SoundCloud có được bật không
  if (!isPlatformFeatureEnabled('soundcloud', 'playlist')) {
    const errorMessage = createFeatureDisabledMessage('soundcloud', 'playlist');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  if (!client._addLock) client._addLock = {};
  client._addLock[lockKey] = true;

  // Set flag để tạm dừng removeFirst logic
  const { setProcessingPlaylist } = require('../../events/ready');
  setProcessingPlaylist(interaction.guildId, true);

  const embed = new EmbedBuilder()
    .setTitle(`📃 Đang xử lý playlist SoundCloud...`)
    .setDescription('Vui lòng chờ trong khi tôi lấy thông tin.')
    .setColor('#FF5500');
  await interaction.editReply({ embeds: [embed] });

  try {
    const currentQueue = client.distube.getQueue(voiceChannel);
    const currentQueueSize = currentQueue?.songs?.length || 0;

    if (currentQueueSize >= MAX_QUEUE_SIZE) {
      embed.setColor(0xff0000).setTitle('❌ Hàng đợi đã đầy!').setDescription(`Hàng đợi đã đạt giới hạn tối đa (${MAX_QUEUE_SIZE} bài).`);
      await interaction.editReply({ embeds: [embed] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
      return;
    }

    const { SoundCloudPlugin } = require('@distube/soundcloud');
    const soundcloudPlugin = client.distube.plugins.find(p => p instanceof SoundCloudPlugin);
    if (!soundcloudPlugin) {
        throw new Error("SoundCloud plugin is not enabled or found.");
    }
    
    const resolvedPlaylist = await soundcloudPlugin.resolve(query, { member: interaction.member, textChannel: interaction.channel });
    const songsArr = Array.isArray(resolvedPlaylist.songs)
      ? resolvedPlaylist.songs
      : Array.from(resolvedPlaylist.songs || []);
      
    if (config.debug) {
      console.log('[SoundCloud DEBUG] resolvedPlaylist:', typeof resolvedPlaylist, resolvedPlaylist && resolvedPlaylist.constructor && resolvedPlaylist.constructor.name);
      console.log('[SoundCloud DEBUG] songsArr.length:', songsArr.length);
    }
    if (!resolvedPlaylist || songsArr.length === 0) {
        throw new Error('Không tìm thấy bài hát nào trong playlist SoundCloud.');
    }
    
    const slotsAvailable = MAX_QUEUE_SIZE - currentQueueSize;
    const songsToAdd = songsArr.slice(0, slotsAvailable);
    
    if (songsToAdd.length === 0) {
       embed.setColor(0xff0000).setTitle('❌ Hàng đợi đã đầy!').setDescription(`Không thể thêm bài hát nào nữa.`);
       await interaction.editReply({ embeds: [embed] });
       setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
       return;
    }

    // Thay vì phát cả playlist, lặp từng bài và play từng bài một
    let addedCount = 0;
    let failedCount = 0;
    let addedSongs = [];
    
    if (config.debug) console.log(`[SoundCloud Playlist] Bắt đầu thêm ${songsToAdd.length} bài`);
    const startQueueSize = client.distube.getQueue(voiceChannel)?.songs?.length || 0;
    if (config.debug) console.log(`[SoundCloud Playlist] Queue ban đầu: ${startQueueSize} bài`);
    
    for (let i = 0; i < songsToAdd.length; i++) {
      const song = songsToAdd[i];
      // Kiểm tra queue trước mỗi lần thêm
      const updatedQueueCheck = client.distube.getQueue(voiceChannel);
      const curQueueCheck = updatedQueueCheck?.songs?.length || 0;
      
      if (config.debug) console.log(`[SoundCloud Playlist] Bài ${i+1}/${songsToAdd.length}: "${song.name}" - Queue hiện tại: ${curQueueCheck}`);
      
      if (curQueueCheck >= MAX_QUEUE_SIZE) {
        if (config.debug) console.log(`[SoundCloud Playlist] Dừng do đạt giới hạn queue: ${curQueueCheck}/${MAX_QUEUE_SIZE}`);
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
        if (config.debug) console.log(`[SoundCloud Playlist] ✅ Thêm thành công bài ${addedCount}: ${song.name}`);
        
        // Delay nhỏ giữa các lần thêm để tránh spam
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (e) {
        failedCount++;
        if (config.debug) console.log(`[SoundCloud Playlist] ❌ Lỗi thêm bài "${song.name}": ${e.message}`);
        continue;
      }
    }
    
    if (config.debug) console.log(`[SoundCloud Playlist] Kết thúc: ${addedCount} thành công, ${failedCount} thất bại`);
    const finalQueueBeforeSync = client.distube.getQueue(voiceChannel)?.songs?.length || 0;
    if (config.debug) console.log(`[SoundCloud Playlist] Queue trước sync: ${finalQueueBeforeSync} bài`);
    let durationText = '';
    let totalDuration = addedSongs.reduce((acc, song) => acc + song.duration, 0);
    if (totalDuration > 0) {
        const hours = Math.floor(totalDuration / 3600);
        const minutes = Math.floor((totalDuration % 3600) / 60);
        durationText = hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
    }

    // Gửi ảnh tổng kết playlist giống như YouTube/Spotify
    try {
      let authorName = '';
      if (resolvedPlaylist.uploader && resolvedPlaylist.uploader.name) {
        authorName = resolvedPlaylist.uploader.name;
      } else if (addedSongs[0]?.uploader?.name) {
        authorName = addedSongs[0].uploader.name;
      }
      await generatePlaylistResultImage(
        interaction.channel,
        addedSongs,
        resolvedPlaylist.name,
        resolvedPlaylist.thumbnail,
        'soundcloud_playlist',
        authorName
      );
    } catch (error) {
      console.error('[SoundCloud Playlist] Lỗi khi tạo/gửi ảnh tổng kết:', error);
    }

    // Khi phát playlist mới, đồng bộ queueManager (với delay để đảm bảo DisTube đã cập nhật đầy đủ)
    if (config.debug) console.log(`[SoundCloud Playlist] Chờ 1.5s để DisTube hoàn tất cập nhật...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const queue = client.distube.getQueue(voiceChannel);
    if (queue) {
      if (config.debug) {
        console.log(`[SoundCloud Playlist] Đồng bộ queue: ${queue.songs.length} bài trong DisTube, ${addedSongs.length} bài đã thêm thành công, ${failedCount} bài thất bại`);
        console.log(`[SoundCloud Playlist] Danh sách bài thất bại: ${failedCount > 0 ? 'có' : 'không có'}`);
      }
      // Khởi tạo lại queue với tất cả bài từ DisTube
      queueManager.setQueue(interaction.guildId, queue.songs);
      
      // Verification - kiểm tra queue sau khi đồng bộ
      const queueManagerQueue = queueManager.getQueue(interaction.guildId);
      if (config.debug) console.log(`[SoundCloud Playlist] Verification: QueueManager có ${queueManagerQueue.length} bài`);
      
      if (queue.songs.length !== queueManagerQueue.length) {
        console.warn(`[SoundCloud Playlist] ⚠️ Mismatch: DisTube=${queue.songs.length}, QueueManager=${queueManagerQueue.length}`);
      }
    } else {
      console.error(`[SoundCloud Playlist] ❌ Không thể lấy queue từ DisTube!`);
    }

  } catch (e) {
    embed.setColor(0xff0000).setTitle('❌ Có lỗi xảy ra').setDescription(e.message || 'Vui lòng thử lại sau.');
    await interaction.editReply({ embeds: [embed] });
    setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
  } finally {
    // Reset flag để cho phép removeFirst hoạt động bình thường
    const { setProcessingPlaylist } = require('../../events/ready');
    setProcessingPlaylist(interaction.guildId, false);
    
    if (client._addLock && client._addLock[lockKey]) {
      delete client._addLock[lockKey];
      if (client._addInfo && client._addInfo[lockKey]) {
        delete client._addInfo[lockKey];
      }
    }
  }
}

async function handleSoundCloudSingle(client, interaction, query, voiceChannel) {
  // Validation: Kiểm tra xem single SoundCloud có được bật không
  if (!isPlatformFeatureEnabled('soundcloud', 'single')) {
    const errorMessage = createFeatureDisabledMessage('soundcloud', 'single');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  // Xử lý bài hát đơn lẻ SoundCloud
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
    await interaction.followUp({ content: msg, ephemeral: true });
    return;
  }
  
  const replyMsg = await interaction.followUp('🎵 Đã nhận yêu cầu phát nhạc!');
  await new Promise(r => setTimeout(r, 1000));
  
  const updatedQueue = client.distube.getQueue(voiceChannel);
  if (!updatedQueue || !updatedQueue.songs || updatedQueue.songs.length === 0) {
    await interaction.followUp({ content: '❌ Không thể lấy thông tin bài hát vừa thêm!', ephemeral: true });
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
    await interaction.followUp({ content: '❌ Không thể lấy thông tin bài hát hoặc channel!', ephemeral: true });
    return;
  }
  
  // Tạo ảnh bài hát đang phát
  try {
    const width = 750, height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    let img;
    let thumbUrl = song.thumbnail;
    
    // Nếu là link SoundCloud, lấy thumbnail từ oembed
    if (song.url && song.url.includes('soundcloud.com/')) {
      try {
        const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(song.url)}`;
        const getJson = url => new Promise((resolve, reject) => {
          https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
          }).on('error', reject);
        });
        const oembed = await getJson(oembedUrl);
        if (oembed && oembed.thumbnail_url) {
          thumbUrl = oembed.thumbnail_url;
          img = await loadImage(thumbUrl);
        }
      } catch (e) {
        img = undefined;
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
    console.error('[SoundCloud Single] Lỗi khi vẽ hoặc gửi ảnh:', err);
    await interaction.followUp({ content: '❌ Có lỗi khi tạo ảnh bài hát!', ephemeral: true });
  }
  
  // Đồng bộ queueManager sau khi thêm bài mới
  const finalQueue = client.distube.getQueue(voiceChannel);
  if (finalQueue) {
    queueManager.syncFromDisTube(interaction.guildId, finalQueue);
  }
}

module.exports = {
  getSoundCloudPlaylistInfo,
  generatePlaylistResultImage,
  handleSoundCloudPlaylist,
  handleSoundCloudSingle
}; 