use tauri_plugin_sql::{Migration, MigrationKind};

/// SQLite 数据库文件名，需与 tauri.conf.json 中 `plugins.sql.preload` 保持一致。
pub const DB_URL: &str = "sqlite:app.db";

/// 返回按版本号升序执行的迁移列表。
///
/// 注意：每条迁移**只写一条 SQL 语句**。底层 sqlx 的 `execute` 不支持多语句，
/// 把 `CREATE TABLE` 和 `CREATE INDEX` 塞进同一条迁移会在运行时报错。
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_todos",
            sql: r#"CREATE TABLE IF NOT EXISTS todos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    done INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )"#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "index_todos_created_at",
            sql: "CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "index_todos_done",
            sql: "CREATE INDEX IF NOT EXISTS idx_todos_done ON todos(done)",
            kind: MigrationKind::Up,
        },
    ]
}
