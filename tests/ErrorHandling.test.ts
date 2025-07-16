import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartCache } from '../src/SmartCache';

describe('SmartCache - Error Handling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should throw error on invalid key/value types', () => {
        const cache = new SmartCache();
        expect(() => cache.set(null, {})).toThrow();
        expect(() => cache.set({}, undefined)).toThrow();
    });

    it('should clean up previous TTL and registry on duplicate set()', () => {
        const cache = new SmartCache();
        const key = { id: 1 };
        const value1 = { name: 'first' };
        const value2 = { name: 'second' };
        cache.set(key, value1, { ttl: 1000 });
        cache.set(key, value2, { ttl: 2000 });
        vi.advanceTimersByTime(2000);
        expect(cache.get(key)).toBeUndefined();
    });

    it('get() on non-existent key returns undefined', () => {
        const cache = new SmartCache();
        expect(cache.get({})).toBeUndefined();
        expect(cache.get(Symbol('nope'))).toBeUndefined();
    });

    it('calling clear() mid-execution doesn’t break registry or timers', () => {
        const cache = new SmartCache();
        const key = { id: 2 };
        const value = { test: true };
        cache.set(key, value, { ttl: 5000 });
        cache.clear();
        vi.advanceTimersByTime(5000);
        expect(cache.get(key)).toBeUndefined();
    });
});