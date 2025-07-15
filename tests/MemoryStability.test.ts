import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SmartCache } from '../src/SmartCache';

let finalizationCallback: (held: { key: object; value: object }) => void;
const mockUnregister = vi.fn();
const mockRegister = vi.fn();

beforeEach(() => {
    vi.useFakeTimers();
    global.FinalizationRegistry = vi.fn().mockImplementation((cb) => {
        finalizationCallback = cb;
        return {
            register: mockRegister,
            unregister: mockUnregister
        };
    });
});

afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('SmartCache - Memory and Stability', () => {
    it('deleting key removes it from registry and cache', () => {
        const cache = new SmartCache();
        const key = { id: 1 };
        const value = { name: 'leak-test' };
        cache.set(key, value);
        cache.delete(key);
        expect(cache.get(key)).toBeNull();
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('clearing all entries removes them from cache and registry', () => {
        const cache = new SmartCache();
        const key1 = { id: 1 }, key2 = { id: 2 };
        cache.set(key1, { a: 1 });
        cache.set(key2, { b: 2 });
        cache.clear();
        expect(cache.get(key1)).toBeNull();
        expect(cache.get(key2)).toBeNull();
        expect(mockUnregister).toHaveBeenCalledTimes(2);
    });

    it('registry does not hold strong reference to object', () => {
        const cache = new SmartCache();
        const key = { id: 9 };
        const value = { name: 'test' };
        cache.set(key, value);
        expect(() => finalizationCallback({ key, value })).not.toThrow();
    });
});