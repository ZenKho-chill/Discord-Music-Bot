const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { routeToPlatform } = require('../commands/platforms/platformDetector');

module.exports = async(client, interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && typeof command.autocomplete === 'function') {
      await command.autocomplete(interaction);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'play_select') {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: '🔇 Vào voice channel trước đã!', ephemeral: true });
      }
      if (!client._addLock) client._addLock = {};
      const lockKey = `${interaction.guildId}`;
      if (client._addLock[lockKey]) {
        return interaction.reply({ content: '🚫 Đang thêm playlist/mix vào hàng đợi, vui lòng chờ hoàn thành trước khi thêm bài mới!', ephemeral: true });
      }
      const url = interaction.values[0];
      try {
        await interaction.deferUpdate();
        
        // Sử dụng hệ thống platform mới
        await routeToPlatform(client, interaction, url, voiceChannel, lockKey);
        
        // Disable select menu sau khi chọn
        const oldMsg = await interaction.fetchReply();
        if (oldMsg && oldMsg.components && oldMsg.components.length > 0) {
          const oldRow = oldMsg.components[0];
          const oldMenu = oldRow.components[0];
          // Tạo lại select menu builder từ dữ liệu cũ
          const disabledMenu = StringSelectMenuBuilder.from(oldMenu).setDisabled(true);
          const newRow = new ActionRowBuilder().addComponents(disabledMenu);
          await interaction.editReply({ content: `🎶 Đang phát: <${url}>`, components: [newRow] });
        } else {
          await interaction.editReply({ content: `🎶 Đang phát: <${url}>`, components: [] });
        }

      } catch (err) {
        console.error('PlayError:', err);
        try {
          await interaction.editReply({ content: `❌ Không thể phát bài hát!\n\n${err.message || err}`, components: [] });
        } catch (e) {
          await interaction.followUp({ content: `❌ Không thể phát bài hát!\n\n${err.message || err}`, ephemeral: true });
        }
      }
      return;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'stop_add') {
      const lockKey = `${interaction.guildId}`;
      if (interaction.client._addInfo && interaction.client._addInfo[lockKey]) {
        const addInfo = interaction.client._addInfo[lockKey];
        // Đánh dấu dừng
        addInfo.shouldStop = true;
        // Lưu ephemeralMsgId để xóa sau này
        try {
          const ephemeralMsg = await interaction.reply({ content: addInfo.type === 'mix' ? '⏸️ Đang dừng quá trình thêm bài...' : '⏸️ Đang dừng quá trình thêm playlist...', ephemeral: true });
          if (ephemeralMsg && ephemeralMsg.id) addInfo.ephemeralMsgId = ephemeralMsg.id;
        } catch {}
        // KHÔNG xóa progressMsg ở đây nữa, để vòng lặp trong play.js xử lý
      }
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(client, interaction);
  } catch (err) {
    console.error('[interactionCreate.js] Lỗi khi execute command:', err);
    try {
      if (config.debug) console.log('[interactionCreate.js] Trạng thái interaction trước khi reply lỗi:', {
        replied: interaction.replied,
        deferred: interaction.deferred,
        id: interaction.id,
        command: interaction.commandName
      });
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: '❌ Có lỗi xảy ra!', ephemeral: true });
        if (config.debug) console.log('[interactionCreate.js] Đã followUp lỗi thành công cho interaction:', interaction.id);
      } else {
        await interaction.reply({ content: '❌ Có lỗi xảy ra!', ephemeral: true });
        if (config.debug) console.log('[interactionCreate.js] Đã reply lỗi thành công cho interaction:', interaction.id);
      }
    } catch (e) {
      console.error('[interactionCreate.js] Lỗi khi reply/followUp lỗi:', e);
    }
  }
};