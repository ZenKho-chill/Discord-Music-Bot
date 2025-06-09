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

const { EmbedBuilder } = require("discord.js");
const db = require("../mongoDB");

module.exports = {
  name: "help",
  description: "Xem thông tin về bot và các lệnh có sẵn",
  permissions: "0x0000000000000800",
  options: [],

  run: async (client, interaction) => {
    try {
      const musicCommandsEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setTitle("🎸 **Lệnh Âm Nhạc**")
        .addFields(
          { name: "🎹 Play", value: "Phát bài hát từ link hoặc từ khóa tìm kiếm" },
          { name: "⏹️ Stop", value: "Dừng phát nhạc và bot rời kênh thoại " },
          { name: "📊 Queue", value: "Xem và quản lý danh sách bài hát" },
          { name: "⏭️ Skip", value: "Xem và quản lý danh sách bài hát" },
          { name: "⏸️ Pause", value: "Tạm dừng bài hát đang phát" },
          { name: "▶️ Resume", value: "Tiếp tục bài hát đang tạm dừng" },
          { name: "🔁 Loop", value: "Bật/Tắt chế độ lặp lại bài hát hoặc hàng chờ" },
          { name: "🔄 Autoplay", value: "Bật/Tắt tự động phát nhạc ngẫu nhiên" },
          { name: "⏩ Seek", value: "Bỏ qua bài hát đang phát, phát bài hát tiếp theo" },
          { name: "⏮️ Previous", value: "Phát lại bài trước đó" },
          { name: "🔀 Shuffle", value: "Xáo trộn danh sách bài hát" }
        )
        .setImage(
          "https://cdn.discordapp.com/attachments/1004341381784944703/1165201249331855380/RainbowLine.gif?ex=6845463a&is=6843f4ba&hm=1d8a833ba766ff8201f35f521801f4500d0aa7dead496ca6728aa10bb80bdc59&"
        );

      const basicCommandsEmbed = new EmbedBuilder()
        .setColor(client.config.embedColor)
        .setTitle("✨ **Lệnh Cơ Bản**")
        .addFields(
          { name: "🏓 Ping", value: "Kiểm tra độ trễ (ping) của bot" },
          { name: "🗑️ Clear", value: "Xóa toàn bộ danh sách bài hát" },
          { name: "⏱️ Time", value: "Xem thời lượng đã phát của bài hát" },
          { name: "🎧 Filter", value: "Áp dụng hiệu ứng lọc âm thanh" },
          { name: "🎵 Now Playing", value: "Hiển thị bài hát đang phát" },
          { name: "🔊 Volume", value: "Điều chỉnh âm lượng nhạc (cẩn thận nghe lớn)" }
        )
        .setImage(
          "https://cdn.discordapp.com/attachments/1004341381784944703/1165201249331855380/RainbowLine.gif?ex=6845463a&is=6843f4ba&hm=1d8a833ba766ff8201f35f521801f4500d0aa7dead496ca6728aa10bb80bdc59&"
        );

      interaction
        .reply({
          embeds: [musicCommandsEmbed, basicCommandsEmbed],
        })
        .catch((e) => {console.error(e)});
    } catch (e) {
      console.error(e);
    }
  },
};
