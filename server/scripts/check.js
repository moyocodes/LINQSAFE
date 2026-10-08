// Server self-check, for hosts without a terminal: cPanel → Setup Node.js App → Run JS script → "check".
// Prints which settings were found (never the password) and whether the database login works.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import '../env.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const { DB_HOST, DB_PORT = 3306, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, NODE_ENV } = process.env
const ok = (b) => (b ? 'OK  ' : 'FAIL')

console.log(`Node.js ${process.version}  ·  NODE_ENV=${NODE_ENV || '(not set)'}`)
console.log(`${ok(fs.existsSync(path.join(root, '.env')))} .env file in ${root}`)
console.log(`${ok(fs.existsSync(path.join(root, 'dist', 'index.html')))} built website (dist/index.html)`)
console.log(`${ok(JWT_SECRET && JWT_SECRET !== 'change-me' && JWT_SECRET.length >= 16)} JWT_SECRET set (16+ characters)`)
console.log(`     DB_HOST=${DB_HOST}  DB_PORT=${DB_PORT}  DB_USER=${DB_USER}  DB_NAME=${DB_NAME}  DB_PASSWORD=${DB_PASSWORD ? `(${DB_PASSWORD.length} characters)` : '(EMPTY)'}`)
if (DB_HOST && DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1')
  console.log('FAIL DB_HOST should be localhost on cPanel (MySQL users are only allowed from localhost)')

try {
  const c = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, connectTimeout: 8000 })
  const [[{ v }]] = await c.query('SELECT VERSION() AS v')
  const [tables] = await c.query('SHOW TABLES')
  console.log(`OK   database login works (MySQL ${v}, ${tables.length} tables)`)
  await c.end()
} catch (e) {
  console.log(`FAIL database login: ${e.code || e.message}`)
  const hints = {
    ER_ACCESS_DENIED_ERROR: 'User or password wrong. cPanel → MySQL Databases: reset the user\'s password and copy it exactly into .env (avoid # " \' and spaces). Use DB_HOST=localhost.',
    ER_DBACCESS_DENIED_ERROR: 'The user isn\'t added to this database. cPanel → MySQL Databases → Add User To Database → All Privileges.',
    ER_BAD_DB_ERROR: 'DB_NAME doesn\'t exist. Use the full name with the account prefix, e.g. linqqkto_linqsafe.',
    ECONNREFUSED: 'Nothing is listening at DB_HOST:DB_PORT. Use DB_HOST=localhost and DB_PORT=3306.',
    ETIMEDOUT: 'Couldn\'t reach DB_HOST. Use DB_HOST=localhost.',
  }
  if (hints[e.code]) console.log(`     → ${hints[e.code]}`)
}
