/**
 * In-memory deterministic mock Supabase client for unit and integration testing.
 * Implements standard query chaining: .from().select().insert().update().upsert().delete().eq().single()
 * Faithfully mirrors Supabase JS v2 & PostgREST semantics for mutations, upsert conflict matching,
 * and single/maybeSingle cardinality enforcement.
 */
export function createMockSupabaseClient(initialData: Record<string, any[]> = {}) {
  const store: Record<string, any[]> = {
    profiles: [],
    installations: [],
    projects: [],
    changelogs: [],
    pull_requests: [],
    dodo_webhook_events: [],
    ...initialData,
  };

  return {
    from: (tableName: string) => {
      if (!store[tableName]) {
        store[tableName] = [];
      }
      let filters: Array<(row: any) => boolean> = [];
      let orderField: string | null = null;
      let orderAsc: boolean = true;
      let limitCount: number | null = null;
      let isSingle = false;
      let isMaybeSingle = false;
      let selectCalled = false;
      let action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
      let mutationValues: any = null;
      let upsertOptions: { onConflict?: string; ignoreDuplicates?: boolean } | undefined = undefined;

      const execute = () => {
        const formatResult = (rows: any[], isDelete = false) => {
          if (isSingle) {
            if (rows.length === 0) {
              return {
                data: null,
                error: { message: 'Row not found', code: 'PGRST116' },
                count: 0,
              };
            }
            if (rows.length > 1) {
              return {
                data: null,
                error: {
                  message: 'JSON object requested, multiple rows returned',
                  code: 'PGRST116',
                },
                count: rows.length,
              };
            }
            return {
              data: isDelete && !selectCalled ? null : rows[0],
              error: null,
              count: 1,
            };
          }

          if (isMaybeSingle) {
            if (rows.length > 1) {
              return {
                data: null,
                error: {
                  message: 'JSON object requested, multiple rows returned',
                  code: 'PGRST116',
                },
                count: rows.length,
              };
            }
            return {
              data: isDelete && !selectCalled ? null : (rows[0] || null),
              error: null,
              count: rows.length,
            };
          }

          if (isDelete && !selectCalled) {
            return { data: null, error: null, count: rows.length };
          }

          return { data: rows, error: null, count: rows.length };
        };

        if (action === 'insert') {
          const items = Array.isArray(mutationValues) ? mutationValues : [mutationValues];
          const inserted = items.map((item: any) => ({
            id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString(),
            ...item,
          }));
          store[tableName] = [...store[tableName], ...inserted];
          return formatResult(inserted);
        }

        if (action === 'upsert') {
          const items = Array.isArray(mutationValues) ? mutationValues : [mutationValues];
          const upserted: any[] = [];

          const getConflictCols = (item: any): string[] => {
            if (upsertOptions?.onConflict) {
              return upsertOptions.onConflict
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean);
            }
            // Table-specific unique conflict keys when onConflict option is omitted
            if (tableName === 'dodo_webhook_events' && item.event_id !== undefined) {
              return ['event_id'];
            }
            if (
              tableName === 'pull_requests' &&
              item.project_id !== undefined &&
              item.pr_number !== undefined
            ) {
              return ['project_id', 'pr_number'];
            }
            if (
              tableName === 'installations' &&
              item.github_installation_id !== undefined &&
              item.id === undefined
            ) {
              return ['github_installation_id'];
            }
            if (tableName === 'projects' && item.slug !== undefined && item.id === undefined) {
              return ['slug'];
            }
            return ['id'];
          };

          for (const item of items) {
            const conflictCols = getConflictCols(item);
            const idx = store[tableName].findIndex((r: any) =>
              conflictCols.length > 0 &&
              conflictCols.every(
                (col) => r[col] !== undefined && item[col] !== undefined && r[col] === item[col]
              )
            );

            if (idx >= 0) {
              if (!upsertOptions?.ignoreDuplicates) {
                store[tableName][idx] = {
                  ...store[tableName][idx],
                  ...item,
                  updated_at: item.updated_at || new Date().toISOString(),
                };
              }
              upserted.push(store[tableName][idx]);
            } else {
              const newItem = {
                id: item.id || `mock_${Math.random().toString(36).substring(2, 9)}`,
                created_at: item.created_at || new Date().toISOString(),
                updated_at: item.updated_at || new Date().toISOString(),
                ...item,
              };
              store[tableName].push(newItem);
              upserted.push(newItem);
            }
          }
          return formatResult(upserted);
        }

        if (action === 'update') {
          const updated: any[] = [];
          for (let i = 0; i < store[tableName].length; i++) {
            if (filters.every((f) => f(store[tableName][i]))) {
              store[tableName][i] = {
                ...store[tableName][i],
                ...mutationValues,
                updated_at: new Date().toISOString(),
              };
              updated.push(store[tableName][i]);
            }
          }
          return formatResult(updated);
        }

        if (action === 'delete') {
          const deleted: any[] = [];
          const remaining: any[] = [];
          for (const row of store[tableName]) {
            if (filters.every((f) => f(row))) {
              deleted.push(row);
            } else {
              remaining.push(row);
            }
          }
          store[tableName] = remaining;
          return formatResult(deleted, true);
        }

        // SELECT
        let rows = store[tableName].filter((row: any) =>
          filters.every((f) => f(row))
        );

        if (orderField) {
          rows.sort((a: any, b: any) => {
            if (a[orderField!] < b[orderField!]) return orderAsc ? -1 : 1;
            if (a[orderField!] > b[orderField!]) return orderAsc ? 1 : -1;
            return 0;
          });
        }

        if (limitCount !== null) {
          rows = rows.slice(0, limitCount);
        }

        return formatResult(rows);
      };

      const builder: any = {
        select: (_fields = '*') => {
          selectCalled = true;
          // Preserve active mutation action (insert, update, upsert, delete)
          if (
            action !== 'insert' &&
            action !== 'update' &&
            action !== 'upsert' &&
            action !== 'delete'
          ) {
            action = 'select';
          }
          return builder;
        },
        insert: (data: any | any[]) => {
          action = 'insert';
          mutationValues = data;
          return builder;
        },
        update: (updates: any) => {
          action = 'update';
          mutationValues = updates;
          return builder;
        },
        upsert: (
          values: any | any[],
          options?: { onConflict?: string; ignoreDuplicates?: boolean }
        ) => {
          action = 'upsert';
          mutationValues = values;
          upsertOptions = options;
          return builder;
        },
        delete: () => {
          action = 'delete';
          return builder;
        },
        eq: (column: string, value: any) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        neq: (column: string, value: any) => {
          filters.push((row) => row[column] !== value);
          return builder;
        },
        in: (column: string, values: any[]) => {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        is: (column: string, value: any) => {
          filters.push((row) => row[column] === value);
          return builder;
        },
        gte: (column: string, value: any) => {
          filters.push((row) => row[column] >= value);
          return builder;
        },
        gt: (column: string, value: any) => {
          filters.push((row) => row[column] > value);
          return builder;
        },
        lte: (column: string, value: any) => {
          filters.push((row) => row[column] <= value);
          return builder;
        },
        lt: (column: string, value: any) => {
          filters.push((row) => row[column] < value);
          return builder;
        },
        match: (query: Record<string, any>) => {
          for (const [key, value] of Object.entries(query)) {
            filters.push((row) => row[key] === value);
          }
          return builder;
        },
        order: (column: string, { ascending = true } = {}) => {
          orderField = column;
          orderAsc = ascending;
          return builder;
        },
        limit: (count: number) => {
          limitCount = count;
          return builder;
        },
        single: () => {
          isSingle = true;
          return builder;
        },
        maybeSingle: () => {
          isMaybeSingle = true;
          return builder;
        },
        then: (onfulfilled?: any, onrejected?: any) => {
          try {
            const res = execute();
            return Promise.resolve(res).then(onfulfilled, onrejected);
          } catch (err) {
            if (onrejected) return Promise.resolve(onrejected(err));
            return Promise.reject(err);
          }
        },
      };

      return builder;
    },
    auth: {
      getUser: async () => ({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: { id: 'mock-user-id' } } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
    },
  };
}
