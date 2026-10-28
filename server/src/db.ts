import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new Database(path.join(config.dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS icons (
    user_id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending','ready')),
    prompt TEXT,
    params_json TEXT,
    created_at INTEGER NOT NULL
  )
`);
