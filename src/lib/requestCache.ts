// Share in-flight requests and briefly reuse successful public market data.
export class RequestCache<T> {
  private entries = new Map<string, { expires: number; promise: Promise<T> }>();

  get(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expires > Date.now()) return cached.promise;
    const promise = Promise.resolve().then(fetcher);
    const entry = { expires: Date.now() + ttlMs, promise };
    if (this.entries.size >= 50) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, entry);
    promise.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return promise;
  }

  clear(): void {
    this.entries.clear();
  }
}
