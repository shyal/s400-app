import initSqlJs from "sql.js";
import { readDatabase, writeDatabase } from "./opfs.js";
let db = null;
let sqlPromise = null;
let dbFilename = "supahub.sqlite";
let onSave = null;
let configuredWasmUrl = "/sql-wasm.wasm";
function getSql(wasmUrl) {
    if (!sqlPromise) {
        sqlPromise = initSqlJs({
            locateFile: () => wasmUrl,
        });
    }
    return sqlPromise;
}
export async function initDb(opts = {}) {
    if (db)
        return;
    configuredWasmUrl = opts.wasmUrl ?? "/sql-wasm.wasm";
    dbFilename = opts.filename ?? "supahub.sqlite";
    onSave = opts.onSave ?? null;
    const SQL = await getSql(configuredWasmUrl);
    const existing = await readDatabase(dbFilename);
    if (existing) {
        let candidate = null;
        try {
            candidate = new SQL.Database(existing);
            // sql.js validates the file lazily — force a parse with a trivial query
            // so a corrupt blob throws here instead of later inside user code.
            candidate.exec("SELECT 1");
            db = candidate;
        }
        catch (e) {
            // OPFS/IDB blob is corrupt or not a valid SQLite file (e.g. previous
            // partial pull). Start with an empty DB so the app can boot; a
            // subsequent pull will populate it from remote.
            console.warn(`[supahub] Persisted DB at "${dbFilename}" is corrupt, starting fresh:`, e);
            try {
                candidate?.close();
            }
            catch { }
            db = new SQL.Database();
        }
    }
    else {
        db = new SQL.Database();
    }
    if (opts.schema) {
        db.run(opts.schema);
    }
    await save();
}
export function getDb() {
    if (!db)
        throw new Error("Database not initialized. Call initDb() first.");
    return db;
}
export function run(sql, params) {
    getDb().run(sql, params);
}
export function queryAll(sql, params) {
    const stmt = getDb().prepare(sql);
    if (params)
        stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}
export function queryOne(sql, params) {
    const results = queryAll(sql, params);
    return results[0] ?? null;
}
export async function save() {
    if (!db)
        return;
    const data = db.export();
    await writeDatabase(dbFilename, data);
    onSave?.();
}
export function exportBytes() {
    return getDb().export();
}
export async function importBytes(data) {
    const SQL = await getSql(configuredWasmUrl);
    // Validate the bytes are actually a SQLite file BEFORE swapping in.
    // Otherwise a bad fetch (HTML/JSON error body, truncated download) could
    // poison both the in-memory DB and the OPFS blob.
    const candidate = new SQL.Database(data);
    try {
        candidate.exec("SELECT 1");
    }
    catch (e) {
        try {
            candidate.close();
        }
        catch { }
        throw new Error(`importBytes: input is not a valid SQLite database (${data.byteLength} bytes): ${e}`);
    }
    if (db)
        db.close();
    db = candidate;
    await save();
}
export function isInitialized() {
    return db !== null;
}
