const mongoose = require('mongoose');

// Music Track Schema để lưu trữ thông tin track được phát
const musicTrackSchema = new mongoose.Schema({
    // Thông tin cơ bản
    title: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    duration: {
        type: String, // Format: "3:45"
        default: null
    },
    
    // Platform information
    platform: {
        type: String,
        enum: ['youtube', 'spotify', 'soundcloud', 'other'],
        required: true
    },
    
    // Content type
    contentType: {
        type: String,
        enum: ['single', 'playlist', 'album'],
        required: true
    },
    
    // Platform specific IDs
    platformData: {
        youtubeId: {
            type: String,
            default: null
        },
        spotifyId: {
            type: String,
            default: null
        },
        soundcloudId: {
            type: String,
            default: null
        },
        playlistId: {
            type: String,
            default: null // For playlist/album
        }
    },
    
    // Guild and user info
    guildId: {
        type: String,
        required: true,
        index: true
    },
    guildName: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    username: {
        type: String,
        required: true
    },
    
    // Additional metadata
    metadata: {
        thumbnail: {
            type: String,
            default: null
        },
        artist: {
            type: String,
            default: null
        },
        views: {
            type: Number,
            default: null
        },
        likes: {
            type: Number,
            default: null
        }
    },
    
    // Playlist info (nếu là playlist)
    playlistInfo: {
        totalTracks: {
            type: Number,
            default: null
        },
        playlistTitle: {
            type: String,
            default: null
        },
        playlistAuthor: {
            type: String,
            default: null
        }
    },
    
    // Timestamps
    playedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: {
        type: Date,
        default: null
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['playing', 'paused', 'finished', 'skipped', 'error'],
        default: 'playing'
    }
}, {
    timestamps: true // Tự động thêm createdAt và updatedAt
});

// Indexes for performance
musicTrackSchema.index({ guildId: 1, playedAt: -1 });
musicTrackSchema.index({ userId: 1, playedAt: -1 });
musicTrackSchema.index({ platform: 1, playedAt: -1 });
musicTrackSchema.index({ contentType: 1, playedAt: -1 });

// Static methods
musicTrackSchema.statics.getGuildStats = function(guildId) {
    return this.aggregate([
        { $match: { guildId: guildId } },
        {
            $group: {
                _id: null,
                totalTracks: { $sum: 1 },
                platforms: {
                    $push: "$platform"
                },
                contentTypes: {
                    $push: "$contentType"
                }
            }
        }
    ]);
};

musicTrackSchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { userId: userId } },
        {
            $group: {
                _id: null,
                totalTracks: { $sum: 1 },
                favoritePlatform: {
                    $first: {
                        $arrayElemAt: [
                            { $setDifference: ["$platform", []] }, 0
                        ]
                    }
                }
            }
        }
    ]);
};

musicTrackSchema.statics.getPopularTracks = function(guildId, limit = 10) {
    return this.aggregate([
        { $match: { guildId: guildId } },
        {
            $group: {
                _id: "$url",
                title: { $first: "$title" },
                platform: { $first: "$platform" },
                playCount: { $sum: 1 },
                lastPlayed: { $max: "$playedAt" }
            }
        },
        { $sort: { playCount: -1 } },
        { $limit: limit }
    ]);
};

module.exports = mongoose.model('MusicTrack', musicTrackSchema);
