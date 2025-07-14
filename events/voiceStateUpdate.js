const hotReloader = require('../utils/hotReload');
const autoLeaveManager = require('../utils/autoLeaveManager');
const logger = require('../utils/logger');

// Lưu trữ ID timeout cho mỗi máy chủ
const leaveTimeouts = new Map();

module.exports = (client) => {
  client.on('voiceStateUpdate', (oldState, newState) => {
    const config = hotReloader.getCurrentConfig();
    
    // Bỏ qua nếu tự rời khi phòng trống bị tắt
    if (!config.leaveOnEmpty?.empty?.enabled) {
      if (config.debug) {
      if (config.debug) {
        logger.autoLeave(`[AutoLeave] Tự rời bị tắt trong cấu hình`);
      }
      }
      return;
    }

    const guild = oldState.guild || newState.guild;
    
    // Nếu bot được đánh dấu đã rời cố ý, ngăn mọi nỗ lực kết nối lại
    if (autoLeaveManager.isGuildBlocked(guild.id)) {
      // Chỉ xóa cờ nếu người dùng thật tham gia kênh thoại
      if (newState.channelId && !newState.member?.user.bot) {
        const botVoiceChannel = guild.members.cache.get(client.user.id)?.voice?.channel;
        if (!botVoiceChannel) {
          autoLeaveManager.unblockGuild(guild.id);
        }
      }
      return; // Bỏ qua xử lý khi việc kết nối lại bị ngăn
    }
    
    // Bỏ qua nếu đây là bot chính nó thay đổi trạng thái thoại (để ngăn vòng lặp)
    if (oldState.member?.id === client.user.id || newState.member?.id === client.user.id) {
      // Không ghi log để giảm spam, chỉ bỏ qua
      return;
    }
    
    const botVoiceChannel = guild.members.cache.get(client.user.id)?.voice?.channel;
    
    // Nếu bot không ở trong kênh thoại nào, bỏ qua
    if (!botVoiceChannel) {
      if (config.debug && (oldState.member?.user.bot === false || newState.member?.user.bot === false)) {
        console.log(`[AutoLeave] Bot không trong kênh thoại nào, bỏ qua`);
      }
      return;
    }

    // Chỉ tiến hành nếu cập nhật trạng thái thoại ảnh hưởng đến kênh thoại của bot
    const isRelevantUpdate = oldState.channelId === botVoiceChannel.id || 
                            newState.channelId === botVoiceChannel.id;
    
    if (!isRelevantUpdate) {
      return;
    }

    // Đếm người dùng thật (không phải bot) trong kênh thoại
    const realUsers = botVoiceChannel.members.filter(member => !member.user.bot);
    
    if (config.debug) {
      const userName = oldState.member?.displayName || newState.member?.displayName || 'Không xác định';
      const userIsBot = oldState.member?.user.bot || newState.member?.user.bot;
      const action = oldState.channelId && !newState.channelId ? 'rời' :
                    !oldState.channelId && newState.channelId ? 'tham gia' : 'di chuyển';
      
      if (config.debug) {
        console.log(`[AutoLeave] Người dùng ${userName} (bot: ${userIsBot}) ${action} kênh thoại: ${botVoiceChannel.name}`);
        console.log(`[AutoLeave] Thành viên kênh:`, botVoiceChannel.members.map(m => `${m.displayName} (bot: ${m.user.bot})`).join(', '));
        console.log(`[AutoLeave] Người dùng thật còn lại: ${realUsers.size}`);
      }
    }

    // Nếu vẫn còn người dùng thật, xóa timeout hiện có
    if (realUsers.size > 0) {
      if (leaveTimeouts.has(guild.id)) {
        clearTimeout(leaveTimeouts.get(guild.id));
        leaveTimeouts.delete(guild.id);
        if (config.debug) {
          console.log(`[Tự Rời] Đã hủy hẹn giờ rời phòng cho máy chủ ${guild.name} - có người dùng trở lại`);
        }
      }
      
      // Tự động tiếp tục nếu nhạc bị tạm dừng do kênh trống
      if (config.leaveOnEmpty.empty.pauseOnEmpty) {
        const queue = client.distube.getQueue(guild.id);
        if (queue && queue.paused) {
          try {
            client.distube.resume(guild.id);
            if (config.debug) console.log(`[Tự Rời] ▶️ Đã tiếp tục phát nhạc trong ${guild.name} - có người dùng quay lại`);
          } catch (error) {
            if (config.debug) {
              console.error(`[Tự Rời] Lỗi khi tiếp tục nhạc:`, error.message);
            }
          }
        }
      }
      return;
    }

    // Nếu không có người dùng thật và chưa đặt timeout, bắt đầu đếm ngược
    if (!leaveTimeouts.has(guild.id)) {
      const timeout = config.leaveOnEmpty.empty.timeout || 30; // Mặc định 30 giây
      
      if (config.debug) console.log(`[Tự Rời] 🔄 Phòng thoại trống, bot sẽ rời sau ${timeout} giây...`);
      
      const timeoutId = setTimeout(async () => {
        try {
          // Kiểm tra lại kênh có vẫn trống không
          const currentBotChannel = guild.members.cache.get(client.user.id)?.voice?.channel;
          if (currentBotChannel) {
            const currentRealUsers = currentBotChannel.members.filter(member => !member.user.bot);
            
            if (currentRealUsers.size === 0) {
              const queue = client.distube.getQueue(guild.id);
              
              if (queue) {
                if (config.leaveOnEmpty.empty.pauseOnEmpty) {
                  // Tạm dừng nhạc thay vì dừng
                  if (!queue.paused) {
                    try {
                      client.distube.pause(guild.id);
                      if (config.debug) console.log(`[Tự Rời] ⏸️ Bot đã tạm dừng nhạc trong ${guild.name} - phòng thoại trống`);
                    } catch (e) {
                      console.error(`[Tự Rời] ❌ Lỗi khi tạm dừng nhạc:`, e.message);
                    }
                  }
                } else {
                  // Dừng nhạc và rời
                  try {
                    // Đặt cờ để ngăn kết nối lại TRƯỚC khi dừng
                    autoLeaveManager.blockGuild(guild.id);
                    
                    // Trước tiên dừng nhạc hoàn toàn
                    await client.distube.stop(guild.id);
                    if (config.debug) console.log(`[Tự Rời] 🎵 Bot đã dừng nhạc trong ${guild.name}`);
                    
                    // Xóa mọi thao tác DisTube đang chờ
                    const queue = client.distube.getQueue(guild.id);
                    if (queue) {
                      try {
                        queue.destroy();
                        if (config.debug) console.log(`[Tự Rời] 🗑️ Đã hủy hàng đợi trong ${guild.name}`);
                      } catch (destroyError) {
                        if (config.debug) console.log(`[Tự Rời] Hàng đợi đã được hủy hoặc lỗi:`, destroyError.message);
                      }
                    }
                    
                    // Ép buộc ngắt kết nối và hủy kết nối thoại
                    const voiceConnection = guild.members.me.voice;
                    if (voiceConnection && voiceConnection.channel) {
                      try {
                        // Hủy kết nối thoại hoàn toàn
                        await voiceConnection.disconnect();
                        if (config.debug) console.log(`[Tự Rời] 🚪 Bot đã ngắt kết nối khỏi kênh thoại trong ${guild.name}`);
                        
                        // Dọn dẹp bổ sung - hủy mọi kết nối thoại còn lại
                        const connection = guild.client.voice?.connections?.get(guild.id);
                        if (connection) {
                          connection.destroy();
                          if (config.debug) console.log(`[Tự Rời] 🔥 Đã hủy kết nối thoại trong ${guild.name}`);
                        }
                      } catch (disconnectError) {
                        console.error(`[Tự Rời] ❌ Lỗi khi ngắt kết nối:`, disconnectError.message);
                      }
                    }
                    
                    // An toàn bổ sung: Thử rời bằng DisTube voices
                    try {
                      await client.distube.voices.leave(guild.id);
                      if (config.debug) console.log(`[Tự Rời] 🚨 DisTube voices rời dự phòng trong ${guild.name}`);
                    } catch (disTubeLeaveError) {
                      if (config.debug) console.log(`[Tự Rời] DisTube voices rời thất bại:`, disTubeLeaveError.message);
                    }
                    
                  } catch (e) {
                    console.error(`[Tự Rời] ❌ Lỗi khi dừng nhạc:`, e.message);
                    // Ngay cả khi dừng thất bại, vẫn cố ngắt kết nối ép buộc
                    try {
                      autoLeaveManager.blockGuild(guild.id);
                      const voiceConnection = guild.members.me.voice;
                      if (voiceConnection) {
                        await voiceConnection.disconnect();
                        if (config.debug) console.log(`[Tự Rời] 🚪 Bot đã ngắt kết nối (dự phòng) khỏi kênh thoại trong ${guild.name}`);
                      }
                      // Ép buộc hủy kết nối
                      const connection = guild.client.voice?.connections?.get(guild.id);
                      if (connection) {
                        connection.destroy();
                        if (config.debug) console.log(`[Tự Rời] 🔥 Đã ép buộc hủy kết nối thoại trong ${guild.name}`);
                      }
                    } catch (fallbackError) {
                      console.error(`[Tự Rời] ❌ Lỗi ngắt kết nối dự phòng:`, fallbackError.message);
                    }
                  }
                }
              } else {
                // Chỉ rời kênh thoại nếu không có hàng đợi
                try {
                  autoLeaveManager.blockGuild(guild.id);
                  await guild.members.me.voice.disconnect();
                  if (config.debug) console.log(`[Tự Rời] 🚪 Bot đã ngắt kết nối khỏi phòng thoại trong ${guild.name} - không có nhạc đang phát`);
                } catch (e) {
                  console.error(`[Tự Rời] ❌ Lỗi khi ngắt kết nối thoại:`, e.message);
                }
              }
            } else {
              if (config.debug) {
                console.log(`[Tự Rời] Đã có người dùng trở lại, không rời phòng`);
              }
            }
          }
        } catch (error) {
          console.error(`[Tự Rời] ❌ Lỗi khi xử lý tự rời:`, error.message);
        } finally {
          leaveTimeouts.delete(guild.id);
        }
      }, timeout * 1000);

      leaveTimeouts.set(guild.id, timeoutId);
    }
  });

  // Dọn dẹp timeout khi bot rời server
  client.on('guildDelete', (guild) => {
    if (leaveTimeouts.has(guild.id)) {
      clearTimeout(leaveTimeouts.get(guild.id));
      leaveTimeouts.delete(guild.id);
    }
    autoLeaveManager.cleanupGuild(guild.id);
  });
};
