import mysql from 'mysql2/promise'
import './env.js'

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
  if (!DB_HOST || !DB_NAME) console.error('\nNo database settings found. Is there a .env file in the app folder (next to app.cjs)?')
  console.error(`\nCould not connect to MySQL as "${DB_USER}"@"${DB_HOST}:${DB_PORT}" (${e.code || e.message}).`)
  if (e.code === 'ER_ACCESS_DENIED_ERROR')
    console.error('Check DB_USER and DB_PASSWORD in your .env file (see .env.example).')
  else if (e.code === 'ECONNREFUSED')
    console.error('Is MySQL running? Check DB_HOST and DB_PORT in your .env file.')
  console.error('')
  process.exit(1)
}

import { migrate } from './migrations.js'

await migrate(pool)
