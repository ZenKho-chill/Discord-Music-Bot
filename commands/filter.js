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

const db = require("../mongoDB");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "filter",
  description: "Thêm bộ lọc âm thanh cho nhạc đang phát",
  permissions: "0x0000000000000800",
  options: [],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      await interaction.deferReply({ ephemeral: true });

      const queue = client?.player?.getQueue(interaction.guild.id);
      if (!queue || !queue.playing) {
        return interaction.editReply({
          content: "⚠️ Hiện không có bài nhạc nào đang phát!",
        });
      }

      const buttons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("3D")
          .setCustomId("3d")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel("Tăng Bass")
          .setCustomId("bassboost")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel("Vang vọng")
          .setCustomId("echo")
          .setStyle(ButtonStyle.Secondary)
      );

      const buttons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Vaporwave")
          .setCustomId("vaporwave")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel("Âm thanh vòm")
          .setCustomId("surround")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel("Chói tai")
          .setCustomId("earwax")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setLabel("Karaoke")
          .setCustomId("karaoke")
          .setStyle(ButtonStyle.Secondary)
      );

      let embed = new EmbedBuilder()
        .setColor("#01fe66")
        .setAuthor({
          name: "Bộ lọc âm thanh",
          iconURL: "https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&",
          url: "http://zenkho.top",
        })
        .setDescription("**🎶 Khám phá âm thanh! Chọn hiệu ứng nhạc bạn muốn!**");

      await interaction.editReply({ embeds: [embed], components: [buttons1, buttons2] });
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (button) => {
        await button.deferUpdate();
        const filterName = button.customId.toLowerCase();

        const validFilters = [
          "3d",
          "bassboost",
          "echo",
          "karaoke",
          "vaporwave",
          "surround",
          "earwax",
        ];

        if (!validFilters.includes(filterName)) {
          return;
        }

        if (queue.filters.names.includes(filterName)) {
          await queue.filters.remove(filterName);
          embed.setDescription(`🎛️ Bộ lọc: **${filterName}**, Trạng thái áp dụng: ❌ Đã tắt`);
        } else {
          await queue.filters.add(filterName);
          embed.setDescription(`🎛️ Bộ lọc: **${filterName}**, Trạng thái áp dụng: ✅ Đã bật`);
        }

        await interaction.editReply({ embeds: [embed] });
      });

      collector.on("end", async (_, reason) => {
        if (reason === "time") {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(client.config?.embedColor || "#ff0000")
            .setTitle("⏰ Hết thời gian chọn bộ lọc");
          await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        }
      });
    } catch (e) {
      console.error(e);
    }
  },
};
