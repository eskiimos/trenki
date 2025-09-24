// Простой кеш для API запросов
class SimpleCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5000; // 5 секунд

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Проверяем, не истек ли кеш
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear() {
    this.cache.clear();
  }
}

export const apiCache = new SimpleCache();