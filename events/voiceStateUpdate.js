const hotReloader = require('../utils/hotReload');

// Store timeout IDs for each guild
const leaveTimeouts = new Map();

module.exports = (client) => {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const config = hotReloader.getCurrentConfig();
    
    // Skip if auto leave on empty room is disabled
    if (!config.leaveOnEmpty?.empty?.enabled) {
      return;
    }

    const guild = oldState.guild || newState.guild;
    const botVoiceChannel = guild.members.cache.get(client.user.id)?.voice?.channel;
    
    // If bot is not in any voice channel, skip
    if (!botVoiceChannel) {
      return;
    }

    // Count real users (not bots) in the voice channel
    const realUsers = botVoiceChannel.members.filter(member => !member.user.bot);
    
    if (config.debug) {
      console.log(`[AutoLeave] Voice channel: ${botVoiceChannel.name}, Real users: ${realUsers.size}`);
    }

    // If there are still real users, clear any existing timeout
    if (realUsers.size > 0) {
      if (leaveTimeouts.has(guild.id)) {
        clearTimeout(leaveTimeouts.get(guild.id));
        leaveTimeouts.delete(guild.id);
        if (config.debug) {
          console.log(`[AutoLeave] Đã hủy timer rời phòng cho guild ${guild.name} - có người dùng trở lại`);
        }
      }
      
      // Auto resume if music was paused due to empty channel
      if (config.leaveOnEmpty.empty.pauseOnEmpty) {
        const queue = client.distube.getQueue(guild.id);
        if (queue && queue.paused) {
          try {
            client.distube.resume(guild.id);
            if (config.debug) console.log(`[AutoLeave] ▶️ Đã tiếp tục phát nhạc trong ${guild.name} - có người dùng quay lại`);
          } catch (error) {
            if (config.debug) {
              console.error(`[AutoLeave] Lỗi khi resume nhạc:`, error.message);
            }
          }
        }
      }
      return;
    }

    // If no real users and no timeout is set, start countdown
    if (!leaveTimeouts.has(guild.id)) {
      const timeout = config.leaveOnEmpty.empty.timeout || 30; // Default 30 seconds
      
      if (config.debug) console.log(`[AutoLeave] 🔄 Phòng voice trống, bot sẽ rời sau ${timeout} giây...`);
      
      const timeoutId = setTimeout(async () => {
        try {
          // Double check if channel is still empty
          const currentBotChannel = guild.members.cache.get(client.user.id)?.voice?.channel;
          if (currentBotChannel) {
            const currentRealUsers = currentBotChannel.members.filter(member => !member.user.bot);
            
            if (currentRealUsers.size === 0) {
              // Check if should pause or stop
              const queue = client.distube.getQueue(guild.id);
              if (queue) {
                if (config.leaveOnEmpty.empty.pauseOnEmpty) {
                  // Pause music and stay in channel
                  if (!queue.paused) {
                    await client.distube.pause(guild.id);
                     if (config.debug) console.log(`[AutoLeave] ⏸️ Bot đã tạm dừng nhạc trong ${guild.name} - không có người dùng`);
                  }
                } else {
                  // Stop music and leave channel
                  await client.distube.stop(guild.id);
                  if (config.debug) console.log(`[AutoLeave] 🚪 Bot đã rời khỏi phòng voice trong ${guild.name} - không có người dùng`);
                }
              } else {
                // Just leave voice channel if no queue
                if (currentBotChannel) {
                  currentBotChannel.leave();
                  if (config.debug) console.log(`[AutoLeave] 🚪 Bot đã rời khỏi phòng voice trong ${guild.name} - không có nhạc đang phát`);
                }
              }
            } else {
              if (config.debug) {
                if (config.debug) console.log(`[AutoLeave] Đã có người dùng trở lại, không rời phòng`);
              }
            }
          }
        } catch (error) {
          console.error(`[AutoLeave] ❌ Lỗi khi rời phòng voice:`, error.message);
        } finally {
          leaveTimeouts.delete(guild.id);
        }
      }, timeout * 1000);

      leaveTimeouts.set(guild.id, timeoutId);
    }
  });

  // Clean up timeouts when bot leaves server
  client.on('guildDelete', (guild) => {
    if (leaveTimeouts.has(guild.id)) {
      clearTimeout(leaveTimeouts.get(guild.id));
      leaveTimeouts.delete(guild.id);
    }
  });
};
