import { getDb, save } from "./index";

// Columns that store JSON and need to be parsed when reading
const JSON_COLUMNS = new Set([
  "exercises",
  "increments",
  "workout_schedule",
  "plateau_exercises",
  "stacks",
]);

// Columns that store booleans (SQLite uses 0/1)
const BOOL_COLUMNS = new Set([
  "sound_enabled",
  "vibration_enabled",
  "is_favorite",
]);

type Row = Record<string, unknown>;
type QueryResult<T> = { data: T; error: null } | { data: null; error: Error };

function parseRow(row: Row): Row {
  const parsed: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (JSON_COLUMNS.has(key) && typeof value === "string") {
      try {
        parsed[key] = JSON.parse(value);
      } catch {
        parsed[key] = value;
      }
    } else if (BOOL_COLUMNS.has(key)) {
      parsed[key] = value === 1 || value === true;
    } else {
      parsed[key] = value;
    }
  }
  return parsed;
}

function serializeValue(key: string, value: unknown): unknown {
  if (JSON_COLUMNS.has(key) && typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }
  if (BOOL_COLUMNS.has(key)) {
    return value ? 1 : 0;
  }
  return value;
}

class QueryBuilder {
  private _table: string;
  private _operation: "select" | "insert" | "upsert" | "update" | "delete" =
    "select";
  private _columns: string = "*";
  private _wheres: { col: string; op: string; val: unknown }[] = [];
  private _orderBys: { col: string; ascending: boolean }[] = [];
  private _limitVal: number | null = null;
  private _data: Row | Row[] | null = null;
  private _onConflict: string | null = null;
  private _returnData: boolean = false;
  private _singleReturn: boolean = false;
  private _maybeSingle: boolean = false;

  constructor(table: string) {
    this._table = table;
  }

  select(columns: string = "*"): this {
    if (
      this._operation === "insert" ||
      this._operation === "upsert" ||
      this._operation === "update"
    ) {
      // Chained .select() after insert/upsert/update means "return the data"
      this._returnData = true;
      return this;
    }
    this._operation = "select";
    this._columns = columns;
    return this;
  }

  insert(data: Row | Row[]): this {
    this._operation = "insert";
    this._data = data;
    return this;
  }

  upsert(data: Row | Row[], opts?: { onConflict?: string }): this {
    this._operation = "upsert";
    this._data = data;
    this._onConflict = opts?.onConflict ?? null;
    return this;
  }

  update(data: Row): this {
    this._operation = "update";
    this._data = data;
    return this;
  }

  delete(): this {
    this._operation = "delete";
    return this;
  }

  eq(col: string, val: unknown): this {
    this._wheres.push({ col, op: "=", val });
    return this;
  }

  gte(col: string, val: unknown): this {
    this._wheres.push({ col, op: ">=", val });
    return this;
  }

  lte(col: string, val: unknown): this {
    this._wheres.push({ col, op: "<=", val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this._orderBys.push({ col, ascending: opts?.ascending ?? true });
    return this;
  }

  limit(n: number): this {
    this._limitVal = n;
    return this;
  }

  single(): QueryResult<Row> {
    this._singleReturn = true;
    return this._execute() as QueryResult<Row>;
  }

  maybeSingle(): QueryResult<Row | null> {
    this._maybeSingle = true;
    return this._execute() as QueryResult<Row | null>;
  }

  // Make the builder thenable so `await supabase.from(...).select(...)` works
  then<TResult1 = QueryResult<Row[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<Row[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this._execute() as QueryResult<Row[]>;
      return Promise.resolve(result).then(onfulfilled, onrejected);
    } catch (e) {
      if (onrejected) return Promise.reject(e).catch(onrejected);
      return Promise.reject(e);
    }
  }

  private _execute(): QueryResult<Row[] | Row | null> {
    try {
      const db = getDb();

      switch (this._operation) {
        case "select":
          return this._executeSelect(db);
        case "insert":
          return this._executeInsert(db);
        case "upsert":
          return this._executeUpsert(db);
        case "update":
          return this._executeUpdate(db);
        case "delete":
          return this._executeDelete(db);
      }
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }

  private _buildWhere(): { sql: string; params: unknown[] } {
    if (this._wheres.length === 0) return { sql: "", params: [] };
    const parts: string[] = [];
    const params: unknown[] = [];
    for (const w of this._wheres) {
      parts.push(`"${w.col}" ${w.op} ?`);
      params.push(w.val);
    }
    return { sql: ` WHERE ${parts.join(" AND ")}`, params };
  }

  private _buildOrderLimit(): string {
    let sql = "";
    if (this._orderBys.length > 0) {
      const parts = this._orderBys.map(
        (o) => `"${o.col}" ${o.ascending ? "ASC" : "DESC"}`,
      );
      sql += ` ORDER BY ${parts.join(", ")}`;
    }
    if (this._limitVal != null) {
      sql += ` LIMIT ${this._limitVal}`;
    }
    return sql;
  }

  private _runQuery(sql: string, params: unknown[]): Row[] {
    const stmt = getDb().prepare(sql);
    if (params.length > 0) stmt.bind(params as never);
    const results: Row[] = [];
    while (stmt.step()) {
      results.push(parseRow(stmt.getAsObject() as Row));
    }
    stmt.free();
    return results;
  }

  private _executeSelect(
    _db: ReturnType<typeof getDb>,
  ): QueryResult<Row[] | Row | null> {
    const { sql: whereSql, params } = this._buildWhere();
    const orderLimitSql = this._buildOrderLimit();
    const sql = `SELECT ${
      this._columns === "*"
        ? "*"
        : this._columns
            .split(",")
            .map((c) => `"${c.trim()}"`)
            .join(", ")
    } FROM "${this._table}"${whereSql}${orderLimitSql}`;

    const rows = this._runQuery(sql, params);

    if (this._singleReturn) {
      if (rows.length === 0)
        return { data: null, error: new Error("No rows found") };
      return { data: rows[0], error: null };
    }
    if (this._maybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }
    return { data: rows, error: null };
  }

  private _executeInsert(
    _db: ReturnType<typeof getDb>,
  ): QueryResult<Row[] | Row | null> {
    const rows = Array.isArray(this._data) ? this._data : [this._data!];
    const results: Row[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = keys.map((k) => serializeValue(k, row[k]));
      const placeholders = keys.map(() => "?").join(", ");
      const sql = `INSERT INTO "${this._table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders})`;
      getDb().run(sql, vals as never);

      if (this._returnData) {
        // Fetch the inserted row back
        const lastId = getDb().exec("SELECT last_insert_rowid()")[0]
          ?.values[0]?.[0];
        // Try to get the row by primary key
        const inserted = this._getInsertedRow(row, lastId);
        if (inserted) results.push(inserted);
      }
    }

    // Save after write
    save();

    if (this._returnData) {
      if (this._singleReturn) {
        return { data: results[0] ?? null, error: null };
      }
      return { data: results, error: null };
    }
    return { data: null, error: null };
  }

  private _getInsertedRow(originalRow: Row, lastId: unknown): Row | null {
    // Try id from the original row first, then fall back to last_insert_rowid
    const id = originalRow.id ?? lastId;
    if (id == null) return null;

    // Determine primary key column - for autoincrement tables use "id"
    const sql = `SELECT * FROM "${this._table}" WHERE "id" = ? LIMIT 1`;
    const rows = this._runQuery(sql, [id]);
    return rows[0] ?? null;
  }

  private _executeUpsert(
    _db: ReturnType<typeof getDb>,
  ): QueryResult<Row[] | Row | null> {
    const rows = Array.isArray(this._data) ? this._data : [this._data!];
    const results: Row[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const vals = keys.map((k) => serializeValue(k, row[k]));
      const placeholders = keys.map(() => "?").join(", ");

      // Build ON CONFLICT clause
      let conflictTarget: string;
      if (this._onConflict) {
        // Remove user_id from onConflict since we dropped that column
        const cols = this._onConflict
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c !== "user_id");
        conflictTarget = `(${cols.map((c) => `"${c}"`).join(", ")})`;
      } else {
        // Infer from primary key - try "id" or "name" as common PKs
        conflictTarget = row.id !== undefined ? '("id")' : '("name")';
      }

      const updateParts = keys
        .map((k) => `"${k}" = excluded."${k}"`)
        .join(", ");
      const sql = `INSERT INTO "${this._table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateParts}`;

      getDb().run(sql, vals as never);

      if (this._returnData) {
        const inserted = this._getInsertedRow(row, null);
        if (inserted) results.push(inserted);
      }
    }

    // Save after write
    save();

    if (this._returnData) {
      if (this._singleReturn) {
        return { data: results[0] ?? null, error: null };
      }
      return { data: results, error: null };
    }
    return { data: null, error: null };
  }

  private _executeUpdate(
    _db: ReturnType<typeof getDb>,
  ): QueryResult<Row[] | Row | null> {
    const row = this._data as Row;
    const keys = Object.keys(row);
    const vals = keys.map((k) => serializeValue(k, row[k]));
    const setParts = keys.map((k) => `"${k}" = ?`).join(", ");
    const { sql: whereSql, params: whereParams } = this._buildWhere();
    const sql = `UPDATE "${this._table}" SET ${setParts}${whereSql}`;
    getDb().run(sql, [...vals, ...whereParams] as never);

    // Save after write
    save();
    return { data: null, error: null };
  }

  private _executeDelete(
    _db: ReturnType<typeof getDb>,
  ): QueryResult<Row[] | Row | null> {
    const { sql: whereSql, params } = this._buildWhere();
    const sql = `DELETE FROM "${this._table}"${whereSql}`;
    getDb().run(sql, params as never);

    // Save after write
    save();
    return { data: null, error: null };
  }
}

// RPC implementations
function executeRpc(
  name: string,
  params: Record<string, unknown>,
): QueryResult<Row[]> {
  try {
    if (name === "frequent_supplements") {
      const limit = (params.lim as number) ?? 15;
      const db = getDb();
      const stmt = db.prepare(
        `SELECT name, dose FROM supplement_entries
         GROUP BY name, dose
         ORDER BY COUNT(*) DESC
         LIMIT ?`,
      );
      stmt.bind([limit] as never);
      const results: Row[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as Row);
      }
      stmt.free();
      return { data: results, error: null };
    }
    return { data: null, error: new Error(`Unknown RPC: ${name}`) };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

// Edge function stub
function invokeFn(
  _name: string,
  _opts?: { body?: unknown },
): Promise<{ data: unknown; error: Error }> {
  return Promise.resolve({
    data: null,
    error: new Error("Edge functions not available in local mode"),
  });
}

export interface SupabaseClient {
  from(table: string): QueryBuilder;
  rpc(name: string, params?: Record<string, unknown>): QueryResult<Row[]>;
  functions: {
    invoke(
      name: string,
      opts?: { body?: unknown },
    ): Promise<{ data: unknown; error: Error | null }>;
  };
  auth: {
    getSession(): Promise<{
      data: { session: { user: { id: string } } | null };
    }>;
    signUp(creds: {
      email: string;
      password: string;
    }): Promise<{ error: Error | null }>;
    signInWithPassword(creds: {
      email: string;
      password: string;
    }): Promise<{ error: Error | null }>;
    signOut(): Promise<void>;
    onAuthStateChange(cb: (event: string, session: unknown) => void): {
      data: { subscription: { unsubscribe: () => void } };
    };
  };
}

export function createLocalClient(): SupabaseClient {
  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(table);
    },

    rpc(
      name: string,
      params: Record<string, unknown> = {},
    ): QueryResult<Row[]> {
      return executeRpc(name, params);
    },

    functions: {
      invoke: invokeFn,
    },

    auth: {
      async getSession() {
        const token =
          typeof localStorage !== "undefined"
            ? localStorage.getItem("github-token")
            : null;
        if (token) {
          return { data: { session: { user: { id: "local" } } } };
        }
        return { data: { session: null } };
      },

      async signUp() {
        return { error: new Error("Use GitHub token authentication") };
      },

      async signInWithPassword() {
        return { error: new Error("Use GitHub token authentication") };
      },

      async signOut() {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("github-token");
        }
      },

      onAuthStateChange(_cb: (event: string, session: unknown) => void) {
        // No-op for local mode
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
}
