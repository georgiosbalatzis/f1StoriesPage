export async function request(url, options = {}) {
  const { timeoutMs = 8000, retries = 1, ...fetchOptions } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      if (!response.ok && response.status >= 500 && attempt < retries) continue;
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) throw error;
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

export async function getJson(url, options) {
  const response = await request(url, { ...options, headers: { Accept: 'application/json', ...(options?.headers || {}) } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}
