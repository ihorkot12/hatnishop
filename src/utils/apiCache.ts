// Client-side cache + in-flight de-duplication for read-only GET endpoints.
// Several components mount at once on the storefront (Navbar, TopBar, CartContext,
// Home sections, Catalog...) and each independently fetched the same public
// endpoints, producing 4x /products/catalog, 4x /categories/catalog and 2x
// /site-settings per page load. Routing those reads through fetchJsonCached
// collapses the concurrent calls into one request (in-flight dedup) and reuses
// the result across navigations for a short TTL. [AUDIT-M-03]

type CacheEntry = { ts: number; data: unknown };

const DEFAULT_TTL = 60_000;

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

interface FetchJsonOptions {
  /** How long (ms) a resolved response stays fresh in the cache. */
  ttl?: number;
  /** Bypass the cached value and force a network round-trip (still de-duped). */
  force?: boolean;
}

/**
 * Fetch JSON with a short-lived cache and in-flight de-duplication.
 * Rejects on network errors and non-2xx responses; failures are never cached.
 */
export function fetchJsonCached<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { ttl = DEFAULT_TTL, force = false } = options;

  if (!force) {
    const cached = cache.get(url);
    if (cached && Date.now() - cached.ts < ttl) {
      return Promise.resolve(cached.data as T);
    }
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
  }

  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Request to ${url} failed with ${res.status}`);
      return res.json();
    })
    .then((data) => {
      cache.set(url, { ts: Date.now(), data });
      inflight.delete(url);
      return data as T;
    })
    .catch((err) => {
      inflight.delete(url);
      throw err;
    });

  inflight.set(url, request);
  return request as Promise<T>;
}

/**
 * Same as fetchJsonCached but resolves to `fallback` instead of rejecting,
 * preserving the silent-empty-result behaviour of the original call sites.
 */
export function fetchJsonCachedOr<T = unknown>(
  url: string,
  fallback: T,
  options: FetchJsonOptions = {}
): Promise<T> {
  return fetchJsonCached<T>(url, options).catch(() => fallback);
}

/**
 * Drop cached entries. Pass a URL prefix to invalidate matching entries,
 * or omit it to clear everything (e.g. after a mutation from the admin panel).
 */
export function invalidateApiCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(urlPrefix)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(urlPrefix)) inflight.delete(key);
  }
}
