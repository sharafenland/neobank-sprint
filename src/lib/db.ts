import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/**
 * Connects on first use rather than at import time, so `next build` does not
 * need a database and a missing URL fails with a readable message at request
 * time instead of a cryptic build error.
 */
function connect(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Attach the Neon integration in Vercel, or fill in .env.local.");
    client = neon(url);
  }
  return client;
}

export const sql = new Proxy((() => {}) as unknown as NeonQueryFunction<false, false>, {
  apply: (_target, _thisArg, args: unknown[]) =>
    (connect() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_target, prop: string) => (connect() as unknown as Record<string, unknown>)[prop],
});
