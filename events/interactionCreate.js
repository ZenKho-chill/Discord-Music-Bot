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

const config = require("../config.js");
const { EmbedBuilder, InteractionType, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require("../mongoDB");
const fs = require("fs");

module.exports = async (client, interaction) => {

  try {
    if (!interaction?.guild) {
      return interaction?.reply({ content: "Đang bị giới hạn tần suất.", ephemeral: true });
    } else {

      function cmd_loader() {
        if (interaction?.type === InteractionType.ApplicationCommand) {
          fs.readdir(config.commandsdir, (err, files) => {
            if (err) throw err;
            files.forEach(async (f) => {
              let props = require(`.${config.commandsdir}/${f}`);
              if (interaction.commandName === props.name) {
                try {
                  let data = await db?.musicbot?.findOne({ guildID: interaction?.guild?.id });
                  if (data?.channels?.length > 0) {

                    let channel_control = await data?.channels?.filter(x => !interaction?.guild?.channels?.cache?.get(x?.channel));

                    if (channel_control?.length > 0) {
                      for (const x of channel_control) {
                        await db?.musicbot?.updateOne({ guildID: interaction?.guild?.id }, { 
                          $pull: { 
                            channels: { 
                              channel: x?.channel 
                            } 
                          } 
                        }, { upsert: true }).catch(e => { });
                      }
                    } else {
                      data = await db?.musicbot?.findOne({ guildID: interaction?.guild?.id });
                      let channel_filter = data?.channels?.filter(x => x.channel === interaction?.channel?.id);

                      if (!channel_filter?.length > 0 && !interaction?.member?.permissions?.has("0x0000000000000020")) {
                        channel_filter = data?.channels?.map(x => `<#${x.channel}>`).join(", ");
                        return interaction?.reply({ content: `🔴 Giới hạn tần suất đã được áp dụng cho kênh: ${channel_filter}`, ephemeral: true }).catch(e => { });
                      }
                    }
                  }

                  if (interaction?.member?.permissions?.has(props?.permissions || "0x0000000000000800")) {
                    const DJ = client.config.opt.DJ;
                    if (props && DJ.commands.includes(interaction?.commandName)) {
                      let djRole = await db?.musicbot?.findOne({ guildID: interaction?.guild?.id }).catch(e => { });
                      if (djRole) {
                        const roleDJ = interaction?.guild?.roles?.cache?.get(djRole?.role);
                        if (!interaction?.member?.permissions?.has("0x0000000000000020")) {
                          if (roleDJ) {
                            if (!interaction?.member?.roles?.cache?.has(roleDJ?.id)) {

                              const embed = new EmbedBuilder()
                                .setColor(client.config.embedColor)
                                .setTitle(client?.user?.username)
                                .setThumbnail(client?.user?.displayAvatarURL())
                                .setTimestamp()

                              return interaction?.reply({ embeds: [embed], ephemeral: true }).catch(e => { });
                            }
                          }
                        }
                      }
                    }

                    if (props && props.voiceChannel) {
                      if (!interaction?.member?.voice?.channelId) return interaction?.reply({ content: `🔴 Vui lòng tham gia kênh thoại trước!`, ephemeral: true }).catch(e => { });
                      const guild_me = interaction?.guild?.members?.cache?.get(client?.user?.id);
                      if (guild_me?.voice?.channelId) {
                        if (guild_me?.voice?.channelId !== interaction?.member?.voice?.channelId) {
                          return interaction?.reply({ content: `🔴 Bạn phải ở trong cùng kênh thoại!`, ephemeral: true }).catch(e => { });
                        }
                      }
                    }
                    return props.run(client, interaction);
                    
                  } else {
                    return interaction?.reply({ content: `▶️ Thiếu quyền: **${props?.permissions?.replace("0x0000000000000020", "QUẢN LÝ GUILD")?.replace("0x0000000000000800", "GỬI TIN NHẮN") || "GỬI TIN NHẮN"}**`, ephemeral: true });
                  }
                } catch (e) {
                  return interaction?.reply({ content: `❌ Lỗi...\n\n\`\`\`${e?.message}\`\`\``, ephemeral: true });
                }
              }
            });
          });
        }
      }

      if(config.voteManager.status === true && config.voteManager.api_key) {
        if(config.voteManager.vote_commands.includes(interaction?.commandName)) {
          try {
            const topSdk = require("@top-gg/sdk");
            let topApi = new topSdk.Api(config.voteManager.api_key, client);
            await topApi?.hasVoted(interaction?.user?.id).then(async voted => {
              if (!voted) {
                const embed2 = new EmbedBuilder()
                  .setTitle("Bầu chọn "+client?.user?.username)
                  .setColor(client?.config?.embedColor);
                return interaction?.reply({ content: "", embeds: [embed2], ephemeral: true });
              } else {
                cmd_loader();
              }
            })
          } catch (e) {
            cmd_loader();
          }
        } else {
          cmd_loader();
        }
      } else {
        cmd_loader();
      }

    }
  } catch (e) {
    console.error(e);
  }
}
