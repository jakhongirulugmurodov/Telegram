/**
 * SQLite. Ma’lumot hajmi juda kichik (bir nechta oila a’zosi), shuning uchun
 * Postgres ortiqcha bo‘lardi. Bitta fayl — zaxira nusxa olish ham oson.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  -- Oila a'zosi = bitta telefon = bitta Telegram akkaunt.
  -- Ilova /start yuborganda o'zi qo'shiladi.
  CREATE TABLE IF NOT EXISTS members (
    chat_id     INTEGER PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    username    TEXT,
    label       TEXT,            -- admin qo'ygan nom ("Zarina telefoni")
    created_at  INTEGER NOT NULL,
    seen_at     INTEGER NOT NULL
  );

  -- Ilovadan kelgan oxirgi "ok|list" javobi. Haqiqat manbai telefonda,
  -- bu faqat kesh — shuning uchun vaqti ham saqlanadi.
  CREATE TABLE IF NOT EXISTS allowlist_cache (
    chat_id     INTEGER PRIMARY KEY,
    entries     TEXT NOT NULL DEFAULT '',   -- '\n' bilan ajratilgan
    updated_at  INTEGER NOT NULL
  );

  -- "Begona yozdi" qatorlari. Xabar matni yo'q — faqat kim va qachon.
  CREATE TABLE IF NOT EXISTS log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id     INTEGER NOT NULL,
    dialog_id   TEXT NOT NULL,
    who         TEXT NOT NULL,
    at          INTEGER NOT NULL,
    handled     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS log_at ON log (at DESC);
`);

const now = () => Date.now();

export interface Member {
  chat_id: number;
  name: string;
  username: string | null;
  label: string | null;
  created_at: number;
  seen_at: number;
}

export function upsertMember(chatId: number, name: string, username: string | null): void {
  db.prepare(
    `INSERT INTO members (chat_id, name, username, created_at, seen_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET name = excluded.name,
                                        username = excluded.username,
                                        seen_at = excluded.seen_at`
  ).run(chatId, name, username, now(), now());
}

export function touchMember(chatId: number): void {
  db.prepare(`UPDATE members SET seen_at = ? WHERE chat_id = ?`).run(now(), chatId);
}

export function setLabel(chatId: number, label: string): void {
  db.prepare(`UPDATE members SET label = ? WHERE chat_id = ?`).run(label, chatId);
}

export function listMembers(): Member[] {
  return db.prepare(`SELECT * FROM members ORDER BY created_at`).all() as Member[];
}

export function getMember(chatId: number): Member | undefined {
  return db.prepare(`SELECT * FROM members WHERE chat_id = ?`).get(chatId) as Member | undefined;
}

export function saveAllowlist(chatId: number, entries: string[]): void {
  db.prepare(
    `INSERT INTO allowlist_cache (chat_id, entries, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET entries = excluded.entries,
                                        updated_at = excluded.updated_at`
  ).run(chatId, entries.join("\n"), now());
}

export function getAllowlist(chatId: number): { entries: string[]; updatedAt: number } | null {
  const row = db
    .prepare(`SELECT entries, updated_at FROM allowlist_cache WHERE chat_id = ?`)
    .get(chatId) as { entries: string; updated_at: number } | undefined;
  if (!row) return null;
  return {
    entries: row.entries.length ? row.entries.split("\n") : [],
    updatedAt: row.updated_at,
  };
}

export function addLog(chatId: number, dialogId: string, who: string): number {
  const info = db
    .prepare(`INSERT INTO log (chat_id, dialog_id, who, at) VALUES (?, ?, ?, ?)`)
    .run(chatId, dialogId, who, now());
  return Number(info.lastInsertRowid);
}

export function recentLog(limit = 50) {
  return db.prepare(`SELECT * FROM log ORDER BY at DESC LIMIT ?`).all(limit) as Array<{
    id: number;
    chat_id: number;
    dialog_id: string;
    who: string;
    at: number;
    handled: number;
  }>;
}

export function markLogHandled(id: number): void {
  db.prepare(`UPDATE log SET handled = 1 WHERE id = ?`).run(id);
}
