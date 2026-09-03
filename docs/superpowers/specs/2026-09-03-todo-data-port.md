# Todo Data Port

## Goal

Provide an opt-in, versioned JSON export/import boundary for application-owned Todo data so a downstream app can offer local backup and append-only restore without coupling users to SQLite, IndexedDB, cloud sync, or a specific file picker.

## Scope

- Export only Todo title, completion state, and creation timestamp in a JSON envelope with a fixed format name and version `1`.
- Treat storage ids as local implementation details: exports omit ids and imports allocate new local ids.
- Validate the entire JSON payload before any write occurs.
- Import uses append-only semantics and reports the number of records created. It never clears or overwrites existing records.
- Preserve the exported title, completion state, and timestamp across all existing Todo adapters.

## Non-goals

- Do not export keys, Agent state, sync state, user paths, logs, database files, themes, or other infrastructure data.
- Do not add file-picker UI, browser download UI, automatic backups, cloud synchronization, deduplication, merge, conflict resolution, or replace/restore semantics.
- Do not promise atomic multi-device restore or a full database backup.

## Validation and limits

- The envelope must have `format: "meow-starter/data-export"`, `version: 1`, a non-empty `exportedAt`, and a `data.todos` array with at most 10,000 entries.
- Each entry must have a string `title`, `done` exactly `0` or `1`, and a non-empty string `createdAt`.
- Unknown format/version, malformed structure, and oversized arrays reject before adapter writes.

## Acceptance criteria

1. Export, JSON serialization, parse, and import preserve Todo title, done state, and creation timestamp while allocating destination-local ids.
2. Import leaves existing records in place and returns an imported count.
3. Invalid content produces no writes.
4. In-memory, IndexedDB, and SQLite adapters implement the same append-import boundary.
5. The port has focused tests plus `npm test`, `npm run typecheck`, `npm run build`, `npm run build:web`, and `npm run check:docs` evidence.
