const { resolveSoundCloudShortlink } = require('../../utils/soundcloudUtils');

// Helper function to get config safely (lazy load to avoid circular dependency)
function getConfig() {
  try {
    return require('../../utils/hotReload').getCurrentConfig();
  } catch (error) {
    return require('../../config/config');
  }
}

// Helper functions để kiểm tra config
function isPlatformFeatureEnabled(platform, type) {
  // Sử dụng config được hot reload
  const config = getConfig();
  
  if (!config.platform || !config.platform[platform]) {
    if (config.debug) console.log(`[PlatformDetector] Platform ${platform} không có trong config`);
    return false;
  }
  
  const platformConfig = config.platform[platform];
  
  // Map các type đặc biệt
  if (type === 'search') type = 'single'; // YouTube search được coi như single
  if (type === 'mix') type = 'playlist'; // YouTube mix được coi như playlist
  
  const isEnabled = platformConfig[type] === true;
  
  if (config.debug) {
    console.log(`[PlatformDetector] Kiểm tra ${platform}.${type}: ${isEnabled}`);
    console.log(`[PlatformDetector] Platform config:`, platformConfig);
  }
  
  return isEnabled;
}

function getPlatformDisplayName(platform) {
  const names = {
    'youtube': 'YouTube',
    'spotify': 'Spotify', 
    'soundcloud': 'SoundCloud'
  };
  return names[platform] || platform;
}

function getTypeDisplayName(type) {
  const names = {
    'single': 'bài hát đơn lẻ',
    'playlist': 'playlist',
    'album': 'album',
    'search': 'tìm kiếm bài hát',
    'mix': 'mix/radio'
  };
  return names[type] || type;
}

// Tạo thông báo lỗi khi tính năng bị tắt
function createFeatureDisabledMessage(platform, type) {
  const platformName = getPlatformDisplayName(platform);
  const typeName = getTypeDisplayName(type);
  
  return `❌ **Tính năng bị tắt!**\n\n` +
         `Tính năng **${typeName}** cho **${platformName}** hiện đang bị vô hiệu hóa bởi admin.`;
}

// Phát hiện loại platform và content type từ URL
async function detectPlatform(query) {
  // Nếu là link rút gọn SoundCloud thì resolve sang link gốc
  if (query.includes('soundcloud.com') && !query.includes('on.soundcloud.com')) {
    // Nếu là link soundcloud.com nhưng không phải shortlink thì báo lỗi
    throw new Error('Chỉ chấp nhận link SoundCloud dạng shortlink (on.soundcloud.com) để tránh vượt giới hạn độ dài của Discord.');
  }
  if (query.includes('on.soundcloud.com/')) {
    query = await resolveSoundCloudShortlink(query);
  }

  const isUrl = query.startsWith('http://') || query.startsWith('https://');
  
  if (!isUrl) {
    return {
      platform: 'youtube',
      type: 'search',
      query: query
    };
  }

  // YouTube
  if (query.includes('youtube.com') || query.includes('youtu.be')) {
    const isYouTubePlaylist = /(?:youtube\.com|youtu\.be)\/.*[?&]list=([\w-]+)/i.test(query) && !/[?&]list=RD[\w-]+/i.test(query);
    const isYouTubeMix = /[?&]list=RD[\w-]+/i.test(query);
    
    if (isYouTubeMix) {
      return {
        platform: 'youtube',
        type: 'mix',
        query: query
      };
    } else if (isYouTubePlaylist) {
      return {
        platform: 'youtube',
        type: 'playlist',
        query: query
      };
    } else {
      return {
        platform: 'youtube',
        type: 'single',
        query: query
      };
    }
  }

  // Spotify
  if (query.includes('open.spotify.com')) {
    const isSpotifyAlbum = query.includes('/album/');
    const isSpotifyPlaylist = query.includes('/playlist/');
    const isSpotifyTrack = query.includes('/track/');
    
    if (isSpotifyAlbum) {
      return {
        platform: 'spotify',
        type: 'album',
        query: query
      };
    } else if (isSpotifyPlaylist) {
      return {
        platform: 'spotify',
        type: 'playlist',
        query: query
      };
    } else if (isSpotifyTrack) {
      return {
        platform: 'spotify',
        type: 'single',
        query: query
      };
    }
  }

  // SoundCloud
  if (query.includes('soundcloud.com')) {
    const isSoundCloudPlaylist = query.includes('/sets/');
    const isSoundCloudTrack = query.includes('/tracks/') || (query.includes('soundcloud.com/') && !query.includes('/sets/'));
    
    if (isSoundCloudPlaylist) {
      return {
        platform: 'soundcloud',
        type: 'playlist',
        query: query
      };
    } else if (isSoundCloudTrack) {
      return {
        platform: 'soundcloud',
        type: 'single',
        query: query
      };
    }
  }

  // Mặc định là YouTube search
  return {
    platform: 'youtube',
    type: 'search',
    query: query
  };
}

// Router để điều hướng logic xử lý
async function routeToPlatform(client, interaction, query, voiceChannel, lockKey) {
  const config = getConfig(); // Sử dụng config hot reload
  
  if (config.debug) {
    console.log(`[PlatformDetector] Bắt đầu route platform cho query:`, query);
    console.log(`[PlatformDetector] Voice Channel:`, voiceChannel?.name, voiceChannel?.id);
    console.log(`[PlatformDetector] Guild:`, interaction.guild?.name, interaction.guild?.id);
  }
  
  try {
    const detection = await detectPlatform(query);
    if (config.debug) console.log(`[PlatformDetector] Kết quả detection:`, detection);
    
    // Kiểm tra config để xem platform/type có được bật không
    if (!isPlatformFeatureEnabled(detection.platform, detection.type)) {
      const errorMessage = createFeatureDisabledMessage(detection.platform, detection.type);
      return await interaction.followUp({
        content: errorMessage,
        ephemeral: true
      });
    }
    
    switch (detection.platform) {
      case 'youtube':
        if (config.debug) console.log(`[PlatformDetector] Chuyển đến YouTube handler với type:`, detection.type);
        const youtubeHandler = require('./youtube');
        switch (detection.type) {
          case 'playlist':
            return await youtubeHandler.handleYouTubePlaylist(client, interaction, detection.query, voiceChannel, lockKey);
          case 'mix':
            await interaction.editReply({
              content: '❌ Không hỗ trợ phát link YouTube Mix (list=RD...). Không có bài hát nào được thêm vào hàng đợi.',
              ephemeral: true
            });
            return;
          case 'single':
            return await youtubeHandler.handleYouTubeSingle(client, interaction, detection.query, voiceChannel);
          case 'search':
            return await handleYouTubeSearch(client, interaction, detection.query, voiceChannel);
          default:
            return await youtubeHandler.handleYouTubeSingle(client, interaction, detection.query, voiceChannel);
        }
        
      case 'spotify':
        if (config.debug) console.log(`[PlatformDetector] Chuyển đến Spotify handler với type:`, detection.type);
        const spotifyHandler = require('./spotify');
        switch (detection.type) {
          case 'playlist':
          case 'album':
            return await spotifyHandler.handleSpotifyPlaylist(client, interaction, detection.query, voiceChannel, lockKey, detection.type === 'album' ? 'Album' : 'Playlist');
          case 'single':
            return await spotifyHandler.handleSpotifySingle(client, interaction, detection.query, voiceChannel);
          default:
            return await spotifyHandler.handleSpotifySingle(client, interaction, detection.query, voiceChannel);
        }
        
      case 'soundcloud':
        if (config.debug) console.log(`[PlatformDetector] Chuyển đến SoundCloud handler với type:`, detection.type);
        const soundcloudHandler = require('./soundcloud');
        switch (detection.type) {
          case 'playlist':
            return await soundcloudHandler.handleSoundCloudPlaylist(client, interaction, detection.query, voiceChannel, lockKey);
          case 'single':
            return await soundcloudHandler.handleSoundCloudSingle(client, interaction, detection.query, voiceChannel);
          default:
            return await soundcloudHandler.handleSoundCloudSingle(client, interaction, detection.query, voiceChannel);
        }
        
      default:
        if (config.debug) console.log(`[PlatformDetector] Fallback về YouTube search`);
        // Fallback to YouTube search
        return await handleYouTubeSearch(client, interaction, detection.query, voiceChannel);
    }
  } catch (error) {
    if(config.debug) console.error(`[PlatformDetector] Lỗi trong routeToPlatform:`, {
      message: error.message,
      name: error.name,
      stack: error.stack,
      query: query,
      guild: interaction.guild?.name,
      channel: interaction.channel?.name,
      user: interaction.user?.tag
    });
    throw error;
  }
}

// Xử lý tìm kiếm YouTube (từ khóa)
async function handleYouTubeSearch(client, interaction, query, voiceChannel) {
  // Validation: Kiểm tra xem search YouTube có được bật không (search = single)
  if (!isPlatformFeatureEnabled('youtube', 'single')) {
    const errorMessage = createFeatureDisabledMessage('youtube', 'search');
    return await interaction.followUp({
      content: errorMessage,
      ephemeral: true
    });
  }
  
  const ytSearch = require('yt-search');
  const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
  
  const searchResult = await ytSearch(query);
  const videos = searchResult.videos.slice(0, 10);
  if (!videos.length) {
    return interaction.followUp({ content: '❌ Không tìm thấy kết quả nào!', ephemeral: true });
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
}

module.exports = {
  detectPlatform,
  routeToPlatform,
  handleYouTubeSearch,
  isPlatformFeatureEnabled,
  getPlatformDisplayName,
  getTypeDisplayName,
  createFeatureDisabledMessage
}; 