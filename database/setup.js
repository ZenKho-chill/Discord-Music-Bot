const dbConnection = require('./connection');
const UserSession = require('./models/UserSession');

async function setupDatabase() {
    try {
        console.log('🔧 Setting up database...');
        
        // Kết nối database
        await dbConnection.connect();
        
        // Tạo indexes
        console.log('📑 Creating database indexes...');
        await UserSession.createIndexes();
        
        // Kiểm tra kết nối
        const stats = await UserSession.collection.stats();
        console.log('📊 Database collection stats:', {
            count: stats.count || 0,
            size: stats.size || 0,
            avgObjSize: stats.avgObjSize || 0
        });
        
        // Dọn dẹp sessions hết hạn
        const cleanupResult = await UserSession.cleanExpiredTokens();
        console.log('🧹 Cleaned up expired sessions:', cleanupResult.deletedCount);
        
        console.log('✅ Database setup completed successfully!');
        
        return true;
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        throw error;
    }
}

async function getDatabaseStatus() {
    try {
        const connection = dbConnection.getStatus();
        const sessionStats = await UserSession.countDocuments();
        const activeSessionStats = await UserSession.countDocuments({
            tokenExpiry: { $gt: new Date() }
        });
        
        return {
            connection,
            sessions: {
                total: sessionStats,
                active: activeSessionStats,
                expired: sessionStats - activeSessionStats
            }
        };
    } catch (error) {
        console.error('❌ Error getting database status:', error);
        return null;
    }
}

module.exports = {
    setupDatabase,
    getDatabaseStatus
};
