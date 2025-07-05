type Key = number | string | Record<number | string, any>

type Value = any

export class SmartCache {
    #cache = new Map()

    get(key: Key) {
        if (this.#cache.has(key)) {
            const derefValue = this.#cache.get(key).deref()
            if (derefValue !== undefined) {
                return derefValue
            }
        }
        return null
    }

    set(key: Key, value: Value) {
        if (!this.#cache) {
            throw new Error('Cache not initialized')
        }
        if (!key) {
            throw new Error('Key must be provided')
        }
        if (!value) {
            throw new Error('No value provided')
        }
        this.#cache.set(key, new WeakRef(value))
        this.#registerKey({ key, value })
    }

    getNotificationOnGC({ key, value, cleanup }: { key: Key, value: any, cleanup?: (_?: any) => void }) {
        this.#registerKey({ key, value, cleanup })
    }
    #registerKey({ key, value, cleanup }: { key: Key, value: any, cleanup?: (_?: any) => void }) {
        const registry = new FinalizationRegistry(() => {
            console.log(`Object with key ${key} was GC'd`)

            // Here after getting GC'd still the key can be holding useless WeakRefs eg. WeakRef(undefined)
            // Delete the key as well
            const getDerefValue = this.#cache.get(key)?.deref()
            if (!getDerefValue) {
                this.#cache.delete(key)
            }

            //allow cleanup function
            cleanup?.()
        })
        registry.register(value, key)
    }
}