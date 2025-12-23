require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const cfg = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 3000,
  };

  console.log('Connecting with:', {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    database: cfg.database,
  });

  try {
    const conn = await mysql.createConnection(cfg);
    const [rows] = await conn.query('SELECT 1 as ok');
    console.log('DB OK:', rows);
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error('DB FAIL:', e.message);
    process.exit(1);
  }
})();
