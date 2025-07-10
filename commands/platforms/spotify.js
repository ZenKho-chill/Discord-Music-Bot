const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const StackBlur = require('stackblur-canvas');
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

async function handleSpotifyPlaylist(client, interaction, query, voiceChannel, lockKey, type) {
  const config = getConfig();
  const MAX_QUEUE_SIZE = config.maxQueue;
  
  // Validation: Kiểm tra xem feature có được bật không
  const featureType = type === 'Album' ? 'album' : 'playlist';
  if (!isPlatformFeatureEnabled('spotify', featureType)) {
    const errorMessage = createFeatureDisabledMessage('spotify', featureType);
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  // Set flag để tạm dừng removeFirst logic
  const { setProcessingPlaylist } = require('../../events/ready');
  setProcessingPlaylist(interaction.guildId, true);
  
  if (!client._addLock) client._addLock = {};
  client._addLock[lockKey] = true;

  const embed = new EmbedBuilder()
    .setTitle(`📃 Đang xử lý ${type} từ Spotify...`)
    .setDescription('Thao tác này có thể mất một lúc. Vui lòng chờ...')
    .setColor('#1DB954');
  await interaction.editReply({ embeds: [embed] });

  try {
    const currentQueue = client.distube.getQueue(voiceChannel);
    const currentQueueSize = currentQueue?.songs?.length || 0;

    if (currentQueueSize >= MAX_QUEUE_SIZE) {
      embed.setColor(0xff0000)
        .setTitle('❌ Hàng đợi đã đầy!')
        .setDescription(`Hàng đợi đã đạt giới hạn tối đa (${MAX_QUEUE_SIZE} bài).`);
      await interaction.editReply({ embeds: [embed] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
      return;
    }
    
    const { SpotifyPlugin } = require('@distube/spotify');
    const spotifyPlugin = client.distube.plugins.find(p => p instanceof SpotifyPlugin);
    if (!spotifyPlugin) {
        throw new Error("Spotify plugin is not enabled or found.");
    }
    
    const resolvedPlaylist = await spotifyPlugin.resolve(query, { member: interaction.member, textChannel: interaction.channel });
    const songsArr = Array.isArray(resolvedPlaylist.songs)
      ? resolvedPlaylist.songs
      : Array.from(resolvedPlaylist.songs || []);
    if (config.debug) {
      console.log('[Spotify DEBUG] resolvedPlaylist:', typeof resolvedPlaylist, resolvedPlaylist && resolvedPlaylist.constructor && resolvedPlaylist.constructor.name);
      console.log('[Spotify DEBUG] songsArr.length:', songsArr.length);
    }
    if (!resolvedPlaylist || songsArr.length === 0) {
      throw new Error(`Không tìm thấy bài hát nào trong ${type}.`);
    }

    const slotsAvailable = MAX_QUEUE_SIZE - currentQueueSize;
    const songsToAdd = songsArr.slice(0, slotsAvailable);
    
    if (songsToAdd.length === 0) {
      embed.setColor(0xff0000)
        .setTitle('❌ Hàng đợi đã đầy!')
        .setDescription(`Hàng đợi đã đạt giới hạn tối đa (${MAX_QUEUE_SIZE} bài).`);
      await interaction.editReply({ embeds: [embed] });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
      return;
    }
    
    const { SoundCloudPlugin } = require('@distube/soundcloud');
    const soundcloudPlugin = client.distube.plugins.find(p => p instanceof SoundCloudPlugin);
    let addedSongs = [];
    for (const song of songsToAdd) {
      const updatedQueueCheck = client.distube.getQueue(voiceChannel);
      const curQueueCheck = updatedQueueCheck?.songs?.length || 0;
      if (curQueueCheck >= MAX_QUEUE_SIZE) break;
      try {
        if (song.url && song.url.includes('spotify.com/track/')) {
          await client.distube.play(voiceChannel, song.url, {
            textChannel: interaction.channel,
            member: interaction.member,
            skip: false,
          });
          addedSongs.push(song);
        } else if (soundcloudPlugin) {
          const searchQuery = song.uploader?.name ? `${song.name} ${song.uploader.name}` : song.name;
          try {
            const scResults = await soundcloudPlugin.search(searchQuery, 'track', 1);
            if (scResults && scResults[0]) {
              await client.distube.play(voiceChannel, scResults[0].url, {
                textChannel: interaction.channel,
                member: interaction.member,
                skip: false,
              });
              addedSongs.push(song);
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Khi phát playlist mới, đồng bộ queueManager (với delay để đảm bảo DisTube đã cập nhật đầy đủ)
    await new Promise(resolve => setTimeout(resolve, 1000));
    const queue = client.distube.getQueue(voiceChannel);
    if (queue) {
      queueManager.setQueue(interaction.guildId, queue.songs);
      if (config.debug) console.log(`[Spotify Playlist] Đồng bộ queue: ${queue.songs.length} bài trong DisTube`);
    }
    
    // Gửi ảnh tổng kết playlist
    try {
      let authorName = '';
      if (resolvedPlaylist?.uploader?.name) {
        authorName = resolvedPlaylist.uploader.name;
      }
      await generatePlaylistResultImage(
        interaction.channel,
        addedSongs,
        resolvedPlaylist?.name || 'Spotify Playlist',
        resolvedPlaylist?.thumbnail || '',
        'spotify_playlist',
        authorName
      );
    } catch (error) {
      console.error('[Spotify Playlist] Lỗi khi tạo/gửi ảnh tổng kết:', error);
    }

  } catch (e) {
    console.error(`[Spotify] Lỗi chi tiết khi xử lý ${type}:`, {
      message: e.message,
      name: e.name,
      stack: e.stack,
      url: query,
    });
    
    if (config.debug) console.log('[Spotify] Inspecting DisTube plugins:');
    try {
        const { SpotifyPlugin } = require('@distube/spotify');
        client.distube.plugins?.forEach((p, i) => {
            if (config.debug) console.log(`- Plugin ${i}:`, p ? 'Exists' : 'Does not exist');
            if (p) {
                if (config.debug) console.log(`  - Constructor: ${p.constructor.name}`);
                if (config.debug) console.log(`  - Is SpotifyPlugin: ${p instanceof SpotifyPlugin}`);
            }
        });
    } catch (err) {
        console.error('[Spotify] Error inspecting plugins:', err);
    }

    if (config.debug) console.log(`[Spotify] Spotify config (from config.js):`, {
      clientId: config.spotify?.clientId ? 'OK' : 'MISSING',
      clientSecret: config.spotify?.clientSecret ? 'OK' : 'MISSING'
    });

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

async function handleSpotifySingle(client, interaction, query, voiceChannel) {
  const config = getConfig();
  
  // Validation: Kiểm tra xem single Spotify có được bật không
  if (!isPlatformFeatureEnabled('spotify', 'single')) {
    const errorMessage = createFeatureDisabledMessage('spotify', 'single');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  if (config.debug) console.log('[Spotify Single] Bắt đầu xử lý:', query);
  const initialQueueSize = client.distube.getQueue(voiceChannel)?.songs?.length || 0;
  await interaction.editReply({ content: '🎵 Đang tìm và xử lý bài hát từ Spotify...' });

  try {
    const MAX_QUEUE_SIZE = config.maxQueue;
    const currentQueue = client.distube.getQueue(voiceChannel);
    const currentQueueSize = currentQueue?.songs?.length || 0;
    if (currentQueueSize >= MAX_QUEUE_SIZE) {
      await interaction.editReply({ content: `❌ Hàng đợi đã đầy (${MAX_QUEUE_SIZE} bài)! Không thể thêm bài mới.`, ephemeral: true });
      return;
    }

    await client.distube.play(voiceChannel, query, {
      member: interaction.member,
      textChannel: interaction.channel,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const queue = client.distube.getQueue(voiceChannel);
    const newQueueSize = queue?.songs?.length || 0;

    if (config.debug) console.log(`[Spotify Single] Queue size - Ban đầu: ${initialQueueSize}, Hiện tại: ${newQueueSize}`);

    if (newQueueSize > initialQueueSize) {
      const song = queue.songs[newQueueSize - 1];
      if (config.debug) console.log(`[Spotify Single] Đã thêm thành công: ${song.name}`);

      try {
        const width = 750, height = 200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        let img;
        let thumbUrl = song.thumbnail;
        
        if (song.url && song.url.includes('spotify.com/track/')) {
          try {
            const https = require('https');
            const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(song.url)}`;
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
            }
          } catch (e) {
             console.error('[Spotify oEmbed] Lỗi khi lấy thumbnail:', e);
          }
        }
        
        try {
            if (!thumbUrl || !/^https?:\/\//.test(thumbUrl)) throw new Error('Invalid thumbnail URL');
            img = await loadImage(thumbUrl);
        } catch (e) {
            console.error(`[Image] Không thể tải thumbnail từ ${thumbUrl}:`, e.message);
            img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
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
        ctx.fillText('Tác giả: ' + (song.uploader?.name || 'N/A'), textX, 120, width - textX - 100);
        
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
        // Lấy STT từ queueManager thay vì dùng newQueueSize
        const sttFromQueueManager = getSttFromQueueManager(interaction.guildId, song, true);
        ctx.fillText(`${sttFromQueueManager}`, circleX, circleY);
        ctx.restore();
        ctx.textAlign = 'left';
        
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('Thời lượng: ' + song.formattedDuration, textX, 170);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'song_added.png' });
        
        await interaction.channel.send({ files: [attachment] });

      } catch (err) {
        console.error('[Spotify Single] Lỗi khi vẽ hoặc gửi ảnh:', err);
        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle(`✅ Đã thêm: ${song.name}`)
            .setDescription(`**Nghệ sĩ:** ${song.uploader.name}\n**Thời lượng:** ${song.formattedDuration}`)
            .setFooter({ text: 'Có lỗi khi tạo ảnh xem trước.' });
        await interaction.editReply({ embeds: [embed] });
        setTimeout(() => interaction.deleteReply().catch(console.error), 10000);
      }
    } else {
      if (config.debug) console.log('[Spotify Single] Không có bài hát nào được thêm. Lỗi có thể đã được DisTube emit.');
      await interaction.editReply({ 
        content: '❌ Không thể phát bài hát này. Có thể bài hát không có sẵn, bị giới hạn vùng hoặc link không hợp lệ.',
      });
      setTimeout(() => interaction.deleteReply().catch(console.error), 7000);
    }
  } catch (e) {
    console.error(`[Spotify Single] Lỗi trong khối try-catch:`, e);
    await interaction.editReply({
      content: `❌ Lỗi không xác định khi phát bài hát: ${e.message}`,
    });
    setTimeout(() => interaction.deleteReply().catch(console.error), 7000);
  }
  
  // Đồng bộ queueManager sau khi thêm bài mới
  const finalQueue = client.distube.getQueue(voiceChannel);
  if (finalQueue) {
    queueManager.syncFromDisTube(interaction.guildId, finalQueue);
  }
}

module.exports = {
  generatePlaylistResultImage,
  handleSpotifyPlaylist,
  handleSpotifySingle
}; 