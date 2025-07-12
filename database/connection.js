const mongoose = require('mongoose');

class DatabaseConnection {
    constructor() {
        this.isConnected = false;
        this.isAvailable = true; // Flag để biết MongoDB có sẵn không
    }

    async connect() {
        try {
            if (this.isConnected) {
                console.log('📊 Database already connected');
                return;
            }

            const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-music-bot';
            
            await mongoose.connect(mongoURI, {
                serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
                connectTimeoutMS: 10000, // Give up initial connection after 10s
            });

            this.isConnected = true;
            this.isAvailable = true;
            console.log('🍃 MongoDB connected successfully');
            console.log('🔗 Database:', mongoose.connection.name);
            console.log('🏠 Host:', mongoose.connection.host + ':' + mongoose.connection.port);
            
            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.log('📊 MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconnected');
                this.isConnected = true;
            });

        } catch (error) {
            console.error('❌ MongoDB connection failed:', error.message);
            console.log('⚠️ Running without database - sessions will be memory-based only');
            console.log('💡 To enable database features, please install and start MongoDB');
            console.log('📖 See MONGODB_SETUP.md for installation instructions');
            
            this.isConnected = false;
            this.isAvailable = false;
            
            // Không throw error để app vẫn chạy được
            return false;
        }
    }

    async disconnect() {
        try {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('📊 MongoDB disconnected');
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            isAvailable: this.isAvailable,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    // Helper method để check nếu có thể dùng database
    canUseDatabase() {
        return this.isAvailable && this.isConnected;
    }
}

module.exports = new DatabaseConnection();
