interface SetOptions {
    ttl?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entry<T> = StringCacheEntry<T> | CacheEntry<any> | SymbolCacheEntry<T>

interface StringCacheEntry<T> {
    value: T;
    timeoutId?: NodeJS.Timeout;
    expiresAt?: number;
    accessTime: number;
}

interface CacheEntry<T extends object> {
    weakRef: WeakRef<T>;
    timeoutId?: NodeJS.Timeout;
    expiresAt?: number;
    accessTime: number;
    unregisterToken: object;
}

interface SymbolCacheEntry<T> {
    value: T;
    timeoutId?: NodeJS.Timeout;
    expiresAt?: number;
    accessTime: number;
    unregisterToken: object;
}

interface NotificationOptions<K, T> {
    key: K;
    value: T;
    unregisterToken: object;
    cleanup?: (heldValue: { key: K; value: T }) => void;
}


interface SetOptions {
    ttl?: number;
}
interface LRUNode<K> {
    key: K;
    prev: LRUNode<K> | null;
    next: LRUNode<K> | null;
}

export class SmartCache<K, T> {
    readonly #stringCache = new Map<K, StringCacheEntry<T & string>>();
    readonly #cache = new Map<K, CacheEntry<T & object>>();
    readonly #symbolCache = new Map<K, {
        accessTime: number; value: T & symbol; timeoutId?: NodeJS.Timeout; expiresAt?: number; unregisterToken: object
    }>();

    readonly #defaultTtl?: number;
    readonly #maxSize: number | undefined;

    // OPTIMIZED: Single linked list for O(1) LRU operations
    #lruHead: LRUNode<K> = { key: null as unknown as K, prev: null, next: null };
    #lruTail: LRUNode<K> = { key: null as unknown as K, prev: null, next: null };
    readonly #lruMap = new Map<K, LRUNode<K>>();
    #currentSize = 0;

    // OPTIMIZED: Single shared FinalizationRegistry
    readonly #sharedRegistry = (() => {
        if (typeof global.FinalizationRegistry !== 'function') {
            throw new Error('FinalizationRegistry is not supported in this environment');
        }
        return new global.FinalizationRegistry<{ key: K; type: 'object' | 'symbol' }>((heldValue) => {
            this.#handleFinalization(heldValue);
        });
    })()

    constructor(options?: { defaultTtl?: number; maxSize?: number }) {
        if (typeof global.FinalizationRegistry !== 'function') {
            throw new Error('FinalizationRegistry is not supported in this environment')
        }
        this.#defaultTtl = options?.defaultTtl;
        this.#maxSize = options?.maxSize;

        // Initialize doubly linked list
        this.#lruHead.next = this.#lruTail;
        this.#lruTail.prev = this.#lruHead;
    }

    /**
     * Gets a value from the cache by key
     * @param key - The key to look up
     * @returns The cached value or null if not found/garbage collected
     */
    get(key: K): T | undefined {
        const { entry, keyType } = this.#getEntry(key);
        if (!entry) return undefined;

        // Only check expiration if TTL is set
        if (entry.expiresAt && this.#isExpired(entry.expiresAt)) {
            this.delete(key);
            return undefined;
        }

        this.#updateLRU(key);

        // Handle different entry types
        switch (keyType) {
            case 'string':
            case 'symbol':
                return (entry as StringCacheEntry<T> | SymbolCacheEntry<T>).value;
            case 'object': {
                const objectEntry = entry as CacheEntry<T & object>;
                const value = objectEntry.weakRef.deref();
                if (!value) {
                    this.delete(key);
                    return undefined;
                }
                return value;
            }
        }

    }

    #getEntry(key: K): { entry: Entry<T> | undefined; keyType: 'string' | 'symbol' | 'object' } {
        if (typeof key === 'string') {
            return { entry: this.#stringCache.get(key), keyType: 'string' };
        }
        if (typeof key === 'symbol') {
            return { entry: this.#symbolCache.get(key), keyType: 'symbol' };
        }
        return { entry: this.#cache.get(key), keyType: 'object' };
    }

    /**
     * Sets a value in the cache with automatic cleanup on GC
     * @param key - The key to store under
     * @param value - The value to store (must be object or symbol)
     */
    set(key: K, value: T, options?: SetOptions): void {
        this.#validateInputs(key, value);
        const { entry: existingEntry, keyType } = this.#getEntry(key);

        if (existingEntry) {
            this.#cleanupExistingEntry(key);
            this.#updateLRU(key);
        }

        // Handle eviction before adding new entry
        if (this.#maxSize && this.#currentSize >= this.#maxSize) {
            this.#evictLRU();
        }

        const ttl = options?.ttl ?? this.#defaultTtl;
        const expiresAt = ttl ? Date.now() + ttl : undefined;
        const accessTime = Date.now();

        // Fast path for string keys
        if (keyType === 'string') {
            const timeoutId = ttl ? this.#createTtlTimeout(key, ttl) : undefined;
            const entry: StringCacheEntry<T & string> = {
                value: value as T & string,
                timeoutId,
                expiresAt,
                accessTime
            };
            this.#stringCache.set(key, entry);
            this.#currentSize++;
            return;
        }

        // Handle symbol keys (check KEY type, not value type)
        if (keyType === 'symbol') {
            const timeoutId = ttl ? this.#createTtlTimeout(key, ttl) : undefined;
            const unregisterToken = Object(Symbol());
            const entry: SymbolCacheEntry<T & symbol> = {
                value: value as T & symbol,
                timeoutId,
                expiresAt,
                accessTime,
                unregisterToken,
            };

            this.#symbolCache.set(key, entry);

            // Register for cleanup only if value is an object
            if (typeof value === 'object' && value !== null) {
                this.#sharedRegistry.register(value as object, { key, type: 'symbol' }, unregisterToken);
            }

            this.#currentSize++;
            return;
        }

        // Handle object values with WeakRef
        if (keyType === 'object' && !Array.isArray(value) && value !== null) {
            const weakRef = new WeakRef(value as T & object);
            const timeoutId = ttl ? this.#createTtlTimeout(key, ttl) : undefined;
            const unregisterToken = Object(Symbol());

            const entry: CacheEntry<T & object> = {
                weakRef,
                timeoutId,
                expiresAt,
                accessTime,
                unregisterToken
            };

            this.#cache.set(key, entry);
            this.#sharedRegistry.register(value as object, { key, type: 'object' }, unregisterToken);
            this.#currentSize++;
        }
    }
    /**
     * Registers for GC notification without storing in cache
     * @param options - Notification options
     */
    getNotificationOnGC(options: NotificationOptions<K, T>): void {
        const { key, value, unregisterToken, cleanup } = options;
        this.#validateInputs(key, value);

        const registry = cleanup ? new FinalizationRegistry(cleanup) : this.#sharedRegistry;
        registry.register(value as unknown as object, { key, value, type: typeof value === 'symbol' ? 'symbol' : 'object' }, unregisterToken);
    }

    /**
     * Manually removes an entry from the cache
     * @param key - The key to remove
     * @returns true if the key existed and was removed
     */
    delete(key: K): boolean {
        const lruNode = this.#lruMap.get(key);
        if (lruNode) {
            this.#removeLRUNode(lruNode);
            this.#lruMap.delete(key);
        }

        let deleted = false;

        if (typeof key === 'string') {
            const entry = this.#stringCache.get(key);
            if (entry) {
                this.#deleteStringEntry(key, entry);
                deleted = true;
            }
        } else if (typeof key === 'symbol') {
            const entry = this.#symbolCache.get(key);
            if (entry) {
                this.#deleteSymbolEntry(key, entry);
                deleted = true;
            }
        } else {
            const entry = this.#cache.get(key);
            if (entry) {
                this.#deleteEntry(key, entry);
                deleted = true;
            }
        }

        if (deleted) {
            this.#currentSize--;
        }

        return deleted;
    }

    /**
     * Checks if a key exists in the cache and its value is still alive and not expired
     * @param key - The key to check
     * @returns true if key exists and value is still alive and non-expired
     */
    has(key: K): boolean {
        if (typeof key === 'string') {
            const entry = this.#stringCache.get(key);
            return entry ? !this.#isExpired(entry.expiresAt) : false;
        }

        if (typeof key === 'symbol') {
            const entry = this.#symbolCache.get(key);
            return entry ? !this.#isExpired(entry.expiresAt) : false;
        }

        const entry = this.#cache.get(key);
        if (!entry || this.#isExpired(entry.expiresAt)) return false;

        return entry.weakRef.deref() !== undefined;
    }

    /**
     * Gets the number of entries in the cache (only alive and non-expired ones)
     * @returns The number of alive and non-expired entries
     */
    get size(): number {
        // Clean up dead object entries and count alive ones
        let aliveCount = 0;
        const deadKeys: K[] = [];

        // Check object cache
        for (const [key, entry] of this.#cache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key);
            } else if (entry.weakRef.deref() !== undefined) {
                aliveCount++;
            } else {
                deadKeys.push(key);
            }
        }

        // Check symbol cache
        for (const [key, entry] of this.#symbolCache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key);
            } else {
                aliveCount++;
            }
        }

        // Check string cache
        for (const [key, entry] of this.#stringCache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key);
            } else {
                aliveCount++;
            }
        }

        // Clean up dead/expired entries
        deadKeys.forEach(key => this.delete(key));

        return aliveCount;
    }

    /**
     * Clears all entries from the cache
     */
    clear(): void {
        // Clear all timeouts
        for (const entry of this.#cache.values()) {
            if (entry.timeoutId) clearTimeout(entry.timeoutId);
            this.#sharedRegistry.unregister(entry.unregisterToken);
        }

        for (const entry of this.#symbolCache.values()) {
            if (entry.timeoutId) clearTimeout(entry.timeoutId);
            this.#sharedRegistry.unregister(entry.unregisterToken);
        }

        for (const entry of this.#stringCache.values()) {
            if (entry.timeoutId) clearTimeout(entry.timeoutId);
        }

        // Clear all data structures
        this.#cache.clear();
        this.#symbolCache.clear();
        this.#stringCache.clear();
        this.#lruMap.clear();
        this.#currentSize = 0;

        // Reset LRU list
        this.#lruHead.next = this.#lruTail;
        this.#lruTail.prev = this.#lruHead;
    }

    // OPTIMIZED: O(1) LRU operations
    #updateLRU(key: K): void {
        const node = this.#lruMap.get(key);
        if (node) {
            // Only move if not already at tail
            if (node.next !== this.#lruTail) {
                this.#moveToTail(node);
            }
        } else {
            // Add new node
            const newNode: LRUNode<K> = { key, prev: null, next: null };
            this.#addToTail(newNode);
            this.#lruMap.set(key, newNode);
        }
    }

    #moveToTail(node: LRUNode<K>): void {
        // Remove from current position
        if (node.prev) node.prev.next = node.next;
        if (node.next) node.next.prev = node.prev;

        // Add to tail
        node.prev = this.#lruTail.prev;
        node.next = this.#lruTail;
        if (this.#lruTail.prev) this.#lruTail.prev.next = node;
        this.#lruTail.prev = node;
    }

    #addToTail(node: LRUNode<K>): void {
        node.prev = this.#lruTail.prev;
        node.next = this.#lruTail;
        if (this.#lruTail.prev) this.#lruTail.prev.next = node;
        this.#lruTail.prev = node;
    }

    #removeLRUNode(node: LRUNode<K>): void {
        if (node.prev) {
            node.prev.next = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
    }

    #evictLRU(): void {
        if (this.#lruHead.next === this.#lruTail) return;

        const oldestNode = this.#lruHead.next;
        if (oldestNode) {
            this.delete(oldestNode.key);
        }
    }

    /**
     * Gets all alive keys in the cache
     * @returns Array of keys with alive values
     */
    keys(): K[] {
        const aliveKeys: K[] = [];
        const deadKeys: K[] = [];

        // Check object cache
        for (const [key, entry] of this.#cache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key);
            } else if (entry.weakRef.deref() !== undefined) {
                aliveKeys.push(key);
            } else {
                deadKeys.push(key);
            }
        }

        // Check symbol cache
        for (const [key, entry] of this.#symbolCache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key);
            } else {
                aliveKeys.push(key);
            }
        }

        for (const [key, entry] of this.#stringCache) {
            if (this.#isExpired(entry.expiresAt)) {
                deadKeys.push(key)
            } else {
                aliveKeys.push(key)
            }
        }

        deadKeys.forEach(key => this.delete(key));

        return aliveKeys;
    }

    /**
     * Gets TTL information for a key
     * @param key - The key to check
     * @returns TTL info or null if key doesn't exist
     */
    getTtl(key: K): { ttl: number; expiresAt: number } | null {
        const entry = this.#cache.get(key) || this.#symbolCache.get(key) || this.#stringCache.get(key);

        if (!entry || !entry.expiresAt) {
            return null;
        }

        const now = Date.now();
        const ttl = Math.max(0, entry.expiresAt - now);

        return {
            ttl,
            expiresAt: entry.expiresAt
        };
    }

    /**
     * Updates the TTL for an existing key
     * @param key - The key to update
     * @param ttl - New TTL in milliseconds
     * @returns true if key existed and TTL was updated
     */
    updateTtl(key: K, ttl: number): boolean {
        const objectEntry = this.#cache.get(key);
        const symbolEntry = this.#symbolCache.get(key);
        const stringEntry = this.#stringCache.get(key);

        if (!objectEntry && !symbolEntry && !stringEntry) {
            return false;
        }

        const entry = objectEntry || symbolEntry! || stringEntry;

        // Clear existing timeout
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
        }

        // Set new timeout and expiration
        entry.timeoutId = this.#createTtlTimeout(key, ttl);
        entry.expiresAt = Date.now() + ttl;

        return true;
    }

    #validateInputs(key: K, value: T): void {
        if (key === null || key === undefined) {
            throw new Error('Key cannot be null or undefined');
        }
        if (value === null || value === undefined) {
            throw new Error('Value cannot be null or undefined');
        }
    }

    // #createFinalizationRegistry(cleanup?: (heldValue: { key: K; value: T }) => void): FinalizationRegistry<{ key: K; value: T }> {
    //     return new FinalizationRegistry<{ key: K; value: T }>(cleanup || ((heldValue) => {
    //         this.delete(heldValue.key);
    //     }));
    // }

    #handleFinalization(heldValue: { key: K; type: 'object' | 'symbol' }): void {
        // Cleanup when object is garbage collected
        this.delete(heldValue.key);
    }

    #cleanupExistingEntry(key: K): void {
        // Remove existing entry if it exists
        this.delete(key);
    }

    #createTtlTimeout(key: K, ttl: number): NodeJS.Timeout {
        return setTimeout(() => {
            this.delete(key);
        }, ttl);
    }


    /**
     * Checks if an entry is expired
     * @private
     */
    #isExpired(expiresAt?: number): boolean {
        return expiresAt !== undefined && Date.now() > expiresAt
    }

    #deleteStringEntry(key: K, entry: StringCacheEntry<T & string>): void {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
        }
        this.#stringCache.delete(key);
    }

    #deleteSymbolEntry(key: K, entry: SymbolCacheEntry<T & symbol>): void {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
        }
        this.#sharedRegistry.unregister(entry.unregisterToken);
        this.#symbolCache.delete(key);
    }

    #deleteEntry(key: K, entry: CacheEntry<T & object>): void {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
        }
        this.#sharedRegistry.unregister(entry.unregisterToken);
        this.#cache.delete(key);
    }

    // Statistics for debugging
    getStats(): {
        size: number;
        stringItems: number;
        objectItems: number;
        symbolItems: number;
        lruNodes: number;
    } {
        return {
            size: this.#currentSize,
            stringItems: this.#stringCache.size,
            objectItems: this.#cache.size,
            symbolItems: this.#symbolCache.size,
            lruNodes: this.#lruMap.size
        };
    }
}