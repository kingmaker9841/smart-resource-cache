# 🔒 SmartCache

> A garbage-collection-aware, WeakRef-powered cache for long-running apps.

`SmartCache` is a memory-efficient in-memory cache built with `WeakRef` and `FinalizationRegistry`. It automatically cleans up values when they are garbage collected, helping you avoid memory leaks in high-uptime applications like servers, data processors, or editor tools.

---

## 🚀 Features

- 🧠 **Garbage collection-aware** with `WeakRef` and `FinalizationRegistry`
- 🔑 Supports both **object and symbol** values
- 🧼 Automatic cleanup of dead entries
- 🔍 Utility methods: `.get()`, `.has()`, `.delete()`, `.clear()`, `.keys()`, `.size`
- 🧪 Fully unit tested (with GC-safe behavior)

---

## 📦 Installation

```
npm install smart-cache-gc
```

## 🛠️ Usage

```
import { SmartCache } from 'smart-cache-gc'

const cache = new SmartCache<object>()

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
