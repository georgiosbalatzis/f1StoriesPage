export function createStorage(storage = globalThis.localStorage) {
  return {
    get(key, fallback = null) { try { return JSON.parse(storage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } },
    set(key, value) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { storage.removeItem(key); } catch { /* unavailable */ } }
  };
}

export function createMemoryCache() {
  const values = new Map();
  return { get: key => values.get(key), set: (key, value) => values.set(key, value), clear: () => values.clear() };
}
