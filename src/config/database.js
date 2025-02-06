const { pool } = require('../services/sql');

async function connectDB(retries = 5) {
    while (retries > 0) {
        try {
            await pool.connect();
            console.log('Kết nối database thành công');
            return;
        } catch (error) {
            console.error(`Lỗi kết nối database (${retries} retries left):`, error);
            retries--;
            if (retries === 0) {
                process.exit(1);
            }
            // Wait 5 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

module.exports = {
    connectDB
}; 