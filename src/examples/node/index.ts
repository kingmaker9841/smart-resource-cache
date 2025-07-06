import { SmartCache } from "../../SmartCache";

class SmartCacheNodeDemo {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: SmartCache<any>;

    constructor() {
        this.cache = new SmartCache();
        this.runDemo();
    }

    async runDemo() {
        console.log("🚀 SmartCache Node.js Demo Starting...\n");

        // Basic operations demo
        await this.basicOperationsDemo();

        // GC notification demo
        await this.gcNotificationDemo();

        // Memory pressure test
        await this.memoryPressureTest();

        // Performance benchmark
        await this.performanceBenchmark();

        console.log("\n✅ Demo completed!");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getValue<T>(key: any): T | null {
        return this.cache.get(key) as T | null;
    }

    async basicOperationsDemo() {
        console.log("📦 === Basic Operations Demo ===");

        // Test different key types
        const stringKey = "user:123";
        const objectKey = { userId: 42, type: "premium" };
        const symbolKey = Symbol("unique");

        const userData = {
            name: "Alice",
            email: "alice@example.com",
            preferences: { theme: "dark", notifications: true }
        };

        // Set operations
        this.cache.set(stringKey, userData);
        this.cache.set(objectKey, { ...userData, plan: "premium" });
        this.cache.set(symbolKey, { ...userData, isSymbolKey: true });

        console.log("✅ Stored 3 items with different key types");

        // Get operations
        console.log("🔍 Retrieving values:");
        console.log(`  String key: ${JSON.stringify(this.getValue<{ name: string }>(stringKey)?.name)}`)
        console.log(`  String key: ${JSON.stringify(this.getValue<{ plan: string }>(objectKey)?.plan)}`)
        console.log(`  String key: ${JSON.stringify(this.getValue<{ isSymbolKey: string }>(symbolKey)?.isSymbolKey)}`)

        // Has operations
        console.log("🔍 Checking existence:");
        console.log(`  String key exists: ${this.cache.has(stringKey)}`);
        console.log(`  Object key exists: ${this.cache.has(objectKey)}`);
        console.log(`  Symbol key exists: ${this.cache.has(symbolKey)}`);

        // Delete operation
        this.cache.delete(stringKey);
        console.log(`  String key exists after delete: ${this.cache.has(stringKey)}`);

        console.log();
    }

    async gcNotificationDemo() {
        console.log("🧹 === GC Notification Demo ===");

        // Create objects that will be eligible for GC
        let largeObject: object | null = {
            id: "large-object-1",
            data: new Array(10000).fill("🎯"),
            timestamp: Date.now(),
            metadata: {
                size: "large",
                type: "test",
                description: "This object contains a lot of data"
            }
        };

        const key = { type: "large", id: 1 };

        // Store in cache
        this.cache.set(key, largeObject);

        // Set up GC notification
        this.cache.getNotificationOnGC({
            key,
            value: largeObject,
            cleanup: (cleanupKey) => {
                console.log("🧹 GC cleanup triggered!");
                console.log(`   Key type: ${typeof cleanupKey}`);
                console.log(`   Key content: ${JSON.stringify(cleanupKey)}`);
                console.log(`   Cleanup timestamp: ${new Date().toISOString()}`);
            }
        });

        console.log("📦 Created large object and registered for GC notification");
        console.log(`   Object size: ~${JSON.stringify(largeObject).length} chars`);

        // Clear the reference
        largeObject = null;
        console.log("🗑️ Cleared local reference to large object");

        // Force GC if available
        if (global.gc) {
            console.log("🧼 Forcing garbage collection...");
            global.gc();
            await this.delay(1000);
        } else {
            console.log("⚠️ GC not available. Run with --expose-gc flag to test GC behavior.");
            console.log("   Example: node --expose-gc dist/examples/node/index.js");
        }

        // Check cache status
        console.log("🔍 Cache status after potential GC:");
        console.log(`   Key still exists: ${this.cache.has(key)}`);
        const retrievedValue = this.cache.get(key);
        console.log(`   Value retrievable: ${retrievedValue !== undefined}`);

        console.log();
    }

    async memoryPressureTest() {
        console.log("🧪 === Memory Pressure Test ===");

        const testCache = new SmartCache();
        const testObjects = [];
        const startTime = Date.now();

        // Create many objects
        console.log("📦 Creating 1000 cache entries...");
        for (let i = 0; i < 1000; i++) {
            const key = { batch: "test", id: i };
            const value = {
                id: i,
                data: new Array(100).fill(`item-${i}`),
                timestamp: Date.now(),
                metadata: {
                    index: i,
                    batch: "memory-test",
                    created: new Date().toISOString()
                }
            };

            testCache.set(key, value);
            testObjects.push({ key, value });
        }

        const creationTime = Date.now() - startTime;
        console.log(`✅ Created 1000 entries in ${creationTime}ms`);

        // Clear references gradually
        console.log("🗑️ Clearing references in batches...");

        for (let batch = 0; batch < 10; batch++) {
            const batchStart = batch * 100;
            const batchEnd = batchStart + 100;

            // Clear references for this batch
            for (let i = batchStart; i < batchEnd; i++) {
                testObjects[i] = null;
            }

            console.log(`   Batch ${batch + 1}/10: Cleared references ${batchStart}-${batchEnd - 1}`);

            // Force GC if available
            if (global.gc) {
                global.gc();
            }

            await this.delay(100);
        }

        console.log("🔍 Final memory test status:");
        console.log(`   Test completed in ${Date.now() - startTime}ms`);

        // Sample some keys to check cache status
        const sampleKeys = [
            { batch: "test", id: 0 },
            { batch: "test", id: 500 },
            { batch: "test", id: 999 }
        ];

        sampleKeys.forEach((key, index) => {
            const exists = testCache.has(key);
            console.log(`   Sample key ${index}: ${exists ? 'EXISTS' : 'CLEANED'}`);
        });

        console.log();
    }

    async performanceBenchmark() {
        console.log("⚡ === Performance Benchmark ===");

        const benchmarkCache = new SmartCache();
        const iterations = 10000;

        // Benchmark SET operations
        console.log(`📊 Benchmarking ${iterations} SET operations...`);
        const setStartTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            const key = { benchmark: "set", id: i };
            const value = { data: `value-${i}`, timestamp: Date.now() };
            benchmarkCache.set(key, value);
        }

        const setEndTime = performance.now();
        const setDuration = setEndTime - setStartTime;
        console.log(`   SET: ${setDuration.toFixed(2)}ms (${(iterations / setDuration * 1000).toFixed(0)} ops/sec)`);

        // Benchmark GET operations
        console.log(`📊 Benchmarking ${iterations} GET operations...`);
        const getStartTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            const key = { benchmark: "set", id: i };
            benchmarkCache.get(key);
        }

        const getEndTime = performance.now();
        const getDuration = getEndTime - getStartTime;
        console.log(`   GET: ${getDuration.toFixed(2)}ms (${(iterations / getDuration * 1000).toFixed(0)} ops/sec)`);

        // Benchmark HAS operations
        console.log(`📊 Benchmarking ${iterations} HAS operations...`);
        const hasStartTime = performance.now();

        for (let i = 0; i < iterations; i++) {
            const key = { benchmark: "set", id: i };
            benchmarkCache.has(key);
        }

        const hasEndTime = performance.now();
        const hasDuration = hasEndTime - hasStartTime;
        console.log(`   HAS: ${hasDuration.toFixed(2)}ms (${(iterations / hasDuration * 1000).toFixed(0)} ops/sec)`);

        // Memory usage (if available)
        if (process.memoryUsage) {
            const memUsage = process.memoryUsage();
            console.log("💾 Memory usage:");
            console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
            console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
        }

        console.log();
    }

    delay(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

console.log("🎯 SmartCache Node.js Demo");
console.log("=".repeat(50));

if (global.gc) {
    console.log("✅ GC is available (--expose-gc flag detected)");
} else {
    console.log("⚠️  GC is not available. Run with --expose-gc for full demo:");
    console.log("   node --expose-gc dist/examples/node/index.js");
}

new SmartCacheNodeDemo();