import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartCache } from '../src/SmartCache';

describe('SmartCache - Symbol Support', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should store and retrieve a symbol key/value', () => {
        const cache = new SmartCache();
        const key = Symbol('symbolKey');
        const value = Symbol('symbolValue');

        cache.set(key, value);
        expect(cache.get(key)).toBe(value);
    });

    it('should not use WeakRef for symbols', () => {
        const cache = new SmartCache();
        const key = Symbol('sym');
        const value = Symbol('val');
        cache.set(key, value);

        // There's no reliable way to test WeakRef is skipped, but this test ensures nothing breaks
        expect(() => cache.get(key)).not.toThrow();
    });

    it('should support TTL with symbol keys', () => {
        const cache = new SmartCache({ defaultTtl: 1000 });
        const key = Symbol('ttlSymbol');
        const value = Symbol('ttlValue');
        cache.set(key, value);

        vi.advanceTimersByTime(1000);
        expect(cache.get(key)).toBeNull();
    });

    it('should support delete() with symbol keys', () => {
        const cache = new SmartCache();
        const key = Symbol('deleteSym');
        const value = Symbol('deleteVal');
        cache.set(key, value);
        expect(cache.delete(key)).toBe(true);
        expect(cache.get(key)).toBeNull();
    });

    it('should support clear() with symbol keys', () => {
        const cache = new SmartCache();
        const key = Symbol('clearSym');
        const value = Symbol('clearVal');
        cache.set(key, value);
        cache.clear();
        expect(cache.get(key)).toBeNull();
    });
});