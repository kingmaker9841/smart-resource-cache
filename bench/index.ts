/* eslint-disable @typescript-eslint/no-explicit-any */
// bench/index.ts

import Benchmark from 'benchmark';
import { LRUCache } from 'lru-cache';
import NodeCache from 'node-cache';
import { SmartCache } from '../src/SmartCache';

// Formatting helpers
const formatOps = (hz: number) =>
    hz > 1e6 ? `${(hz / 1e6).toFixed(2)}M ops/sec`
        : hz > 1e3 ? `${(hz / 1e3).toFixed(2)}K ops/sec`
            : `${hz.toFixed(2)} ops/sec`;

const formatMemory = (bytes: number) =>
    `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const generateObjectKey = (i: number) => ({ id: i, type: 'test' });
const generateValue = (i: number) => ({ data: `value-${i}`, timestamp: Date.now() });

// =============================================================================
// 1. BASIC OPERATIONS BENCHMARK
// =============================================================================

console.log('📊 1. Basic Operations Performance:');
console.log('='.repeat(50));

const basicSuite = new Benchmark.Suite();

const testKeys = Array.from({ length: 1000 }, (_, i) => generateObjectKey(i));
const testValues = Array.from({ length: 1000 }, (_, i) => generateValue(i));
const stringKeys = Array.from({ length: 1000 }, (_, i) => `key-${i}`);

const smartCache = new SmartCache();
const nodeCache = new NodeCache();
const lruCache = new LRUCache({ max: 1000 });

testKeys.forEach((key, i) => smartCache.set(key, testValues[i]));
stringKeys.forEach((key, i) => {
    smartCache.set(key, testValues[i]);
    nodeCache.set(key, testValues[i]);
    lruCache.set(key, testValues[i]);
});

let keyIndex = 0;

basicSuite
    .add('SmartCache - SET (object key)', () => {
        const i = keyIndex++ % 1000;
        smartCache.set(testKeys[i], testValues[i]);
    })
    .add('SmartCache - GET (object key)', () => {
        const i = keyIndex++ % 1000;
        smartCache.get(testKeys[i]);
    })
    .add('SmartCache - SET (string key)', () => {
        const i = keyIndex++ % 1000;
        smartCache.set(stringKeys[i], testValues[i]);
    })
    .add('SmartCache - GET (string key)', () => {
        const i = keyIndex++ % 1000;
        smartCache.get(stringKeys[i]);
    })
    .add('SmartCache - SET (symbol key)', () => {
        const key = Symbol(`test-${keyIndex++}`);
        const value = Symbol(`value-${keyIndex}`);
        smartCache.set(key, value);
    })
    .add('NodeCache - SET (string key)', () => {
        const i = keyIndex++ % 1000;
        nodeCache.set(stringKeys[i], testValues[i]);
    })
    .add('NodeCache - GET (string key)', () => {
        const i = keyIndex++ % 1000;
        nodeCache.get(stringKeys[i]);
    })
    .add('LRUCache - SET (string key)', () => {
        const i = keyIndex++ % 1000;
        lruCache.set(stringKeys[i], testValues[i]);
    })
    .add('LRUCache - GET (string key)', () => {
        const i = keyIndex++ % 1000;
        lruCache.get(stringKeys[i]);
    })
    .on('cycle', (event: any) => {
        console.log(`  ${event.target.name}: ${formatOps(event.target.hz)}`);
    })
    .on('complete', function (this: any) {
        console.log(`\n🏆 Fastest: ${this.filter('fastest').map('name').join(', ')}\n`);
    })
    .run();

// =============================================================================
// 2. MEMORY USAGE BENCHMARK
// =============================================================================

console.log('💾 2. Memory Usage Comparison:');
console.log('='.repeat(50));

const measureMemory = () => {
    if (global.gc) global.gc();
    return process.memoryUsage();
};

const baseline = measureMemory();
console.log(`Baseline memory: ${formatMemory(baseline.heapUsed)}`);

const smartMemory = new SmartCache();
for (let i = 0; i < 10000; i++) {
    smartMemory.set(`key-${i}`, generateValue(i));
}
const smartMem = measureMemory();
console.log(`SmartCache (10k strings): ${formatMemory(smartMem.heapUsed)} (+${formatMemory(smartMem.heapUsed - baseline.heapUsed)})`);

const lruMemCache = new LRUCache({ max: 10000 });
for (let i = 0; i < 10000; i++) {
    lruMemCache.set(`key-${i}`, generateValue(i));
}
const lruMem = measureMemory();
console.log(`LRUCache (10k strings): ${formatMemory(lruMem.heapUsed)} (+${formatMemory(lruMem.heapUsed - baseline.heapUsed)})`);

const nodeMemCache = new NodeCache();
for (let i = 0; i < 10000; i++) {
    nodeMemCache.set(`key-${i}`, generateValue(i));
}
const nodeMem = measureMemory();
console.log(`NodeCache (10k strings): ${formatMemory(nodeMem.heapUsed)} (+${formatMemory(nodeMem.heapUsed - baseline.heapUsed)})\n`);

// =============================================================================
// 3. ADVANCED FEATURES BENCHMARK
// =============================================================================

console.log('⚡ 3. Advanced Features Performance:');
console.log('='.repeat(50));

const advancedSuite = new Benchmark.Suite();
const ttlSmart = new SmartCache();
const ttlNode = new NodeCache({ stdTTL: 1 });
const lruSmartObj = new SmartCache({ maxSize: 100 });
const lruSmartStr = new SmartCache({ maxSize: 100 });
const lruRef = new LRUCache({ max: 100 });

advancedSuite
    .add('SmartCache - TTL set (object)', () => {
        ttlSmart.set(generateObjectKey(Math.random()), generateValue(0), { ttl: 1000 });
    })
    .add('SmartCache - TTL set (string)', () => {
        ttlSmart.set(`key-${Math.random()}`, generateValue(0), { ttl: 1000 });
    })
    .add('NodeCache - TTL set', () => {
        ttlNode.set(`key-${Math.random()}`, generateValue(0), 1);
    })
    .add('SmartCache - LRU eviction (string)', () => {
        lruSmartStr.set(`key-${Math.random()}`, generateValue(0));
    })
    .add('SmartCache - LRU eviction (object)', () => {
        lruSmartObj.set(generateObjectKey(Math.random()), generateValue(0));
    })
    .add('LRUCache - LRU eviction (string)', () => {
        lruRef.set(`key-${Math.random()}`, generateValue(0));
    })
    .on('cycle', (event: any) => {
        console.log(`  ${event.target.name}: ${formatOps(event.target.hz)}`);
    })
    .on('complete', function (this: any) {
        console.log(`\n🏆 Fastest: ${this.filter('fastest').map('name').join(', ')}\n`);
    })
    .run();

// =============================================================================
// Continue with STRESS TEST, LRU TEST, MEMORY EFFICIENCY, SUMMARY as before
// Make sure SmartCache (string keys) is included in same places
// =============================================================================
// =============================================================================
// 4. STRESS TEST BENCHMARK
// =============================================================================

console.log('🔥 4. Stress Test (Bulk Operations):');
console.log('='.repeat(50));

const stressSuite = new Benchmark.Suite();

stressSuite
    .add('SmartCache - 1k mixed operations (object keys)', () => {
        const cache = new SmartCache();
        for (let i = 0; i < 1000; i++) {
            const key = generateObjectKey(i);
            cache.set(key, generateValue(i));
            if (i % 3 === 0) cache.get(key);
            if (i % 5 === 0) cache.has(key);
            if (i % 7 === 0) cache.delete(key);
        }
    })
    .add('SmartCache - 1k mixed operations (string keys)', () => {
        const cache = new SmartCache();
        for (let i = 0; i < 1000; i++) {
            const key = `key-${i}`;
            cache.set(key, generateValue(i));
            if (i % 3 === 0) cache.get(key);
            if (i % 5 === 0) cache.has(key);
            if (i % 7 === 0) cache.delete(key);
        }
    })
    .add('SmartCache - 1k mixed operations (maxSize: 500)', () => {
        const cache = new SmartCache({ maxSize: 500 });
        for (let i = 0; i < 1000; i++) {
            const key = generateObjectKey(i);
            cache.set(key, generateValue(i));
            if (i % 3 === 0) cache.get(key);
            if (i % 5 === 0) cache.has(key);
            if (i % 7 === 0) cache.delete(key);
        }
    })
    .add('LRUCache - 1k mixed operations (max: 500)', () => {
        const cache = new LRUCache({ max: 500 });
        for (let i = 0; i < 1000; i++) {
            const key = `key-${i}`;
            cache.set(key, generateValue(i));
            if (i % 3 === 0) cache.get(key);
            if (i % 5 === 0) cache.has(key);
            if (i % 7 === 0) cache.delete(key);
        }
    })
    .add('NodeCache - 1k mixed operations', () => {
        const cache = new NodeCache();
        for (let i = 0; i < 1000; i++) {
            const key = `key-${i}`;
            cache.set(key, generateValue(i));
            if (i % 3 === 0) cache.get(key);
            if (i % 5 === 0) cache.has(key);
            if (i % 7 === 0) cache.del(key);
        }
    })
    .on('cycle', (event: any) => {
        console.log(`  ${event.target.name}: ${formatOps(event.target.hz)}`);
    })
    .on('complete', function (this: any) {
        console.log(`\n🏆 Fastest: ${this.filter('fastest').map('name').join(', ')}\n`);
    })
    .run();

// =============================================================================
// 5. LRU SPECIFIC PERFORMANCE TEST
// =============================================================================

console.log('🔄 5. LRU Performance Comparison:');
console.log('='.repeat(50));

const lruSuite = new Benchmark.Suite();

const sizes = [100, 500, 1000];

sizes.forEach((size) => {
    lruSuite
        .add(`SmartCache (maxSize: ${size}) - Insert beyond capacity`, () => {
            const cache = new SmartCache({ maxSize: size });
            for (let i = 0; i < size * 2; i++) {
                cache.set(generateObjectKey(i), generateValue(i));
            }
        })
        .add(`SmartCache (maxSize: ${size}) - Insert beyond capacity (string keys)`, () => {
            const cache = new SmartCache({ maxSize: size });
            for (let i = 0; i < size * 2; i++) {
                cache.set(`key-${i}`, generateValue(i));
            }
        })
        .add(`LRUCache (max: ${size}) - Insert beyond capacity`, () => {
            const cache = new LRUCache({ max: size });
            for (let i = 0; i < size * 2; i++) {
                cache.set(`key-${i}`, generateValue(i));
            }
        });
});

const testCache = new SmartCache({ maxSize: 100 });
const testCacheStr = new SmartCache({ maxSize: 100 });
const testLRU = new LRUCache({ max: 100 });

for (let i = 0; i < 100; i++) {
    testCache.set(generateObjectKey(i), generateValue(i));
    testCacheStr.set(`key-${i}`, generateValue(i));
    testLRU.set(`key-${i}`, generateValue(i));
}

lruSuite
    .add('SmartCache - LRU get (promotes to recent)', () => {
        const key = generateObjectKey(Math.floor(Math.random() * 50));
        testCache.get(key);
    })
    .add('SmartCache - LRU get (string keys, promotes to recent)', () => {
        const key = `key-${Math.floor(Math.random() * 50)}`;
        testCacheStr.get(key);
    })
    .add('LRUCache - LRU get (promotes to recent)', () => {
        const key = `key-${Math.floor(Math.random() * 50)}`;
        testLRU.get(key);
    })
    .add('SmartCache - LRU set (evicts oldest)', () => {
        const key = generateObjectKey(Date.now());
        testCache.set(key, generateValue(0));
    })
    .add('SmartCache - LRU set (string keys, evicts oldest)', () => {
        const key = `key-${Date.now()}`;
        testCacheStr.set(key, generateValue(0));
    })
    .add('LRUCache - LRU set (evicts oldest)', () => {
        const key = `key-${Date.now()}`;
        testLRU.set(key, generateValue(0));
    })
    .on('cycle', (event: any) => {
        console.log(`  ${event.target.name}: ${formatOps(event.target.hz)}`);
    })
    .on('complete', function (this: any) {
        console.log(`\n🏆 Fastest: ${this.filter('fastest').map('name').join(', ')}\n`);
    })
    .run();

// =============================================================================
// 6. MEMORY EFFICIENCY WITH MAXSIZE
// =============================================================================

console.log('💾 6. Memory Efficiency with Size Limits:');
console.log('='.repeat(50));

const testMemoryWithLimits = () => {
    const baseline = measureMemory();

    const smartLimited = new SmartCache({ maxSize: 1000 });
    for (let i = 0; i < 5000; i++) {
        smartLimited.set(generateObjectKey(i), generateValue(i));
    }
    const smartLimitedMem = measureMemory();

    const smartLimitedStr = new SmartCache({ maxSize: 1000 });
    for (let i = 0; i < 5000; i++) {
        smartLimitedStr.set(`key-${i}`, generateValue(i));
    }
    const smartLimitedStrMem = measureMemory();

    const lruLimited = new LRUCache({ max: 1000 });
    for (let i = 0; i < 5000; i++) {
        lruLimited.set(`key-${i}`, generateValue(i));
    }
    const lruLimitedMem = measureMemory();

    console.log(`SmartCache (maxSize: 1000, object keys, inserted 5000): ${formatMemory(smartLimitedMem.heapUsed)} (+${formatMemory(smartLimitedMem.heapUsed - baseline.heapUsed)})`);
    console.log(`SmartCache (maxSize: 1000, string keys, inserted 5000): ${formatMemory(smartLimitedStrMem.heapUsed)} (+${formatMemory(smartLimitedStrMem.heapUsed - baseline.heapUsed)})`);
    console.log(`LRUCache (max: 1000, inserted 5000): ${formatMemory(lruLimitedMem.heapUsed)} (+${formatMemory(lruLimitedMem.heapUsed - baseline.heapUsed)})`);
    console.log(`SmartCache items count (object keys): ${smartLimited.size}`);
    console.log(`SmartCache items count (string keys): ${smartLimitedStr.size}`);
    console.log(`LRUCache items count: ${lruLimited.size}\n`);
};

testMemoryWithLimits();

// =============================================================================
// 7. SUMMARY
// =============================================================================

setTimeout(() => {
    console.log('📋 BENCHMARK SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ SmartCache unique features:');
    console.log('  - Supports object keys (others need string conversion)');
    console.log('  - Supports string keys natively');
    console.log('  - Supports symbol keys');
    console.log('  - WeakRef-based garbage collection for object keys');
    console.log('  - FinalizationRegistry for cleanup');
    console.log('  - LRU eviction with maxSize option for object and string keys');
    console.log('  - Flexible TTL per item');
    console.log('');
    console.log('⚡ Performance considerations:');
    console.log('  - For string keys: LRUCache often fastest, but SmartCache is competitive');
    console.log('  - For object keys: SmartCache is unique and optimized');
    console.log('  - For LRU behavior: Both SmartCache and LRUCache perform well');
    console.log('  - For memory efficiency: Refer to above memory usage results');
    console.log('  - For TTL: NodeCache provides built-in TTL optimizations');
    console.log('');
    console.log('🎯 Use SmartCache when:');
    console.log('  - You need support for object or symbol keys');
    console.log('  - Automatic garbage collection of keys is desired');
    console.log('  - Flexible per-item TTL and LRU eviction is required');
    console.log('  - Memory cleanup and stability are important');
    console.log('');
    console.log('🔄 LRU Performance Notes:');
    console.log('  - SmartCache maxSize enables efficient LRU eviction');
    console.log('  - Object keys + LRU eviction is unique to SmartCache');
    console.log('  - Both caches offer O(1) access times');
    console.log('  - Memory usage is comparable when using similar limits');
}, 3000);
