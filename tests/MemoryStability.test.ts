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
        const strKey = 'leak-str';
        const strValue = 'val';

        cache.set(key, value);
        cache.set(strKey, strValue);

        cache.delete(key);
        cache.delete(strKey);

        expect(cache.get(key)).toBeUndefined();
        expect(cache.get(strKey)).toBeUndefined();
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('clearing all entries removes them from cache and registry', () => {
        const cache = new SmartCache();
        const key1 = { id: 1 }, key2 = { id: 2 };
        const strKey1 = 'clear1', strKey2 = 'clear2';

        cache.set(key1, { a: 1 });
        cache.set(key2, { b: 2 });
        cache.set(strKey1, 'a');
        cache.set(strKey2, 'b');

        cache.clear();

        expect(cache.get(key1)).toBeUndefined();
        expect(cache.get(key2)).toBeUndefined();
        expect(cache.get(strKey1)).toBeUndefined();
        expect(cache.get(strKey2)).toBeUndefined();
        expect(mockUnregister).toHaveBeenCalledTimes(2); // only object keys unregister
    });

    it('registry does not hold strong reference to object', () => {
        const cache = new SmartCache();
        const key = { id: 9 };
        const value = { name: 'test' };
        cache.set(key, value);
        expect(() => finalizationCallback({ key, value })).not.toThrow();
    });
});