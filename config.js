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

module.exports = {
     TOKEN: "",
     ownerID: ["", ""],
     botInvite: "",
     supportServer: "",
     mongodbURL: "mongodb://mongo:27017/database_name_here",
     status: 'ZenKho',
     commandsdir: './commands',
     language: "vi",
     embedColor: "00fbff",
     errorLog: "",

     sponsor: {
        status: true,
        url: "https://zenkho.top",
     },

     voteManager: {
        status: false,
        api_key: "",
        vote_commands:[
            "back",
            "channel",
            "clear",
            "dj",
            "filter",
            "loop",
            "nowplaying",
            "pause",
            "playnormal",
            "playlist",
            "queue",
            "resume",
            "save",
            "play",
            "skip",
            "stop",
            "time",
            "volume"
        ],
        vote_url: "",
     },

     shardManager: {
        shardStatus: false
     },

     playlistSettings: {
        maxPlaylist: 10,
        maxMusic: 75,
     },

     opt: {
        DJ: {
            commands: [
                'back',
                'clear',
                'filter',
                'loop',
                'pause',
                'resume',
                'skip',
                'stop',
                'volue',
                'shuffle'
            ]
        },
        voiceConfig: {
            leaveOnFinish: true,
            leaveOnStop: true,
            leaveOnEmpty: {
                status: true,
                cooldown: 180,
            },
        },
        maxVol: 150,
     }
}