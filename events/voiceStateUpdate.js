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

const db = require('../mongoDB');
module.exports = async (client, oldState, newState) => {
  const queue = client.player.getQueue(oldState.guild.id);
  if (queue || queue?.playing) {
    if (client?.config?.opt?.voiceConfig?.leaveOnEmpty?.status === true) {
      setTimeout(async () => {
        let botChannel = oldState?.guild?.channels?.cache?.get(queue?.voice?.connection?.joinConfig?.channelId);
        if (botChannel) {
          if (botChannel.id == oldState.channelId) {
            if (botChannel?.members?.find(x => x == client?.user?.id)) {
              if (botChannel?.members?.size == 1){
                await queue?.textChannel?.send({ content: '🔴 Người dùng đã rời khỏi kênh' }).catch(e => { });
                if (queue || queue?.playing) {
                  return queue?.stop(oldState.guild.id);
                }
              }
            }
          }
        }
      }, client?.config?.opt?.voiceConfig?.leaveOnEmpty?.cooldown || 60000);
    }
    if (newState.id === client.user.id) {
      if (oldState.serverMute === false && newState.serverMute === true) {
        if (queue?.textChannel) {
          try {
            await queue?.pause();
          } catch (e) {
            return;
          }
          await queue?.textChannel?.send({ content: '🔴 Đã bị tắt tiếng' });
        }
      }
      if (oldState.serverMute === true && newState.serverMute === false) {
        if (queue?.textChannel) {
          try {
            await queue.resume();
          } catch (e) {
            return;
          }
        }
      }
    }
  }
}