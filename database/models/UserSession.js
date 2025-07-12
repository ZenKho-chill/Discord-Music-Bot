const mongoose = require('mongoose');

// User Session Schema để lưu trữ thông tin user và access token
const userSessionSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    global_name: {
        type: String,
        default: null // Display name/nickname từ Discord
    },
    discriminator: {
        type: String,
        default: '0'
    },
    avatar: {
        type: String,
        default: null
    },
    email: {
        type: String,
        default: null
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        default: null
    },
    rememberToken: {
        type: String,
        unique: true,
        sparse: true, // Cho phép null values và không enforce unique cho null
        index: true
    },
    tokenExpiry: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 ngày từ bây giờ
    },
    guilds: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    guildsCache: {
        data: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        lastFetch: {
            type: Date,
            default: null
        },
        expiresAt: {
            type: Date,
            default: null
        }
    },
    avatarHash: {
        type: String,
        default: null // Chỉ lưu hash của avatar, không lưu full URL
    },
    isFirstVisit: {
        type: Boolean,
        default: true // Flag để hiển thị thông báo chào mừng lần đầu
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Index để tối ưu hóa query
userSessionSchema.index({ discordId: 1 });
userSessionSchema.index({ tokenExpiry: 1 });
userSessionSchema.index({ rememberToken: 1 });
userSessionSchema.index({ 'guildsCache.expiresAt': 1 });

// Methods
userSessionSchema.methods.isTokenValid = function() {
    return this.tokenExpiry && this.tokenExpiry > new Date();
};

userSessionSchema.methods.isGuildsCacheValid = function() {
    return this.guildsCache.expiresAt && this.guildsCache.expiresAt > new Date();
};

userSessionSchema.methods.updateActivity = function() {
    this.lastActivity = new Date();
    return this.save();
};

userSessionSchema.methods.updateGuildsCache = function(guildsData, cacheMinutes = 5) {
    this.guildsCache = {
        data: guildsData,
        lastFetch: new Date(),
        expiresAt: new Date(Date.now() + cacheMinutes * 60 * 1000)
    };
    return this.save();
};

userSessionSchema.methods.generateRememberToken = function() {
    const crypto = require('crypto');
    this.rememberToken = crypto.randomBytes(32).toString('hex');
    return this.rememberToken;
};

userSessionSchema.methods.clearRememberToken = function() {
    this.rememberToken = null;
    return this.save();
};

// Static methods
userSessionSchema.statics.findByDiscordId = function(discordId) {
    return this.findOne({ discordId });
};

userSessionSchema.statics.findByRememberToken = function(rememberToken) {
    return this.findOne({ rememberToken });
};

userSessionSchema.statics.cleanExpiredTokens = function() {
    return this.deleteMany({ 
        tokenExpiry: { $lt: new Date() } 
    });
};

userSessionSchema.statics.cleanExpiredCache = function() {
    return this.updateMany(
        { 'guildsCache.expiresAt': { $lt: new Date() } },
        { $unset: { guildsCache: "" } }
    );
};

// Pre-save middleware để tự động cập nhật lastActivity
userSessionSchema.pre('save', function(next) {
    if (this.isModified() && !this.isModified('lastActivity')) {
        this.lastActivity = new Date();
    }
    next();
});

const UserSession = mongoose.model('UserSession', userSessionSchema);

module.exports = UserSession;
