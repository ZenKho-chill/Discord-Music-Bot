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

require('dotenv').config();

module.exports = {
     TOKEN: process.env.TOKEN,
     ownerID: process.env.AUTHOR,
     botInvite: process.env.BOT_INVITE,
     supportServer: process.env.SUPPORT_SERVER,
     mongodbURL: process.env.MONGO_URL,
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
            leaveOnFinish: {
                status: true,
                cooldown: 180, // giây
            },
            leaveOnStop: true,
            leaveOnEmpty: {
                status: true,
                cooldown: 60,
            },
        },
        maxVol: 150,
     }
}