const { pool } = require('../services/sql');

async function connectDB() {
    try {
        await pool.connect();
        console.log('Kết nối database thành công');
    } catch (error) {
        console.error('Lỗi kết nối database:', error);
        process.exit(1);
    }
}

module.exports = {
    connectDB
}; 