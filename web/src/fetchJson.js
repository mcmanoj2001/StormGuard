// fetch wrapper: timeout, retry with backoff, JSON parsing. All federal API
// calls go through here so rate-limit handling lives in one place.

export async function fetchJson(url, { headers = {}, retries = 2, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get('retry-after') ?? 2 ** attempt) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        lastErr = new Error(`Upstream ${res.status} for ${url}`);
        continue;
      }
      if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
