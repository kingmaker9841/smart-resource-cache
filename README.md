# 🔒 SmartCache

[![npm version](https://img.shields.io/npm/v/smart-cache-gc.svg)](https://www.npmjs.com/package/smart-cache-gc)
[![bundlejs](https://deno.bundlejs.com/badge?q=smart-cache-gc)](https://bundlejs.com/?q=smart-cache-gc)
[![CI](https://github.com/kingmaker9841/smart-resource-cache/actions/workflows/ci.yml/badge.svg)](https://github.com/kingmaker9841/smart-resource-cache/actions/workflows/ci.yml)

> A garbage-collection-aware, WeakRef-powered cache for long-running apps.

`SmartCache` is a memory-efficient in-memory cache built with `WeakRef` and `FinalizationRegistry`. It automatically cleans up values when they are garbage collected, helping you avoid memory leaks in high-uptime applications like servers, data processors, or editor tools.

---

## 🚀 Features

- 🧠 **Garbage collection-aware** with `WeakRef` and `FinalizationRegistry`
- 🔑 Supports both **object and symbol** values
- 🧼 Automatic cleanup of dead entries
- 🔍 Utility methods: `.get()`, `.has()`, `.delete()`, `.clear()`, `.keys()`, `.size`
- ⏳ Optional TTL (Time-To-Live) expiration
- 📉 `maxSize` support with LRU eviction strategy
- 🧪 Fully unit tested (with GC-safe behavior)

---

## 📦 Installation

```
npm install smart-cache-gc
```

> `SmartCache` works out of the box with optional `ttl` and `maxSize` for expiration and LRU eviction.

## 🛠️ Usage

```
import { SmartCache } from 'smart-cache-gc'

// Optional TTL and maxSize support
const cacheWithOptions = new SmartCache<object>({
  defaultTtl: 1000 * 60, // 1 minute TTL by default
  maxSize: 100           // LRU eviction after 100 items
})

let obj = { id: 1 }
const key = { customKey: true }

cache.set(key, obj)

console.log(cache.has(key)) // true
console.log(cache.get(key)) // { id: 1 }

// Simulate garbage collection
obj = null
global.gc?.()

setTimeout(() => {
console.log(cache.get(key)) // null (after GC)
}, 500)

```

## 📚 Examples

For comprehensive examples and real-world use cases, check out the examples directory in this repository:

[Basic Usage](./src//examples/browser/main.ts) - Getting started with SmartCache  
[Advanced Configuration](./src/examples/node/index.ts) - Complex scenarios and best practices  
[Performance Benchmarks](./src/examples/node/index.ts) - Testing memory efficiency

## 🔔 GC Cleanup Hook

You can register a cleanup callback for when an object is garbage collected:

```
cache.getNotificationOnGC({
  key,
  value: yourObject,
  cleanup: (key, value) => {
    console.log(`${String(key)} was garbage collected`)
  }
})
```

## 🧪 Testing

```
node --expose-gc node_modules/vitest/vitest.mjs run
```

## 📁 Methods

| Method                | Description                                  |
| --------------------- | -------------------------------------------- |
| `set(key, value)`     | Store a value under a key (object or symbol) |
| `get(key)`            | Get cached value or `null` if GC'd           |
| `has(key)`            | Returns `true` if value is alive             |
| `delete(key)`         | Removes an entry                             |
| `clear()`             | Clears all entries                           |
| `keys()`              | Returns all alive keys                       |
| `size` (getter)       | Number of alive entries                      |
| `getNotificationOnGC` | Register a GC cleanup callback for a value   |

## ⚙️ Constructor Options

| Option       | Description                                    |
| ------------ | ---------------------------------------------- |
| `defaultTtl` | Default time-to-live for entries (in ms)       |
| `maxSize`    | Maximum number of live entries before eviction |

## 🕒 ttl per-entry (override)

You can override the default TTL on a per-entry basis using the optional ttl in .set():

```
cache.set(key, value, { ttl: 5000 }) // expires in 5 seconds
```

This overrides the defaultTtl set in the constructor (if any) for this specific entry only.

## ♻️ LRU Eviction

When `maxSize` is defined, `SmartCache` uses an optimized LRU eviction policy to remove the least recently accessed entries. This keeps memory usage predictable in high-load scenarios.

## Support

> ⚠️ This package requires support for `WeakRef` and `FinalizationRegistry`. These are available in:
>
> - Chrome 84+
> - Firefox 79+
> - Node.js 14.6+
> - Safari: Not yet supported as of 2025

> Please ensure your environment supports these features.

## 📜 License

[MIT](./LICENSE)

## 🤝 Contributing

Feel free to open issues or pull requests!

## Author

Made with care by Milan Panta
