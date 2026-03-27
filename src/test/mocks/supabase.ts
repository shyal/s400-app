import { vi } from "vitest";

type QueryResult<T = unknown> =
  | { data: T | null; error: null }
  | { data: null; error: { message: string } };

interface ChainableMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  _result: QueryResult;
}

export function createMockSupabase(
  defaultResult: QueryResult = { data: [], error: null },
) {
  function makeChain(result?: QueryResult): ChainableMock {
    const r = result ?? defaultResult;
    const chain: ChainableMock = {
      _result: r,
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(r),
      maybeSingle: vi.fn().mockResolvedValue(r),
      rpc: vi.fn().mockResolvedValue(r),
    };

    // Make the chain itself thenable (for `await supabase.from(...).select(...)`)
    const thenableChain = new Proxy(chain, {
      get(target, prop) {
        if (prop === "then") {
          return (resolve: (v: QueryResult) => void) => resolve(r);
        }
        return target[prop as keyof ChainableMock];
      },
    });

    // Wire up all chain methods to return the proxy
    for (const method of [
      "select",
      "insert",
      "upsert",
      "delete",
      "update",
      "eq",
      "gte",
      "lte",
      "order",
      "limit",
    ] as const) {
      chain[method].mockReturnValue(thenableChain);
    }

    return thenableChain as ChainableMock;
  }

  const tableResults = new Map<string, QueryResult>();

  const mock = {
    from: vi.fn((table: string) => {
      const result = tableResults.get(table);
      return makeChain(result);
    }),
    rpc: vi.fn().mockResolvedValue(defaultResult),
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    /** Set the result that a specific table will return */
    __setTableResult(table: string, result: QueryResult) {
      tableResults.set(table, result);
    },
    /** Reset all table results */
    __resetTableResults() {
      tableResults.clear();
    },
  };

  return mock;
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;
