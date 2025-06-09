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

const config = require('../../config');
const db = require('../../mongoDB');
module.exports = async (client, queue) => {
  if (!config.opt.voiceConfig.leaveOnFinish.status) return;

  const cooldown = (config.opt.voiceConfig.leaveOnFinish.cooldown || 100) * 1000;

  console.log(`[leaveOnFinish] Hàng đợi đã hết, sẽ rời kênh sau ${cooldown / 1000} giây`);

  leaveTimeout = setTimeout(() => {
    console.log(`[leaveOnFinish] Không có bài mới, bot rời kênh`);
    queue.voice.leave();
  }, cooldown);
  
  client.player.on("playSong", () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout);
      leaveOnFinish = null;
      console.log(`[leaveOnFinish] Phát bài mới, hủy đếm ngược rời kênh`);
    }
  });
};