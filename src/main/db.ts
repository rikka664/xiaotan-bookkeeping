// 本地账本数据库：账本文件保存在用户电脑的应用数据目录里（不联网、不上传）
import { app } from 'electron'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) {
    const dbPath = join(app.getPath('userData'), 'xiaotan.db')
    db = new DatabaseSync(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount_cents INTEGER NOT NULL,
        category_l1 TEXT NOT NULL,
        category_l2 TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    `)
  }
  return db
}
