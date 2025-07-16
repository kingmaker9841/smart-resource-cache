import { afterEach, beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { SmartCache } from "../src/SmartCache";

describe('SmartCache', () => {
    let finalizationCallback: (heldValue: { key: object; value: object }) => void;
    const mockUnregister = vi.fn();
    const mockRegister = vi.fn();
    let cache: SmartCache<object | symbol | string, object | symbol | string>

    beforeEach(() => {
        vi.useFakeTimers()

        global.FinalizationRegistry = vi.fn().mockImplementation((callback) => {
            finalizationCallback = callback;
            return {
                register: mockRegister,
                unregister: mockUnregister
            };
        })

        cache = new SmartCache({ defaultTtl: 5000 })
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
        const strKey = 'ttl-key';
        const strValue = 'value';

        const ttl = 150 // time in milliseconds

        cache.set(key, value, { ttl })
        cache.set(symKey, symValue, { ttl })
        cache.set(strKey, strValue, { ttl })

        expect(cache.has(key)).toBe(true)
        expect(cache.get(key)).toEqual(value)
        expect(cache.has(symKey)).toBe(true)
        expect(cache.get(symKey)).toEqual(symValue)
        expect(cache.has(strKey)).toBe(true)
        expect(cache.get(strKey)).toEqual(strValue)

        vi.advanceTimersByTime(151)
        expect(cache.has(key)).toBe(false)
        expect(cache.get(key)).toBeUndefined()
        expect(cache.has(symKey)).toBe(false)
        expect(cache.get(symKey)).toBeUndefined()
        expect(cache.has(strKey)).toBe(false)
        expect(cache.get(strKey)).toBeUndefined()
    })

    it('should expire overridden TTL entry earlier than default TTL', () => {
        const key1 = { id: 2 };
        const key2 = { id: 3 };
        const symKey1 = Symbol('ttl-undefined');
        const symKey2 = Symbol('ttl-omitted');
        const strKey1 = 'early-expire';
        const strKey2 = 'default-expire';
        const value = { name: 'John' };
        const symValue = Symbol('john');
        const strValue = 'john';

        cache.set(key1, value, { ttl: 500 });
        cache.set(key2, value);

        cache.set(symKey1, symValue, { ttl: 500 });
        cache.set(symKey2, symValue);

        cache.set(strKey1, strValue, { ttl: 500 });
        cache.set(strKey2, strValue);

        vi.advanceTimersByTime(1000);

        expect(cache.get(key1)).toBeUndefined();
        expect(cache.get(key2)).toEqual(value);
        expect(cache.get(symKey1)).toBeUndefined();
        expect(cache.get(symKey2)).toEqual(symValue);
        expect(cache.get(strKey1)).toBeUndefined();
        expect(cache.get(strKey2)).toEqual(strValue);

        vi.advanceTimersByTime(4001);
        expect(cache.get(key2)).toBeUndefined();
        expect(cache.get(symKey2)).toBeUndefined();
        expect(cache.get(strKey2)).toBeUndefined();
    });

    it('should not expire when TTL is 0', () => {
        const key1 = { id: 1 };
        const key2 = { id: 2 };
        const strKey1 = 'no-expire-0';
        const strKey2 = 'no-expire-undef';
        const value = { name: 'John' };

        cache.set(key1, value, { ttl: 0 });
        cache.set(key2, value, { ttl: undefined });
        cache.set(strKey1, 'val', { ttl: 0 });
        cache.set(strKey2, 'val');

        vi.advanceTimersByTime(5001);
        expect(cache.get(key1)).toEqual(value);
        expect(cache.get(key2)).toBeUndefined()
        expect(cache.get(strKey1)).toEqual('val');
        expect(cache.get(strKey2)).toBeUndefined()
    })

    it('should use default TTL when ttl is undefined or omitted', () => {
        const key1 = { id: 2 };
        const key2 = { id: 3 };
        const strKey1 = 'default1';
        const strKey2 = 'default2';
        const value = { name: 'John' };

        cache.set(key1, value, { ttl: undefined })
        cache.set(key2, value)
        cache.set(strKey1, 'a', { ttl: undefined });
        cache.set(strKey2, 'b');

        vi.advanceTimersByTime(5001)
        expect(cache.get(key1)).toBeUndefined()
        expect(cache.get(key2)).toBeUndefined()
        expect(cache.get(strKey1)).toBeUndefined()
        expect(cache.get(strKey2)).toBeUndefined()
    })

    it('should not expire when defaultTTL is undefined and no TTL is passed', () => {
        const localCache = new SmartCache()
        const key = { id: 1 }
        const value = { name: 'Smart-Cache' }
        const strKey = 'non-expire';

        localCache.set(key, value)
        localCache.set(strKey, 'yes')

        vi.advanceTimersByTime(10000)
        expect(localCache.get(key)).toEqual(value)
        expect(localCache.get(strKey)).toEqual('yes')
    })

    it('should not retrieve TTL cleared entries', () => {
        const key1 = { id: 1 }
        const key2 = { id: 2 }
        const strKey1 = 'ttl1';
        const strKey2 = 'ttl2';
        const value = { name: 'Smart-cache' }

        const ttl1 = 1000
        const ttl2 = 2000

        cache.set(key1, value, { ttl: ttl1 })
        cache.set(key2, value, { ttl: ttl2 })
        cache.set(strKey1, 'v1', { ttl: ttl1 })
        cache.set(strKey2, 'v2', { ttl: ttl2 })

        vi.advanceTimersByTime(1001)
        expect(cache.has(key1)).toBe(false)
        expect(cache.get(key1)).toBeUndefined()
        expect(cache.has(key2)).toBe(true)
        expect(cache.has(strKey1)).toBe(false)
        expect(cache.get(strKey1)).toBeUndefined()
        expect(cache.has(strKey2)).toBe(true)

        vi.advanceTimersByTime(2001)
        expect(cache.get(key2)).toBeUndefined()
        expect(cache.get(strKey2)).toBeUndefined()
    })

    it('should trigger timeout and FinalizationRegistry unregister on TTL', () => {
        const cache = new SmartCache<object, object>({ defaultTtl: 1000 });
        const key = { name: 'smart-cache' };
        const value = { key };
        const userCleanup = vi.fn();

        cache.set(key, value, { ttl: 1000 });

        vi.advanceTimersByTime(1000);
        expect(cache.get(key)).toBeUndefined();
        expect(mockUnregister).toHaveBeenCalled();

        finalizationCallback({ key, value });
        expect(userCleanup).not.toHaveBeenCalled();
    })
})
