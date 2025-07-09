const { resolveSoundCloudShortlink } = require('./soundcloud');
const config = require('../../config/config');

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
  if (config.debug) {
    console.log(`[PlatformDetector] Bắt đầu route platform cho query:`, query);
    console.log(`[PlatformDetector] Voice Channel:`, voiceChannel?.name, voiceChannel?.id);
    console.log(`[PlatformDetector] Guild:`, interaction.guild?.name, interaction.guild?.id);
  }
  
  try {
    const detection = await detectPlatform(query);
    if (config.debug) console.log(`[PlatformDetector] Kết quả detection:`, detection);
    
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
  handleYouTubeSearch
}; 