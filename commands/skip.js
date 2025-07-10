const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const StackBlur = require('stackblur-canvas');
const queueManager = require('../utils/queueManager');
const config = require('../config/config');

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

// Hàm lấy STT từ queueManager dựa trên vị trí trong DisTube queue
function getSttFromQueueManagerByPosition(guildId, targetSong, distubePosition) {
  const queueManagerSongs = queueManager.getQueue(guildId);
  
  if (!queueManagerSongs || queueManagerSongs.length === 0) {
    return distubePosition + 1; // Fallback: vị trí + 1
  }
  
  // Tìm bài hát trong queueManager khớp với bài ở vị trí distubePosition
  const matchingSong = queueManagerSongs.find(song => {
    // Ưu tiên tìm theo ID hoặc URL
    if (song.id && targetSong.id && song.id === targetSong.id) return true;
    if (song.url && targetSong.url && song.url === targetSong.url) return true;
    
    // Fallback: tìm theo tên + tác giả
    const songName = song.name || '';
    const targetName = targetSong.name || '';
    const songAuthor = song.uploader?.name || song.artist || '';
    const targetAuthor = targetSong.uploader?.name || targetSong.artist || '';
    
    return songName === targetName && songAuthor === targetAuthor;
  });
  
  if (matchingSong && matchingSong.stt) {
    return matchingSong.stt;
  }
  
  // Nếu không tìm thấy, trả về vị trí + 1
  return distubePosition + 1;
}



// Hàm tạo ảnh bài hát sau khi skip
async function generateSkipResultImage(song, currentIndex, channel) {
  try {
    const width = 750, height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    let img;
    let thumbUrl = song.thumbnail;
    
    // Xử lý thumbnail cho YouTube
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
    
    // Vẽ background với blur
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
    
    // Vẽ thumbnail bo tròn
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
    
    // Vẽ text thông tin bài hát
    const textX = thumbX + thumbSize + 30;
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#fff';
    const truncatedTitle = song.name.length > 40 ? song.name.substring(0, 37) + '...' : song.name;
    ctx.fillText(truncatedTitle, textX, 65, width - textX - 100);
    ctx.font = '24px Arial';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Tác giả: ' + (song.uploader?.name || song.artist || 'Không rõ'), textX, 120, width - textX - 100);
    
    // Vẽ số thứ tự trong vòng tròn
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
    
    // Thêm icon skip và thời lượng
    ctx.font = '18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('⏭️ Đã skip đến bài này', textX, 150);
    ctx.fillText('Thời lượng: ' + (song.formattedDuration || song.duration || ''), textX, 170);
    
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'skip_result.png' });
    await channel.send({ files: [attachment] });
    
  } catch (error) {
    console.error('[generateSkipResultImage] Lỗi khi tạo ảnh skip:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boqua')
    .setDescription('Skip đến bài hát được chọn trong queue')
    .addStringOption(opt =>
      opt.setName('song')
        .setDescription('Chọn bài hát để skip đến')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const guildId = interaction.guildId;
      const queue = interaction.client.distube.getQueue(guildId);
      
      if (!queue || !queue.songs || queue.songs.length <= 1) {
        return await interaction.respond([
          { name: '❌ Không có bài hát nào trong queue để skip!', value: 'empty' }
        ]);
      }

      // Đồng bộ queueManager trước khi lấy queue (như logic hangdoi)
      queueManager.syncFromDisTube(guildId, queue);
      const allSongs = queueManager.getQueue(guildId);
      
      const focused = interaction.options.getFocused();
      const suggestions = [];

      // Lấy toàn bộ queue như hangdoi, nhưng xóa bài đầu tiên khi hiển thị autocomplete
      const skippableSongs = allSongs.slice(1); // Bỏ bài đang phát (index 0)
      
      // Hiển thị các bài có thể skip
      for (let i = 0; i < Math.min(skippableSongs.length, 24); i++) {
        const song = skippableSongs[i];
        const originalIndex = i + 1; // Index thực tế trong allSongs
        
        // Luôn hiển thị tất cả bài trong queue nếu không có từ khóa
        if (focused.trim() !== '') {
          const searchTerm = focused.toLowerCase();
          const matchName = song.name.toLowerCase().includes(searchTerm);
          const matchAuthor = song.uploader?.name && song.uploader.name.toLowerCase().includes(searchTerm);
          if (!matchName && !matchAuthor) {
            continue;
          }
        }
        
        const displayName = song.name.length > 50 
          ? song.name.substring(0, 47) + '...' 
          : song.name;
        const author = song.uploader?.name || song.artist || 'Không rõ';
        
        // Sử dụng queueId làm value để tránh trùng lặp hoàn toàn
        const queueId = song.queueId;
        const originalStt = song.stt;
        const suggestionName = `${originalStt}. ${displayName} - ${author}`;
        
        suggestions.push({
          name: suggestionName.length > 100 ? suggestionName.substring(0, 97) + '...' : suggestionName,
          value: queueId // Sử dụng unique queueId thay vì index
        });
      }

      await interaction.respond(suggestions.slice(0, 25));
    } catch (error) {
      if (error.code === 10062) { 
        return;
      }
      if (config.debug) console.error('[Skip Autocomplete] Lỗi:', error);
      try {
        await interaction.respond([
          { name: '❌ Có lỗi khi lấy danh sách bài hát!', value: 'error' }
        ]);
      } catch (e) {
        // Ignore
      }
    }
  },

  async execute(client, interaction) {
    try {
      const guildId = interaction.guildId;
      const queue = client.distube.getQueue(guildId);

      // Kiểm tra xem có nhạc đang phát không
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({
          content: '❌ Không có bài hát nào đang phát!',
          ephemeral: true
        });
      }

      const songOption = interaction.options.getString('song');

      // Xử lý các trường hợp đặc biệt
      if (songOption === 'empty') {
        return interaction.reply({
          content: '❌ Không có bài hát nào trong queue để skip!',
          ephemeral: true
        });
      }

      if (songOption === 'error') {
        return interaction.reply({
          content: '❌ Có lỗi khi lấy danh sách bài hát!',
          ephemeral: true
        });
      }

      // Parse queueId của bài hát được chọn
      const selectedQueueId = songOption;
      
      // Lấy queue từ queueManager
      queueManager.syncFromDisTube(guildId, queue);
      const allSongs = queueManager.getQueue(guildId);
      
      // Tìm bài hát theo queueId
      const targetSong = queueManager.findSongByQueueId(guildId, selectedQueueId);
      if (!targetSong) {
        return interaction.reply({
          content: '❌ Không tìm thấy bài hát được chọn!',
          ephemeral: true
        });
      }
      
      // Tìm index của bài hát trong allSongs
      const targetIndex = allSongs.findIndex(song => song.queueId === selectedQueueId);
      if (targetIndex === -1) {
        return interaction.reply({
          content: '❌ Không tìm thấy vị trí bài hát trong queue!',
          ephemeral: true
        });
      }

      // Nếu chọn bài đang phát (index 0)
      if (targetIndex === 0) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
          const currentSong = queue.songs[0];
          client.distube.skip(guildId);
          
          // Delay nhỏ để đảm bảo queue đã cập nhật
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Lấy bài tiếp theo sau khi skip
          const newQueue = client.distube.getQueue(guildId);
          if (newQueue && newQueue.songs && newQueue.songs.length > 0) {
            // Đồng bộ queueManager sau khi skip bài đầu tiên
            queueManager.syncAfterSkip(guildId, newQueue);
            
            const nextSong = newQueue.songs[0];
            
            // Lấy STT từ queueManager cho bài tiếp theo
            const nextStt = getSttFromQueueManager(guildId, nextSong);
            
            await generateSkipResultImage(nextSong, nextStt, interaction.channel);
            
            return interaction.followUp({
              content: `⏭️ Đã skip bài hiện tại và chuyển đến: **${nextSong.name}**`,
              ephemeral: true
            });
          } else {
            return interaction.followUp({
              content: `⏭️ Đã skip bài hiện tại: **${currentSong.name}** (không còn bài nào)`,
              ephemeral: true
            });
          }
        } catch (error) {
          return interaction.followUp({
            content: '❌ Không thể skip bài hát: ' + error.message,
            ephemeral: true
          });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        // targetSong đã được tìm thấy ở trên qua queueId
        
        // Lưu thông tin bài hát mục tiêu trước khi skip
        const originalTargetSong = {
          id: targetSong.id,
          url: targetSong.url,
          name: targetSong.name,
          uploader: targetSong.uploader,
          artist: targetSong.artist,
          stt: targetSong.stt, // Lưu STT gốc
          queueId: targetSong.queueId // Lưu queueId
        };
        
        // Skip đến bài được chọn bằng cách skip nhiều lần
        const skipsNeeded = targetIndex;
        
        if (config.debug) {
          console.log(`[Skip] Cần skip ${skipsNeeded} bài để đến bài "${targetSong.name}" (STT: ${targetSong.stt})`);
        }

        // Thực hiện skip liên tiếp với xử lý lỗi tốt hơn
        let successfulSkips = 0;
        for (let i = 0; i < skipsNeeded; i++) {
          try {
            const currentQueue = client.distube.getQueue(guildId);
            if (!currentQueue || !currentQueue.songs || currentQueue.songs.length === 0) {
              break; // Dừng nếu không còn bài nào
            }
            
            client.distube.skip(guildId);
            successfulSkips++;
            
            // Delay nhỏ giữa các lần skip để tránh conflict
            if (i < skipsNeeded - 1) {
              await new Promise(resolve => setTimeout(resolve, 800));
            }
          } catch (skipError) {
            if (config.debug) console.error(`[Skip] Lỗi khi skip lần ${i + 1}:`, skipError);
            break; // Dừng nếu gặp lỗi
          }
        }

        // Thêm delay lớn hơn để đảm bảo DisTube đã cập nhật hoàn toàn
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (successfulSkips > 0) {
          // Lấy queue sau khi skip để kiểm tra bài hiện tại
          const finalQueue = client.distube.getQueue(guildId);
          
          // Đồng bộ queueManager sau khi skip
          queueManager.syncAfterSkip(guildId, finalQueue);
          
          if (finalQueue && finalQueue.songs && finalQueue.songs.length > 0) {
            const currentSong = finalQueue.songs[0];
            
            // Sử dụng STT gốc từ originalTargetSong
            const originalStt = originalTargetSong.stt;
            
            // Debug logging
            if (config.debug) {
              console.log(`[Skip] Original target song: ${originalTargetSong.name} - ${originalTargetSong.uploader?.name || originalTargetSong.artist}`);
              console.log(`[Skip] Current playing song: ${currentSong.name} - ${currentSong.uploader?.name || currentSong.artist}`);
              console.log(`[Skip] Original STT from queueManager: ${originalStt}`);
              console.log(`[Skip] Target index: ${targetIndex}`);
              console.log(`[Skip] Successful skips: ${successfulSkips}`);
            }
            
            // Sử dụng bài hiện tại đang phát với STT gốc từ queueManager
            await generateSkipResultImage(currentSong, originalStt, interaction.channel);
            
            await interaction.followUp({
              content: `⏭️ Đã skip ${successfulSkips} bài để đến: **${currentSong.name}**\n` +
                       `👤 Tác giả: ${currentSong.uploader?.name || currentSong.artist || 'Không rõ'}`,
              ephemeral: true
            });
          } else {
            await interaction.followUp({
              content: `⏭️ Đã skip ${successfulSkips} bài nhưng không còn bài nào để phát!`,
              ephemeral: true
            });
          }
        } else {
          await interaction.followUp({
            content: '❌ Không thể skip bài hát nào!',
            ephemeral: true
          });
        }

      } catch (error) {
        if (config.debug) console.error('[Skip] Lỗi khi skip:', error);
        
        await interaction.followUp({
          content: '❌ Có lỗi xảy ra khi skip: ' + error.message,
          ephemeral: true
        });
      }

    } catch (error) {
      if (config.debug) console.error('[Skip] Lỗi ngoài cùng:', error);
      
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: '❌ Có lỗi ngoài cùng khi thực hiện lệnh skip!',
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: '❌ Có lỗi ngoài cùng khi thực hiện lệnh skip!',
            ephemeral: true
          });
        }
      } catch (e) {
        if (config.debug) console.error('[Skip] Lỗi khi reply/followUp:', e);
      }
    }
  },
};
