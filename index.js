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

const config = require('./config');

if (config.shardManager.shardStatus == true) {
    const { ShardingManager } = require('discord.js');
    const manager = new ShardingManager('./bot.js', { token: config.TOKEN || process.env.TOKEN });
    manager.on('shardCreate', shard => console.log(`Đang load shard ${shard.id}`));
    manager.spawn();
} else {
    require('./bot')
}