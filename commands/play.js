/*
 * This file is part of Discord Music Bot.
 *
 * Discord Music Bot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Discord Music Bot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Discord Music Bot.  If not, see <https://www.gnu.org/licenses/>.
 */

const { ApplicationCommandOptionType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../mongoDB');

let selectedThumbnailURL;

module.exports = {
  name: 'play',
  description: 'Cùng nghe một chút nhạc nào!',
  permissions: '0x0000000000000800',
  options: [{
    name: 'name',
    description: 'Nhập tên bài hát bạn muốn phát',
    type: ApplicationCommandOptionType.String,
    required: true
  }],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const name = interaction.options.getString('name');
      console.log(`🎵 Người dùng yêu cầu bài hát: ${name}`);

      if (!name) return interaction.reply({ content: '❌ Vui lòng nhập tên bài hát hợp lệ', ephemeral: true }).catch(e => { });

      let res;
      try {
        res = await client.player.search(name, {
          member: interaction.member,
          textChannel: interaction,channel,
          interaction
        });
        console.log(`🔎 Kết quả tìm kiếm: ${res.length}`);
      } catch (e) {
        console.error('❌ Lỗi tìm kiếm:', e);
        return interaction.reply({ content: '❌ Không có kết quả' }).catch(e => { });
      }

      if (!res || !res.length || res.length <= 0) {
        console.log('❌ Không có kết quả hợp lệ.');
        return interaction.reply({ content: '❌ Không có kết quả', ephemeral: true }).catch(e => { });
      }

      const embed = new EmbedBuilder();
      embed.setColor(client.config.embedColor);
      embed.setTitle(`Tìm thấy: ${name}`);

      const maxTracks = res.slide(0, 10);
      console.log(`🎶 Số bài hát tối đa: ${maxTracks.length}`);

      let track_button_creator = maxTracks.map((song, index) => {
        console.log(`🎶 [${index + 1}] ${song.name} - ${song.url}`);
        return new ButtonBuilder()
          .setLabel(`${index + 1}`)
          .setStyle(ButtonStyle.Secondary)
          .setCustomId(`${index + 1}`);
      });

      let buttons1;
      let buttons2;
      if (track_button_creator.length > 10) {
        buttons1 = new ActionRowBuilder().addComponents(track_button_creator.slice(0, 5));
        buttons2 = new ActionRowBuilder().addComponents(track_button_creator.slice(5, 10));
      } else {
        if (track_button_creator.length > 5) {
          buttons1 = new ActionRowBuilder().addComponents(track_button_creator.slice(0, 5));
          buttons2 = new ActionRowBuilder().addComponents(track_button_creator.slice(5, track_button_creator.length));
        } else {
          buttons1 = new ActionRowBuilder().addComponents(track_button_creator);
        }
      }

      let cancel = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Hủy')
          .setStyle(ButtonStyle.Danger)
          .setCustomId('cancel')
      );

      embed.setDescription(`${maxTracks.map((song, i) => `**${i + 1}**.[${song.name}](${song.url}) | \`${song.uploader.name}\``).join('\n')}\n\n✨Chọn một bài hát từ dưới đây!!`);

      let code;
      if (buttons1 && buttons2) {
        code = { embeds: [embed], components: [buttons1, buttons2, cancel] };
      } else {
        code = { embeds: [embed], components: [buttons1, cancel] };
      }

      interaction.reply(code).then(async Mesage => {
        const filter = i => i.user.id === interaction.user.id;
        let collector = await Message.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (button) => {
          console.log(`🔘 Nút được chọn: ${button.customId}`);

          switch (button.customId) {
            case 'cancel': {
              embed.setDescription('Tìm kiếm bị hủy');
              await interaction.editReply({ embeds: [embed], components: [] }).catch(e => { });
              return collector.stop();
            }
            break;

            default: {
              const selectedIndex = Number(button.customId) - 1;
              console.log(`➡️ Chỉ số được chọn: ${selectedIndex}`);
              console.log(`🎶 Tổng số kết quả: ${res.length}`);

              if (selectedIndex < 0 || selectedIndex >= res.length) {
                console.log('❌ Chỉ số chọn không hợp lệ');
                await interaction.editReply({ content: '❌ Chọn không hợp lệ!', ephemeral: true }).catch(e => { });
                return collector.stop();
              }

              selectedThumbnailURL = maxTracks[selectedIndex].thumbnail;
              embed.setThumbnail(selectedThumbnailURL);
              embed.setDescription(`**${res[selectedIndex].name}**`);
              await interaction.editReply({ embeds: [embed], components: [] }).catch(e => { });

              try {
                console.log(`🚀 Đang có gắng phát: ${res[selectedIndex].url}`);
                await client.player.play(interaction.member.voice.channel, res[selectedIndex].url, {
                  member: interaction.member,
                  textChannel: interaction.channel,
                  interaction
                });
                console.log(`✅ Lệnh phát đã được gửi thành công`);
              } catch (e) {
                console.error('❌ Lỗi khi phát:', e);
                await interaction.editReply({ content: '❌ Không có kết quả!', ephemeral: true }).catch(e => { });
              }
              return collector.stop();
            }
          }
        });

        collector.on('end', (msg, reason) => {
          console.log(`⏹️ Bộ thu thập kết thúc. Lý do: ${reason}`);
          if (reason === 'time') {
            embed.setDescription('Tìm kiếm đã hết thời gian.');
            return interaction.editReply({ embeds: [embed], components: [] }).catch(e => { });
          }
        });
      }).catch(e => {
        console.error('❌ Lỗi khi trả lời lệnh', e);
      });
    } catch (E) {
      console.error('❌ Lỗi khi thực hiện lệnh:', e);
    }
  },
};

module.exports.selectedThumbnailURL = selectedThumbnailURL;