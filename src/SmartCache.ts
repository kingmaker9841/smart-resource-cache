type FinalizationRegistryTarget = object | symbol;

// WeakRef can only hold objects, not symbols
interface CacheEntry<T extends object> {
    weakRef: WeakRef<T>;
    registry: FinalizationRegistry<unknown>;
}

interface NotificationOptions<K, T extends FinalizationRegistryTarget> {
    key: K;
    value: T;
    unregisterToken?: T;
    cleanup?: (key: K, value: T) => void;
}

export class SmartCache<T extends FinalizationRegistryTarget, K = any> {
    readonly #cache = new Map<K, CacheEntry<T & object>>();
    readonly #symbolCache = new Map<K, { value: T & symbol; registry: FinalizationRegistry<unknown> }>();

    /**
     * Gets a value from the cache by key
     * @param key - The key to look up
     * @returns The cached value or null if not found/garbage collected
     */
    get(key: K): T | null {
        // Check object cache first
        if (this.#cache.has(key)) {
            const entry = this.#cache.get(key)!;
            const derefValue = entry.weakRef.deref();

            if (derefValue === undefined) {
                // Clean up dead entry
                this.#cache.delete(key);
                return null;
            }

            return derefValue as T;
        }

        // Check symbol cache
        if (this.#symbolCache.has(key)) {
            const entry = this.#symbolCache.get(key)!;
            return entry.value as T;
        }

        return null;
    }

    /**
     * Sets a value in the cache with automatic cleanup on GC
     * @param key - The key to store under
     * @param value - The value to store (must be object or symbol)
     */
    set(key: K, value: T): void {
        this.#validateInputs(key, value);

        // Clean up existing entries
        this.#cleanupExistingEntry(key);

        if (typeof value === 'symbol') {
            // Handle symbols separately since WeakRef doesn't support them
            const registry = this.#createFinalizationRegistry(key, value);
            this.#symbolCache.set(key, {
                value: value as T & symbol,
                registry
            });
            registry.register(value as unknown as object, { key, value });
        } else {
            // Handle objects with WeakRef
            const registry = this.#createFinalizationRegistry(key, value);
            const weakRef = new WeakRef(value as T & object);

            this.#cache.set(key, { weakRef, registry });
            registry.register(value, { key, value });
        }
    }

    /**
     * Registers for GC notification without storing in cache
     * @param options - Notification options
     */
    getNotificationOnGC(options: NotificationOptions<K, T>): void {
        const { key, value, unregisterToken, cleanup } = options;
        this.#validateInputs(key, value);

        const registry = this.#createFinalizationRegistry(key, value, cleanup);
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
            this.#cache.delete(key);
            deleted = true;
        }

        if (this.#symbolCache.has(key)) {
            this.#symbolCache.delete(key);
            deleted = true;
        }

        return deleted;
    }

    /**
     * Checks if a key exists in the cache and its value is still alive
     * @param key - The key to check
     * @returns true if key exists and value is still alive
     */
    has(key: K): boolean {
        // Check object cache
        if (this.#cache.has(key)) {
            const entry = this.#cache.get(key)!;
            const isAlive = entry.weakRef.deref() !== undefined;

            if (!isAlive) {
                this.#cache.delete(key);
                return false;
            }
            return true;
        }

        // Check symbol cache (symbols are always "alive" until GC'd)
        if (this.#symbolCache.has(key)) {
            return true;
        }

        return false;
    }

    /**
     * Gets the number of entries in the cache (only alive ones)
     * @returns The number of alive entries
     */
    get size(): number {
        // Clean up dead object entries and count alive ones
        let aliveCount = 0;
        const deadKeys: K[] = [];

        for (const [key, entry] of this.#cache) {
            if (entry.weakRef.deref() !== undefined) {
                aliveCount++;
            } else {
                deadKeys.push(key);
            }
        }

        deadKeys.forEach(key => this.#cache.delete(key));

        // Add symbol cache size (symbols don't become "dead" until GC'd)
        aliveCount += this.#symbolCache.size;

        return aliveCount;
    }

    /**
     * Clears all entries from the cache
     */
    clear(): void {
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
            if (entry.weakRef.deref() !== undefined) {
                aliveKeys.push(key);
            } else {
                deadKeys.push(key);
            }
        }

        deadKeys.forEach(key => this.#cache.delete(key));

        aliveKeys.push(...this.#symbolCache.keys());

        return aliveKeys;
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
        key: K,
        value: T,
        userCleanup?: (key: K, value: T) => void
    ): FinalizationRegistry<{ key: K; value: T }> {
        return new FinalizationRegistry((heldValue: { key: K; value: T }) => {
            console.log(`Object with key ${String(heldValue.key)} was GC'd`);

            // Clean up the appropriate cache
            if (typeof heldValue.value === 'symbol') {
                this.#symbolCache.delete(heldValue.key);
            } else {
                const entry = this.#cache.get(heldValue.key);
                if (entry && entry.weakRef.deref() === undefined) {
                    this.#cache.delete(heldValue.key);
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
        this.#cache.delete(key);
        this.#symbolCache.delete(key);
    }
}