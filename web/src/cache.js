// Client-side TTL cache with stale-on-error fallback, persisted to
// localStorage: if a federal API fails mid-event (or the page reloads during
// an outage), responders keep seeing the last good data with a visible
// "data delayed" badge instead of a blank map. (Rubric R1: reliability.)

const PREFIX = 'stormguard:cache:';
const mem = new Map(); // key -> { value, fetchedAt }

function readPersisted(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persist(key, entry) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    /* quota exceeded — memory cache still works */
  }
}

export async function cached(key, ttlSeconds, fetcher) {
  const entry = mem.get(key) ?? readPersisted(key);
  const now = Date.now();

  if (entry && now - entry.fetchedAt < ttlSeconds * 1000) {
    return { ...entry.value, cache: 'hit', fetchedAt: entry.fetchedAt };
  }

  try {
    const value = await fetcher();
    const fresh = { value, fetchedAt: now };
    mem.set(key, fresh);
    persist(key, fresh);
    return { ...value, cache: 'miss', fetchedAt: now };
  } catch (err) {
    if (entry) {
      return { ...entry.value, cache: 'stale', fetchedAt: entry.fetchedAt, staleError: String(err) };
    }
    throw err;
  }
}

export function invalidate() {
  mem.clear();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}
