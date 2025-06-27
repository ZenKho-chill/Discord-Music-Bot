const { StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

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
        let queue;
        try {
          queue = client.distube.getQueue(voiceChannel);
          if (queue && queue.filters && typeof queue.filters.clear === 'function') {
            queue.filters.clear();
          }
        } catch (e) {}
        await client.distube.play(voiceChannel, url, {
          textChannel: interaction.channel,
          member: interaction.member
        });
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

        // Gửi ảnh nowplaying giống play.js
        // Đợi queue cập nhật bài mới
        await new Promise(r => setTimeout(r, 1000));
        const updatedQueue = client.distube.getQueue(voiceChannel);
        if (updatedQueue && updatedQueue.songs && updatedQueue.songs.length > 0) {
          // Lấy bài vừa thêm (cuối queue)
          let song = updatedQueue.songs[updatedQueue.songs.length - 1];
          let currentIndex = updatedQueue.songs.length;
          const { createCanvas, loadImage } = require('canvas');
          const { AttachmentBuilder } = require('discord.js');
          const StackBlur = require('stackblur-canvas');
          const width = 750, height = 200;
          const canvas = createCanvas(width, height);
          const ctx = canvas.getContext('2d');
          // Nền mờ từ ảnh nhạc
          let img;
          let thumbUrl = song.thumbnail;
          if (song.url && song.url.includes('youtube.com')) {
            const match = song.url.match(/v=([\w-]+)/);
            if (match && match[1]) {
              const videoId = match[1];
              const resolutions = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'];
              let foundImage = false;
              for (const res of resolutions) {
                try {
                  thumbUrl = `https://img.youtube.com/vi/${videoId}/${res}.jpg`;
                  img = await loadImage(thumbUrl);
                  foundImage = true;
                  break;
                } catch (e) { continue; }
              }
              if (!foundImage) {
                img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
              }
            }
          }
          if (!img) {
            try {
              if (!thumbUrl || !/^https?:\/\//.test(thumbUrl)) throw new Error('Invalid thumbnail');
              img = await loadImage(thumbUrl);
            } catch (e) {
              img = await loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
            }
          }
          // Vẽ ảnh nền
          const bgRatio = width / height;
          const imgRatio = img.width / img.height;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
          if (imgRatio > bgRatio) {
            sWidth = img.height * bgRatio;
            sx = (img.width - sWidth) / 2;
          } else {
            sHeight = img.width / bgRatio;
            sy = (img.height - sHeight) / 2;
          }
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
          StackBlur.canvasRGBA(ctx.canvas, 0, 0, width, height, 10);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(0, 0, width, height);
          // Thumbnail bo góc
          const thumbSize = 160;
          const thumbX = 20;
          const thumbY = 20;
          const cornerRadius = 28;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(thumbX + cornerRadius, thumbY);
          ctx.arcTo(thumbX + thumbSize, thumbY, thumbX + thumbSize, thumbY + thumbSize, cornerRadius);
          ctx.arcTo(thumbX + thumbSize, thumbY + thumbSize, thumbX, thumbY + thumbSize, cornerRadius);
          ctx.arcTo(thumbX, thumbY + thumbSize, thumbX, thumbY, cornerRadius);
          ctx.arcTo(thumbX, thumbY, thumbX + thumbSize, thumbY, cornerRadius);
          ctx.closePath();
          ctx.clip();
          const thumbImgRatio = img.width / img.height;
          let thumbSx = 0, thumbSy = 0, thumbSWidth = img.width, thumbSHeight = img.height;
          if (thumbImgRatio > 1) {
            thumbSWidth = img.height;
            thumbSx = (img.width - thumbSWidth) / 2;
          } else {
            thumbSHeight = img.width;
            thumbSy = (img.height - thumbSHeight) / 2;
          }
          ctx.drawImage(img, thumbSx, thumbSy, thumbSWidth, thumbSHeight, thumbX, thumbY, thumbSize, thumbSize);
          ctx.restore();
          const textX = thumbX + thumbSize + 30;
          ctx.font = 'bold 32px Arial';
          ctx.fillStyle = '#fff';
          ctx.fillText(song.name, textX, 65, width - textX - 100);
          ctx.font = '24px Arial';
          ctx.fillStyle = '#ccc';
          ctx.fillText('Tác giả: ' + (song.uploader?.name || song.artist || ''), textX, 120, width - textX - 100);
          const circleRadius = 26;
          const circleX = width - 60;
          const circleY = height / 2;
          ctx.save();
          ctx.beginPath();
          ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 224, 189, 0.85)';
          ctx.fill();
          ctx.font = 'bold 26px Arial';
          ctx.fillStyle = '#111';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${currentIndex}`, circleX, circleY);
          ctx.restore();
          ctx.textAlign = 'left';
          ctx.font = '18px Arial';
          ctx.fillStyle = '#fff';
          ctx.fillText('Thời lượng: ' + (song.formattedDuration || song.duration || ''), textX, 170);
          const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'nowplaying.png' });
          await interaction.channel.send({ files: [attachment] });
          // Xóa tin nhắn có bảng chọn nếu còn tồn tại
          try {
            const msgToDelete = await interaction.fetchReply();
            if (msgToDelete && msgToDelete.delete) {
              await msgToDelete.delete();
            }
          } catch (e) {}
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
    console.error(err);
    await interaction.reply({ content: '❌ Có lỗi xảy ra!', ephemeral: true });
  }
};