const { SlashCommandBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const StackBlur = require('stackblur-canvas');
const https = require('https');
const ytpl = require('@distube/ytpl');
const puppeteer = require('puppeteer');

async function crawlMixLinks(url, maxSongs) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('ytd-playlist-panel-video-renderer');

    const links = await page.evaluate((max) => {
      const videoElements = document.querySelectorAll('ytd-playlist-panel-video-renderer');
      const results = [];
      // Bỏ qua bài đầu tiên vì nó chính là video đang phát
      for (let i = 1; i < videoElements.length && results.length < max - 1; i++) {
        const linkElement = videoElements[i].querySelector('a#endpoint');
        if (linkElement) {
          results.push(linkElement.href);
        }
      }
      return results;
    }, maxSongs);

    // Lấy link của bài hát gốc (bài đầu tiên)
    const currentVideoLink = await page.evaluate(() => {
        const canonicalLink = document.querySelector("link[rel=canonical]");
        return canonicalLink ? canonicalLink.href : window.location.href.split('&')[0];
    });
    
    const finalLinks = [currentVideoLink, ...links];
    console.log(`[MIX] Crawl thành công, tìm thấy ${finalLinks.length} links.`);
    return finalLinks;
  } catch (error) {
    console.error(`Lỗi khi crawl link từ YouTube Mix: ${error.message}`);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generatePlaylistImage(channel, songs, title, thumbnailUrl, type) {
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
    
    ctx.font = '24px Arial'; ctx.fillStyle = '#ccc'; ctx.fillText('Số lượng: ' + songs.length, textX, 120, width - textX - 100);
    ctx.font = '18px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('Thời lượng: ' + durationText, textX, 170);
    
    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `${type}.png` });
    await channel.send({ files: [attachment] });
  } catch (error) {
    console.error(`[generatePlaylistImage] Lỗi khi tạo ảnh cho ${type}:`, error);
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

// Resolve SoundCloud shortlinks (on.soundcloud.com)
async function resolveSoundCloudShortlink(shortUrl) {
  return new Promise((resolve, reject) => {
    https.get(shortUrl, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        resolve(shortUrl); // Không redirect, trả về link cũ
      }
    }).on('error', reject);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ Youtube/Spotify/SoundCloud')
    .addStringOption(opt =>
      opt.setName('name-link')
        .setDescription('Link hoặc từ khóa')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused();
      const suggestions = [];

      if (focused.startsWith('http://') || focused.startsWith('https://')) {
        suggestions.push({ name: focused, value: focused });
      } else if (focused.trim() !== '') {
        const ytSearch = require('yt-search');
        try {
          const res = await ytSearch(focused);
          for (const v of res.videos.slice(0, 5)) {
            const name = v.title.length > 100 ? v.title.substring(0, 97) + '...' : v.title;
            suggestions.push({ name: name, value: v.url });
          }
        } catch (e) {
          console.error('[Autocomplete] Lỗi khi tìm kiếm YouTube:', e);
        }
      }
      
      if (!interaction.responded) {
        await interaction.respond(suggestions.slice(0, 25));
      }
    } catch (error) {
      if (error.code === 10062) { 
        return;
      }
      console.error('[Autocomplete] Lỗi không xác định:', error);
    }
  },

  async execute(client, interaction) {
    let query = interaction.options.getString('name-link');
    const voiceChannel = interaction.member.voice.channel;

    // Chuyển đổi link watch?v=...&list=... thành playlist?list=...
    try {
      if (query.includes('youtube.com/watch') && query.includes('list=')) {
        const url = new URL(query);
        const playlistId = url.searchParams.get('list');
        if (playlistId) {
          query = `https://www.youtube.com/playlist?list=${playlistId}`;
          console.log(`[URL] Đã chuyển đổi link playlist thành: ${query}`);
        }
      }
    } catch (e) {
      // Bỏ qua nếu URL không hợp lệ, để logic cũ xử lý
    }

    // Nếu là link rút gọn SoundCloud thì resolve sang link gốc
    if (query.includes('on.soundcloud.com/')) {
      query = await resolveSoundCloudShortlink(query);
    }

    // Đảm bảo defer trước khi xử lý URL
    await interaction.deferReply();
    const lockKey = `${interaction.guildId}`;

    if (client._addLock && client._addLock[lockKey]) {
      return await interaction.followUp({ content: '🚫 Đang thêm playlist/mix vào hàng đợi, vui lòng chờ!', ephemeral: true });
    }

    if (!voiceChannel) {
      return interaction.reply({
        content: "🔇 Vào voice channel trước đã!",
        ephemeral: true
      });
    }

    // Nếu query là link thì phát luôn, nếu không thì tìm kiếm và gửi select menu
    if (!query) {
      return interaction.editReply({ content: '❌ Bạn chưa nhập từ khóa hoặc link!', ephemeral: true });
    }
    const isUrl = query.startsWith('http://') || query.startsWith('https://');
    const isSpotify = query.includes('open.spotify.com');
    const isSpotifyAlbum = isSpotify && query.includes('/album/');
    const isSpotifyPlaylist = isSpotify && query.includes('/playlist/');
    const isYouTubePlaylist = /(?:youtube\.com|youtu\.be)\/.*[?&]list=([\w-]+)/i.test(query) && !/[?&]list=RD[\w-]+/i.test(query);
    const isYouTubeMix = /[?&]list=RD[\w-]+/i.test(query);
    const isSoundCloudPlaylist = query.includes('soundcloud.com/') && query.includes('/sets/');
    let type = 'YouTube';
    if (isSpotifyAlbum || isSpotifyPlaylist) type = 'Spotify';
    if (isSoundCloudPlaylist) type = 'SoundCloud';
    
    if (isSoundCloudPlaylist) {
      if (!client._addLock) client._addLock = {};
      client._addLock[lockKey] = true;

      // Embed đang xử lý
      const embed = new EmbedBuilder()
        .setTitle(`📃 Đang thêm danh sách phát SoundCloud`)
        .setDescription('Thao tác này có thể mất một lúc. Vui lòng chờ...')
        .setColor('#FF5500')
        .setThumbnail('https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico');
      await interaction.editReply({ embeds: [embed] });

      try {
        // Lấy info playlist qua oEmbed
        const playlistInfo = await getSoundCloudPlaylistInfo(query);
        const initialQueueSize = client.distube.getQueue(voiceChannel)?.songs?.length || 0;
        await client.distube.play(voiceChannel, query, {
          member: interaction.member,
          textChannel: interaction.channel,
        });
        const queue = client.distube.getQueue(voiceChannel);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newSongs = queue.songs.slice(initialQueueSize);

        if (newSongs.length > 0) {
          let totalSec = 0;
          for (const s of newSongs) {
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

          const resultEmbed = new EmbedBuilder()
            .setTitle(`✅ Đã thêm ${newSongs.length} bài hát`)
            .setDescription(`Từ: **${playlistInfo.title || 'Playlist SoundCloud'}**\nThời lượng: **${durationText}**\nDùng lệnh \`/queue\` để xem danh sách.`)
            .setThumbnail(playlistInfo.thumbnail_url || newSongs[0].thumbnail)
            .setColor('#FF5500');
          await interaction.editReply({ embeds: [resultEmbed] });
          setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
        } else {
          embed.setColor(0xff0000).setTitle('❌ Không thể thêm bài hát từ playlist này.');
          await interaction.editReply({ embeds: [embed] });
          setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
        }
      } catch (e) {
        embed.setColor(0xff0000).setTitle('❌ Có lỗi xảy ra').setDescription(e.message || 'Vui lòng thử lại sau.');
        await interaction.editReply({ embeds: [embed] });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
      } finally {
        if(client._addLock) delete client._addLock[lockKey];
      }
      return;
    }

    if (!isUrl) {
      await interaction.deferReply({ ephemeral: true });
      // Tìm kiếm YouTube
      const searchResult = await ytSearch(query);
      const videos = searchResult.videos.slice(0, 10);
      if (!videos.length) {
        return interaction.editReply({ content: '❌ Không tìm thấy kết quả nào!', ephemeral: true });
      }
      // Tạo select menu
      const options = videos.map((v, i) => ({
        label: v.title.length > 100 ? v.title.slice(0, 97) + '...' : v.title,
        description: v.author.name.length > 50 ? v.author.name.slice(0, 47) + '...' : v.author.name,
        value: v.url
      }));
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('play_select')
        .setPlaceholder('Chọn bài hát để phát')
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.editReply({
        content: '🎵 Chọn bài hát muốn phát:',
        components: [row],
      });
      return;
    }

    // Xử lý URL
    await interaction.deferReply();

    if (client._addLock && client._addLock[lockKey]) {
        return await interaction.followUp({ content: '🚫 Đang thêm playlist/mix vào hàng đợi, vui lòng chờ!', ephemeral: true });
    }

    try {
      // Nếu queue đã đủ 30 bài thì không cho add nữa
      let queue = client.distube.getQueue(voiceChannel);
      if (queue && queue.songs && queue.songs.length >= 30) {
        return await interaction.followUp({ content: '❌ Hàng đợi đã đầy (tối đa 30 bài)! Hãy xóa bớt bài trước khi thêm mới.', ephemeral: true });
      }

      if (isYouTubeMix) {
        client._addLock[lockKey] = true;
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const maxSongs = 30;
        const barLength = 30;
        const embed = new EmbedBuilder()
          .setTitle('🔄 Đang thêm bài từ YouTube Mix')
          .setDescription('Tính năng thêm bài sẽ bị tạm khóa cho đến khi quá trình hoàn thành.')
          .setColor(0x00bfff)
          .addFields(
            { name: 'Tiến trình', value: `[${'░'.repeat(barLength)}] 0%`, inline: false },
            { name: 'Đã thêm', value: '0', inline: true },
            { name: 'Danh sách phát', value: `0/${maxSongs}`, inline: true }
          );
        
        const stopButton = new ButtonBuilder()
          .setCustomId('stop_add')
          .setLabel('⏸️ Dừng')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder().addComponents(stopButton);
        
        let progressMsg = await interaction.followUp({ embeds: [embed], components: [row] });
        let added = 0;
        let isDone = false;
        let addedSongs = [];
        let shouldStop = false;
        let shouldCancel = false;
        let startQueueLength = 0;
        let notified = false;
        let progressMsgDeleted = false;
        let progressInterval; // Khai báo ngoài để clear bất cứ lúc nào
        
        // Lưu thông tin để xử lý button
        if (!client._addInfo) client._addInfo = {};
        client._addInfo[lockKey] = {
          guildId: interaction.guildId,
          channelId: interaction.channel.id,
          messageId: progressMsg.id,
          addedSongs: addedSongs,
          startQueueLength: startQueueLength,
          type: 'mix',
          requestCancel: false
        };
        
        // Hàm cập nhật progress bar
        const updateProgress = () => {
          if (progressMsgDeleted || !progressMsg || progressMsg.deleted) return clearInterval(progressInterval);
          const percent = Math.floor((added / maxSongs) * 100);
          const barCount = Math.floor(percent / (100 / barLength));
          const bar = '█'.repeat(barCount) + '░'.repeat(barLength - barCount);
          embed.data.fields[0].value = `[${bar}] ${percent}%`;
          embed.data.fields[1].value = `${added}`;
          let queue = client.distube.getQueue(voiceChannel);
          let cur = queue && queue.songs ? queue.songs.length : 0;
          embed.data.fields[2].value = `${cur}/${maxSongs}`;
          try {
            if (!progressMsgDeleted && progressMsg && !progressMsg.deleted) {
              progressMsg.edit({ embeds: [embed], components: [row] });
            }
          } catch (error) {
            if (error.code !== 10008) {
              console.log('[MIX] Không thể edit progress message:', error.message);
            }
          }
        };
        progressInterval = setInterval(() => {
          if (isDone || progressMsgDeleted || !progressMsg || progressMsg.deleted) return clearInterval(progressInterval);
          updateProgress();
        }, 2000);
        // Crawl danh sách bài trong Mix
        const mixLinks = await crawlMixLinks(query, maxSongs);
        if (!mixLinks || mixLinks.length === 0) {
          isDone = true;
          updateProgress();
          client._addLock[lockKey] = false;
          delete client._addInfo[lockKey];
          embed.setColor(0xff0000).setTitle('❌ Không lấy được danh sách bài hát trong Mix!');
          try {
            if (!progressMsgDeleted && progressMsg && !progressMsg.deleted) {
              await progressMsg.edit({ embeds: [embed], components: [] });
            }
          } catch (error) {
            if (error.code !== 10008) {
              console.log('[MIX] Không thể edit error message:', error.message);
            }
            await interaction.channel.send({ embeds: [embed] });
          }
          return;
        }
        
        // Lấy queue hiện tại để biết số bài ban đầu
        let initialQueue = client.distube.getQueue(voiceChannel);
        startQueueLength = initialQueue && initialQueue.songs ? initialQueue.songs.length : 0;
        client._addInfo[lockKey].startQueueLength = startQueueLength;
        console.log('[MIX] Số bài ban đầu:', startQueueLength);
        
        for (const link of mixLinks) {
          // Kiểm tra flag requestCancel
          if (client._addInfo[lockKey]?.requestCancel) {
            console.log('[MIX] Phát hiện requestCancel, thoát vòng lặp');
            break;
          }
          // Kiểm tra flag từ client._addInfo
          console.log('[MIX] Kiểm tra flag - shouldStop:', shouldStop, 'shouldCancel:', shouldCancel);
          if (client._addInfo[lockKey]) {
            console.log('[MIX] client._addInfo flags - shouldStop:', client._addInfo[lockKey].shouldStop, 'shouldCancel:', client._addInfo[lockKey].shouldCancel);
            // Cập nhật flag từ client._addInfo
            if (client._addInfo[lockKey].shouldStop !== undefined) shouldStop = client._addInfo[lockKey].shouldStop;
            if (client._addInfo[lockKey].shouldCancel !== undefined) shouldCancel = client._addInfo[lockKey].shouldCancel;
          }
          if (shouldStop || shouldCancel) {
            console.log('[MIX] Phát hiện flag dừng/hủy, thoát vòng lặp');
            // Dừng interval NGAY LẬP TỨC trước khi xóa progressMsg
            if (typeof progressInterval !== 'undefined') clearInterval(progressInterval);
            // Sleep 1.5s trước khi xóa progressMsg và gửi ảnh
            await new Promise(r => setTimeout(r, 1500));
            try {
              if (progressMsg && !progressMsg.deleted && progressMsg.deletable) {
                await progressMsg.delete();
                progressMsgDeleted = true;
                progressMsg = null;
              }
            } catch (error) {
              if (error.code !== 10008) console.log('[MIX] Không thể xóa progressMsg:', error.message);
            }
            // Xóa ephemeralMsg nếu có
            try {
              const addInfo = client._addInfo && client._addInfo[lockKey];
              if (addInfo && addInfo.ephemeralMsgId && interaction.channel) {
                const ephemeralMsg = await interaction.channel.messages.fetch(addInfo.ephemeralMsgId).catch(()=>null);
                if (ephemeralMsg && !ephemeralMsg.deleted && ephemeralMsg.deletable) await ephemeralMsg.delete().catch(e => { if (e.code !== 10008) console.log('[MIX] Không thể xóa ephemeralMsg:', e.message); });
              }
            } catch (e) {}
            // Gửi ảnh tổng kết playlist/mix
            try {
              let mixInfo = addedSongs[0] || {};
              let thumbUrl = mixInfo.thumbnail || '';
              let mixTitle = mixInfo.playlist?.name || mixInfo.name || 'YouTube Mix';
              let totalSec = 0;
              for (const s of addedSongs) {
                if (s.duration) {
                  if (typeof s.duration === 'number') totalSec += s.duration;
                  else if (typeof s.duration === 'string') totalSec += s.duration.split(':').reduce((a, b) => a * 60 + +b);
                }
              }
              let hours = Math.floor(totalSec / 3600);
              let minutes = Math.floor((totalSec % 3600) / 60);
              let seconds = totalSec % 60;
              let durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
              const width = 750, height = 200;
              const canvas = createCanvas(width, height);
              const ctx = canvas.getContext('2d');
              let img;
              try { img = await loadImage(thumbUrl); } catch (e) { img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png'); }
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
              // Luôn vẽ thumbnail với tỷ lệ khung hình đúng, kể cả ảnh mặc định
              const thumbImgRatio = img.width / img.height;
              let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
              if (thumbImgRatio > 1) { thumbSWidth = img.height; thumbSx = (img.width - thumbSWidth) / 2; }
              else { thumbSHeight = img.width; thumbSy = (img.height - thumbSHeight) / 2; }
              ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
              ctx.restore();
              const textX = thumbX + thumbSize + 30;
              ctx.font = 'bold 32px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(mixTitle, textX, 65, width - textX - 100);
              ctx.font = '24px Arial'; ctx.fillStyle = '#ccc'; ctx.fillText('Số lượng: ' + addedSongs.length, textX, 120, width - textX - 100);
              ctx.font = '18px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('Thời lượng: ' + durationText, textX, 170);
              const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'playlistmix.png' });
              await interaction.channel.send({ files: [attachment] });
            } catch (error) { if (error.code !== 10008) console.error('[MIX] Lỗi khi tạo/gửi ảnh khi dừng:', error); }
            // --- GIẢI PHÓNG LOCK SAU KHI DỪNG ---
            client._addLock[lockKey] = false;
            delete client._addInfo[lockKey];
            break;
          }
          queue = client.distube.getQueue(voiceChannel); // update queue
          if (queue && queue.songs && queue.songs.length >= maxSongs) break;
          // Kiểm tra flag NGAY TRƯỚC khi play
          if (shouldStop || shouldCancel) {
            console.log('[MIX] Phát hiện flag dừng/hủy ngay trước khi play, thoát vòng lặp');
            break;
          }
          try {
            const playRes = await client.distube.play(voiceChannel, link, {
              textChannel: interaction.channel,
              member: interaction.member,
              skip: false,
            });
            added++;
            // Lưu lại bài đã thêm
            console.log('[MIX] playRes:', playRes ? 'có dữ liệu' : 'null');
            if (playRes && playRes.songs && playRes.songs.length > 0) {
              addedSongs.push(playRes.songs[playRes.songs.length - 1]);
              console.log('[MIX] Đã lưu bài:', playRes.songs[playRes.songs.length - 1].name);
            } else {
              // Thử lấy từ queue hiện tại
              const currentQueue = client.distube.getQueue(voiceChannel);
              if (currentQueue && currentQueue.songs && currentQueue.songs.length > 0) {
                const lastSong = currentQueue.songs[currentQueue.songs.length - 1];
                addedSongs.push(lastSong);
                console.log('[MIX] Lưu bài từ queue:', lastSong.name);
              }
            }
            client._addInfo[lockKey].addedSongs = addedSongs;
            updateProgress();
            
            // Kiểm tra lại flag sau mỗi lần thêm bài
            console.log('[MIX] Sau khi thêm bài - shouldStop:', shouldStop, 'shouldCancel:', shouldCancel);
            if (client._addInfo[lockKey]) {
              // Cập nhật flag từ client._addInfo
              if (client._addInfo[lockKey].shouldStop !== undefined) shouldStop = client._addInfo[lockKey].shouldStop;
              if (client._addInfo[lockKey].shouldCancel !== undefined) shouldCancel = client._addInfo[lockKey].shouldCancel;
              console.log('[MIX] Sau khi cập nhật flag - shouldStop:', shouldStop, 'shouldCancel:', shouldCancel);
            }
            if (shouldStop || shouldCancel) {
              console.log('[MIX] Phát hiện flag dừng/hủy sau khi thêm bài, thoát vòng lặp');
              break;
            }
          } catch (e) { console.error('[MIX] Lỗi khi thêm bài vào queue:', e); continue; }
        }
        isDone = true;
        updateProgress();
        setTimeout(async () => {
          // Dừng interval NGAY LẬP TỨC trước khi xóa progressMsg
          if (typeof progressInterval !== 'undefined') clearInterval(progressInterval);
          // Sleep 1.5s trước khi xóa progressMsg và gửi ảnh
          await new Promise(r => setTimeout(r, 3000));
          let deleted = false;
          try {
            if (progressMsg && !progressMsg.deleted && progressMsg.deletable) {
              await progressMsg.delete();
              progressMsgDeleted = true;
              progressMsg = null;
            }
          } catch (error) {
            if (error.code !== 10008) console.log('[MIX] Không thể xóa progressMsg:', error.message);
          }
          // Xóa ephemeralMsg nếu có
          try {
            const addInfo = client._addInfo && client._addInfo[lockKey];
            if (addInfo && addInfo.ephemeralMsgId && interaction.channel) {
              const ephemeralMsg = await interaction.channel.messages.fetch(addInfo.ephemeralMsgId).catch(()=>null);
              if (ephemeralMsg && !ephemeralMsg.deleted && ephemeralMsg.deletable) await ephemeralMsg.delete().catch(e => { if (e.code !== 10008) console.log('[MIX] Không thể xóa ephemeralMsg:', e.message); });
            }
          } catch (e) {}
          // Gửi ảnh tổng kết playlist/mix
          try {
            let mixInfo = addedSongs[0] || {};
            let thumbUrl = mixInfo.thumbnail || '';
            let mixTitle = mixInfo.playlist?.name || mixInfo.name || 'YouTube Mix';
            let totalSec = 0;
            for (const s of addedSongs) {
              if (s.duration) {
                if (typeof s.duration === 'number') totalSec += s.duration;
                else if (typeof s.duration === 'string') totalSec += s.duration.split(':').reduce((a, b) => a * 60 + +b);
              }
            }
            let hours = Math.floor(totalSec / 3600);
            let minutes = Math.floor((totalSec % 3600) / 60);
            let seconds = totalSec % 60;
            let durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
            const width = 750, height = 200;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            let img;
            try { img = await loadImage(thumbUrl); } catch (e) { img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png'); }
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
            // Luôn vẽ thumbnail với tỷ lệ khung hình đúng, kể cả ảnh mặc định
            const thumbImgRatio = img.width / img.height;
            let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
            if (thumbImgRatio > 1) { thumbSWidth = img.height; thumbSx = (img.width - thumbSWidth) / 2; }
            else { thumbSHeight = img.width; thumbSy = (img.height - thumbSHeight) / 2; }
            ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
            ctx.restore();
            const textX = thumbX + thumbSize + 30;
            ctx.font = 'bold 32px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(mixTitle, textX, 65, width - textX - 100);
            ctx.font = '24px Arial'; ctx.fillStyle = '#ccc'; ctx.fillText('Số lượng: ' + addedSongs.length, textX, 120, width - textX - 100);
            ctx.font = '18px Arial'; ctx.fillStyle = '#fff'; ctx.fillText('Thời lượng: ' + durationText, textX, 170);
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'playlistmix.png' });
            await interaction.channel.send({ files: [attachment] });
          } catch (error) { if (error.code !== 10008) console.error('[MIX] Lỗi khi tạo/gửi ảnh khi dừng:', error); }
          // --- GIẢI PHÓNG LOCK KHI HOÀN THÀNH ---
          client._addLock[lockKey] = false;
          delete client._addInfo[lockKey];
        }, 1000);
        return;
      }

      if (isYouTubePlaylist || isSpotifyAlbum || isSpotifyPlaylist || isSoundCloudPlaylist) {
        if (!client._addLock) client._addLock = {};
        client._addLock[lockKey] = true;

        // Embed đang xử lý
        const embed = new EmbedBuilder()
          .setTitle(`📃 Đang thêm danh sách phát ${type}`)
          .setDescription('Thao tác này có thể mất một lúc. Vui lòng chờ...')
          .setColor(type === 'YouTube' ? '#FF0000' : type === 'Spotify' ? '#1DB954' : '#FF5500')
          .setThumbnail(type === 'SoundCloud' ? 'https://a-v2.sndcdn.com/assets/images/sc-icons/favicon-2cadd14bdb.ico' : null);
        await interaction.editReply({ embeds: [embed] });

        try {
            const initialQueueSize = client.distube.getQueue(voiceChannel)?.songs?.length || 0;
            await client.distube.play(voiceChannel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
            });
            const queue = client.distube.getQueue(voiceChannel);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const newSongs = queue.songs.slice(initialQueueSize);

            if (newSongs.length > 0) {
                const playlist = newSongs[0].playlist;
                let playlistTitle = playlist?.name || (type === 'Spotify' ? 'Playlist Spotify' : type === 'SoundCloud' ? 'Playlist SoundCloud' : 'Playlist YouTube');
                let playlistThumbnail = playlist?.thumbnail || newSongs[0].thumbnail;
                let totalSec = 0;
                for (const s of newSongs) {
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

                const resultEmbed = new EmbedBuilder()
                  .setTitle(`✅ Đã thêm ${newSongs.length} bài hát`)
                  .setDescription(`Từ: **${playlistTitle}**\nThời lượng: **${durationText}**\nDùng lệnh \`/queue\` để xem danh sách.`)
                  .setThumbnail(playlistThumbnail)
                  .setColor(type === 'YouTube' ? '#FF0000' : type === 'Spotify' ? '#1DB954' : '#FF5500');
                await interaction.editReply({ embeds: [resultEmbed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
            } else {
                embed.setColor(0xff0000).setTitle('❌ Không thể thêm bài hát từ playlist/album này.');
                await interaction.editReply({ embeds: [embed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
            }
        } catch (e) {
            console.error(`[Playlist] Lỗi khi xử lý playlist ${type}:`, e);
            embed.setColor(0xff0000).setTitle('❌ Có lỗi xảy ra').setDescription(e.message || 'Vui lòng thử lại sau.');
            await interaction.editReply({ embeds: [embed] });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 7000);
        } finally {
            if(client._addLock) delete client._addLock[lockKey];
        }
        return;
      }

      // Xử lý link bài hát đơn lẻ
      try {
        queue = client.distube.getQueue(voiceChannel);
        if (queue && queue.songs && queue.songs.length >= 30) {
          return await interaction.followUp({ content: '❌ Hàng đợi đã đầy (tối đa 30 bài)! Hãy xóa bớt bài trước khi thêm mới.', ephemeral: true });
        }
        const playResult = await client.distube.play(voiceChannel, query, {
          textChannel: interaction.channel,
          member: interaction.member
        });
      } catch (e) {
        console.error(e);
        return interaction.followUp({ content: `❌ Có lỗi xảy ra khi thêm bài hát: ${e.message}`, ephemeral: true });
      }

      const replyMsg = await interaction.followUp('🎵 Đã nhận yêu cầu phát nhạc!');

      // Đợi 1 giây để queue cập nhật bài hát mới nhất
      await new Promise(r => setTimeout(r, 1000));

      // Lấy lại queue mới nhất
      const updatedQueue = client.distube.getQueue(voiceChannel);
      if (updatedQueue && updatedQueue.songs && updatedQueue.songs.length > 0) {
        // Nếu queue đã có bài, lấy bài vừa thêm (cuối queue), nếu không thì lấy bài đầu
        let song, currentIndex;
        if (updatedQueue.songs.length === 1) {
          song = updatedQueue.songs[0];
          currentIndex = 1;
        } else {
          song = updatedQueue.songs[updatedQueue.songs.length - 1];
          currentIndex = updatedQueue.songs.length;
        }
        const width = 750, height = 200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // Nền mờ từ ảnh nhạc
        let img;
        let thumbUrl = song.thumbnail;
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
        // Nếu là link Spotify, lấy thumbnail từ oembed
        else if (song.url && song.url.includes('spotify.com/track/')) {
          try {
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
              img = await loadImage(thumbUrl);
            }
          } catch (e) {
            img = undefined;
          }
        }
        // Nếu là link SoundCloud, lấy thumbnail từ oembed
        else if (song.url && song.url.includes('soundcloud.com/')) {
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
        
        // Vẽ ảnh nền trước
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
        // Sau đó mới làm mờ bằng stackblur
        StackBlur.canvasRGBA(ctx.canvas, 0, 0, width, height, 10);
        // (Tùy chọn) phủ lớp tối nhẹ nếu muốn
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, width, height);

        // --- VẼ THUMBNAIL BO GÓC BÊN TRÁI ---
        // Đảm bảo luôn bo góc kể cả khi img là ảnh mặc định hoặc ảnh lỗi
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

        // Luôn vẽ thumbnail với tỷ lệ khung hình đúng, kể cả ảnh mặc định
        const thumbImgRatio = img.width / img.height;
        let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
        if (thumbImgRatio > 1) { thumbSWidth = img.height; thumbSx = (img.width - thumbSWidth) / 2; }
        else { thumbSHeight = img.width; thumbSy = (img.height - thumbSHeight) / 2; }
        ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
        ctx.restore();

        // Điều chỉnh vị trí text để phù hợp với thumbnail mới
        const textX = thumbX + thumbSize + 30; // Dời text sang phải hơn nữa để tránh đè lên thumbnail

        // Tiêu đề
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#fff';
        const truncatedTitle = song.name.length > 40 ? song.name.substring(0, 37) + '...' : song.name;
        ctx.fillText(truncatedTitle, textX, 65, width - textX - 100);

        // Nghệ sĩ
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ccc';
        ctx.fillText('Tác giả: ' + (song.uploader?.name || song.artist || ''), textX, 120, width - textX - 100);

        // Số thứ tự bài hát
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
        ctx.fillText(`${currentIndex}`, circleX, circleY);
        ctx.restore();
        ctx.textAlign = 'left';

        // Thời gian
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('Thời lượng: ' + (song.formattedDuration || song.duration || ''), textX, 170);

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'nowplaying.png' });
        await interaction.channel.send({ files: [attachment] });
        // Xóa tin nhắn đã nhận yêu cầu
        if (replyMsg && replyMsg.delete) {
          try { await replyMsg.delete(); } catch {}
        }
      }
    } catch (err) {
      // Nếu là DisTubeError: Queue thì chỉ log message
      if (err && err.name === 'DisTubeError' && err.message && err.message.includes('Queue')) {
        console.error('PlayError:', err.message);
      } else {
        console.error('PlayError:', err);
      }
      await interaction.followUp({
        content: `❌ Không thể phát bài hát!\n\n${err.message || err}`,
        ephemeral: true
      });
    } finally {
      if (client._addLock[lockKey]) {
        delete client._addLock[lockKey];
        if (client._addInfo && client._addInfo[lockKey]) {
          delete client._addInfo[lockKey];
        }
      }
    }
  },
};