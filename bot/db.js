/**
 * bot/db.js — SQLite helper for Miwa bot
 * Caches Discord avatars and phrasebook entries.
 *
 * Security:
 * - ALL queries use prepared statements (no string concatenation)
 * - WAL mode for concurrent read safety
 * - TTL enforced in getCachedAvatar — stale data never served
 */



import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "miwa.sqlite");
const AVATAR_TTL_MS = 60 * 60 * 1000; // 1 hour cache
let db;

/**
 * Initialize the database.
 * Must be called once before any other function
 */
export function initDb() {
    db = new Database(DB_PATH);

    // WAL: better concurrent read performance
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("synchronous = NORMAL");

  // Avatar cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS avatars (
      user_id    TEXT PRIMARY KEY,
      username   TEXT NOT NULL,
      avatar_b64 TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Phrasebook — slot 1–9 maps to Ctrl+1–9 hotkeys
  db.exec(`
    CREATE TABLE IF NOT EXISTS phrasebook (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      jp         TEXT NOT NULL,
      romaji     TEXT NOT NULL,
      en         TEXT NOT NULL,
      slot       INTEGER UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);


   console.log("[db] SQLite initialized at", DB_PATH);
}








/**
 * Get cached avatar for a user, if it exists and is fresh.
 * Retur null if not found or older than 1 hour.
 */
export function getCachedAvatar(userId) {
    if (!db) throw new Error("DB not initialized - call initDb() first");

    const row = db
        .prepare("SELECT avatar_b64, updated_at FROM avatars WHERE user_id = ?")
        .get(userId);

    if (!row) return null;
    if (Date.now() - row.updated_at > AVATAR_TTL_MS) return null; // stale
    
    return row.avatar_b64;
}






/**
 * Save or update a user's avatar in the cache.
 * UPSERT — safe to call multiple times for the same user.
 */
export function saveAvatar(userId, username, avatarB64) {
  if (!db) throw new Error("DB not initialized — call initDb() first");

  db.prepare(`
    INSERT INTO avatars (user_id, username, avatar_b64, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username   = excluded.username,
      avatar_b64 = excluded.avatar_b64,
      updated_at = excluded.updated_at
  `).run(userId, username, avatarB64, Date.now());
}







/**
 * Save a phrase to the phrasebook.
 * If slot(1-9) is provided, that slot is replaced.
 */
export function savePhrase(jp, romaji, en, slot = null) {
    if (!db) throw new Error("DB not initialized - call initDb() first");
    if (slot !== null && (slot < 1 || slot > 9)) {
        throw new Error("Slot must be 1-9");
  }

  db.prepare(`
    INSERT INTO phrasebook (jp, romaji, en, slot, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(slot) DO UPDATE SET
      jp         = excluded.jp,
      romaji     = excluded.romaji,
      en         = excluded.en,
      created_at = excluded.created_at
  `).run(jp, romaji, en, slot, Date.now());
}





/**
 * Get all phrasebook entries.
 * Ordered by slot (1–9 first), then creation date.
 */
export function getPhrasebook() {
  if (!db) throw new Error("DB not initialized — call initDb() first");

  return db
    .prepare(
      "SELECT id, jp, romaji, en, slot FROM phrasebook ORDER BY slot ASC NULLS LAST, created_at DESC"
    )
    .all();
}

/**
 * Get a single phrasebook entry by slot number.
 */
export function getPhraseBySlot(slot) {
  if (!db) throw new Error("DB not initialized — call initDb() first");
  if (slot < 1 || slot > 9) throw new Error("Slot must be 1–9");

  return db
    .prepare("SELECT jp, romaji, en FROM phrasebook WHERE slot = ?")
    .get(slot);
}

/**
 * Delete a phrasebook entry by database id.
 */
export function deletePhrase(id) {
  if (!db) throw new Error("DB not initialized — call initDb() first");

  db.prepare("DELETE FROM phrasebook WHERE id = ?").run(id);
}

/**
 * Close the database. Call on process exit.
 */
export function closeDb() {
  if (db) {
    db.close();
    console.log("[db] SQLite connection closed");
  }}