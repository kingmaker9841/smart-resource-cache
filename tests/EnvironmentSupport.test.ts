import { describe, expect, it } from 'vitest';

import { SmartCache } from '../src/SmartCache';

describe('SmartCache - Cross Environment Support', () => {
    it('should work in Node.js v14.6+ with WeakRef + FinalizationRegistry', () => {
        expect(typeof WeakRef).toBe('function');
        expect(typeof FinalizationRegistry).toBe('function');

        const cache = new SmartCache();
        const key = { id: 1 };
        const value = { name: 'node' };
        cache.set(key, value);
        expect(cache.get(key)).toEqual(value);
    });

    it('should work in browsers that support WeakRef + FinalizationRegistry', () => {
        expect(typeof WeakRef).toBe('function');
        expect(typeof FinalizationRegistry).toBe('function');

        const cache = new SmartCache();
        const key = { name: 'chrome' };
        const value = { browser: true };
        cache.set(key, value);
        expect(cache.get(key)).toEqual(value);
    });

    it('should throw or degrade gracefully if FinalizationRegistry is missing', () => {
        const originalFinalizationRegistry = global.FinalizationRegistry;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        delete global.FinalizationRegistry;

        expect(() => new SmartCache()).toThrowError(
            /FinalizationRegistry is not supported in this environment/
        );

        global.FinalizationRegistry = originalFinalizationRegistry;
    });
});
