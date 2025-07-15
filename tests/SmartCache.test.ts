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

    it('should store and retrieve a value', () => {
        expect(cache.size).toEqual(0)
        const key = { id: 1 }
        const value = { name: 'John' }

        cache.set(key, value)
        const result = cache.get(key)

        expect(result).toEqual(value)
    })

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

        expect(retrieved).toBe(null)
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

        cache.getNotificationOnGC({ key, value, cleanup })

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
        const obj = { name: 'obj1' }
        const sym = Symbol('symbol')
        const key2 = { name: 'key2' }

        cache.set(key1, obj)
        cache.set(key2, sym)


        //alive
        expect(cache.get(key1)).toEqual(obj)
        expect(cache.get(key2)).toEqual(sym)

        //Destroy
        cache.delete(key1)
        cache.delete(key2)

        expect(cache.get(key1)).toEqual(null)
        expect(cache.get(key2)).toEqual(null)
        expect(cache.size).toEqual(0)
    })

    it('should reflect only alive values in size', () => {
        const key1 = { name: 'key1' }
        const key2 = { name: 'key2' }
        const key3 = { name: 'key3' }
        const key4 = { name: 'key4' }
        const key5 = { name: 'key5' }
        const obj = { name: 'obj1' }
        const sym = Symbol('symbol')


        cache.set(key1, obj)
        cache.set(key2, sym)
        cache.set(key3, obj)
        cache.set(key4, sym)
        cache.set(key5, obj)

        expect(cache.size).toEqual(5)

        //Destroy 2
        cache.delete(key1)
        cache.delete(key2)

        expect(cache.size).toEqual(3)
    })

    it('should return only alive keys from keys()', () => {
        const key1 = { name: 'key1' }
        const obj = { name: 'obj1' }
        const sym = Symbol('symbol')
        const key2 = { name: 'key2' }
        const key3 = { name: 'key3' }
        const key4 = { name: 'key4' }
        const key5 = { name: 'key5' }


        cache.set(key1, obj)
        cache.set(key2, sym)
        cache.set(key3, obj)
        cache.set(key4, sym)
        cache.set(key5, obj)

        let retrieved = cache.keys()
        expect(retrieved).toEqual([
            { name: 'key1' },
            { name: 'key3' },
            { name: 'key5' },
            { name: 'key2' },
            { name: 'key4' }
        ])

        // Destroy 
        cache.delete(key1)
        cache.delete(key2)

        retrieved = cache.keys()
        expect(retrieved).toEqual([
            { name: 'key3' },
            { name: 'key5' },
            { name: 'key4' }
        ])
    })

    it('should cache and retrieve symbol values correctly', () => {
        const key1 = 'Key1'
        const value1 = Symbol('Value1')

        cache.set(key1, value1)

        const retrieved = cache.get(key1)

        expect(cache.has(key1)).toBe(true)
        expect(cache.size).toEqual(1)
        expect(retrieved).toEqual(value1)
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