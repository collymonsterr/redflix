export class LruCache<K, V> {
  private readonly maxSize: number
  private readonly store: Map<K, V>

  constructor(maxSize: number) {
    this.maxSize = Math.max(1, Math.floor(maxSize))
    this.store = new Map<K, V>()
  }

  get(key: K): V | undefined {
    const value = this.store.get(key)
    if (value === undefined) return undefined

    this.store.delete(key)
    this.store.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    if (this.store.has(key)) {
      this.store.delete(key)
    }

    this.store.set(key, value)

    if (this.store.size <= this.maxSize) return

    const oldestKey = this.store.keys().next().value
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey)
    }
  }

  delete(key: K): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}
