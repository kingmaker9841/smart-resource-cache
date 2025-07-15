type FinalizationRegistryTarget = object | symbol;

// WeakRef can only hold objects, not symbols
interface CacheEntry<T extends object> {
    weakRef: WeakRef<T>;
    registry: FinalizationRegistry<unknown>;
    timeoutId?: NodeJS.Timeout;
    expiresAt?: number;
    unregisterToken: object
}

interface SymbolCacheEntry<T extends symbol> {
    value: T;
    registry: FinalizationRegistry<unknown>;
    timeoutId?: NodeJS.Timeout;
    expiresAt?: number;
    unregisterToken: object
}

interface NotificationOptions<K, T = FinalizationRegistryTarget> {
    key: K;
    value: T;
    unregisterToken?: T;
    cleanup?: (key: K, value: T) => void;
}

interface SetOptions {
    ttl?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SmartCache<K = any, T = FinalizationRegistryTarget> {
    readonly #cache = new Map<K, CacheEntry<T & object>>();
    readonly #symbolCache = new Map<K, { value: T & symbol; registry: FinalizationRegistry<unknown>; timeoutId?: NodeJS.Timeout; expiresAt?: number; unregisterToken: object }>();
    readonly #defaultTtl?: number;

    constructor(options?: { defaultTtl?: number }) {
        if (typeof FinalizationRegistry !== 'function') {
            throw new Error('FinalizationRegistry is not supported in this environment')
        }
        this.#defaultTtl = options?.defaultTtl;
    }

    /**
     * Gets a value from the cache by key
     * @param key - The key to look up
     * @returns The cached value or null if not found/garbage collected
     */
    get(key: K): T | null {
        // Check object cache first
        if (this.#cache.has(key)) {
            const entry = this.#cache.get(key)!;

            //first check if expired
            if (this.#isExpired(entry.expiresAt)) {
                this.#deleteEntry(key, entry)
            }

            const derefValue = entry.weakRef.deref();

            if (derefValue === undefined) {
                // Clean up dead entry
                this.#deleteEntry(key, entry)
                return null;
            }

            return derefValue as T;
        }

        // Check symbol cache
        if (this.#symbolCache.has(key)) {
            const entry = this.#symbolCache.get(key)!;

            //check if expired for symbol
            if (this.#isExpired(entry.expiresAt)) {
                this.#deleteSymbolEntry(key, entry)
                return null
            }

            return entry.value as T;
        }

        return null;
    }

    /**
     * Sets a value in the cache with automatic cleanup on GC
     * @param key - The key to store under
     * @param value - The value to store (must be object or symbol)
     */
    set(key: K, value: T, options?: SetOptions): void {
        this.#validateInputs(key, value);

        // Clean up existing entries
        this.#cleanupExistingEntry(key);

        const ttl = options?.ttl ?? this.#defaultTtl
        const expiresAt = ttl ? Date.now() + ttl : undefined

        const unregisterToken = Object(Symbol())
        if (typeof value === 'symbol') {
            // Handle symbols separately since WeakRef doesn't support them
            const registry = this.#createFinalizationRegistry();
            const timeoutId = ttl ? this.#createTtlTimeout(key, ttl) : undefined

            const entry: SymbolCacheEntry<T & symbol> = {
                value: value as T & symbol,
                registry,
                timeoutId,
                expiresAt,
                unregisterToken
            }
            this.#symbolCache.set(key, entry);
            registry.register(value as unknown as object, { key, value }, unregisterToken);
        } else {
            // Handle objects with WeakRef
            const registry = this.#createFinalizationRegistry();
            const weakRef = new WeakRef(value as T & object);
            const timeoutId = ttl ? this.#createTtlTimeout(key, ttl) : undefined

            const entry: CacheEntry<T & object> = {
                weakRef,
                registry,
                timeoutId,
                expiresAt,
                unregisterToken
            }
            this.#cache.set(key, entry);
            registry.register(value as object, { key, value }, unregisterToken);
        }
    }

    /**
     * Registers for GC notification without storing in cache
     * @param options - Notification options
     */
    getNotificationOnGC(options: NotificationOptions<K, T>): void {
        const { key, value, unregisterToken, cleanup } = options;
        this.#validateInputs(key, value);

        const registry = this.#createFinalizationRegistry(cleanup);
        registry.register(value as unknown as object, { key, value }, unregisterToken as object);
    }

    /**
     * Manually removes an entry from the cache
     * @param key - The key to remove
     * @returns true if the key existed and was removed
     */
    delete(key: K): boolean {
        let deleted = false;

        if (this.#cache.has(key)) {
            const entry = this.#cache.get(key)!;
            this.#deleteEntry(key, entry)
            deleted = true;
        }

        if (this.#symbolCache.has(key)) {
            const entry = this.#symbolCache.get(key)!;
            this.#deleteSymbolEntry(key, entry);
            deleted = true;
        }

        return deleted;
    }

    /**
     * Checks if a key exists in the cache and its value is still alive and not expired
     * @param key - The key to check
     * @returns true if key exists and value is still alive and non-expired
     */
    has(key: K): boolean {
        // Check object cache
        if (this.#cache.has(key)) {
            const entry = this.#cache.get(key)!;

            //check if expired
            if (this.#isExpired(entry.expiresAt)) {
                this.#deleteEntry(key, entry)
                return false;
            }

            const isAlive = entry.weakRef.deref() !== undefined;

            if (!isAlive) {
                this.#deleteEntry(key, entry)
                return false;
            }
            return true;
        }

        // Check symbol cache (symbols are always "alive" until GC'd)
        if (this.#symbolCache.has(key)) {
            const entry = this.#symbolCache.get(key)!;

            if (this.#isExpired(entry.expiresAt)) {
                this.#deleteSymbolEntry(key, entry);
                return false;
            }

            return true
        }

        return false;
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

        // Clean up dead/expired entries
        deadKeys.forEach(key => this.delete(key));

        return aliveCount;
    }

    /**
     * Clears all entries from the cache
     */
    clear(): void {
        // Clear all timeouts before clearing caches
        for (const entry of this.#cache.values()) {
            if (entry.timeoutId) {
                clearTimeout(entry.timeoutId);
            }
            if (entry.unregisterToken) {
                this.#unregisterRegistry(entry.registry, entry.unregisterToken)
            }
        }

        for (const entry of this.#symbolCache.values()) {
            if (entry.timeoutId) {
                clearTimeout(entry.timeoutId);
            }
            if (entry.unregisterToken) {
                this.#unregisterRegistry(entry.registry, entry.unregisterToken)
            }
        }

        this.#cache.clear();
        this.#symbolCache.clear();
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

        deadKeys.forEach(key => this.delete(key));

        return aliveKeys;
    }

    /**
     * Gets TTL information for a key
     * @param key - The key to check
     * @returns TTL info or null if key doesn't exist
     */
    getTtl(key: K): { ttl: number; expiresAt: number } | null {
        const entry = this.#cache.get(key) || this.#symbolCache.get(key);

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

        if (!objectEntry && !symbolEntry) {
            return false;
        }

        const entry = objectEntry || symbolEntry!;

        // Clear existing timeout
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId);
        }

        // Set new timeout and expiration
        entry.timeoutId = this.#createTtlTimeout(key, ttl);
        entry.expiresAt = Date.now() + ttl;

        return true;
    }

    /**
     * Validates input parameters
     * @private
     */
    #validateInputs(key: K, value: T): void {
        if (key === null || key === undefined) {
            throw new Error('Key must be provided and cannot be null or undefined');
        }

        if (value === null || value === undefined) {
            throw new Error('Value must be provided and cannot be null or undefined');
        }

        // Additional type check for runtime safety
        if (typeof value !== 'object' && typeof value !== 'symbol') {
            throw new Error('Value must be an object or symbol (garbage collectable)');
        }
    }

    /**
     * Creates a finalization registry for GC notifications
     * @private
     */
    #createFinalizationRegistry(
        userCleanup?: (key: K, value: T) => void
    ): FinalizationRegistry<{ key: K; value: T }> {
        return new FinalizationRegistry((heldValue: { key: K; value: T }) => {
            // console.log(`Object with key`, heldValue.key, `was GC'd`);

            // Clean up the appropriate cache
            if (typeof heldValue.value === 'symbol') {
                const entry = this.#symbolCache.get(heldValue.key);
                if (entry) {
                    this.#deleteSymbolEntry(heldValue.key, entry);
                }
            } else {
                const entry = this.#cache.get(heldValue.key);
                if (entry && entry.weakRef.deref() === undefined) {
                    this.#deleteEntry(heldValue.key, entry);
                }
            }

            // Execute user cleanup function
            try {
                userCleanup?.(heldValue.key, heldValue.value);
            } catch (error) {
                console.error('Error in cleanup function:', error);
            }
        });
    }

    /**
     * Cleans up existing entry if it exists
     * @private
     */
    #cleanupExistingEntry(key: K): void {
        const objectEntry = this.#cache.get(key);
        const symbolEntry = this.#symbolCache.get(key);

        if (objectEntry) {
            this.#deleteEntry(key, objectEntry);
        }

        if (symbolEntry) {
            this.#deleteSymbolEntry(key, symbolEntry);
        }
    }


    #createTtlTimeout(key: K, ttl: number): NodeJS.Timeout {
        return setTimeout(() => {
            const entry = this.#cache.get(key) || this.#symbolCache.get(key);
            if (entry) {
                this.#unregisterRegistry(entry.registry, entry.unregisterToken);
                if ('weakRef' in entry) {
                    this.#deleteEntry(key, entry)
                } else {
                    this.#deleteSymbolEntry(key, entry)
                }
            }
        }, ttl)
    }

    /**
     * Checks if an entry is expired
     * @private
     */
    #isExpired(expiresAt?: number): boolean {
        return expiresAt !== undefined && Date.now() > expiresAt
    }

    /** 
    * Deletes an object cache entry with proper cleanup 
    * @private
    */
    #deleteEntry(key: K, entry: CacheEntry<T & object>): void {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId)
        }
        if (entry.unregisterToken) {
            this.#unregisterRegistry(entry.registry, entry.unregisterToken)
        }
        this.#cache.delete(key)
    }

    /**
     * Deletes an symbol cache entry with proper cleanup 
     * @private
     */
    #deleteSymbolEntry(key: K, entry: SymbolCacheEntry<T & symbol>): void {
        if (entry.timeoutId) {
            clearTimeout(entry.timeoutId)
        }
        if (entry.unregisterToken) {
            this.#unregisterRegistry(entry.registry, entry.unregisterToken)
        }
        this.#symbolCache.delete(key)
    }

    #unregisterRegistry(
        registry: FinalizationRegistry<{ key: K; value: T }>,
        token: object
    ): void {
        try {
            registry.unregister(token);
        } catch (error) {
            console.error('Failed to unregister FinalizationRegistry token:', error);
        }
    }

}