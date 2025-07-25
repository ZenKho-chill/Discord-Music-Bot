const { SlashCommandBuilder } = require('discord.js');
const config = require('../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('amluong')
    .setDescription('Điều chỉnh âm lượng phát nhạc')
    .addIntegerOption(option =>
      option.setName('volume')
        .setDescription(`Mức âm lượng (0-${config.maxVolume})`)
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(config.maxVolume)
    ),

  async execute(client, interaction) {
    const guildId = interaction.guildId;
    const queue = client.distube.getQueue(guildId);
    const volumeValue = interaction.options.getInteger('volume');

    // Kiểm tra xem có bài hát trong queue không
    if (!queue || !queue.songs || !queue.songs[0]) {
      return interaction.reply({
        content: '❌ Không có bài hát nào đang phát để điều chỉnh âm lượng!',
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
      // Lưu âm lượng cũ
      const oldVolume = queue.volume;

      // Điều chỉnh âm lượng
      client.distube.setVolume(guildId, volumeValue);

      // Lưu/cập nhật volume cá nhân vào database
      try {
        const ServerService = require('../database/services/ServerService');
        // Ghi log debug
        if (config.debug) console.log(`[volume.js] Đang lưu volume cá nhân cho userId: ${interaction.user.id}, guildId: ${guildId}, volume: ${volumeValue}`);
        await ServerService.luuHoacCapNhatVolumeUser(guildId, interaction.user.id, volumeValue);
        if (config.debug) console.log(`[volume.js] Đã lưu volume cá nhân thành công!`);
      } catch (err) {
        console.error('[volume.js] Lỗi khi lưu/cập nhật volume cá nhân:', err);
      }

      // Tạo emoji tương ứng với âm lượng
      let volumeEmoji = '🔇';
      if (volumeValue === 0) volumeEmoji = '🔇';
      else if (volumeValue <= 25) volumeEmoji = '🔈';
      else if (volumeValue <= 50) volumeEmoji = '🔉';
      else if (volumeValue <= 75) volumeEmoji = '🔊';
      else volumeEmoji = '📢';

      // Tạo thanh âm lượng visual
      const barLength = 10;
      const filledBars = Math.round((volumeValue / config.maxVolume) * barLength);
      const emptyBars = barLength - filledBars;
      const volumeBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      await interaction.reply({
        content: `${volumeEmoji} **Đã điều chỉnh âm lượng thành ${volumeValue}%**\n\n📊 **Âm lượng:** \`${volumeBar}\` ${volumeValue}%\n📈 **Thay đổi:** ${oldVolume}% → ${volumeValue}%\n\n🎶 **Đang phát:** ${queue.songs[0].name}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('[volume.js] Lỗi khi điều chỉnh âm lượng:', error);
      await interaction.reply({
        content: '❌ Có lỗi xảy ra khi điều chỉnh âm lượng!',
        ephemeral: true
      });
    }
  }
};
