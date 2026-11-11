/** Initial home requests must settle even on a stalled connection. */
export async function fetchHomeData(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Home request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}
