// Loads settings. On your computer `.env.local` (local stage) wins; on the dev/prod servers there is
// only `.env`. dotenv never overrides a value that's already set, so the first file loaded wins.
// Paths are resolved from the project folder, not the current directory, because cPanel/Passenger
// doesn't always start the app from its own folder.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local'), quiet: true })
dotenv.config({ path: path.join(root, '.env'), quiet: true })
