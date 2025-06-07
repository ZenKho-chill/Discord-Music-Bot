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

const { resourceUsage } = require("process");
const db = require("../mongoDB");

module.exports = {
  name: "filter",
  description: "Thêm bộ lọc âm thanh cho nhạc đang phát",
  permissions: "0x0000000000000800",
  options: [],
  voiceChannel: true,
  run: async (client, interaction) => {
    try {
      const {
        EmbedBuilder,
        ActionRowBuilder,
        ButtonBuilder,
        ButtonStyle,
      } = require("discord.js");
      const queue = client?.player?.getQueue(interaction?.guild?.id);
      if (!queue || !queue?.playing)
        return interaction
          ?.reply({
            content: "⚠️ Hiện không có bài nhạc nào đang phát!",
            ephemeral: true,
          })
          .catch((e) => {});

      let buttons = new ActionRowBuilder().addComponents(
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

      let buttons2 = new ActionRowBuilder().addComponents(
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
          iconURL:
            "https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&",
          url: "http://zenkho.top",
        })
        .setDescription(
          "**🎶 Khám phá âm thanh! Chọn hiệu ứng nhạc bạn muốn!**"
        );

      interaction
        .reply({ embeds: [embed], components: [buttons, buttons2] })
        .then(async (Message) => {
          const filter = (i) => i.user.id === interaction?.user?.id;
          let col = await Message?.createMessageComponentCollector({
            filter,
            time: 60000,
          });

          col.on("collect", async (button) => {
            if (button?.user?.id !== interaction?.user?.id) return;
            await button?.deferUpdate().catch((e) => {});
            let filters = [
              "3d",
              "bassboost",
              "echo",
              "karaoke",
              "nightcore",
              "vaporwave",
              "surround",
              "earwax",
            ];
            if (!filters?.includes(button?.customId)) return;

            let filtre = button.customId;
            if (!filtre)
              return interaction
                ?.editReply({
                  content: "❌ Bộ lọc không hợp lệ!",
                  ephemeral: true,
                })
                .catch((e) => {});
            filtre = filtre?.toLowerCase();

            if (filters?.includes(filtre?.toLowerCase())) {
              if (queue?.filters?.has(filtre)) {
                queue?.filters.remove(filtre);
                embed?.setDescription(
                  `🎛️ Bộ lọc: **${filtre}**, Trạng thái áp dụng: ❌ Đã tắt`
                );
                return interaction
                  ?.editReply({ embeds: [embed] })
                  .catch((e) => {});
              } else {
                queue?.filters.add(filtre);
                embed?.setDescription(
                  `🎛️ Bộ lọc: **${filtre}**, Trạng thái áp dụng: ✅ Đã bật`
                );
                return interaction
                  ?.editReply({ embeds: [embed] })
                  .catch((e) => {});
              }
            } else {
              embed?.setDescription(`❌ Không tìm thấy bộ lọc!`);
              return interaction
                ?.editReply({ embeds: [embed] })
                .catch((e) => {});
            }
          });

          col.on("end", async (buttons, reason) => {
            if (reason === "time") {
              embed = new EmbedBuilder()
                .setColor(client?.config?.embedColor)
                .setTitle("⏰ Hết thời gian chọn bộ lọc");

              await interaction
                ?.editReply({ embeds: [embed], components: [] })
                .catch((e) => {});
            }
          });
        });
    } catch (e) {
      console.error(e);
    }
  },
};
