import mysql from 'mysql2/promise'
import 'dotenv/config'

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL } = process.env
const ssl = DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined // hosted MySQL (PlanetScale, Aiven, RDS…) usually needs TLS

// Create the database on first run. Hosted providers often forbid this (the DB already exists), so don't fail on it.
try {
  const bootstrap = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, ssl,
  })
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``)
  await bootstrap.end()
} catch (e) {
  console.warn(`Skipping CREATE DATABASE (${e.code || e.message}); assuming "${DB_NAME}" already exists.`)
}

export const pool = mysql.createPool({
  host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD,
  database: DB_NAME, connectionLimit: 10, ssl,
})

try {
  await pool.query('SELECT 1')
} catch (e) {
  console.error(`\nCould not connect to MySQL as "${DB_USER}"@"${DB_HOST}:${DB_PORT}" (${e.code || e.message}).`)
  if (e.code === 'ER_ACCESS_DENIED_ERROR')
    console.error('Check DB_USER and DB_PASSWORD in your .env file (see .env.example).')
  else if (e.code === 'ECONNREFUSED')
    console.error('Is MySQL running? Check DB_HOST and DB_PORT in your .env file.')
  console.error('')
  process.exit(1)
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(80) NOT NULL DEFAULT '',
    bio VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
// Older databases predate the email column; add it (nullable, so existing users keep working).
try {
  await pool.query('ALTER TABLE users ADD COLUMN email VARCHAR(254) NULL UNIQUE AFTER username')
} catch (e) {
  if (e.code !== 'ER_DUP_FIELDNAME') throw e
}
await pool.query(`
  CREATE TABLE IF NOT EXISTS links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    clicks INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`)
await pool.query(`
  CREATE TABLE IF NOT EXISTS contact_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`)
