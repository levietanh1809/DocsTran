const sql = require('mssql');
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT),
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Tạo pool connection để tái sử dụng
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on('error', err => {
    console.error('SQL Pool Error:', err);
});

async function query(strings, ...values) {
    await poolConnect; // Đảm bảo pool đã được kết nối
    try {
        const request = pool.request();
        let query = strings[0];
        for (let i = 0; i < values.length; i++) {
            query += `@p${i}` + strings[i + 1];
            request.input(`p${i}`, values[i]);
        }
        return await request.query(query);
    } catch (error) {
        console.error('SQL Query Error:', error);
        throw error;
    }
}

module.exports = {
    query,
    pool,
    sql
}; 