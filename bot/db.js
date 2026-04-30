/**
 * bot/db.js — SQLite helper for Miwa bot
 * Caches Discord avatars and user phrasebook
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "miwa.sqlite");

let db;

export function initDb() {
    db = new Database(DB_PATH);

    // WAL mode: better performance for concurrent reads
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Avatar cache table
    db.exec(`
        `)
}
