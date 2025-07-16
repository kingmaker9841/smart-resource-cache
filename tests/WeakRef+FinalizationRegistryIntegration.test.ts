import { afterEach, beforeEach } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { SmartCache } from "../src/SmartCache";

describe('WeakRef + FinalizationRegistry', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let finalizationCallback: (heldValue: { key: object; value: object }) => void;
    const mockUnregister = vi.fn();
    const mockRegister = vi.fn();
    let cache: SmartCache<object | symbol, object | symbol>

    beforeEach(() => {
        vi.useFakeTimers()
        vi.spyOn(console, 'log').mockImplementation(() => { });
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

    it('should trigger finalization cleanup for GCd object', async () => {
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

    it('should call unregister on TTL expiry', () => {
        const cache = new SmartCache({ defaultTtl: 1000 });
        const key = { id: 2 };
        const value = { name: 'temp' };

        cache.set(key, value);
        vi.advanceTimersByTime(1000);
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('should call unregister on delete()', () => {
        const cache = new SmartCache();
        const key = { id: 3 };
        const value = { name: 'manual' };
        cache.set(key, value);
        cache.delete(key);
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('should call unregister on clear()', () => {
        const cache = new SmartCache();
        const key = { id: 4 };
        const value = { name: 'clear-test' };
        cache.set(key, value);
        cache.clear();
        expect(mockUnregister).toHaveBeenCalled();
    });

    it('should skip WeakRef and registry for symbol keys', () => {
        const cache = new SmartCache();
        const key = Symbol('sym');
        const value = Symbol('val');
        cache.set(key, value);

        const stored = cache.get(key)

        expect(Object.is(stored, value)).toBe(true)
    });

})