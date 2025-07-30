const { SlashCommandBuilder } = require('discord.js');
const ytSearch = require('yt-search');
const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { AttachmentBuilder } = require('discord.js');
const StackBlur = require('stackblur-canvas');
const https = require('https');
const ytpl = require('@distube/ytpl');
const puppeteer = require('puppeteer');
const { routeToPlatform } = require('./platforms/platformDetector');
const PlaylistAddController = require('../services/PlaylistAddController');
const config = require('../config/config');
const autoLeaveManager = require('../utils/autoLeaveManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('phatnhac')
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
    try {
      // Kiểm tra xem máy chủ có bị chặn không cho bot tham gia
      if (autoLeaveManager.isGuildBlocked(interaction.guildId)) {
        return interaction.reply({
          content: "🚫 Bot đã rời kênh thoại do không có ai. Hãy vào kênh thoại rồi thử lại!",
          ephemeral: true
        });
      }

      let query = interaction.options.getString('name-link');
      const voiceChannel = interaction.member.voice.channel;

      // Chuyển đổi liên kết watch?v=...&list=... thành playlist?list=...
      try {
        if (query.includes('youtube.com/watch') && query.includes('list=')) {
          const url = new URL(query);
          const playlistId = url.searchParams.get('list');
          if (playlistId) {
            query = `https://www.youtube.com/playlist?list=${playlistId}`;
            if (config.debug) console.log(`[URL] Đã chuyển đổi liên kết playlist thành: ${query}`);
          }
        }
      } catch (e) {
        // Bỏ qua nếu URL không hợp lệ, để logic cũ xử lý
      }

      // Đảm bảo luôn khởi tạo đối tượng lock/info
      if (!client._addLock) client._addLock = {};
      if (!client._addInfo) client._addInfo = {};

      // Kiểm tra kênh thoại trước khi defer
      if (!voiceChannel) {
        return interaction.reply({
          content: "🔇 Vào kênh thoại trước đã!",
          ephemeral: true
        });
      }

      // Xóa cờ chặn khi người dùng tham gia thoại và cố phát nhạc
      if (autoLeaveManager.isGuildBlocked(interaction.guildId)) {
        autoLeaveManager.unblockGuild(interaction.guildId);
      }

      // Nếu query là liên kết thì phát luôn, nếu không thì tìm kiếm và gửi menu chọn
      if (!query) {
        return interaction.reply({ content: '❌ Bạn chưa nhập từ khóa hoặc liên kết!', ephemeral: true });
      }

      // deferReply duy nhất tại đây (public)
      await interaction.deferReply({ ephemeral: true });

      const lockKey = `${interaction.guildId}`;

      // Khởi tạo controller theo dõi thêm playlist (nếu là playlist YouTube)
      let playlistAddController = null;
      if ((query.includes('youtube.com/playlist') || query.includes('youtu.be/playlist')) && !/[?&]list=RD[\w-]+/i.test(query)) {
        playlistAddController = new PlaylistAddController(client);
      }

      // Kiểm tra playlist YouTube có tồn tại không trước khi phát
      if ((query.includes('youtube.com/playlist') || query.includes('youtu.be/playlist')) && !/[?&]list=RD[\w-]+/i.test(query)) {
        try {
          // Sử dụng ytpl để kiểm tra playlist
          const ytpl = require('@distube/ytpl');
          const playlistIdMatch = query.match(/[?&]list=([\w-]+)/i);
          const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;
          if (!playlistId) {
            return await interaction.followUp({ content: '❌ Không tìm thấy ID playlist trong link!', ephemeral: true });
          }
          const playlistInfo = await ytpl(playlistId, { limit: 1 });
          if (!playlistInfo || !playlistInfo.items || playlistInfo.items.length === 0) {
            return await interaction.followUp({ content: '❌ Playlist này không tồn tại hoặc không có bài hát nào!', ephemeral: true });
          }
        } catch (e) {
          return await interaction.followUp({ content: '❌ Playlist này không tồn tại hoặc không thể lấy thông tin từ YouTube!', ephemeral: true });
        }
      }

      if (client._addLock && client._addLock[lockKey]) {
        return await interaction.followUp({ content: '🚫 Đang thêm playlist/mix vào hàng đợi, vui lòng chờ!', ephemeral: true });
      }

      // ==== Lấy volume ưu tiên: user -> server -> distube default ====
      let volumeToPlay = null;
      try {
        const ServerService = require('../database/services/ServerService');
        const serverObj = await ServerService.layServer(interaction.guildId);
        let userVol = null;
        let serverVol = null;
        if (serverObj) {
          if (config.debug) console.log(`[play.js] serverObj.volumePerUser:`, serverObj.volumePerUser);
          // Tìm volume cá nhân user
          const userEntry = Array.isArray(serverObj.volumePerUser) ? serverObj.volumePerUser.find(u => {
            if (config.debug) console.log(`[play.js] So sánh userId:`, u.userId, '===', interaction.user.id, '->', u.userId === interaction.user.id);
            return u.userId === interaction.user.id;
          }) : null;
          if (userEntry && typeof userEntry.volume === 'number') {
            userVol = userEntry.volume;
            if (config.debug) console.log(`[play.js] Tìm thấy volume cá nhân:`, userVol);
          } else {
            if (config.debug) console.log(`[play.js] Không tìm thấy volume cá nhân cho userId:`, interaction.user.id);
          }
          // Lấy volumeDefault server
          if (typeof serverObj.volumeDefault === 'number') {
            serverVol = serverObj.volumeDefault;
            if (config.debug) console.log(`[play.js] volumeDefault của server:`, serverVol);
          } else {
            if (config.debug) console.log(`[play.js] Không có volumeDefault cho server`);
          }
        } else {
          if (config.debug) console.log(`[play.js] Không tìm thấy serverObj cho guildId:`, interaction.guildId);
        }
        if (typeof userVol === 'number') {
          volumeToPlay = userVol;
          if (config.debug) console.log(`[play.js] Sử dụng volume cá nhân: ${userVol}`);
        } else if (typeof serverVol === 'number') {
          volumeToPlay = serverVol;
          if (config.debug) console.log(`[play.js] Sử dụng volume mặc định server: ${serverVol}`);
        } else {
          if (config.debug) console.log(`[play.js] Không có volume cá nhân hoặc server, dùng mặc định distube`);
        }
      } catch (err) {
        console.error('[play.js] Lỗi lấy volume ưu tiên:', err);
      }

      // Đăng ký event playSong để set volume đúng thời điểm queue đã sẵn sàng
      const playSongHandler = async (queue, song) => {
        try {
          if (queue && queue.id === interaction.guildId) {
            // Lấy lại volumeToPlay mới nhất từ database
            const ServerService = require('../database/services/ServerService');
            let volumeToPlayMoi = null;
            let userVol = null;
            let serverVol = null;
            const serverObj = await ServerService.layServer(interaction.guildId);
            if (serverObj) {
              if (config.debug) console.log(`[play.js] [playSong event] serverObj.volumePerUser:`, serverObj.volumePerUser);
              const userEntry = Array.isArray(serverObj.volumePerUser) ? serverObj.volumePerUser.find(u => u.userId === interaction.user.id) : null;
              if (userEntry && typeof userEntry.volume === 'number') {
                userVol = userEntry.volume;
                if (config.debug) console.log(`[play.js] [playSong event] Tìm thấy volume cá nhân:`, userVol);
              }
              if (typeof serverObj.volumeDefault === 'number') {
                serverVol = serverObj.volumeDefault;
                if (config.debug) console.log(`[play.js] [playSong event] volumeDefault của server:`, serverVol);
              }
            }
            if (typeof userVol === 'number') {
              volumeToPlayMoi = userVol;
              if (config.debug) console.log(`[play.js] [playSong event] Sử dụng volume cá nhân: ${userVol}`);
            } else if (typeof serverVol === 'number') {
              volumeToPlayMoi = serverVol;
              if (config.debug) console.log(`[play.js] [playSong event] Sử dụng volume mặc định server: ${serverVol}`);
            } else {
              if (config.debug) console.log(`[play.js] [playSong event] Không có volume cá nhân hoặc server, dùng mặc định distube`);
            }
            if (typeof volumeToPlayMoi === 'number') {
              queue.setVolume(volumeToPlayMoi);
              if (config.debug) console.log(`[play.js] [playSong event] Đã set volume queue:`, volumeToPlayMoi);
            }
          }
        } catch (err) {
          console.error('[play.js] Lỗi khi set volume trong event playSong:', err);
        }
      };
      client.distube.on('playSong', playSongHandler);
      let routeResult = null;
      let routeStdout = '';
      let routeStderr = '';
      try {
        if (config.debug) {
          console.log(`[play.js] Bắt đầu routeToPlatform với query:`, query);
          console.log(`[play.js] Lock key:`, lockKey);
          console.log(`[play.js] Voice channel:`, voiceChannel?.name, voiceChannel?.id);
          console.log(`[play.js] Volume sẽ phát:`, volumeToPlay);
        }

        // Nếu là playlist, truyền callback dừng/tiếp tục cho controller
        let isAdding = true;
        let stopAdd = () => { isAdding = false; if (config.debug) console.log('[play.js] Đã tạm dừng thêm playlist'); };
        let continueAdd = () => { isAdding = true; if (config.debug) console.log('[play.js] Tiếp tục thêm playlist'); };

        if (playlistAddController) {
          // Lấy queue hiện tại để theo dõi
          const distubeQueue = client.distube.getQueue(interaction.guildId);
          playlistAddController.startTracking(interaction.guildId, distubeQueue, continueAdd, stopAdd);
        }

        // Gọi routeToPlatform và log stdout/stderr nếu có
        try {
          // Nếu là playlist, truyền vào biến kiểm soát isAdding để các hàm thêm bài kiểm tra trước khi thêm
          routeResult = await routeToPlatform(client, interaction, query, voiceChannel, lockKey, volumeToPlay, { isAddingRef: () => isAdding });
          if (routeResult && typeof routeResult === 'object') {
            if (routeResult.stdout) {
              routeStdout = routeResult.stdout;
              if (config.debug) console.log('[play.js] [routeToPlatform] stdout:', routeStdout);
            }
            if (routeResult.stderr) {
              routeStderr = routeResult.stderr;
              if (config.debug) console.log('[play.js] [routeToPlatform] stderr:', routeStderr);
            }
          }
        } catch (subErr) {
          if (subErr && subErr.stdout) {
            routeStdout = subErr.stdout;
            console.error('[play.js] [routeToPlatform] stdout (error):', routeStdout);
          }
          if (subErr && subErr.stderr) {
            routeStderr = subErr.stderr;
            console.error('[play.js] [routeToPlatform] stderr (error):', routeStderr);
          }
          throw subErr;
        }
        if (config.debug) console.log(`[play.js] routeToPlatform hoàn thành thành công`);
      } catch (err) {
        // Bắt lỗi JSON parse từ yt-dlp
        let userMsg = `❌ Không thể phát bài hát!\n\n${err.message || err}`;
        let isYtdlpJsonError = err && err.message && err.message.includes('is not valid JSON');
        let isRateLimit = false;
        let rawLog = '';
        if (isYtdlpJsonError) {
          console.error('[play.js] Lỗi JSON từ yt-dlp:', err.message);
          if (err.stdout) {
            console.error('[play.js] yt-dlp stdout:', err.stdout);
            rawLog += err.stdout;
          }
          if (err.stderr) {
            console.error('[play.js] yt-dlp stderr:', err.stderr);
            rawLog += err.stderr;
          }
          // Log thêm stdout/stderr đã thu được từ routeToPlatform nếu có
          if (routeStdout) {
            console.error('[play.js] yt-dlp stdout (routeToPlatform):', routeStdout);
            rawLog += routeStdout;
          }
          if (routeStderr) {
            console.error('[play.js] yt-dlp stderr (routeToPlatform):', routeStderr);
            rawLog += routeStderr;
          }
          // Kiểm tra các từ khóa liên quan rate limit/quota
          const rateKeywords = ['rate limit', 'quota', '429', 'exceeded', 'too many requests', 'temporarily unavailable', 'blocked', 'try again later'];
          if (rawLog && rateKeywords.some(k => rawLog.toLowerCase().includes(k))) {
            isRateLimit = true;
          }
        }
        // Log stdout/stderr kể cả khi không phải lỗi JSON
        if (routeStdout) {
          console.log('[play.js] [routeToPlatform] stdout (always):', routeStdout);
        }
        if (routeStderr) {
          console.log('[play.js] [routeToPlatform] stderr (always):', routeStderr);
        }
        console.error(`[play.js] Lỗi chi tiết trong routeToPlatform:`, {
          message: err.message,
          name: err.name,
          stack: err.stack,
          code: err.code,
          statusCode: err.statusCode,
          errorCode: err.errorCode,
          details: err.details,
          query: query,
          guild: interaction.guild?.name,
          channel: interaction.channel?.name,
          user: interaction.user?.tag,
          lockKey: lockKey,
          volumeToPlay: volumeToPlay
        });
        // Nếu là DisTubeError: Queue thì chỉ log message
        if (err && err.name === 'DisTubeError' && err.message && err.message.includes('Queue')) {
          console.error('[play.js] PlayError (Queue):', err.message);
        } else {
          console.error('[play.js] PlayError (General):', err);
        }
        // Xử lý thông báo lỗi thân thiện hơn
        if (isRateLimit) {
          userMsg = '❌ Có thể bạn đã thêm quá nhiều bài liên tục, YouTube đang giới hạn truy cập (rate limit/quota). Vui lòng thử lại sau hoặc giảm tần suất thêm bài.';
        } else if (err.message && (err.message.includes('private') || err.message.includes('unavailable') || err.message.includes('404'))) {
          userMsg = '❌ Nội dung này là riêng tư, không tồn tại hoặc không thể truy cập!';
        } else if (err.message && err.message.includes('SPOTIFY_API_ERROR')) {
          userMsg = '❌ Lỗi Spotify API - có thể do cấu hình hoặc giới hạn vùng!';
        } else if (err.message && err.message.includes('quota')) {
          userMsg = '❌ Đã vượt quá giới hạn API!';
        } else if (err.message && err.message.includes('Queue')) {
          userMsg = '❌ Bot đang bận, vui lòng thử lại sau!';
        }
        await interaction.followUp({
          content: userMsg,
          ephemeral: true
        });
      } finally {
        if (config.debug) console.log(`[play.js] Cleanup lock key:`, lockKey);
        if (client._addLock && client._addLock[lockKey]) {
          delete client._addLock[lockKey];
          if (client._addInfo && client._addInfo[lockKey]) {
            delete client._addInfo[lockKey];
          }
        }
        // Xóa event listener sau khi hoàn thành để tránh leak bộ nhớ
        client.distube.off('playSong', playSongHandler);
        // Dừng controller khi xong
        if (playlistAddController) playlistAddController.stopTracking(interaction.guildId);
      }
    } catch (err) {
      console.error('[play.js] Lỗi ngoài cùng trong execute:', err, 'interaction:', interaction);
      try {
        if (interaction && (interaction.deferred || interaction.replied)) {
          await interaction.followUp({ content: '❌ Có lỗi ngoài cùng khi xử lý lệnh play!', ephemeral: true });
        } else if (interaction) {
          await interaction.reply({ content: '❌ Có lỗi ngoài cùng khi xử lý lệnh play!', ephemeral: true });
        }
      } catch (e) {
        console.error('[play.js] Lỗi khi reply/followUp lỗi ngoài cùng:', e);
      }
    }
  },
}; 