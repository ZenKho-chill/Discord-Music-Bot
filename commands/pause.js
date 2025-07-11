const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tamdung')
    .setDescription('Tạm dừng bài hát đang phát'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);

    // Kiểm tra xem có bài hát đang phát không
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({ 
        content: '❌ Không có bài hát nào đang phát để tạm dừng!', 
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
      // Kiểm tra trạng thái hiện tại của nhạc
      if (queue.paused) {
        return interaction.reply({
          content: '⏸️ Bài hát đã được tạm dừng rồi!',
          ephemeral: true
        });
      }

      // Tạm dừng nhạc
      client.distube.pause(guildId);
      
      await interaction.reply({
        content: '⏸️ **Đã tạm dừng bài hát!**\n\nSử dụng lệnh `/tieptuc` để tiếp tục phát nhạc.',
        ephemeral: true
      });

    } catch (error) {
      console.error('[pause.js] Lỗi khi tạm dừng nhạc:', error);
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi tạm dừng bài hát!',
        ephemeral: true
      });
    }
  }
};
