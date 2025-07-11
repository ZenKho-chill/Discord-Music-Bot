const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/queueManager');
const config = require('../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dungnhac')
    .setDescription('Dừng phát nhạc và xóa toàn bộ hàng đợi'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);

    // Kiểm tra xem có bài hát trong queue không
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({ 
        content: '❌ Không có bài hát nào đang phát để dừng!', 
        ephemeral: true 
      });
    }

    // Kiểm tra xem người dùng có trong kênh thoại không
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: '🔇 Bạn cần vào kênh thoại để sử dụng lệnh này!',
        ephemeral: true
      });
    }

    // Kiểm tra xem bot có trong cùng kênh thoại không
    const botVoiceChannel = interaction.guild.members.me.voice.channel;
    if (botVoiceChannel && voiceChannel.id !== botVoiceChannel.id) {
      return interaction.reply({
        content: '❌ Bạn phải ở cùng kênh thoại với bot để sử dụng lệnh này!',
        ephemeral: true
      });
    }

    try {
      // Lưu số lượng bài hát trước khi dừng
      const songCount = queue.songs.length;
      
      // Dừng nhạc và xóa hàng đợi
      client.distube.stop(guildId);
      
      // Xóa hàng đợi trong queueManager
      queueManager.clearQueue(guildId);
      
      // Logic leave on stop - Rời voice channel sau khi dừng (điều khiển bởi config)
      let leftChannel = false;
      if (config.leaveOnStop && config.leaveOnStop.enabled) {
        try {
          const botVoiceChannel = interaction.guild.members.me.voice.channel;
          if (botVoiceChannel) {
            // Áp dụng timeout nếu có cấu hình
            const leaveTimeout = config.leaveOnStop.timeout || 0;
            
            if (leaveTimeout > 0) {
              setTimeout(async () => {
                try {
                  // Sử dụng DisTube voices để rời khỏi voice channel
                  if (client.distube.voices && client.distube.voices.leave) {
                    await client.distube.voices.leave(guildId);
                  } else {
                    // Fallback: Disconnect trực tiếp
                    const currentBotChannel = interaction.guild.members.me.voice.channel;
                    if (currentBotChannel) {
                      await currentBotChannel.leave();
                    }
                  }
                } catch (delayedLeaveError) {
                  console.error('[stop.js] Lỗi khi rời voice channel (delayed):', delayedLeaveError);
                }
              }, leaveTimeout * 1000);
              leftChannel = true; // Will leave after timeout
            } else {
              // Rời ngay lập tức
              if (client.distube.voices && client.distube.voices.leave) {
                await client.distube.voices.leave(guildId);
              } else {
                // Fallback: Disconnect trực tiếp
                await botVoiceChannel.leave();
              }
              leftChannel = true;
            }
          }
        } catch (leaveError) {
          console.error('[stop.js] Lỗi khi rời voice channel:', leaveError);
          // Không throw error, vì việc dừng nhạc đã thành công
        }
      }
      
      // Tạo thông báo dựa trên cấu hình
      let replyContent = `⏹️ **Đã dừng phát nhạc!**\n\n🗑️ Đã xóa **${songCount}** bài hát khỏi hàng đợi.`;
      
      if (config.leaveOnStop && config.leaveOnStop.enabled) {
        if (config.leaveOnStop.timeout > 0) {
          replyContent += `\n👋 Bot sẽ rời khỏi kênh thoại sau **${config.leaveOnStop.timeout} giây**.`;
        } else if (leftChannel) {
          replyContent += `\n👋 Bot đã rời khỏi kênh thoại.`;
        }
      }
      
      replyContent += `\n\nSử dụng lệnh \`/phatnhac\` để phát nhạc mới.`;
      
      await interaction.reply({
        content: replyContent,
        ephemeral: true
      });

    } catch (error) {
      console.error('[stop.js] Lỗi khi dừng nhạc:', error);
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi dừng nhạc!',
        ephemeral: true
      });
    }
  }
};
