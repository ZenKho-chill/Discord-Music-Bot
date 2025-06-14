/*
 * Tệp này là một phần của Discord Music Bot.
 *
 * Discord Music Bot là phần mềm miễn phí: bạn có thể phân phối lại hoặc sửa đổi
 * theo các điều khoản của Giấy phép Công cộng GNU được công bố bởi
 * Tổ chức Phần mềm Tự do, phiên bản 3 hoặc (nếu bạn muốn) bất kỳ phiên bản nào sau đó.
 *
 * Discord Music Bot được phân phối với hy vọng rằng nó sẽ hữu ích,
 * nhưng KHÔNG CÓ BẢO HÀNH; thậm chí không bao gồm cả bảo đảm
 * VỀ TÍNH THƯƠNG MẠI hoặc PHÙ HỢP CHO MỘT MỤC ĐÍCH CỤ THỂ. Xem
 * Giấy phép Công cộng GNU để biết thêm chi tiết.
 *
 * Bạn sẽ nhận được một bản sao của Giấy phép Công cộng GNU cùng với Discord Music Bot.
 * Nếu không, hãy xem <https://www.gnu.org/licenses/>.
 */

const { ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const db = require('../mongoDB');

module.exports = {
  name: 'playsong',
  description: 'Phát một bài hát',
  permissions: '0x0000000000000800',
  options: [
    {
      name: 'normal',
      description: 'Mở nhạc từ các nền tàng khác',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'name',
          description: 'Nhập tên bài hát bạn muốn phát',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    },
    {
      name: 'playlist',
      description: 'Nhập tên playlist bạn muốn phát',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'name',
          description: 'Nhập tên playlist bạn muốn tạo',
          type: ApplicationCommandOptionType.String,
          required: true
        }
      ]
    }
  ],

  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      let stp = interaction.options.getSubcommand();

      if (stp === 'playlist') {
        let playlisttw = interaction.options.getString('name');
        let playlist = await db?.playlist?.find().catch(e => { });
        if (!playlist?.length > 0) return interaction.reply({ content: '❌ Không tìm thấy playlist', ephemeral: true }).catch(e => { });

        let arr = 0;
        for (let i = 0; i < playlist.length; i++) {
          if (playlist[i]?.playlist?.filter(p => p.name === playlisttw)?.length > 0) {
            let playlist_owner_filter = playlist[i].playlist.filter(p => p.name === playlisttw)[0].author;
            let playlist_public_filter = playlist[i].playlist.filter(p => p.name === playlisttw)[0].public;
            if (playlist_owner_filter !== interaction.member.id) {
              if (playlist_public_filter === false) {
                return interaction.reply({ content: '❌ Playlist này không công khai', ephemeral: true }).catch(e => { });
              }
            }
            const music_filter = playlist[i]?.musics?.filter(m => m.playlist_name === playlisttw);
            if (!music_filter?.length > 0) return interaction.reply({ content: '❌ Playlist không có bài hát', ephemeral: true }).catch(e => { });
            interaction.reply({ content: '✅ Đang phát playlist...' }).catch(e => { });

            let songs = [];
            music_filter.map(m => songs.push(m.music_url));

            setTimeout(async () => {
              const playl = await client?.player?.createCustomPlaylist(songs, {
                member: interaction.member,
                properties: { name: playlisttw, source: 'custom' },
                parallel: true
              });
              await interaction.editReply({ content: `✅ Đang phát ${music_filter.length} bài hát` }).catch(e => { });

              try {
                await client.player.play(interaction.member.voice.channel, playl, {
                  member: interaction.member,
                  textChannel: interaction.channel,
                  interaction
                });
              } catch (e) {
                await interaction.editReply({ content: '❌ Không tìm thấy kết quả', ephemeral: true }).catch(e => { });
              }

              playlist[i]?.playlist?.filter(p => p.name === playlisttw).map(async p => {
                await db.playlist.updateOne({ userID: p.author }, {
                  $pull: {
                    playlist: {
                      name: playlisttw
                    }
                  }
                }, { upsert: true }).catch(e => { });

                await db.playlist.updateOne({ userID: p.author }, {
                  $push: {
                    playlist: {
                      name: p.name,
                      author: p.author,
                      authorTag: p.authorTag,
                      public: p.public,
                      plays: Number(p.plays) + 1,
                      createdTime: p.createdTime
                    }
                  }
                }, { upsert: true }).catch(e => { });
              });
            }, 3000);
          } else {
            arr++;
            if (arr === playlist.length) {
              return interaction.reply({ content: '❌ Playlist không tồn tại', ephemeral: true }).catch(e => { });
              break;
            }
          }
        }
      }
      if (stp === 'normal') {
        const name = interaction.options.getString('name');
        if (!name) {
          return interaction.reply({ content: '▶️ Vui lòng nhập tên bài hát hoặc link', ephemeral: true }).catch(e => { });
        }

        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setDescription('**🎸 Hãy chuẩn bị cho một hành trình âm nhạc!**');

        await interaction.reply({ embeds: [embed] }).catch(e => { });

        try {
          await client.player.play(interaction.member.voice.channel, name, {
            member: interaction.member,
            textChannel: interaction.channel,
            interaction
          });
        } catch (e) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription('❌ Không tìm thấy kết quả!!');

          await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(e => { });
        }
      }
    } catch (e) {
      console.error(error);
    }
  },
};