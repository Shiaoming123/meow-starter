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
        Migration {
            version: 4,
            description: "create_sync_outbox",
            sql: "CREATE TABLE IF NOT EXISTS sync_outbox (operation_id TEXT PRIMARY KEY, mutation TEXT NOT NULL)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create_sync_conflicts",
            sql: "CREATE TABLE IF NOT EXISTS sync_conflicts (operation_id TEXT PRIMARY KEY, conflict TEXT NOT NULL)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_sync_applied_operations",
            sql: "CREATE TABLE IF NOT EXISTS sync_applied_operations (operation_id TEXT PRIMARY KEY)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_sync_metadata",
            sql: "CREATE TABLE IF NOT EXISTS sync_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
            kind: MigrationKind::Up,
        },
        // Versions 4-7 had no account scope. Keep those rows quarantined instead of
        // guessing which account owns them, then recreate the active tables with
        // owner-scoped composite keys.
        Migration {
            version: 8,
            description: "quarantine_unscoped_sync_outbox",
            sql: "ALTER TABLE sync_outbox RENAME TO sync_outbox_unscoped",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "create_owner_scoped_sync_outbox",
            sql: "CREATE TABLE sync_outbox (owner_id TEXT NOT NULL, operation_id TEXT NOT NULL, mutation TEXT NOT NULL, PRIMARY KEY (owner_id, operation_id))",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "quarantine_unscoped_sync_conflicts",
            sql: "ALTER TABLE sync_conflicts RENAME TO sync_conflicts_unscoped",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "create_owner_scoped_sync_conflicts",
            sql: "CREATE TABLE sync_conflicts (owner_id TEXT NOT NULL, operation_id TEXT NOT NULL, conflict TEXT NOT NULL, PRIMARY KEY (owner_id, operation_id))",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "quarantine_unscoped_sync_applied_operations",
            sql: "ALTER TABLE sync_applied_operations RENAME TO sync_applied_operations_unscoped",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "create_owner_scoped_sync_applied_operations",
            sql: "CREATE TABLE sync_applied_operations (owner_id TEXT NOT NULL, operation_id TEXT NOT NULL, PRIMARY KEY (owner_id, operation_id))",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "quarantine_unscoped_sync_metadata",
            sql: "ALTER TABLE sync_metadata RENAME TO sync_metadata_unscoped",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "create_owner_scoped_sync_metadata",
            sql: "CREATE TABLE sync_metadata (owner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (owner_id, key))",
            kind: MigrationKind::Up,
        },
    ]
}
