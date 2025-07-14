const hotReloader = require('./hotReload');
const logger = require('./logger');

// Map preventReconnect toàn cục có thể được truy cập bởi các module khác
const preventReconnect = new Map();

// Hàm kiểm tra xem máy chủ có bị chặn không cho bot tham gia
function isGuildBlocked(guildId) {
    return preventReconnect.has(guildId);
}

// Hàm chặn máy chủ không cho bot tham gia
function blockGuild(guildId) {
    preventReconnect.set(guildId, Date.now());
    const config = hotReloader.getCurrentConfig();
    if (config.debug) {
        logger.autoLeave(`[AutoLeaveManager] Đã chặn máy chủ ${guildId} không cho bot tham gia lại`);
    }
}

// Hàm bỏ chặn máy chủ
function unblockGuild(guildId) {
    const wasBlocked = preventReconnect.has(guildId);
    preventReconnect.delete(guildId);
    const config = hotReloader.getCurrentConfig();
    if (config.debug && wasBlocked) {
        logger.autoLeave(`[AutoLeaveManager] Đã bỏ chặn máy chủ ${guildId} cho bot tham gia`);
    }
    return wasBlocked;
}

// Hàm dọn dẹp khi bot rời server
function cleanupGuild(guildId) {
    preventReconnect.delete(guildId);
}

module.exports = {
    isGuildBlocked,
    blockGuild,
    unblockGuild,
    cleanupGuild,
    // Xuất map để truy cập trực tiếp nếu cần
    preventReconnect
};
