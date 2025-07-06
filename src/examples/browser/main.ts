import { SmartCache } from "../../SmartCache";

class SmartCacheDemo {
    private cache: SmartCache<string, HTMLElement>;
    private elementCounter: number = 0;
    private totalCreated: number = 0;
    private cachedElements: Map<string, HTMLElement> = new Map();

    constructor() {
        this.cache = new SmartCache<string, HTMLElement>();
        this.setupEventListeners();
        this.updateStats();
    }

    private setupEventListeners(): void {
        document.getElementById("cacheBtn")?.addEventListener("click", () => this.cacheElement());
        document.getElementById("deleteBtn")?.addEventListener("click", () => this.removeReference());
        document.getElementById("checkBtn")?.addEventListener("click", () => this.checkCache());
        document.getElementById("clearBtn")?.addEventListener("click", () => this.clearAll());

        // Memory management tests
        document.getElementById("massCreate")?.addEventListener("click", () => this.massCreate());
        document.getElementById("massDelete")?.addEventListener("click", () => this.massDelete());
        document.getElementById("memoryTest")?.addEventListener("click", () => this.memoryTest());

        document.getElementById("clearLog")?.addEventListener("click", () => this.clearLog());
    }

    private cacheElement(): void {
        const key = `element_${++this.elementCounter}`;
        const element = document.createElement("div");
        element.className = "cached-element";
        element.textContent = `🎯 Cached Element #${this.elementCounter}`;
        element.setAttribute("data-key", key);

        const container = document.getElementById("cachedElements");
        if (container?.querySelector("em")) {
            container.innerHTML = "";
        }
        container?.appendChild(element);

        this.cache.set(key, element);
        this.cachedElements.set(key, element);
        this.totalCreated++;

        this.log(`📦 Cached element with key: ${key}`, "cache");
        this.updateStats();
    }

    private removeReference(): void {
        const keys = Array.from(this.cachedElements.keys());
        if (keys.length === 0) {
            this.log("⚠️ No elements to remove", "warning");
            return;
        }

        const key = keys[0];
        const element = this.cachedElements.get(key);

        if (element?.parentNode) {
            element.parentNode.removeChild(element);
        }

        this.cachedElements.delete(key);
        this.log(`🗑️ Removed reference for key: ${key}`, "delete");

        // Check if it's still in cache after a delay
        setTimeout(() => {
            const stillExists = this.cache.get(key);
            if (stillExists) {
                this.log(`🔍 Element still in cache: ${key}`, "info");
            } else {
                this.log(`✅ Element cleaned up from cache: ${key}`, "info");
            }
            this.updateStats();
        }, 1000);
    }

    private checkCache(): void {
        const keys = Array.from(this.cachedElements.keys());
        this.log(`🔍 Checking cache status for ${keys.length} keys...`, "info");

        let existingCount = 0;
        keys.forEach(key => {
            const exists = this.cache.has(key);
            if (exists) existingCount++;
            this.log(`  ${key}: ${exists ? '✅' : '❌'}`, "info");
        });

        this.log(`📊 ${existingCount}/${keys.length} elements still in cache`, "info");
        this.updateStats();
    }

    private clearAll(): void {
        const container = document.getElementById("cachedElements");
        if (container) {
            container.innerHTML = "<em>Cached elements will appear here...</em>";
        }

        this.cachedElements.clear();
        this.elementCounter = 0;

        this.log("🧹 Cleared all references", "delete");
        this.updateStats();

        setTimeout(() => {
            this.log("🔍 Cache status after clearing references:", "info");
            this.checkCacheSize();
        }, 1000);
    }

    private massCreate(): void {
        this.log("🚀 Creating 50 elements...", "cache");
        let createdCount = 0;
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                this.cacheElement();
                createdCount++
                if (createdCount === 49) {
                    this.log("✅ Mass creation complete", "info");
                }
            }, i * 20);
        }
    }

    private massDelete(): void {
        this.log("🗑️ Clearing all references...", "delete");
        this.clearAll();
    }

    private async memoryTest(): Promise<void> {
        this.log("🧪 Starting memory pressure test...", "info");

        // Create many elements rapidly
        const testCache = new SmartCache<string, Record<string, unknown>>();
        const testElements: string[] = [];

        for (let i = 0; i < 1000; i++) {
            const key = `test_${i}`;
            const data = {
                id: i,
                payload: new Array(100).fill(`data_${i}`),
                timestamp: Date.now()
            };

            testCache.set(key, data);
            testElements.push(key);
        }

        this.log(`📦 Created 1000 cache entries`, "cache");

        // Clear references and monitor
        testElements.length = 0;
        this.log(`🗑️ Cleared all test references`, "delete");

        // Check cache size periodically
        let checkCount = 0;
        const checkInterval = setInterval(() => {
            this.checkCacheSize();
            checkCount++;

            if (checkCount >= 10) {
                clearInterval(checkInterval);
                this.log("🏁 Memory test complete", "info");
            }
        }, 1000);
    }

    private checkCacheSize(): void {
        const sampleKeys = [`test_0`, `test_500`, `test_999`];
        let remainingCount = 0;

        sampleKeys.forEach(key => {
            if (this.cache.has(key)) remainingCount++;
        });

        this.log(`📊 Sample check: ${remainingCount}/3 test entries remain`, "info");
    }

    private updateStats(): void {
        const statusEl = document.getElementById("cacheStatus");
        const itemCountEl = document.getElementById("itemCount");
        const totalCreatedEl = document.getElementById("totalCreated");

        if (statusEl) statusEl.textContent = this.cachedElements.size > 0 ? "Active" : "Ready";
        if (itemCountEl) itemCountEl.textContent = this.cachedElements.size.toString();
        if (totalCreatedEl) totalCreatedEl.textContent = this.totalCreated.toString();
    }

    private log(message: string, type: "info" | "cache" | "delete" | "warning" = "info"): void {
        const logOutput = document.getElementById("logOutput");
        if (!logOutput) return;

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement("div");
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;

        logOutput.appendChild(entry);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    private clearLog(): void {
        const logOutput = document.getElementById("logOutput");
        if (logOutput) logOutput.innerHTML = "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new SmartCacheDemo();
});