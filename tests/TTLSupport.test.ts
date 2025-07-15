import { afterEach, beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { SmartCache } from "../src/SmartCache";

describe('SmartCache', () => {
    let finalizationCallback: (heldValue: { key: object; value: object }) => void;
    const mockUnregister = vi.fn();
    const mockRegister = vi.fn();
    let cache: SmartCache<object | symbol, object | symbol>

    beforeEach(() => {
        vi.useFakeTimers()
        cache = new SmartCache({ defaultTtl: 5000 })

        global.FinalizationRegistry = vi.fn().mockImplementation((callback) => {
            finalizationCallback = callback;
            return {
                register: mockRegister,
                unregister: mockUnregister
            };
        })
    })

    afterEach(() => {
        vi.runAllTimers()
        vi.useRealTimers()
        vi.restoreAllMocks();
        cache.clear()
    })

    it('should expire entry after TTL', async () => {
        expect(cache.size).toEqual(0)

        const key = { myKey: 'key' }
        const value = { key }
        const symKey = Symbol('expire-after-ttl')
        const symValue = Symbol('Value')

        const ttl = 150 // time in milliseconds

        cache.set(key, value, { ttl })
        cache.set(symKey, symValue, { ttl })

        expect(cache.has(key)).toBe(true)
        expect(cache.get(key)).toEqual(value)
        expect(cache.has(symKey)).toBe(true)
        expect(cache.get(symKey)).toEqual(symValue)

        vi.advanceTimersByTime(150)
        expect(cache.has(key)).toBe(false)
        expect(cache.get(key)).toBe(null)
        expect(cache.has(symKey)).toBe(false)
        expect(cache.get(symKey)).toBe(null)

    })

    it('should expire overridden TTL entry earlier than default TTL', () => {
        const key1 = { id: 2 };
        const key2 = { id: 3 };
        const symKey1 = Symbol('ttl-undefined');
        const symKey2 = Symbol('ttl-omitted');
        const value = { name: 'John' };
        const symValue = Symbol('john');

        cache.set(key1, value, { ttl: 500 });
        cache.set(key2, value);

        cache.set(symKey1, symValue, { ttl: 500 });
        cache.set(symKey2, symValue);

        // After 1s, key1 should be gone, key2 should remain
        vi.advanceTimersByTime(1000);

        expect(cache.get(key1)).toBeNull();
        expect(cache.get(key2)).toEqual(value);
        expect(cache.get(symKey1)).toBeNull();
        expect(cache.get(symKey2)).toEqual(symValue);

        // After another 4s (total 5s), key2 should expire too
        vi.advanceTimersByTime(4000);
        expect(cache.get(key2)).toBeNull();
        expect(cache.get(symKey2)).toBeNull();
    });

    it('should not expire when TTL is 0', () => {
        const key1 = { id: 1 };
        const key2 = { id: 2 };
        const value = { name: 'John' };

        cache.set(key1, value, { ttl: 0 });
        cache.set(key2, value, { ttl: undefined });

        vi.advanceTimersByTime(5000);
        expect(cache.get(key1)).toEqual(value);
    })

    it('should use default TTL when ttl is undefined or omitted', () => {
        const key1 = { id: 2 };
        const key2 = { id: 3 };
        const value = { name: 'John' };

        cache.set(key1, value, { ttl: undefined })
        cache.set(key2, value)

        vi.advanceTimersByTime(5000)
        expect(cache.get(key1)).toBeNull()
        expect(cache.get(key2)).toBeNull()
    })

    it('should not expire when defaultTTL is undefined and no TTL is passed', () => {
        const localCache = new SmartCache()
        const key = { id: 1 }
        const value = { name: 'Smart-Cache' }

        localCache.set(key, value)

        vi.advanceTimersByTime(10000)
        expect(localCache.get(key)).toEqual(value)
    })

    it('should not retrieve TTL cleared entries', () => {
        const key1 = { id: 1 }
        const key2 = { id: 2 }
        const value = { name: 'Smart-cache' }

        const ttl1 = 1000
        const ttl2 = 2000

        cache.set(key1, value, { ttl: ttl1 })
        cache.set(key2, value, { ttl: ttl2 })

        vi.advanceTimersByTime(1000)
        expect(cache.has(key1)).toBe(false)
        expect(cache.get(key1)).toBeNull()
        expect(cache.has(key2)).toBe(true)

        vi.advanceTimersByTime(2000)
        expect(cache.get(key2)).toBeNull()
    })

    it('should trigger timeout and FinalizationRegistry unregister on TTL', () => {
        const cache = new SmartCache<object, object>({ defaultTtl: 1000 });
        const key = { name: 'smart-cache' };
        const value = { key };
        const userCleanup = vi.fn();

        // Inject a value with a TTL
        cache.set(key, value, { ttl: 1000 });

        // TTL expires after 1000ms
        vi.advanceTimersByTime(1000);

        // Cache should be cleared
        expect(cache.get(key)).toBeNull();

        // Registry.unregister should be called
        expect(mockUnregister).toHaveBeenCalled();

        // Manually trigger finalization (simulating GC)
        finalizationCallback({ key, value });

        // User cleanup should also be triggered
        expect(userCleanup).not.toHaveBeenCalled(); // because we didn't pass it here

    })

})