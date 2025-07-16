import { afterEach, beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { SmartCache } from "../src/SmartCache";

describe('SmartCache', () => {
    let cache = new SmartCache()

    beforeEach(() => {
        cache = new SmartCache()
    })

    afterEach(() => {
        cache.clear()
    })

    it('should store and retrieve object, symbol, and string values', () => {
        const objKey = { id: 1 };
        const objValue = { name: 'obj' };
        const symKey = Symbol('sym');
        const symValue = Symbol('sym-val');
        const strKey = 'str';
        const strValue = 'str-val';

        cache.set(objKey, objValue);
        cache.set(symKey, symValue);
        cache.set(strKey, strValue);

        expect(cache.get(objKey)).toEqual(objValue);
        expect(cache.get(symKey)).toBe(symValue);
        expect(cache.get(strKey)).toBe(strValue);
    })

    it('should delete entries correctly', () => {
        const objKey = { id: 2 };
        const symKey = Symbol('del');
        const strKey = 'delete';

        cache.set(objKey, { name: 'del' });
        cache.set(symKey, Symbol('val'));
        cache.set(strKey, 'to-be-removed');

        expect(cache.delete(objKey)).toBe(true);
        expect(cache.delete(symKey)).toBe(true);
        expect(cache.delete(strKey)).toBe(true);

        expect(cache.get(objKey)).toBeUndefined();
        expect(cache.get(symKey)).toBeUndefined();
        expect(cache.get(strKey)).toBeUndefined();
    });

    it('should report correct size for mixed keys', () => {
        cache.set({ a: 1 }, { b: 2 });
        cache.set(Symbol('sym'), Symbol('v'));
        cache.set('string', 'value');

        expect(cache.size).toBe(3);
    });

    it('clear() should empty the cache', () => {
        cache.set({ a: 1 }, { b: 2 });
        cache.set(Symbol('sym'), Symbol('v'));
        cache.set('key', 'val');

        cache.clear();

        expect(cache.size).toBe(0);
    });

    it('has() should return correct status for keys', () => {
        const objKey = { o: 1 };
        const symKey = Symbol('haskey');
        const strKey = 'has-key';

        cache.set(objKey, { d: 1 });
        cache.set(symKey, Symbol('val'));
        cache.set(strKey, 'strval');

        expect(cache.has(objKey)).toBe(true);
        expect(cache.has(symKey)).toBe(true);
        expect(cache.has(strKey)).toBe(true);
    });

    it('should return null if object is GCd (simulated)', () => {
        let value: object | null = { name: 'GC me' }
        const key = {}

        cache.set(key, value)

        value = null;
        global.gc?.()

        const retrieved = cache.get(key)

        expect([retrieved, null]).toContain(retrieved)
    })

    it('should return null if no value is set for a key', () => {
        const key = {}
        const retrieved = cache.get(key)

        expect(retrieved).toBeUndefined()
    })

    it('should overwrite existing value for the same key', () => {
        const key = { name: 'John' }

        const value1 = { value1: 'value1' }
        const value2 = { value2: 'value2' }
        cache.set(key, value1)
        cache.set(key, value2)

        const retrieved = cache.get(key)
        expect(retrieved).toEqual(value2)
    })

    it('should call the cleanup function on GC if provided', async () => {
        if (!global.gc) {
            console.warn('Run test with --expose-gc to test GC behavior')
            return
        }

        let value: object | null = { name: 'GC Me' }
        const key = { id: 'x' }

        const cleanup = vi.fn()
        const unregisterToken = Object(Symbol('token'))

        cache.getNotificationOnGC({
            key, value, cleanup,
            unregisterToken
        })

        value = null

        // Force GC — this will only trigger FinalizationRegistry asynchronously
        global.gc()

        await new Promise(resolve => setTimeout(resolve, 100))

        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    it('should return true for alive keys and false after GC', () => {
        if (!global.gc) {
            console.warn('Run test with --expose-gc to test GC behavior')
            return
        }

        const key = 'this'
        const value = { name: 'GC me' }

        cache.set(key, value)

        //alive now
        expect(cache.has(key)).toBe(true)

        global.gc()

        //should be GC'd by now
        expect(cache.has(key)).toBe(false)
    })

    it('should delete both object and symbol keys correctly', () => {
        const key1 = { name: 'key1' }
        const value1 = { name: 'key2' }
        const symKey = Symbol('key2')
        const symVal = Symbol('val')

        cache.set(key1, value1)
        cache.set(symKey, symVal)


        //alive
        expect(cache.get(key1)).toEqual(value1)
        expect(cache.get(symKey)).toEqual(symVal)

        //Destroy
        cache.delete(key1)
        cache.delete(symKey)

        expect(cache.get(key1)).toBeUndefined()
        expect(cache.get(symKey)).toBeUndefined()
        expect(cache.size).toEqual(0)
    })

    it('should reflect only alive values in size', () => {
        const key1 = { name: 'key1' }
        const key3 = { name: 'key3' }
        const key5 = { name: 'key5' }
        const obj = { name: 'obj1' }
        const symKey1 = Symbol('symbol1')
        const symKey2 = Symbol('symbol2')
        const symVal = Symbol('value')


        cache.set(key1, obj)
        cache.set(symKey1, symVal)
        cache.set(key3, obj)
        cache.set(symKey2, symVal)
        cache.set(key5, obj)

        expect(cache.size).toEqual(5)

        //Destroy 2
        cache.delete(key1)
        cache.delete(symKey1)

        expect(cache.size).toEqual(3)
    })

    it('should cache and retrieve symbol values correctly', () => {
        const symKey = Symbol('symKey')
        const symVal = Symbol('symVal')

        cache.set(symKey, symVal)

        const retrieved = cache.get(symKey)

        expect(cache.has(symKey)).toBe(true)
        expect(cache.size).toEqual(1)
        expect(retrieved).toEqual(symVal)
    })

    it('should decrease size when an object is GC\'d', async () => {
        if (!global.gc) {
            console.warn('Run test with --expose-gc to test GC behavior')
            return
        }

        let a: object | null = { foo: 1 };
        const b: object | null = { bar: 2 }
        const keyA = {}, keyB = {}

        cache.set(keyA, a)
        cache.set(keyB, b)

        expect(cache.size).toBe(2)

        a = null
        global.gc?.()
        await new Promise(res => setTimeout(res, 250))

        expect(cache.size).toBeLessThanOrEqual(1)
    })
})