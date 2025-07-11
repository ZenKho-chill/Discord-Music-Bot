const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tieptuc')
    .setDescription('Tiếp tục phát bài hát đã tạm dừng'),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);

    // Kiểm tra xem có bài hát trong queue không
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({ 
        content: '❌ Không có bài hát nào trong hàng đợi để tiếp tục!', 
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
      if (!queue.paused) {
        return interaction.reply({
          content: '▶️ Bài hát đang phát rồi!',
          ephemeral: true
        });
      }

      // Tiếp tục phát nhạc
      client.distube.resume(guildId);
      
      await interaction.reply({
        content: '▶️ **Đã tiếp tục phát nhạc!**\n\nSử dụng lệnh `/tamdung` để tạm dừng lại.',
        ephemeral: true
      });

    } catch (error) {
      console.error('[resume.js] Lỗi khi tiếp tục nhạc:', error);
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi tiếp tục phát nhạc!',
        ephemeral: true
      });
    }
  }
};
