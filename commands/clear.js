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

const { url } = require('inspector');
const db = require('../mongoDB');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    description: 'Xóa sạch hàng chờ nhạc.',
    permissions: '0x0000000000000800',
    options: [],
    voiceChannel: true,
    run: async (client, interaction) => {
        const queue = client.player.getQueue(interaction.guild.id);

        try {
            if (!queue || !queue.playing) {
                return interaction.reply({ content: '⚠️ Hiện không có bài nhạc nào đang phát!', ephemeral: true });
            }

            if (!queue.songs[0]) {
                return interaction.reply({ content: '❌ Hàng chờ đang trống!', ephemeral: true });
            }

            await queue.stop(interaction.guild.id);

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({
                    name: '🔄 Đã xóa hàng chờ',
                    iconURL: 'https://cdn.discordapp.com/attachments/1378363930573017140/1380045187580956682/logo.png?ex=684515bc&is=6843c43c&hm=7e8e52f327579353602c5a89fe2f8fb3e7b4950c5231e4c2b72889e3328fba65&',
                    url: 'https://zenkho.top'
                })
                .setDescription('**✅ Hàng chờ đã được xóa! Sẵn sàng cho hành trình âm nhạc mới.**')

            interaction.reply({ embeds: [embed] });
        } catch (e) {
            console.error(e);
        }
    },
};