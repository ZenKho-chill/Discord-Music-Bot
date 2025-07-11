const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('laplai')
    .setDescription('Chế độ lặp lại phát nhạc')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Chọn chế độ lặp lại')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    try {
      const guildId = interaction.guildId;
      const queue = interaction.client.distube.getQueue(guildId);
      
      // Tạo danh sách choices dựa trên queue
      const choices = [
        { name: '❌ Tắt lặp lại', value: 'off' },
        { name: '🔂 Lặp bài hiện tại', value: 'song' }
      ];
      
      // Nếu queue có nhiều hơn 2 bài thì thêm option lặp toàn bộ
      if (queue && queue.songs && queue.songs.length > 2) {
        choices.push({ name: '🔁 Lặp toàn bộ hàng đợi', value: 'queue' });
      }
      
      const focusedValue = interaction.options.getFocused();
      const filtered = choices.filter(choice => 
        choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
        choice.value.includes(focusedValue)
      );

      await interaction.respond(
        filtered.map(choice => ({
          name: choice.name,
          value: choice.value
        }))
      );
    } catch (error) {
      console.error('[repeat.js] Lỗi trong autocomplete:', error);
      // Fallback cho autocomplete
      await interaction.respond([
        { name: '❌ Tắt lặp lại', value: 'off' },
        { name: '🔂 Lặp bài hiện tại', value: 'song' }
      ]);
    }
  },

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);
    const mode = interaction.options.getString('mode');

    // Kiểm tra xem có bài hát trong queue không
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({ 
        content: '❌ Không có bài hát nào đang phát để thiết lập chế độ lặp lại!', 
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

    // Kiểm tra giá trị mode hợp lệ
    const validModes = ['off', 'song', 'queue'];
    if (!validModes.includes(mode)) {
      return interaction.reply({
        content: '❌ Chế độ lặp lại không hợp lệ! Vui lòng chọn từ danh sách.',
        ephemeral: true
      });
    }

    // Kiểm tra nếu chọn queue mode nhưng không đủ bài hát
    if (mode === 'queue' && queue.songs.length <= 2) {
      return interaction.reply({
        content: '❌ Cần có ít nhất 3 bài hát trong hàng đợi để lặp toàn bộ!',
        ephemeral: true
      });
    }

    try {
      let repeatMode;
      let emoji;
      let description;
      
      // Chuyển đổi mode thành DisTube repeat mode
      switch (mode) {
        case 'off':
          repeatMode = 0; // RepeatMode.DISABLED
          emoji = '❌';
          description = 'Đã tắt chế độ lặp lại';
          break;
        case 'song':
          repeatMode = 1; // RepeatMode.SONG
          emoji = '🔂';
          description = 'Lặp lại bài hát hiện tại';
          break;
        case 'queue':
          repeatMode = 2; // RepeatMode.QUEUE
          emoji = '🔁';
          description = 'Lặp lại toàn bộ hàng đợi';
          break;
      }
      
      // Thiết lập chế độ lặp lại
      client.distube.setRepeatMode(guildId, repeatMode);
      
      // Tạo thông tin bổ sung
      let additionalInfo = '';
      if (mode === 'song') {
        additionalInfo = `\n🎶 **Bài hát:** ${queue.songs[0].name}`;
      } else if (mode === 'queue') {
        additionalInfo = `\n📊 **Hàng đợi:** ${queue.songs.length} bài hát`;
      }
      
      await interaction.reply({
        content: `${emoji} **${description}**${additionalInfo}\n\n👤 **Thiết lập bởi:** ${interaction.user}\n\n💡 *Sử dụng \`/laplai\` để thay đổi chế độ lặp lại.*\n\n📝 **Lưu ý:** ${mode === 'song' ? 'Khi lặp 1 bài, bài hát sẽ biến mất khỏi hàng đợi nhưng vẫn tiếp tục phát.' : ''}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('[repeat.js] Lỗi khi thiết lập chế độ lặp lại:', error);
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi thiết lập chế độ lặp lại!',
        ephemeral: true
      });
    }
  }
};
